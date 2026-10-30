/**
 * ==============================================================================
 * 🤖 個人財務助理 LINE Bot + Google Sheets + 儀表板 API (Code.gs)
 * ==============================================================================
 *
 * 核心功能：
 * 1. 【doPost】LINE Bot 接收自然語言記帳 -> Gemini 解析（支援一則多筆、「昨天」等日期）-> 寫入「記帳明細」
 * 2. 【doGet】提供前端儀表板讀取帳目。前端帶 v=2 時回傳已正規化的 JSON（台北時區日期、數字金額、列號 id）
 * 3. 【白名單】設定 ALLOWED_USER_IDS 後只接受自己的 LINE 帳號；傳「我的ID」可查詢自己的 userId
 * 4. 【撤銷】傳「撤銷」可刪除上一次由 LINE 寫入的紀錄（會先比對內容，不會誤刪手動修改過的列）
 * 5. 【快取去重】CacheService 6 小時內防止 LINE 重送導致重複記帳
 * 6. 【寫入鎖】LockService 避免多則訊息同時寫入互相覆蓋
 * 7. 【Gemini 備援鏈】gemini-3.5-flash-lite -> 3.1-flash-lite -> 2.5-flash，各自使用對應的 thinking 參數
 * 8. 【Webhook 金鑰】設定 LINE_WEBHOOK_KEY 後，只接受網址帶 ?key= 的請求（執行 setupWebhookKey 產生）
 *
 * 「月度彙總」工作表不再由程式累加（手動改明細時會失準）。前端直接從明細計算月總額；
 * 若想在試算表內看彙總，可執行一次 setupMonthlySummaryFormula() 改成自動公式。
 * ==============================================================================
 */

// ==============================================================================
// 1. 核心參數設定區（請在 GAS「專案設定」->「指令碼屬性」中設定）
// ==============================================================================
const CONFIG = {
  // LINE Messaging API Channel access token
  LINE_CHANNEL_ACCESS_TOKEN: getSecret('LINE_CHANNEL_ACCESS_TOKEN', 'YOUR_LINE_CHANNEL_ACCESS_TOKEN'),

  // Google AI Studio Gemini API Key
  GEMINI_API_KEY: getSecret('GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY'),

  // Google 試算表 ID（留空代表綁定當前打開的試算表）
  SPREADSHEET_ID: getSecret('SPREADSHEET_ID', ''),

  // 前端儀表板存取密鑰 Token（需與前端網頁設定的 Token 完全一致）
  API_SECRET_TOKEN: getSecret('API_SECRET_TOKEN', ''),

  // 允許記帳的 LINE userId（逗號分隔）。留空 = 不限制。先傳「我的ID」給 Bot 取得自己的 userId。
  ALLOWED_USER_IDS: getSecret('ALLOWED_USER_IDS', ''),

  // Webhook 網址的秘密參數（LINE 後台填 .../exec?key=這個值）。GAS 讀不到 X-Line-Signature 標頭、
  // 無法驗簽，改用這個擋掉知道網址的偽造請求。留空 = 不檢查。執行 setupWebhookKey() 產生。
  LINE_WEBHOOK_KEY: getSecret('LINE_WEBHOOK_KEY', '')
};

const TIMEZONE = 'Asia/Taipei';
const DETAIL_SHEET_NAME = '記帳明細';
const SUMMARY_SHEET_NAME = '月度彙總';
const BUDGET_SHEET_NAME = '預算設定';
const IRREGULAR_SHEET_NAME = '不固定大額支出';

// 模型備援鏈：Gemini 3.x 使用 thinkingLevel，2.5 系列使用 thinkingBudget（兩者不可同時傳）
// 兩個 Flash-Lite 各有獨立的免費額度（各 500 RPD），一個 503 滿載時另一個通常可用
const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash-lite', thinkingConfig: { thinkingLevel: 'minimal' } },
  { id: 'gemini-3.1-flash-lite', thinkingConfig: { thinkingLevel: 'minimal' } },
  { id: 'gemini-2.5-flash', thinkingConfig: { thinkingBudget: 0 } }
];

// 標準五大分類白名單（嚴格統一，絕無「生存」）
const VALID_CATEGORIES = ['生活', '家用', '社交', '娛樂', '雜支'];

const UNDO_COMMANDS = ['撤銷', '取消', '刪除上一筆', 'undo'];
const MY_ID_COMMANDS = ['我的id', 'myid', 'id'];

/**
 * 取得設定值（優先讀取「指令碼屬性」，若無則使用預設值）
 */
function getSecret(key, defaultValue = '') {
  try {
    const prop = PropertiesService.getScriptProperties().getProperty(key);
    if (prop && prop.trim()) {
      return prop.trim();
    }
  } catch (e) {}
  return (defaultValue || '').trim();
}

function isPlaceholder(value) {
  return !value || value.startsWith('YOUR_') || value.startsWith('請填入');
}

/**
 * 取得試算表實例
 */
function getSpreadsheet() {
  if (!isPlaceholder(CONFIG.SPREADSHEET_ID)) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getDetailSheet(ss) {
  return ss.getSheetByName(DETAIL_SHEET_NAME) || ss.getSheets()[0];
}

function isAllowedUser(userId) {
  const allowed = CONFIG.ALLOWED_USER_IDS.split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(userId);
}

// ==============================================================================
// 2. LINE Webhook 接收與處理核心 (doPost)
// ==============================================================================
function doPost(e) {
  if (!e || !e.postData) {
    return ContentService.createTextOutput("錯誤：請勿在 GAS 編輯器直接點擊執行 doPost。");
  }

  // 【Webhook 金鑰】設定後，網址沒帶正確 ?key= 的請求一律忽略（仍回 OK，不透露原因）
  if (CONFIG.LINE_WEBHOOK_KEY && ((e.parameter && e.parameter.key) || '') !== CONFIG.LINE_WEBHOOK_KEY) {
    Logger.log('⛔ Webhook 金鑰不符，忽略請求');
    return ContentService.createTextOutput("OK");
  }

  try {
    const postData = JSON.parse(e.postData.contents);
    const events = postData.events;

    if (!events || events.length === 0) {
      return ContentService.createTextOutput("OK");
    }

    const cache = CacheService.getScriptCache();

    for (const event of events) {
      // 僅處理文字訊息事件
      if (event.type !== 'message' || event.message.type !== 'text') {
        continue;
      }

      const userText = (event.message.text || '').trim();
      const replyToken = event.replyToken;
      const userId = (event.source && event.source.userId) || '';
      const eventId = event.webhookEventId || replyToken;

      // 【去重機制】LINE 重送可能延遲數分鐘以上，保留 6 小時（CacheService 上限）
      const cacheKey = 'line_evt_' + eventId;
      if (cache.get(cacheKey)) {
        Logger.log(`⚠️ 忽略重複事件: ${eventId}`);
        continue;
      }
      cache.put(cacheKey, 'processed', 21600);

      const command = userText.toLowerCase().replace(/\s+/g, '');

      // 查詢自己的 userId（不受白名單限制，方便第一次設定）
      if (MY_ID_COMMANDS.includes(command)) {
        replyToLine(replyToken, `你的 LINE userId：\n${userId}\n\n將它填入 GAS 指令碼屬性 ALLOWED_USER_IDS，即可只允許你自己記帳。`);
        continue;
      }

      // 【白名單】非允許的使用者一律不寫入、不回覆
      if (!isAllowedUser(userId)) {
        Logger.log(`⛔ 拒絕未授權使用者: ${userId}`);
        continue;
      }

      if (command === 'ping') {
        replyToLine(replyToken, 'pong 🏓 系統連線正常！');
        continue;
      }

      if (UNDO_COMMANDS.includes(command)) {
        replyToLine(replyToken, undoLastBatch(userId));
        continue;
      }

      try {
        // 1. 簡單的「項目 金額」先用規則秒解析；有日期、運算或認不出分類才呼叫 Gemini
        const records = parseSimpleRecords(userText) || callGemini(userText);

        // 2. 寫入 Google 試算表
        writeRecords(records, userId);

        // 3. 回覆 LINE
        replyToLine(replyToken, formatReply(records));

      } catch (err) {
        Logger.log(`❌ 處理使用者記帳失敗: ${err.message}`);
        const helpMessage = `❓ 無法辨識消費內容。\n請嘗試輸入範例：「午餐排骨便當 120」\n(除錯訊息: ${err.message})`;
        replyToLine(replyToken, helpMessage);
      }
    }

    return ContentService.createTextOutput("OK");

  } catch (globalError) {
    Logger.log(`❌ doPost 異常: ${globalError.message}`);
    return ContentService.createTextOutput("ERROR: " + globalError.message);
  }
}

function formatReply(records) {
  const todayStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const describe = (r) => {
    const dateNote = r.date !== todayStr ? `（${r.date}）` : '';
    return { dateNote, text: `項目：${r.item}${dateNote}\n金額：${r.amount}\n分類：${r.category}` };
  };

  if (records.length === 1) {
    return `✅ 記帳成功！\n${describe(records[0]).text}`;
  }

  const lines = records.map((r, i) => `${i + 1}. ${r.item} ${r.amount}（${r.category}）${describe(r).dateNote}`);
  const total = records.reduce((sum, r) => sum + r.amount, 0);
  return `✅ 記帳成功！共 ${records.length} 筆\n${lines.join('\n')}\n合計：${total}`;
}

// ==============================================================================
// 2b. 規則快速解析（不經 Gemini）
// ==============================================================================

// 依序比對，先比對較具體的分類；同一個項目第一個命中的關鍵字決定分類。
// 新增常用店家或品項時直接加在這裡（英文不分大小寫）。
const CATEGORY_KEYWORDS = [
  ['社交', ['聚餐', '請客', '送禮', '禮物', '紅包', '白包', '喜酒', '分帳', '慶生']],
  ['娛樂', ['電影', '遊戲', '課金', 'netflix', 'spotify', 'youtube', 'disney', '訂閱', '旅遊', '門票',
            'ktv', '演唱會', 'switch', 'steam', '展覽']],
  ['家用', ['房租', '家具', '日用品', '衛生紙', '洗衣', '清潔', '修繕', '裝潢', '家電', '燈泡']],
  ['雜支', ['看醫生', '醫生', '診所', '掛號', '藥', '捷運', '悠遊卡', '公車', '加油', '停車', '計程車',
            'uber', '高鐵', '火車', '交通', '剪頭髮', '理髮']],
  ['生活', ['早餐', '午餐', '晚餐', '宵夜', '早午餐', '便當', '火鍋', '飯', '麵', '粥', '餐', '吃',
            '咖啡', '飲料', '奶茶', '茶', '豆漿', '全家', '7-11', '711', '萊爾富', '超商', '全聯',
            '家樂福', '買菜', '菜', '水果', '麵包', '水費', '電費', '瓦斯', '電話費', '網路費']]
];

// 先比對的完整詞，用來蓋過單字關鍵字的誤判（例如「茶几」不是飲料、「藥燉排骨」不是看醫生）
const PRIORITY_PHRASES = [
  ['茶几', '家用'], ['茶壺', '家用'], ['茶杯', '家用'],
  ['藥燉', '生活'], ['藥膳', '生活'], ['麵包機', '家用'], ['飯鍋', '家用'], ['電鍋', '家用'],
  ['車票', '雜支'], ['餐具', '家用']
];

// 出現這些字代表需要語意理解（日期、分攤、計算），一律交給 Gemini
const NEEDS_AI_PATTERN = /昨|前天|上週|上周|禮拜|星期|週[一二三四五六日]|\d+\s*[\/月]\s*\d+|號|每人|平分|AA|\d\s*[+＋*×xX]\s*\d|折|退/;

function guessCategory(item) {
  const lower = item.toLowerCase();
  const phrase = PRIORITY_PHRASES.find(([p]) => lower.includes(p));
  if (phrase) return phrase[1];
  for (const [category, words] of CATEGORY_KEYWORDS) {
    if (words.some(w => lower.includes(w))) return category;
  }
  return null;
}

/**
 * 解析「午餐 120」「全家85」「午餐 120 飲料 50」這類訊息。
 * 任何一段無法確定分類、或整句還有沒被吃掉的內容，就回傳 null 交給 Gemini。
 */
function parseSimpleRecords(text) {
  const clean = String(text || '').trim();
  if (!clean || NEEDS_AI_PATTERN.test(clean)) return null;

  const segment = /([^\d\s,，、;；]+?)\s*(\d+(?:\.\d+)?)\s*(?:元|塊|圓)?/g;
  const records = [];
  let match;
  while ((match = segment.exec(clean)) !== null) {
    const item = match[1].replace(/(消費|花費|支出|購買)$/, '').trim();
    const amount = Number(match[2]);
    const category = guessCategory(item);
    if (!item || !category || !(amount > 0 && amount < 1000000)) return null;
    records.push({ date: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd'), item, category, amount });
  }

  // 除了分隔符號外不能有剩下的字，避免漏掉資訊
  const leftover = clean.replace(segment, '').replace(/[\s,，、;；]/g, '');
  if (records.length === 0 || leftover) return null;

  Logger.log(`⚡ 規則解析（未呼叫 Gemini）: ${JSON.stringify(records)}`);
  return records;
}

// ==============================================================================
// 3. Gemini API 呼叫核心（備援鏈 + 多筆 + 日期）
// ==============================================================================
function callGemini(userText) {
  const apiKey = CONFIG.GEMINI_API_KEY;
  if (isPlaceholder(apiKey)) {
    throw new Error('未設定 GEMINI_API_KEY，請在指令碼屬性中填入金鑰');
  }

  const now = new Date();
  const todayStr = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][Number(Utilities.formatDate(now, TIMEZONE, 'u')) % 7];

  const systemPrompt = `你是一個專業個人記帳助理。請從使用者的自然語言訊息中，擷取每一筆消費的「日期」、「項目名稱」、「分類類別」與「消費金額」。
今天是：${todayStr}（星期${weekday}）。

【五大標準分類規則（必須且僅能從中擇一）】
1. 「生活」：正餐、午餐、便當、超商、全家、7-11、早餐、飲料、食材買菜、水電瓦斯日常必要
2. 「家用」：房租、家具、日用耗材、修繕裝潢、家電
3. 「社交」：聚餐、請客、送禮、紅白包、朋友分帳
4. 「娛樂」：電影、遊戲課金、Netflix/Spotify訂閱、旅遊玩樂、非必要休閒
5. 「雜支」：看醫生診所掛號費、藥品、捷運悠遊卡交通、無法歸類之臨時支出

【項目名稱原則（極為重要！）】
- 保持使用者輸入的原貌精髓，例如「全家」、「排骨便當」、「看醫生」。
- 絕對禁止自行添加「消費」、「支出」、「花費」、「購買」等贅字（例如使用者輸入「全家 500」，項目必須是「全家」，不得為「全家消費」）。

【多筆與日期】
- 一則訊息可能包含多筆消費（例如「午餐 120 飲料 50」是兩筆），每筆各自輸出。
- 若提到「昨天」、「前天」、「上週五」、「10/3」等，換算成 yyyy-MM-dd；沒提到日期就用今天 ${todayStr}。

【回傳格式】
嚴格只回傳乾淨的 JSON，嚴格禁止任何 Markdown 語法或額外文字說明：
{"records": [{"date": "yyyy-MM-dd", "item": "項目名稱", "category": "生活|家用|社交|娛樂|雜支", "amount": 數字}]}`;

  const errors = [];

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`;
    const payload = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            { text: `使用者輸入：「${userText}」` }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RECORDS_SCHEMA, // 強制輸出 {"records":[...]}，避免多筆時吐出多個獨立物件
        thinkingConfig: model.thinkingConfig,
        temperature: 0.1
      }
    };

    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-goog-api-key': apiKey }, // 金鑰放 header，不出現在 URL / log 中
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const statusCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (statusCode !== 200) {
        Logger.log(`⚠️ 模型 [${model.id}] 回應 HTTP ${statusCode}: ${responseText.slice(0, 180)}`);
        errors.push(`[${model.id}] HTTP ${statusCode}`);
        continue;
      }

      const resJson = JSON.parse(responseText);
      const rawContent = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawContent) {
        Logger.log(`⚠️ 模型 [${model.id}] 回應沒有文字內容: ${responseText.slice(0, 180)}`);
        errors.push(`[${model.id}] 空回應`);
        continue;
      }

      const cleanedText = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
      const records = sanitizeRecords(parseModelJson(cleanedText), todayStr);
      if (records.length === 0) {
        errors.push(`[${model.id}] 解析不到金額`);
        continue;
      }

      Logger.log(`✅ [${model.id}] 解析成功: ${JSON.stringify(records)}`);
      return records;
    } catch (e) {
      Logger.log(`⚠️ 模型 [${model.id}] 請求異常: ${e.message}`);
      errors.push(`[${model.id}] ${e.message}`);
    }
  }

  throw new Error(`所有備援模型皆無回應 (${errors.join('；') || '請確認 API Key 與額度'})`);
}

// Gemini 結構化輸出 schema
const RECORDS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    records: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'yyyy-MM-dd' },
          item: { type: 'STRING' },
          category: { type: 'STRING', enum: VALID_CATEGORIES },
          amount: { type: 'NUMBER' }
        },
        required: ['date', 'item', 'category', 'amount']
      }
    }
  },
  required: ['records']
};

/**
 * 解析模型輸出。正常是單一 JSON；若模型仍吐出多個並列物件（JSON Lines），逐一擷取。
 */
function parseModelJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const objects = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}' && depth > 0) {
        depth--;
        if (depth === 0) objects.push(JSON.parse(text.slice(start, i + 1)));
      }
    }
    if (objects.length === 0) throw e;
    // 若擷取到的是 {records:[...]} 片段就攤平，否則視為單筆陣列
    return objects.flatMap(o => (o && Array.isArray(o.records) ? o.records : [o]));
  }
}

/**
 * 驗證並清理 Gemini 回傳內容。接受 {records:[...]}、單筆物件或陣列。
 */
function sanitizeRecords(parsed, todayStr) {
  const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.records) ? parsed.records : [parsed]);
  const oldestAllowed = Utilities.formatDate(new Date(Date.now() - 366 * 86400000), TIMEZONE, 'yyyy-MM-dd');

  return list
    .filter(r => r && r.item && r.amount != null)
    .map(r => {
      let cat = String(r.category || '生活').trim();
      if (!VALID_CATEGORIES.includes(cat)) cat = '生活';

      let item = String(r.item).trim().replace(/(消費|花費|支出|購買)$/, '').trim();
      if (!item) item = String(r.item).trim();

      // 日期只接受 yyyy-MM-dd，且不可在未來或超過一年前，否則視為今天
      let date = String(r.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayStr || date < oldestAllowed) {
        date = todayStr;
      }

      return { date, item, category: cat, amount: Math.abs(Number(r.amount)) || 0 };
    })
    .filter(r => r.amount > 0);
}

// ==============================================================================
// 4. Google 試算表寫入核心（加鎖 + 批次寫入）
// ==============================================================================
function writeRecords(records, userId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = getSpreadsheet();
    const detailSheet = getDetailSheet(ss);
    const now = new Date();
    const timeStr = Utilities.formatDate(now, TIMEZONE, 'HH:mm:ss');

    const rows = records.map(r => {
      // 補記過去日期時沿用「現在的時分秒」，讓同一天內的排序仍合理
      const when = Utilities.parseDate(`${r.date} ${timeStr}`, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
      return [when, r.item, r.category, Number(r.amount), r.date.slice(0, 7)];
    });

    const startRow = detailSheet.getLastRow() + 1;
    detailSheet.getRange(startRow, 1, rows.length, 5).setValues(rows);

    // A 欄日期時間、D 欄千分位、E 欄純文字月份靠右
    detailSheet.getRange(startRow, 1, rows.length, 1).setNumberFormat("yyyy/M/d am/pm h:mm:ss");
    detailSheet.getRange(startRow, 4, rows.length, 1).setNumberFormat("#,##0");
    detailSheet.getRange(startRow, 5, rows.length, 1).setNumberFormat("@").setHorizontalAlignment("right");

    // 記下這批寫入的位置與內容，供「撤銷」比對
    PropertiesService.getScriptProperties().setProperty(
      'LAST_BATCH_' + userId,
      JSON.stringify({ startRow, rows: records.map(r => ({ item: r.item, amount: r.amount })) })
    );

    return { startRow, count: rows.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 刪除該使用者上一次由 LINE 寫入的整批紀錄。內容不符（例如已手動修改或刪列）就不動作。
 */
function undoLastBatch(userId) {
  const props = PropertiesService.getScriptProperties();
  const key = 'LAST_BATCH_' + userId;
  const raw = props.getProperty(key);
  if (!raw) return '沒有可以撤銷的紀錄。';

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const batch = JSON.parse(raw);
    const sheet = getDetailSheet(getSpreadsheet());
    const count = batch.rows.length;

    if (batch.startRow + count - 1 > sheet.getLastRow()) {
      props.deleteProperty(key);
      return '⚠️ 上一筆紀錄已不在試算表中，無法撤銷。';
    }

    const current = sheet.getRange(batch.startRow, 2, count, 3).getValues(); // B:項目 C:類別 D:金額
    const matches = batch.rows.every((r, i) =>
      String(current[i][0]).trim() === r.item && Number(current[i][2]) === Number(r.amount)
    );
    if (!matches) {
      props.deleteProperty(key);
      return '⚠️ 試算表內容已被修改，為避免誤刪，請直接到試算表刪除。';
    }

    sheet.deleteRows(batch.startRow, count);
    props.deleteProperty(key);
    const summary = batch.rows.map(r => `${r.item} ${r.amount}`).join('、');
    return `↩️ 已撤銷：${summary}`;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 【選擇性，手動執行一次】把「月度彙總」改成由明細自動計算的公式。
 * 注意：會清空「月度彙總」原有內容；若裡面有明細中不存在的舊月份數字，請先備份。
 */
function setupMonthlySummaryFormula() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SUMMARY_SHEET_NAME) || ss.insertSheet(SUMMARY_SHEET_NAME);
  const detailName = getDetailSheet(ss).getName();
  sheet.clear();
  sheet.getRange('A1').setFormula(
    `=QUERY('${detailName}'!A:E, "select E, sum(D) where D is not null and E is not null group by E order by E label E '月份', sum(D) '總支出'", 1)`
  );
  sheet.getRange('B:B').setNumberFormat('#,##0');
  Logger.log('✅ 月度彙總已改為自動公式');
}

// ==============================================================================
// 5. LINE 訊息回覆模組
// ==============================================================================
function replyToLine(replyToken, messageText) {
  const token = CONFIG.LINE_CHANNEL_ACCESS_TOKEN;
  if (isPlaceholder(token)) {
    Logger.log('⚠️ 未設定 LINE_CHANNEL_ACCESS_TOKEN，跳過 LINE 回覆');
    return;
  }

  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: 'text',
        text: messageText
      }
    ]
  };

  try {
    UrlFetchApp.fetch(url, {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + token
      },
      method: 'post',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('❌ LINE 回覆訊息失敗: ' + e.message);
  }
}

// ==============================================================================
// 6. 前端儀表板 API 介面 (doGet)
// ==============================================================================
function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    if (!isPlaceholder(CONFIG.API_SECRET_TOKEN)) {
      const incomingToken = (params.token || '').trim();
      if (incomingToken !== CONFIG.API_SECRET_TOKEN) {
        return jsonOutput({ status: 'error', message: '403 Forbidden: 驗證密鑰錯誤，存取遭拒。' });
      }
    }

    const ss = getSpreadsheet();
    const detailSheet = getDetailSheet(ss);
    const updatedAt = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");

    // v2：回傳已正規化的資料，前端不必再處理時區與千分位
    if (params.v === '2') {
      const records = readRecords(detailSheet);
      const budgets = readBudgets(ss);
      const irregular = readIrregular(ss);
      return jsonOutput({ status: 'success', version: 2, records, summary: summarize(records), budgets, irregular, updatedAt });
    }

    // v1（舊版前端相容）：原始顯示字串
    const details = detailSheet ? detailSheet.getDataRange().getDisplayValues() : [];
    const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
    const summary = summarySheet ? summarySheet.getDataRange().getDisplayValues() : [];
    return jsonOutput({ status: 'success', details, summary, updatedAt });

  } catch (error) {
    return jsonOutput({ status: 'error', message: '讀取試算表資料失敗: ' + error.message });
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 讀取明細為 [{id, date, item, category, amount, month}]，日期一律以台北時區格式化。
 */
function readRecords(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(h => String(h).trim());
  const col = (names, fallback) => {
    const idx = header.findIndex(h => names.includes(h));
    return idx >= 0 ? idx : fallback;
  };
  const dateIdx = col(['時間', '日期'], 0);
  const itemIdx = col(['項目', '說明'], 1);
  const catIdx = col(['類別'], 2);
  const amtIdx = col(['金額'], 3);
  const monthIdx = col(['月份'], 4);

  const records = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rawDate = row[dateIdx];
    const item = String(row[itemIdx] || '').trim();
    const amount = typeof row[amtIdx] === 'number'
      ? row[amtIdx]
      : Number(String(row[amtIdx]).replace(/[^\d.-]/g, '')) || 0;
    if (!rawDate || !item || amount <= 0) continue;

    let date;
    let month;
    if (rawDate instanceof Date) {
      date = Utilities.formatDate(rawDate, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
      month = date.slice(0, 7);
    } else {
      date = String(rawDate).trim(); // 手動輸入的文字日期交給前端解析
      const rawMonth = row[monthIdx];
      month = rawMonth instanceof Date
        ? Utilities.formatDate(rawMonth, TIMEZONE, 'yyyy-MM')
        : String(rawMonth || '').trim();
    }

    records.push({
      id: 'r' + (i + 1), // 試算表列號
      date,
      item,
      category: String(row[catIdx] || '').trim(),
      amount,
      month
    });
  }
  return records;
}

/**
 * 讀取「預算設定」工作表（A 欄類別、B 欄每月預算）。沒有這個分頁就回傳空物件，前端改用參考值。
 */
function readBudgets(ss) {
  const sheet = ss.getSheetByName(BUDGET_SHEET_NAME);
  if (!sheet) return {};
  const budgets = {};
  sheet.getDataRange().getValues().slice(1).forEach(row => {
    const category = String(row[0] || '').trim();
    const amount = typeof row[1] === 'number' ? row[1] : Number(String(row[1]).replace(/[^\d.]/g, ''));
    if (VALID_CATEGORIES.includes(category) && amount > 0) budgets[category] = amount;
  });
  return budgets;
}

/**
 * 讀取「不固定大額支出」分頁（不計入每月支出）。自動尋找含「項目」與「金額」的標題列，
 * 標題列上方可以有說明文字；若有「日期 / 時間 / 月份」欄也會一併回傳。
 */
function readIrregular(ss) {
  const sheet = ss.getSheetByName(IRREGULAR_SHEET_NAME);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headerRow = values.findIndex(row => row.some(c => String(c).trim() === '項目') && row.some(c => String(c).includes('金額')));
  if (headerRow < 0) return [];

  const header = values[headerRow].map(c => String(c).trim());
  const itemIdx = header.indexOf('項目');
  const amtIdx = header.findIndex(h => h.includes('金額'));
  const dateIdx = header.findIndex(h => ['日期', '時間', '月份'].includes(h));

  const items = [];
  values.slice(headerRow + 1).forEach((row, i) => {
    const item = String(row[itemIdx] || '').trim();
    const amount = typeof row[amtIdx] === 'number' ? row[amtIdx] : Number(String(row[amtIdx]).replace(/[^\d.]/g, '')) || 0;
    if (!item || amount <= 0) return;
    const rawDate = dateIdx >= 0 ? row[dateIdx] : '';
    const date = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, TIMEZONE, 'yyyy-MM-dd')
      : String(rawDate || '').trim();
    items.push({ id: 'x' + (headerRow + i + 2), item, amount, date });
  });
  return items;
}

/**
 * 【手動執行一次】建立「預算設定」工作表，預填近 6 個完整月份各類別的平均支出（取整到百位）當起點。
 * 已存在時不覆蓋，避免蓋掉你填好的預算。
 */
function setupBudgetSheet() {
  const ss = getSpreadsheet();
  if (ss.getSheetByName(BUDGET_SHEET_NAME)) {
    Logger.log('「預算設定」已存在，未做任何變更。');
    return;
  }

  const records = readRecords(getDetailSheet(ss));
  const thisMonth = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
  const months = [...new Set(records.map(r => r.month).filter(m => /^\d{4}-\d{2}$/.test(m) && m < thisMonth))].sort().slice(-6);
  const suggest = category => {
    if (months.length === 0) return '';
    const total = records
      .filter(r => r.category === category && months.includes(r.month))
      .reduce((sum, r) => sum + r.amount, 0);
    return Math.round(total / months.length / 100) * 100;
  };

  const sheet = ss.insertSheet(BUDGET_SHEET_NAME);
  const rows = [['類別', '每月預算']].concat(VALID_CATEGORIES.map(c => [c, suggest(c)]));
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.getRange(2, 2, VALID_CATEGORIES.length, 1).setNumberFormat('#,##0');
  sheet.getRange(rows.length + 2, 1).setValue('↑ 直接修改 B 欄金額即可，前端下次同步就會套用。留空或 0 代表該類別不設預算。');
  Logger.log(`✅ 已建立「預算設定」，預填依據：${months.join(', ') || '無歷史資料'}`);
}

/**
 * 【手動執行一次】產生 LINE Webhook 金鑰並存進指令碼屬性 LINE_WEBHOOK_KEY。
 * 執行後「立刻生效」：請馬上到 LINE Developers → Messaging API → Webhook URL，
 * 在原網址後面加上 ?key=<記錄裡的金鑰> 並儲存，否則 LINE 訊息會被忽略。
 * 已有金鑰時不會換新（要換請先刪除該屬性再執行）。
 */
function setupWebhookKey() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('LINE_WEBHOOK_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('LINE_WEBHOOK_KEY', key);
    Logger.log('✅ 已建立 LINE_WEBHOOK_KEY');
  } else {
    Logger.log('ℹ️ 已有 LINE_WEBHOOK_KEY，沿用原值');
  }
  Logger.log(`請把 LINE Webhook URL 改成：https://script.google.com/macros/s/<部署 ID>/exec?key=${key}`);
}

function summarize(records) {
  const totals = {};
  records.forEach(r => {
    if (/^\d{4}-\d{2}$/.test(r.month)) totals[r.month] = (totals[r.month] || 0) + r.amount;
  });
  return Object.keys(totals).sort().map(month => ({ month, totalExpense: totals[month] }));
}

// ==============================================================================
// 7. 編輯器一鍵測試工具（直接在 GAS 編輯器上方選擇此函式並按「執行」）
// ==============================================================================
function testGeminiApi() {
  Logger.log('=== 開始測試 Gemini API 解析能力 ===');
  const testInputs = [
    '便當 350',
    '全家 250',
    '看醫生拿藥 200',
    '昨天晚餐 180 飲料 60',
    '午餐 120 飲料 50'
  ];

  for (const input of testInputs) {
    try {
      const res = callGemini(input);
      Logger.log(`輸入: 「${input}」 ➜ ${JSON.stringify(res)}`);
    } catch (err) {
      Logger.log(`❌ 測試「${input}」失敗: ${err.message}`);
    }
  }
}

function testSimpleParser() {
  ['午餐 120', '全家85', '午餐 120 飲料 50', 'Netflix 390', '昨天晚餐 180', '買東西 500'].forEach(input => {
    const res = parseSimpleRecords(input);
    Logger.log(`「${input}」 ➜ ${res ? JSON.stringify(res) : '交給 Gemini'}`);
  });
}

function testWriteToSheet() {
  Logger.log('=== 測試寫入一筆資料至 Google 試算表 ===');
  try {
    const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    const res = writeRecords([{ date: today, item: '便當', category: '生活', amount: 120 }], 'editor-test');
    Logger.log(`✅ 成功寫入！起始列: ${res.startRow}（可執行 testUndo 刪除）`);
  } catch (err) {
    Logger.log(`❌ 寫入失敗: ${err.message}`);
  }
}

function testUndo() {
  Logger.log(undoLastBatch('editor-test'));
}

function testReadIrregular() {
  Logger.log(JSON.stringify(readIrregular(getSpreadsheet())));
}

function testDoGetV2() {
  const res = doGet({ parameter: { v: '2', token: CONFIG.API_SECRET_TOKEN } });
  Logger.log(res.getContent().slice(0, 1000));
}

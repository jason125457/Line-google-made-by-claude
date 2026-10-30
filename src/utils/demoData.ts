import { Transaction, MonthlySummary } from '../types/finance';
import { normalizeCategory } from '../constants/categories';

// ─── Demo Transactions ───────────────────────────────────────────────
// Fake data for display when no GAS connection is configured.
// Replace these with your own by connecting Google Sheets.

const RAW_DEMO: { date: string; item: string; category: string; amount: number }[] = [
  // 2026-09 (anchor month: shifted onto the current month at load, see shiftDemoDates)
  { date: '2026-09-04', item: '晚餐牛肉麵', category: '生活', amount: 160 },
  { date: '2026-09-04', item: '超商咖啡', category: '生活', amount: 55 },
  { date: '2026-09-03', item: '全聯日用品', category: '家用', amount: 320 },
  { date: '2026-09-02', item: '捷運儲值', category: '生活', amount: 200 },
  { date: '2026-09-01', item: '開水與飲料', category: '雜支', amount: 140 },
  // 2026-08
  { date: '2026-08-29', item: '全聯採購', category: '生活', amount: 580 },
  { date: '2026-08-27', item: '捷運月票', category: '雜支', amount: 1280 },
  { date: '2026-08-25', item: '電費', category: '家用', amount: 1450 },
  { date: '2026-08-22', item: '朋友聚餐', category: '社交', amount: 960 },
  { date: '2026-08-20', item: '網飛訂閱', category: '娛樂', amount: 390 },
  { date: '2026-08-18', item: '藥局', category: '生活', amount: 320 },
  { date: '2026-08-15', item: '超商零食', category: '雜支', amount: 145 },
  { date: '2026-08-12', item: '牙醫', category: '生活', amount: 1200 },
  { date: '2026-08-10', item: 'KTV', category: '娛樂', amount: 750 },
  { date: '2026-08-08', item: '水費', category: '家用', amount: 360 },
  { date: '2026-08-05', item: '早餐店', category: '生活', amount: 65 },
  { date: '2026-08-03', item: '運動用品', category: '雜支', amount: 890 },
  // 2026-07
  { date: '2026-07-30', item: '全聯採購', category: '生活', amount: 720 },
  { date: '2026-07-28', item: '朋友婚禮紅包', category: '社交', amount: 2000 },
  { date: '2026-07-25', item: '電費', category: '家用', amount: 1820 },
  { date: '2026-07-22', item: '電影', category: '娛樂', amount: 280 },
  { date: '2026-07-20', item: '手搖飲', category: '雜支', amount: 80 },
  { date: '2026-07-18', item: '健身房月費', category: '生活', amount: 1000 },
  { date: '2026-07-15', item: '捷運', category: '雜支', amount: 220 },
  { date: '2026-07-12', item: '超市生鮮', category: '生活', amount: 640 },
  { date: '2026-07-10', item: 'Amazon購物', category: '雜支', amount: 1350 },
  { date: '2026-07-08', item: '水費', category: '家用', amount: 340 },
  { date: '2026-07-05', item: '同事聚餐', category: '社交', amount: 880 },
  { date: '2026-07-02', item: 'Spotify', category: '娛樂', amount: 149 },
  // 2026-06
  { date: '2026-06-28', item: '超市採購', category: '生活', amount: 890 },
  { date: '2026-06-25', item: '電費', category: '家用', amount: 1650 },
  { date: '2026-06-22', item: '家庭聚餐', category: '社交', amount: 1200 },
  { date: '2026-06-20', item: '便利商店', category: '雜支', amount: 95 },
  { date: '2026-06-18', item: '計程車', category: '雜支', amount: 320 },
  { date: '2026-06-15', item: '書籍', category: '娛樂', amount: 450 },
  { date: '2026-06-12', item: '健身房月費', category: '生活', amount: 1000 },
  { date: '2026-06-08', item: '水費', category: '家用', amount: 310 },
  { date: '2026-06-05', item: '早午餐', category: '生活', amount: 350 },
  { date: '2026-06-02', item: '線上課程', category: '娛樂', amount: 699 },
  // 2026-05
  { date: '2026-05-30', item: '全聯採購', category: '生活', amount: 560 },
  { date: '2026-05-28', item: '電費', category: '家用', amount: 1230 },
  { date: '2026-05-25', item: '朋友生日禮物', category: '社交', amount: 800 },
  { date: '2026-05-22', item: '捷運', category: '雜支', amount: 180 },
  { date: '2026-05-18', item: '健身房', category: '生活', amount: 1000 },
  { date: '2026-05-15', item: '網飛', category: '娛樂', amount: 390 },
  { date: '2026-05-12', item: '超商', category: '雜支', amount: 135 },
  { date: '2026-05-08', item: '水費', category: '家用', amount: 290 },
  { date: '2026-05-05', item: '飲料店', category: '雜支', amount: 90 },
  // 2026-04
  { date: '2026-04-28', item: '超市生鮮', category: '生活', amount: 740 },
  { date: '2026-04-25', item: '電費', category: '家用', amount: 980 },
  { date: '2026-04-22', item: '同學聚餐', category: '社交', amount: 1100 },
  { date: '2026-04-18', item: '健身房', category: '生活', amount: 1000 },
  { date: '2026-04-15', item: '書', category: '娛樂', amount: 380 },
  { date: '2026-04-10', item: '計程車', category: '雜支', amount: 250 },
  { date: '2026-04-05', item: '水費', category: '家用', amount: 280 },
  // 2026-03
  { date: '2026-03-30', item: '全聯', category: '生活', amount: 620 },
  { date: '2026-03-25', item: '電費', category: '家用', amount: 1050 },
  { date: '2026-03-22', item: '家聚', category: '社交', amount: 950 },
  { date: '2026-03-18', item: '健身房', category: '生活', amount: 1000 },
  { date: '2026-03-15', item: 'Spotify', category: '娛樂', amount: 149 },
  { date: '2026-03-10', item: '捷運', category: '雜支', amount: 200 },
  { date: '2026-03-05', item: '水費', category: '家用', amount: 300 },
];

// The newest month in RAW_DEMO; it is moved onto the current month at load time.
const DEMO_ANCHOR_MONTH = '2026-09';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Moves demo dates so the anchor month lands on today's month (keeping day-of-month, clamped to
 * the target month's length) and drops anything that would fall after today. Demo mode then
 * always shows an in-progress current month instead of going stale.
 */
export function shiftDemoDates<T extends { date: string }>(
  rows: T[],
  anchorMonth: string,
  today: Date = new Date()
): T[] {
  const [ay, am] = anchorMonth.split('-').map(Number);
  const offset = (today.getFullYear() * 12 + today.getMonth()) - (ay * 12 + am - 1);
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return rows
    .map(r => {
      const [y, m, d] = r.date.slice(0, 10).split('-').map(Number);
      const target = new Date(y, m - 1 + offset, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      const date = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
      return { ...r, date };
    })
    .filter(r => r.date <= todayStr);
}

export const DEMO_TRANSACTIONS: Transaction[] = shiftDemoDates(RAW_DEMO, DEMO_ANCHOR_MONTH).map((r, i) => ({
  id: `demo-${i}`,
  date: r.date,
  item: r.item,
  category: normalizeCategory(r.category),
  amount: r.amount,
  month: r.date.slice(0, 7),
}));

// Build monthly summaries from demo transactions
function buildDemoSummaries(): MonthlySummary[] {
  const map: Record<string, number> = {};
  DEMO_TRANSACTIONS.forEach(t => {
    map[t.month] = (map[t.month] || 0) + t.amount;
  });
  return Object.entries(map)
    .map(([month, totalExpense]) => ({ month, totalExpense }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export const DEMO_SUMMARIES: MonthlySummary[] = buildDemoSummaries();

// Demo one-off large expenses (「不固定大額支出」), shown separately from monthly totals.
export const DEMO_IRREGULAR = [
  { id: 'demo-x1', item: '年度保險', amount: 32000, date: '' },
  { id: 'demo-x2', item: '日本旅遊', amount: 24500, date: '' },
  { id: 'demo-x3', item: '健身房年費', amount: 12800, date: '' },
  { id: 'demo-x4', item: '演唱會門票', amount: 4800, date: '' },
  { id: 'demo-x5', item: '機車保險', amount: 1500, date: '' },
];

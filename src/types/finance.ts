export type TransactionCategory = '生活' | '家用' | '社交' | '娛樂' | '雜支';

export type DataSource = 'cloud' | 'cache' | 'demo' | 'error';

export interface Transaction {
  id: string;
  date: string;       // YYYY-MM-DD
  item: string;       // 項目說明 (e.g. 午餐 粥 豆漿)
  category: TransactionCategory; // 嚴格限制為五大標準分類
  amount: number;     // 金額
  month: string;      // YYYY-MM
}

export interface MonthlySummary {
  month: string;        // YYYY-MM
  totalExpense: number; // 當月總支出
}

/** User-defined monthly budget per category, from the 「預算設定」 sheet. Missing = not set. */
export type CategoryBudgets = Partial<Record<TransactionCategory, number>>;

/** One-off large expense from the 「不固定大額支出」 sheet; kept out of monthly totals. */
export interface IrregularExpense {
  id: string;
  item: string;
  amount: number;
  date: string; // optional, '' when the sheet has no date column
}

export interface GasConfig {
  webAppUrl: string;
  secretToken: string;
  lastSyncTime?: string;  // display string (zh-TW locale)
  lastSyncAt?: string;    // ISO timestamp of the last successful sync
}

export type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export interface FilterState {
  selectedMonth: string;              // '' (全部月份) 或 '2026-09'
  selectedCategory: string;           // 'all' 或 '生活'
  searchQuery: string;                // 關鍵字搜尋
  onlyBigExpenses: boolean;           // 只看大額 (>= 1,000)
  sortBy: SortOption;                 // 排序
}

import { MonthlySummary, Transaction, TransactionCategory, CategoryBudgets } from '../types/finance';
import { STANDARD_CATEGORIES } from '../constants/categories';

/**
 * Returns current month string in "YYYY-MM" format based on local user time.
 */
export function getCurrentMonthString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * "2026-01" -> "2025-12"
 */
export function getPreviousMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) return '';
  const d = new Date(year, mon - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Months that have data, newest first. The current month is always included once there is any
 * data, so the dashboard opens on "this month" (spent 0 so far) instead of last month on day 1.
 */
export function buildAvailableMonths(
  transactions: Transaction[],
  summaries: MonthlySummary[] = [],
  currentMonth: string = getCurrentMonthString()
): string[] {
  const months = new Set<string>();
  transactions.forEach(t => /^\d{4}-\d{2}$/.test(t.month) && months.add(t.month));
  summaries.forEach(s => /^\d{4}-\d{2}$/.test(s.month) && months.add(s.month));
  if (months.size > 0 && /^\d{4}-\d{2}$/.test(currentMonth)) months.add(currentMonth);
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

/**
 * A monthly average scaled to the share of the month that has passed, so an unfinished month is
 * compared like-for-like instead of always looking far below a full-month average.
 */
export function averageToDate(monthlyAvg: number, elapsedDays: number, daysInMonth: number): number {
  if (daysInMonth <= 0) return monthlyAvg;
  return Math.round((monthlyAvg * Math.min(elapsedDays, daysInMonth)) / daysInMonth);
}

/**
 * Sum of a month's transactions dated on or before `day` (1-based).
 * Used for like-for-like comparison against an in-progress month.
 */
export function sumMonthUpToDay(transactions: Transaction[], month: string, day: number): number {
  return transactions.reduce((sum, t) => {
    if (t.month !== month) return sum;
    const txDay = parseInt(t.date.slice(8, 10), 10);
    return !isNaN(txDay) && txDay <= day ? sum + t.amount : sum;
  }, 0);
}

/**
 * Aggregates transactions into MonthlySummary[] so monthly totals always come from the
 * detail rows (the 「月度彙總」 sheet is no longer maintained by the backend).
 * Months that exist only in baseSummaries are kept with a zero total.
 */
export function calculateDynamicMonthlySummaries(
  transactions: Transaction[],
  baseSummaries: MonthlySummary[] = []
): MonthlySummary[] {
  // If there are no transactions at all, return baseSummaries
  if (!transactions || transactions.length === 0) {
    return [...baseSummaries].sort((a, b) => a.month.localeCompare(b.month));
  }

  const monthTotals = new Map<string, number>();

  transactions.forEach(t => {
    if (!t.month || t.amount <= 0) return;
    monthTotals.set(t.month, (monthTotals.get(t.month) || 0) + t.amount);
  });

  // Ensure any historical month present in baseSummaries is also represented
  const allMonths = new Set<string>();
  monthTotals.forEach((_, m) => allMonths.add(m));
  baseSummaries.forEach(s => {
    if (s.month && /^\d{4}-\d{2}$/.test(s.month)) {
      allMonths.add(s.month);
    }
  });

  const result: MonthlySummary[] = Array.from(allMonths).map(month => ({
    month,
    totalExpense: Math.round((monthTotals.get(month) || 0) * 100) / 100
  }));

  return result.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calculates the standard 6-month average baseline expense.
 * Calculates the average of up to six completed months before the reference month.
 * This keeps the selected month (and any future records) out of its own comparison
 * baseline, which is essential for both ongoing and historical analysis.
 */
export function calculateSixMonthAverage(
  summaries: MonthlySummary[],
  referenceMonthStr: string = getCurrentMonthString()
): number {
  if (!summaries || summaries.length === 0) return 0;

  const sorted = [...summaries].sort((a, b) => a.month.localeCompare(b.month));
  const targetMonths = sorted
    .filter(s => s.month < referenceMonthStr)
    .slice(-6);

  if (targetMonths.length === 0) {
    const referenceSummary = sorted.find(s => s.month === referenceMonthStr);
    return referenceSummary ? Math.round(referenceSummary.totalExpense) : 0;
  }

  const sum = targetMonths.reduce((acc, cur) => acc + cur.totalExpense, 0);
  return Math.round(sum / targetMonths.length);
}

// Fallback split of the 6-month average, used only for categories without a user-set budget.
const REFERENCE_BUDGET_SHARE: Record<TransactionCategory, number> = {
  '生活': 0.45,
  '家用': 0.25,
  '社交': 0.12,
  '娛樂': 0.10,
  '雜支': 0.08,
};

export interface ResolvedBudget {
  amount: number;
  isCustom: boolean; // true = from the 「預算設定」 sheet, false = reference estimate
}

/**
 * Per-category monthly budget: the user's own value when set, otherwise a reference
 * estimate derived from the six-month average (or NT$20,000 with no history).
 */
export function resolveCategoryBudgets(
  custom: CategoryBudgets,
  sixMonthAvg: number
): Record<TransactionCategory, ResolvedBudget> {
  const base = sixMonthAvg > 0 ? sixMonthAvg : 20000;
  return Object.fromEntries(
    STANDARD_CATEGORIES.map(cat => {
      const own = custom[cat];
      return [cat, own && own > 0
        ? { amount: own, isCustom: true }
        : { amount: Math.round(base * REFERENCE_BUDGET_SHARE[cat]), isCustom: false }];
    })
  ) as Record<TransactionCategory, ResolvedBudget>;
}

/** Sum of all category budgets for a month (custom where set, reference estimate otherwise). */
export function totalMonthlyBudget(
  custom: CategoryBudgets,
  summaries: MonthlySummary[],
  month: string
): { amount: number; isCustom: boolean } {
  const resolved = resolveCategoryBudgets(custom, calculateSixMonthAverage(summaries, month));
  return {
    amount: STANDARD_CATEGORIES.reduce((sum, cat) => sum + resolved[cat].amount, 0),
    isCustom: STANDARD_CATEGORIES.some(cat => resolved[cat].isCustom),
  };
}

/** Minimum elapsed days before a month-end projection is shown; earlier it is mostly noise. */
export const MIN_DAYS_FOR_PROJECTION = 5;

/**
 * Month-end estimate at the current daily average. Shared by the 月底推估 card and the
 * cumulative chart so both always show the same number.
 */
export function projectMonthEnd(total: number, elapsedDays: number, daysInMonth: number) {
  const dailyAvg = Math.round(total / Math.max(elapsedDays, 1));
  return { dailyAvg, projected: Math.round(dailyAvg * daysInMonth) };
}

export interface CumulativePoint {
  day: number;
  daily: number | null;      // spending on that day (null = day not reached yet)
  cumulative: number | null; // running total for the month (null = day not reached yet)
  lastMonth: number;         // previous month's running total; held at its month total past its last day
  pace: number;              // even-spend budget line
  projection: number | null; // today -> month end at the current daily average (current month only)
}

/**
 * Day-by-day running totals for `month`, compared with the previous month and an even budget pace.
 * For the month in progress, days after `today` are null so the line stops instead of dropping to 0.
 */
export function buildCumulativeSeries(
  transactions: Transaction[],
  month: string,
  totalBudget: number,
  today: Date = new Date()
): CumulativePoint[] {
  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) return [];
  const daysInMonth = new Date(year, mon, 0).getDate();
  const prevMonth = getPreviousMonth(month);
  const [py, pm] = prevMonth.split('-').map(Number);
  const daysInPrev = new Date(py, pm, 0).getDate();

  const isCurrent = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const lastDay = isCurrent ? today.getDate() : daysInMonth;

  const dailyThis = new Array(daysInMonth + 1).fill(0);
  const dailyPrev = new Array(daysInPrev + 1).fill(0);
  transactions.forEach(t => {
    const day = parseInt(t.date.slice(8, 10), 10);
    if (isNaN(day)) return;
    if (t.month === month && day <= daysInMonth) dailyThis[day] += t.amount;
    else if (t.month === prevMonth && day <= daysInPrev) dailyPrev[day] += t.amount;
  });

  const totalSoFar = dailyThis.slice(1, lastDay + 1).reduce((a: number, b: number) => a + b, 0);
  const showProjection = isCurrent && lastDay >= MIN_DAYS_FOR_PROJECTION && lastDay < daysInMonth;
  const { projected } = projectMonthEnd(totalSoFar, lastDay, daysInMonth);

  const points: CumulativePoint[] = [];
  let runThis = 0;
  let runPrev = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    runThis += dailyThis[day];
    if (day <= daysInPrev) runPrev += dailyPrev[day];
    const reached = day <= lastDay;
    points.push({
      day,
      daily: reached ? dailyThis[day] : null,
      cumulative: reached ? runThis : null,
      lastMonth: runPrev,
      pace: Math.round((totalBudget * day) / daysInMonth),
      // Straight line from today's actual total to the shared month-end estimate.
      projection: showProjection && day >= lastDay
        ? Math.round(totalSoFar + ((projected - totalSoFar) * (day - lastDay)) / (daysInMonth - lastDay))
        : null,
    });
  }
  return points;
}

export interface MonthCategoryRow {
  month: string;
  total: number;
  byCategory: Record<TransactionCategory, number>;
  isInProgress: boolean; // the current calendar month, not finished yet
}

/** One row per month with spending split by the five standard categories, oldest first. */
export function buildMonthCategoryRows(
  transactions: Transaction[],
  currentMonth: string = getCurrentMonthString()
): MonthCategoryRow[] {
  const map = new Map<string, Record<TransactionCategory, number>>();
  transactions.forEach(t => {
    if (!/^\d{4}-\d{2}$/.test(t.month)) return;
    if (!map.has(t.month)) {
      map.set(t.month, Object.fromEntries(STANDARD_CATEGORIES.map(c => [c, 0])) as Record<TransactionCategory, number>);
    }
    map.get(t.month)![t.category] += t.amount;
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, byCategory]) => ({
      month,
      byCategory,
      total: STANDARD_CATEGORIES.reduce((sum, c) => sum + byCategory[c], 0),
      isInProgress: month === currentMonth,
    }));
}

/**
 * Average monthly amount over completed months only — an unfinished month would drag it down.
 * Pass a category to average that category; omit it for the monthly total.
 */
export function averageCompletedMonths(rows: MonthCategoryRow[], category?: TransactionCategory): number {
  const done = rows.filter(r => !r.isInProgress);
  if (done.length === 0) return 0;
  const sum = done.reduce((acc, r) => acc + (category ? r.byCategory[category] : r.total), 0);
  return Math.round(sum / done.length);
}

/** Year an irregular expense belongs to; undated items count toward the current year. */
export function irregularYear(item: { date: string }, today: Date = new Date()): string {
  return /^\d{4}/.test(item.date) ? item.date.slice(0, 4) : String(today.getFullYear());
}

export interface YearSummary {
  year: string;
  regular: number;          // sum of 記帳明細 for the year
  irregular: number;        // sum of 不固定大額支出 for the year
  total: number;            // regular + irregular
  monthlyAvg: number;       // average of completed months
  projected: number | null; // current year only: completed months + avg for the rest + irregular
  previousTotal: number | null; // previous year's total, if any data exists
}

export function buildYearSummary(
  rows: MonthCategoryRow[],
  irregular: { amount: number; date: string }[],
  year: string,
  today: Date = new Date()
): YearSummary {
  const sumYear = (y: string) => {
    const regular = rows.filter(r => r.month.startsWith(y)).reduce((s, r) => s + r.total, 0);
    const irr = irregular.filter(x => irregularYear(x, today) === y).reduce((s, x) => s + x.amount, 0);
    return { regular, irr };
  };
  const yearRows = rows.filter(r => r.month.startsWith(year));
  const { regular, irr } = sumYear(year);
  const monthlyAvg = averageCompletedMonths(yearRows);

  const isCurrentYear = year === String(today.getFullYear());
  const completed = yearRows.filter(r => !r.isInProgress);
  const projected = isCurrentYear && completed.length > 0
    ? Math.round(completed.reduce((s, r) => s + r.total, 0) + monthlyAvg * (12 - completed.length) + irr)
    : null;

  const prevYear = String(Number(year) - 1);
  const hasPrev = rows.some(r => r.month.startsWith(prevYear)) || irregular.some(x => irregularYear(x, today) === prevYear);
  const prev = sumYear(prevYear);

  return {
    year,
    regular,
    irregular: irr,
    total: regular + irr,
    monthlyAvg,
    projected,
    previousTotal: hasPrev ? prev.regular + prev.irr : null,
  };
}

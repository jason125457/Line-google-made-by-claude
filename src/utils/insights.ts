import { Transaction, TransactionCategory } from '../types/finance';
import { STANDARD_CATEGORIES } from '../constants/categories';
import { getPreviousMonth, ResolvedBudget } from './financeCalculations';
import { parseFlexibleDate } from './dateUtils';

export interface MonthProgress {
  daysInMonth: number;
  elapsedDays: number; // days counted so far, today included; the whole month once it is over
  daysLeft: number;    // days still to pay for, today included; 0 for a finished month
  isCurrent: boolean;
  fraction: number;    // elapsedDays / daysInMonth — where an even budget should be by now
}

/** How far through `month` ("YYYY-MM") we are on `today`. */
export function monthProgress(month: string, today: Date = new Date()): MonthProgress {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = year && mon ? new Date(year, mon, 0).getDate() : 30;
  const isCurrent = year === today.getFullYear() && mon === today.getMonth() + 1;
  const elapsedDays = isCurrent ? today.getDate() : daysInMonth;
  return {
    daysInMonth,
    elapsedDays,
    daysLeft: isCurrent ? daysInMonth - today.getDate() + 1 : 0,
    isCurrent,
    fraction: elapsedDays / daysInMonth,
  };
}

export interface Insight {
  id: 'pace' | 'change' | 'no-spend' | 'weekend';
  tone: 'good' | 'warn' | 'info';
  text: string;
  /** Rendered after `text` as a blurred-in-privacy-mode amount, then `suffix`. */
  amount?: number;
  suffix?: string;
}

/** Category differences below this are noise, not an insight. */
const MIN_CHANGE = 100;
/** A category is "ahead of pace" once its budget use leads the calendar by this share. */
const PACE_MARGIN = 0.15;

/**
 * Plain-language observations about one month, most actionable first:
 * budget pace, biggest change against last month's same period, no-spend days, weekend share.
 */
export function buildMonthInsights(
  transactions: Transaction[],
  month: string,
  budgets: Record<TransactionCategory, ResolvedBudget>,
  today: Date = new Date()
): Insight[] {
  const monthTxns = transactions.filter(t => t.month === month);
  if (monthTxns.length === 0) return [];

  const progress = monthProgress(month, today);
  const prevMonth = getPreviousMonth(month);
  const dayOf = (t: Transaction) => parseInt(t.date.slice(8, 10), 10);

  const zero = () => Object.fromEntries(STANDARD_CATEGORIES.map(c => [c, 0])) as Record<TransactionCategory, number>;
  const spent = zero();
  const prevSpent = zero();
  monthTxns.forEach(t => { spent[t.category] += t.amount; });
  transactions.forEach(t => {
    if (t.month === prevMonth && dayOf(t) <= progress.elapsedDays) prevSpent[t.category] += t.amount;
  });

  const insights: Insight[] = [];

  // 1. Budget pace: over budget beats "ahead of pace"; all clear is worth saying too.
  const over = STANDARD_CATEGORIES
    .map(cat => ({ cat, excess: spent[cat] - budgets[cat].amount }))
    .filter(x => x.excess > 0)
    .sort((a, b) => b.excess - a.excess)[0];
  const ahead = STANDARD_CATEGORIES
    .map(cat => ({ cat, used: budgets[cat].amount > 0 ? spent[cat] / budgets[cat].amount : 0 }))
    .filter(x => x.used > progress.fraction + PACE_MARGIN)
    .sort((a, b) => b.used - a.used)[0];
  if (over) {
    insights.push({ id: 'pace', tone: 'warn', text: `${over.cat}已超出預算 `, amount: over.excess });
  } else if (progress.isCurrent && ahead) {
    insights.push({
      id: 'pace',
      tone: 'warn',
      text: `${ahead.cat}已用掉 ${Math.round(ahead.used * 100)}% 預算，但這個月才過 ${Math.round(progress.fraction * 100)}%`,
    });
  } else {
    insights.push({
      id: 'pace',
      tone: 'good',
      text: progress.isCurrent ? '每個類別都在預算進度內' : '每個類別都沒有超出預算',
    });
  }

  // 2. Biggest category change against the same days of last month.
  const change = STANDARD_CATEGORIES
    .map(cat => ({ cat, diff: spent[cat] - prevSpent[cat] }))
    .filter(x => prevSpent[x.cat] > 0 && Math.abs(x.diff) >= MIN_CHANGE)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
  if (change) {
    const basis = progress.isCurrent ? '上月同期' : '上個月';
    insights.push({
      id: 'change',
      tone: change.diff > 0 ? 'warn' : 'good',
      text: `${change.cat}比${basis}${change.diff > 0 ? '多花' : '少花'} `,
      amount: Math.abs(change.diff),
    });
  }

  // 3. Days without any spending so far.
  const spendDays = new Set(monthTxns.map(dayOf).filter(d => !isNaN(d) && d <= progress.elapsedDays));
  const noSpendDays = progress.elapsedDays - spendDays.size;
  if (noSpendDays > 0) {
    insights.push({ id: 'no-spend', tone: 'good', text: `這個月有 ${noSpendDays} 天完全沒花錢` });
  }

  // 4. Weekend share (two of seven days is about 29%).
  let weekend = 0;
  let total = 0;
  monthTxns.forEach(t => {
    const day = parseFlexibleDate(t.date)?.getDay();
    total += t.amount;
    if (day === 0 || day === 6) weekend += t.amount;
  });
  if (total > 0) {
    const pct = Math.round((weekend / total) * 100);
    insights.push({
      id: 'weekend',
      tone: 'info',
      text: `週末支出佔 ${pct}%，${pct > 35 ? '假日花得比平日多' : '以平日日常開銷為主'}`,
    });
  }

  return insights;
}

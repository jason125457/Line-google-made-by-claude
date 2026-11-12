import React, { useMemo } from 'react';
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { Transaction, MonthlySummary, CategoryBudgets } from '../types/finance';
import { totalMonthlyBudget } from '../utils/financeCalculations';
import { monthProgress } from '../utils/insights';
import { compareTransactionDates } from '../utils/dateUtils';
import { categoryColor } from '../theme/tokens';

interface MonthOverviewCardProps {
  transactions: Transaction[];
  monthlySummaries: MonthlySummary[];
  selectedMonth: string;
  budgets: CategoryBudgets;
  onViewAll: () => void;
}

const RECENT_COUNT = 5;

/**
 * The first thing on the dashboard: how much is left to spend this month, what that means per
 * day, and whether spending is ahead of or behind an even budget pace. Phones also get the
 * latest records here; wider screens already show the full list further down.
 */
export const MonthOverviewCard: React.FC<MonthOverviewCardProps> = ({
  transactions,
  monthlySummaries,
  selectedMonth,
  budgets,
  onViewAll,
}) => {
  const monthTxns = useMemo(
    () => transactions.filter(t => t.month === selectedMonth),
    [transactions, selectedMonth]
  );

  const spent = monthTxns.reduce((sum, t) => sum + t.amount, 0);

  const { amount: totalBudget, isCustom } = useMemo(
    () => totalMonthlyBudget(budgets, monthlySummaries, selectedMonth),
    [budgets, monthlySummaries, selectedMonth]
  );

  const remaining = totalBudget - spent;
  const isOver = remaining < 0;
  const usedPct = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;

  // Daily allowance and pace only make sense for the month in progress.
  const { isCurrent, daysLeft, fraction } = monthProgress(selectedMonth);
  const dailyAllowance = daysLeft > 0 && !isOver ? Math.floor(remaining / daysLeft) : 0;
  const todayPct = Math.round(fraction * 100);
  const paceDiff = Math.round(spent - totalBudget * fraction); // > 0 = spending faster than the budget

  const recent = useMemo(
    () => [...monthTxns].sort((a, b) => compareTransactionDates(a.date, b.date, false)).slice(0, RECENT_COUNT),
    [monthTxns]
  );

  const monthLabel = selectedMonth ? `${parseInt(selectedMonth.slice(5), 10)} 月` : '本月';
  const fmt = (n: number) => Math.round(n).toLocaleString();

  const headline = isCurrent
    ? (isOver ? '本月已超支' : '本月還可以花')
    : (isOver ? `${monthLabel}超支` : `${monthLabel}結餘`);

  return (
    <section className="fintech-card p-4 sm:p-6 space-y-4 min-w-0" aria-label={`${monthLabel}概況`}>
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8 lg:gap-12">
        {/* Headline number */}
        <div className="min-w-0 shrink-0">
          <p className="text-xs font-bold text-ink-muted">{headline}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-ink-subtle">NT$</span>
            <span
              className={`text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums ${
                isOver ? 'text-rose-600' : 'text-ink'
              }`}
            >
              {fmt(Math.abs(remaining))}
            </span>
          </p>
          {isCurrent && (
            <p className="mt-2 text-xs font-semibold text-ink-muted">
              {isOver ? (
                `還有 ${daysLeft} 天，接下來的支出都會超出預算`
              ) : (
                <>
                  每天可花 <span className="font-extrabold text-primary-strong tabular-nums">NT$ {fmt(dailyAllowance)}</span>
                  <span className="text-ink-subtle"> · 還有 {daysLeft} 天</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Spent vs budget, with where an even pace would be today */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-baseline justify-between gap-3 text-xs font-semibold text-ink-muted">
            <span>
              已花 <span className="text-sm font-extrabold text-ink tracking-tight tabular-nums">NT$ {fmt(spent)}</span>
            </span>
            <span>
              {isCustom ? '預算' : '參考預算'} <span className="tabular-nums">NT$ {fmt(totalBudget)}</span>
            </span>
          </div>

          <div className="relative py-1">
            <div
              className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(usedPct, 100)}
              aria-label={`已使用預算 ${usedPct}%`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                  isOver ? 'bg-rose-500' : usedPct > 85 ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(usedPct, 100)}%` }}
              />
            </div>
            {isCurrent && (
              <span
                className="absolute inset-y-0 w-0.5 -ml-px rounded-full bg-ink"
                style={{ left: `${todayPct}%` }}
                aria-hidden="true"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-ink-muted">
            <span>
              已用 {usedPct}%{isCurrent && ` · 今天應到 ${todayPct}%`}
            </span>
            {isCurrent && totalBudget > 0 && paceDiff !== 0 && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
                  paceDiff > 0 ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'
                }`}
              >
                {paceDiff > 0
                  ? <TrendingUp className="w-3 h-3" aria-hidden="true" />
                  : <TrendingDown className="w-3 h-3" aria-hidden="true" />}
                <span>
                  比預算進度{paceDiff > 0 ? '多花' : '少花'} <span className="tabular-nums">NT$ {fmt(Math.abs(paceDiff))}</span>
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recent records (phones only) */}
      <div className="border-t border-line pt-3 sm:hidden">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-extrabold text-ink">最近記帳</h3>
          <button
            onClick={onViewAll}
            className="min-h-11 -my-2 px-2 flex items-center gap-0.5 text-xs font-bold text-primary-strong"
          >
            查看全部
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="py-3 text-xs text-ink-muted">這個月還沒有紀錄。在 LINE 傳「午餐 120」就能記一筆。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map(t => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: categoryColor(t.category) }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{t.item}</p>
                    <p className="text-[11px] text-ink-subtle font-medium">
                      {t.date.slice(5, 10).replace('-', '/')} · {t.category}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-ink tabular-nums shrink-0">NT$ {fmt(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

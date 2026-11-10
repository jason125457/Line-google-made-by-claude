import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';
import { Transaction, MonthlySummary, TransactionCategory, CategoryBudgets } from '../types/finance';
import { calculateSixMonthAverage, resolveCategoryBudgets } from '../utils/financeCalculations';
import { buildMonthInsights, monthProgress, Insight } from '../utils/insights';
import { STANDARD_CATEGORIES } from '../constants/categories';
import { categoryIcon } from '../constants/categoryIcons';
import { categoryColor, categoryTextColor, categoryTint } from '../theme/tokens';

interface BudgetProgressPanelProps {
  transactions: Transaction[];
  monthlySummaries: MonthlySummary[];
  selectedMonth: string;
  budgets: CategoryBudgets;
}

const INSIGHT_ICON: Record<Insight['tone'], { Icon: typeof Sparkles; className: string }> = {
  good: { Icon: CheckCircle2, className: 'text-emerald-300' },
  warn: { Icon: AlertTriangle, className: 'text-amber-300' },
  info: { Icon: Sparkles, className: 'text-slate-300' },
};

export const BudgetProgressPanel: React.FC<BudgetProgressPanelProps> = ({
  transactions,
  monthlySummaries,
  selectedMonth,
  budgets,
}) => {
  // Determine reference month for budget progress (if 'all', default to latest active month)
  const targetMonth = useMemo(() => {
    if (selectedMonth) return selectedMonth;
    const allMonths = [...new Set(transactions.map((t) => t.month).filter(Boolean))].sort();
    return allMonths[allMonths.length - 1] || '';
  }, [transactions, selectedMonth]);

  const targetMonthTxns = useMemo(() => {
    return transactions.filter((t) => t.month === targetMonth);
  }, [transactions, targetMonth]);

  // Compute category totals for the target month
  const categoryTotals = useMemo(() => {
    const map: Record<TransactionCategory, number> = {
      '生活': 0,
      '家用': 0,
      '社交': 0,
      '娛樂': 0,
      '雜支': 0,
    };
    targetMonthTxns.forEach((t) => {
      map[t.category] += t.amount;
    });
    return map;
  }, [targetMonthTxns]);

  // Six month average baseline
  const sixMonthAvg = useMemo(() => {
    return calculateSixMonthAverage(monthlySummaries, targetMonth);
  }, [monthlySummaries, targetMonth]);

  const categoryBudgets = useMemo(
    () => resolveCategoryBudgets(budgets, sixMonthAvg),
    [budgets, sixMonthAvg]
  );
  const customCount = STANDARD_CATEGORIES.filter(cat => categoryBudgets[cat].isCustom).length;
  const budgetBadge = customCount === STANDARD_CATEGORIES.length
    ? '自訂預算'
    : customCount > 0 ? '部分自訂' : '參考值 · 尚未設定預算';

  const insights = useMemo(
    () => buildMonthInsights(transactions, targetMonth, categoryBudgets),
    [transactions, targetMonth, categoryBudgets]
  );

  // Where an even budget would be today; only drawn for the month in progress.
  const { isCurrent, fraction } = monthProgress(targetMonth);
  const todayPct = Math.round(fraction * 100);

  const monthDisplay = targetMonth ? `${targetMonth.slice(0, 4)}年${parseInt(targetMonth.slice(5), 10)}月` : '當月';

  return (
    <div className="space-y-4 sm:space-y-5 min-w-0">
      {/* 1. 預算進度卡 (White Fintech Card) */}
      <div className="fintech-card p-4 sm:p-6 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">類別支出進度</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {budgetBadge}
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {monthDisplay}
          </span>
        </div>

        {/* Progress Bars List */}
        <div className="space-y-4">
          {STANDARD_CATEGORIES.map((cat) => {
            const spent = categoryTotals[cat];
            const Icon = categoryIcon(cat);
            const { amount: budget, isCustom } = categoryBudgets[cat];
            const rawPct = Math.round((spent / budget) * 100);
            const barPct = Math.min(rawPct, 100);
            const isOver = spent > budget;

            return (
              <div key={cat} className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-between text-xs min-w-0 gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ color: categoryTextColor(cat), backgroundColor: categoryTint(cat) }}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    </div>
                    <span className="font-bold text-slate-800">{cat}</span>
                    {!isCustom && customCount > 0 && (
                      <span className="text-[10px] font-semibold text-slate-400">參考</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 tabular-nums shrink-0">
                    <span className="text-slate-500 text-[10px] sm:text-[11px] font-medium">
                      NT$ {Math.round(spent).toLocaleString()} / {budget.toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] sm:text-[11px] font-extrabold min-w-[28px] sm:min-w-[32px] text-right ${
                        isOver ? 'text-rose-600' : 'text-slate-700'
                      }`}
                    >
                      {isOver ? `超支 ${rawPct}%` : `${rawPct}%`}
                    </span>
                  </div>
                </div>

                {/* Progress capsule, with a tick where an even pace would be today */}
                <div className="relative py-0.5">
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${isOver ? 'bg-rose-500' : ''}`}
                      style={{ width: `${barPct}%`, backgroundColor: isOver ? undefined : categoryColor(cat) }}
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
              </div>
            );
          })}
        </div>

        {isCurrent && (
          <p className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="w-0.5 h-3 rounded-full bg-ink" aria-hidden="true" />
            今天應到的位置（本月已過 {todayPct}%）
          </p>
        )}
      </div>

      {/* 2. 本月洞察：由當月明細即時算出 */}
      <div className="fintech-card-dark p-4 sm:p-6 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-white tracking-tight">
            <Lightbulb className="w-4 h-4 text-gold" aria-hidden="true" />
            本月洞察
          </h3>
          <span className="text-xs font-semibold text-slate-400">{monthDisplay}</span>
        </div>

        {insights.length === 0 ? (
          <p className="text-sm text-slate-400 leading-relaxed">這個月還沒有紀錄，記幾筆之後這裡會出現分析。</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {insights.map(({ id, tone, text, amount, suffix }) => {
              const { Icon, className } = INSIGHT_ICON[tone];
              return (
                <li key={id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${className}`} aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-100 leading-relaxed">
                    {text}
                    {amount !== undefined && (
                      <span className="font-extrabold tracking-tight tabular-nums">NT$ {Math.round(amount).toLocaleString()}</span>
                    )}
                    {suffix}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

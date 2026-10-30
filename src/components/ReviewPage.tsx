import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Flame, Trophy } from 'lucide-react';
import { Transaction, MonthlySummary } from '../types/finance';
import { STANDARD_CATEGORIES } from '../constants/categories';
import { topItems, weekdayTotals, loggingStreak } from '../utils/calendarReview';
import { calculateSixMonthAverage, getCurrentMonthString, getPreviousMonth, sumMonthUpToDay } from '../utils/financeCalculations';
import { formatShortDateTime } from '../utils/dateUtils';
import { categoryColorsOnDark, heatScale, palette } from '../theme/tokens';

interface ReviewPageProps {
  transactions: Transaction[];
  monthlySummaries: MonthlySummary[];
  selectedMonth: string;
  availableMonths: string[]; // newest first
  onSelectMonth: (month: string) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const fmt = (n: number) => `NT$ ${Math.round(n).toLocaleString()}`;

export const ReviewPage: React.FC<ReviewPageProps> = ({ transactions, monthlySummaries, selectedMonth, availableMonths, onSelectMonth }) => {
  const month = selectedMonth || availableMonths[0] || '';
  const monthTxns = useMemo(() => transactions.filter(t => t.month === month), [transactions, month]);
  const total = monthTxns.reduce((s, t) => s + t.amount, 0);
  const isCurrent = month === getCurrentMonthString();
  const today = new Date();

  // Completed month: compare with the six-month average. In progress: compare with last month's same days.
  const base = isCurrent
    ? sumMonthUpToDay(transactions, getPreviousMonth(month), today.getDate())
    : calculateSixMonthAverage(monthlySummaries, month);
  const diff = total - base;
  const pct = base > 0 ? Math.round((diff / base) * 100) : null;
  const baseLabel = isCurrent ? '上月同期' : '近 6 個月平均';

  const byCategory = STANDARD_CATEGORIES
    .map(c => ({ name: c, amount: monthTxns.filter(t => t.category === c).reduce((s, t) => s + t.amount, 0) }))
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const tops = useMemo(() => topItems(transactions, month, 5), [transactions, month]);
  const week = useMemo(() => weekdayTotals(transactions, month), [transactions, month]);
  const weekMax = Math.max(...week, 1);
  const busiest = week.indexOf(Math.max(...week));
  const biggest = monthTxns.reduce<Transaction | null>((m, t) => (!m || t.amount > m.amount ? t : m), null);
  const streak = useMemo(() => loggingStreak(transactions), [transactions]);

  const idx = availableMonths.indexOf(month);
  const prevMonth = idx >= 0 ? availableMonths[idx + 1] : undefined;
  const nextMonth = idx > 0 ? availableMonths[idx - 1] : undefined;
  const monthNum = parseInt(month.slice(5), 10);

  if (!month) {
    return <div className="py-20 text-center text-ink-subtle text-sm">尚無記帳資料。</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => prevMonth && onSelectMonth(prevMonth)}
          disabled={!prevMonth}
          aria-label="上個月"
          className="w-11 h-11 rounded-2xl border border-line bg-surface flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-40"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="text-center">
          <h2 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight">{monthNum} 月回顧</h2>
          <p className="text-xs text-ink-muted font-medium">{isCurrent ? `本月到 ${monthNum}/${today.getDate()} 為止` : `${month.slice(0, 4)} 年 ${monthNum} 月整月`}</p>
        </div>
        <button
          onClick={() => nextMonth && onSelectMonth(nextMonth)}
          disabled={!nextMonth}
          aria-label="下個月"
          className="w-11 h-11 rounded-2xl border border-line bg-surface flex items-center justify-center text-ink-muted hover:text-ink disabled:opacity-40"
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Hero */}
        <section className="lg:col-span-7 rounded-3xl bg-night text-white p-5 sm:p-7 flex flex-col gap-3 min-w-0" aria-label="本月總結">
          <p className="text-sm text-slate-300 font-medium">{isCurrent ? '這個月到目前為止花了' : '這個月一共花了'}</p>
          <p className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums">{fmt(total)}</p>
          {pct !== null && (
            <p
              className={`inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold ${
                diff <= 0 ? 'bg-gold/20 text-amber-200' : 'bg-rose-500/20 text-rose-200'
              }`}
            >
              {diff <= 0 ? <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" /> : <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />}
              {diff <= 0
                ? <>比{baseLabel}少 {Math.abs(pct)}%，省下 <span className="tabular-nums">{fmt(-diff)}</span></>
                : <>比{baseLabel}多 {pct}%（多花 <span className="tabular-nums">{fmt(diff)}</span>）</>}
            </p>
          )}

          {total > 0 && (
            <>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mt-3" aria-hidden="true">
                {byCategory.map(c => (
                  <span key={c.name} style={{ flex: c.amount, backgroundColor: categoryColorsOnDark[c.name] }} />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-200">
                {byCategory.map(c => (
                  <li key={c.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: categoryColorsOnDark[c.name] }} aria-hidden="true" />
                    {c.name}
                    <span className="font-bold tabular-nums">{Math.round((c.amount / total) * 100)}%</span>
                    <span className="text-slate-400 tabular-nums">{fmt(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Side facts */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3 sm:gap-4 content-start">
          <div className="fintech-card p-4 col-span-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
              <Trophy className="w-3.5 h-3.5 text-gold-deep" aria-hidden="true" />最大一筆
            </p>
            {biggest ? (
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm font-extrabold text-ink truncate">
                  {biggest.item}
                  <span className="ml-1.5 text-xs font-medium text-ink-subtle">{formatShortDateTime(biggest.date).slice(0, 5)} · {biggest.category}</span>
                </span>
                <span className="text-lg font-extrabold text-ink tabular-nums shrink-0">{fmt(biggest.amount)}</span>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-ink-muted">這個月還沒有紀錄。</p>
            )}
          </div>

          <div className="fintech-card p-4">
            <p className="text-xs font-bold text-ink-muted">最花錢的星期</p>
            <div className="flex items-end gap-1 h-16 mt-2" aria-hidden="true">
              {week.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t"
                    style={{ height: `${Math.max(2, Math.round((v / weekMax) * 48))}px`, backgroundColor: i === busiest ? palette.primaryStrong : heatScale[2].bg }}
                  />
                  <span className="text-[10px] font-bold text-ink-muted">{WEEKDAYS[i]}</span>
                </div>
              ))}
            </div>
            <p className="text-sm font-extrabold text-ink mt-1.5">{week[busiest] > 0 ? `星期${WEEKDAYS[busiest]}` : '—'}</p>
          </div>

          <div className="fintech-card p-4 flex flex-col justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
              <Flame className="w-3.5 h-3.5 text-gold-deep" aria-hidden="true" />連續記帳
            </p>
            <p className="text-3xl font-extrabold text-ink tabular-nums">
              {streak.streak} <span className="text-sm text-ink-muted">天</span>
            </p>
            <p className="text-[11px] text-ink-muted">
              {streak.loggedToday ? '今天已經記過了' : streak.streak > 0 ? `今天記一筆就 ${streak.streak + 1} 天` : '今天記一筆開始累積'}
            </p>
          </div>
        </div>

        {/* Top items */}
        <section className="lg:col-span-7 fintech-card p-4 sm:p-5 min-w-0" aria-label="最常記的項目">
          <h3 className="text-sm font-extrabold text-ink mb-2">最常記的項目</h3>
          {tops.length === 0 ? (
            <p className="text-xs text-ink-muted">這個月還沒有紀錄。</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {tops.map((t, i) => (
                <li key={t.item} className="flex items-center gap-3 py-2">
                  <span className="w-5 text-xs font-extrabold text-ink-subtle tabular-nums">{i + 1}</span>
                  <span className="flex-1 text-sm font-bold text-ink truncate">{t.item}</span>
                  <span className="text-xs text-ink-muted tabular-nums">{t.count} 次</span>
                  <span className="w-24 text-right text-sm font-extrabold text-ink tabular-nums">{fmt(t.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
};

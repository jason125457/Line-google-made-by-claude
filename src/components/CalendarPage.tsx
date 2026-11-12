import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Transaction } from '../types/finance';
import { buildCalendarMonth, dailyBaseline, weekendVsWeekday, CalendarDay } from '../utils/calendarReview';
import { compareTransactionDates, formatShortDateTime } from '../utils/dateUtils';
import { categoryColor, heatScale, palette } from '../theme/tokens';

interface CalendarPageProps {
  transactions: Transaction[];
  selectedMonth: string;
  availableMonths: string[]; // newest first
  onSelectMonth: (month: string) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const fmt = (n: number) => `NT$ ${Math.round(n).toLocaleString()}`;
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

const defaultDay = (days: CalendarDay[]) =>
  days.find(d => d.isToday)?.day ??
  [...days].filter(d => !d.isFuture).sort((a, b) => b.amount - a.amount)[0]?.day ??
  1;

export const CalendarPage: React.FC<CalendarPageProps> = ({ transactions, selectedMonth, availableMonths, onSelectMonth }) => {
  const month = selectedMonth || availableMonths[0] || '';
  const baseline = useMemo(() => dailyBaseline(transactions, month), [transactions, month]);
  const { leading, days } = useMemo(() => buildCalendarMonth(transactions, month, baseline), [transactions, month, baseline]);
  const [selectedDay, setSelectedDay] = useState<number>(() => defaultDay(days));

  // Re-pick the focus day whenever the month changes.
  useEffect(() => setSelectedDay(defaultDay(days)), [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthTotal = days.reduce((s, d) => s + d.amount, 0);
  const loggedDays = days.filter(d => d.count > 0).length;
  const split = weekendVsWeekday(days);
  const focus = days.find(d => d.day === selectedDay);
  const focusTxns = useMemo(
    () => transactions
      .filter(t => t.month === month && parseInt(t.date.slice(8, 10), 10) === selectedDay)
      .sort((a, b) => compareTransactionDates(a.date, b.date, true)),
    [transactions, month, selectedDay]
  );

  // availableMonths is newest-first, so "previous" is the next index.
  const idx = availableMonths.indexOf(month);
  const prevMonth = idx >= 0 ? availableMonths[idx + 1] : undefined;
  const nextMonth = idx > 0 ? availableMonths[idx - 1] : undefined;
  const [y, mo] = month.split('-');

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
        <div className="text-center min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight">{y} 年 {parseInt(mo, 10)} 月</h2>
          <p className="text-xs text-ink-muted font-medium">
            已花 <span className="tabular-nums">{fmt(monthTotal)}</span> · 記帳 {loggedDays} 天
          </p>
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
        {/* Heatmap */}
        <section className="lg:col-span-8 fintech-card p-3 sm:p-5 min-w-0" aria-label="消費月曆">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-1.5">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-[11px] font-bold ${i === 0 || i === 6 ? 'text-ink' : 'text-ink-muted'}`}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({ length: leading }, (_, i) => <div key={`blank-${i}`} aria-hidden="true" />)}
            {days.map(d => {
              const tone = d.isFuture ? null : heatScale[d.level];
              const selected = d.day === selectedDay;
              const label = d.isFuture
                ? `${parseInt(mo, 10)}月${d.day}日，尚未到`
                : `${parseInt(mo, 10)}月${d.day}日 ${fmt(d.amount)}${baseline > 0 && d.amount > 0 ? `，日均的 ${d.ratio.toFixed(1)} 倍` : ''}`;
              return (
                <button
                  key={d.day}
                  onClick={() => setSelectedDay(d.day)}
                  aria-label={label}
                  aria-pressed={selected}
                  className={`h-14 sm:h-20 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-shadow ${
                    selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
                  } ${d.isFuture ? 'text-ink-subtle' : ''}`}
                  style={{
                    ...(tone ? { backgroundColor: tone.bg, color: tone.fg } : {}),
                    ...(d.isToday ? { boxShadow: `inset 0 0 0 2px ${palette.goldDeep}` } : {}),
                  }}
                >
                  <span className="text-xs sm:text-sm font-extrabold">{d.day}</span>
                  {!d.isFuture && d.amount > 0 && (
                    <span className="text-[9px] sm:text-[11px] font-bold tabular-nums opacity-90">
                      <span className="sm:hidden">{compact(d.amount)}</span>
                      <span className="hidden sm:inline">{Math.round(d.amount).toLocaleString()}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[11px] text-ink-muted">
            <span>顏色依近 3 個月日均 <strong className="text-ink tabular-nums">{fmt(baseline)}</strong> 比較</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              少
              {heatScale.slice(1).map(h => (
                <span key={h.bg} className="w-3.5 h-3.5 rounded" style={{ backgroundColor: h.bg }} />
              ))}
              多
            </span>
          </div>
        </section>

        <div className="lg:col-span-4 space-y-4 min-w-0">
          {/* Selected day */}
          {focus && (
            <section className="fintech-card p-4 sm:p-5" aria-live="polite">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-base font-extrabold text-ink">
                  {parseInt(mo, 10)}/{focus.day}（{WEEKDAYS[focus.weekday]}）
                </h3>
                <span className="text-base font-extrabold text-ink tabular-nums">{fmt(focus.amount)}</span>
              </div>
              {baseline > 0 && focus.amount > 0 && (
                <p className={`text-xs font-bold mt-0.5 ${focus.ratio >= 2 ? 'text-rose-700' : focus.ratio < 0.9 ? 'text-emerald-700' : 'text-ink-muted'}`}>
                  日均的 {focus.ratio.toFixed(1)} 倍
                </p>
              )}
              {focusTxns.length === 0 ? (
                <p className="text-xs text-ink-muted mt-3">{focus.isFuture ? '這天還沒到。' : '這天沒有記帳。'}</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {focusTxns.map(t => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: categoryColor(t.category) }} aria-hidden="true" />
                        <span className="font-bold text-ink truncate">{t.item}</span>
                        <span className="text-[11px] text-ink-subtle shrink-0">{formatShortDateTime(t.date).slice(6) || t.category}</span>
                      </span>
                      <span className="font-extrabold text-ink tabular-nums shrink-0">{Math.round(t.amount).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Weekend vs weekday */}
          <div className="grid grid-cols-2 gap-3">
            <div className="fintech-card p-3.5">
              <p className="text-[11px] font-bold text-ink-muted">週末日均</p>
              <p className="text-lg sm:text-xl font-extrabold text-ink tabular-nums tracking-tight">{fmt(split.weekend)}</p>
            </div>
            <div className="fintech-card p-3.5">
              <p className="text-[11px] font-bold text-ink-muted">平日日均</p>
              <p className="text-lg sm:text-xl font-extrabold text-ink tabular-nums tracking-tight">{fmt(split.weekday)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

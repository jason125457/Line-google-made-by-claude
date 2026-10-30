import React, { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Transaction, MonthlySummary, CategoryBudgets } from '../types/finance';
import {
  buildCumulativeSeries,
  CumulativePoint,
  getCurrentMonthString,
  totalMonthlyBudget,
} from '../utils/financeCalculations';
import { palette } from '../theme/tokens';

interface MonthCumulativeChartProps {
  transactions: Transaction[];
  monthlySummaries: MonthlySummary[];
  selectedMonth: string;
  budgets: CategoryBudgets;
}

const SERIES = {
  cumulative: { label: '本月累計', color: palette.primary },
  lastMonth: { label: '上月同期', color: palette.compare },
  pace: { label: '預算進度', color: palette.goldDeep },
  projection: { label: '月底推估', color: palette.primary },
} as const;

// Above the budget pace by more than this share of it counts as serious, not just a warning.
const SERIOUS_OVER_PACE = 0.2;

const fmt = (n: number) => `NT$ ${Math.round(n).toLocaleString()}`;
const fmtAxis = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

const LegendSwatch: React.FC<{ color: string; dash?: string }> = ({ color, dash }) => (
  <svg width="18" height="8" aria-hidden="true" className="shrink-0">
    <line x1="1" y1="4" x2="17" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" />
  </svg>
);

const ChartTooltip: React.FC<TooltipProps<number, string> & { month: string }> = ({ active, payload, month }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as CumulativePoint;
  const rows: Array<[string, string, number | null]> = [
    [SERIES.cumulative.label, SERIES.cumulative.color, p.cumulative],
    [SERIES.lastMonth.label, SERIES.lastMonth.color, p.lastMonth],
    [SERIES.pace.label, SERIES.pace.color, p.pace],
    [SERIES.projection.label, SERIES.projection.color, p.cumulative === null ? p.projection : null],
  ];
  return (
    <div className="bg-surface border border-line rounded-xl shadow-lg px-3 py-2.5 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-bold text-ink">
        {parseInt(month.slice(5), 10)}/{p.day}
        {p.daily !== null && <span className="ml-2 font-semibold text-ink-muted">當日 <span className="tabular-nums">{fmt(p.daily)}</span></span>}
      </p>
      {rows.map(([label, color, value]) =>
        value === null ? null : (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-muted font-medium">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              {label}
            </span>
            <span className="font-bold text-ink tabular-nums">{fmt(value)}</span>
          </div>
        )
      )}
    </div>
  );
};

/**
 * Running total for the selected month vs. the same day last month and an even budget pace.
 * One y-axis (NT$); the in-progress month stops at today rather than dropping to zero.
 */
export const MonthCumulativeChart: React.FC<MonthCumulativeChartProps> = ({
  transactions,
  monthlySummaries,
  selectedMonth,
  budgets,
}) => {
  const budget = useMemo(
    () => totalMonthlyBudget(budgets, monthlySummaries, selectedMonth),
    [budgets, monthlySummaries, selectedMonth]
  );
  const series = useMemo(
    () => buildCumulativeSeries(transactions, selectedMonth, budget.amount),
    [transactions, selectedMonth, budget.amount]
  );

  if (!selectedMonth || series.length === 0) return null;

  const isCurrent = selectedMonth === getCurrentMonthString();
  const latest = [...series].reverse().find(p => p.cumulative !== null);
  const monthLabel = `${parseInt(selectedMonth.slice(5), 10)} 月`;
  const hasData = !!latest && latest.cumulative! > 0;

  // Headline compares where we are now with the same day last month and with the budget pace.
  const vsLastMonth = latest && latest.lastMonth ? latest.cumulative! - latest.lastMonth : null;
  const vsPace = latest ? latest.cumulative! - latest.pace : 0;
  const paceStatus = vsPace <= 0
    ? { text: '低於預算進度', Icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' }
    : latest && latest.pace > 0 && vsPace / latest.pace > SERIOUS_OVER_PACE
      ? { text: '超前預算進度', Icon: AlertTriangle, tone: 'bg-rose-50 text-rose-700 border-rose-200/60' }
      : { text: '超前預算進度', Icon: AlertTriangle, tone: 'bg-amber-50 text-amber-800 border-amber-200/60' };
  const projectionEnd = series[series.length - 1].projection;
  const lastDayLabel = latest ? `${parseInt(selectedMonth.slice(5), 10)}/${latest.day}` : '';
  const ticks = [1, 5, 10, 15, 20, 25, series.length];

  const summary = latest
    ? `${monthLabel}截至 ${lastDayLabel} 累計 ${fmt(latest.cumulative!)}，上月同期 ${latest.lastMonth !== null ? fmt(latest.lastMonth) : '無資料'}，預算進度 ${fmt(latest.pace)}${projectionEnd !== null ? `，依目前速度月底約 ${fmt(projectionEnd)}` : ''}。`
    : '';

  return (
    <section className="fintech-card p-4 sm:p-6 min-w-0" aria-label={`${monthLabel}累計支出走勢`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-ink tracking-tight">{monthLabel}累計支出走勢</h3>
          <p className="text-xs text-ink-muted mt-0.5">
            {isCurrent ? `截至今天（${lastDayLabel}）` : '整月'}每天累積花了多少，對照上月同期與預算進度
          </p>
        </div>

        {hasData && (
          <div className="flex flex-wrap gap-2 text-[11px] font-bold shrink-0">
            {vsLastMonth !== null && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${
                  vsLastMonth > 0 ? 'bg-rose-50 text-rose-700 border-rose-200/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                }`}
              >
                {vsLastMonth > 0 ? <TrendingUp className="w-3 h-3" aria-hidden="true" /> : <TrendingDown className="w-3 h-3" aria-hidden="true" />}
                比上月同期{vsLastMonth > 0 ? '多' : '少'} <span className="tabular-nums">{fmt(Math.abs(vsLastMonth))}</span>
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${paceStatus.tone}`}>
              <paceStatus.Icon className="w-3 h-3" aria-hidden="true" />
              {paceStatus.text} <span className="tabular-nums">{fmt(Math.abs(vsPace))}</span>
            </span>
          </div>
        )}
      </div>

      {!hasData ? (
        <p className="py-12 text-center text-sm text-ink-muted">這個月還沒有支出紀錄。</p>
      ) : (
        <>
          <div className="h-56 sm:h-64 -ml-2" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.primary} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={palette.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.grid} />
                <XAxis
                  dataKey="day"
                  ticks={ticks}
                  tick={{ fontSize: 11, fill: palette.inkMuted }}
                  tickLine={false}
                  axisLine={{ stroke: palette.axis }}
                  tickFormatter={(d: number) => `${d}日`}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: palette.inkSubtle }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={fmtAxis}
                  width={40}
                />
                <Tooltip
                  content={<ChartTooltip month={selectedMonth} />}
                  cursor={{ stroke: palette.inkSubtle, strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Line
                  type="monotone"
                  dataKey="pace"
                  stroke={SERIES.pace.color}
                  strokeWidth={2}
                  strokeDasharray="2 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="lastMonth"
                  stroke={SERIES.lastMonth.color}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4, fill: SERIES.lastMonth.color, stroke: palette.surface, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke={SERIES.cumulative.color}
                  strokeWidth={2}
                  fill="url(#cumulativeFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: SERIES.cumulative.color, stroke: palette.surface, strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {projectionEnd !== null && (
                  <Line
                    type="linear"
                    dataKey="projection"
                    stroke={SERIES.projection.color}
                    strokeOpacity={0.55}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
                {isCurrent && latest && (
                  <ReferenceLine
                    x={latest.day}
                    stroke={palette.inkSubtle}
                    strokeOpacity={0.6}
                    strokeDasharray="2 3"
                    label={{ value: '今天', position: 'insideTopLeft', fill: palette.inkMuted, fontSize: 10 }}
                  />
                )}
                {latest && (
                  <ReferenceDot
                    x={latest.day}
                    y={latest.cumulative!}
                    r={5}
                    fill={SERIES.cumulative.color}
                    stroke={palette.surface}
                    strokeWidth={2}
                    label={{
                      value: fmt(latest.cumulative!),
                      position: latest.day > series.length * 0.8 ? 'left' : 'top',
                      fill: palette.ink,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted font-medium">
            <span className="flex items-center gap-1.5">
              <LegendSwatch color={SERIES.cumulative.color} />
              {SERIES.cumulative.label}
            </span>
            <span className="flex items-center gap-1.5">
              <LegendSwatch color={SERIES.lastMonth.color} dash="5 3" />
              {SERIES.lastMonth.label}
            </span>
            <span className="flex items-center gap-1.5">
              <LegendSwatch color={SERIES.pace.color} dash="2 3" />
              {SERIES.pace.label}（{budget.isCustom ? '預算' : '參考預算'} <span className="tabular-nums">{fmt(budget.amount)}</span>）
            </span>
            {projectionEnd !== null && (
              <span className="flex items-center gap-1.5">
                <LegendSwatch color={SERIES.projection.color} dash="3 3" />
                {SERIES.projection.label} <span className="tabular-nums">{fmt(projectionEnd)}</span>
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
};

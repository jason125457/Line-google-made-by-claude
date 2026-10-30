import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { BarChart2, TrendingUp, Filter, CalendarDays } from 'lucide-react';
import { MonthlySummary, Transaction } from '../types/finance';
import { calculateSixMonthAverage } from '../utils/financeCalculations';
import { getCurrentMonthString } from '../utils/financeCalculations';
import { palette, categoryColor } from '../theme/tokens';

interface ExpenseChartsProps {
  monthlySummaries: MonthlySummary[];
  transactions: Transaction[];
  selectedMonth: string;
  selectedCategory?: string;
  onCategoryClick?: (category: string) => void;
  onMonthClick?: (month: string) => void;
}



export const ExpenseCharts: React.FC<ExpenseChartsProps> = ({
  monthlySummaries,
  transactions,
  selectedMonth,
  selectedCategory,
  onCategoryClick,
  onMonthClick,
}) => {
  const [trendRange, setTrendRange] = useState<'recent6' | 'all'>('recent6');
  const [chartMode, setChartMode] = useState<'bar' | 'area'>('bar');

  const sortedSummaries = useMemo(() => {
    return [...monthlySummaries].sort((a, b) => a.month.localeCompare(b.month));
  }, [monthlySummaries]);

  const trendData = useMemo(() => {
    return trendRange === 'recent6' ? sortedSummaries.slice(-6) : sortedSummaries;
  }, [sortedSummaries, trendRange]);

  // Current active month in dataset
  const currentMonth = getCurrentMonthString();
  const referenceMonth = selectedMonth || sortedSummaries[sortedSummaries.length - 1]?.month || currentMonth;

  const avgExpense = useMemo(() => {
    return calculateSixMonthAverage(sortedSummaries, referenceMonth);
  }, [sortedSummaries, referenceMonth]);

  // Donut category data
  const filteredTransactions = useMemo(() => {
    return selectedMonth ? transactions.filter(t => t.month === selectedMonth) : transactions;
  }, [transactions, selectedMonth]);

  const { categoryData, totalCategoryExpense } = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    let total = 0;

    filteredTransactions.forEach(t => {
      const cat = t.category || '雜支';
      categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
      total += t.amount;
    });

    const data = Object.entries(categoryMap)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.value - a.value);

    return { categoryData: data, totalCategoryExpense: total };
  }, [filteredTransactions]);

  const formatNTD = (val: number) => `NT$ ${Math.round(val).toLocaleString()}`;

  const handleChartClick = (event: any) => {
    const month = event?.activePayload?.[0]?.payload?.month || event?.activeLabel;
    if (month) onMonthClick?.(month);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* ── 1. 左側：收支/月度趨勢圖 (7 欄) ── */}
      <div className="xl:col-span-7 fintech-card p-4 sm:p-6 flex flex-col justify-between min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">月度支出趨勢</h3>
              {trendRange === 'recent6' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/50">
                  近 6 個月
                </span>
              )}
              {selectedMonth && (
                <button
                  type="button"
                  onClick={() => onMonthClick?.(selectedMonth)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-teal-600 text-white shadow-sm inline-flex items-center gap-1.5 hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  aria-label={`取消 ${selectedMonth} 月份篩選`}
                  title="取消月份篩選"
                >
                  <CalendarDays className="w-3 h-3" aria-hidden="true" />
                  分析月份：{selectedMonth}
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              點擊任一月份，可切換整個儀表板的分析月份
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto shrink-0">
            {/* Range Toggle */}
            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs font-semibold text-slate-600">
              <button
                onClick={() => setTrendRange('recent6')}
                aria-pressed={trendRange === 'recent6'}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendRange === 'recent6' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                近 6 月
              </button>
              <button
                onClick={() => setTrendRange('all')}
                aria-pressed={trendRange === 'all'}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendRange === 'all' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                全歷史
              </button>
            </div>

            {/* Bar vs Area Toggle */}
            <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs font-semibold text-slate-600">
              <button
                onClick={() => setChartMode('area')}
                className={`p-1.5 rounded-lg transition-all ${
                  chartMode === 'area' ? 'bg-white text-teal-700 shadow-sm' : 'hover:text-slate-900'
                }`}
                title="切換平滑走勢圖"
                aria-label="切換為平滑走勢圖"
                aria-pressed={chartMode === 'area'}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChartMode('bar')}
                className={`p-1.5 rounded-lg transition-all ${
                  chartMode === 'bar' ? 'bg-white text-teal-700 shadow-sm' : 'hover:text-slate-900'
                }`}
                title="切換柱狀分佈圖"
                aria-label="切換為柱狀分佈圖"
                aria-pressed={chartMode === 'bar'}
              >
                <BarChart2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="w-full h-60 sm:h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'area' ? (
              <AreaChart
                data={trendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={handleChartClick}
                className="cursor-pointer"
              >
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={palette.primary} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={palette.primary} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.grid} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: palette.inkMuted }}
                  tickLine={false}
                  axisLine={{ stroke: palette.axis }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: palette.inkSubtle }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload as MonthlySummary;
                    const isOngoing = d.month === currentMonth;
                    const isSelected = d.month === selectedMonth;
                    return (
                      <div className="bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl backdrop-blur-md border border-white/10 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-slate-300">{d.month}</span>
                          <div className="flex items-center gap-1">
                            {isSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-400 text-slate-900 font-extrabold">
                                已選取
                              </span>
                            )}
                            {isOngoing && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/30 text-teal-300 font-bold">
                                進行中
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-base font-extrabold text-white tabular-nums">
                          {formatNTD(d.totalExpense)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          半年均線：<span className="tabular-nums">{formatNTD(avgExpense)}</span>
                        </div>
                        <div className="text-[10px] text-teal-300 font-semibold pt-1 border-t border-white/10">
                          <span>{isSelected ? '已選取，可按上方 ✕ 取消篩選' : '點擊切換下方交易明細'}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                {avgExpense > 0 && (
                  <ReferenceLine
                    y={avgExpense}
                    stroke={palette.warning}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                )}
                {selectedMonth && (
                  <ReferenceLine
                    x={selectedMonth}
                    stroke={palette.primary}
                    strokeDasharray="3 3"
                    strokeWidth={2}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="totalExpense"
                  stroke={palette.primary}
                  strokeWidth={3}
                  fill="url(#trendGradient)"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (!cx || !cy) return <g key={payload?.month || 'empty'} />;
                    const isSelected = selectedMonth === payload.month;
                    return (
                      <circle
                        key={`dot-${payload.month}`}
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 6 : 4}
                        fill={isSelected ? palette.primaryDeep : palette.primary}
                        stroke={palette.surface}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        className="cursor-pointer transition-all hover:scale-125"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMonthClick?.(payload.month);
                        }}
                      />
                    );
                  }}
                  activeDot={{
                    r: 7,
                    fill: palette.primaryStrong,
                    stroke: palette.surface,
                    strokeWidth: 2.5,
                    cursor: 'pointer',
                    onClick: (_e: any, payload: any) => {
                      if (payload && payload.payload) onMonthClick?.(payload.payload.month);
                    }
                  }}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={trendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={handleChartClick}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.grid} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: palette.inkMuted }}
                  tickLine={false}
                  axisLine={{ stroke: palette.axis }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: palette.inkSubtle }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: palette.hover }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload as MonthlySummary;
                    const isSelected = d.month === selectedMonth;
                    return (
                      <div className="bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl backdrop-blur-md border border-white/10 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-slate-300">{d.month}</span>
                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-400 text-slate-900 font-extrabold">
                              已選取
                            </span>
                          )}
                        </div>
                        <div className="text-base font-extrabold text-white tabular-nums">
                          {formatNTD(d.totalExpense)}
                        </div>
                        <div className="text-[10px] text-teal-300 font-semibold pt-1 border-t border-white/10">
                          <span>{isSelected ? '已選取，可按上方 ✕ 取消篩選' : '點擊切換下方交易明細'}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                {avgExpense > 0 && (
                  <ReferenceLine
                    y={avgExpense}
                    stroke={palette.warning}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                )}
                {selectedMonth && (
                  <ReferenceLine
                    x={selectedMonth}
                    stroke={palette.primary}
                    strokeDasharray="3 3"
                    strokeWidth={2}
                  />
                )}
                <Bar
                  dataKey="totalExpense"
                  radius={[8, 8, 0, 0]}
                  onClick={(d: any) => onMonthClick && onMonthClick(d.month)}
                  className="cursor-pointer"
                >
                  {trendData.map((entry) => {
                    const isSelected = selectedMonth === entry.month;
                    const isOngoing = entry.month === currentMonth;
                    return (
                      <Cell
                        key={`bar-${entry.month}`}
                        fill={isSelected ? palette.primaryDeep : isOngoing ? palette.primarySoft : palette.primary}
                        stroke={isSelected ? palette.primary : undefined}
                        strokeWidth={isSelected ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Chart Legend Footer */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-[11px] sm:text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <span className="text-slate-600 font-medium">實際支出</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-amber-500 border-b border-dashed" />
              <span className="text-slate-600 font-medium">半年均線 (<span className="tabular-nums">NT$ {Math.round(avgExpense).toLocaleString()}</span>)</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">可點擊篩選</span>
        </div>
      </div>

      {/* ── 2. 右側：支出分類甜甜圈圖 + 垂直清單 (5 欄 - 參考設計亮點) ── */}
      <div className="xl:col-span-5 fintech-card p-4 sm:p-6 flex flex-col justify-between min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight shrink-0">支出分類</h3>
            {selectedCategory && selectedCategory !== 'all' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center gap-1 truncate">
                <span className="truncate">{selectedCategory}</span>
                <button
                  onClick={() => onCategoryClick && onCategoryClick(selectedCategory)}
                  className="hover:text-indigo-900 font-bold ml-0.5 shrink-0"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-400 shrink-0">
            {selectedMonth ? `${selectedMonth.slice(5)} 月` : '全部月份'}
          </span>
        </div>

        {/* Donut & Vertical List Split Container */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 my-auto min-w-0 w-full">
          {/* Donut with Center Text */}
          <div className="relative w-40 h-40 sm:w-44 sm:h-44 shrink-0 flex items-center justify-center mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  onClick={(entry) => onCategoryClick && onCategoryClick(entry.name)}
                  className="cursor-pointer"
                >
                  {categoryData.map((entry) => {
                    const color = categoryColor(entry.name);
                    const isSelected = selectedCategory === entry.name;
                    return (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={color}
                        stroke={isSelected ? palette.ink : palette.surface}
                        strokeWidth={isSelected ? 3 : 1.5}
                        opacity={selectedCategory && selectedCategory !== 'all' && !isSelected ? 0.4 : 1}
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Center Absolute Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[10px] font-bold text-slate-400 tracking-tight uppercase">
                總支出
              </span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight tabular-nums">
                NT$ {(totalCategoryExpense / 1000).toFixed(1)}k
              </span>
            </div>
          </div>

          {/* Vertical Clean Category List (Matching Reference Image) */}
          <div className="w-full sm:flex-1 space-y-2.5">
            {categoryData.length > 0 ? (
              categoryData.map((cat) => {
                const color = categoryColor(cat.name);
                const isSelected = selectedCategory === cat.name;

                return (
                  <button
                    key={cat.name}
                    onClick={() => onCategoryClick && onCategoryClick(cat.name)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className={`font-semibold whitespace-nowrap ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 tabular-nums whitespace-nowrap">
                      <span className={`text-[11px] font-bold ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                        {cat.percentage}%
                      </span>
                      <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                        NT$ {cat.value.toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                本月尚無消費分類紀錄
              </div>
            )}
          </div>
        </div>

        {/* Footer tip */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px]">共 {categoryData.length} 種分類支出</span>
          <span className="text-[11px] text-teal-700 font-semibold flex items-center gap-1">
            <Filter className="w-3 h-3" />
            點擊任一類別可即時篩選
          </span>
        </div>
      </div>
    </div>
  );
};

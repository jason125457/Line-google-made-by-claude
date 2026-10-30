import React from 'react';
import { Calendar, RefreshCw, Coffee, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { DataSource } from '../types/finance';
import { formatRelativeTime } from '../utils/dateUtils';
import { useNow } from '../hooks/useNow';

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

interface TopGreetingBarProps {
  selectedMonth: string;
  availableMonths: string[];
  onSelectMonth: (month: string) => void;
  isSyncing: boolean;
  onRefresh: () => void;
  showMonthSelector?: boolean;
  dataSource: DataSource;
  lastSyncAt?: string;
  lastSyncTime?: string;
  syncError: string | null;
  hideAmounts: boolean;
  onToggleHideAmounts: () => void;
}

export const TopGreetingBar: React.FC<TopGreetingBarProps> = ({
  selectedMonth,
  availableMonths,
  onSelectMonth,
  isSyncing,
  onRefresh,
  showMonthSelector = true,
  dataSource,
  lastSyncAt,
  lastSyncTime,
  syncError,
  hideAmounts,
  onToggleHideAmounts,
}) => {
  const now = useNow();

  // Determine greeting based on current hour
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? '早安' : currentHour < 18 ? '午安' : '晚安';
  const GreetingIcon = currentHour < 12 ? Coffee : currentHour < 18 ? Sun : Moon;

  const relative = formatRelativeTime(lastSyncAt, now) || lastSyncTime || '';
  const isStale = !!lastSyncAt && now.getTime() - new Date(lastSyncAt).getTime() > STALE_AFTER_MS;
  const syncStatus = isSyncing
    ? { text: '正在同步最新資料…', tone: 'text-slate-500' }
    : dataSource === 'demo'
      ? { text: 'Demo 示範資料', tone: 'text-slate-500' }
      : syncError && dataSource !== 'cloud'
        ? { text: relative ? `同步失敗 · 顯示 ${relative}的資料` : '同步失敗', tone: 'text-rose-600' }
        : relative
          ? { text: `最後同步：${relative}${isStale ? ' · 可能不是最新' : ''}`, tone: isStale ? 'text-amber-700' : 'text-slate-500' }
          : { text: '尚未同步', tone: 'text-slate-500' };

  const formatMonthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    return `${y} 年 ${parseInt(mo, 10)} 月`;
  };

  return (
    <div className={`relative z-10 flex ${showMonthSelector ? 'flex-col sm:flex-row sm:items-center' : 'flex-row items-center'} justify-between gap-3 sm:gap-4 pb-2 w-full min-w-0`}>
      {/* One row unless the month selector needs its own line on phones */}
      {/* Left: Greeting & Subtitle */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
              {greeting}，理財達人
            </h2>
            <GreetingIcon className="w-5 h-5 text-gold shrink-0" aria-hidden="true" />
          </div>
          <p className={`text-xs sm:text-sm mt-0.5 font-medium truncate ${syncStatus.tone}`} role="status">
            {syncStatus.text}
          </p>
        </div>
      </div>

      {/* Right: Controls */}
      <div className={`flex items-center ${showMonthSelector ? 'justify-between w-full' : 'justify-end'} sm:justify-end gap-2 sm:w-auto shrink-0`}>
        {/* Month Selector Pill */}
        {showMonthSelector && <div className="relative flex-1 sm:flex-initial min-w-0">
          <div className="min-h-11 flex items-center justify-between gap-2 bg-white border border-line rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 shadow-sm hover:border-slate-300 transition-colors w-full">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                aria-label="選擇分析月份"
                className="bg-transparent appearance-none pr-4 outline-none cursor-pointer font-bold text-slate-800 text-xs w-full truncate"
              >
                <option value="">全部月份</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <span className="pointer-events-none text-[10px] text-slate-400 shrink-0">
              ▼
            </span>
          </div>
        </div>}

        {/* Privacy mode: blurs every amount on every page (remembered on this device) */}
        <button
          onClick={onToggleHideAmounts}
          aria-pressed={hideAmounts}
          className={`min-h-11 min-w-11 px-3 rounded-2xl border shadow-sm transition-colors flex items-center justify-center shrink-0 ${
            hideAmounts ? 'bg-night border-night text-white' : 'bg-white border-line hover:bg-slate-50 text-slate-500'
          }`}
          title={hideAmounts ? '顯示金額' : '隱藏金額'}
          aria-label="隱藏所有金額"
        >
          {hideAmounts ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
        </button>

        {/* Sync button */}
        <button
          onClick={onRefresh}
          disabled={isSyncing}
          className="min-h-11 px-3 py-2 rounded-2xl bg-white border border-line hover:bg-slate-50 text-slate-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold shrink-0"
          title="重新同步 Google 試算表"
          aria-label="重新同步 Google 試算表"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-600' : 'text-slate-500'}`} />
          <span>同步</span>
        </button>
      </div>
    </div>
  );
};

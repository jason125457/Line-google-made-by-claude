import React from 'react';
import { Cloud, RefreshCw, Wallet } from 'lucide-react';
import { DataSource } from '../types/finance';
import { AppTab, NAV_ITEMS } from '../constants/navigation';
import { formatRelativeTime } from '../utils/dateUtils';
import { useNow } from '../hooks/useNow';

interface SidebarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  dataSource: DataSource;
  isSyncing: boolean;
  onRefresh: () => void;
  onOpenSyncModal: () => void;
  lastSyncTime?: string;
  lastSyncAt?: string;
  syncError?: string | null;
}

/** Desktop-only navigation (lg+). Phones and tablets use BottomNav instead. */
export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  dataSource,
  isSyncing,
  onRefresh,
  onOpenSyncModal,
  lastSyncTime,
  lastSyncAt,
  syncError,
}) => {
  const now = useNow();
  const syncLabel = formatRelativeTime(lastSyncAt, now) || lastSyncTime || '';

  const statusMeta = {
    cloud: {
      label: 'Google 試算表',
      badge: '已同步',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]',
      description: syncLabel ? `上次同步：${syncLabel}` : '已與 LINE 記帳資料連線',
    },
    cache: {
      label: '快取資料',
      badge: '非即時',
      dot: 'bg-amber-400',
      description: syncLabel ? `上次成功：${syncLabel}` : '目前顯示上次保存的資料',
    },
    error: {
      label: '同步失敗',
      badge: '需處理',
      dot: 'bg-rose-400',
      description: syncError || '請檢查連線設定',
    },
    demo: {
      label: 'Demo 示範模式',
      badge: '示範',
      dot: 'bg-amber-400',
      description: '目前為擬真假資料，隨時可綁定',
    },
  }[dataSource];

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30 shadow-xl shadow-black/10">
    <div className="flex flex-col h-full bg-night text-slate-300 select-none">
      {/* 1. Brand Logo */}
      <div className="px-6 pt-7 pb-6 flex items-center border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center text-night shadow-md shadow-black/20">
            <Wallet className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
              <span>記帳本</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-emerald-400 font-semibold tracking-normal">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">個人財務智慧管理</p>
          </div>
        </div>
      </div>

      {/* 2. Main Navigation Menu */}
      <div className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
          分析與視圖
        </div>

        {NAV_ITEMS.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => onSelectTab(tab)}
            aria-current={activeTab === tab ? 'page' : undefined}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all ${
              activeTab === tab
                ? 'bg-gradient-to-r from-gold to-gold-strong text-night shadow-lg shadow-gold/20'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{label}</span>
          </button>
        ))}

        <div className="pt-5 pb-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
            系統與設定
          </div>
        </div>

        {/* 雲端同步設定 */}
        <button
          onClick={onOpenSyncModal}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <Cloud className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="flex-1 text-left">雲端連線設定</span>
          {dataSource === 'cloud' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
        </button>
      </div>

      {/* 3. Bottom Cloud Status Card */}
      <div className="p-4 border-t border-white/5">
        <div className="bg-night-raised rounded-2xl p-3.5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${statusMeta.dot}`}
              />
              <span className="text-xs font-bold text-white">
                {statusMeta.label}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {statusMeta.badge}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed truncate" title={statusMeta.description}>
            {statusMeta.description}
          </p>

          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isSyncing ? '同步更新中...' : dataSource === 'demo' ? '設定雲端連線' : '重新同步資料'}</span>
          </button>
        </div>
      </div>
    </div>
    </aside>
  );
};

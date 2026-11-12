import React from 'react';

const Bar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-lg bg-slate-200/70 ${className}`} />
);

/**
 * Placeholder shaped like the dashboard, shown on a first load with no cached data.
 * Pulses only when the user has not asked for reduced motion.
 */
export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-4 sm:space-y-6 animate-pulse motion-reduce:animate-none" role="status" aria-label="正在讀取記帳資料">
    {/* Overview card: headline number + budget bar on every width, recent records on phones */}
    <div className="fintech-card p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
        <div className="space-y-2 shrink-0"><Bar className="h-3 w-20" /><Bar className="h-10 w-40" /><Bar className="h-3 w-32" /></div>
        <div className="flex-1 space-y-2.5">
          <div className="flex justify-between"><Bar className="h-3 w-24" /><Bar className="h-3 w-24" /></div>
          <Bar className="h-2.5 w-full rounded-full" />
          <Bar className="h-3 w-28" />
        </div>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="sm:hidden flex justify-between items-center pt-1">
          <div className="space-y-1.5"><Bar className="h-3.5 w-24" /><Bar className="h-2.5 w-16" /></div>
          <Bar className="h-3.5 w-14" />
        </div>
      ))}
    </div>

    {/* Metric cards */}
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="fintech-card p-3.5 sm:p-5 space-y-3">
          <Bar className="h-3 w-20" />
          <Bar className="h-7 w-28" />
          <Bar className="h-3 w-16" />
        </div>
      ))}
    </div>

    {/* Chart */}
    <div className="fintech-card p-4 sm:p-6 space-y-4">
      <Bar className="h-4 w-32" />
      <div className="flex items-end gap-3 h-40">
        {[55, 80, 45, 90, 70, 35].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-lg bg-slate-200/70" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
    <span className="sr-only">正在讀取記帳資料…</span>
  </div>
);

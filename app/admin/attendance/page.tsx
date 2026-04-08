'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import DailyTab from './daily-tab';
import ReportsTab from './reports-tab';

export default function AttendancePage() {
  const [tab, setTab] = useState<'daily' | 'reports'>('daily');

  return (
    <div className="flex flex-col flex-1">
      {/* Tab selector */}
      <div className="border-b border-border px-5 md:px-8 pt-5 pb-0">
        <h1 className="text-xl font-semibold tracking-tight mb-3">Frequência</h1>
        <div className="flex items-center gap-1">
          {(['daily', 'reports'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'h-8 px-3 rounded-md text-xs font-medium transition-colors',
                tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'daily' ? 'Chamada Diária' : 'Relatórios'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'daily' ? <DailyTab /> : <ReportsTab />}
    </div>
  );
}

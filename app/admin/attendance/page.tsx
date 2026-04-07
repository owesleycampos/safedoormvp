'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, BarChart2 } from 'lucide-react';
import DailyTab from './daily-tab';
import ReportsTab from './reports-tab';

export default function AttendancePage() {
  const [tab, setTab] = useState<'daily' | 'reports'>('daily');

  return (
    <div className="flex flex-col flex-1">
      {/* Tab selector */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm px-3 md:px-6 pt-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'daily' | 'reports')}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="daily" className="flex-1 sm:flex-initial gap-1.5 text-xs">
              <ClipboardList className="h-3.5 w-3.5" />
              Chamada Diária
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1 sm:flex-initial gap-1.5 text-xs">
              <BarChart2 className="h-3.5 w-3.5" />
              Relatórios
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      {tab === 'daily' ? <DailyTab /> : <ReportsTab />}
    </div>
  );
}

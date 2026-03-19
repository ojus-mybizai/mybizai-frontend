'use client';

import { LeadsCharts, WorkCharts } from './report-charts';
import type { ReportsDashboard } from '@/services/reports';

interface Props {
  dashboard: ReportsDashboard;
}

export default function ReportChartsOverview({ dashboard }: Props) {
  return (
    <div className="grid gap-8">
      <LeadsCharts data={dashboard.leads} />
      <WorkCharts data={dashboard.work} />
    </div>
  );
}

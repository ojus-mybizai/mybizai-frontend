'use client';

import { LeadsCharts, CatalogCharts, WorkCharts, OrdersCharts } from './report-charts';
import type { ReportsDashboard } from '@/services/reports';

interface Props {
  dashboard: ReportsDashboard;
}

export default function ReportChartsOverview({ dashboard }: Props) {
  return (
    <div className="grid gap-8">
      <LeadsCharts data={dashboard.leads} />
      <CatalogCharts data={dashboard.catalog} />
      <WorkCharts data={dashboard.work} />
      <OrdersCharts data={dashboard.orders} />
    </div>
  );
}

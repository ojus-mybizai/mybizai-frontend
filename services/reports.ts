import { apiFetch } from '@/lib/api-client';

export interface LeadsReport {
  total_leads: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_source: Record<string, number>;
  over_time: { date: string; count: number }[];
}

export interface CatalogTopItem {
  catalog_item_id: number;
  name: string;
  quantity_sold: number;
  revenue: number;
}

export interface CatalogReport {
  total_items: number;
  by_type: Record<string, number>;
  by_availability: Record<string, number>;
  average_price: number;
  top_items: CatalogTopItem[];
}

export interface WorkReport {
  total: number;
  by_status: Record<string, number>;
  by_type: { work_type_id: number; work_type_name: string; count: number }[];
  by_employee: { user_id: number; name: string; count: number }[];
}

export interface OrdersReport {
  total_orders: number;
  by_status: Record<string, number>;
  total_revenue: number;
  over_time: { date: string; order_count: number; revenue: number }[];
}

export interface TeamReport {
  total_team: number;
  total_leads_assigned: number;
  total_work_assigned: number;
}

export interface ReportsDashboard {
  leads: LeadsReport;
  catalog: CatalogReport;
  work: WorkReport;
  orders: OrdersReport;
  team: TeamReport;
}

export async function getReportsDashboard(days: number = 30): Promise<ReportsDashboard> {
  const params = new URLSearchParams({ days: String(days) });
  return apiFetch<ReportsDashboard>(`/reports/dashboard?${params.toString()}`, {
    method: 'GET',
    auth: true,
  });
}

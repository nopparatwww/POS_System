import LogsView from '../admin/logs/LogsView'
export default function SalesLogsPage() {
  return <LogsView title="Sales Logs" fixedRole="cashier" endpoint="/api/protect/logs/sales" />
}

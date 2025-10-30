import LogsView from '../admin/logs/LogsView'
export default function WarehouseLogsPage() {
  return <LogsView title="Warehouse Logs" fixedRole="warehouse" endpoint="/api/protect/logs/warehouse-self" />
}

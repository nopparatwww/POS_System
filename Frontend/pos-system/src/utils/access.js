const PATH_TO_KEY = [
  [/^\/admin(?:\/dashboard)?$/, 'admin.dashboard'],
  [/^\/admin\/permissions(?:\/.*)?$/, 'admin.permissions'],
  [/^\/admin\/products(?:\/.*)?$/, 'admin.products'],
  [/^\/admin\/discounts(?:\/.*)?$/, 'admin.discounts'],
  [/^\/admin\/logs(?:\/.*)?$/, 'admin.logs'],
  [/^\/sales\/cashier(?:\/.*)?$/, 'sales.cashier'],
  [/^\/sales\/history(?:\/.*)?$/, 'sales.view'],
  [/^\/sales\/logs(?:\/.*)?$/, 'sales.logs'],
  [/^\/sales\/refund\/history(?:\/.*)?$/, 'refunds.view'],
  [/^\/sales\/refund(?:\/.*)?$/, 'refunds.create'],
  [/^\/sales$/, 'sales.home'],
  [/^\/warehouse\/products(?:\/.*)?$/, 'warehouse.products'],
  [/^\/warehouse\/stockin(?:\/.*)?$/, 'warehouse.stockin'],
  [/^\/warehouse\/stockout(?:\/.*)?$/, 'warehouse.stockout'],
  [/^\/warehouse\/stockaudit(?:\/.*)?$/, 'warehouse.stockaudit'],
  [/^\/warehouse\/lowstock(?:\/.*)?$/, 'warehouse.lowstock'],
  [/^\/warehouse\/audit(?:\/.*)?$/, 'warehouse.audit'],
  [/^\/warehouse\/reports(?:\/.*)?$/, 'warehouse.reports'],
  [/^\/warehouse\/logs(?:\/.*)?$/, 'warehouse.logs'],
  [/^\/warehouse$/, 'warehouse.home'],
]

export function pathToKey(pathname) {
  return PATH_TO_KEY.find(([pattern]) => pattern.test(pathname))?.[1] ?? null
}

export function canAccessRoute({ allowRoutes, denyRoutes }, routeKey) {
  return Array.isArray(allowRoutes) && allowRoutes.includes(routeKey)
    && !(Array.isArray(denyRoutes) && denyRoutes.includes(routeKey))
}

const ROLE_OPTIONS = [
  {
    key: 'sales',
    label: 'Cashier',
    entries: [
      ['sales.home', '/sales'],
      ['sales.cashier', '/sales/cashier'],
      ['sales.view', '/sales/history'],
      ['sales.logs', '/sales/logs'],
      ['refunds.view', '/sales/refund/history'],
      ['refunds.create', '/sales/refund'],
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    entries: [
      ['admin.dashboard', '/admin/dashboard'],
      ['admin.permissions', '/admin/permissions'],
      ['admin.products', '/admin/products'],
      ['admin.logs', '/admin/logs'],
      ['admin.discounts', '/admin/discounts'],
    ],
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    entries: [
      ['warehouse.home', '/warehouse'],
      ['warehouse.products', '/warehouse/products'],
      ['warehouse.stockin', '/warehouse/stockin'],
      ['warehouse.stockout', '/warehouse/stockout'],
      ['warehouse.stockaudit', '/warehouse/stockaudit'],
      ['warehouse.lowstock', '/warehouse/lowstock'],
      ['warehouse.audit', '/warehouse/audit'],
      ['warehouse.reports', '/warehouse/reports'],
      ['warehouse.logs', '/warehouse/logs'],
    ],
  },
]

export function availableRoleOptions({ allowRoutes = [], denyRoutes = [] }, serverRole) {
  const allow = new Set(allowRoutes)
  const deny = new Set(denyRoutes)

  return ROLE_OPTIONS.flatMap(({ key, label, entries }) => {
    // Admin API routes also require the server-side admin role.
    if (key === 'admin' && serverRole !== 'admin') return []
    const entry = entries.find(([permission]) => allow.has(permission) && !deny.has(permission))
    return entry ? [{ key, label, to: entry[1] }] : []
  })
}

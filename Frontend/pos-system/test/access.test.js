import test from 'node:test'
import assert from 'node:assert/strict'
import { availableRoleOptions, canAccessRoute, pathToKey } from '../src/utils/access.js'

test('specific protected routes map to their own permissions', () => {
  assert.equal(pathToKey('/sales/cashier'), 'sales.cashier')
  assert.equal(pathToKey('/sales/refund/history'), 'refunds.view')
  assert.equal(pathToKey('/warehouse/stockin'), 'warehouse.stockin')
  assert.equal(pathToKey('/warehouse'), 'warehouse.home')
  assert.equal(pathToKey('/admin'), 'admin.dashboard')
  assert.equal(pathToKey('/unknown'), null)
})

test('demo cashier only sees the cashier destination', () => {
  const options = availableRoleOptions({
    allowRoutes: ['sales.home', 'sales.cashier'],
    denyRoutes: [],
  }, 'cashier')
  assert.deepEqual(options, [{ key: 'sales', label: 'Cashier', to: '/sales' }])
})

test('allow-only access respects explicit denies', () => {
  assert.equal(canAccessRoute({ allowRoutes: ['sales.home'], denyRoutes: [] }, 'sales.home'), true)
  assert.equal(canAccessRoute({ allowRoutes: ['sales.home'], denyRoutes: ['sales.home'] }, 'sales.home'), false)
  assert.equal(canAccessRoute({ allowRoutes: ['sales.home'] }, 'admin.dashboard'), false)
  assert.equal(canAccessRoute({}, 'sales.home'), false)
})

test('denied cashier permission stays hidden while sales home remains available', () => {
  const permissions = {
    allowRoutes: ['sales.home', 'sales.cashier'],
    denyRoutes: ['sales.cashier'],
  }
  assert.equal(canAccessRoute(permissions, 'sales.home'), true)
  assert.equal(canAccessRoute(permissions, 'sales.cashier'), false)
})

test('denied permissions and server role restrict the role switcher', () => {
  const permissions = {
    allowRoutes: ['sales.home', 'admin.dashboard', 'warehouse.home'],
    denyRoutes: ['warehouse.home'],
  }
  assert.deepEqual(availableRoleOptions(permissions, 'cashier').map(({ key }) => key), ['sales'])
  assert.deepEqual(availableRoleOptions(permissions, 'admin').map(({ key }) => key), ['sales', 'admin'])
})

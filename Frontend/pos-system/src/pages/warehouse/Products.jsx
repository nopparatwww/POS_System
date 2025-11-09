/*
  Warehouse Products page wrapper

  Purpose:
  - Reuse the Admin ProductManagement UI under the Warehouse area.
  - Navigation/permission: guarded by ProtectedRoute with key 'warehouse.products'.
*/
import React, { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import TopBar from '../../components/TopBar'
import ProductManagement from '../admin/ProductManagement'

export default function WarehouseProducts() {
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    function onResize(){ setIsNarrow(window.innerWidth < 900) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isNarrow ? 'column' : 'row' }}>
      {!isNarrow && <NavBar mode="warehouse" />}
      {isNarrow && (
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 64, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', background: '#fff' }}>
            <strong>Warehouse • Products</strong>
          </div>
        </div>
      )}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', marginLeft: isNarrow ? 0 : 220 }}>
        <TopBar />
        {/* Remove outer padding/maxWidth so ProductManagement controls layout */}
        <div style={{ flex: 1 }}>
          <ProductManagement />
        </div>
      </main>
    </div>
  )
}

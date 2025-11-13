// Frontend/pos-system/src/pages/warehouse/LowStockAlert.jsx
import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import NavBar from '../../components/NavBar'
import TopBar from '../../components/TopBar'

// (Debounce Hook - หากยังไม่มียูทิลิตี้นี้)
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  return debouncedValue
}

export default function LowStockAlert() {
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [isNarrow, setIsNarrow] = useState(false)

  // Form state
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [minStock, setMinStock] = useState('')

  // Product search state
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const debouncedSearchTerm = useDebounce(productSearch, 300)

  // Low Stock List state
  const [lowStockItems, setLowStockItems] = useState([])
  const [loadingList, setLoadingList] = useState(true)

  // General state
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Responsive layout effect
  useEffect(() => {
    function onResize(){ setIsNarrow(window.innerWidth < 900) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Function to fetch low stock items
  async function fetchLowStockItems() {
    setLoadingList(true)
    try {
  const res = await axios.get(`${API_BASE}/api/protect/products/lowstock-robust`)
      setLowStockItems(res.data || [])
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setLoadingList(false)
    }
  }
  
  // Fetch low stock items on mount
  useEffect(() => {
    fetchLowStockItems()
  }, [API_BASE])

  // Effect for product search
  useEffect(() => {
    if (debouncedSearchTerm.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    
    async function search() {
      setIsSearching(true)
      try {
        const res = await axios.get(`${API_BASE}/api/protect/products`, {
          params: { q: debouncedSearchTerm, limit: 10, sort: 'name' }
        })
        setSearchResults(res.data.items || [])
      } catch (e) {} finally {
        setIsSearching(false)
      }
    }
    search()
  }, [debouncedSearchTerm, API_BASE])

  // --- Handlers ---

  function handleProductSelect(product) {
    setSelectedProduct(product)
    setProductSearch(product.name)
    setMinStock(product.reorderLevel || '') // <-- ดึง Min Level ปัจจุบันมาโชว์
    setSearchResults([]) 
  }

  function clearForm() {
    setSelectedProduct(null)
    setProductSearch('')
    setMinStock('')
    setSearchResults([])
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedProduct) {
      setError('Please select a product.')
      return
    }
    const level = parseFloat(minStock)
    if (isNaN(level) || level < 0) {
      setError('Minimum Stock must be a valid number (0 or more).')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      // ใช้ API เดิมของ Product (PUT /:id) เพื่ออัปเดต reorderLevel
      const payload = { reorderLevel: level }
      await axios.put(`${API_BASE}/api/protect/products/${selectedProduct._id}`, payload) //
      
      setSuccess(`Minimum stock for ${selectedProduct.name} set to ${level}.`)
      clearForm()
      fetchLowStockItems() // <-- รีเฟรชรายการของน้อยหลังตั้งค่า
      
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setSubmitting(false)
    }
  }
  
  // Styles
  const cardStyle = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 'clamp(16px, 3vw, 24px)',
    boxShadow: '0 8px 16px rgba(0,0,0,0.04)'
  }
  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #c7d0da',
    borderRadius: 6
  }
  const labelStyle = {
    display: 'block',
    fontWeight: 600,
    marginBottom: 6,
    color: '#374151'
  }
  const thStyle = {
    textAlign: 'left',
    padding: '12px 16px',
    borderBottom: '2px solid #e5e7eb',
    color: '#1f2937'
  }
  const tdStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    color: '#374151',
    verticalAlign: 'middle'
  }
  const statusStyle = {
    background: '#fee2e2',
    color: '#b91c1c',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isNarrow ? 'column' : 'row' }}>
      {!isNarrow && <NavBar mode="warehouse" />}
      {isNarrow && (
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 64, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', background: '#fff' }}>
            <strong>Warehouse • Low Stock</strong>
          </div>
        </div>
      )}
  <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: '#f9fafb', marginLeft: isNarrow ? 0 : 220 }}>
        {!isNarrow && <TopBar />}
        <div style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, color: '#111827' }}>Low Stock Alert</h1>

          {/* --- Form Card --- */}
          <form onSubmit={handleSubmit} style={{ ...cardStyle, marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: '#111827', marginTop: 0 }}>Set Minimum Stock</h2>
            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 20 }}>
              
              {/* Product Search */}
              <div style={{ position: 'relative' }}>
                <label htmlFor="productSearch" style={labelStyle}>Select Product</label>
                <input
                  id="productSearch"
                  type="text"
                  placeholder="Search by Name, SKU, or Barcode..."
                  style={inputStyle}
                  value={selectedProduct ? selectedProduct.name : productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                    setSelectedProduct(null)
                  }}
                  disabled={!!selectedProduct}
                />
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={clearForm}
                    style={{ position: 'absolute', right: 8, top: 34, background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                )}
                {searchResults.length > 0 && !selectedProduct && (
                  <ul style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'white', border: '1px solid #e5e7eb',
                    borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto',
                    padding: 0, margin: '4px 0 0 0', listStyle: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                  }}>
                    {isSearching ? (
                      <li style={{ padding: '10px 12px', color: '#6b7280' }}>Searching...</li>
                    ) : (
                      searchResults.map(prod => (
                        <li
                          key={prod._id}
                          onClick={() => handleProductSelect(prod)}
                          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          {prod.name} <span style={{ color: '#6b7280', fontSize: 12 }}>({prod.sku})</span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              {/* Minimum Stock */}
              <div>
                <label htmlFor="minStock" style={labelStyle}>Minimum Stock</label>
                <input
                  id="minStock"
                  type="number"
                  placeholder="Enter Minimum Quantity"
                  style={inputStyle}
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                />
              </div>
            </div>

            {/* Error/Success Message */}
            {error && (
              <div style={{ color: '#dc2626', marginTop: 16 }}>{error}</div>
            )}
            {success && (
              <div style={{ color: '#059669', marginTop: 16 }}>{success}</div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid #f3f4f6' }}>
              <button
                type="submit"
                disabled={submitting || !selectedProduct}
                style={{
                  padding: '10px 16px', background: (submitting || !selectedProduct) ? '#9ca3af' : '#1f2937', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: (submitting || !selectedProduct) ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Setting...' : 'Set Alert'}
              </button>
            </div>
          </form>

          {/* --- Recent Entries Card --- */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: '#111827' }}>Low Stock Items</h2>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Current Stock</th>
                    <th style={thStyle}>Min Level</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>Loading low stock items...</td>
                    </tr>
                  ) : lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>No items are currently below minimum stock.</td>
                    </tr>
                  ) : lowStockItems.map(item => {
                      // --- (1) คัดลอก Logic การตัดสินใจมาจาก Dashboard ---
                      const isCritical = item.stock <= 5;
                      const statusColor = isCritical ? '#fee2e2' : '#fef9c3'; 
                      const textColor = isCritical ? '#991b1b' : '#713f12'; 

                      return (
                        <tr key={item._id}>
                          <td style={tdStyle}>{item.name} <span style={{ color: '#6b7280', fontSize: 12 }}>({item.sku})</span></td>
                          <td style={tdStyle}>{item.stock}</td>
                          <td style={tdStyle}>{item.reorderLevel}</td>
                          <td style={tdStyle}>
                            {/* --- (2) ใช้ Style และ Text แบบไดนามิก --- */}
                            <span style={{
                              background: statusColor,
                              color: textColor,
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600
                            }}>
                              {isCritical ? 'Critical' : 'Low'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
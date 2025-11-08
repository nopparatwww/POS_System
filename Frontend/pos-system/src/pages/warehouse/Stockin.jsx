// Frontend/pos-system/src/pages/warehouse/StockIn.jsx
import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import NavBar from '../../components/NavBar'
import TopBar from '../../components/TopBar'

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

export default function StockIn() {
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [isNarrow, setIsNarrow] = useState(false)

  // Form state
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState('')

  // Product search state
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const debouncedSearchTerm = useDebounce(productSearch, 300)

  // Recent entries state
  const [recentEntries, setRecentEntries] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [recentPage, setRecentPage] = useState(1);
  const [recentLimit, setRecentLimit] = useState(10);
  const [recentTotal, setRecentTotal] = useState(0);

  // General state
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 900) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    async function fetchRecent() {
      setLoadingRecent(true)
      try {
        const res = await axios.get(`${API_BASE}/api/protect/stock/in/logs`, {
          params: {
            page: recentPage,
            limit: recentLimit
          }
        })
        setRecentEntries(res.data.items || [])
        setRecentTotal(res.data.total || 0)
      } catch (e) {
        setError(e?.response?.data?.message || e.message)
      } finally {
        setLoadingRecent(false)
      }
    }
    fetchRecent()
  }, [API_BASE, recentPage, recentLimit])

  useEffect(() => {
    if (debouncedSearchTerm.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    async function search() {
      setIsSearching(true)
      try {
        const res = await axios.get(`${API_BASE}/api/protect/products`, { //
          params: { q: debouncedSearchTerm, limit: 10, sort: 'name' }
        })
        setSearchResults(res.data.items || [])
      } catch (e) { } finally {
        setIsSearching(false)
      }
    }
    search()
  }, [debouncedSearchTerm, API_BASE])

  function handleProductSelect(product) {
    setSelectedProduct(product)
    setProductSearch(product.name)
    setSearchResults([])
  }

  function clearForm() {
    setSelectedProduct(null)
    setProductSearch('')
    setSearchResults([])
    setQuantity('')
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedProduct) {
      setError('Please select a product.')
      return
    }
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        productId: selectedProduct._id,
        quantity: qty,
      }
      const res = await axios.post(`${API_BASE}/api/protect/stock/in`, payload)

      // อัปเดตสต็อกใน UI ทันที (เพื่อให้กล่อง "Current Stock" อัปเดต)
      setSelectedProduct(prev => ({
        ...prev,
        stock: res.data.quantity
      }));

      // รีเฟรชตารางไปหน้า 1
      if (recentPage === 1) {
        setRecentEntries(prev => [res.data, ...prev.slice(0, recentLimit - 1)]);
        setRecentTotal(prev => prev + 1);
      } else {
        setRecentPage(1);
      }
      clearForm()

    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // (Styles...)
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
    color: '#374151'
  }
  const pagerBtnStyle = (disabled) => ({
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid #e5e7eb',
    background: '#ffffff',
    color: disabled ? '#94a3b8' : '#0f172a',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: '0 6px 14px rgba(0,0,0,0.06)',
    transition: 'transform 100ms ease, background 120ms ease',
  });

  const recentTotalPages = useMemo(() => Math.max(1, Math.ceil(recentTotal / recentLimit)), [recentTotal, recentLimit]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isNarrow ? 'column' : 'row' }}>
      {!isNarrow && <NavBar mode="warehouse" />}
      {/* ... (Narrow mode header) ... */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: '#f9fafb' }}>
        {!isNarrow && <TopBar />}
        <div style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1000, margin: '0 auto', width: '100%' }}>

          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, color: '#111827' }}>Stock In</h1>

          {/* --- Form Card (ปรับปรุง Layout) --- */}
          <form onSubmit={handleSubmit} style={{ ...cardStyle, marginBottom: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 20 }}>

              {/* === Column 1: Product Select & Stock Display === */}
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
                    onClick={() => {
                      setSelectedProduct(null)
                      setProductSearch('')
                    }}
                    style={{ position: 'absolute', top: 39, right: 10, background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
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
                          {prod.name} <span style={{ color: '#6b7280', fontSize: 12 }}>({prod.sku}) - Stock: {prod.stock}</span>
                        </li>
                      ))
                    )}
                  </ul>
                )}

                {/* --- (ย้ายมาไว้ตรงนี้) แสดง Current Stock --- */}
                {selectedProduct && (
                  <div style={{
                    background: '#f3f4f6',
                    padding: '12px 16px',
                    borderRadius: 8,
                    marginTop: 8 // <-- เพิ่ม margin
                  }}>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>Current Stock: </span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>
                      {selectedProduct.stock}
                    </span>
                    <span style={{ color: '#6b7280' }}> {selectedProduct.unit || 'units'}</span>
                  </div>
                )}
              </div>

              {/* === Column 2: Quantity Received (ช่องสำหรับกรอก) === */}
              <div>
                <label htmlFor="quantity" style={labelStyle}>Quantity Received</label>
                <input
                  id="quantity"
                  type="number"
                  placeholder="Enter Quantity to Add"
                  style={inputStyle}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>

            </div>

            {/* Error Message */}
            {error && (
              <div style={{ color: '#dc2626', marginTop: 16 }}>{error}</div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid #f3f4f6' }}>
              <button
                type="button"
                onClick={clearForm}
                disabled={submitting}
                style={{
                  padding: '10px 16px', background: '#fff', color: '#374151',
                  border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '10px 16px', background: '#059669', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Stocking In...' : 'Stock In'}
              </button>
            </div>
          </form>

          {/* --- Recent Entries Card (เหมือนเดิม) --- */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: '#111827' }}>Recent Stock In Entries</h2>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>New Total Stock</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRecent ? (
                    <tr>
                      <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>Loading...</td>
                    </tr>
                  ) : recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>No recent stock entries found.</td>
                    </tr>
                  ) : (
                    recentEntries.map(entry => (
                      <tr key={entry._id}>
                        <td style={tdStyle}>
                          {entry.product?.name || entry.productName}
                          <span style={{ color: '#6b7280', fontSize: 12 }}> ({entry.product?.sku || entry.sku})</span>
                        </td>
                        <td style={tdStyle}>{entry.quantity}</td>
                        <td style={tdStyle}>{new Date(entry.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* --- Pagination Controls --- */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <button
                  aria-label="Previous page"
                  onClick={() => setRecentPage(p => Math.max(1, p - 1))}
                  disabled={recentPage <= 1}
                  style={pagerBtnStyle(recentPage <= 1)}
                >
                  Prev
                </button>
                <div style={{ padding: '6px 10px', color: '#475569', fontWeight: 700 }}>
                  Page {recentPage} of {recentTotalPages}
                </div>
                <button
                  aria-label="Next page"
                  onClick={() => setRecentPage(p => Math.min(recentTotalPages, p + 1))}
                  disabled={recentPage >= recentTotalPages}
                  style={pagerBtnStyle(recentPage >= recentTotalPages)}
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
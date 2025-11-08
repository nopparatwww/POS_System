// Frontend/pos-system/src/pages/warehouse/StockOut.jsx
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
// --- End Custom Hook ---


export default function Stockout() {
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [isNarrow, setIsNarrow] = useState(false)

  // Form state
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('') // <-- เปลี่ยนจาก Cost

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

  // Responsive layout effect
  useEffect(() => {
    function onResize(){ setIsNarrow(window.innerWidth < 900) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Fetch recent entries on mount
  useEffect(() => {
    async function fetchRecent() {
      setLoadingRecent(true)
      try {
        const res = await axios.get(`${API_BASE}/api/protect/stock/out/logs`, {
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
        // ใช้ API ค้นหาสินค้าเดิม
        const res = await axios.get(`${API_BASE}/api/protect/products`, { //
          params: { q: debouncedSearchTerm, limit: 10, sort: 'name' }
        })
        setSearchResults(res.data.items || [])
      } catch (e) {
        // ignore search error
      } finally {
        setIsSearching(false)
      }
    }
    search()
  }, [debouncedSearchTerm, API_BASE])

  // --- Handlers ---

  function handleProductSelect(product) {
    setSelectedProduct(product)
    setProductSearch(product.name) // ใส่ชื่อในช่องค้นหา
    setSearchResults([]) // ปิด dropdown
  }

  function clearForm() {
    setSelectedProduct(null)
    setProductSearch('')
    setSearchResults([])
    setQuantity('')
    setReason('') // <--
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
    if (!reason || reason.trim().length === 0) { // <--
      setError('Reason is required.')
      return
    }

    if (selectedProduct.stock < qty) { 
      setError(`Cannot stock out. Only ${selectedProduct.stock} items remaining.`);
      return;
    }

    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        productId: selectedProduct._id,
        quantity: qty,
        reason: reason.trim(), // <--
      }
      const res = await axios.post(`${API_BASE}/api/protect/stock/out`, payload)

      // --- VVV นี่คือจุดแก้ไขที่ถูกต้อง VVV ---
      // อัปเดตสต็อกใน UI ทันที โดยการลบ "qty" (จำนวนที่กรอก) ออกจากสต็อกเดิม
      setSelectedProduct(prev => ({
        ...prev,
        stock: (prev.stock || 0) - qty 
      }));
      // --- AAA สิ้นสุดการแก้ไข ---
      
      // ส่วนนี้ถูกต้องแล้ว (เหมือน StockIn)
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
  
  // Styles (คล้ายกับ StockIn)
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
      {isNarrow && (
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 64, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', background: '#fff' }}>
            <strong>Warehouse • Stock Out</strong>
          </div>
        </div>
      )}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: '#f9fafb' }}>
        {!isNarrow && <TopBar />}
        <div style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, color: '#111827' }}>Stock Out</h1>

          {/* --- Form Card --- */}
          <form onSubmit={handleSubmit} style={{ ...cardStyle, marginBottom: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 20 }}>
              
              {/* Product Search */}
              <div style={{ position: 'relative' }}>
                <label htmlFor="productSearch" style={labelStyle}>Select Product</label>
                <div></div>
                <input
                  id="productSearch"
                  type="text"
                  placeholder="Search Product by name or SKU..."
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
                    style={{ position: 'absolute', right: 8, top: 39, background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
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
              </div>

              {/* Quantity */}
              <div>
                <label htmlFor="quantity" style={labelStyle}>Quantity Withdrawn</label>
                <input
                  id="quantity"
                  type="number"
                  placeholder="Enter Quantity"
                  style={inputStyle}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>

              {/* Reason */}
              <div style={{ gridColumn: isNarrow ? '1' : '1 / 3' }}>
                <label htmlFor="reason" style={labelStyle}>Reason</label>
                <input
                  id="reason"
                  type="text"
                  placeholder="Reason (e.g., Damaged, Expired, Internal Use)"
                  style={inputStyle}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
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
                  padding: '10px 16px', background: '#DC2626', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Submitting...' : 'Stock Out'}
              </button>
            </div>
          </form>

          {/* --- Recent Entries Card --- */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: '#111827' }}>Recent Stock Out Entries</h2>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Quantity</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRecent ? (
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>Loading recent entries...</td>
                    </tr>
                  ) : recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>No recent stock out entries found.</td>
                    </tr>
                  ) : (
                    recentEntries.map(entry => (
                      <tr key={entry._id}>
                        <td style={tdStyle}>
                          {entry.product?.name || entry.productName} 
                          <span style={{ color: '#6b7280', fontSize: 12 }}> ({entry.product?.sku || entry.sku})</span>
                        </td>
                        <td style={tdStyle}>{entry.quantity}</td>
                        <td style={tdStyle}>{entry.reason}</td>
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
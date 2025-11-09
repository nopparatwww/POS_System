// Frontend/pos-system/src/pages/warehouse/StockAudit.jsx
import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import NavBar from '../../components/NavBar'
import TopBar from '../../components/TopBar'

// (Debounce Hook)
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

export default function StockAudit() {
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [isNarrow, setIsNarrow] = useState(false)

  // Form state
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [actualStock, setActualStock] = useState('')

  // Product search state
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const debouncedSearchTerm = useDebounce(productSearch, 300)

  // Result state
  const [auditResult, setAuditResult] = useState(null) // State สำหรับ "Audit Results" card

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

  // Product search effect
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
    setSearchResults([])
    setAuditResult(null) // ซ่อนผลลัพธ์เก่าเมื่อเลือกสินค้าใหม่
    setError(null)
    setSuccess(null)
  }

  function clearForm() {
    setSelectedProduct(null)
    setProductSearch('')
    setActualStock('')
    setSearchResults([])
    setAuditResult(null)
    setError(null)
    setSuccess(null)
  }

  // --- (1) ปุ่ม "Complete Audit" (คำนวณฝั่ง Client) ---
  function handleCompleteAudit(e) {
    e.preventDefault()
    if (!selectedProduct) {
      setError('Please select a product.')
      return
    }
    const actual = parseFloat(actualStock)
    if (isNaN(actual) || actual < 0) {
      setError('Actual Stock Count must be a valid number (0 or more).')
      return
    }

    const system = selectedProduct.stock
    const diff = actual - system

    setAuditResult({
      name: selectedProduct.name,
      system: system,
      actual: actual,
      diff: diff,
    })
    setError(null)
    setSuccess(null)
  }

  // --- (2) ปุ่ม "Adjust Stock" (ส่งข้อมูลไป Backend) ---
  async function handleAdjustStock() {
    if (!auditResult || !selectedProduct) {
      setError('Please complete the audit form first.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const payload = {
        productId: selectedProduct._id,
        actualStock: auditResult.actual, // ส่ง "ยอดที่นับได้จริง"
      }
      // เรียก API ใหม่สำหรับ Audit
      await axios.post(`${API_BASE}/api/protect/stock/audit`, payload)
      
      setSuccess(`Stock for ${auditResult.name} adjusted to ${auditResult.actual}.`)
      clearForm()
      
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
  const disabledInputStyle = {
    ...inputStyle,
    background: '#f3f4f6',
    color: '#6b7280',
    cursor: 'not-allowed'
  }
  const labelStyle = {
    display: 'block',
    fontWeight: 600,
    marginBottom: 6,
    color: '#374151'
  }
  const resultCardStyle = {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 8,
    padding: '16px 20px',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isNarrow ? 'column' : 'row' }}>
      {!isNarrow && <NavBar mode="warehouse" />}
      {isNarrow && (
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 64, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', background: '#fff' }}>
            <strong>Warehouse • Stock Audit</strong>
          </div>
        </div>
      )}
  <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: '#f9fafb', marginLeft: isNarrow ? 0 : 220 }}>
        {!isNarrow && <TopBar />}
        <div style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, color: '#111827' }}>Stock Audit</h1>
          
          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 32, alignItems: 'flex-start' }}>

            {/* --- Form Card (Left) --- */}
            <form onSubmit={handleCompleteAudit} style={cardStyle}>
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: '#111827', marginTop: 0 }}>Audit Form</h2>
              
              {/* Product Search */}
              <div style={{ marginBottom: 20, position: 'relative' }}>
                <label htmlFor="productSearch" style={labelStyle}>Select Product</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    id="productSearch"
                    type="text"
                    placeholder="Search by Name, SKU, or Barcode..."
                    style={inputStyle}
                    value={selectedProduct ? selectedProduct.name : productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      setSelectedProduct(null)
                      setAuditResult(null)
                    }}
                    disabled={!!selectedProduct}
                  />
                  {selectedProduct && (
                    <button
                      type="button"
                      onClick={clearForm}
                      style={{ 
                        position: 'absolute', right: 8, top: '50%',
                        transform: 'translateY(-50%)', background: '#ef4444', 
                        color: 'white', border: 'none', borderRadius: 4, 
                        padding: '2px 8px', cursor: 'pointer' 
                      }}
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
              </div>

              {/* System Stock */}
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="systemStock" style={labelStyle}>System Stock:</label>
                <input
                  id="systemStock"
                  type="text"
                  style={disabledInputStyle}
                  value={selectedProduct ? `${selectedProduct.stock} ${selectedProduct.unit || 'units'}` : ''}
                  disabled
                />
              </div>

              {/* Actual Stock Count */}
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="actualStock" style={labelStyle}>Actual Stock Count</label>
                <input
                  id="actualStock"
                  type="number"
                  placeholder="Enter Actual Count"
                  style={inputStyle}
                  value={actualStock}
                  onChange={e => setActualStock(e.target.value)}
                />
              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={!selectedProduct || submitting}
                  style={{
                    padding: '10px 16px', background: (!selectedProduct || submitting) ? '#9ca3af' : '#1f2937', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: (!selectedProduct || submitting) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Complete Audit
                </button>
              </div>
            </form>

            {/* --- Result Card (Right) --- */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: '#111827', marginTop: 0 }}>Audit Results</h2>
              
              {error && (
                <div style={{ color: '#dc2626' }}>{error}</div>
              )}
              {success && (
                <div style={{ color: '#059669' }}>{success}</div>
              )}

              {/* Result Box (แสดงเมื่อคำนวณแล้ว) */}
              {!auditResult && !error && !success && (
                <p style={{ color: '#6b7280', margin: 0 }}>Complete the form to see audit results.</p>
              )}
              
              {auditResult && (
                <div style={resultCardStyle}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>{auditResult.name}</h3>
                  <p style={{ margin: '8px 0 0 0', color: '#374151' }}>System: {auditResult.system} units</p>
                  <p style={{ margin: '4px 0 0 0', color: '#374151' }}>Actual: {auditResult.actual} units</p>
                  <p style={{ margin: '4px 0 0 0', color: auditResult.diff < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                    Difference: {auditResult.diff > 0 ? '+' : ''}{auditResult.diff} units
                  </p>
                  
                  <div style={{ marginTop: 16, borderTop: '1px solid #fcd34d', paddingTop: 16 }}>
                    <button
                      type="button"
                      onClick={handleAdjustStock}
                      disabled={submitting}
                      style={{
                        padding: '10px 16px', background: submitting ? '#9ca3af' : '#1f2937', color: '#fff',
                        border: 'none', borderRadius: 8, cursor: submitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {submitting ? 'Adjusting...' : 'Adjust Stock'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

// -----------------------------
// Theme & Shared Utilities
// -----------------------------
const THEME = {
  primary: '#10b981',
  primaryDark: '#059669',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  grayText: '#6b7280',
};

// Shared card container style
const CARD_STYLE = {
  background: '#ffffff',
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
  overflow: 'hidden'
};

// Utility: format THB currency
const formatTHB = (n) => Number(n || 0).toLocaleString('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

// Small UI atoms for nicer cards
function ColorDot({ color = '#10b981' }) {
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: color, marginRight: 6 }} />
}

function Pill({ children, bg = '#f3f4f6', color = '#111827' }) {
  return (
    <span style={{
      background: bg,
      color,
      border: '1px solid rgba(17,24,39,0.06)',
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600
    }}>{children}</span>
  )
}

// Simple unified section header
function SectionHeader({ icon = null, title, right = null, color = '#6b7280' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <div style={{ fontSize: 14, color }}>{title}</div>
      </div>
      {right}
    </div>
  )
}

// Small inline icons (no external deps)
function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 11C18.2091 11 20 9.20914 20 7C20 4.79086 18.2091 3 16 3C13.7909 3 12 4.79086 12 7C12 9.20914 13.7909 11 16 11Z" stroke="#111827" strokeWidth="1.5"/>
      <path d="M8 13C10.2091 13 12 11.2091 12 9C12 6.79086 10.2091 5 8 5C5.79086 5 4 6.79086 4 9C4 11.2091 5.79086 13 8 13Z" stroke="#111827" strokeWidth="1.5"/>
      <path d="M2 21C2 17.6863 4.68629 15 8 15C11.3137 15 14 17.6863 14 21" stroke="#111827" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M15 21C15 18.2386 17.2386 16 20 16" stroke="#111827" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconInbox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7H21V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z" stroke="#111827" strokeWidth="1.5"/>
      <path d="M3 7L12 12L21 7" stroke="#111827" strokeWidth="1.5"/>
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12H7L10 4L14 20L17 12H21" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconList() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7H20" stroke="#111827" strokeWidth="1.5"/>
      <path d="M6 11H18" stroke="#111827" strokeWidth="1.5"/>
      <path d="M8 15H16" stroke="#111827" strokeWidth="1.5"/>
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3H21V21H3V3Z" stroke="#111827" strokeWidth="1.5"/>
      <path d="M8 9H16" stroke="#111827" strokeWidth="1.5"/>
      <path d="M8 13H16" stroke="#111827" strokeWidth="1.5"/>
    </svg>
  );
}

// --- (1) Component Card สรุปยอดขาย ---
function StatCard({ title, value, icon = '฿', bgColor = '#10b981' }) {
  const numeric = Number(value || 0);
  const formattedValue = numeric.toLocaleString('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  });

  const gradient = `linear-gradient(135deg, ${bgColor}, ${THEME.primaryDark})`;
  
  return (
    <div style={{
      background: gradient,
      color: 'white',
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: '0 10px 15px -3px rgba(16,185,129,0.25)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      minHeight: 140,
      height: '100%'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontSize: 13, letterSpacing: 0.3, fontWeight: 600, opacity: 0.9 }}>{title}</div>
        <div style={{ fontSize: 'clamp(20px,3.2vw,34px)', fontWeight: 900, lineHeight: 1 }}>{formattedValue}</div>
        {/* tiny spark bars */}
        <div style={{ height: 34, marginTop: 2, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          {[50, 80, 60, 90, 70, 40, 60].map((h, i) => (
            <div key={i} style={{ width: 6, height: `${h}%`, background: 'rgba(255,255,255,0.35)', borderRadius: 3 }}></div>
          ))}
        </div>
      </div>
      <span style={{
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.35)',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        alignSelf: 'flex-start'
      }}>{icon}</span>
    </div>
  )
}

// --- (1.5) Mini BarChart (no external lib) ---
function BarChart({ labels = [], values = [], loading = false, showValues = true }) {
  const max = Math.max(0, ...values);
  const safeMax = max <= 0 ? 1 : max;
  const barCount = values.length;
  const showEvery = Math.max(1, Math.ceil(barCount / 8));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 220, background: 'repeating-linear-gradient(to top, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 32px)', borderRadius: 8, padding: '0 4px' }}>
        {values.map((v, i) => {
          const h = Math.round((v / safeMax) * 100);
          const shouldShow = showValues && (barCount <= 12 || i % showEvery === 0);
          return (
            <div key={i} style={{ flex: 1, minWidth: 6, position: 'relative', display: 'flex', alignItems: 'flex-end', height: '100%' }}>
              {/* value label */}
              {shouldShow && (
                <span style={{
                  position: 'absolute',
                  bottom: `calc(${h}% + 4px)`,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.95)'
                }}>
                  {formatTHB(v)}
                </span>
              )}
              {/* bar */}
              <div title={`${labels[i] ?? ''}: ${formatTHB(v)}`}
                style={{
                  flex: 1,
                  minWidth: 6,
                  background: 'rgba(255,255,255,0.9)',
                  height: `${h}%`,
                  borderRadius: 6,
                  boxShadow: '0 6px 12px rgba(0,0,0,0.08)',
                  transition: 'height 220ms ease'
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Axis labels */}
      <div style={{ display: 'flex', gap: 6 }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, minWidth: 6, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.9)' }}>
            {i % showEvery === 0 ? l : ''}
          </div>
        ))}
      </div>
      {loading && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>Loading…</div>}
    </div>
  );
}

// --- (2) Component สินค้าขายดี ---
function PopularProductItem({ product }) {
  const isOutOfStock = product.stock <= 0;
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: 16,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <div style={{ fontWeight: 600 }}>{product.name || 'Unknown Product'}</div>
        <div style={{ fontSize: 14, color: isOutOfStock ? '#ef4444' : '#10b981', fontWeight: 500 }}>
          {isOutOfStock ? 'Out of stock' : 'In Stock'}
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: 16 }}>
        {Number(product.price || 0).toFixed(2)}
      </div>
    </div>
  )
}

// --- (3) Component สินค้าใกล้หมด ---
function LowStockItem({ item }) {
  const isCritical = item.stock <= 5;
  const statusColor = isCritical ? '#fee2e2' : '#fef9c3';
  const textColor = isCritical ? '#991b1b' : '#713f12';
  
  return (
    <div style={{
      background: '#ffffff',
      padding: '16px 20px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <div style={{ fontWeight: 600, color: '#111827' }}>{item.name}</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>
          Stock: {item.stock} {item.unit || 'units'} remaining
        </div>
      </div>
      <div style={{
        background: statusColor,
        color: textColor,
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 600
      }}>
        {isCritical ? 'Critical' : 'Low'}
      </div>
    </div>
  )
}


// --- (4) หน้า Dashboard หลัก ---
export default function Dashboard(){
  const API_BASE = import.meta.env.VITE_API_URL || '';
  const [salesSummary, setSalesSummary] = useState({ daily: 0, monthly: 0, yearly: 0 });
  const [popularProducts, setPopularProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [inventoryStats, setInventoryStats] = useState({ totalProducts: 0, lowStock: 0, outOfStock: 0, totalValue: 0 });
  const [staffStats, setStaffStats] = useState({
    totalUsers: 0,
    roles: { admin: 0, cashier: 0, warehouse: 0 },
    newUsersToday: 0,
    newUsersThisMonth: 0,
    salesCount: 0,
    refundsCount: 0,
    range: 'day',
    activeWithinShiftNow: 0,
  });
  const [activityRange, setActivityRange] = useState('day'); // day|week|month|year
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staffLoading, setStaffLoading] = useState(false);
  // Sales series for graph
  const [seriesRange, setSeriesRange] = useState('day'); // day|week|month|year
  const [series, setSeries] = useState({ labels: [], values: [] });
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState(null);

  // Load main blocks (summary, popular, lowstock) and keep on screen to avoid flicker
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryRes, popularRes, lowStockRes, invStatsRes] = await Promise.all([
          axios.get(`${API_BASE}/api/protect/reports/sales-summary`),
          axios.get(`${API_BASE}/api/protect/reports/popular-products`),
          axios.get(`${API_BASE}/api/protect/products/lowstock-robust`),
          axios.get(`${API_BASE}/api/protect/reports/stats`),
        ]);
        if (!mounted) return;
        setSalesSummary(summaryRes.data);
        setPopularProducts(popularRes.data);
        setLowStockProducts(lowStockRes.data);
        setInventoryStats(invStatsRes.data);
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.message || err.message);
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [API_BASE]);

  // Load lightweight staff activity separately on filter change (no full-page loading)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setStaffLoading(true);
      try {
        const staffRes = await axios.get(`${API_BASE}/api/protect/reports/staff-stats`, { params: { range: activityRange } });
        if (!mounted) return;
        setStaffStats(staffRes.data);
      } catch (staffErr) {
        if (!mounted) return;
        console.warn('staff-stats not available:', staffErr?.response?.status || staffErr?.message);
      } finally {
        if (!mounted) return;
        setStaffLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [API_BASE, activityRange]);

  // Card container style centralized at top-level: CARD_STYLE

  // โหลดข้อมูลกราฟยอดขายตามช่วงเวลา
  useEffect(() => {
    let mounted = true;
    (async () => {
      setSeriesLoading(true);
      setSeriesError(null);
      try {
        const res = await axios.get(`${API_BASE}/api/protect/reports/sales-series`, { params: { range: seriesRange } });
        if (!mounted) return;
        const labels = Array.isArray(res.data?.labels) ? res.data.labels : [];
        const values = Array.isArray(res.data?.values) ? res.data.values : [];
        setSeries({ labels, values });
      } catch (e) {
        if (!mounted) return;
        console.warn('sales-series not available:', e?.response?.status || e?.message);
        setSeries({ labels: [], values: [] });
        setSeriesError(e?.response?.data?.message || e?.message || 'Failed to load sales series');
      } finally {
        if (!mounted) return;
        setSeriesLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [API_BASE, seriesRange]);

  if (loading) {
    return <div style={{ padding: 'clamp(12px,2vw,24px)' }}>Loading dashboard...</div>
  }

  if (error) {
    return <div style={{ padding: 'clamp(12px,2vw,24px)', color: 'red' }}>Error loading dashboard: {error}</div>
  }

  return (
    <div style={{ padding: 'clamp(12px,2vw,24px)' }}>
      {/* --- แถวบนสุด: Stat Cards --- */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24
      }}>
  <StatCard title="รายวัน (Daily)" value={salesSummary.daily} icon="฿" bgColor="#10b981" />
  <StatCard title="รายเดือน (Monthly)" value={salesSummary.monthly} icon="฿" bgColor="#10b981" />
  <StatCard title="รายปี (Yearly)" value={salesSummary.yearly} icon="฿" bgColor="#10b981" />
      </div>

      {/* --- Staff Overview --- */}
      <div style={{
        marginTop: 24,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16
      }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <SectionHeader
            icon={<IconUsers />}
            title="Total Employees"
            right={<Pill bg="#ecfdf5" color="#065f46">Active Now: {staffStats.activeWithinShiftNow || 0}</Pill>}
          />

          {/* Total number */}
          <div style={{ fontSize: 'clamp(24px,3vw,40px)', fontWeight: 800, color: '#111827' }}>{staffStats.totalUsers}</div>

          {/* Segmented bar by role */}
          {(() => {
            const admin = Number(staffStats.roles?.admin || 0);
            const cashier = Number(staffStats.roles?.cashier || 0);
            const warehouse = Number(staffStats.roles?.warehouse || 0);
            const total = Math.max(1, admin + cashier + warehouse);
            const p = (n) => `${(n / total) * 100}%`;
            return (
              <div>
                <div style={{ display: 'flex', width: '100%', height: 8, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: p(admin), background: '#3b82f6' }} />
                  <div style={{ width: p(cashier), background: '#10b981' }} />
                  <div style={{ width: p(warehouse), background: '#f59e0b' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#374151' }}>
                    <ColorDot color="#3b82f6" /> Admin <Pill>{admin}</Pill>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#374151' }}>
                    <ColorDot color="#10b981" /> Cashier <Pill>{cashier}</Pill>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#374151' }}>
                    <ColorDot color="#f59e0b" /> Warehouse <Pill>{warehouse}</Pill>
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <SectionHeader
            icon={<IconInbox />}
            title="Inventory Overview"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 8 }}>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, border: '1px solid #eef2f7' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Total Products</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{inventoryStats.totalProducts}</div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, border: '1px solid #eef2f7' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Total Value</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{Number(inventoryStats.totalValue || 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 })}</div>
            </div>
            <div style={{ background: '#fff7ed', borderRadius: 8, padding: 12, border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: 12, color: '#9a3412' }}>Low Stock</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#9a3412' }}>{inventoryStats.lowStock}</div>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 12, color: '#991b1b' }}>Out of Stock</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#991b1b' }}>{inventoryStats.outOfStock}</div>
            </div>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <SectionHeader
            icon={<IconActivity />}
            title="Activity"
            right={(
              <div style={{ display: 'flex', gap: 6 }}>
              {['day','week','month','year'].map(r => (
                <button
                  key={r}
                  onClick={() => setActivityRange(r)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1px solid #e5e7eb',
                    background: activityRange === r ? '#10b981' : '#fff',
                    color: activityRange === r ? '#fff' : '#111',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >{r.toUpperCase()}</button>
              ))}
              </div>
            )}
          />

          {/* Segmented ratio bar: Sales vs Refunds */}
          {(() => {
            const sales = Number(staffStats.salesCount ?? staffStats.salesToday ?? 0);
            const refunds = Number(staffStats.refundsCount ?? staffStats.refundsToday ?? 0);
            const total = Math.max(1, sales + refunds);
            const p = (n) => `${(n / total) * 100}%`;
            return (
              <div>
                <div style={{ display: 'flex', width: '100%', height: 8, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: p(sales), background: '#10b981' }} />
                  <div style={{ width: p(refunds), background: '#ef4444' }} />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#374151' }}>
                    <ColorDot color="#10b981" /> Sales <Pill>{sales}</Pill>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#374151' }}>
                    <ColorDot color="#ef4444" /> Refunds <Pill>{refunds}</Pill>
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Metric tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
            <div style={{ background: '#f9fafb', border: '1px solid #eef2f7', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Sales</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#065f46' }}>{staffStats.salesCount ?? staffStats.salesToday ?? 0}</div>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#7f1d1d' }}>Refunds</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#991b1b' }}>{staffStats.refundsCount ?? staffStats.refundsToday ?? 0}</div>
            </div>
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#065f46' }}>On Shift Now</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#065f46' }}>{staffStats.activeWithinShiftNow}</div>
            </div>
          </div>

          {staffLoading && (
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>Updating…</div>
          )}
        </div>
      </div>

      {/* --- แถวกลาง: Graph และ Popular --- */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 24,
        marginTop: 24
      }}>
        
        {/* กราฟยอดขายตามช่วงเวลา */}
        <div style={{
          ...CARD_STYLE,
          background: '#10b981',
          color: 'white',
          minHeight: 320,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Sales Graph</h2>
            <div style={{ marginLeft: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.95)', fontWeight: 700 }}>
              Total: {formatTHB((series.values || []).reduce((a, b) => a + Number(b || 0), 0))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {['day','week','month','year'].map(r => (
                <button key={r}
                  onClick={() => setSeriesRange(r)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: seriesRange === r ? 'rgba(255,255,255,0.2)' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >{r.toUpperCase()}</button>
              ))}
              {seriesLoading && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>Updating…</span>
              )}
            </div>
          </div>
          {series.labels.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
              {seriesLoading ? 'Loading…' : (seriesError ? `Cannot load data: ${seriesError}` : 'No data available for this range.')}
            </div>
          ) : (
            <BarChart labels={series.labels} values={series.values} showValues={true} />
          )}
        </div>

        {/* สินค้าขายดี */}
        <div style={{ ...CARD_STYLE, padding: 24 }}>
          <SectionHeader
            icon={<IconList />}
            title="Popular Product"
            right={<Link to="/admin/products" style={{ fontSize: 13, color: '#10b981', textDecoration: 'none', fontWeight: 700 }}>See All</Link>}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {popularProducts.length > 0 ? (
              popularProducts.map(prod => <PopularProductItem key={prod._id} product={prod} />)
            ) : (
              <div style={{ color: '#6b7280' }}>No popular products found.</div>
            )}
          </div>
        </div>
      </div>

      {/* --- แถวล่าง: สินค้าใกล้หมด --- */}
  <div style={{ ...CARD_STYLE, marginTop: 24 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <SectionHeader
            icon={<IconDoc />}
            title="Products Running Out"
          />
        </div>
        <div>
          {lowStockProducts.length > 0 ? (
            lowStockProducts.map(item => <LowStockItem key={item._id} item={item} />)
          ) : (
            <div style={{ padding: 24, color: '#6b7280' }}>No products are running out.</div>
          )}
        </div>
      </div>
    </div>
  )
}
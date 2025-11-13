import React, { useState, useEffect } from "react";
import axios from "axios";
// logger removed; using console directly
import NavBar from "../../components/NavBar";
import TopBar from "../../components/TopBar";

// Inline API client for this page
const API_ROOT = import.meta.env.VITE_API_URL || "";
const api = axios.create({ baseURL: `${API_ROOT}/api/protect` });
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("api_token");
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization)
        config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    const url = error?.config?.url || "";
    if (status === 401 || status === 403) {
      try { localStorage.removeItem("api_token"); } catch {}
      if (code === "SHIFT_OUTSIDE") {
        try {
          if (url.includes("/api/auth/login")) {
            window.alert("ไม่สามารถเข้าสู่ระบบได้ เนื่องจากคุณอยู่นอกเวลางานแล้ว");
          } else {
            window.alert("คุณอยู่นอกเวลางานแล้ว ไม่สามารถใช้งานระบบได้");
            window.location.replace("/");
          }
        } catch {}
      }
    }
    return Promise.reject(error);
  }
);

export default function Refund() {
  const [searchTerm, setSearchTerm] = useState(""); // unified search
  const [searchResults, setSearchResults] = useState([]); // list of sale summaries
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]); // sale line items for refunding
  const [reason, setReason] = useState("");
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 900);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saleInfo, setSaleInfo] = useState(null); // full sale detail

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ ค้นหาใบเสร็จด้วย keyword เดียว (เลขใบเสร็จ / ชื่อสินค้า) -> แสดงรายการให้เลือก
  const handleLoadReceipt = async () => {
    if (!searchTerm.trim()) {
      alert("Please enter a search term (invoice no. or product name)");
      return;
    }
    setLoading(true);
    setSearchResults([]);
    try {
      // เรียก 3 รูปแบบเพื่อเพิ่มโอกาสค้นพบ
      const [byReceipt, byProduct, byQuery] = await Promise.all([
        api
          .get("/sales", { params: { receipt: searchTerm, limit: 20 } })
          .catch(() => ({ data: { rows: [] } })),
        api
          .get("/sales", { params: { product: searchTerm, limit: 20 } })
          .catch(() => ({ data: { rows: [] } })),
        api
          .get("/sales", { params: { query: searchTerm, limit: 20 } })
          .catch(() => ({ data: { rows: [] } })),
      ]);
      const merged = [
        ...(byReceipt.data.rows || []),
        ...(byProduct.data.rows || []),
        ...(byQuery.data.rows || []),
      ];
      const seen = new Set();
      const unique = merged.filter((s) => {
        if (!s || !s._id) return false;
        if (seen.has(s._id)) return false;
        seen.add(s._id);
        return true;
      });
      if (unique.length === 0) {
        alert("No results found for your query");
      }
      setSearchResults(unique);
    } catch (e) {
  console.error("Search error", e);
      alert("An error occurred while searching");
    } finally {
      setLoading(false);
    }
  };

  // ✅ เลือกใบเสร็จจากผลลัพธ์เพื่อโหลดรายการสินค้า
  const handleSelectSale = async (saleId) => {
    try {
      const full = await api.get(`/sales/${saleId}`);
  console.log("[Refund] Raw sale data loaded:", full.data);
      if (Array.isArray(full.data?.items)) {
  console.log("[Refund] Raw items:", full.data.items);
      }
      if (!full.data?.invoiceNo) {
        alert(
          "This sale has no invoice number (invoiceNo). Please fix the sale data first."
        );
      }
      setSaleInfo(full.data);
      setItems(
        (full.data.items || []).map((it, idx) => {
          // ปรับ logic ราคาให้ดึงข้อมูลที่มีอยู่จริงมากที่สุด รองรับข้อมูลเก่า
          const unitPrice = (() => {
            const candidates = [];
            // เดิม schema ใหม่
            candidates.push(it.unitPrice);
            if (it.lineTotal != null && it.qty) {
              candidates.push(Number(it.lineTotal) / Number(it.qty || 1));
            }
            // ฟิลด์ที่อาจเจอในข้อมูลเก่า
            candidates.push(it.price, it.total, it.amount, it.cost);
            // เลือกตัวแรกที่เป็นตัวเลข > 0 หรือ =0 ถ้าทุกตัวเป็น 0 แต่มีอย่างน้อยหนึ่งค่าเป็นตัวเลข
            for (const c of candidates) {
              if (c != null && !isNaN(c)) {
                return Number(c);
              }
            }
            return 0; // ไม่มีอะไรให้ใช้จริง ๆ
          })();
          const originalQty = Number(it.qty) || 0;
          return {
            id: idx + 1,
            name: it.name,
            originalQty,
            price: unitPrice,
            productId: it.productId || null,
            // เริ่มต้นให้ returnQty = originalQty (ลดได้แต่เพิ่มไม่ได้)
            returnQty: originalQty,
            checked: false,
          };
        })
      );
      // แจ้งเตือนกรณีทุกรายการมีราคา 0 (บอกให้ตรวจสอบข้อมูลต้นทาง)
      const allZero = (full.data.items || []).every((it) => {
        const hasAnyPriceField = [
          it.unitPrice,
          it.lineTotal,
          it.price,
          it.total,
          it.amount,
          it.cost,
        ].some((v) => v != null);
        const computed =
          it.unitPrice != null && !isNaN(it.unitPrice)
            ? Number(it.unitPrice)
            : it.lineTotal && it.qty
            ? Number(it.lineTotal) / Number(it.qty || 1)
            : it.price ?? it.total ?? it.amount ?? it.cost ?? 0;
        return hasAnyPriceField && Number(computed) === 0;
      });
      if (allZero && (full.data.items || []).length > 0) {
  console.warn("All item prices are 0; review sale data:", full.data);
        alert(
          "All item prices are 0 — likely legacy data without unitPrice/lineTotal. Please review or backfill prices in the database."
        );
      }
    } catch (e) {
  console.error(e);
      alert("Unable to load sale details");
    }
  };

  const handleQtyChange = (id, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              returnQty: (() => {
                const v = Number(value) || 0;
                if (v < 0) return 0;
                if (v > item.originalQty) return item.originalQty; // ห้ามมากกว่าจำนวนเดิม
                return v;
              })(),
            }
          : item
      )
    );
  };

  const totalRefund = items.reduce(
    (sum, item) => sum + (item.checked ? item.returnQty * item.price : 0),
    0
  );

  // ✅ กดปุ่ม Refund → บันทึกลง collection refunds
  const handleRefund = async () => {
    if (!saleInfo?._id) {
      alert("Please select a receipt first");
      return;
    }
    if (!saleInfo?.invoiceNo) {
      alert("Cannot refund: this receipt has no invoiceNo in database");
      return;
    }
    if (!reason) {
      alert("Please select a refund reason");
      return;
    }

    const selectedItems = items.filter(
      (item) => item.checked && item.returnQty > 0
    );
    if (selectedItems.length === 0) {
      alert("Please select items to refund");
      return;
    }

    const refundData = {
      saleId: saleInfo._id,
      invoiceNo: saleInfo.invoiceNo,
      items: selectedItems.map((i) => ({
        productId: i.productId,
        name: i.name,
        unitPrice: i.price,
        originalQty: i.originalQty,
        returnQty: i.returnQty,
        reason,
      })),
    };

    try {
      // Base URL includes /api/protect so use /refunds
      await api.post("/refunds", refundData);
      alert("Refund saved successfully!");
      // Reset only selection states; keep search results for more refunds on same search
      setItems([]);
      setSaleInfo(null);
      setReason("");
    } catch (err) {
  console.error(err);
      alert("Failed to save refund");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f7fbfa",
      }}
    >
      {!isNarrow && <NavBar mode="sales" />}
      <main
        style={{
          background: "#f7fbfa",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          // Offset to avoid overlapping fixed NavBar on wide screens
          marginLeft: isNarrow ? 0 : 220,
        }}
      >
        {/* TopBar */}
        <div
          style={{
            width: "100%",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            background: "#fff",
          }}
        >
          {isNarrow ? (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              ☰
            </button>
          ) : (
            <div style={{ width: 1 }} />
          )}
          <TopBar />
        </div>

        {isNarrow && menuOpen && (
          <div style={{ background: "#0f172a" }}>
            <NavBar horizontal mode="sales" />
          </div>
        )}

        {/* ส่วนเนื้อหา */}
        <div className="flex flex-col items-center py-10 px-4">
          {/* Search & Results */}
          <div className="bg-white border border-black rounded-xl p-6 w-full max-w-3xl mb-8 shadow-sm">
            <label className="block text-xl font-semibold mb-3">
              Search receipt / product name
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type invoice number or product name"
                className="flex-1 bg-gray-100 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              <button
                onClick={handleLoadReceipt}
                className="bg-emerald-400 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded-lg transition"
                disabled={loading}
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
            <div className="mt-4">
              {!loading && searchResults.length === 0 && (
                <div className="text-sm text-gray-500">No results yet</div>
              )}
              {loading && (
                <div className="text-sm text-gray-500">Searching...</div>
              )}
              {!loading && searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y max-h-64 overflow-auto">
                  {searchResults.map((s) => (
                    <div
                      key={s._id}
                      onClick={() => handleSelectSale(s._id)}
                      className={`px-4 py-2 cursor-pointer flex justify-between items-center hover:bg-gray-50 ${
                        saleInfo?._id === s._id ? "bg-emerald-50" : ""
                      }`}
                      title="Click to select this receipt"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {s.invoiceNo || "(ไม่มี invoice)"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(s.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-xs font-semibold">
                        ฿{Number(s.total || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Refund Section (Always Visible) */}
          <div className="bg-white border border-black rounded-xl p-6 w-full max-w-3xl shadow-sm">
            <h2 className="text-2xl font-semibold mb-5">
              Items{" "}
              {saleInfo
                ? `(${saleInfo.invoiceNo || "no invoice"})`
                : "(no receipt selected)"}
            </h2>
            {saleInfo && items.length === 0 && (
              <div className="text-sm text-gray-500">
                No items in this receipt
              </div>
            )}
            {saleInfo &&
              items.length > 0 &&
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-gray-100 rounded-lg p-4 mb-4"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() =>
                        setItems((prev) =>
                          prev.map((p) =>
                            p.id === item.id ? { ...p, checked: !p.checked } : p
                          )
                        )
                      }
                    />
                    <div>
                      <div className="font-semibold text-lg">{item.name}</div>
                      <div className="text-sm text-gray-500">
                        Original Qty: {item.originalQty} × ฿
                        {Number(item.price || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-gray-600">Return Qty:</div>
                    <input
                      type="number"
                      min="0"
                      max={item.originalQty}
                      step="1"
                      value={item.returnQty}
                      onChange={(e) => handleQtyChange(item.id, e.target.value)}
                      className="w-16 border border-gray-300 rounded-md text-center"
                    />
                    <div className="text-gray-700 font-medium">
                      ฿{Number(item.returnQty * item.price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            <div className="mt-6">
              <label className="block text-lg font-medium mb-2">
                Refund reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-gray-100 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-300"
              >
                <option value="">-- Please select reason --</option>
                <option value="Damaged item">Damaged item</option>
                <option value="Expired item">Expired item</option>
                <option value="Item mismatch with packaging">
                  Item mismatch with packaging
                </option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex justify-between items-center mt-8 text-lg font-semibold">
              <span>Total Refund Amount:</span>
              <span>฿{totalRefund.toFixed(2)}</span>
            </div>
            <button
              onClick={handleRefund}
              disabled={
                !saleInfo ||
                items.filter((i) => i.checked && i.returnQty > 0).length ===
                  0 ||
                !reason
              }
              className="w-full mt-6 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium text-lg transition"
            >
              Refund
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import axios from "axios";
// logger removed; using console directly
import Receipt from "../sales/Receipt";
import NavBar from "../../components/NavBar";
import TopBar from "../../components/TopBar";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export default function SalesHistory() {
  const [queryText, setQueryText] = useState("");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewSale, setViewSale] = useState(null);

  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 900);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit };
      if (queryText) params.query = queryText; // use 'query' to support multiple filters
      if (date) {
        params.from = date;
        params.to = date;
      }
      const res = await api.get("/sales", { params });
      setRows(res.data.rows || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || p);
    } catch (e) {
  console.error("fetchData error:", e);
      alert("Unable to fetch data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData(1);
  }, []);

  const handleSearch = () => fetchData(1);

  const openView = async (id) => {
    try {
      const res = await api.get(`/sales/${id}`);
      setViewSale(res.data);
    } catch (e) {
  console.error("openView error:", e);
      alert("ไม่พบรายละเอียด");
    }
  };

  const handleReprint = (sale) => {
    const w = window.open("", "_blank");
    const receiptHtml = renderReceiptHtml(sale);
    w.document.write(receiptHtml);
    w.document.close();
    w.print();
    w.close();
  };

  const handleDownloadPdf = (sale) => {
    if (!sale) return;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.text("Receipt", 14, 15);

    doc.setFontSize(12);
    doc.text(`Invoice No: ${sale.invoiceNo || "-"}`, 14, 24);
    doc.text(
      `Date: ${
        sale.createdAt ? new Date(sale.createdAt).toLocaleString("en-US") : "-"
      }`,
      14,
      31
    );
    const method = (sale.payment?.method || "-").toUpperCase();
    doc.text(`Payment Method: ${method}`, 14, 38);

    // Items table
    const body = (sale.items || []).map((it, idx) => [
      idx + 1,
      it.name || "-",
      Number(it.qty || 0),
      Number(it.unitPrice || 0).toFixed(2),
      (Number(it.unitPrice || 0) * Number(it.qty || 0)).toFixed(2),
    ]);

    const startY = 44;
    autoTable(doc, {
      startY,
      head: [["#", "Item", "Qty", "Price", "Total"]],
      body,
      styles: { fontSize: 11 },
      headStyles: { fillColor: [241, 245, 249], textColor: 0 },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    let y = (doc.lastAutoTable?.finalY || startY) + 8;

    // Totals
    const currency = "THB";
    doc.text(
      `Subtotal: ${Number(sale.subtotal ?? 0).toFixed(2)} ${currency}`,
      14,
      y
    );
    y += 6;
    doc.text(
      `Discount: ${Number(sale.discount ?? 0).toFixed(2)} ${currency}`,
      14,
      y
    );
    y += 6;
    // VAT is inclusive and hidden; keep consistent
    doc.text(`Total: ${Number(sale.total ?? 0).toFixed(2)} ${currency}`, 14, y);
    y += 10;

    // Payment details
    if (method === "CASH") {
      doc.text(
        `Amount Received: ${Number(sale.payment?.amountReceived ?? 0).toFixed(
          2
        )} ${currency}`,
        14,
        y
      );
      y += 6;
      doc.text(
        `Change: ${Number(sale.payment?.change ?? 0).toFixed(2)} ${currency}`,
        14,
        y
      );
      y += 6;
    } else if (method === "WALLET") {
      doc.text(
        `Wallet phone: ${sale.payment?.details?.walletPhone || "-"}`,
        14,
        y
      );
      y += 6;
    } else if (method === "CARD") {
      doc.text(
        `Card: **** **** **** ${sale.payment?.details?.cardLast4 || "XXXX"}`,
        14,
        y
      );
      y += 6;
    } else if (method === "QR") {
      doc.text(`QR Payment`, 14, y);
      y += 6;
    }

    y += 6;
    doc.text("Thank you!", 14, y);

    const filename = `receipt_${sale.invoiceNo || "no"}.pdf`;
    doc.save(filename);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!isNarrow && <NavBar mode="sales" />}
      <main
        style={{
          background: "#f7fbfa",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          // keep content clear of fixed NavBar
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

        {/* Search */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            padding: 16,
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <input
            type="text"
            placeholder="Search receipt no. or product name"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{
              flex: 1,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              background: "#10b981",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

        {/* Table */}
        <div style={{ padding: 16, flex: 1 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#fff",
              borderRadius: 6,
            }}
          >
            <thead style={{ background: "#f1f5f9" }}>
              <tr>
                <th style={{ padding: 12, textAlign: "left" }}>Receipt #</th>
                <th style={{ padding: 12, textAlign: "left" }}>Date / Time</th>
                <th style={{ padding: 12, textAlign: "left" }}>Payment</th>
                <th style={{ padding: 12, textAlign: "left" }}>Cashier</th>
                <th style={{ padding: 12, textAlign: "left" }}>Total</th>
                <th style={{ padding: 12 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24 }}>
                    No records
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 8 }}>{r.invoiceNo || "-"}</td>
                    <td style={{ padding: 8 }}>
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleString("en-US")
                        : "-"}
                    </td>
                    <td style={{ padding: 8 }}>
                      {(r.payment?.method || "-").toUpperCase()}
                    </td>
                    <td style={{ padding: 8 }}>{r.cashierName || "-"}</td>
                    <td style={{ padding: 8, textAlign: "left" }}>
                      {Number(r.total ?? 0).toFixed(2)} ฿
                    </td>
                    <td style={{ padding: 8 }}>
                      <button
                        onClick={() => openView(r._id)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 6,
                          background: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {viewSale && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "grid",
              placeItems: "center",
              zIndex: 1000,
              padding: 16,
            }}
            onClick={() => setViewSale(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff",
                borderRadius: 12,
                width: "min(480px, 92vw)",
                maxHeight: "90vh",
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              }}
            >
              <button
                onClick={() => setViewSale(null)}
                style={{
                  alignSelf: "flex-end",
                  border: "none",
                  background: "transparent",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ×
              </button>

              <h3 style={{ textAlign: "center" }}>Sale Receipt</h3>
              <p style={{ textAlign: "center", color: "#555" }}>
                Receipt #: {viewSale.invoiceNo || "-"}
              </p>
              <p style={{ textAlign: "center", color: "#555" }}>
                Date:{" "}
                {viewSale.createdAt
                  ? new Date(viewSale.createdAt).toLocaleString("en-US")
                  : "-"}
              </p>

              {/* ✅ ป้องกัน error กรณีไม่มี items */}
              <Receipt
                cart={(viewSale.items || []).map((it) => ({
                  productId: it.productId,
                  name: it.name,
                  qty: it.qty,
                  price: it.unitPrice,
                }))}
                subtotal={viewSale.subtotal || 0}
                discountValue={viewSale.discount || 0}
                vat={viewSale.vat || 0}
                total={viewSale.total || 0}
                paymentMethod={viewSale.payment?.method || "-"}
                payment={viewSale.payment || {}}
                change={viewSale.payment?.change || 0}
              />

              <div
                style={{ display: "flex", gap: 8, justifyContent: "center" }}
              >
                <button
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={() => handleReprint(viewSale)}
                >
                  Print
                </button>
                <button
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #3b82f6",
                    background: "#fff",
                    color: "#3b82f6",
                    cursor: "pointer",
                  }}
                  onClick={() => handleDownloadPdf(viewSale)}
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Helper: HTML สำหรับ print
function renderReceiptHtml(sale) {
  const lines = (sale.items || [])
    .map(
      (it) => `
      <tr>
        <td>${it.name}</td>
        <td style="text-align:right">${it.qty}</td>
        <td style="text-align:right">${Number(it.unitPrice).toFixed(2)}</td>
        <td style="text-align:right">${(Number(it.unitPrice) * it.qty).toFixed(
          2
        )}</td>
      </tr>`
    )
    .join("");

  const method = (sale.payment?.method || "").toUpperCase();
  const received = Number(sale.payment?.amountReceived ?? 0).toFixed(2);
  const change = Number(sale.payment?.change ?? 0).toFixed(2);
  const details = sale.payment?.details || {};
  let paymentHtml = `<p>Payment Method: ${method}</p>`;
  if (method === "CASH")
    paymentHtml += `<p>Received: ${received} ฿, Change: ${change} ฿</p>`;
  else if (method === "WALLET")
    paymentHtml += `<p>Wallet phone: ${details.walletPhone || "-"}</p>`;
  else if (method === "CARD")
    paymentHtml += `<p>Card: **** **** **** ${details.cardLast4 || "XXXX"}</p>`;
  else if (method === "QR") paymentHtml += `<p>QR Payment</p>`;

  return `
  <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt ${sale.invoiceNo || ""}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 12px; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { padding: 8px; border-bottom: 1px solid #eee; }
        th { background: #f1f5f9; }
        th.col-item { text-align: left; }
        th.col-qty, th.col-price, th.col-total { text-align: right; }
        td.col-qty, td.col-price, td.col-total { text-align: right; }
        td.col-item { text-align: left; }
        h3 { margin: 12px 0; }
        p { margin: 4px 0; }
        hr { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
      </style>
    </head>
    <body>
      <div>${
        sale.createdAt ? new Date(sale.createdAt).toLocaleString("en-US") : ""
      }</div>
      <h3>Invoice ${sale.invoiceNo || "-"}</h3>
      <table>
        <thead>
          <tr>
            <th class="col-item">Item</th>
            <th class="col-qty">Qty</th>
            <th class="col-price">Price</th>
            <th class="col-total">Total</th>
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <hr>
      <p>Subtotal: ${Number(sale.subtotal ?? 0).toFixed(2)} ฿</p>
      <p>Discount: ${Number(sale.discount ?? 0).toFixed(2)} ฿</p>
  <!-- VAT removed: prices are VAT-inclusive -->
      <h3>Total: ${Number(sale.total ?? 0).toFixed(2)} ฿</h3>
      ${paymentHtml}
      <hr>
      <p>Thank you!</p>
    </body>
  </html>
  `;
}

import React, { useState, useEffect, useRef } from "react";
import { api } from "../../axiosSetup";
import NavBar from "../../components/NavBar";
import TopBar from "../../components/TopBar";
import { logger } from "../../utils/logger";
import RefundReceipt from "./RefundReceipt";

export default function RefundHistory() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewRefund, setViewRefund] = useState(null);
  const [viewSale, setViewSale] = useState(null);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 900);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [date, setDate] = useState("");
  const printRef = useRef();

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit };

      if (searchText.trim()) params.search = searchText.trim();
      if (date) {
        const selected = new Date(date);
        const start = new Date(selected.setHours(0, 0, 0, 0));
        const end = new Date(selected.setHours(23, 59, 59, 999));
        params.startDate = start.toISOString();
        params.endDate = end.toISOString();
      }

      const res = await api.get("/refunds", { params });
      setRows(res.data.rows || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || p);
    } catch (err) {
      logger.error("fetchData error:", err);
      alert("ไม่สามารถดึงข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, []);

  const openView = async (id) => {
    try {
      const res = await api.get(`/refunds/${id}`);
      const refund = res.data;
      setViewRefund(refund);

      // fetch related sale to show original receipt details
      const saleId = refund?.saleId?._id || refund?.saleId;
      if (saleId) {
        try {
          const saleRes = await api.get(`/sales/${saleId}`);
          setViewSale(saleRes.data);
        } catch (e) {
          logger.warn("Could not fetch related sale", e);
          setViewSale(null);
        }
      } else {
        setViewSale(null);
      }
    } catch (err) {
      logger.error("openView error:", err);
      alert("ไม่พบรายละเอียด");
    }
  };

  // Print in new window (match sale receipt styling)
  const handlePrintRefund = () => {
    if (!viewRefund) return;
    const w = window.open("", "_blank");
    w.document.write(renderRefundReceiptHtml(viewRefund, viewSale));
    w.document.close();
    w.focus();
    w.print();
    w.close();
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
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
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
        </div>

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
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search receipt (invoiceNo)"
            style={{
              flex: 1,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
            onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
          />
          <button
            onClick={() => fetchData(1)}
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
              overflow: "hidden",
            }}
          >
            <thead style={{ background: "#f1f5f9" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 12 }}>Receipt #</th>
                <th style={{ textAlign: "left", padding: 12 }}>Refunded By</th>
                <th style={{ textAlign: "left", padding: 12 }}>Date / Time</th>
                <th style={{ textAlign: "left", padding: 12 }}>Total Refund</th>
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
                      {r.refundedBy?.name || r.refundedBy?.username || "-"}
                    </td>
                    <td style={{ padding: 8 }}>
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleString("th-TH")
                        : "-"}
                    </td>
                    <td style={{ padding: 8, textAlign: "left" }}>
                      {Number(r.totalRefund ?? 0).toFixed(2)} ฿
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
        {viewRefund && (
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
            onClick={() => setViewRefund(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff",
                borderRadius: 12,
                width: "min(500px, 92vw)",
                maxHeight: "90vh",
                overflowY: "auto",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              }}
            >
              <button
                onClick={() => setViewRefund(null)}
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

              <div ref={printRef}>
                <h3 style={{ textAlign: "center" }}>Refund Receipt</h3>
                <p style={{ textAlign: "center", color: "#555" }}>
                  Receipt #: {viewRefund.invoiceNo}
                </p>
                <p style={{ textAlign: "center", color: "#555" }}>
                  Date: {new Date(viewRefund.createdAt).toLocaleString("en-US")}
                </p>

                {/* Unified refund receipt card (already styled like sales) */}
                <RefundReceipt refund={viewRefund} sale={viewSale} />
              </div>

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
                  onClick={handlePrintRefund}
                >
                  Print
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Helper: render refund receipt HTML for browser print (similar to sales style)
function renderRefundReceiptHtml(refund, sale) {
  const lines = (refund.items || [])
    .map(
      (it) => `
      <tr>
        <td>${it.name}</td>
        <td style="text-align:center">${it.returnQty}</td>
        <td>${it.reason || "-"}</td>
        <td style="text-align:right">${(
          Number(it.unitPrice || 0) * (it.returnQty || 0)
        ).toFixed(2)} ฿</td>
      </tr>`
    )
    .join("");

  const saleInfoHtml = sale
    ? `
      <div style="margin-top:6px; font-size:13px;">
        <div>Sale Date: ${
          sale.createdAt
            ? new Date(sale.createdAt).toLocaleString("en-US")
            : "-"
        }</div>
        <div>Payment: ${(sale.payment?.method || "-").toUpperCase()}</div>
        <div>Total (sale): ${Number(sale.total ?? 0).toFixed(2)} ฿</div>
        ${sale.cashierName ? `<div>Cashier: ${sale.cashierName}</div>` : ""}
      </div>
    `
    : "";

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Refund ${refund.invoiceNo || ""}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 12px; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { padding: 8px; border-bottom: 1px solid #eee; }
        th { background: #f1f5f9; }
        th.col-item { text-align: left; }
        th.col-qty { text-align: center; }
        th.col-total { text-align: right; }
        th.col-reason { text-align: left; }
        td.col-item { text-align: left; }
        td.col-qty { text-align: center; }
        td.col-total { text-align: right; }
        td.col-reason { text-align: left; }
        h3 { margin: 12px 0; }
        p { margin: 4px 0; }
        hr { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
      </style>
    </head>
    <body>
      <div>Refund Date: ${
        refund.createdAt
          ? new Date(refund.createdAt).toLocaleString("en-US")
          : "-"
      }</div>
      <h3>Invoice ${refund.invoiceNo || "-"}</h3>
      ${saleInfoHtml}
      <hr />
      <h4>Refund Details</h4>
      <table>
        <thead>
          <tr>
            <th class="col-item">Item</th>
            <th class="col-qty">Qty</th>
            <th class="col-reason">Reason</th>
            <th class="col-total">Refund</th>
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <hr />
      <p><strong>Total Refund:</strong> ${Number(
        refund.totalRefund ?? 0
      ).toFixed(2)} ฿</p>
      <hr />
      <p>Thank you!</p>
    </body>
  </html>`;
}

import React from "react";

export default function RefundReceipt({ refund, sale }) {
  if (!refund) return null;

  const { invoiceNo, refundedBy, createdAt, items = [], totalRefund } = refund;

  return (
    <div
      style={{
        width: 320,
        background: "#fff",
        color: "#000",
        fontFamily: "monospace",
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: 8,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Refund Receipt</h2>
        <small style={{ color: "#555" }}>Processed return</small>
      </div>

      <div style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>
        {invoiceNo && <div>Refund Invoice: {invoiceNo}</div>}
        {createdAt && (
          <div>Refund Date: {new Date(createdAt).toLocaleString("en-US")}</div>
        )}
        {refundedBy && (
          <div>
            Processed By:{" "}
            {refundedBy.name || refundedBy.username || refundedBy._id}
          </div>
        )}
        {sale && (
          <>
            <div style={{ marginTop: 6, fontWeight: "bold" }}>
              Original Sale
            </div>
            <div>Sale Invoice: {sale.invoiceNo}</div>
            <div>
              Sale Date:{" "}
              {sale.createdAt
                ? new Date(sale.createdAt).toLocaleString("en-US")
                : "-"}
            </div>
            <div>Payment: {(sale.payment?.method || "-").toUpperCase()}</div>
            <div>Total: {Number(sale.total ?? 0).toFixed(2)} ฿</div>
            {sale.cashierName && <div>Cashier: {sale.cashierName}</div>}
          </>
        )}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          marginTop: 10,
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px dashed #999" }}>
            <th align="left">Item</th>
            <th align="center">Qty</th>
            <th align="left">Reason</th>
            <th align="right">Refund</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td>{it.name}</td>
              <td align="center">{it.returnQty}</td>
              <td>{it.reason || "-"}</td>
              <td align="right">
                {(it.unitPrice * it.returnQty).toFixed(2)} ฿
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr
        style={{
          border: "none",
          borderTop: "1px dashed #aaa",
          margin: "8px 0",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: "bold",
          fontSize: 13,
        }}
      >
        <span>Total Refund:</span>
        <span>{Number(totalRefund).toFixed(2)} ฿</span>
      </div>
      <hr
        style={{
          border: "none",
          borderTop: "1px dashed #aaa",
          margin: "10px 0",
        }}
      />
      <div style={{ textAlign: "center", fontSize: 11, color: "#777" }}>
        <p style={{ margin: 0 }}>*** Thank you ***</p>
        <p style={{ margin: 0 }}>Refund processed successfully.</p>
      </div>
    </div>
  );
}

import React, { forwardRef } from "react";

const Receipt = forwardRef(
  (
    {
      cart = [],
      subtotal = 0,
      discountValue = 0,
      vat = 0,
      total = 0,
      paymentMethod = "",
      payment = {},
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        style={{
          width: 320,
          background: "#fff",
          color: "#000",
          fontFamily: "monospace",
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Receipt</h2>
          <small style={{ color: "#555" }}>Thank you for your purchase!</small>
        </div>

        {/* Invoice info */}
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          {payment.invoiceNo && <div>Invoice No: {payment.invoiceNo}</div>}
          {payment.createdAt && (
            <div>
              Date: {new Date(payment.createdAt).toLocaleString("en-US")}
            </div>
          )}
          {payment.cashierName && <div>Cashier: {payment.cashierName}</div>}
        </div>

        {/* Product table */}
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
              <th align="right">Price</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item, idx) => (
              <tr key={idx}>
                <td>{item.name}</td>
                <td align="center">{item.qty}</td>
                <td align="right">
                  {(item.unitPrice ?? item.price ?? 0).toFixed(2)}
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

        {/* Summary */}
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal:</span>
            <span>{subtotal.toFixed(2)} ฿</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Discount:</span>
            <span>- {(Number(discountValue) || 0).toFixed(2)} ฿</span>
          </div>
          {/* VAT row removed (prices are VAT-inclusive) */}
          <hr
            style={{
              border: "none",
              borderTop: "1px dashed #aaa",
              margin: "6px 0",
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
            <span>Total:</span>
            <span>{total.toFixed(2)} ฿</span>
          </div>
        </div>

        <hr
          style={{
            border: "none",
            borderTop: "1px dashed #aaa",
            margin: "8px 0",
          }}
        />

        {/* Payment Info */}
        <div style={{ fontSize: 12 }}>
          <div>Payment Method: {paymentMethod.toUpperCase()}</div>

          {paymentMethod === "cash" && (
            <>
              <div>Amount Received: {payment.amountReceived?.toFixed(2)} ฿</div>
              <div>Change: {payment.change?.toFixed(2)} ฿</div>
            </>
          )}
          {paymentMethod === "wallet" && (
            <div>Wallet Phone: {payment.details?.walletPhone || "-"}</div>
          )}
          {paymentMethod === "card" && (
            <div>
              Card: **** **** **** {payment.details?.cardLast4 || "----"}
            </div>
          )}
          {paymentMethod === "qr" && (
            <div>QR Ref: {payment.details?.qrRef || "N/A"}</div>
          )}
        </div>

        <hr
          style={{
            border: "none",
            borderTop: "1px dashed #aaa",
            margin: "10px 0",
          }}
        />

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 11, color: "#777" }}>
          <p style={{ margin: 0 }}>*** Thank you for your business ***</p>
          <p style={{ margin: 0 }}>Please check your items before leaving.</p>
        </div>
      </div>
    );
  }
);

export default Receipt;

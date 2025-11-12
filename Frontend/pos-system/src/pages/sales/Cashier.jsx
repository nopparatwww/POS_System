import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../../axiosSetup";
import { logger } from "../../utils/logger";
import NavBar from "../../components/NavBar";
import TopBar from "../../components/TopBar";
import Receipt from "../sales/Receipt";
import { Outlet } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// Stripe
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Initialize Stripe (publishable key from Vite env)
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""
);
// Toggle: use server-side webhook to finalize PromptPay sale
const USE_STRIPE_WEBHOOK = true;

function CashierInner() {
  // Stripe hooks (available because component is wrapped by <Elements>)
  const stripe = useStripe();
  const elements = useElements();
  const [lastReceiptData, setLastReceiptData] = useState(null);
  // ===== STATE =====
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 900);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [discounts, setDiscounts] = useState([
    { _id: "1", name: "10% Off", type: "percent", value: 10 },
    { _id: "2", name: "50฿ Off", type: "fixed", value: 50 },
  ]);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showQR, setShowQR] = useState(false);
  // PromptPay (Stripe) state
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [qrIntentId, setQrIntentId] = useState("");
  const pollTimerRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountReceived, setAmountReceived] = useState(0);
  const [walletPhone, setWalletPhone] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const receiptRef = useRef();

  // ===== HANDLE RESIZE =====
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  // Cleanup polling when unmounting
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  // ===== CALCULATIONS =====
  const subtotal = cart.reduce((acc, i) => acc + i.price * i.qty, 0);
  const discountValue =
    selectedDiscount?.type === "percent"
      ? (subtotal * selectedDiscount.value) / 100
      : selectedDiscount?.type === "fixed"
      ? selectedDiscount.value
      : 0;
  // VAT-inclusive pricing: treat product prices as already inclusive
  const vat = 0;
  const total = subtotal - discountValue;
  const change = Number(amountReceived || 0) - total;

  // ===== HELPERS =====
  const safeToFixed = (num) => Number(num || 0).toFixed(2);
  const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
  // removed stock helpers per request

  // ===== CART HANDLERS =====
  const addToCart = (product) => {
    setCart((prev) => {
      const exist = prev.find((p) => p.productId === product._id);
      if (exist) {
        const nextQty = exist.qty + 1;
        if (isFiniteNumber(exist.stock) && nextQty > exist.stock) {
          alert(`Insufficient stock (remaining ${exist.stock})`);
          return prev;
        }
        return prev.map((p) =>
          p.productId === product._id ? { ...p, qty: nextQty } : p
        );
      }
      if (isFiniteNumber(product.stock) && product.stock < 1) {
        alert("Item is out of stock");
        return prev;
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          qty: 1,
        },
      ];
    });
  };

  const increaseQty = (id) => {
    setCart((prev) =>
      prev.map((p) => {
        if (p.productId !== id) return p;
        const next = p.qty + 1;
        if (isFiniteNumber(p.stock) && next > p.stock) {
          alert(`Insufficient stock (remaining ${p.stock})`);
          return p;
        }
        return { ...p, qty: next };
      })
    );
  };

  const decreaseQty = (id) => {
    setCart((prev) =>
      prev.map((p) =>
        p.productId === id ? { ...p, qty: Math.max(1, p.qty - 1) } : p
      )
    );
  };

  const removeItem = (id) =>
    setCart((prev) => prev.filter((p) => p.productId !== id));

  // ===== SEARCH =====
  const handleSearch = async () => {
    try {
      const response = await api.get("/products", {
        params: { search: searchTerm },
      });
      setSearchResults(response.data);
    } catch (err) {
      logger.error("Failed to fetch products:", err);
    }
  };
  // ===== PAYMENT HANDLERS =====
  const buildSalePayload = useCallback(
    () => ({
      items: cart.map((item) => ({
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        unitPrice: item.price,
      })),
      subtotal,
      discount: discountValue,
      vat,
      total,
    }),
    [cart, subtotal, discountValue, vat, total]
  );

  const createSaleAfterPayment = useCallback(
    async (payment) => {
      const payload = {
        ...buildSalePayload(),
        payment,
      };
      const res = await api.post("/sales", payload);
      const sale = res.data?.sale || {};
      const merged = {
        ...sale,
        payment: {
          ...sale.payment,
          invoiceNo: res.data?.invoiceNo || sale.invoiceNo || "",
          createdAt: sale.createdAt,
          cashierName: sale.cashierName,
        },
      };
      setLastReceiptData(merged);
      setShowReceiptModal(true);
      setCart([]);
      setAmountReceived(0);
      setWalletPhone("");
      return merged;
    },
    [buildSalePayload]
  );

  const startPromptPayFlow = useCallback(async () => {
    setIsProcessing(true);
    setQrImageUrl("");
    setQrStatus("creating_intent");
    setQrIntentId("");
    try {
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Total amount must be greater than 0 for PromptPay");
      }
      if (total < 10) {
        throw new Error("PromptPay requires a minimum of THB 10.00");
      }
      logger.log("[PromptPay] create intent", {
        total: Number(total.toFixed(2)),
      });
      const intentRes = await api.post("/payments/promptpay-intent", {
        total: Number(total.toFixed(2)),
        metadata: { source: "pos-cashier" },
        draft: buildSalePayload(),
      });
      const { clientSecret, paymentIntentId } = intentRes.data || {};
      if (!clientSecret) throw new Error("Missing clientSecret");
      setQrIntentId(paymentIntentId || "");

      const stripeClient = stripe || (await stripePromise);
      if (!stripeClient) throw new Error("Stripe not ready");
      const result = await stripeClient.confirmPromptPayPayment(clientSecret, {
        payment_method: {
          billing_details: {
            name: "POS Customer",
            email: "walkin@example.com", // PromptPay requires billing_details.email
          },
        },
      });
      if (result.error)
        throw new Error(result.error.message || "PromptPay confirm error");
      const pi = result.paymentIntent;
      setQrStatus(pi?.status || "requires_action");

      const na = pi?.next_action || {};
      const guessImageUrl =
        na?.promptpay_display_qr_code?.image_data_url ||
        na?.display_qr_code?.image_data_url ||
        na?.display_qr_code?.png ||
        na?.qr_code?.image_url ||
        "";
      if (guessImageUrl) setQrImageUrl(guessImageUrl);
      setShowQR(true);

      // start polling
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const s = await api.get(`/payments/intent/${paymentIntentId}`);
          const status = s.data?.status;
          setQrStatus(status || "");
          logger.log("[PromptPay poll]", { status });
          if (status === "succeeded" || status === "processing") {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            if (!USE_STRIPE_WEBHOOK) {
              setIsProcessing(false);
              await createSaleAfterPayment({
                method: "qr",
                amountReceived: total,
                change: 0,
                details: { paymentIntentId },
              });
            } else {
              // Webhook mode: wait for server to create sale and then fetch it
              const started = Date.now();
              const timeoutMs = 60000; // 60s
              const salePoll = setInterval(async () => {
                try {
                  const r = await api.get(
                    `/sales/by-intent/${paymentIntentId}`
                  );
                  if (r && r.data) {
                    clearInterval(salePoll);
                    setIsProcessing(false);
                    setLastReceiptData({ ...r.data });
                    setShowReceiptModal(true);
                  } else if (Date.now() - started > timeoutMs) {
                    clearInterval(salePoll);
                    setIsProcessing(false);
                    alert(
                      "Payment succeeded but receipt not ready yet. Please check Sales History."
                    );
                  }
                } catch (e) {
                  if (e?.response?.status === 404) {
                    if (Date.now() - started > timeoutMs) {
                      clearInterval(salePoll);
                      setIsProcessing(false);
                      alert(
                        "Payment succeeded but receipt not ready yet. Please check Sales History."
                      );
                    }
                  } else {
                    logger.error("Sale lookup error:", e);
                  }
                }
              }, 2000);
            }
          } else if (
            [
              "requires_payment_method",
              "canceled",
              "requires_capture",
            ].includes(status)
          ) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setIsProcessing(false);
            alert(`Payment failed or canceled (${status})`);
          }
        } catch (pollErr) {
          logger.error("PromptPay poll error:", pollErr);
        }
      }, 2000);
    } catch (err) {
      const data = err?.response?.data || {};
      const msg = data?.message || err?.message || "PromptPay error";
      const detail = data?.error ? `\nDetail: ${data.error}` : "";
      const code = data?.code ? `\nCode: ${data.code}` : "";
      const type = data?.type ? `\nType: ${data.type}` : "";
      logger.error("PromptPay flow error:", err);
      alert(msg + detail + code + type);
      setIsProcessing(false);
    }
  }, [stripe, total, createSaleAfterPayment]);

  const startCardFlow = useCallback(async () => {
    setIsProcessing(true);
    try {
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Total amount must be greater than 0 for Card payment");
      }
      if (!elements) throw new Error("Stripe Elements not ready");
      const card = elements.getElement(CardElement);
      if (!card) throw new Error("CardElement not found");

      // 1) Create card PaymentIntent
      logger.log("[Card] create intent", { total: Number(total.toFixed(2)) });
      const intentRes = await api.post("/payments/card-intent", {
        total: Number(total.toFixed(2)),
        metadata: { source: "pos-cashier" },
        draft: buildSalePayload(),
      });
      const { clientSecret, paymentIntentId } = intentRes.data || {};
      if (!clientSecret) throw new Error("Missing clientSecret");

      // 2) Confirm with card details
      const stripeClient = stripe || (await stripePromise);
      if (!stripeClient) throw new Error("Stripe not ready");
      const result = await stripeClient.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (result.error) throw new Error(result.error.message);
      const pi = result.paymentIntent;
      if (pi?.status !== "succeeded") {
        throw new Error(`Card payment not successful (${pi?.status})`);
      }

      // 3) Create sale
      await createSaleAfterPayment({
        method: "card",
        amountReceived: total,
        change: 0,
        details: { paymentIntentId: paymentIntentId },
      });
      setIsProcessing(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || "Card payment error";
      logger.error("Card flow error:", err);
      alert(msg);
      setIsProcessing(false);
    }
  }, [elements, stripe, total, createSaleAfterPayment]);

  const handleCheckout = async () => {
    try {
      if (cart.length === 0) {
        alert("Cart is empty");
        return;
      }
      // guard ป้องกันเกินสต็อกจากฝั่ง client
      const over = cart.find(
        (i) => isFiniteNumber(i.stock) && Number(i.qty) > Number(i.stock)
      );
      if (over) {
        alert(`Insufficient stock (remaining ${over.stock})`);
        return;
      }
      // Route by payment method
      if (paymentMethod === "qr") {
        await startPromptPayFlow();
        return;
      }
      if (paymentMethod === "card") {
        await startCardFlow();
        return;
      }

      // Immediate methods (cash / wallet)
      const payment = {
        method: paymentMethod,
        amountReceived:
          paymentMethod === "cash" ? Number(amountReceived) || total : total,
        change:
          paymentMethod === "cash"
            ? Math.max((Number(amountReceived) || total) - total, 0)
            : 0,
        details: paymentMethod === "wallet" ? { walletPhone } : {},
      };
      await createSaleAfterPayment(payment);
      alert("Checkout success!");
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || "";
      logger.error("Checkout failed:", status, msg, err?.response?.data);
      logger.log("[Cashier] last payload:", {
        cart,
        paymentMethod,
        amountReceived,
      });
      alert(`Checkout failed (${status || ""}): ${msg || "Unknown error"}`);
    }
  };

  // ===== FETCH DISCOUNTS =====
  useEffect(() => {
    const fetchDiscounts = async () => {
      try {
        const res = await api.get("/discounts"); // fetch from DB
        setDiscounts(res.data);
      } catch (err) {
        logger.error("Failed to fetch discounts:", err);
      }
    };
    fetchDiscounts();
  }, []);

  const handlePrintPDF = async () => {
    if (!lastReceiptData) {
      alert("No receipt data yet");
      return;
    }

    const doc = new jsPDF();

    doc.addFileToVFS("THSarabunNew.ttf", THSarabunNew);
    doc.addFont("THSarabunNew.ttf", "THSarabunNew", "normal");
    doc.setFont("THSarabunNew", "normal");

    doc.setFontSize(16);
    doc.text("Receipt", 14, 15);

    doc.setFontSize(12);
    doc.text(
      `Invoice No: ${
        lastReceiptData?.payment?.invoiceNo || lastReceiptData?.invoiceNo || "-"
      }`,
      14,
      25
    );
    doc.text(`Date: ${new Date().toLocaleString("en-US")}`, 14, 32);
    doc.text(
      `Payment Method: ${lastReceiptData?.payment?.method || "-"}`,
      14,
      39
    );

    // ตารางสินค้า: ใช้ html snapshot เพื่อรักษาฟอนต์ไทยให้ถูกต้องมากขึ้น
    // สร้าง HTML ชั่วคราวสำหรับแสดงรายการ
    const tableHtml = `
      <div style="font-family: THSarabunNew, sans-serif; font-size: 12px;">
        <table style="width:100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align:left; border-bottom:1px dashed #999;">#</th>
              <th style="text-align:left; border-bottom:1px dashed #999;">Item</th>
              <th style="text-align:center; border-bottom:1px dashed #999;">Qty</th>
              <th style="text-align:right; border-bottom:1px dashed #999;">Unit Price</th>
              <th style="text-align:right; border-bottom:1px dashed #999;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lastReceiptData.items
              .map(
                (item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.name || "-"}</td>
                  <td style="text-align:center;">${item.qty || 0}</td>
                  <td style="text-align:right;">${(item.unitPrice || 0).toFixed(
                    2
                  )}</td>
                  <td style="text-align:right;">${(
                    (item.qty || 0) * (item.unitPrice || 0)
                  ).toFixed(2)}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

    let finalY = 50;
    try {
      await doc.html(tableHtml, {
        x: 14,
        y: 48,
        width: 180,
        windowWidth: 600,
        callback: function (docRef) {
          // หลังจาก render html เสร็จ ใช้ตำแหน่ง Y ปัจจุบันเป็นฐานสำหรับสรุปผล
          finalY =
            docRef.lastAutoTable?.finalY || docRef.internal?.pageSize?.height
              ? 48 + 6 * (lastReceiptData.items.length + 2)
              : 60;
        },
      });
      // เผื่อกรณีไม่มี lastAutoTable ให้ประมาณตำแหน่งสรุปเองแบบง่าย
      if (!finalY || Number.isNaN(finalY)) finalY = 120;
    } catch (err) {
      // ถ้า html render ไม่สำเร็จ ให้ fallback ไปใช้ autotable แบบเดิม
      try {
        const tableData = lastReceiptData.items.map((item, index) => [
          index + 1,
          item.name || "-",
          item.qty || 0,
          (item.unitPrice || 0).toFixed(2),
          ((item.qty || 0) * (item.unitPrice || 0)).toFixed(2),
        ]);
        const tableResult = autoTable(doc, {
          startY: 48,
          head: [["#", "Item", "Qty", "Unit Price", "Total"]],
          body: tableData,
          styles: { font: "THSarabunNew", fontStyle: "normal", fontSize: 12 },
          headStyles: { font: "THSarabunNew", fontStyle: "normal" },
          bodyStyles: { font: "THSarabunNew", fontStyle: "normal" },
        });
        finalY = (tableResult?.lastAutoTable?.finalY || 50) + 10;
      } catch (e2) {
        logger.error(
          "PDF table render failed (both html and autotable)",
          err,
          e2
        );
        finalY = 60;
      }
    }
    doc.text(`Subtotal: ${lastReceiptData.subtotal.toFixed(2)} ฿`, 14, finalY);
    doc.text(
      `Discount: ${lastReceiptData.discount.toFixed(2)} ฿`,
      14,
      finalY + 7
    );
    doc.text(`Total: ${lastReceiptData.total.toFixed(2)} ฿`, 14, finalY + 14);

    if (lastReceiptData?.payment?.method === "cash") {
      doc.text(
        `Amount Received: ${lastReceiptData.payment.amountReceived.toFixed(
          2
        )} ฿`,
        14,
        finalY + 28
      );
      doc.text(
        `Change: ${lastReceiptData.payment.change.toFixed(2)} ฿`,
        14,
        finalY + 35
      );
    } else if (lastReceiptData?.payment?.method === "wallet") {
      doc.text(
        `Wallet Phone: ${lastReceiptData.payment.details?.walletPhone || "-"}`,
        14,
        finalY + 28
      );
    }

    doc.text("Thank you!", 14, finalY + 50);

    doc.save(`receipt_${lastReceiptData?.payment?.invoiceNo || "no"}.pdf`);
  };

  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptRef, // ✅ ใช้ prop นี้แทน content()
    documentTitle: "Receipt",
    onAfterPrint: () => setShowReceiptModal(false),
  });
  const handleEmailMock = () => alert("Send Email (mock)");

  // ===== JSX =====
  return (
    <div className="cashier-page">
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sidebar */}
        {!isNarrow && <NavBar mode="sales" />}

        <main
          style={{
            background: "#f7fbfa",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
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
              padding: "0 16px",
              borderBottom: "1px solid #e5e7eb",
              background: "#fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              zIndex: 10,
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
                  fontSize: 18,
                  cursor: "pointer",
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

          {/* Search Row */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "16px",
              background: "#fff",
              borderBottom: "1px solid #e5e7eb",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Search product / Barcode"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ccc",
                fontSize: 14,
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                background: "#10b981",
                color: "#fff",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Search
            </button>
          </div>

          {/* Main Area */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "2fr 1fr",
              gap: 12,
              padding: 16,
            }}
          >
            {/* LEFT PANEL: Cart */}
            <div
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: 16,
                boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h2 style={{ marginBottom: 12 }}>Cart</h2>
              <div style={{ flex: 1 }}>
                {/* Cart Table Header */}
                <div
                  style={{
                    display: "flex",
                    fontWeight: 600,
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: 8,
                  }}
                >
                  <div style={{ flex: 2 }}>Item Name</div>
                  <div style={{ flex: 1 }}>Qty</div>
                  <div style={{ flex: 1 }}>Price</div>
                  <div style={{ flex: 1 }}>Total</div>
                  <div style={{ width: 50 }}></div>
                </div>

                {/* Cart Items */}
                {cart.map((i) => (
                  <div
                    key={i.productId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid #f1f1f1",
                    }}
                  >
                    <div style={{ flex: 2 }}>{i.name}</div>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <button
                        onClick={() => decreaseQty(i.productId)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: "1px solid #ccc",
                          cursor: "pointer",
                        }}
                      >
                        -
                      </button>
                      <span>{i.qty}</span>
                      <button
                        onClick={() => increaseQty(i.productId)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: "1px solid #ccc",
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div style={{ flex: 1 }}>{safeToFixed(i.price)} ฿</div>
                    <div style={{ flex: 1 }}>
                      {safeToFixed(i.price * i.qty)} ฿
                    </div>
                    <div style={{ width: 50 }}>
                      <button
                        onClick={() => removeItem(i.productId)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "red",
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(120px,1fr))",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    {searchResults.map((p) => (
                      <div
                        key={p._id}
                        onClick={() => addToCart(p)}
                        style={{
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                          cursor: "pointer",
                          background: "#f9fafb",
                          textAlign: "center",
                          fontSize: 14,
                        }}
                      >
                        <div>{p.name}</div>
                        <div>{safeToFixed(p.price)} ฿</div>
                        {isFiniteNumber(p.stock) && (
                          <div style={{ color: "#555", fontSize: 12 }}>
                            Stock: {p.stock}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: Invoice & Payment */}
            <div
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: 16,
                boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                position: "relative",
              }}
            >
              <h3>Invoice Summary</h3>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                Subtotal: <strong>{subtotal.toFixed(2)} ฿</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                Discount:
                <select
                  value={selectedDiscount?._id || ""}
                  onChange={(e) =>
                    setSelectedDiscount(
                      discounts.find((d) => d._id === e.target.value)
                    )
                  }
                  style={{ padding: "4px 8px", borderRadius: 4 }}
                >
                  <option value="">No Discount</option>
                  {discounts.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}{" "}
                      {d.type === "percent" ? `(${d.value}%)` : `(${d.value}฿)`}
                    </option>
                  ))}
                </select>
              </div>
              {/* VAT removed (prices are VAT-inclusive) */}
              <hr />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                Total: <strong>{total.toFixed(2)} ฿</strong>
              </div>
              <hr />

              {/* Payment Methods */}
              <div style={{ display: "flex", gap: 8 }}>
                {["cash", "qr", "card", "wallet"].map((method) => (
                  <button
                    key={method}
                    onClick={() => {
                      setPaymentMethod(method);
                      setShowQR(method === "qr");
                      if (method !== "qr") {
                        setQrImageUrl("");
                        setQrStatus("");
                        setQrIntentId("");
                        if (pollTimerRef.current) {
                          clearInterval(pollTimerRef.current);
                          pollTimerRef.current = null;
                        }
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      background:
                        paymentMethod === method ? "#10b981" : "#f9fafb",
                      color: paymentMethod === method ? "#fff" : "#111",
                      cursor: "pointer",
                    }}
                  >
                    {method.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Payment Inputs */}
              {paymentMethod === "cash" && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <label>Amount received</label>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    style={{
                      padding: 6,
                      borderRadius: 4,
                      border: "1px solid #ccc",
                    }}
                  />
                  <div>
                    Change: <strong>{change.toFixed(2)} ฿</strong>
                  </div>
                </div>
              )}

              {paymentMethod === "qr" && showQR && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginTop: 16,
                    padding: 16,
                    background: "#f9fafb",
                    borderRadius: 8,
                  }}
                >
                  {qrImageUrl && (
                    <img
                      src={qrImageUrl}
                      alt="PromptPay QR"
                      style={{ width: 200, height: 200 }}
                    />
                  )}
                  <div style={{ marginTop: 8, fontSize: 13, color: "#555" }}>
                    {qrStatus
                      ? `Status: ${qrStatus}`
                      : "Generate a QR to start payment"}
                  </div>
                  {!qrImageUrl && (
                    <button
                      onClick={startPromptPayFlow}
                      disabled={isProcessing}
                      style={{
                        marginTop: 8,
                        background: "#10b981",
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {isProcessing ? "Preparing..." : "Generate QR"}
                    </button>
                  )}
                  {!qrImageUrl && (
                    <div
                      style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}
                    >
                      Minimum amount for PromptPay is THB 10.00
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "card" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 16,
                  }}
                >
                  <div style={{ width: "100%", maxWidth: 360 }}>
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <CardElement
                        options={{
                          style: {
                            base: {
                              fontSize: "16px",
                              color: "#111827",
                              "::placeholder": { color: "#9ca3af" },
                            },
                            invalid: { color: "#ef4444" },
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === "wallet" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 12,
                  }}
                >
                  <label>Wallet phone</label>
                  <input
                    type="text"
                    placeholder="Enter wallet phone"
                    value={walletPhone}
                    onChange={(e) => setWalletPhone(e.target.value)}
                    style={{
                      padding: 6,
                      borderRadius: 4,
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              {!lastReceiptData && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    onClick={handleCheckout}
                    style={{
                      flex: 1,
                      background: "#10b981",
                      color: "#fff",
                      padding: 8,
                      borderRadius: 6,
                    }}
                  >
                    {isProcessing ? "Processing..." : "Pay & Sale"}
                  </button>
                </div>
              )}
              {/* ...existing code... */}
              {showReceiptModal && lastReceiptData && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.45)",
                    display: "grid",
                    placeItems: "center",
                    zIndex: 9999,
                    padding: 16,
                  }}
                  onClick={() => setShowReceiptModal(false)} // คลิกพื้นหลังเพื่อปิด
                >
                  <div
                    onClick={(e) => e.stopPropagation()} // ป้องกันปิดเมื่อคลิกในกล่อง
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      padding: 24,
                      width: "min(420px, 92vw)",
                      maxHeight: "90vh",
                      overflowY: "auto",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                      textAlign: "center",
                    }}
                  >
                    <h2 style={{ marginBottom: 12 }}>Receipt</h2>
                    <div ref={receiptRef}>
                      <Receipt
                        cart={lastReceiptData.items}
                        subtotal={lastReceiptData.subtotal}
                        discountValue={lastReceiptData.discount}
                        vat={lastReceiptData.vat}
                        total={lastReceiptData.total}
                        paymentMethod={lastReceiptData.payment.method}
                        payment={lastReceiptData.payment}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        marginTop: 16,
                        justifyContent: "center",
                      }}
                    >
                      <button
                        onClick={handlePrintReceipt}
                        style={{
                          background: "#10b981",
                          color: "#fff",
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Print
                      </button>
                      <button
                        onClick={handlePrintPDF}
                        style={{
                          background: "#3b82f6",
                          color: "#fff",
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => {
                          setShowReceiptModal(false);
                          setLastReceiptData(null);
                        }}
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Wrapper component providing Stripe Elements context
export default function CashierPage() {
  return (
    <Elements stripe={stripePromise}>
      <CashierInner />
    </Elements>
  );
}

# คู่มือโมดูล Sales (POS_System)

เอกสารนี้สรุปทุกอย่างเกี่ยวกับโฟลเดอร์และฟีเจอร์ "Sales" ทั้งฝั่ง Frontend และ Backend: โครงสร้างไฟล์, data model, flow การขาย, การชำระเงิน, การพิมพ์ใบเสร็จ, และจุดเชื่อมต่อที่เกี่ยวข้อง (Stripe, Discounts, Permissions)

---

## 1. ภาพรวมสถาปัตยกรรม (High-level Architecture)

ผู้ใช้ (Cashier/Admin) ใช้หน้า Sales เพื่อ:

- ค้นหา / เพิ่มสินค้าเข้าตะกร้า
- เลือกส่วนลด (Discount)
- คำนวณยอดรวม (subtotal, discount, vat, total)
- เลือกวิธีชำระ (cash, qr, card, wallet)
- สร้างใบขาย (Sale) + พิมพ์/แสดงใบเสร็จ
- ดูประวัติการขาย / การคืนสินค้า / Logs

Backend ให้ REST API ภายใต้ `/api/protect/sales` (ต้องมี JWT + permission) และใช้ MongoDB เก็บเอกสาร Sale

สำหรับการชำระเงินผ่าน Stripe (PromptPay / Card) มี logic แยกใน `README_STRIPE.md` (เอกสาร Stripe) แต่จะเชื่อม payload สุดท้ายเข้า Sale เหมือนกัน

---

## 2. โครงสร้างไฟล์สำคัญ

### Frontend (Sales Pages)

`Frontend/pos-system/src/pages/sales/`

- `Cashier.jsx` : หน้าขายหลัก (เพิ่มสินค้า, ส่วนลด, เลือก payment method, เรียก API สร้าง Sale, แสดงใบเสร็จ)
- `Cashier.css` : สไตล์เสริมของหน้าขาย
- `Receipt.jsx` : หน้าตาใบเสร็จ + ปุ่มพิมพ์ / PDF
- `Receipt.css` : สไตล์ใบเสร็จ
- `SalesHistory.jsx` + `SalesHistory.css` : ตารางประวัติการขาย (ค้นหา / paginate)
- `Refund.jsx`, `RefundHistory.jsx` : UI สำหรับทำและดูรายการคืนสินค้า (ใช้กับ backend refund routes)
- `Logs.jsx` (ใน sales/) : ดู logs เฉพาะ role sales (อาจสื่อสารกับ activity log)

### Frontend (Admin Sales / Logs)

`Frontend/pos-system/src/pages/admin/logs/` มีหน้ารวม log (เชื่อมกับ backend models/activityLog.js)

### Backend (Sales)

- `routes/apiSalesRoutes.js` : endpoint CRUD หลัก (create sale, list, get by id)
- `routes/apiRefundRoutes.js` : ทำการคืนสินค้า (refund + ปรับ stock)
- `models/sale.js` : โครงสร้างเอกสาร Sale
- `models/refund.js` : เก็บข้อมูลการคืน
- `models/product.js` : ใช้สำหรับเช็ค stock และปรับลดเมื่อขาย
- `middleware/ensurePermission.js` : ตรวจสิทธิ์ เช่น `sales.create`, `sales.view`
- `routes/apiPaymentsRoutes.js` : สร้าง PaymentIntent สำหรับกรณี qr/card (ผูกกับ Sale ในขั้นตอนสุดท้าย)
- `routes/stripeWebhook.js` : สร้าง Sale จาก PendingPayment (PromptPay โหมด webhook)

### อื่น ๆ ที่เกี่ยวข้อง

- `models/discount.js` : รูปแบบส่วนลด (อาจถูก fetch ที่หน้า Cashier)
- `models/permission.js` : ควบคุมสิทธิ์การใช้งาน
- `axiosSetup.js` (frontend) : แนบ JWT token กับ request ทั้งหมด

---

## 3. Data Model: Sale

`models/sale.js`:

```js
{
  invoiceNo: String (unique),
  createdBy: ObjectId(User),
  cashierName: String,
  items: [
    { productId, sku, name, unitPrice, qty, lineTotal }
  ],
  subtotal: Number,
  discount: Number,
  vat: Number,
  total: Number,
  payment: {
    method: 'cash' | 'card' | 'qr' | 'wallet',
    amountReceived: Number,
    change: Number,
    details: Mixed // paymentIntentId ฯลฯ
  },
  status: 'completed' | 'refunded',
  createdAt: Date,
  meta: Mixed
}
```

### Field หมายเหตุ

- `invoiceNo` สร้างด้วยฟังก์ชันใน `apiSalesRoutes.js` (วันที่ + random hex) เพื่อให้ไม่ซ้ำ
- `lineTotal` = `unitPrice * qty` (คำนวณตอนสร้าง sale)
- `discount` สามารถเป็น fixed หรือ percent (ประมวลผลที่ frontend แล้วส่งยอดสุทธิ)
- `payment.details` สำหรับกรณี Stripe: `{ paymentIntentId, intentStatus }`

---

## 4. Flow การสร้าง Sale (ทั่วไป: cash/wallet)

1. ผู้ใช้เพิ่มสินค้าเข้าตะกร้าใน `Cashier.jsx` -> state `cart`
2. เลือกส่วนลด -> คำนวณ `subtotal`, `discountValue`, `vat`, `total`
3. เลือกวิธีชำระเป็น `cash` หรือ `wallet`
4. กด "Pay & Sale" → เรียก `createSaleAfterPayment(payment)`
5. ฟังก์ชันประกอบ payload:
   ```js
   {
     items: cart.map(...), subtotal, discount, vat, total,
     payment: { method, amountReceived, change, details:{} }
   }
   ```
6. POST `/api/protect/sales` → backend ลด stock ของสินค้า → สร้างเอกสาร Sale → ตอบกลับพร้อม `invoiceNo`
7. Frontend แสดง modal ใบเสร็จ + ปุ่มพิมพ์ / PDF

### การคำนวณเงินทอน (cash)

- `amountReceived` = จำนวนเงินรับ (input)
- `change` = max(amountReceived - total, 0)

---

## 5. Flow การขาย (PromptPay QR + Card ผ่าน Stripe)

อธิบายเฉพาะจุดเชื่อมกับ Sale (รายละเอียด Stripe ดู README_STRIPE.md):

### PromptPay (Webhook Mode)

1. กดเลือกวิธี QR + "Pay & Sale"
2. Frontend สร้าง PaymentIntent `/payments/promptpay-intent` พร้อมส่ง `draft` (cart/totals)
3. ยืนยัน `stripe.confirmPromptPayPayment` ได้ QR แสดงให้ลูกค้าสแกน
4. เมื่อสถานะ Intent เป็น `processing` หรือ `succeeded` Frontend เริ่ม poll `/sales/by-intent/:paymentIntentId`
5. Webhook Stripe `payment_intent.succeeded` จะอ่าน `PendingPayment` -> สร้าง Sale -> ลด stock -> บันทึก `payment.details.paymentIntentId`
6. Frontend พบ Sale แล้วแสดงใบเสร็จ

### Card (Client Create Mode)

1. สร้าง PaymentIntent `/payments/card-intent`
2. ยืนยัน `stripe.confirmCardPayment`
3. ถ้า Intent status = `succeeded` → frontend เรียก `createSaleAfterPayment({ method:'card', ... })`
4. Backend สร้าง Sale ทันที (ไม่มี webhook ณ ตอนนี้)

---

## 6. การคืนสินค้า (Refund Flow) – ภาพรวม

(ขึ้นอยู่กับไฟล์ `routes/apiRefundRoutes.js`) โดยทั่วไป:

1. ผู้ใช้เลือก Sale เดิม + ระบุรายการ/จำนวนที่จะคืน
2. Backend เพิ่มเอกสาร Refund + ปรับ stock กลับ + อัพเดต Sale เป็น refunded หรือเพิ่ม meta
3. แสดงในหน้า `RefundHistory.jsx`

Stripe Refund (กรณีชำระผ่านบัตร/PromptPay) สามารถต่อยอดโดยเรียก Stripe API สร้าง refund และใช้ webhook `charge.refunded` เพื่อ sync สถานะ (ยังไม่ได้ implement เต็มในตอนนี้)

---

## 7. Permissions

Middleware `ensurePermission.js` ใช้ตรวจสิทธิ์เช่น:

- `sales.create` : สร้างใบขาย
- `sales.view` : ดูประวัติ / ใบเสร็จ
- `refunds.create` / `refunds.view` : การคืนสินค้า

หาก token ไม่มีสิทธิ์ → 403

---

## 8. การพิมพ์ใบเสร็จ & PDF

ใน `Cashier.jsx` และ `Receipt.jsx`:

- ใช้ `jsPDF` + `jspdf-autotable` เพื่อสร้าง PDF ในภาษาไทย (ฝัง font THSarabun ถ้ามีการเพิ่ม)
- ปุ่ม Print อาจใช้ `react-to-print` เพื่อสั่งพิมพ์องค์ประกอบใบเสร็จ
- โครงสร้างข้อมูลมาจาก state `lastReceiptData` ซึ่งรวม Sale + payment

---

## 9. รูปแบบ Request/Response สำคัญ

### POST /api/protect/sales (สร้าง Sale)

Request (ตัวอย่าง):

```json
{
  "items": [
    { "productId": "650...", "name": "สินค้า A", "qty": 2, "unitPrice": 50 },
    { "productId": "651...", "name": "สินค้า B", "qty": 1, "unitPrice": 100 }
  ],
  "subtotal": 200,
  "discount": 20,
  "vat": 0,
  "total": 180,
  "payment": {
    "method": "cash",
    "amountReceived": 200,
    "change": 20,
    "details": {}
  }
}
```

Response:

```json
{
  "saleId":"...",
  "invoiceNo":"20251112-ab12",
  "payment": {"method":"cash", "amountReceived":200, "change":20, "details":{}},
  "sale": { ... full sale document ... }
}
```

### GET /api/protect/sales (ค้นหา/แบ่งหน้า)

Query ตัวอย่าง:

```
/api/protect/sales?page=1&limit=25&query=cash&from=2025-11-01&to=2025-11-12
```

Response:

```json
{
  "rows": [
    {
      "invoiceNo": "...",
      "createdAt": "...",
      "total": 180,
      "payment": { "method": "cash" },
      "cashierName": "jubs"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 25
}
```

### GET /api/protect/sales/:id (รายละเอียดหนึ่งใบ)

- คืนรายละเอียดพร้อม items ที่ถูก enrich unitPrice/lineTotal กรณีข้อมูลเก่า

### GET /api/protect/sales/by-intent/:paymentIntentId

- ใช้ใน webhook mode ของ PromptPay

---

## 10. Edge Cases & Validation

| กรณี                                  | แนวทาง                                              |
| ------------------------------------- | --------------------------------------------------- |
| Stock ไม่พอ                           | endpoint เช็คก่อนลด ถ้าไม่พอคืน 400 พร้อมข้อความ    |
| Items ว่าง                            | ส่ง 400 "No items"                                  |
| ข้อมูล item ขาด name/qty/unitPrice    | ส่ง 400 "Invalid items"                             |
| Duplicate invoiceNo (rare)            | เกิดจาก collision => 409                            |
| PaymentIntent สร้างแล้ว webhook ไม่มา | Frontend timeout 60s แจ้งตรวจ Sales History         |
| amountReceived < total (cash)         | change จะติดลบ -> ปรับเป็น max(… ,0) หรือแจ้งผู้ใช้ |

---

## 11. Troubleshooting เฉพาะโมดูล Sales

| ปัญหา                      | วิธีเช็ค                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| ใบเสร็จไม่ขึ้นหลังจ่าย QR  | ตรวจ webhook CLI ยังรัน, paymentIntentId ถูกต้อง, ดู `/sales/by-intent/:id` 404?                    |
| การ์ดจ่ายแล้วไม่สร้าง Sale | ดู console error ใน `Cashier.jsx`, ตรวจ status PaymentIntent ต้องเป็น `succeeded`                   |
| สินค้าสต็อกติดลบ           | ตรวจ logic ลด stock ใน `apiSalesRoutes.js` มี race condition หรือไม่ได้ lock (ยังไม่มี transaction) |
| ส่วนลดไม่คำนวณ             | ดู state `selectedDiscount`, ฟังก์ชันคำนวณใน Cashier.jsx                                            |
| PDF ภาษาไทยเพี้ยน          | ตรวจ font THSarabun ถูกเพิ่มและเรียก `addFileToVFS` ก่อนใช้                                         |

---

## 12. การขยายในอนาคต

- เพิ่มระบบ Draft Sale (บันทึกก่อนชำระจริง)
- ใช้ WebSocket เพื่อ push Sale/realtime stock update
- เพิ่มช่องทาง Wallet จริง (เช่น API ของผู้ให้บริการ e-wallet) แทน mock
- รองรับ Partial Refund (บางรายการใน sale เดียว)
- ใช้ MongoDB transaction (session) เพื่อความ atomic ของลด stock + สร้าง Sale

---

## 13. สรุปสั้น

โมดูล Sales คือหัวใจการขายใน POS: จัดการตะกร้า → ส่วนลด → การชำระเงิน → สร้างเอกสาร Sale → แสดง / พิมพ์ใบเสร็จ พร้อมเชื่อมต่อ Stripe สำหรับวิธีที่เป็น QR และ Card โดยมี webhook เพิ่มความทนทานต่อการปิดหน้าเว็บและความถูกต้องของสถานะการชำระเงิน

หากต้องการ diagram (sequence หรือ ER) แจ้งได้จะเพิ่มให้ในเอกสารนี้.

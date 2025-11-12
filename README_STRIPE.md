# คู่มือการเชื่อมต่อ Stripe (POS_System)

เอกสารนี้อธิบายโครงสร้างและลำดับการทำงาน Stripe ทั้งหมดในโปรเจกต์: ตัวแปรสภาพแวดล้อม, endpoint ฝั่ง Backend, flow PromptPay (QR), flow บัตร (Card), กลไก Webhook, และวิธีที่ข้อมูลไปปรากฏบนหน้าจอ Frontend ตั้งแต่กดชำระจนออกใบเสร็จ

---

## ภาพรวม (Overview)

รองรับ 2 วิธีชำระเงินผ่าน Stripe:

1. PromptPay (QR) – ใช้ PaymentIntent ของ Stripe กับ payment_method `promptpay`
2. บัตรเครดิต/เดบิต (Card) – ใช้ Stripe Elements (`CardElement`) และ PaymentIntent

โหมดการประมวลผล PromptPay มี 2 แบบ:

- Polling (ฝั่ง client เรียกดูสถานะ payment intent ซ้ำ ๆ)
- Webhook (ฝั่ง server ฟัง Stripe แล้วสร้าง Sale อัตโนมัติ) – โหมดหลักที่ใช้อยู่ปัจจุบัน

ไฟล์หลัก Frontend คือ `Frontend/pos-system/src/pages/sales/Cashier.jsx` (จัดการ UI และเรียก API)
Backend ให้ endpoint ภายใต้ `/api/protect/payments` และ `/api/protect/sales` พร้อม webhook `/stripe/webhook` สำหรับรับ event

---

## ตัวแปรสภาพแวดล้อม (Environment Variables)

Backend (`Backend/.env`):

- `STRIPE_SECRET_KEY` : Secret key ของ Stripe (เช่น `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` : Signing secret (ขึ้นต้น `whsec_...`) สำหรับตรวจลายเซ็น webhook

Frontend (Vite):

- `VITE_STRIPE_PUBLISHABLE_KEY` : Publishable key (เช่น `pk_test_...`)

ห้าม expose secret key หรือ webhook secret ไปยังฝั่ง client

---

## โครงสร้างไฟล์ Backend ที่เกี่ยวข้อง

- `routes/apiPaymentsRoutes.js` : สร้าง PaymentIntent (PromptPay / Card) + ดูสถานะ intent
- `routes/apiSalesRoutes.js` : สร้าง / ค้นหา Sale + `GET /sales/by-intent/:id`
- `routes/stripeWebhook.js` : Handler webhook Stripe
- `models/pendingPayment.js` : เก็บร่าง sale ชั่วคราวก่อน webhook มาสร้างจริง
- `models/sale.js` : โครงสร้างเอกสารใบขาย
- `server.js` : Mount `/stripe/webhook` (แบบ raw) ก่อน bodyParser.json

---

## การสร้าง PaymentIntent (PromptPay)

`POST /api/protect/payments/promptpay-intent`
ข้อกำหนด: JWT + permission `sales.create`
Body ตัวอย่าง:

```json
{
  "total": 123.45,
  "metadata": { "source": "pos-cashier" },
  "draft": {
    "items": [
      { "productId": "...", "name": "สินค้า A", "unitPrice": 100, "qty": 1 }
    ],
    "subtotal": 100,
    "discount": 0,
    "vat": 0,
    "total": 100
  }
}
```

ขั้นตอน:

1. ตรวจ `total > 0`
2. สร้าง PaymentIntent `payment_method_types:["promptpay"]`, `currency:"thb"`
3. หากมี `draft` => บันทึกลง `PendingPayment` เพื่อใช้ตอน webhook
   Response:

```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "status": "requires_action"
}
```

## การสร้าง PaymentIntent (Card)

`POST /api/protect/payments/card-intent` โครงคล้าย PromptPay แต่ใช้ `payment_method_types:["card"]` ส่ง `draft` ได้ (เตรียมรองรับ webhook ในอนาคต)

## ดูสถานะ PaymentIntent

`GET /api/protect/payments/intent/:id` คืนข้อมูล:

```json
{ "id":"pi_xxx", "amount":1000, "currency":"thb", "status":"processing|succeeded|...", "metadata":{...} }
```

ใช้สำหรับ debug หรือ polling (ถ้าไม่ได้เปิด webhook mode)

---

## Webhook `/stripe/webhook`

ชนิด body: raw (ต้อง mount ก่อน JSON parser) ตรวจลายเซ็นด้วย `STRIPE_WEBHOOK_SECRET` เพื่อความปลอดภัย
เหตุการณ์ที่รองรับ:

- `payment_intent.succeeded`: ดึง `PendingPayment` ตาม `paymentIntentId` ตรวจ stock ลดจำนวนสินค้าตาม qty แล้วสร้าง `Sale` (idempotent: ถ้ามีอยู่แล้วไม่สร้างซ้ำ)
- `payment_intent.processing`: อัพเดตสถานะ pending (ตัวเลือก)
- `payment_intent.payment_failed`: mark failed
  ส่งกลับ `{received:true}` หากสำเร็จ

---

## การ lookup Sale ตาม PaymentIntent

`GET /api/protect/sales/by-intent/:id` => คืน sale ที่มี `payment.details.paymentIntentId = :id` สำหรับ frontend webhook mode ใช้โชว์ใบเสร็จเมื่อพร้อม

---

## โมเดล PendingPayment

ตัวอย่างโครงสร้าง (ย่อ):

```js
{
  paymentIntentId: String,
  method: "qr" | "card",
  saleDraft: { items:[...], subtotal, discount, vat, total },
  createdBy, cashierName,
  status: "pending" | "processed" | "failed",
  processedAt: Date
}
```

บทบาท: เก็บข้อมูลร่างก่อนชำระเสร็จ เพื่อให้ webhook สร้าง Sale ได้แม้ผู้ใช้ปิดหน้าเว็บระหว่างรอ

---

## Flow PromptPay (QR) บน Frontend

1. กดเลือกวิธีชำระ "QR"
2. สร้าง PaymentIntent ผ่าน endpoint พร้อม draft (cart, totals)
3. เรียก `stripe.confirmPromptPayPayment(clientSecret, {...billing_details})`
4. Stripe ส่งคืน PaymentIntent ที่มี `next_action` -> ภาพ QR (`image_data_url`) นำมาแสดงให้ลูกค้าสแกน
5. ลูกค้าสแกนด้วยแอปธนาคารและยืนยัน (สถานะ -> processing -> succeeded)
6. โหมด webhook: เมื่อพบ status `processing` หรือ `succeeded` จะเริ่ม poll `/sales/by-intent/:id` ทุก 2 วิ รอจน Sale ถูกสร้างโดย webhook แล้วเปิดใบเสร็จ
7. หากเกิน timeout (60 วินาที) ยังไม่เจอ Sale จะแจ้งเตือนให้ตรวจที่ Sales History

หมายเหตุ: โหมด polling เดิมจะสร้าง Sale ฝั่ง client ทันทีที่เห็นสถานะ แต่ตอนนี้พึ่ง webhook เพื่อความถูกต้องและกันกรณี user ปิดหน้า

---

## Flow บัตร (Card)

1. กดเลือก "CARD" -> Render `CardElement`
2. สร้าง PaymentIntent (`card-intent`) รับ `clientSecret`
3. เรียก `stripe.confirmCardPayment(clientSecret, { payment_method:{ card: cardElement } })`
4. หากผล = `succeeded` สร้าง Sale ฝั่ง client ทันที (ยังไม่ได้ย้ายเป็น webhook mode)
5. แสดงใบเสร็จ

ตัวอย่างบัตรทดสอบ:

- 4242 4242 4242 4242 | 12/34 | 123 (สำเร็จ)
- 4000 0027 6000 3184 (3D Secure) | 12/34 | 123
- 4000 0000 0000 9995 (ล้มเหลว)

---

## ใบเสร็จ (Receipt)

เมื่อ Sale ถูกสร้างแล้ว (ไม่ว่าจะ webhook หรือ client) หน้า Cashier จะเปิด modal ใบเสร็จ และรองรับพิมพ์/ส่งออก PDF ด้วย `jsPDF` + `jspdf-autotable`

---

## การรันทดสอบในเครื่อง (Local)

1. ตั้งค่า `STRIPE_SECRET_KEY` ใน `Backend/.env`
2. รัน Stripe CLI เพื่อรับ webhook:
   ```bash
   stripe listen --forward-to http://localhost:3000/stripe/webhook
   ```
   ก็อป `whsec_...` ที่แสดงเพิ่มเข้า `STRIPE_WEBHOOK_SECRET=` แล้วรีสตาร์ท backend
3. ตั้งค่า `VITE_STRIPE_PUBLISHABLE_KEY` แล้วรัน frontend (Vite)
4. ทดสอบ PromptPay: เพิ่มสินค้า -> เลือก QR -> Pay & Sale -> สแกน QR -> รอใบเสร็จ
5. ทดสอบ Card: เลือก CARD -> กรอกบัตรทดสอบ -> Pay & Sale -> ใบเสร็จขึ้นทันที

---

## การแก้ปัญหา (Troubleshooting)

- 500 ที่ `/payments/promptpay-intent`: ตรวจ secret key / ตรวจว่า `total` > 0
- Webhook ไม่เข้า: ตรวจ CLI ยังรันอยู่, ตรวจ `STRIPE_WEBHOOK_SECRET` ล่าสุด, ตรวจว่า route raw ถูก mount ก่อน bodyParser
- คำเตือนใช้ HTTP: ข้ามได้ใน dev แต่ production ต้อง HTTPS
- สถานะ intent เป็น `undefined`: รีสตาร์ท backend หลังแก้ endpoint ให้ส่ง `status`

---

## ความปลอดภัย (Security)

- ไม่ส่ง `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` ไป client
- เก็บ raw body webhook เพื่อ verify ลายเซ็น (ห้ามแปลงก่อนตรวจ)
- ใช้ idempotency โดยเช็คว่าเคยสร้าง Sale สำหรับ `paymentIntentId` แล้วหรือยัง

---

## แผนปรับปรุงต่อไป (Future Enhancements)

- ย้าย Card flow ไป webhook mode เพื่อให้โครงสร้างเหมือนกัน
- ใช้ WebSocket / SSE แทน polling receipt
- รองรับ refund webhook (`charge.refunded`) เปลี่ยนสถานะ Sale

---

© POS_System Stripe Integration (คู่มือภาษาไทย)

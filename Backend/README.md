# POS_System — Backend (Authentication)

เอกสารฉบับย่อและคำแนะนำการใช้งานสำหรับโฟลเดอร์ `Backend/` ในโปรเจค POS_System

ไฟล์นี้รวมสรุปสถาปัตยกรรม, ตัวแปรสิ่งแวดล้อม (env), รายละเอียด endpoint, วิธีทดสอบด้วย Postman/Newman, แนวทางด้านความปลอดภัย และขั้นตอนแนะนำถัดไป

## สรุปสั้น ๆ

- ระบบใช้ Node.js + Express และ MongoDB (Mongoose)
- Authentication: password hashing ด้วย `bcryptjs` (พร้อมตัวเลือก `PASSWORD_PEPPER`) และการออก JWT โดย `jsonwebtoken`
- หลักการ: Signup -> store passwordHash, Login -> verify -> issue JWT, Protected endpoints ใช้ middleware เพื่อตรวจ JWT
- ตัวอย่าง endpoints: `/api/auth/signup`, `/api/auth/login`, `/api/protect/*`, `/api/public/*`

---

## ไฟล์สำคัญและความรับผิดชอบ

- `server.js` — bootstrap แอป, โหลด dotenv, เชื่อมต่อ DB, mount routes
- `config/db.js` — เชื่อมต่อ MongoDB (อ่าน `MONGO_URI` จาก env)
- `models/user.js` — Mongoose schema ของ User, เมธอด `setPassword` และ `comparePassword` (hash/verify)
- `routes/apiAuthRoutes.js` — signup & login endpoints
- `middleware/authMiddleware.js` — ตรวจ JWT (อ่าน `JWT_SECRET` จาก env)
- `routes/apiPublicRoutes.js` — ตัวอย่าง public endpoint
- `routes/apiProtectRoutes.js` — ตัวอย่าง protected endpoint
- `postman/` — collection + environment สำหรับทดสอบ API (Postman/Newman)

---

## ตัวแปร environment (สำคัญ)

สร้างไฟล์ `.env` โดยคัดลอกจาก `Backend/.env.example` แล้วแก้ค่าให้เหมาะสม (อย่า commit `.env` เข้ากับ repo)

รายการตัวแปรหลัก:

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/pos
JWT_SECRET=เปลี่ยนเป็นค่าสุ่มยาวๆ
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=12
PASSWORD_PEPPER=

# Stripe (สำหรับรับชำระเงิน)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
# STRIPE_WEBHOOK_SECRET=  # (optional ตอนเริ่มต้น; จำเป็นถ้าเปิดใช้ webhook จริง)
```

- `JWT_SECRET`: ต้องเก็บลับสุดยอด — ใช้ secret manager ใน production
- `JWT_EXPIRES_IN`: รูปแบบเช่น `15m`, `1h` หรือจำนวนวินาที
- `BCRYPT_ROUNDS`: ค่า cost factor ของ bcrypt (ค่าแนะนำ >= 10-12)
- `PASSWORD_PEPPER`: ค่าสำหรับ concat ก่อน hash (optional) — เก็บใน secret manager

---

## การติดตั้งและรัน (Windows / cmd.exe)

1. เปิด terminal เข้าไปที่โฟลเดอร์ Backend:

```cmd
cd Backend
```

2. ติดตั้ง dependencies (ถ้ายังไม่ติดตั้ง):

```cmd
npm install
```

3. สร้าง `.env` จาก `.env.example` และตั้งค่า:

```cmd
copy .env.example .env
```

4. รันเซิร์ฟเวอร์:

```cmd
node server.js
```

ตรวจ log สำหรับ warning เกี่ยวกับ `JWT_SECRET` หรือ `MONGO_URI` (ถ้ามี)

ถ้าต้องการทดสอบ Stripe PromptPay / Card ให้ตั้งค่าใน `.env`:

```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx  (เมื่อสร้าง webhook endpoint ใน Stripe Dashboard แล้ว)
```

จากนั้นเปิด endpoint ที่สร้างไว้:

- POST `/api/protect/payments/promptpay-intent` — สร้าง PaymentIntent สำหรับ PromptPay
- POST `/api/protect/payments/card-intent` — สร้าง PaymentIntent สำหรับบัตร
- GET `/api/protect/payments/intent/:id` — ตรวจสถานะ intent (polling)

---

## Endpoints (Reference)

1. POST /api/auth/signup

- Request (JSON): { "username": "alice", "password": "secret123", "role": "cashier" }
- Responses: 201 Created / 400 Bad Request / 409 Conflict / 500 Server Error

2. POST /api/auth/login

- Request (JSON): { "username": "alice", "password": "secret123" }
- Responses: 200 OK -> { "token": "<jwt>" } / 400 / 401 / 500

3. GET /api/protect/dashboard

- Header: Authorization: Bearer <token>
- Responses: 200 OK -> protected data / 401/403 on invalid or missing token

4. GET /api/public/info

- Public example endpoint — ไม่ต้องมี token

หมายเหตุ: โครง payload ของ JWT ถูกจำกัดไว้ให้น้อยที่สุด (userId, username, role) — อย่าใส่ข้อมูลลับใน payload

---

## วิธีทดสอบ (Postman และ Newman)

โฟลเดอร์ `Backend/postman` มีไฟล์:

- `POS_Backend_Collection.json` — collection ของ Postman
- `POS_Backend_Environment.json` — environment (ตัวแปรเช่น baseUrl, token)

วิธีใช้งาน (Postman GUI):

1. Import ทั้งสองไฟล์เข้า Postman
2. เลือก environment ที่ import แล้วตั้ง `baseUrl` ให้ชี้ไปที่เซิร์ฟเวอร์ของคุณ (เช่น http://localhost:3000)
3. รัน collection (Signup -> Login -> Protected)

วิธีใช้งาน (Newman CLI):

```cmd
npm install -g newman
newman run Backend/postman/POS_Backend_Collection.json -e Backend/postman/POS_Backend_Environment.json
```

Collection จะเก็บ token จาก response ของ `login` ลงใน environment variable และใช้มันใน requests ถัดไป (Authorization header)

---

## ความปลอดภัยและแนวปฏิบัติที่แนะนำ

- อย่า commit `.env` หรือคีย์ความลับลง git
- ใช้ secret manager สำหรับ production (AWS Secrets Manager / Azure Key Vault / GCP Secret Manager)
- ใช้ short-lived access tokens (15m–1h) + refresh tokens ที่เก็บอย่างปลอดภัย (httpOnly cookie)
- ถ้าเป็น production: หยุดการสตาร์ท (fail-fast) ถ้า `JWT_SECRET` หรือ `MONGO_URI` ขาด
- เพิ่ม rate-limiting และ lockout สำหรับการพยายาม login หลายครั้ง
- ตรวจ input validation (express-validator / Joi)
- ใช้ HTTPS เสมอใน production
- พิจารณา migration ไปยัง Argon2id สำหรับ hashing ในอนาคต — เพิ่ม lazy re-hash เมื่อ login สำเร็จ

---

## พัฒนาต่อ (รายการที่แนะนำ)

1. เพิ่ม refresh tokens + rotation + revocation model
2. เพิ่ม endpoint `/api/auth/me` เพื่อให้ frontend ตรวจ token และดึงข้อมูลผู้ใช้
3. เพิ่ม unit/integration tests (Jest + supertest)
4. เพิ่ม Dockerfile และ health/readiness endpoints
5. ผสาน Postman/Newman ใน CI (GitHub Actions example)

---

## ถ้าต้องการให้ผมทำต่อ

- ผมสามารถเพิ่ม /api/auth/me ให้, เพิ่ม refresh token flow, เขียน Jest tests, หรือตั้ง CI workflow เพื่อรัน Newman อัตโนมัติ
- ระบุสิ่งที่ต้องการ แล้วผมจะทำให้เรียบร้อยและส่งผลการทดสอบกลับ

---

ขอบคุณ — แจ้งผมว่าต้องการให้ผมเพิ่มส่วนไหนให้ละเอียดขึ้นอีก (เช่น ตัวอย่าง response body, ตัวอย่าง setup ใน production, หรือ GitHub Actions workflow)

---

## Backfill invoiceNo สำหรับข้อมูลเก่า (Sales) 🧾

หากมีเอกสารการขาย (Sale) เก่าที่ไม่มี `invoiceNo` สคริปต์นี้จะช่วยเติมให้อัตโนมัติ โดยใช้รูปแบบเดียวกับการขายใหม่ใน API คือ `YYYYMMDD-<4-hex>` และอ้างอิงวันที่จาก `createdAt` ของเอกสารนั้น ๆ เพื่อให้เลขดูสอดคล้องตามวันขายเดิม

ไฟล์สคริปต์: `Backend/scripts/backfillInvoiceNo.js`

เงื่อนไขและคุณสมบัติ

- อ่านค่า `MONGO_URI` จากไฟล์ `.env` (เหมือนกับ `server.js`)
- โหมด `--dry-run` เพื่อซ้อมโดยไม่เขียนข้อมูล
- ตรวจสอบความซ้ำก่อนอัปเดต เพื่อหลีกเลี่ยง duplicate key
- ทำงานแบบสตรีม (cursor) จึงไม่กินเมมโมรี่กับข้อมูลจำนวนมาก

วิธีรัน (Windows / cmd.exe):

```cmd
cd Backend

:: ซ้อม แสดงรายการที่จะอัปเดต โดยไม่เขียนจริง
node scripts\backfillInvoiceNo.js --dry-run

:: ทำจริง เขียนค่า invoiceNo ให้เอกสารที่ยังว่าง/ขาด
node scripts\backfillInvoiceNo.js
```

เมื่อสำเร็จ จะแสดงสรุปจำนวนที่ประมวลผลและจำนวนที่อัปเดต หากฐานข้อมูลมี unique index บน `invoiceNo` อยู่แล้ว สคริปต์จะหลีกเลี่ยงเลขซ้ำโดยการสุ่มซ้ำให้อัตโนมัติ

หมายเหตุ:

- หลังจาก backfill แล้ว การสร้างขายใหม่ผ่าน API `/api/protect/sales` จะยังคงออก `invoiceNo` ให้โดยอัตโนมัติตามปกติ (ดูโค้ดใน `routes/apiSalesRoutes.js` ฟังก์ชัน `genInvoiceNo`)
- ถ้าเอกสารเก่ามีข้อจำกัด schema ไม่ตรง (เช่น ฟิลด์ที่ขาดอื่น ๆ) สคริปต์จะใช้ `updateOne` เฉพาะฟิลด์ `invoiceNo` เพื่อลดโอกาส validation ล้มเหลว

# POS_System Backend — Authentication Guide

## สรุปการเปลี่ยนแปลงที่ทำแล้ว

- เปลี่ยนจากการใช้ผู้ใช้ในหน่วยความจำ เป็นการเก็บผู้ใช้ใน MongoDB (`models/user.js`) และใช้ Mongoose model
- เพิ่มการ hash รหัสผ่านด้วย `bcryptjs` (pre-save hook) และเมธอด `comparePassword` สำหรับตรวจสอบ
- สร้าง endpoints แบบจริงจังใน `routes/apiAuthRoutes.js`:
  - POST `/api/auth/signup` — สร้างผู้ใช้ใหม่
  - POST `/api/auth/login` — รับ JWT access token
- Middleware ตรวจสอบ JWT ใน `middleware/authMiddleware.js` (ใช้ `process.env.JWT_SECRET`)
- โหลดค่า config จาก `.env` (ผ่าน `dotenv`) ใน `server.js` และเชื่อมต่อ DB (`config/db.js`)
- เพิ่ม `.env.example` เป็นตัวอย่างตัวแปร environment
  - เพิ่มตัวแปร BCRYPT_ROUNDS และ PASSWORD_PEPPER สำหรับการตั้งค่าการ hash

---

## หลักการทำงานโดยละเอียด

ระบบ Authentication นี้ใช้แนวทางดังนี้:

1. Password hashing

   - เมื่อมีการสร้างหรือแก้ไขรหัสผ่านของผู้ใช้ (field `password`) โมเดล `User` จะทำการ hash ด้วย `bcryptjs` โดยอัตโนมัติก่อนเก็บลงฐานข้อมูล
   - การใช้ salt (ผ่าน `bcrypt.genSalt`) ทำให้ hash แต่ละค่าแตกต่างกันแม้รหัสผ่านเหมือนกัน

2. Signup

   - Client ส่ง `username` และ `password` ไปยัง POST `/api/auth/signup`
   - เซิร์ฟเวอร์ตรวจสอบว่ามี `username` ซ้ำหรือไม่ หากไม่มีจะสร้าง `User` ใหม่ (รหัสผ่านจะถูก hash โดย pre-save hook)
   - ตอนนี้ระบบใช้ `bcryptjs` กับค่า `BCRYPT_ROUNDS` (ค่าเริ่มต้น 12) และ optional `PASSWORD_PEPPER` ที่เก็บใน environment
   - ข้อมูลที่เก็บใน DB: `username`, `passwordHash`, `hashAlgo`, `role`, `createdAt`, `updatedAt`

3. Login & JWT

   - Client ส่ง `username` และ `password` ไปยัง POST `/api/auth/login`
   - เซิร์ฟเวอร์ตำแหน่ง `User` จากฐานข้อมูลแล้วเรียก `user.comparePassword(password)` ซึ่งจะใช้ `bcrypt.compare` เพื่อยืนยัน
   - ถ้า match จะสร้าง JWT โดยใช้ `jsonwebtoken` ใส่ payload เล็กๆ เช่น `{ userId, role, username }`
   - JWT ถูก signed ด้วย `process.env.JWT_SECRET` และมีอายุ (เช่น 1h) ตามค่า `process.env.JWT_EXPIRES_IN`
   - Client เก็บ token และใส่ใน header ของคำขอถัดไป: `Authorization: Bearer <token>`

4. Protect route
   - Middleware `authenticateToken` จะอ่าน header, ดึง token ออกมา และเรียก `jwt.verify(token, JWT_SECRET)`
   - หาก valid จะใส่ข้อมูล user (payload) ลง `req.user` และเรียก `next()`
   - หากไม่ valid หรือไม่มี token จะส่ง 401/403 ตามกรณี

---

## ไฟล์สำคัญ

- `models/user.js` — Mongoose schema + pre-save hash + comparePassword
- `routes/apiAuthRoutes.js` — signup/login endpoints
- `middleware/authMiddleware.js` — verify JWT
- `config/db.js` — เชื่อมต่อ MongoDB
- `server.js` — โหลด dotenv, connect DB, mount routes
- `.env.example` — ตัวอย่าง environment variables

---

## การติดตั้งและรัน (Windows / cmd.exe)

1. เข้าโฟลเดอร์ Backend:

```
cd Backend
```

2. ติดตั้ง dependencies (ถ้ายังไม่ได้ติดตั้ง):

```
npm install
```

3. สร้างไฟล์ `.env` โดยคัดลอกจาก `.env.example` แล้วปรับค่าตามต้องการ:

```
copy .env.example .env
```

แล้วแก้ `.env` ให้ตั้งค่า `JWT_SECRET` และ `MONGO_URI` ให้ถูกต้อง

4. รันเซิร์ฟเวอร์:

```
# POS_System Backend — Authentication Guide

This document explains the authentication subsystem implemented in the `Backend/` folder.
It contains detailed explanations, environment variables, endpoint reference, examples, and security recommendations.

## Summary of implemented features
- Storage: users are persisted in MongoDB using Mongoose (`models/user.js`).
- Passwords are hashed using `bcryptjs` plus optional application-level `PASSWORD_PEPPER`.
- Endpoints:
  - POST `/api/auth/signup` — create user
  - POST `/api/auth/login` — returns JWT access token
  - GET `/api/protect/*` — protected endpoints that require a valid JWT
- JWT verification middleware: `middleware/authMiddleware.js`
- Configuration via `.env` (loaded by `dotenv` in `server.js`)
- Postman collection and environment provided in `Backend/postman/`

---

## Architecture & Flow (high level)

1) Signup
  - Client sends `username` and `password` to `/api/auth/signup`.
  - Server checks uniqueness, hashes the password with bcrypt and optional pepper, and stores `passwordHash`.

2) Login
  - Client sends `username` and `password` to `/api/auth/login`.
  - Server loads user, verifies password using bcrypt.compare (with the same pepper), and signs a JWT containing minimal claims (userId, username, role).
  - Client stores the JWT and includes it in Authorization header for protected requests.

3) Protected resources
  - Requests to routes under `/api/protect` are validated by `authenticateToken` middleware, which verifies signature and expiry and attaches decoded payload to `req.user`.

---

## Important files and responsibilities
- `server.js` — app bootstrap, loads env, connects DB, mounts routes
- `config/db.js` — mongoose connection (reads `MONGO_URI`)
- `models/user.js` — user schema, password hashing and comparison
- `routes/apiAuthRoutes.js` — signup & login
- `middleware/authMiddleware.js` — extract & verify JWT, attach `req.user`
- `routes/apiPublicRoutes.js` — example public endpoints
- `routes/apiProtectRoutes.js` — example protected endpoints

---

## Environment variables (`.env`)
Create `.env` (do NOT commit secrets). Example variables used by the code:

```

PORT=3000
MONGO_URI=mongodb://localhost:27017/pos
JWT_SECRET=replace_this_with_a_long_random_string
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=12
PASSWORD_PEPPER=

````

- `JWT_SECRET`: secret used to sign and verify JWTs (keep secret)
- `JWT_EXPIRES_IN`: token lifetime for access tokens (supports formats like `15m`, `1h`)
- `BCRYPT_ROUNDS`: cost factor for bcrypt (default 12)
- `PASSWORD_PEPPER`: optional application-level secret appended to passwords before hashing (adds protection if DB is leaked but code holds secret) — store in secret manager in production

---

## Endpoint Reference (detailed)

1) POST /api/auth/signup
- Request body (JSON):
  {
    "username": "alice",
    "password": "secret123",
    "role": "cashier" // optional
  }
- Responses:
  - 201 Created — user created
  - 400 Bad Request — missing fields
  - 409 Conflict — username already exists
  - 500 Server Error

2) POST /api/auth/login
- Request body (JSON):
  {
    "username": "alice",
    "password": "secret123"
  }
- Responses:
  - 200 OK — { "token": "<jwt>" }
  - 400 Bad Request — missing fields
  - 401 Unauthorized — invalid credentials
  - 500 Server Error

3) GET /api/protect/dashboard
- Requires header: `Authorization: Bearer <token>`
- Responses:
  - 200 OK — { message, user }
  - 401 / 403 — invalid or missing token

---

## Examples

Curl (Windows cmd.exe):

```cmd
cd Backend
npm install
node server.js

curl -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" -d "{\"username\":\"alice\",\"password\":\"secret123\",\"role\":\"cashier\"}"

curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"alice\",\"password\":\"secret123\"}"

curl -H "Authorization: Bearer <token>" http://localhost:3000/api/protect/dashboard
````

JS fetch example (browser/frontend):

```javascript
const token = "<your-jwt-token>";
fetch("/api/protect/dashboard", {
  headers: { Authorization: `Bearer ${token}` },
})
  .then((r) => r.json())
  .then(console.log);
```

---

## Security notes & recommendations

- Keep secrets out of source control. Use a secret manager in production.
- Short-lived access tokens (e.g., 15m–1h) + refresh tokens to renew sessions.
- Store refresh tokens securely (httpOnly cookie) and make refresh endpoint rotate tokens.
- Add rate-limiting and login attempt throttling to defend against brute-force attacks.
- Use HTTPS for all traffic and HSTS in production.
- Validate and sanitize inputs (use `express-validator` or Joi).
- Consider migrating to Argon2 (argon2id) for new applications; implement lazy re-hash on login to migrate existing bcrypt users.

---

## Developer notes (where to extend)

- Add validation middleware in `routes/apiAuthRoutes.js`.
- Add refresh token model and endpoints for token rotation & revocation.
- Add tests (Jest + supertest) under `Backend/test/` for automated CI.
- Add Dockerfile and health/readiness endpoints for containerized deployment.

---

If you want, I can:

- Add a `/api/auth/me` endpoint that returns user info from token.
- Add unit/integration tests (Jest + supertest) for signup/login/protected routes.
- Implement refresh tokens and logout flow.

Tell me which of the above you'd like me to implement next and I'll add it and run tests.

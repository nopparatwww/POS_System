# POS System – Report.md

เอกสารฉบับนี้อธิบายหลักการทำงานของระบบ ทั้งฝั่ง Backend และ Frontend รวมถึงแนวคิดที่ใช้ อธิบาย API สำคัญว่าทำอะไรและเหตุผลเชิงลอจิก พร้อมลงรายละเอียดแบบไล่บรรทัดในไฟล์หลักบางไฟล์ (เช่น `authMiddleware.js`, `ensureWithinShift.js`) เพื่อให้อ่านโค้ดควบคู่ได้ง่าย เอกสารนี้เป็นคำอธิบายในไฟล์เดียวตามที่ร้องขอ

---

## สารบัญย่อ

- ภาพรวมสถาปัตยกรรม
- Backend
  - server.js
  - config/db.js (เชิงแนวคิด)
  - middleware
    - authMiddleware.js (ไล่อธิบายบรรทัดต่อบรรทัด)
    - ensureWithinShift.js (ไล่อธิบายบรรทัดต่อบรรทัด)
    - ensureAdmin.js, ensurePermission.js, rateLimiter.js (สรุป)
  - models: user.js, product.js, permission.js, activityLog.js (สรุป +ข้อแนะนำ index)
  - routes
    - apiAuthRoutes.js (login ป้องกันนอกเวลางาน, signup)
    - apiPermissionRoutes.js (/me, mapping path→key, check)
    - apiProtectRoutes.js (users, logs พร้อมตัวกรอง role)
    - apiProductRoutes.js (CRUD + ค้นหา/จัดหน้า/เรียง)
- Frontend
  - โครงสร้างเส้นทางใน App.jsx
  - axiosSetup.js (interceptors + แจ้งเตือน SHIFT_OUTSIDE)
  - ProtectedRoute.jsx (ตรวจสิทธิ์แบบ allow-only)
  - NavBar.jsx (เมนูตามสิทธิ์ + รีเฟรชสิทธิ์เป็นระยะ)
  - หน้าสำคัญ: Login.jsx, AdminLayout.jsx, ProductManagement.jsx, Logs Views, Warehouse Products wrapper
- แนวคิดสิทธิ์ (Permissions) และการ Mapping
- แนวคิดช่วงเวลางาน (Shift) และการเตะออกอัตโนมัติ
- ข้อเสนอแนะด้านประสิทธิภาพ (Indexes/Migration)

---

## ภาพรวมสถาปัตยกรรม

- Backend: Node.js + Express + Mongoose (JWT auth), แยกเส้นทางเป็น /api/auth, /api/public, /api/protect, /api/permissions และ /api/protect/products
- Frontend: React + Vite, ใช้ React Router, axios interceptors, แนวทาง "allow-only" สำหรับการแสดงเมนู/อนุญาตหน้า
- Security/Operational:
  - JWT ตรวจใน middleware (`authMiddleware.js`)
  - ป้องกันการใช้งานนอกช่วงเวลางานด้วย `ensureWithinShift.js` ทั้งกับ API สำคัญ และป้องกันการ Login นอกเวลาใน `apiAuthRoutes.js`
  - สิทธิ์แบบอนุญาตเฉพาะรายการ (allow-only) บน FE; ฝั่ง BE มี baseline role ไว้รองรับกรณีไม่ตั้งค่า
  - บันทึกกิจกรรมด้วย `ActivityLog` และมี endpoint ดู Logs พร้อมตัวกรอง role (all/admin/cashier/warehouse)

---

## Backend

### server.js
บทบาท: ตั้งค่า Express app, ปิด ETag/Powered-by, เปิด CORS, เชื่อม DB, ติดตั้งกลุ่มเส้นทาง และ start server

เหตุผลเชิงลอจิก:
- ปิด ETag เพื่อหลีกเลี่ยง 304 บน JSON สำคัญที่เปลี่ยนตามสิทธิ์/เวลา
- เปิด CORS เพื่อให้ FE เรียก API ได้ (ในโปรดักชันควรจำกัด origin)
- แยกเส้นทางชัดเจนตามบริบท

โค้ด (server.js):

```javascript
const express = require("express"); // โหลด Express
const bodyParser = require("body-parser"); // ตัวช่วย parse JSON body
const cors = require("cors"); // เปิด CORS ให้ FE เรียกได้ระหว่างพัฒนา
require("dotenv").config(); // โหลดตัวแปรแวดล้อมจากไฟล์ .env เข้าสู่ process.env

require("./config/db"); // เชื่อมต่อฐานข้อมูล (โมดูลนี้จะตั้งค่า mongoose ให้เรียบร้อย)

// นำเข้าโมดูลเส้นทางหลักของระบบ
const apiAuthRoutes = require("./routes/apiAuthRoutes"); // กลุ่ม auth: signup, login
const apiProtectRoutes = require("./routes/apiProtectRoutes"); // กลุ่ม protected (ต้องมี JWT)
const apiPermissionRoutes = require("./routes/apiPermissionRoutes"); // กลุ่มจัดการสิทธิ์
const apiPublicRoutes = require("./routes/apiPublicRoutes"); // กลุ่ม public (ไม่ต้อง auth)
const apiProductRoutes = require("./routes/apiProductRoutes"); // กลุ่มสินค้าภายใต้ protect

const app = express(); // สร้างแอป Express

app.set('etag', false); // ปิด ETag เพื่อลด 304 และบังคับส่ง body สดใหม่
app.disable('x-powered-by'); // ซ่อน header X-Powered-By: Express เพื่อความปลอดภัยเล็กน้อย

app.use(bodyParser.json()); // รองรับ JSON request body (application/json)

app.use(cors()); // เปิด CORS (โปรดักชันควรจำกัด origin ที่เชื่อถือได้)

// เส้นทางสุขภาพ/ค่าเริ่มต้น ใช้เช็ค liveness อย่างง่าย
app.get("/", (req, res) => { // GET /
  res.send("JWT API is running"); // ส่งสตริงตอบกลับ
});

// ติดตั้งกลุ่มเส้นทางของระบบ
// /api/auth     -> signup, login
// /api/public   -> endpoint สาธารณะ
// /api/protect  -> endpoint ที่ต้องมี JWT
app.use("/api/auth", apiAuthRoutes); // ติดตั้งกลุ่ม auth
app.use("/api/public", apiPublicRoutes); // ติดตั้งกลุ่ม public
app.use("/api/protect", apiProtectRoutes); // ติดตั้งกลุ่ม protected
app.use("/api/permissions", apiPermissionRoutes); // จัดการสิทธิ์
app.use("/api/protect/products", apiProductRoutes); // จัดการสินค้า (ต้อง protect)

const PORT = process.env.PORT || 3000; // อ่านพอร์ตจาก env หรือใช้ 3000 เป็นค่าเริ่มต้น
app.listen(PORT, () => { // เริ่มต้นเซิร์ฟเวอร์
  console.log(`Server running on http://localhost:${PORT}`); // log URL สำหรับทดสอบ
});
```

---

### middleware/authMiddleware.js (ไล่อธิบายทีละบรรทัด)
ไฟล์: `Backend/middleware/authMiddleware.js`

1. `const jwt = require("jsonwebtoken");` โหลดไลบรารี JWT เพื่อใช้ตรวจสอบโทเคน
2. `const SECRET_KEY = process.env.JWT_SECRET` ดึงกุญแจลับจากตัวแปรแวดล้อม ใช้ verify โทเคน (อย่า hardcode)
3. `function authenticateToken(req, res, next) {` นิยาม middleware สำหรับตรวจ JWT
4. `const authHeader = req.headers["authorization"];` อ่านเฮดเดอร์ Authorization
5. `const token = authHeader && authHeader.split(" ")[1];` ดึงส่วนโทเคนจากรูปแบบ `Bearer <token>` (ตัดคำว่า Bearer ออก)
6. `if (!token) return res.status(401)...` ถ้าไม่มีโทเคน ตอบ 401
7. `jwt.verify(token, SECRET_KEY, (err, user) => {` ตรวจความถูกต้องของโทเคนด้วยกุญแจลับ
8. `if (err) { return res.status(403)... }` ถ้าตรวจไม่ผ่าน (หมดอายุ/ปลอม) ตอบ 403
9. `req.user = user;` หากผ่าน บันทึก payload ของโทเคนลง `req.user` เพื่อส่งต่อ
10. `next();` ส่งต่อไปยัง handler/middleware ถัดไป
11. `}` ปิด callback
12. `}` ปิดฟังก์ชัน middleware
13. `module.exports = authenticateToken;` ส่งออกเป็น middleware ใช้ในเส้นทางที่ต้องการป้องกัน

แนวคิด: แยกความกังวลเรื่อง auth ออกมาเป็น middleware ที่ใช้ซ้ำง่าย ทุก endpoint สำคัญคาดหวังว่า `req.user` จะพร้อมใช้งานเมื่อผ่าน middleware นี้แล้ว

---

### middleware/ensureWithinShift.js (ไล่อธิบายทีละบรรทัดหลัก)
ไฟล์: `Backend/middleware/ensureWithinShift.js`

- parseHHmm: ฟังก์ชันช่วยแปลงสตริงรูปแบบ HH:mm เป็นนาทีตั้งแต่เที่ยงคืน พร้อม validate ช่วง 00:00–23:59
- โหลดผู้ใช้จาก `req.user.userId` (ต้องผ่าน auth มาก่อน)
- กรณีไม่ได้กำหนดเวลาใด ๆ อนุญาต (fallback)
- กรณีมีแค่ `end` ให้บล็อกที่เวลา `now >= end`
- กรณีมีทั้ง `start` และ `end`:
  - ช่วงวันเดียว: อนุญาตเมื่อ `start <= now < end` (end เป็นขอบล่าง exclusive)
  - ช่วงข้ามคืน: อนุญาตเมื่อ `now >= start` หรือ `now < end`
- นอกหน้าต่างเวลา: ตอบ 403 พร้อม `code: SHIFT_OUTSIDE` เพื่อให้ FE แจ้งเตือน/เด้งกลับทันที

เหตุผลเชิงลอจิก: บังคับใช้นโยบายเวลางานทั้งฝั่ง API (server-side) และสื่อสารชัดเจนให้ FE จัดการ UX ได้ทันที

โค้ด (ensureWithinShift.js):

```javascript
const User = require('../models/user')

function parseHHmm(s) {
  if (!s || typeof s !== 'string') return null
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(min)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

module.exports = async function ensureWithinShift(req, res, next) {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    const u = await User.findById(userId).select('shiftStart shiftEnd username role').lean()
    if (!u) return res.status(401).json({ message: 'Unauthorized' })

    const startM = parseHHmm(u.shiftStart)
    const endM = parseHHmm(u.shiftEnd)
    // If not configured, allow
    if (startM == null && endM == null) return next()

    const now = new Date()
    const nowM = now.getHours() * 60 + now.getMinutes()

    // If only end is configured, block at end and after on the same day
    if (startM == null && endM != null) {
      if (nowM >= endM) {
        return res.status(403).json({ message: 'Shift ended', code: 'SHIFT_OUTSIDE', now: nowM, shiftEnd: u.shiftEnd })
      }
      return next()
    }
    // If only start is configured, allow all (can extend to block before start if needed)
    if (startM != null && endM == null) return next()

    // Both start and end configured
    let inWindow
    if (endM > startM) {
      // Same-day window: [start, end) — kick at the exact end minute
      inWindow = nowM >= startM && nowM < endM
    } else if (endM < startM) {
      // Overnight window: [start, 24:00) U [00:00, end) — kick at the exact end minute
      inWindow = (nowM >= startM) || (nowM < endM)
    } else {
      // start == end: treat as always allowed (no window)
      inWindow = true
    }

    if (!inWindow) {
      return res.status(403).json({ message: 'Shift ended', code: 'SHIFT_OUTSIDE', now: nowM, shiftStart: u.shiftStart, shiftEnd: u.shiftEnd })
    }
    return next()
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
}
```

ฉบับคอมเมนต์ท้ายบรรทัดทุกบรรทัด (inline):

```javascript
const User = require('../models/user') // โหลดโมเดล User สำหรับอ่าน shift ของผู้ใช้

function parseHHmm(s) { // แปลงสตริง HH:mm เป็นนาทีตั้งแต่ 00:00
  if (!s || typeof s !== 'string') return null // ถ้าไม่มีค่า/ไม่ใช่สตริง ให้คืน null
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/) // จับคู่รูปแบบ HH:mm
  if (!m) return null // รูปแบบไม่ตรง -> null
  const h = parseInt(m[1], 10) // ชั่วโมง (ฐานสิบ)
  const min = parseInt(m[2], 10) // นาที (ฐานสิบ)
  if (Number.isNaN(h) || Number.isNaN(min)) return null // ถ้าพาร์สไม่ได้ -> null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null // อยู่นอกช่วงเวลา -> null
  return h * 60 + min // คืนค่านาทีรวมตั้งแต่เที่ยงคืน
}

module.exports = async function ensureWithinShift(req, res, next) { // middleware ตรวจช่วงเวลางาน
  try { // ครอบด้วย try/catch เพื่อส่ง 500 หากผิดพลาดไม่คาดคิด
    const userId = req.user?.userId // อ่าน userId จาก JWT (ต้องผ่าน authMiddleware มาก่อน)
    if (!userId) return res.status(401).json({ message: 'Unauthorized' }) // ถ้าไม่มี -> 401
    const u = await User.findById(userId) // ค้นผู้ใช้จาก DB ตาม ID
      .select('shiftStart shiftEnd username role') // เลือกเฉพาะฟิลด์ที่ต้องใช้
      .lean() // คืนเป็น plain object เพื่อประหยัดหน่วยความจำ
    if (!u) return res.status(401).json({ message: 'Unauthorized' }) // ไม่พบบัญชี -> 401

    const startM = parseHHmm(u.shiftStart) // นาทีเริ่มกะ (อาจเป็น null ถ้าไม่ตั้ง)
    const endM = parseHHmm(u.shiftEnd) // นาทีกะสิ้นสุด (อาจเป็น null ถ้าไม่ตั้ง)
    if (startM == null && endM == null) return next() // ไม่ได้กำหนดช่วง -> อนุญาตเสมอ

    const now = new Date() // เวลาปัจจุบันฝั่งเซิร์ฟเวอร์
    const nowM = now.getHours() * 60 + now.getMinutes() // แปลงเป็นนาทีรวม

    if (startM == null && endM != null) { // กำหนดแค่เวลาเลิกงาน
      if (nowM >= endM) { // ถ้าถึง/เกินเวลาสิ้นสุดแล้ว
        return res.status(403).json({ message: 'Shift ended', code: 'SHIFT_OUTSIDE', now: nowM, shiftEnd: u.shiftEnd }) // บล็อก
      }
      return next() // ยังไม่ถึงเวลาเลิก -> ผ่าน
    }
    if (startM != null && endM == null) return next() // กำหนดแค่เริ่มงาน (ไม่บล็อกก่อนเริ่มในเวอร์ชันนี้)

    let inWindow // ตัวแปรบอกว่าเวลาปัจจุบันอยู่ในช่วงกะหรือไม่
    if (endM > startM) { // ช่วงวันเดียว เช่น 09:00–18:00
      inWindow = nowM >= startM && nowM < endM // [start, end) — ถึง end ปั๊บจะโดนเตะออก
    } else if (endM < startM) { // ช่วงข้ามคืน เช่น 22:00–06:00
      inWindow = (nowM >= startM) || (nowM < endM) // [start, 24:00) ∪ [00:00, end)
    } else { // start == end (ถือว่าไม่จำกัดช่วง)
      inWindow = true // อนุญาตเสมอ
    }

    if (!inWindow) { // ถ้าอยู่นอกช่วง
      return res.status(403).json({ message: 'Shift ended', code: 'SHIFT_OUTSIDE', now: nowM, shiftStart: u.shiftStart, shiftEnd: u.shiftEnd }) // บล็อกด้วยโค้ดเฉพาะ
    }
    return next() // อยู่ในช่วง -> ผ่านต่อ
  } catch (e) { // จับข้อผิดพลาดไม่คาดคิด
    console.error(e) // log ฝั่งเซิร์ฟเวอร์เพื่อดีบัก
    return res.status(500).json({ message: 'Server error' }) // แจ้ง client ว่าเกิดข้อผิดพลาดภายใน
  }
}
```

---

### middleware/ensureAdmin.js, ensurePermission.js, rateLimiter.js (สรุป)
- ensureAdmin.js: ตรวจ role จาก `req.user.role` ต้องเป็น `admin` ไม่เช่นนั้น 403
- ensurePermission.js: ดึงสิทธิ์ของผู้ใช้ ถ้ามี allowRoutes ให้ใช้แบบ allow-only; ถ้าไม่มีกลับไป baseline ตาม role; deny (ถ้ามี) override เสมอ
- rateLimiter.js: จำกัดความถี่ login เพื่อป้องกัน brute-force

---

### models (สรุป)
- user.js: เก็บข้อมูลผู้ใช้ บันทึกรหัสผ่าน hash (bcrypt), มีฟิลด์ `shiftStart`, `shiftEnd` ใช้กับช่วงเวลางาน
- product.js: เก็บสินค้า ฟิลด์ยอดนิยม เช่น sku, name, price, stock, status เป็นต้น
- permission.js: เก็บสิทธิ์รายผู้ใช้ `allowRoutes`, `denyRoutes`, `notes`
- activityLog.js: เก็บล๊อกกิจกรรม `action, actorUsername, actorRole, targetUsername, method, path, status, details, timestamps`
  - ข้อแนะนำด้านประสิทธิภาพ: เพิ่ม index `{ actorRole: 1, createdAt: -1 }` เพื่อเร่งการค้นหาแบบกรองบทบาท/เรียงเวลาย้อนหลัง

---

### routes — apiAuthRoutes.js
- POST `/api/auth/signup`: สร้างผู้ใช้ใหม่, hash password, บันทึก ActivityLog `user.create`
- POST `/api/auth/login`: ตรวจรหัสผ่าน จากนั้นตรวจช่วงเวลางาน หากอยู่นอกช่วง ตอบ 403 `SHIFT_OUTSIDE` ไม่ออก token; ถ้าในช่วง จึงออก JWT พร้อมข้อมูลบทบาทเบื้องต้นใน payload/response

เหตุผล: ปิดช่องว่างการ login นอกเวลา (แม้ยังไม่เรียก API อื่น)

โค้ดส่วนสำคัญ (login ตรวจช่วงเวลางาน):

```javascript
router.post("/login", loginRateLimiter, async (req, res) => {
  try {
    const { username: rawUsername, password } = req.body || {};
    const username = (rawUsername || "").trim();
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Invalid username or password" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid username or password" });

    // Check shift window BEFORE issuing token
    const startM = parseHHmmToMin(user.shiftStart)
    const endM = parseHHmmToMin(user.shiftEnd)
    if (startM != null || endM != null) {
      const now = new Date()
      const nowM = now.getHours() * 60 + now.getMinutes()
      let inWindow = true
      if (startM == null && endM != null) {
        inWindow = nowM < endM
      } else if (startM != null && endM == null) {
        inWindow = true
      } else if (startM != null && endM != null) {
        if (endM > startM) {
          inWindow = nowM >= startM && nowM < endM
        } else if (endM < startM) {
          inWindow = (nowM >= startM) || (nowM < endM)
        } else {
          inWindow = true
        }
      }
      if (!inWindow) {
        return res.status(403).json({ message: 'Shift ended', code: 'SHIFT_OUTSIDE' })
      }
    }

    const payload = { userId: user._id, role: user.role, username: user.username };
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: process.env.JWT_EXPIRES_IN || "1h" });
    res.json({ token, role: user.role, user: { username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
```

---

### routes — apiPermissionRoutes.js
- PATH_TO_KEY: แมป path → key สำหรับใช้ตรวจสิทธิ์ (admin.dashboard, admin.permissions, admin.logs, ... รวม warehouse.products ฯลฯ)
- GET `/api/permissions/me`: ส่งคืน allowRoutes/denyRoutes/role (ตั้ง header no-store เพื่อกันแคช)
- GET `/api/permissions/:username`: ผู้ดูแลดึงสิทธิ์ของผู้ใช้อื่น
- PUT `/api/permissions/:username`: อัปเดตสิทธิ์ผู้ใช้ (บันทึก ActivityLog `permissions.update`)
- POST `/api/permissions/check`: ตรวจสิทธิ์จาก path แบบเร็ว ๆ เพื่อ debug

---

### routes — apiProtectRoutes.js
- GET `/api/protect/dashboard`: ตัวอย่าง endpoint ที่ป้องกันด้วย JWT + ensureWithinShift
- Users: `/users` (list/pagination/search), `/users/:username` (get/update)
- Logs: GET `/api/protect/logs` รองรับตัวกรอง:
  - `q` ค้นใน action/path/actorUsername/targetUsername
  - `user` กรองเฉพาะ actor/target ตามชื่อผู้ใช้
  - `role=admin|cashier|warehouse` กรองบทบาทผู้กระทำ (actorRole)

โค้ดส่วน Logs (ตัวกรอง role):

```javascript
router.get('/logs', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.logs'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const q = (req.query.q || '').toString().trim()
    const user = (req.query.user || '').toString().trim()
    const role = (req.query.role || '').toString().trim().toLowerCase()

    const criteria = {}
    if (q) {
      criteria.$or = [
        { action: { $regex: q, $options: 'i' } },
        { path: { $regex: q, $options: 'i' } },
        { actorUsername: { $regex: q, $options: 'i' } },
        { targetUsername: { $regex: q, $options: 'i' } },
      ]
    }
    if (user) {
      criteria.$and = (criteria.$and || [])
      criteria.$and.push({ $or: [ { actorUsername: user }, { targetUsername: user } ] })
    }
    if (role && ['admin','cashier','warehouse'].includes(role)) {
      criteria.actorRole = role
    }

    const total = await ActivityLog.countDocuments(criteria)
    const items = await ActivityLog.find(criteria)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    res.json({ page, limit, total, items })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})
```

---

### routes — apiProductRoutes.js
- GET `/api/protect/products`: ค้นหา/จัดหน้า/เรียง; filter `status`; ค้นด้วย regex ที่ `sku,name,category,barcode`
- POST `/api/protect/products`: สร้างสินค้า ตรวจค่า price/stock/sku ซ้ำ; บันทึก ActivityLog `product.create`
- PUT `/api/protect/products/:id`: แก้ไขแบบ partial (ตั้งใจ pick เฉพาะฟิลด์ที่ส่งมา); `runValidators: true`; ป้องกัน SKU ชนกัน; บันทึก `product.update`
- DELETE `/api/protect/products/:id`: ลบและตอบ 204; บันทึก `product.delete`
- ทุก endpoint ป้องกันด้วย `authenticateToken` + `ensureWithinShift` + `ensurePermission(['admin.products','warehouse.products'])`

เหตุผล: อนุญาตให้ทั้ง admin และ warehouse เข้าถึงโมดูลสินค้า แต่สิทธิ์ถูกแยกที่ระดับ key

โค้ด (ย่อ หน้าสำคัญ):

```javascript
router.get('/', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const q = (req.query.q || '').toString().trim();
    const status = (req.query.status || '').toString().trim();
    const sortRaw = (req.query.sort || '-createdAt').toString();

    const criteria = {};
    if (q) {
      const qr = new RegExp(escapeRegExp(q), 'i');
      criteria.$or = [ { sku: qr }, { name: qr }, { category: qr }, { barcode: qr } ];
    }
    if (status === 'active' || status === 'inactive') criteria.status = status;

    const sort = {};
    sortRaw.split(',').forEach(k => { k = k.trim(); if (!k) return; if (k.startsWith('-')) sort[k.slice(1)] = -1; else sort[k] = 1; });

    const total = await Product.countDocuments(criteria);
    const items = await Product.find(criteria).sort(sort).skip((page - 1) * limit).limit(limit).lean();
    res.json({ page, limit, total, items });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});
```

---

## Frontend

### โครงสร้างเส้นทาง (App.jsx)
- `/` → Login (สาธารณะ)
- `/admin` → AdminLayout (มี children: dashboard, permissions, products, logs/*)
- `/sales` → Sales; `/warehouse` → Warehouse; `/warehouse/products` → ใช้หน้า ProductManagement แบบห่อ (wrapper) เช่นเดียวกับฝั่ง admin
- `/admin/logs/*` แยกเป็น `/all`, `/admin`, `/cashier`, `/warehouse`

### axiosSetup.js
- request interceptor: แนบท้าย Authorization จาก localStorage
- response interceptor: ถ้า 401/403 ล้าง token
  - ถ้า `code === 'SHIFT_OUTSIDE'`:
    - ระหว่าง login: alert ไทย "ไม่สามารถเข้าสู่ระบบได้ เนื่องจากคุณอยู่นอกเวลางานแล้ว"
    - ระหว่างใช้งาน: alert ไทย "คุณอยู่นอกเวลางานแล้ว ไม่สามารถใช้งานระบบได้" และ redirect ไปหน้า Login

โค้ด (axiosSetup.js):

```javascript
import axios from 'axios'

// Attach Authorization header from localStorage automatically
axios.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('api_token')
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {}
  return config
})

// Optional: Handle 401 by clearing token to avoid loops and allow clean login
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const code = error?.response?.data?.code
    const url = error?.config?.url || ''
    if (status === 401 || status === 403) {
      try { localStorage.removeItem('api_token') } catch {}
      // If shift ended
      if (code === 'SHIFT_OUTSIDE') {
        try {
          if (url.includes('/api/auth/login')) {
            // Login attempt outside shift: show specific alert, stay on login page
            window.alert('ไม่สามารถเข้าสู่ระบบได้ เนื่องจากคุณอยู่นอกเวลางานแล้ว')
          } else {
            // When kicked out while using the app: alert then redirect to login
            window.alert('คุณอยู่นอกเวลางานแล้ว ไม่สามารถใช้งานระบบได้')
            window.location.replace('/')
          }
        } catch {}
      }
    }
    return Promise.reject(error)
  }
)
```

### ProtectedRoute.jsx
- ดึง routeKey จาก path โดย mapping ในไฟล์
- เรียก `/api/permissions/me` เพื่ออ่าน allowRoutes แล้วตัดสินใจแบบ allow-only: อนุญาตเมื่อ key อยู่ใน allowRoutes เท่านั้น
- ป้องกัน loop redirect และกรณีไม่มี mapping อนุญาตโดยค่าเริ่มต้น (ดีสำหรับหน้า public/utility)

โค้ด (บางส่วนสำคัญ):

```jsx
const PATH_TO_KEY = [
  { path: /^\/admin\/dashboard$/, key: 'admin.dashboard' },
  { path: /^\/admin\/permissions(?:\/.*)?$/, key: 'admin.permissions' },
  // Fine-grained logs
  { path: /^\/admin\/logs\/all$/, key: 'admin.logs.all' },
  { path: /^\/admin\/logs\/admin$/, key: 'admin.logs.admin' },
  { path: /^\/admin\/logs\/cashier$/, key: 'admin.logs.cashier' },
  { path: /^\/admin\/logs\/warehouse$/, key: 'admin.logs.warehouse' },
  { path: /^\/admin\/products(?:\/.*)?$/, key: 'admin.products' },
  { path: /^\/sales(?:\/.*)?$/, key: 'sales.home' },
  { path: /^\/warehouse(?:\/.*)?$/, key: 'warehouse.home' },
  { path: /^\/warehouse\/products(?:\/.*)?$/, key: 'warehouse.products' },
]

// ...
const res = await axios.get(`${API_BASE}/api/permissions/me`, { headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}`, 'Cache-Control': 'no-cache' }, params: { t: Date.now() } })
const me = res.data || {}
const allowRoutes = Array.isArray(me.allowRoutes) ? me.allowRoutes : []
const can = allowRoutes.includes(routeKey) // allow-only policy
```

### NavBar.jsx
- อ่านสิทธิ์จาก `/api/permissions/me` และรีเฟรชทุก 60 วินาที เพื่อสะท้อนการเปลี่ยนสิทธิ์/สิ้นสุดกะ
- แสดงเมนูเฉพาะคีย์ที่อยู่ใน allowRoutes
- เมนู Logs แยกเป็น 4 ลิงก์ เมื่อมี `admin.logs` หรือคีย์ย่อย (all/admin/cashier/warehouse)
- สำหรับ Sales/Warehouse มีลิงก์ Logs เฉพาะ (ถ้าเปิดคีย์ `sales.logs`, `warehouse.logs`)

โค้ด (บางส่วนสำคัญ):

```jsx
const isAllowed = useMemo(() => {
  const allow = new Set(perm.allowRoutes || [])
  return (key) => allow.has(key)
}, [perm.allowRoutes])

// Admin links
{(isAllowed('admin.logs') || isAllowed('admin.logs.all')) && <MenuLink to="/admin/logs/all">Logs (All)</MenuLink>}
{(isAllowed('admin.logs') || isAllowed('admin.logs.admin')) && <MenuLink to="/admin/logs/admin">Logs - Admin</MenuLink>}
{(isAllowed('admin.logs') || isAllowed('admin.logs.cashier')) && <MenuLink to="/admin/logs/cashier">Logs - Cashier</MenuLink>}
{(isAllowed('admin.logs') || isAllowed('admin.logs.warehouse')) && <MenuLink to="/admin/logs/warehouse">Logs - Warehouse</MenuLink>}

// Sales/Warehouse log links
{isAllowed('sales.logs') && <MenuLink to="/sales/logs">Logs</MenuLink>}
{isAllowed('warehouse.logs') && <MenuLink to="/warehouse/logs">Logs</MenuLink>}
```

### Login.jsx
- ส่งคำขอ `/api/auth/login`
- เก็บ token/role/username ลง localStorage; map role ไป path หลัก; รองรับกรณี token ไม่มี role โดย decode payload
- แสดง error ที่เหมาะสมจาก response

### AdminLayout.jsx
- โครงหน้าหลัก admin มี NavBar (ซ้าย/บนเมื่อจอแคบ), TopBar และ Outlet สำหรับหน้า child

### ProductManagement.jsx (สรุป)
- UI จัดการสินค้า: ค้นหา/จัดหน้า/แก้ไขแบบ modal/ toggle สถานะแบบ optimistic
- จัด layout ตารางโดยคุมความกว้าง/หัวตารางไม่ขยับ

### Logs Views
- Reusable `LogsView.jsx` ใช้เรียก `/api/protect/logs` พร้อมใส่ `role` คงที่เมื่อเป็นหน้าเฉพาะ (admin/cashier/warehouse)
- AllLogs.jsx, AdminLogs.jsx, CashierLogs.jsx, WarehouseLogs.jsx เป็นตัวห่อที่ส่ง prop ให้ LogsView

### Warehouse Products wrapper
- `/warehouse/products` เรนเดอร์หน้าจัดการสินค้าร่วมกับ admin แต่ถูกควบคุมสิทธิ์ด้วย key `warehouse.products`

---

## แนวคิดสิทธิ์ (Permissions) และการ Mapping
- ฝั่ง BE: `apiPermissionRoutes.js` กำหนด PATH_TO_KEY เพื่อบอกว่า path ไหนตรงกับ key อะไร
- ฝั่ง FE: `ProtectedRoute.jsx` และ `NavBar.jsx` มีกลไก mapping/ตรวจด้วย allowRoutes ในแบบ allow-only
- ปฏิบัติที่แนะนำ: ตั้ง allowRoutes ชัดเจนให้กับทุกผู้ใช้/ทุกบทบาท เพื่อหลีกเลี่ยงพึ่งพา baseline มากเกินไป

---

## แนวคิดช่วงเวลางาน (Shift)
- บังคับใช้ทั้งระหว่าง Login (ป้องกันออก token) และทุก API ที่สำคัญด้วย `ensureWithinShift`
- กำหนดขอบช่วงเป็น [start, end) เพื่อให้ "หมดสิทธิ์ทันทีที่ถึงนาทีสิ้นสุด"
- FE interceptors ดัก 403 `SHIFT_OUTSIDE` เพื่อแจ้งเตือนภาษาไทยและเด้งหน้า Login

---

## ข้อเสนอแนะด้านประสิทธิภาพและบำรุงรักษา
- เพิ่ม index ให้ ActivityLog: `{ actorRole: 1, createdAt: -1 }` เพื่อเร่งการค้นหา logs แยกบทบาทไล่เวลา
- ถ้าต้องการมุมมองตามโมดูล ยกระดับด้วยฟิลด์ `category` (เช่น 'products','permissions','auth') และเติมค่าในทุกจุดที่ `ActivityLog.create`
- เขียนสคริปต์ migration/backfill เพื่อเติมค่าให้ข้อมูลเก่าที่ขาด `actorRole` หรือ `category`

---

เอกสารนี้มุ่งให้ภาพรวมและรายละเอียดระดับที่อ่านโค้ดประกอบได้ทันที หากต้องการให้ผมเพิ่มการอธิบายแบบไล่บรรทัดสำหรับไฟล์อื่นเพิ่มเติม (เช่น `apiAuthRoutes.js`, `apiProductRoutes.js`, หรือฝั่ง Frontend อย่าง `ProtectedRoute.jsx`, `NavBar.jsx`) แจ้งชื่อไฟล์ ผมจะขยายส่วน "ไล่อธิบายทีละบรรทัด" ให้ในหัวข้อของไฟล์นั้น ๆ เพิ่มเติมได้ทันทีครับ

---

## ภาคผนวก: โค้ดพร้อมคำอธิบายแบบบรรทัดต่อบรรทัด (ทุก API ที่สำคัญ)

ด้านล่างนี้เป็นโค้ดจริงจากแต่ละไฟล์เส้นทาง (Routes) และ Middleware ที่เกี่ยวข้อง พร้อมคำอธิบายประกบในรูปแบบคอมเมนต์ `//` ต่อท้ายแต่ละบรรทัด เพื่อให้เห็นภาพการทำงานโดยไม่ต้องเปิดไฟล์ต้นฉบับ

### Backend/routes/apiAuthRoutes.js — Signup/Login

```javascript
const express = require("express"); // ใช้ Express เพื่อแยกกลุ่ม API เป็น Router ชัดเจน
const jwt = require("jsonwebtoken"); // JWT ใช้ลงนาม/ตรวจสอบโทเคนเพื่อยืนยันตัวตนฝั่งเซิร์ฟเวอร์
const router = express.Router(); // แยก concerns ต่อกลุ่มเส้นทาง ช่วยทดสอบ/บำรุงรักษาง่าย
const User = require("../models/user"); // โมเดลผู้ใช้ (เข้าถึงข้อมูล/ตรวจรหัสผ่าน/ฟิลด์ shift)
const ActivityLog = require("../models/activityLog"); // โมเดลบันทึกกิจกรรม (audit trail)
const { loginRateLimiter } = require("../middleware/rateLimiter"); // ป้องกัน brute-force ที่จุด login

const SECRET_KEY = process.env.JWT_SECRET // เก็บคีย์ไว้ใน env เพื่อความปลอดภัย/ยืดหยุ่นระหว่างสภาพแวดล้อม

router.post("/signup", async (req, res) => { // ใช้ POST เพราะมีผลสร้าง resource และมีข้อมูลละเอียดอ่อน
  try { // ป้องกันเซิร์ฟเวอร์ล้มจากข้อผิดพลาดไม่คาดคิด
    const { username: rawUsername, password, role,
      firstName, lastName, birthdate, phone, email, gender, shiftStart, shiftEnd
    } = req.body || {}; // รับข้อมูลผู้ใช้จาก body (REST-conventional)
    const username = (rawUsername || "").trim(); // บังคับ trim กัน whitespace ที่ไม่ตั้งใจ
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required" }); // ป้องกันค่าว่างผ่านเข้ามา

    if (role && !["admin", "warehouse", "cashier"].includes(role)) { // บังคับบทบาทตาม white-list
      return res.status(400).json({ message: "Invalid role" }); // ลดความเสี่ยงข้อมูลเสียรูป
    }

    const existing = await User.findOne({ username }); // ป้องกัน username ชนซ้ำที่ DB ชั้นตรรกะ
    if (existing) return res.status(409).json({ message: "Username already exists" }); // ใช้ 409 Conflict ตามมาตรฐาน

    const user = new User({ // กำหนดเฉพาะฟิลด์อนุญาต (ลด mass-assignment risk)
      username, role, firstName, lastName,
      birthdate: birthdate ? new Date(birthdate) : undefined, // แปลงเป็น Date เพื่อ type consistency
      phone, email, gender, shiftStart, shiftEnd,
    });
    await user.setPassword(password); // แยกการ hash ไว้ในโมเดลเพื่อรวม logic/ซ่อนรายละเอียด
    await user.save(); // persist ลงฐานข้อมูล
    try { // พยายามบันทึก log (ไม่ให้ log failure ทำให้ฟีเจอร์หลักล้ม)
      await ActivityLog.create({
        action: 'user.create', // ใช้ action แบบ namespace.module เพื่อคัดกรองง่าย
        actorUsername: req.user?.username || username, // ผู้สร้าง (ถ้า self-signup)
        actorRole: req.user?.role || role || 'unknown', // บทบาทผู้กระทำ
        targetUsername: username, // เป้าหมายคือบัญชีใหม่
        method: req.method, path: req.originalUrl, status: 201, // บันทึก context HTTP
        details: { role } // รายละเอียดสำคัญที่ติดตาม
      })
    } catch (e) {}
    res.status(201).json({ message: "User created" }); // ใช้ 201 Created ตามมาตรฐาน
  } catch (err) {
    console.error(err); // ช่วย debug ฝั่งเซิร์ฟเวอร์
    res.status(500).json({ message: "Server error" }); // ปกปิดรายละเอียดภายใน (security)
  }
});

router.post("/login", loginRateLimiter, async (req, res) => { // rate limit ที่จุดอ่อนไหวที่สุด
  try {
    const { username: rawUsername, password } = req.body || {}; // อ่านข้อมูลเข้าสู่ระบบ
    const username = (rawUsername || "").trim(); // normalize ให้ตรงกันกรณีมีช่องว่างเผลอพิมพ์
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required" }); // fail-fast ลดภาระ DB

    const user = await User.findOne({ username }); // ค้นผู้ใช้โดย username ที่ unique
    if (!user) return res.status(401).json({ message: "Invalid username or password" }); // ปิดเผยว่า user/pass ไหนผิดเพื่อความปลอดภัย

    const match = await user.comparePassword(password); // ใช้เมธอดในโมเดลเพื่อรวม logic hash/verify
    if (!match) return res.status(401).json({ message: "Invalid username or password" }); // ตอบรวม

    // บังคับนโยบายช่วงเวลางานก่อนออก token เพื่อปิดช่องว่างใช้งานนอกเวลากะ
    function parseHHmmToMin(s) { // แปลง HH:mm -> จำนวนนาทีจาก 00:00 โดย validate ด้วย regex
      if (!s || typeof s !== 'string') return null // รองรับค่าว่าง/ชนิดผิด
      const m = s.trim().match(/^(\d{1,2}):(\d{2})$/) // กรองรูปแบบให้แน่ใจ
      if (!m) return null // ไม่ตรง pattern
      const h = parseInt(m[1], 10) // ชั่วโมง
      const min = parseInt(m[2], 10) // นาที
      if (Number.isNaN(h) || Number.isNaN(min)) return null // ป้องกัน NaN
      if (h < 0 || h > 23 || min < 0 || min > 59) return null // อยู่ในช่วงเวลาได้จริง
      return h * 60 + min // นาทีรวม ใช้เปรียบเทียบง่าย
    }
    const startM = parseHHmmToMin(user.shiftStart) // map เวลาเริ่มงานของผู้ใช้
    const endM = parseHHmmToMin(user.shiftEnd) // map เวลาเลิกงานของผู้ใช้
    if (startM != null || endM != null) { // มีการกำหนดกะ
      const now = new Date() // เวลาปัจจุบัน
      const nowM = now.getHours() * 60 + now.getMinutes() // นาทีรวมปัจจุบัน
      let inWindow = true // ตั้งต้นว่าผ่านจนกว่าจะพิสูจน์ว่าไม่ผ่าน
      if (startM == null && endM != null) inWindow = nowM < endM // ตั้งแค่ end -> ตัดสิทธิ์เมื่อถึง end
      else if (startM != null && endM == null) inWindow = true // ตั้งแค่ start -> เวอร์ชันนี้ไม่บล็อกก่อนเริ่ม
      else if (startM != null && endM != null) { // ครบทั้ง start/end
        if (endM > startM) inWindow = nowM >= startM && nowM < endM // ช่วงวันเดียว [start, end)
        else if (endM < startM) inWindow = (nowM >= startM) || (nowM < endM) // ช่วงข้ามคืน
        else inWindow = true // start==end -> เทียบเป็นไม่จำกัด
      }
      if (!inWindow) return res.status(403).json({ message: 'Shift ended', code: 'SHIFT_OUTSIDE' }); // แจ้ง code ให้ FE แปลข้อความได้
    }

    const payload = { userId: user._id, role: user.role, username: user.username }; // payload เล็กพอสำหรับ token
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }); // อายุสั้นลดความเสี่ยง
    res.json({ token, role: user.role, user: { username: user.username, role: user.role } }); // ส่ง role ซ้ำช่วย FE ตัดสินใจเร็ว
  } catch (err) {
    console.error(err); // สำหรับดีบัก
    res.status(500).json({ message: "Server error" }); // ไม่รั่วข้อมูลภายใน
  }
});

module.exports = router; // ส่งออก Router ให้ server.js นำไป mount ตาม path group
```

### Backend/routes/apiPermissionRoutes.js — Permissions

```javascript
const express = require('express'); // ใช้ Express Router แยก concerns ของ permissions ออกจากกลุ่มอื่น
const router = express.Router(); // Router เฉพาะโมดูล permissions
const authenticateToken = require('../middleware/authMiddleware'); // บังคับมี JWT เพื่อรู้ว่าใครกำลังถามสิทธิ์
const ensureWithinShift = require('../middleware/ensureWithinShift'); // บังคับในช่วงเวลางาน เพื่อให้มุมมองสิทธิ์สอดคล้องการใช้งานจริง
const ensureAdmin = require('../middleware/ensureAdmin'); // endpoint บางอันจำกัดเฉพาะ admin
const ensurePermission = require('../middleware/ensurePermission'); // ตรวจ key รายทางเพื่อความยืดหยุ่น
const User = require('../models/user'); // โมเดลผู้ใช้ ใช้ join หาเอกสารสิทธิ์
const Permission = require('../models/permission'); // โมเดลสิทธิ์แบบ user-scoped
const ActivityLog = require('../models/activityLog'); // บันทึกการเปลี่ยนสิทธิ์เพื่อ audit

// กำหนดแมป path → key ให้ตรงกับ FE/BE เพื่อลด drift ระหว่างระบบ
const PATH_TO_KEY = [
  { path: /^\/admin\/dashboard$/, key: 'admin.dashboard' }, // แดชบอร์ดผู้ดูแล
  { path: /^\/admin\/permissions(?:\/.*)?$/, key: 'admin.permissions' }, // จัดการสิทธิ์
  { path: /^\/admin\/logs(?:\/.*)?$/, key: 'admin.logs' }, // คีย์รวม (รองรับของเดิม)
  { path: /^\/admin\/products(?:\/.*)?$/, key: 'admin.products' }, // จัดการสินค้า (แอดมิน)
  { path: /^\/sales(?:\/.*)?$/, key: 'sales.home' }, // โฮมของเซลส์
  { path: /^\/warehouse\/products(?:\/.*)?$/, key: 'warehouse.products' }, // สินค้าฝั่งโกดัง
  { path: /^\/warehouse(?:\/.*)?$/, key: 'warehouse.home' }, // โฮมโกดัง
];

function pathToKey(pathname) { // ช่วยแปลง URL path ที่ร้องขอให้เป็นคีย์สิทธิ์
  for (const m of PATH_TO_KEY) { // เดินตามรายการแบบ explicit
    if (m.path.test(pathname)) return m.key; // เจออันแรกที่ match -> คืนคีย์นั้น
  }
  return null; // ไม่รู้จัก path -> มองว่าเป็นเสรีภาพ (ขึ้นกับจุดเรียกใช้)
}

// ดึงสิทธิ์ของตัวเอง: ใช้โดย FE เพื่อเรนเดอร์เมนู/ป้องกันหน้าแบบ allow-only
router.get('/me', authenticateToken, ensureWithinShift, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store'); // ป้องกันข้อมูลสิทธิ์ค้างแคช ทำให้ UI เพี้ยน
    res.set('Pragma', 'no-cache'); // เผื่อพร็อกซีเก่า ๆ
    res.set('Expires', '0'); // บังคับหมดอายุทันที
    const user = await User.findById(req.user.userId).lean(); // อ้างผู้ใช้จาก payload JWT
    if (!user) return res.status(404).json({ message: 'User not found' }); // ความปลอดภัย/ความถูกต้องของข้อมูล

    const perm = await Permission.findOne({ user: user._id }).lean(); // สิทธิ์เฉพาะรายผู้ใช้
    const roleBaseline = { // baseline per-role (ใช้เมื่อยังไม่กำหนด allowRoutes)
      admin: ['admin.dashboard', 'admin.permissions', 'admin.logs', 'admin.products'],
      cashier: ['sales.home'],
      warehouse: ['warehouse.home'],
    };
    const allowRoutes = (perm?.allowRoutes && perm.allowRoutes.length > 0)
      ? perm.allowRoutes // ใช้ allow-only model หากกำหนดไว้แล้ว
      : (roleBaseline[user.role] || []); // ไม่งั้น fallback ตามบทบาทเพื่อลด friction ช่วงต้น
    const denyRoutes = perm?.denyRoutes || []; // เผื่อกรณีต้องบังคับปฏิเสธเฉพาะจุด

    res.json({ username: user.username, role: user.role, allowRoutes, denyRoutes }); // FE นำไปใช้เรนเดอร์/ปกป้องเส้นทาง
  } catch (e) {
    console.error(e); // ตรวจสอบภายหลังได้
    res.status(500).json({ message: 'Server error' }); // ไม่เผยรายละเอียดภายใน
  }
});

// ผู้ดูแลอ่านสิทธิ์ของผู้ใช้รายใดรายหนึ่ง (สำหรับหน้าจัดการสิทธิ์)
router.get('/:username', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.permissions'), async (req, res) => {
  try {
    const { username } = req.params; // อ่านพารามิเตอร์จาก URL
    const user = await User.findOne({ username }).lean(); // หาผู้ใช้ตามชื่อ
    if (!user) return res.status(404).json({ message: 'User not found' }); // ป้องกันข้อมูลเปล่า
    const perm = await Permission.findOne({ user: user._id }).lean(); // ดึงเอกสารสิทธิ์หากมี
    res.json({
      username, role: user.role, // ตอบข้อมูลพื้นฐานสำหรับ UI
      allowRoutes: perm?.allowRoutes || [], // ไม่มีเอกสาร -> ให้เป็นอาร์เรย์ว่าง
      denyRoutes: perm?.denyRoutes || [],
      updatedAt: perm?.updatedAt || null,
      updatedBy: perm?.updatedBy || null,
    });
  } catch (e) {
    console.error(e); // ช่วยดีบักเวลามีปัญหา
    res.status(500).json({ message: 'Server error' }); // รักษาความปลอดภัยของระบบ
  }
});

// ผู้ดูแลอัปเดตสิทธิ์ของผู้ใช้ (ใช้ upsert เพื่อให้ใช้งานครั้งแรกได้เลย)
router.put('/:username', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.permissions'), async (req, res) => {
  try {
    const { username } = req.params; // ระบุเป้าหมาย
    const { allowRoutes = [], denyRoutes = [], notes } = req.body || {}; // รับข้อมูลใหม่
    const user = await User.findOne({ username }); // verify เป้าหมายมีอยู่จริง
    if (!user) return res.status(404).json({ message: 'User not found' });

    const doc = await Permission.findOneAndUpdate( // ใช้ findOneAndUpdate เพื่อ atomic upsert
      { user: user._id }, // เงื่อนไขตามผู้ใช้
      {
        $set: {
          allowRoutes: Array.isArray(allowRoutes) ? allowRoutes : [], // ป้องกันชนิดผิดพลาด
          denyRoutes: Array.isArray(denyRoutes) ? denyRoutes : [],
          notes: notes || undefined, // เก็บโน้ตประกอบการกำหนดสิทธิ์
          updatedBy: req.user?.username || 'admin', // audit ผู้ที่แก้ไขล่าสุด
        },
      },
      { new: true, upsert: true } // new เพื่อได้เอกสารล่าสุด, upsert เพื่อสร้างหากยังไม่มี
    );

    try { // log เพื่อมีหลักฐานการปรับสิทธิ์ (สำคัญต่อ compliance)
      await ActivityLog.create({
        action: 'permissions.update',
        actorUsername: req.user?.username || 'unknown',
        actorRole: req.user?.role || 'unknown',
        targetUsername: username,
        method: req.method, path: req.originalUrl, status: 200,
        details: { allowRoutes: doc.allowRoutes, denyRoutes: doc.denyRoutes }
      })
    } catch (e) { }

    res.json({ // ส่งคืนสถานะปัจจุบันเพื่ออัปเดต UI ทันที
      username: user.username,
      allowRoutes: doc.allowRoutes,
      denyRoutes: doc.denyRoutes,
      notes: doc.notes,
      updatedBy: doc.updatedBy,
      updatedAt: doc.updatedAt,
    });
  } catch (e) {
    console.error(e); // แสดงในเซิร์ฟเวอร์
    res.status(500).json({ message: 'Server error' }); // มาตรฐานตอบกลับความผิดพลาดทั่วไป
  }
});

// Utility สำหรับ debug สิทธิ์โดยส่ง path แล้วให้ระบบบอกว่า "อนุญาตไหม" และเพราะอะไร
router.post('/check', authenticateToken, ensureWithinShift, async (req, res) => {
  try {
    const { path } = req.body || {}; // อ่าน path จาก body
    if (!path) return res.status(400).json({ message: 'path required' }); // ป้องกันการเรียกผิดรูปแบบ
    const key = pathToKey(path); // แปลง path -> permission key
    if (!key) return res.json({ allowed: true, reason: 'unmapped-path' }); // path ไม่ถูกแมป -> ไม่บล็อกโดยดีฟอลต์

    const me = await User.findById(req.user.userId).lean(); // ข้อมูลผู้เรียก
    const perm = await Permission.findOne({ user: me._id }).lean(); // สิทธิ์ของผู้เรียก
    const allowRoutes = perm?.allowRoutes || []; // รายการอนุญาต
    const denyRoutes = perm?.denyRoutes || []; // รายการปฏิเสธ

    const roleBaseline = { // baseline เมื่อไม่มี allowRoutes
      admin: ['admin.dashboard', 'admin.permissions', 'admin.logs', 'admin.products'],
      cashier: ['sales.home'],
      warehouse: ['warehouse.home'],
    };

    let allowed; // คำนวณผลสุดท้ายตามกฎ allow-only + baseline + deny override
    if (allowRoutes.length > 0) { // มี allowRoutes -> ใช้แบบ allow-only
      allowed = allowRoutes.includes(key);
    } else {
      allowed = (roleBaseline[me.role] || []).includes(key); // ยังไม่ตั้ง -> ย้อนกลับ baseline ของบทบาท
    }
    if (denyRoutes.includes(key)) allowed = false; // deny ชนะทุกกรณีเพื่อความปลอดภัย

    res.json({ allowed, key, role: me.role, allowRoutes, denyRoutes }); // คืนข้อมูลเต็มเพื่อการตรวจสอบ
  } catch (e) {
    console.error(e); // ช่วยสืบค้นเหตุ
    res.status(500).json({ message: 'Server error' }); // ไม่เปิดเผยโครงสร้างภายใน
  }
});

module.exports = router; // export เพื่อให้ server.js นำไปใช้
```

### Backend/routes/apiSalesRoutes.js — Sales (สร้าง/ดู/ค้นบิลขาย)

```javascript
const express = require("express"); // ใช้ Router แยกกลุ่ม sales ชัดเจน
const router = express.Router(); // Router เฉพาะโมดูลขาย
const mongoose = require("mongoose"); // ใช้ตรวจ ObjectId และ query เงื่อนไข
const crypto = require("crypto"); // สุ่มเลขสั้นๆ ใช้ต่อท้ายเลขบิล
const Sale = require("../models/sale"); // โมเดลบิลขาย
const Product = require("../models/product"); // โมเดลสินค้า (เพื่อหักสต็อก)
const authenticateToken = require("../middleware/authMiddleware"); // บังคับ JWT
const ensurePermission = require("../middleware/ensurePermission"); // ตรวจสิทธิ์เป็นคีย์

// 🔹 robust invoice generator — YYYYMMDD-xxxx (hex)
function genInvoiceNo() { // สร้างเลขบิลโดยอิงวันที่และเลขสุ่มสั้นๆ
  const d = new Date(); // วันที่วันนี้
  const rand = crypto.randomBytes(2).toString("hex"); // สุ่ม 2 ไบต์เป็นเฮ็ก 4 ตัว
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${rand}`; // รูปแบบ YYYYMMDD-xxxx
}

// 🔸 POST /api/protect/sales — สร้างบิลขายใหม่และตัดสต็อก
router.post(
  "/",
  authenticateToken, // ต้องยืนยันตัวตน
  // อนุญาตทั้งสิทธิ์ sales.create หรือสิทธิ์รวมของแคชเชียร์ sales.cashier
  ensurePermission(["sales.create", "sales.cashier"]),
  async (req, res) => {
    console.log("Sale POST req.body:", JSON.stringify(req.body, null, 2)); // log สำหรับดีบัก
    try {
      const { // รับค่าสรุปการขายจาก FE
        items = [], // รายการสินค้า [{ productId?, sku?, name, unitPrice, qty }]
        subtotal = 0, // ยอดย่อย
        discount = 0, // ส่วนลดรวม
        vat = 0, // ภาษีมูลค่าเพิ่ม
        total = 0, // ยอดสุทธิ
        payment = {}, // ข้อมูลการชำระเงิน
        paymentIntentId, // เผื่อแนบ id ของ PaymentIntent เพื่อผูกกับ webhook
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) // ต้องมี item อย่างน้อย 1 รายการ
        return res.status(400).json({ message: "No items" });

      // 🔹 validate และหักสต็อกตามจำนวนที่ขาย
      for (const it of items) { // วนตรวจแต่ละรายการ
        if (it.productId) { // มีการอ้างถึง productId ในระบบสต็อก
          const p = await Product.findById(it.productId); // ดึงสินค้า
          if (!p)
            return res.status(400).json({ message: `Invalid product ${it.name}` }); // ไม่พบสินค้า
          if (typeof p.stock === "number" && p.stock < (it.qty || 0)) { // สต็อกไม่พอ
            return res.status(400).json({ message: `Insufficient stock for ${it.name}` });
          }
          if (typeof p.stock === "number") { // หักสต็อกแบบลดจำนวน
            p.stock = p.stock - (it.qty || 0);
            await p.save(); // เซฟกลับฐานข้อมูล
          }
        }
      }

      // จัดมาตรฐานข้อมูลชำระเงินให้มีโครงสร้างแน่นอน
      const normalizedPayment = {
        method: String(req.body.payment?.method || "cash").toLowerCase(), // cash/card/qr/wallet
        amountReceived: Number(req.body.payment?.amountReceived ?? 0), // ยอดที่รับมา
        change: Number(req.body.payment?.change ?? 0), // เงินทอน (ถ้ามี)
        details: req.body.payment?.details || {}, // รายละเอียดอื่น ๆ (เช่น paymentIntentId)
      };
      console.log("Normalized payment:", JSON.stringify(normalizedPayment, null, 2)); // log สะดวกดีบัก

      // ตรวจ items ซ้ำอีกครั้ง (กันข้อมูลไม่ครบ)
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ message: "No items" });

      if (!items.every((it) => it.name && it.qty != null && it.unitPrice != null)) { // ต้องมี name/qty/unitPrice ครบ
        return res.status(400).json({ message: "Invalid items: missing name/qty/unitPrice" });
      }

      console.log("Creating sale with:", normalizedPayment); // log ก่อนสร้างจริง
      const sale = await Sale.create({ // บันทึกบิลขาย
        invoiceNo: genInvoiceNo(), // เลขบิลที่ไม่ซ้ำ
        createdBy: req.user?.userId, // อ้างผู้สร้างจาก JWT
        cashierName: req.user?.username || req.user?.name || "unknown", // ชื่อแคชเชียร์
        items: items.map((it) => ({ // map ฟิลด์ให้แน่นอนเป็นตัวเลข
          productId: it.productId || null,
          sku: it.sku || "",
          name: it.name,
          unitPrice: Number(it.unitPrice),
          qty: Number(it.qty),
          lineTotal: Number(it.unitPrice || 0) * Number(it.qty || 0), // ราคารวมแถว
        })),
        subtotal: Number(subtotal),
        discount: Number(discount),
        vat: Number(vat),
        total: Number(total),
        payment: normalizedPayment, // โครงสร้างชำระเงินมาตรฐาน
        meta: paymentIntentId ? { paymentIntentId } : undefined, // ผูก intent เพื่อค้นภายหลังได้
      });

      res.status(201).json({ // ตอบกลับพร้อมข้อมูลสำคัญ
        saleId: sale._id,
        invoiceNo: sale.invoiceNo,
        payment: sale.payment,
        sale,
      });
    } catch (err) {
      console.error(err); // log เซิร์ฟเวอร์
      if (err.code === 11000) { // duplicate key (เช่น invoiceNo ซ้ำ)
        return res.status(409).json({ message: "Duplicate invoice number" });
      }
      res.status(500).json({ message: "Server error" }); // ผิดพลาดทั่วไป
    }
  }
);

// GET /api/protect/sales/by-intent/:id — ค้นบิลจาก Stripe PaymentIntent
router.get(
  "/by-intent/:id",
  authenticateToken,
  ensurePermission("sales.view"), // ต้องมีสิทธิ์ดูบิล
  async (req, res) => {
    try {
      const pid = req.params.id; // intent id จาก URL
      if (!pid) return res.status(400).json({ message: "Missing intent id" });
      const sale = await Sale.findOne({ "payment.details.paymentIntentId": pid }) // ค้นในฟิลด์ details
        .select("invoiceNo createdAt items subtotal discount vat total payment") // เลือกฟิลด์ที่ต้องใช้
        .lean(); // คืน plain object
      if (!sale) return res.status(404).json({ message: "Not found" }); // ไม่พบบิล
      return res.json(sale); // ตอบบิลที่พบ
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔸 GET /api/protect/sales/:id — ดูบิลเดี่ยว (เติม unitPrice/lineTotal หากขาด)
router.get(
  "/:id",
  authenticateToken,
  ensurePermission("sales.view"),
  async (req, res) => {
    try {
      let sale = await Sale.findById(req.params.id)
        .select("invoiceNo createdAt items subtotal discount vat total payment") // ฟิลด์จำเป็น
        .lean();
      if (!sale) return res.status(404).json({ message: "Not found" }); // ไม่พบ
      // เติมข้อมูลราคาต่อหน่วยกรณีอดีตมีแต่ lineTotal หรือข้อมูลขาด
      if (Array.isArray(sale.items) && sale.items.length > 0) {
        const enriched = await Promise.all(
          sale.items.map(async (it) => {
            const qty = Number(it.qty) || 0; // จำนวนชิ้น
            let unit = undefined; // ราคาต่อหน่วยที่จะคำนวณ
            if (it.unitPrice != null && !isNaN(it.unitPrice)) unit = Number(it.unitPrice); // ใช้ unitPrice ที่มี
            else if (it.lineTotal != null && qty > 0) unit = Number(it.lineTotal) / qty; // ย้อนกลับจาก lineTotal
            if ((unit == null || isNaN(unit)) && it.productId) { // ถ้ายังไม่มี ลองดึงราคาสินค้า
              try {
                const p = await Product.findById(it.productId).select("price").lean(); // ขอเฉพาะ price
                if (p && p.price != null && !isNaN(p.price)) unit = Number(p.price);
              } catch (e) { /* ignore */ }
            }
            if (unit == null || isNaN(unit)) unit = 0; // กัน NaN
            const lineTotal = unit * qty; // คิดใหม่ตาม unit
            return { ...it, unitPrice: unit, lineTotal }; // คืนแถวที่เติมข้อมูลแล้ว
          })
        );
        sale = { ...sale, items: enriched }; // แทนที่รายการเดิมด้วยรายการ enrich
      }
      res.json(sale); // ส่งคืน
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔸 GET /api/protect/sales — ค้น/แบ่งหน้า
router.get(
  "/",
  authenticateToken,
  ensurePermission("sales.view"),
  async (req, res) => {
    try {
      const { receipt, product, from, to, query: q, page = 1, limit = 25 } = req.query; // พารามิเตอร์ค้นหา
      const query = {}; // สร้าง criteria ทีละส่วน

      // 🔹 receipt: ค้น invoiceNo หรือ _id
      if (receipt) {
        if (mongoose.isValidObjectId(receipt)) { // ถ้าเป็น ObjectId ก็ลองจับคู่ทั้ง 2 แบบ
          query.$or = [
            { invoiceNo: { $regex: receipt, $options: "i" } },
            { _id: mongoose.Types.ObjectId(receipt) },
          ];
        } else { // ถ้าไม่ใช่ ObjectId ให้ค้นเฉพาะ invoiceNo
          query.invoiceNo = { $regex: receipt, $options: "i" };
        }
      }

      // 🔹 product name (ค้นในรายการสินค้าของบิล)
      if (product) {
        query.items = { $elemMatch: { name: { $regex: product, $options: "i" } } };
      }

      // 🔹 query ทั่วไป (q)
      if (q) {
        query.$or = [
          { invoiceNo: { $regex: q, $options: "i" } },
          { "payment.method": { $regex: q, $options: "i" } },
          { "items.name": { $regex: q, $options: "i" } },
        ];
      }

      // 🔹 กรองช่วงวันที่
      if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from); // เริ่มต้น
        if (to) { // จบบวกเวลาเป็น 23:59:59.999 ของวันนั้น
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }

      const skip = (Number(page) - 1) * Number(limit); // เพจเนชัน
      const [rows, total] = await Promise.all([
        Sale.find(query)
          .sort({ createdAt: -1 }) // ใหม่สุดก่อน
          .skip(skip)
          .limit(Number(limit))
          .select("invoiceNo createdAt total payment cashierName")
          .lean(),
        Sale.countDocuments(query), // นับทั้งหมดเพื่อคำนวณจำนวนหน้า
      ]);

      res.json({ rows, total, page: Number(page), limit: Number(limit) }); // ส่งข้อมูลกลับ
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router; // ส่งออก Router ให้ server.js นำไปใช้
```

### Backend/routes/apiPaymentsRoutes.js — Payments (Stripe: PromptPay/Card)

```javascript
const express = require("express"); // Router สำหรับการชำระเงิน
const router = express.Router(); // แยก concerns ชัดเจน
const authenticateToken = require("../middleware/authMiddleware"); // ต้องมี JWT
const ensurePermission = require("../middleware/ensurePermission"); // ตรวจสิทธิ์ sales.create/sales.view ตามจุด
require("dotenv").config(); // โหลด env เพื่อเข้าถึงคีย์ Stripe

// lazy init Stripe — ให้แอปบูตได้แม้ยังไม่ตั้งคีย์ (จะล้มเฉพาะตอนเรียก endpoint นี้)
let stripe = null; // cache instance ไว้ใช้ซ้ำ
function getStripe() { // คืน client ของ Stripe
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY; // คีย์ลับฝั่งเซิร์ฟเวอร์
    if (!key) throw new Error("STRIPE_SECRET_KEY missing in environment"); // ถ้าไม่ตั้ง ให้โยน error
    stripe = require("stripe")(key); // สร้าง client ตามคีย์
  }
  return stripe; // คืน client
}

// Helper แปลงยอดหน่วยบาท (ทศนิยม) เป็นสตางค์ (int) ตามที่ Stripe ต้องการ
function parseAmountToSatang(amount) {
  const num = Number(amount || 0); // แปลงเป็นตัวเลข
  return Math.round(num * 100); // คูณ 100 ปัดเป็นจำนวนเต็ม
}

// POST /api/protect/payments/promptpay-intent — สร้าง PaymentIntent สำหรับ PromptPay (QR)
router.post(
  "/promptpay-intent",
  authenticateToken, // ต้องยืนยันตัวตน
  ensurePermission("sales.create"), // ต้องมีสิทธิ์สร้างบิล/การชำระเงิน
  async (req, res) => {
    try {
      const { total, invoiceNo, metadata = {}, draft } = req.body; // รับยอด/เลขบิล/metadata/ร่างบิล
      console.log("[payments] promptpay-intent body:", req.body); // log ดีบัก
      const amt = Number(total); // แปลงเป็นตัวเลข
      if (!Number.isFinite(amt) || amt <= 0) { // ตรวจความถูกต้อง
        return res.status(400).json({ message: "total must be a positive number" });
      }
      const stripeClient = getStripe(); // client Stripe
      const intent = await stripeClient.paymentIntents.create({ // สร้าง PaymentIntent
        amount: parseAmountToSatang(amt), // จำนวนเงินหน่วยสตางค์
        currency: "thb", // สกุลเงินไทยบาท
        payment_method_types: ["promptpay"], // ประเภทการชำระเงิน: PromptPay QR
        description: `POS Sale ${invoiceNo || ""}`, // คำอธิบาย
        metadata: { // เก็บข้อมูลช่วยเหลือภายหลัง
          invoiceNo: invoiceNo || "",
          userId: req.user?.userId || "",
          ...metadata,
        },
      });

      // บันทึกร่างบิลลง PendingPayment เพื่อให้ webhook มาสร้างบิลทีหลัง (optional)
      if (draft && typeof draft === "object") { // guard draft เป็นอ็อบเจ็กต์
        try {
          const PendingPayment = require("../models/pendingPayment"); // โหลดโมเดลเท่าที่ใช้
          await PendingPayment.create({ // สร้างเอกสารคอย webhook
            paymentIntentId: intent.id,
            method: "qr", // promptpay
            saleDraft: { // เก็บข้อมูลจำเป็นพอสร้างบิล
              items: Array.isArray(draft.items) ? draft.items : [],
              subtotal: draft.subtotal,
              discount: draft.discount,
              vat: draft.vat,
              total: draft.total,
            },
            createdBy: req.user?.userId,
            cashierName: req.user?.username || req.user?.name || "unknown",
            meta: { invoiceNo: invoiceNo || "" },
          });
        } catch (persistErr) {
          console.error("Failed to persist PendingPayment draft", persistErr); // เก็บแค่ log ไม่ fail flow
        }
      }
      res.json({ // ส่งข้อมูลไปให้ FE ใช้แสดง QR
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        status: intent.status,
      });
    } catch (err) {
      console.error("[payments] PromptPay intent error:", err?.message, err?.type || "", err); // log เพิ่มรายละเอียด
      const code = err?.raw?.code || err?.code; // โค้ดจาก Stripe
      const type = err?.type || err?.rawType; // ประเภทความผิดพลาด
      res.status(500).json({ message: "Stripe error", error: err.message, code, type }); // ตอบ 500 พร้อมรายละเอียดปลอดภัย
    }
  }
);

// POST /api/protect/payments/card-intent — สร้าง PaymentIntent สำหรับบัตร
router.post(
  "/card-intent",
  authenticateToken,
  ensurePermission("sales.create"),
  async (req, res) => {
    try {
      const { total, invoiceNo, metadata = {}, draft } = req.body; // รับค่าเหมือน promptpay
      console.log("[payments] card-intent body:", req.body);
      const amt = Number(total);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: "total must be a positive number" });
      }
      const stripeClient = getStripe();
      const intent = await stripeClient.paymentIntents.create({
        amount: parseAmountToSatang(amt),
        currency: "thb",
        payment_method_types: ["card"], // ประเภทบัตร
        description: `POS Sale ${invoiceNo || ""}`,
        metadata: { invoiceNo: invoiceNo || "", userId: req.user?.userId || "", ...metadata },
      });

      if (draft && typeof draft === "object") { // เก็บร่างบิลสำหรับ webhook เช่นเดียวกับ promptpay
        try {
          const PendingPayment = require("../models/pendingPayment");
          await PendingPayment.create({
            paymentIntentId: intent.id,
            method: "card",
            saleDraft: {
              items: Array.isArray(draft.items) ? draft.items : [],
              subtotal: draft.subtotal,
              discount: draft.discount,
              vat: draft.vat,
              total: draft.total,
            },
            createdBy: req.user?.userId,
            cashierName: req.user?.username || req.user?.name || "unknown",
            meta: { invoiceNo: invoiceNo || "" },
          });
        } catch (persistErr) {
          console.error("Failed to persist PendingPayment draft (card)", persistErr);
        }
      }
      res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, status: intent.status }); // ตอบข้อมูลที่ FE ต้องใช้
    } catch (err) {
      console.error("[payments] Card intent error:", err?.message, err?.type || "", err);
      const code = err?.raw?.code || err?.code;
      const type = err?.type || err?.rawType;
      res.status(500).json({ message: "Stripe error", error: err.message, code, type });
    }
  }
);

// GET /api/protect/payments/intent/:id — polling สถานะ intent (สำรองจาก webhook)
router.get(
  "/intent/:id",
  authenticateToken,
  ensurePermission("sales.view"),
  async (req, res) => {
    try {
      const stripeClient = getStripe(); // client Stripe
      const intent = await stripeClient.paymentIntents.retrieve(req.params.id); // ดึงสถานะล่าสุด
      res.json({ // ตอบกลับข้อมูลที่จำเป็น
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        metadata: intent.metadata,
      });
    } catch (err) {
      console.error("Retrieve intent error:", err);
      res.status(500).json({ message: "Stripe error", error: err.message });
    }
  }
);

module.exports = router; // ส่งออก Router
```

### Backend/routes/stripeWebhook.js — Stripe Webhook (สร้างบิลอัตโนมัติ)

```javascript
const express = require("express"); // ใช้สำหรับสร้าง router ถ้าต้องการ mount เพิ่ม
const router = express.Router(); // (ในไฟล์นี้เรา export handler แยกต่างหาก)
const crypto = require("crypto"); // สร้างเลขบิลแบบสุ่มสั้น
const Sale = require("../models/sale"); // โมเดลบิลขาย
const Product = require("../models/product"); // โมเดลสินค้าเพื่อหักสต็อก
const PendingPayment = require("../models/pendingPayment"); // เก็บร่างบิลก่อนชำระจริง
require("dotenv").config(); // อ่าน env สำหรับ Stripe keys

let stripe = null; // cache client stripe
function getStripe() { // คืน client stripe จากคีย์ลับ
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY; // คีย์เซิร์ฟเวอร์
    if (!key) throw new Error("STRIPE_SECRET_KEY missing in environment");
    stripe = require("stripe")(key);
  }
  return stripe;
}

function genInvoiceNo() { // ตัวช่วยสร้างเลขบิล
  const d = new Date();
  const rand = crypto.randomBytes(2).toString("hex");
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${rand}`;
}

async function createSaleFromPending(intent) { // สร้างบิลขายจาก PendingPayment ตาม intent ที่สำเร็จ
  const paymentIntentId = intent.id; // อ้าง id ของ intent
  const existing = await Sale.findOne({ "payment.details.paymentIntentId": paymentIntentId }).lean(); // กันซ้ำ (idempotent)
  if (existing) return existing; // ถ้ามีแล้ว คืนทันที

  const pending = await PendingPayment.findOne({ paymentIntentId }); // หาเอกสารร่างบิล
  if (!pending || !pending.saleDraft || !Array.isArray(pending.saleDraft.items) || pending.saleDraft.items.length === 0) {
    throw new Error("Pending draft not found or invalid for intent " + paymentIntentId); // ขาดข้อมูล จำเป็นให้ Stripe retry
  }

  // ตรวจและหักสต็อกแบบเดียวกับฝั่ง API sales
  for (const it of pending.saleDraft.items) {
    if (it.productId) {
      const p = await Product.findById(it.productId);
      if (!p) throw new Error(`Invalid product ${it.name}`);
      if (typeof p.stock === "number" && p.stock < (it.qty || 0)) {
        throw new Error(`Insufficient stock for ${it.name}`);
      }
      if (typeof p.stock === "number") {
        p.stock = p.stock - (it.qty || 0);
        await p.save();
      }
    }
  }

  const sale = await Sale.create({ // บันทึกบิลเมื่อชำระสำเร็จ
    invoiceNo: genInvoiceNo(),
    createdBy: pending.createdBy || null,
    cashierName: pending.cashierName || "unknown",
    items: pending.saleDraft.items.map((it) => ({
      productId: it.productId || null,
      sku: it.sku || "",
      name: it.name,
      unitPrice: Number(it.unitPrice || 0),
      qty: Number(it.qty || 0),
      lineTotal: Number(it.unitPrice || 0) * Number(it.qty || 0),
    })),
    subtotal: Number(pending.saleDraft.subtotal || 0),
    discount: Number(pending.saleDraft.discount || 0),
    vat: Number(pending.saleDraft.vat || 0),
    total: Number(pending.saleDraft.total || 0),
    payment: { // ระบุรายละเอียดการชำระเงินจริงที่เกิดจาก intent
      method: pending.method || "qr",
      amountReceived: Number(pending.saleDraft.total || 0),
      change: 0,
      details: { paymentIntentId: paymentIntentId, intentStatus: intent.status },
    },
  });

  pending.status = "processed"; // อัปเดตสถานะ Draft ว่าถูกสร้างบิลแล้ว
  pending.processedAt = new Date(); // เวลาประมวลผล
  await pending.save(); // เซฟกลับ

  return sale; // คืนเอกสารบิล
}

// handler สำหรับ mount ใน server.js ด้วย express.raw({ type: 'application/json' })
async function stripeWebhookHandler(req, res) { // รับ webhook จาก Stripe
  try {
    const sig = req.headers["stripe-signature"]; // ลายเซ็นตรวจสอบความถูกต้อง
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // คีย์ลับของ webhook
    if (!webhookSecret) { // ถ้าไม่ตั้งค่า ให้ปฏิเสธทันที
      console.warn("STRIPE_WEBHOOK_SECRET not set; rejecting webhook");
      return res.status(400).send("webhook secret not configured");
    }

    const stripeClient = getStripe(); // client Stripe
    let event; // ตัวแปรเก็บ event ที่ตรวจสอบแล้ว
    try {
      event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret); // ตรวจลายเซ็นท์กับ raw body
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`); // ล้มเหลว -> ให้ Stripe retry
    }

    switch (event.type) { // แยกประเภทเหตุการณ์ที่สนใจ
      case "payment_intent.succeeded": { // จ่ายสำเร็จ
        const intent = event.data.object; // ตัว intent จริง
        try {
          await createSaleFromPending(intent); // สร้างบิลจากร่างที่ถูกบันทึกไว้
          return res.json({ received: true }); // ตอบ 200 เพื่อบอกว่าได้รับแล้ว
        } catch (e) {
          console.error("Failed to create sale from webhook:", e);
          return res.status(400).json({ error: e.message }); // 400 เพื่อให้ Stripe retry อัตโนมัติ
        }
      }
      case "payment_intent.processing": { // อยู่ระหว่างประมวลผล
        try {
          const intent = event.data.object;
          await PendingPayment.updateOne({ paymentIntentId: intent.id }, { $set: { status: "pending" } }); // ขีดเส้นว่าอยู่ระหว่างทาง
        } catch (e) { /* ignore */ }
        return res.json({ received: true });
      }
      case "payment_intent.payment_failed": { // ชำระล้มเหลว
        try {
          const intent = event.data.object;
          await PendingPayment.updateOne({ paymentIntentId: intent.id }, { $set: { status: "failed" } }); // ทำเครื่องหมายล้มเหลว
        } catch (e) { /* ignore */ }
        return res.json({ received: true });
      }
      default: // เหตุการณ์อื่นตอบรับเฉย ๆ
        return res.json({ received: true });
    }
  } catch (err) {
    console.error("Unexpected webhook error:", err); // ข้อผิดพลาดไม่คาดคิด
    return res.status(500).send("Server error"); // แจ้ง 500
  }
}

module.exports = { stripeWebhookHandler }; // ส่งออก handler เพื่อนำไป mount ใน server.js
```

### Backend/routes/apiRefundRoutes.js — Refunds (คืนสินค้า/เงิน)

```javascript
const express = require("express"); // Router คืนสินค้า/เงิน
const router = express.Router(); // แยก concerns
const Refund = require("../models/refund"); // โมเดล Refund
const authenticateToken = require("../middleware/authMiddleware"); // JWT
const ensurePermission = require("../middleware/ensurePermission"); // ตรวจสิทธิ์

// 🔸 POST /api/protect/refunds — สร้างเอกสารคืนสินค้า/เงิน
router.post(
  "/",
  authenticateToken,
  ensurePermission("refunds.create"), // ต้องมีสิทธิ์สร้าง refund
  async (req, res) => {
    try {
      const { saleId, invoiceNo, items = [] } = req.body; // ต้องมีใบขาย/เลขบิลและรายการที่จะคืน

      if (!saleId || !invoiceNo || items.length === 0) { // ตรวจบังคับ
        return res.status(400).json({ message: "Missing required fields" });
      }

      const totalRefund = items.reduce( // คำนวณยอดคืนรวมจากรายการ
        (sum, it) => sum + Number(it.unitPrice || 0) * Number(it.returnQty || 0),
        0
      );

      const refund = await Refund.create({ // สร้างเอกสารคืน
        saleId,
        invoiceNo,
        refundedBy: req.user?.userId, // ผู้ดำเนินการคืน
        items: items
          .filter((it) => Number(it.returnQty) > 0) // เอาเฉพาะแถวที่มีคืนจริง
          .map((it) => ({ // จัดรูปฟิลด์
            productId: it.productId,
            name: it.name,
            unitPrice: Number(it.unitPrice),
            originalQty: Number(it.originalQty),
            returnQty: Number(it.returnQty),
            reason: it.reason,
            lineRefund: Number(it.unitPrice || 0) * Number(it.returnQty || 0),
          })),
        totalRefund, // สรุปรวม
      });

      res.status(201).json({ // ตอบพร้อมคืนเอกสาร
        message: "Refund created successfully",
        refundId: refund._id,
        refund,
      });
    } catch (err) {
      console.error("Refund POST error:", err);
      if (err?.name === "ValidationError") { // รูปแบบข้อมูลไม่ผ่าน validator ของ Mongoose
        const details = Object.values(err.errors || {}).map((e) => e.message); // ดึงข้อความผิดพลาดรายฟิลด์
        return res.status(400).json({ message: "Validation failed", details });
      }
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔸 GET /api/protect/refunds — ประวัติการคืน (ค้น/แบ่งหน้า)
router.get(
  "/",
  authenticateToken,
  ensurePermission("refunds.view"),
  async (req, res) => {
    try {
      const { page = 1, limit = 25, search = "", startDate, endDate } = req.query; // พารามิเตอร์ค้นหา
      const skip = (Number(page) - 1) * Number(limit); // เพจเนชัน

      const query = {}; // เงื่อนไขค้นหา
      if (search) { // ค้นทั้งเลขบิลและชื่อสินค้าในรายการคืน
        query.$or = [
          { invoiceNo: { $regex: search, $options: "i" } },
          { "items.name": { $regex: search, $options: "i" } },
        ];
      }
      if (startDate && endDate) { // กรองช่วงเวลา
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }

      const [rows, total] = await Promise.all([
        Refund.find(query)
          .sort({ createdAt: -1 }) // ใหม่ก่อน
          .skip(skip)
          .limit(Number(limit))
          .select("invoiceNo totalRefund createdAt refundedBy") // ฟิลด์จำเป็นสำหรับรายการ
          .populate("refundedBy", "username name") // เติมชื่อผู้คืน
          .lean(),
        Refund.countDocuments(query), // นับทั้งหมด
      ]);

      res.json({ rows, total, page: Number(page), limit: Number(limit) }); // ตอบข้อมูลสำหรับ UI
    } catch (err) {
      console.error("Refund GET error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔸 GET /api/protect/refunds/:id — รายละเอียดคืนเดี่ยว
router.get(
  "/:id",
  authenticateToken,
  ensurePermission("refunds.view"),
  async (req, res) => {
    try {
      const refund = await Refund.findById(req.params.id)
        .populate("refundedBy", "username name") // เติมชื่อผู้คืน
        .populate("items.productId", "name price") // เติมชื่อ/ราคาเดิมของสินค้า
        .populate("saleId", "invoiceNo total") // เติมข้อมูลบิลเดิมหากต้องการ
        .lean();
      if (!refund) return res.status(404).json({ message: "Not found" }); // ไม่พบ
      res.json(refund); // ตอบคืนเอกสารเต็ม
    } catch (err) {
      console.error("Refund GET/:id error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router; // ส่งออก Router
```

### Backend/routes/apiStockRoutes.js — สต็อก (รับเข้า/เบิกออก/ตรวจนับ)

```javascript
const express = require("express"); // Router บริหารสต็อก
const router = express.Router(); // แยก concerns
const Product = require("../models/product"); // โมเดลสินค้า
const StockInLog = require("../models/stockInLog"); // Log รับเข้า
const StockOutLog = require("../models/stockOutLog"); // Log เบิกออก
const StockAuditLog = require("../models/stockAuditLog"); // Log ตรวจนับ
const ActivityLog = require("../models/activityLog"); // กิจกรรมกลาง
const authenticateToken = require("../middleware/authMiddleware"); // JWT
const ensurePermission = require("../middleware/ensurePermission"); // คีย์สิทธิ์
const ensureWithinShift = require("../middleware/ensureWithinShift"); // ตรวจช่วงเวลางาน
const mongoose = require('mongoose'); // ตรวจ ObjectId

const STOCK_IN_PERMISSION = ["admin.stockin", "warehouse.stockin"]; // คีย์ที่อนุญาตรับเข้า
const STOCK_OUT_PERMISSION = ["admin.stockout", "warehouse.stockout"]; // คีย์ที่อนุญาตเบิกออก
const STOCK_AUDIT_PERMISSION = ["admin.audit", "warehouse.audit"]; // คีย์ที่อนุญาตตรวจนับ

// POST /api/protect/stock/in — บันทึกรับสินค้าเข้า (เพิ่มสต็อก)
router.post(
  "/in",
  authenticateToken,
  ensureWithinShift,
  ensurePermission(STOCK_IN_PERMISSION),
  async (req, res) => {
    try {
      const { productId, quantity } = req.body; // รับ id สินค้าและจำนวนที่รับเข้า
      const { username, role } = req.user; // จาก JWT
      const numQty = parseFloat(quantity); // แปลงเป็นตัวเลข

      if (!productId || !quantity || isNaN(numQty) || numQty <= 0) { // ตรวจอินพุต
        return res.status(400).json({ message: "productId และ quantity (ตัวเลข > 0) เป็นฟิลด์บังคับ" });
      }
      if (!mongoose.Types.ObjectId.isValid(productId)) { // กัน CastError
        return res.status(400).json({ message: 'Invalid productId format' });
      }

      const updatedProduct = await Product.findByIdAndUpdate( // เพิ่มสต็อกแบบ atomic
        productId,
        { $inc: { stock: numQty } }, // เพิ่มจำนวน
        { new: true, runValidators: true }
      );
      if (!updatedProduct) { // ไม่พบสินค้า
        return res.status(404).json({ message: "ไม่พบสินค้า (Product)" });
      }

      const stockLog = await StockInLog.create({ // บันทึก log รับเข้า
        product: updatedProduct._id,
        productName: updatedProduct.name,
        sku: updatedProduct.sku,
        quantity: numQty, // จำนวนที่เพิ่ม (Delta)
        actorUsername: username,
      });

      try { // สร้าง ActivityLog กลางเพื่อใช้รวมรายงาน
        const { logActivity } = require("../utils/activityLogger");
        await logActivity(req, "stock.in", 201, { productId: updatedProduct._id, sku: updatedProduct.sku, quantity: numQty, newStock: updatedProduct.stock });
      } catch (logErr) { console.error("Failed to create activity log for stock.in:", logErr); }

      res.status(201).json(stockLog); // ตอบ log ที่สร้าง
    } catch (e) {
      console.error("Stock In Error:", e);
      res.status(500).json({ message: "Server error during stock in." });
    }
  }
);

// GET /api/protect/stock/in/logs — ประวัติรับเข้าแบบแบ่งหน้า
router.get(
  "/in/logs",
  authenticateToken,
  ensureWithinShift,
  ensurePermission(STOCK_IN_PERMISSION),
  async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1); // เลขหน้า
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10)); // จำกัดจำนวน
      const criteria = {}; // เงื่อนไขค้นหา (เผื่ออนาคต)
      const total = await StockInLog.countDocuments(criteria); // นับทั้งหมด

      const logs = await StockInLog.find(criteria) // ค้นจริงตามหน้า
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("product", "name sku")
        .lean();

      res.json({ page, limit, total, items: logs }); // ตอบข้อมูลพร้อมเพจเนชัน
    } catch (e) {
      console.error("Get Stock Logs Error:", e);
      res.status(500).json({ message: "Server error fetching stock logs." });
    }
  }
);

// POST /api/protect/stock/out — เบิกออก (ลดสต็อก)
router.post(
  "/out",
  authenticateToken,
  ensureWithinShift,
  ensurePermission(STOCK_OUT_PERMISSION),
  async (req, res) => {
    try {
      const { productId, quantity, reason } = req.body; // รับสินค้าที่ต้องเบิก/จำนวน/เหตุผล
      const { username, role } = req.user; // ผู้กระทำ

      if (!productId || !quantity || !reason) { // ตรวจอินพุต
        return res.status(400).json({ message: "productId, quantity, และ reason เป็นฟิลด์บังคับ" });
      }
      const numQty = parseFloat(quantity);
      if (isNaN(numQty) || numQty <= 0) { // ต้องเป็นจำนวนบวก
        return res.status(400).json({ message: "Quantity (จำนวน) ต้องเป็นบวก" });
      }
      if (typeof reason !== "string" || reason.trim().length === 0) { // ต้องมีเหตุผลไม่ว่าง
        return res.status(400).json({ message: "Reason (เหตุผล) ห้ามว่าง" });
      }

      if (!mongoose.Types.ObjectId.isValid(productId)) { // กัน CastError
        return res.status(400).json({ message: 'Invalid productId format' });
      }
      const product = await Product.findById(productId); // ค้นสินค้า
      if (!product) { // ไม่พบสินค้า
        return res.status(404).json({ message: "ไม่พบสินค้า (Product) ที่ระบุ" });
      }

      if (product.stock < numQty) { // ตรวจสต็อกพอหรือไม่
        return res.status(400).json({ message: `ไม่สามารถเบิกออกได้ สต็อกไม่พอ (มี ${product.stock} เบิก ${numQty})`, code: "INSUFFICIENT_STOCK" });
      }

      const updatedProduct = await Product.findByIdAndUpdate( // ลดสต็อกแบบ atomic
        productId,
        { $inc: { stock: -numQty } },
        { new: true, runValidators: true }
      );

      const stockLog = await StockOutLog.create({ // log การเบิกออก
        product: updatedProduct._id,
        productName: updatedProduct.name,
        sku: updatedProduct.sku,
        quantity: numQty,
        reason: reason.trim(),
        actorUsername: username,
      });

      try { // ActivityLog กลาง
        const { logActivity } = require("../utils/activityLogger");
        await logActivity(req, "stock.out", 201, { productId: updatedProduct._id, sku: updatedProduct.sku, quantity: numQty, reason: reason.trim(), newStock: updatedProduct.stock });
      } catch (logErr) { console.error("Failed to create activity log for stock.out:", logErr); }

      res.status(201).json(stockLog); // ตอบสำเร็จ
    } catch (e) {
      console.error("Stock Out Error:", e);
      res.status(500).json({ message: "Server error during stock out." });
    }
  }
);

// GET /api/protect/stock/out/logs — ประวัติการเบิกออกแบบแบ่งหน้า
router.get(
  "/out/logs",
  authenticateToken,
  ensureWithinShift,
  ensurePermission(STOCK_OUT_PERMISSION),
  async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const criteria = {};
      const total = await StockOutLog.countDocuments(criteria);

      const logs = await StockOutLog.find(criteria)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("product", "name sku")
        .lean();

      res.json({ page, limit, total, items: logs });
    } catch (e) {
      console.error("Get Stock Out Logs Error:", e);
      res.status(500).json({ message: "Server error fetching stock out logs." });
    }
  }
);

// POST /api/protect/stock/audit — ตรวจนับ (ตั้งค่า stock เท่าของจริงและบันทึก diff)
router.post(
  "/audit",
  authenticateToken,
  ensureWithinShift,
  ensurePermission(STOCK_AUDIT_PERMISSION),
  async (req, res) => {
    try {
      const { productId, actualStock } = req.body; // จำนวนจริงที่นับได้
      const { username, role } = req.user; // ผู้กระทำ
      const numActual = parseFloat(actualStock);
      if (!productId || isNaN(numActual) || numActual < 0) { // ตรวจอินพุต
        return res.status(400).json({ message: "productId และ actualStock (ตัวเลข >= 0) เป็นฟิลด์บังคับ" });
      }
      if (!mongoose.Types.ObjectId.isValid(productId)) { // กัน CastError
        return res.status(400).json({ message: 'Invalid productId format' });
      }
      const product = await Product.findById(productId); // ค้นสินค้า
      if (!product) { // ไม่พบ
        return res.status(404).json({ message: "ไม่พบสินค้า (Product)" });
      }
      const systemStock = product.stock; // สต็อกเดิมในระบบ
      const difference = numActual - systemStock; // ผลต่าง (delta)

      product.stock = numActual; // เซ็ตเป็นค่าจริงที่นับได้
      await product.save(); // เซฟกลับ

      const auditLog = await StockAuditLog.create({ // สร้าง log ตรวจนับ
        product: product._id,
        productName: product.name,
        sku: product.sku,
        systemStock: systemStock,
        actualStock: numActual,
        quantity: difference, // บันทึก delta
        actorUsername: username,
      });

      try { // ActivityLog กลาง
        const { logActivity } = require("../utils/activityLogger");
        await logActivity(req, "stock.audit", 201, { productId: product._id, sku: product.sku, systemStock, actualStock: numActual, difference });
      } catch (logErr) { console.error("Failed to create activity log for stock.audit:", logErr); }

      res.status(201).json(auditLog); // ตอบ log ที่สร้าง
    } catch (e) {
      console.error("Stock Audit Error:", e);
      res.status(500).json({ message: "Server error during stock audit." });
    }
  }
);

module.exports = router; // ส่งออก Router
```

### Backend/routes/apiDiscountsRoutes.js — ส่วนลด (ตัวอย่างง่าย)

```javascript
const express = require('express'); // Router ส่วนลดอย่างง่าย
const router = express.Router(); // แยก concerns ชัดเจน
const Discount = require('../models/discount'); // โมเดลส่วนลด

router.get('/', async (req, res) => { // ดึงรายการส่วนลดทั้งหมด
  try {
    const discounts = await Discount.find(); // ค้นหมด
    res.json(discounts); // ตอบรายการ
  } catch (err) {
    res.status(500).json({ message: err.message }); // ผิดพลาดทั่วไป
  }
});

// add discount — ตัวอย่างสร้างส่วนลดอย่างง่าย (ยังไม่ผูกสิทธิ์/validation ลึก)
router.post('/', async (req, res) => { // สร้างส่วนลดใหม่จาก body payload
  try {
    const d = new Discount(req.body); // รับทั้งก้อน (ระวังในโปรดักชันควร validate เพิ่ม)
    await d.save(); // บันทึก
    res.status(201).json(d); // ตอบเอกสารที่สร้าง
  } catch (err) {
    res.status(400).json({ message: err.message }); // รูปแบบไม่ถูกต้อง
  }
});

module.exports = router; // ส่งออก Router
```

---

หมายเหตุสรุปการติดตั้ง Webhook ใน server.js
- ต้อง mount เส้นทาง `app.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler)` ก่อน `app.use(bodyParser.json())` เพื่อคง raw body ไว้ตรวจลายเซ็น
- ตั้งค่า `STRIPE_SECRET_KEY` และ `STRIPE_WEBHOOK_SECRET` ในสภาพแวดล้อมจริง
- ฝั่ง Frontend เมื่อใช้ PromptPay/Card intent ควรแสดงสถานะและ fallback polling `/api/protect/payments/intent/:id` เมื่อยังไม่ได้ตั้ง webhook

---

ถ้าต้องการให้ผมเพิ่มเติมส่วน Frontend (เช่น Cashier scanner flow, หน้า Sales/Refund history) ในรูปแบบ “คอมเมนต์บรรทัดต่อบรรทัด” เพิ่มเติม แจ้งไฟล์ที่ต้องการได้ทันที ผมจะขยายในเอกสารนี้ต่อเนื่องให้ครับ

### Backend/routes/apiProtectRoutes.js — Protected APIs (Users, Logs)

```javascript
const express = require("express"); // ใช้ Express Router สำหรับกลุ่ม endpoint ที่ต้องป้องกัน
const router = express.Router(); // แยก router เพื่อการจัดการ/ทดสอบสะดวก
const authenticateToken = require("../middleware/authMiddleware"); // ยืนยันตัวตนด้วย JWT
const ensureWithinShift = require("../middleware/ensureWithinShift"); // บังคับช่วงเวลางาน
const ensureAdmin = require("../middleware/ensureAdmin"); // จำกัดเฉพาะผู้ดูแล
const User = require("../models/user"); // โมเดลผู้ใช้สำหรับจัดการข้อมูลบัญชี
const ActivityLog = require("../models/activityLog"); // โมเดล log สำหรับ audit
const ensurePermission = require("../middleware/ensurePermission"); // ตรวจคีย์สิทธิ์ราย endpoint

// ตัวอย่าง endpoint ที่ถูกป้องกัน: ใช้ JWT + อยู่ในกะ
router.get("/dashboard", authenticateToken, ensureWithinShift, (req, res) => { // กำหนดลำดับ: auth ก่อน, policy ถัดมา
  res.json({ message: "Welcome to the protected dashboard", user: req.user }); // ตอบพร้อมข้อมูลผู้ใช้จาก JWT
});

module.exports = router; // export ตั้งแต่ต้น (Node cache module ทำให้ยังเพิ่มเส้นทางต่อได้)

// รายชื่อผู้ใช้สำหรับ admin พร้อมค้น/แบ่งหน้า เพื่อลด payload/latency
router.get('/users', authenticateToken, ensureWithinShift, ensureAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1); // หลักประกันเลขหน้า >=1
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10)); // จำกัดเพดานเพื่อกัน abuse
    const q = (req.query.query || '').toString().trim(); // คำค้นตาม username

    const criteria = q ? { username: { $regex: q, $options: 'i' } } : {}; // ใช้ regex i เพื่อลดการพึ่ง index prefix มากเกินไป
    const total = await User.countDocuments(criteria); // เพื่อคำนวณจำนวนหน้าใน FE
    const users = await User.find(criteria)
      .sort({ createdAt: -1 }) // เรียงใหม่สุดก่อน มักตรงกับความต้องการพบบัญชีล่าสุด
      .skip((page - 1) * limit) // ข้ามรายการตามหน้า
      .limit(limit) // จำกัดจำนวนต่อหน้า
      .select('username role firstName lastName phone email createdAt updatedAt') // least privilege ในการเลือกฟิลด์
      .lean(); // คืน plain object เพื่อประสิทธิภาพ

    res.json({ page, limit, total, items: users }); // ตอบเพจเนชันมาตรฐาน
  } catch (e) {
    console.error(e); // สำหรับตรวจสอบภายหลัง
    res.status(500).json({ message: 'Server error' }); // ป้องกันข้อมูลภายในรั่วไหล
  }
});

// ดูรายละเอียดผู้ใช้รายบุคคล
router.get('/users/:username', authenticateToken, ensureWithinShift, ensureAdmin, async (req, res) => {
  try {
    const { username } = req.params // รับค่าชื่อผู้ใช้จากพาธ
    const user = await User.findOne({ username }) // ค้นหาเอกสารผู้ใช้
      .select('username role firstName lastName birthdate phone email gender shiftStart shiftEnd createdAt updatedAt') // เฉพาะฟิลด์จำเป็น
      .lean() // คืน plain object
    if (!user) return res.status(404).json({ message: 'User not found' }) // แจ้งไม่พบ
    res.json(user) // ส่งคืนรายละเอียด
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' }) // ตอบมาตรฐาน
  }
})

// อัปเดตโปรไฟล์/บทบาท/กะงานของผู้ใช้
router.put('/users/:username', authenticateToken, ensureWithinShift, ensureAdmin, async (req, res) => {
  try {
    const { username } = req.params // เป้าหมาย
    const { role, password, firstName, lastName, birthdate, phone, email, gender, shiftStart, shiftEnd } = req.body || {} // ข้อมูลใหม่
    const user = await User.findOne({ username }) // ตรวจว่ามีอยู่จริงก่อนแก้
    if (!user) return res.status(404).json({ message: 'User not found' }) // ไม่พบ -> 404

    if (role) { // ปรับบทบาทถ้าส่งมา
      const valid = ['admin', 'warehouse', 'cashier'] // white-list บทบาทที่รองรับ
      if (!valid.includes(role)) return res.status(400).json({ message: 'Invalid role' }) // ป้องกันค่าผิด
      user.role = role // เซ็ตบทบาทใหม่
    }
    if (typeof password === 'string' && password.trim().length > 0) { // เปลี่ยนรหัสผ่านเมื่อส่งมาและไม่ว่าง
      await user.setPassword(password.trim()) // ใช้เมธอดโมเดลเพื่อ hash/validate
    }
    // อัปเดตเฉพาะฟิลด์ที่ส่งมาเพื่อลดความเสี่ยงเขียนทับโดยไม่ตั้งใจ
    if (typeof firstName !== 'undefined') user.firstName = firstName
    if (typeof lastName !== 'undefined') user.lastName = lastName
    if (typeof birthdate !== 'undefined') user.birthdate = birthdate ? new Date(birthdate) : undefined
    if (typeof phone !== 'undefined') user.phone = phone
    if (typeof email !== 'undefined') user.email = email
    if (typeof gender !== 'undefined') user.gender = gender
    if (typeof shiftStart !== 'undefined') user.shiftStart = shiftStart
    if (typeof shiftEnd !== 'undefined') user.shiftEnd = shiftEnd

    await user.save() // persist การเปลี่ยนแปลง
    try { // บันทึกกิจกรรมเพื่อ audit
      await ActivityLog.create({
        action: 'user.update', // ชนิดเหตุการณ์
        actorUsername: req.user?.username || 'unknown', // ผู้กระทำในครั้งนี้
        actorRole: req.user?.role || 'unknown', // บทบาทผู้กระทำ
        targetUsername: username, // เป้าหมายคือผู้ใช้ที่ถูกแก้ไข
        method: req.method, // บันทึก method
        path: req.originalUrl, // และ path
        status: 200, // สถานะสำเร็จ
        details: { // ใส่รายละเอียดว่ามีอะไรเปลี่ยน
          changedRole: !!role,
          changedPassword: typeof password === 'string' && password.trim().length > 0,
          profileUpdated: Boolean(
            typeof firstName !== 'undefined' || typeof lastName !== 'undefined' || typeof birthdate !== 'undefined' ||
            typeof phone !== 'undefined' || typeof email !== 'undefined' || typeof gender !== 'undefined' ||
            typeof shiftStart !== 'undefined' || typeof shiftEnd !== 'undefined'
          )
        }
      })
    } catch (e) { }
    res.json({ // ส่งคืนภาพรวมข้อมูลล่าสุด
      username: user.username, role: user.role,
      firstName: user.firstName, lastName: user.lastName,
      birthdate: user.birthdate, phone: user.phone, email: user.email, gender: user.gender,
      shiftStart: user.shiftStart, shiftEnd: user.shiftEnd, updatedAt: user.updatedAt
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// อ่าน Logs พร้อมตัวกรอง (q/user/role) และเพจเนชัน
router.get('/logs', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.logs'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1) // ตั้งต้นหน้าอย่างปลอดภัย
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20)) // กันการดึงข้อมูลมหาศาลครั้งเดียว
    const q = (req.query.q || '').toString().trim() // ข้อความค้นหาแบบส่วนหนึ่งของคำ
    const user = (req.query.user || '').toString().trim() // กรองชื่อผู้ใช้ที่เกี่ยวข้อง
    const role = (req.query.role || '').toString().trim().toLowerCase() // กรองบทบาทผู้กระทำ

    const criteria = {} // จะเติมทีละส่วนตามพารามิเตอร์ที่ให้มา
    if (q) { // ค้นในหลายฟิลด์พร้อมกันด้วย $or
      criteria.$or = [
        { action: { $regex: q, $options: 'i' } }, // ชนกับ action แบบ case-insensitive
        { path: { $regex: q, $options: 'i' } }, // ชนกับ path
        { actorUsername: { $regex: q, $options: 'i' } }, // ชนกับผู้กระทำ
        { targetUsername: { $regex: q, $options: 'i' } }, // ชนกับเป้าหมาย
      ]
    }
    if (user) { // ต้องการจำกัดอยู่ใน actor หรือ target ตามชื่อผู้ใช้ที่กำหนด
      criteria.$and = (criteria.$and || []) // รวมกับเงื่อนไขอื่นได้
      criteria.$and.push({ $or: [ { actorUsername: user }, { targetUsername: user } ] }) // actor หรือ target ก็ได้
    }
    if (role && ['admin','cashier','warehouse'].includes(role)) { // บทบาทที่รองรับเท่านั้น
      criteria.actorRole = role // ใส่กรองเฉพาะบทบาทผู้กระทำ
    }

    const total = await ActivityLog.countDocuments(criteria) // ใช้สำหรับเพจเนชัน
    const items = await ActivityLog.find(criteria)
      .sort({ createdAt: -1 }) // ไล่ใหม่สุดก่อนเพื่อดูเหตุการณ์ล่าสุด
      .skip((page - 1) * limit) // ข้ามตามหน้า
      .limit(limit) // จำกัดจำนวนต่อหน้า
      .lean() // คืน object ธรรมดา

    res.json({ page, limit, total, items }) // รูปแบบเพจเนชันมาตรฐาน
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Removed profile picture upload feature as per request // หมายเหตุการลบฟีเจอร์อัปโหลดรูป (ออกแบบให้ชัดในเอกสาร)
```

### Backend/routes/apiProductRoutes.js — Products CRUD

```javascript
const express = require('express'); // Express สำหรับสร้าง router ของสินค้า
const router = express.Router(); // แยก concerns ด้านสินค้าให้อ่านง่าย
const Product = require('../models/product'); // โมเดลสินค้า (schema/validation)
const authenticateToken = require('../middleware/authMiddleware'); // JWT เพื่อรู้ว่าใครทำ
const ensurePermission = require('../middleware/ensurePermission'); // ตรวจสิทธิ์ระดับคีย์ (admin/warehouse)
const ensureWithinShift = require('../middleware/ensureWithinShift'); // บังคับช่วงเวลางาน
const ActivityLog = require('../models/activityLog'); // Log เพื่อ audit

function escapeRegExp(str = '') { // ป้องกัน user input ทำลาย regex โดย escape meta chars
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // มาตรฐานการ escape
}

// เลือกเฉพาะฟิลด์ที่อนุญาตให้อัปเดต ลดความเสี่ยง mass update ผิดพลาด
function pickBody(b = {}) {
  const body = {};
  if (b.sku != null) body.sku = b.sku.toString().trim(); // normalize ชนิด/ตัดช่องว่าง
  if (b.name != null) body.name = b.name.toString().trim(); // ป้องกันสตริงแปลก
  if (b.description != null) body.description = b.description.toString();
  if (b.category != null) body.category = b.category.toString();
  if (b.price != null) body.price = Number(b.price); // บังคับเป็นตัวเลข
  if (b.cost != null) body.cost = Math.max(0, Number(b.cost)); // ไม่ปล่อยให้ติดลบ
  if (b.stock != null) body.stock = Number(b.stock);
  if (b.unit != null) body.unit = b.unit.toString();
  if (b.barcode != null) body.barcode = b.barcode.toString();
  if (b.status != null) body.status = b.status.toString(); // เช่น active/inactive
  if (b.reorderLevel != null) body.reorderLevel = Math.max(0, Number(b.reorderLevel));
  return body; // คืนเฉพาะสิ่งที่ยอมรับได้
}

// คิวรีสินค้าพร้อมค้นหา/จัดหน้า/เรียง และกรองสถานะ
router.get('/', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1); // หน้าเริ่มต้นอย่างน้อย 1
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20)); // เพดานป้องกันโหลดเกิน
    const q = (req.query.q || '').toString().trim(); // ข้อความค้นหา
    const status = (req.query.status || '').toString().trim(); // กรองสถานะสินค้า
    const sortRaw = (req.query.sort || '-createdAt').toString(); // ดีฟอลต์เรียงใหม่สุด

    const criteria = {}; // จะเติมตามพารามิเตอร์
    if (q) { // ค้นหลายฟิลด์ด้วย regex (i)
      const qr = new RegExp(escapeRegExp(q), 'i'); // escape กัน regex injection
      criteria.$or = [ { sku: qr }, { name: qr }, { category: qr }, { barcode: qr } ];
    }
    if (status === 'active' || status === 'inactive') criteria.status = status; // กรองสถานะที่รองรับเท่านั้น

    const sort = {}; // รองรับหลายคีย์คั่นด้วย comma เช่น name,-price
    sortRaw.split(',').forEach(k => { // แตกคำ/ตัดช่องว่าง
      k = k.trim(); if (!k) return; if (k.startsWith('-')) sort[k.slice(1)] = -1; else sort[k] = 1; // กำหนดลำดับ
    });

    const total = await Product.countDocuments(criteria); // ใช้กับเพจเนชัน
    const items = await Product.find(criteria)
      .sort(sort) // เรียงตามที่ร้องขอ
      .skip((page - 1) * limit) // ข้ามตามหน้า
      .limit(limit) // จำกัดจำนวนต่อหน้า
      .lean(); // คืน plain object

    res.json({ page, limit, total, items }); // ตอบรูปแบบเพจเนชันมาตรฐาน
  } catch (e) {
    console.error(e); // ดีบัก
    res.status(500).json({ message: 'Server error' }); // รักษาความลับภายใน
  }
});

// สร้างสินค้าใหม่ (ตรวจ validation เบื้องต้นก่อนคุยกับ DB มากเกินไป)
router.post('/', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const body = pickBody(req.body); // รับเฉพาะฟิลด์อนุญาต เพื่อลดผิวสัมผัสความเสี่ยง
    if (!body.sku || !body.name) return res.status(400).json({ message: 'sku and name are required' }); // ข้อมูลขั้นต่ำที่จำเป็น
    if (body.price == null || !Number.isFinite(body.price) || body.price < 0) return res.status(400).json({ message: 'invalid price' }); // ตรวจราคาถูกต้อง
    if (body.stock == null || !Number.isFinite(body.stock) || body.stock < 0) return res.status(400).json({ message: 'invalid stock' }); // ตรวจสต็อกถูกต้อง

    const exists = await Product.findOne({ sku: body.sku }); // SKU ต้องเป็นเอกลักษณ์
    if (exists) return res.status(409).json({ message: 'SKU already exists' }); // 409 Conflict ตามมาตรฐาน

    const doc = await Product.create({ ...body, createdBy: req.user?.userId || undefined }); // สร้างเอกสารสินค้า

    try { // บันทึก log เพื่อ audit ว่าใครสร้างอะไร
      await ActivityLog.create({
        action: 'product.create',
        actorUsername: req.user?.username, actorRole: req.user?.role,
        method: req.method, path: req.originalUrl, status: 201,
        details: { sku: doc.sku, name: doc.name }
      });
    } catch {}

    res.status(201).json(doc.toObject()); // 201 Created พร้อมเอกสาร
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// อัปเดตสินค้าแบบบางส่วน (partial) โดยรักษาค่าที่ไม่ได้ส่งไว้เดิม
router.put('/:id', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const body = pickBody(req.body); // ป้องกันลบค่าโดยไม่ตั้งใจด้วยการเลือกเฉพาะที่ส่งมา

    if (body.price != null && (!Number.isFinite(body.price) || body.price < 0))
      return res.status(400).json({ message: 'invalid price' }); // ป้องกันค่าที่ขัดตรรกะ
    if (body.stock != null && (!Number.isFinite(body.stock) || body.stock < 0))
      return res.status(400).json({ message: 'invalid stock' }); // เช่นเดียวกัน

    if (body.sku) { // หากจะเปลี่ยน SKU ต้องแน่ใจว่าไม่ชนกับของผู้อื่น
      const dup = await Product.findOne({ sku: body.sku, _id: { $ne: req.params.id } });
      if (dup) return res.status(409).json({ message: 'SKU already exists' }); // ป้องกันความสับสนด้านรหัสสินค้า
    }

    const doc = await Product.findByIdAndUpdate( // ใช้ update แบบอะตอมมิกพร้อม validate
      req.params.id,
      { $set: body }, // เซ็ตเฉพาะฟิลด์ที่ส่งมา
      { new: true, runValidators: true } // คืนเอกสารใหม่และให้ Mongoose ตรวจ schema
    );
    if (!doc) return res.status(404).json({ message: 'Not found' }); // ไม่พบสินค้าดังกล่าว

    try { // log ว่ามีการปรับปรุงสินค้าใด
      await ActivityLog.create({
        action: 'product.update',
        actorUsername: req.user?.username, actorRole: req.user?.role,
        method: req.method, path: req.originalUrl, status: 200,
        details: { id: String(doc._id) }
      });
    } catch {}

    res.json(doc.toObject()); // ตอบกลับเอกสารปัจจุบัน
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ลบสินค้า (soft-delete สามารถพิจารณาเพิ่มภายหลัง ถ้าต้องการประวัติครบกว่า)
router.delete('/:id', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const doc = await Product.findByIdAndDelete(req.params.id); // ลบเอกสารโดยตรง
    if (!doc) return res.status(404).json({ message: 'Not found' }); // ไม่พบ -> 404

    try { // log รายการที่ถูกลบเพื่อการติดตามย้อนหลัง
      await ActivityLog.create({
        action: 'product.delete',
        actorUsername: req.user?.username, actorRole: req.user?.role,
        method: req.method, path: req.originalUrl, status: 200,
        details: { id: String(doc._id), sku: doc.sku }
      });
    } catch {}

    res.status(204).end(); // 204 No Content ตาม REST เมื่อสำเร็จและไม่มี body
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; // ส่งออก router ของสินค้า
```

### Backend/routes/apiPublicRoutes.js — Public

```javascript
const express = require("express"); // โหลด Express
const router = express.Router(); // Router สาธารณะ

router.get("/info", (req, res) => { // ข้อมูลสาธารณะ ไม่ต้อง auth
  res.json({ message: "This is a public API, no authentication required" }); // ตอบข้อความ
});

module.exports = router; // ส่งออก
```

### Middleware: ensureAdmin.js และ rateLimiter.js (อ้างอิง)

```javascript
// ensureAdmin.js
module.exports = function ensureAdmin(req, res, next) { // middleware บังคับบทบาท admin เท่านั้น
  try { // ป้องกันการ throw แบบไม่คาดคิด
    const role = req.user?.role; // อ่าน role จาก JWT payload ที่ authMiddleware ใส่ไว้
    if (role !== 'admin') return res.status(403).json({ message: 'Admin only' }); // ถ้าไม่ใช่ admin -> 403
    next(); // ผ่าน -> ไปต่อ
  } catch (e) { // หากเกิดข้อผิดพลาดอื่น ๆ
    return res.status(403).json({ message: 'Forbidden' }); // ตอบ 403 เพื่อความปลอดภัย
  }
}
```

```javascript
// rateLimiter.js
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // หน้าต่างเวลา (มิลลิวินาที)
const MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '10', 10); // จำนวนครั้งสูงสุดภายในหน้าต่างเวลา
const buckets = new Map(); // เก็บสถานะต่อ IP ในหน่วยความจำ (เหมาะ dev/single-instance)
function now() { return Date.now(); } // เวลา ณ ปัจจุบัน (มิลลิวินาที)
function getBucket(ip) { // คืนข้อมูล bucket สำหรับ IP ที่กำหนด
  const b = buckets.get(ip); // อ่าน bucket ปัจจุบันจาก Map
  if (!b || b.resetAt <= now()) { // ถ้าไม่มี หรือหมดอายุแล้ว
    const nb = { count: 0, resetAt: now() + WINDOW_MS }; // สร้าง bucket ใหม่ (เริ่ม count 0)
    buckets.set(ip, nb); // บันทึกลง Map
    return nb; // คืน bucket ใหม่
  }
  return b; // ยังใช้ bucket เดิมได้
}
function loginRateLimiter(req, res, next) { // middleware rate limit สำหรับ login
  try { // ใช้ try/catch ป้องกันผลข้างเคียงจาก environment แปลก ๆ
    const ip = req.ip || req.connection?.remoteAddress || 'unknown'; // หา IP ผู้ร้องขอ
    const b = getBucket(ip); // อ่าน/สร้าง bucket ของ IP นี้
    b.count += 1; // เพิ่มตัวนับครั้งที่พยายาม
    if (b.count > MAX_ATTEMPTS) { // เกินลิมิตในหน้าต่างเวลานี้หรือไม่
      const retryAfter = Math.max(1, Math.ceil((b.resetAt - now()) / 1000)); // วินาทีที่เหลือจนกว่าจะรีเซ็ต
      res.set('Retry-After', String(retryAfter)); // แจ้งให้ client ทราบเวลารอ
      return res.status(429).json({ message: 'Too many login attempts. Please try again later.' }); // ตอบ 429
    }
    return next(); // ยังไม่เกินลิมิต -> ผ่านต่อไป
  } catch (e) { // หากเกิดข้อผิดพลาดระหว่างอ่าน IP หรืออื่น ๆ
    return next(); // ปล่อยผ่าน (ไม่ทำให้การ login พัง)
  }
}
module.exports = { loginRateLimiter }; // ส่งออกฟังก์ชันเป็นโมดูล
```

### Backend/middleware/ensurePermission.js — ตรวจสิทธิ์แบบ allow-only (ไล่อธิบายทีละบรรทัด)

```javascript
const Permission = require('../models/permission') // โหลดโมเดล Permission
const User = require('../models/user') // โหลดโมเดล User เพื่ออ่าน role/อ้างอิงสิทธิ์

// role baseline mapping ควรตรงกับ apiPermissionRoutes และฝั่ง FE
const roleBaseline = {
  admin: [
    'admin.dashboard', 'admin.permissions', 'admin.products',
    'admin.logs', // legacy umbrella (อนุญาตรวมทั้งหมด)
    'admin.logs.all', 'admin.logs.admin', 'admin.logs.cashier', 'admin.logs.warehouse'
  ],
  cashier: ['sales.home'],
  warehouse: ['warehouse.home'],
}

module.exports = function ensurePermission(requiredKey) { // สร้าง middleware ด้วยคีย์ที่ต้องการ
  return async function(req, res, next) { // คืนฟังก์ชัน middleware แบบ async
    try {
      const me = await User.findById(req.user.userId).lean() // ผู้ใช้ปัจจุบันจาก JWT
      if (!me) return res.status(401).json({ message: 'Unauthorized' }) // ไม่พบ -> 401
      const perm = await Permission.findOne({ user: me._id }).lean() // อ่านเอกสารสิทธิ์
      const allow = perm?.allowRoutes || [] // รายการอนุญาต
      const deny = perm?.denyRoutes || [] // รายการปฏิเสธ

      const required = Array.isArray(requiredKey) ? requiredKey : [requiredKey] // รองรับหลายคีย์

      let allowed
      if (allow.length > 0) { // กำหนดแบบ allow-only เมื่อมี allowRoutes
        allowed = required.some(k => allow.includes(k)) // เพียงพอถ้าอย่างน้อย 1 คีย์อยู่ใน allow
      } else {
        const base = roleBaseline[me.role] || [] // fallback baseline ตามบทบาท
        allowed = required.some(k => base.includes(k))
      }
      if (required.some(k => deny.includes(k))) allowed = false // deny มีสิทธิเหนือกว่า

      if (!allowed) return res.status(403).json({ message: 'Forbidden' }) // ไม่ผ่าน -> 403
      next() // ผ่าน -> ไปต่อ
    } catch (e) {
      console.error(e) // บันทึก error ฝั่งเซิร์ฟเวอร์
      res.status(500).json({ message: 'Server error' }) // ตอบ 500
    }
  }
}
```

### Backend/middleware/authMiddleware.js — ตรวจ JWT (โค้ดพร้อมคอมเมนต์)

```javascript
const jwt = require("jsonwebtoken"); // โหลดไลบรารี JWT

const SECRET_KEY = process.env.JWT_SECRET // กุญแจลับสำหรับ verify โทเคน

function authenticateToken(req, res, next) { // middleware ตรวจสอบโทเคน
  const authHeader = req.headers["authorization"]; // อ่าน header Authorization

  const token = authHeader && authHeader.split(" ")[1]; // แยก Bearer <token>
  if (!token) return res.status(401).json({ message: "No token provided" }); // ไม่มีโทเคน -> 401

  jwt.verify(token, SECRET_KEY, (err, user) => { // ตรวจความถูกต้องของโทเคน
    if (err) {

      return res.status(403).json({ message: "Invalid token" }); // โทเคนไม่ถูกต้อง/หมดอายุ -> 403
    }

    req.user = user; // เก็บ payload ลง req.user ให้ endpoint ถัดไปใช้
    next(); // ผ่าน -> ไปต่อ
  });
}

module.exports = authenticateToken; // ส่งออก middleware
```

### Backend/models/activityLog.js — โมเดล Log (โค้ดพร้อมคอมเมนต์)

```javascript
const mongoose = require('mongoose') // โหลด mongoose

const ActivityLogSchema = new mongoose.Schema({ // สร้างสคีม่า Log
  action: { type: String, required: true }, // เช่น 'user.create','permissions.update'
  actorUsername: { type: String, required: true }, // ผู้กระทำ (ชื่อผู้ใช้)
  actorRole: { type: String, required: true }, // บทบาทผู้กระทำ (admin/cashier/warehouse)
  targetUsername: { type: String }, // เป้าหมาย (เช่น ผู้ใช้ที่ถูกแก้ไขสิทธิ์)
  method: { type: String }, // HTTP method
  path: { type: String }, // เส้นทางที่เรียก
  status: { type: Number }, // สถานะตอบกลับ HTTP
  details: { type: Object }, // รายละเอียดเพิ่มเติม (payload/การเปลี่ยนแปลง ฯลฯ)
}, { timestamps: true }) // เปิดใช้ createdAt/updatedAt อัตโนมัติ

module.exports = mongoose.model('ActivityLog', ActivityLogSchema) // ส่งออกโมเดล
```

---

## API updates (อธิบายทีละบรรทัดของ endpoints ที่อัพเดท/เพิ่มในวันนี้)

ต่อไปนี้เป็นสรุป API ที่มีการเพิ่มหรือปรับปรุงใน session วันนี้ พร้อมคำอธิบายแบบไล่บรรทัด (line-by-line style) เพื่อให้สามารถตรวจสอบผลกระทบและเข้าใจ logic ได้รวดเร็ว

### 1) GET /api/protect/logs/warehouse-activity
- ตำแหน่ง: `Backend/routes/apiProtectRoutes.js`
- จุดประสงค์: ให้ผู้มีสิทธิ์ `warehouse.logs` ดึงกิจกรรมที่เกี่ยวข้องกับคลังสินค้า (รวมการกระทำของพนักงาน warehouse และการกระทำในระบบที่กระทบคลัง)
- ไล่บรรทัดสำคัญและความหมาย:
  - `router.get('/logs/warehouse-activity', authenticateToken, ensureWithinShift, ensurePermission('warehouse.logs'), async (req, res) => {` — ประกาศ route: ต้องผ่าน JWT, ตรวจช่วงกะ, และตรวจ permission
  - `const page = Math.max(1, parseInt(req.query.page, 10) || 1)` — อ่านพารามิเตอร์ page และตั้งค่า default/ขอบเขต
  - `const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))` — อ่าน limit และจำกัดสูงสุด 100
  - `const q = (req.query.q || '').toString().trim()` — คำค้นหาแบบ optional
  - เมื่อมี q สร้าง `qCriteria` เพื่อค้นใน fields: action, path, actorUsername, targetUsername (ใช้ regex แบบ case-insensitive)
  - สร้าง `warehouseCriteria` เพื่อจับกิจกรรมที่เกี่ยวกับ warehouse:
    - `{ actorRole: 'warehouse' }` — การกระทำโดยผู้ที่มีบทบาท warehouse
    - `{ action: { $regex: '^(stock|warehouse|product)\\.' } }` — การกระทำที่เป็น stock./warehouse./product.* เช่น stock.in, product.update
    - `{ path: { $regex: '/warehouse' } }` — การเรียก API ที่มี path /warehouse
  - `const criteria = qCriteria ? { $and: [qCriteria, warehouseCriteria] } : warehouseCriteria` — ผสานเงื่อนไขค้นหา (ถ้ามี) กับ criteria ของ warehouse
  - `const total = await ActivityLog.countDocuments(criteria)` — นับจำนวนรวมสำหรับ pagination
  - `const items = await ActivityLog.find(criteria).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()` — ดึงรายการเรียงตามเวลาย้อนกลับ พร้อม pagination
  - `res.json({ page, limit, total, items })` — ส่งผลลัพธ์ให้ frontend

### 2) GET /api/protect/products/:id
- ตำแหน่ง: `Backend/routes/apiProductRoutes.js`
- จุดประสงค์: ให้ frontend ดึงข้อมูลสินค้า (name, sku, ฯลฯ) ตาม id เพื่อ enrich UI (เช่นแสดงชื่อสินค้าในหน้า Logs)
- ไล่บรรทัดสำคัญและความหมาย:
  - `router.get('/:id', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {` — ประกาศ route: ต้องมี JWT, ตรวจ shift, ตรวจ permission (admin.products หรือ warehouse.products)
  - `const prod = await Product.findById(req.params.id).lean()` — ดึง product แบบ lean (plain object)
  - `if (!prod) return res.status(404).json({ message: 'Not found' })` — ถ้าไม่พบ ส่ง 404 (สาเหตุที่ frontend ได้ 404 เมื่อ id ถูกลบ)
  - `res.json(prod)` — ส่งข้อมูล product กลับ

### 3) Product CRUD — เพิ่มการบันทึก ActivityLog (non-blocking)
- ตำแหน่ง: `Backend/routes/apiProductRoutes.js`
- สิ่งที่เพิ่ม/เปลี่ยน:
  - POST `/api/protect/products`: หลังสร้าง product เรียก `logActivity(req, 'product.create', 201, { sku: doc.sku, name: doc.name })` — บันทึก sku และ name ไว้ใน log โดยตรง (snapshot)
  - PUT `/api/protect/products/:id`: หลังอัพเดตเรียก `logActivity(req, 'product.update', 200, { id: String(doc._id) })` — บันทึก id (ควรขยายเป็น sku/name หากต้องการให้ logสมบูรณ์)
  - DELETE `/api/protect/products/:id`: หลังลบเรียก `logActivity(req, 'product.delete', 200, { id: String(doc._id), sku: doc.sku })` — บันทึก id และ sku ของสินค้าที่ถูกลบ
  - เหตุผล: การบันทึกข้อมูลสำคัญลงใน `ActivityLog.details` ช่วยให้ UI แสดงข้อมูลได้แม้สินค้าถูกลบหลังจากนั้น และทำให้ audit มีข้อมูล snapshot

### 4) Stock APIs — stock.in / stock.out (logging enriched)
- ตำแหน่ง: `Backend/routes/apiStockRoutes.js`
- POST `/api/protect/stock/in` (stock in):
  - ตรวจ input `productId`, `quantity` และแปลงเป็นตัวเลข
  - อัปเดต Product ด้วย `findByIdAndUpdate(..., { $inc: { stock: numQty } }, { new: true })` — ใช้ $inc เพื่อให้เป็น atomic
  - สร้าง `StockInLog` เก็บ `productName`, `sku`, `quantity`, `actorUsername` — snapshot สำหรับ recent entries
  - เรียก `logActivity(req, 'stock.in', 201, { productId: updatedProduct._id, sku: updatedProduct.sku, quantity: numQty, newStock: updatedProduct.stock })` — บันทึกรายละเอียดเชิงตัวเลขเพื่อให้ Logs UI แสดงการเปลี่ยนแปลงได้
- POST `/api/protect/stock/out` (stock out):
  - ตรวจ input `productId`, `quantity`, `reason` และเช็คว่ามีสต็อกเพียงพอ
  - อัปเดต Product ด้วย `findByIdAndUpdate(..., { $inc: { stock: -numQty } }, { new: true })`
  - สร้าง `StockOutLog` เก็บ `productName`, `sku`, `quantity`, `reason`, `actorUsername`
  - เรียก `logActivity(req, 'stock.out', 201, { productId: updatedProduct._id, sku: updatedProduct.sku, quantity: numQty, reason: reason.trim(), newStock: updatedProduct.stock })`

### หมายเหตุเกี่ยวกับ 404 ที่ frontend เจอ
- สาเหตุ: เมื่อ frontend เรียก `GET /api/protect/products/:id` กับ id ที่ถูกลบ จะได้ 404 ตามการออกแบบของ API
- บรรเทาปัญหา (frontend-side): โค้ด frontend เปลี่ยนไปใช้ `Promise.allSettled` เมื่อ fetch หลาย productIds และเก็บ sentinel `{ missing: true, sku }` ลงใน `productMap` เพื่อให้ UI แสดง "Deleted product" แทนการพัง

### ข้อเสนอแนะเพิ่มเติม (แนะนำให้ทำ)
- ตรวจ sweep backend endpoints ที่ทำ DB mutation ให้แนใจว่าทุกจุดที่เปลี่ยนสินค้า/สต็อก/permission มีการเรียก `logActivity` และบันทึก `productName`/`sku` ลงใน `details` (ทำให้ logs เป็น snapshot)
- หากต้องการ ผมสามารถทำ patch เล็ก ๆ เพิ่ม `productName`/`sku` ใน `product.update` และรันค้นหา (grep) เพื่อปิดช่องว่างที่เหลือได้


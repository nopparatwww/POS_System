เอกสารโปรเจ็ค POS System (ฉบับภาษาไทย)

ภาพรวม
-------
โปรเจ็คนี้เป็นระบบ Point of Sale (POS) แบ่งออกเป็นส่วน Backend และ Frontend:

- Backend — ใช้ Express (Node.js) และ MongoDB (Mongoose) สำหรับจัดเก็บข้อมูลผู้ใช้และจัดการการยืนยันตัวตน (JWT)
- Frontend — แอป React ที่สร้างด้วย Vite สำหรับหน้า Login, เลือกบทบาท (RoleSelect), หน้า Admin และเพจแสดงงานต่าง ๆ

เอกสารนี้อธิบายสถาปัตยกรรม ไฟล์สำคัญ การไหลของการยืนยันตัวตน (auth), โครงสร้าง role/permission, และตัวอย่างโค้ดเพื่อให้ง่ายต่อการเข้าใจและนำไปปรับใช้

สารบัญ
- เริ่มต้นอย่างรวดเร็ว
- Backend
  - สถาปัตยกรรมโดยรวม
  - ไฟล์สำคัญและหน้าที่
  - การจัดการรหัสผ่านและโมเดลผู้ใช้
  - เส้นทาง (routes) สำหรับ signup / login
- Frontend
  - สถาปัตยกรรมโดยรวม
  - ไฟล์สำคัญและหน้าที่
  - การตั้งค่า route และการป้องกันหน้า
  - การเลือกบทบาท (RoleSelect) และ model ของ permission
  - พื้นที่ Admin และตัวแก้ไข permissions
  - การออกแบบ UX (NavBar, Logout)
- วิธีรันโปรเจ็ค
- ข้อเสนอแนะเพื่อปรับปรุง (Security & UX)
````markdown
เอกสารโปรเจ็ค POS System (ฉบับภาษาไทย)

ภาพรวม
-------
โปรเจ็คนี้เป็นระบบ Point of Sale (POS) แบ่งออกเป็นส่วน Backend และ Frontend:

- Backend — ใช้ Express + MongoDB (Mongoose). จัดการการสมัคร/ล็อกอินของผู้ใช้ และ endpoint ที่ต้องการการยืนยันตัวตนด้วย JWT
- Frontend — React (Vite) SPA: หน้า Login, RoleSelect, Admin pages และหน้าอื่นๆ ใช้ localStorage เก็บสถานะบางอย่าง (token, username, server_role, role, role_permissions)

เอกสารนี้สรุปสถาปัตยกรรมของโปรเจ็ค ไฟล์หลัก การไหลของการยืนยันตัวตน (auth), โครงสร้าง role/permission รวมทั้งยกตัวอย่างโค้ดจากไฟล์จริงเพื่อให้อ่านเข้าใจง่าย

สารบัญ
- เริ่มต้นอย่างรวดเร็ว
- Backend
  - สถาปัตยกรรม
  - ไฟล์สำคัญและหน้าที่
  - โมเดลผู้ใช้และการจัดการรหัสผ่าน
  - เส้นทาง (routes) สำหรับ signup / login
- Frontend
  - สถาปัตยกรรม
  - ไฟล์สำคัญและหน้าที่
  - Routing และการป้องกันหน้า
  - RoleSelect และ permission model
  - Admin area & Permissions editor
  - UX / layout (NavBar, Logout)
- การรันโปรเจ็ค
- ข้อเสนอแนะด้านความปลอดภัยและการปรับปรุง

เริ่มต้นอย่างรวดเร็ว
------------------
Backend
1. สร้างไฟล์ `.env` ที่มีตัวแปร: MONGO_URI, JWT_SECRET (อาจเพิ่ม BCRYPT_ROUNDS, PASSWORD_PEPPER)
2. เปิด terminal:

```cmd
cd Backend
npm install
node server.js
```

Frontend
1. เปิด terminal:

```cmd
cd Frontend\pos-system
npm install
npm run dev
```

Backend
-------
สถาปัตยกรรม
- แอป Express ที่ mount route groups ที่ `/api/auth`, `/api/public`, `/api/protect`
- MongoDB (Mongoose) สำหรับ persistence
- bcrypt สำหรับ hashing รหัสผ่าน (พร้อมตัวเลือก PEPPER)
- JWT (jsonwebtoken) สำหรับการยืนยันตัวตน

ไฟล์สำคัญ
- `server.js` — bootstrap แอป, เปิด CORS, parse JSON, mount routes
- `config/db.js` — เชื่อมต่อ MongoDB
- `models/user.js` — schema ของผู้ใช้ (username, passwordHash, role) และ methods ช่วยเหลือ
- `routes/apiAuthRoutes.js` — signup, login
- `routes/apiProtectRoutes.js` — ตัวอย่าง protected route ที่ใช้ JWT middleware
- `routes/apiPublicRoutes.js` — ตัวอย่าง public route

server.js (ตัวอย่าง)
```js
// server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
require("./config/db");

app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => res.send("JWT API is running"));
app.use("/api/auth", apiAuthRoutes);
app.use("/api/public", apiPublicRoutes);
app.use("/api/protect", apiProtectRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
```

โมเดลผู้ใช้และการจัดการรหัสผ่าน
- `models/user.js` ระบุฟิลด์: `username`, `passwordHash`, `hashAlgo`, `role` และ timestamps
- `setPassword(plain)` — ใช้ bcrypt (และ PEPPER ถ้ามี) ในการ hash และเก็บใน `passwordHash`
- `comparePassword(candidate)` — เปรียบเทียบรหัสผ่านที่ส่งเข้ามากับ hash ที่เก็บไว้

ตัวอย่าง (excerpt)
```js
userSchema.methods.setPassword = async function (plain) {
  const toHash = PEPPER ? PEPPER + plain : plain;
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  this.passwordHash = await bcrypt.hash(toHash, salt);
  this.hashAlgo = "bcrypt";
};

userSchema.methods.comparePassword = async function (candidatePassword) {
  const toCompare = PEPPER ? PEPPER + candidatePassword : candidatePassword;
  if (!this.passwordHash) return false;
  return bcrypt.compare(toCompare, this.passwordHash);
};
```

Auth routes
- `POST /api/auth/signup` — สร้างผู้ใช้ใหม่
- `POST /api/auth/login` — ตรวจสอบ username/password และคืน JWT พร้อมข้อมูล role/user

ตัวอย่าง login handler (excerpt)
```js
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ message: "Invalid username or password" });
  const match = await user.comparePassword(password);
  if (!match) return res.status(401).json({ message: "Invalid username or password" });

  const payload = { userId: user._id, role: user.role, username: user.username };
  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: process.env.JWT_EXPIRES_IN || "1h" });
  res.json({ token, role: user.role, user: { username: user.username, role: user.role } });
});
```

Frontend
--------
สถาปัตยกรรม
- Vite + React
- React Router v6
- axios สำหรับเรียก API
- เก็บสถานะที่เกี่ยวกับ auth ใน `localStorage`:
  - `api_token` (JWT)
  - `server_role` (role ดิบที่ backend คืน)
  - `role` (UI key mapping)
  - `username` (แสดงใน NavBar)
  - `role_permissions` (mapping ที่แก้ไขได้โดย admin, เก็บเป็น JSON string)

ไฟล์สำคัญ
- `src/main.jsx` — entry point
- `src/App.jsx` — router configuration
- `src/components/ProtectedRoute.jsx` — wrapper สำหรับหน้าที่ต้องล็อกอิน
- `src/components/NavBar.jsx` — sidebar เมนู/ลิงก์
- `src/components/LogoutButton.jsx` — ปุ่ม logout (ล้าง localStorage และลบ header ของ axios)
- `src/pages/Login.jsx` — หน้า login และ logic เก็บ token
- `src/pages/RoleSelect.jsx` — หน้าเลือก role และการแสดงการ์ด
- `src/pages/admin/AdminLayout.jsx` — layout ของ admin (left sidebar + centered content)
- `src/pages/admin/Permissions.jsx` — editor สำหรับ role_permissions

Routing และการป้องกันหน้า
- ตัวอย่าง routing (จาก `App.jsx`): มีกลุ่ม route สำหรับ `/`, `/role`, `/sales`, `/warehouse`, `/admin` และ nested admin routes
- `ProtectedRoute` ตรวจว่า `localStorage.api_token` มีหรือไม่ ถ้าไม่มีจะ redirect ไปหน้า login

ProtectedRoute (ตัวอย่าง)
```jsx
export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('api_token')
  if (!token) return <Navigate to="/" replace />
  return children
}
```

Login flow (frontend)
- หน้า `Login.jsx` ส่ง username/password ไปที่ `/api/auth/login` ผ่าน axios
- ถ้าได้รับ token จะทำขั้นตอน:
  - เก็บ token -> `localStorage.api_token` และเรียก `setAuthToken(token)` เพื่อเซ็ต axios Authorization header
  - เก็บ `server_role` ลง `localStorage` และแปลงเป็น `role` (UI key) หากจำเป็น
  - เก็บ `username` ลง `localStorage.username`
  - นำทางผู้ใช้ไปหน้า `/role`

Login snippet (ตัวอย่าง)
```jsx
const res = await axios.post(`${API_BASE}/api/auth/login`, { username, password })
const token = res.data?.token
localStorage.setItem('api_token', token)
setAuthToken(token)
localStorage.setItem('server_role', serverRole)
localStorage.setItem('username', usernameFromResp)
navigate('/role')
```

RoleSelect & permissions
- `RoleSelect.jsx` จะแสดงการ์ดสำหรับ entry points (sales, admin, warehouse)
- การ์ดที่แสดงจะถูกกำหนดโดย `role_permissions` (localStorage) หรือ `DEFAULT_ROLE_PERMISSIONS` หากไม่มีค่า override
- หน้า Admin -> Permissions ช่วยให้แก้ไข mapping ได้ (ต่อไปอาจทำเป็น server-side API)

Permissions format (ตัวอย่าง)
```json
{
  "admin": ["admin","warehouse","sales"],
  "sales": ["sales"],
  "manager": ["warehouse","sales"]
}
```

Admin area
- `AdminLayout.jsx` วาง `NavBar` ด้านซ้ายและบริเวณเนื้อหากลาง (center) มี user badge ด้านบนขวา
- `Permissions.jsx` เป็น textarea + ปุ่ม Save เพื่อบันทึก `role_permissions` ลง localStorage

NavBar และ Logout UX
- ปัจจุบัน `NavBar.jsx` เป็น sidebar ด้านซ้ายตามที่ร้องขอ และแสดงเฉพาะลิงก์ Dashboard กับ Permissions
- มีปุ่ม "← Back to Roles" ด้านบนของ sidebar เพื่อกลับไปหน้าการเลือกบทบาท
- ปุ่ม Logout อยู่ตรงกลางด้านล่างของ sidebar พร้อม hover effect

โค้ดตัวอย่างที่สำคัญ (ย่อ)
- MenuLink (hover effect)
```jsx
function MenuLink({ to, children }) {
  const [hover, setHover] = useState(false)
  return (
    <Link to={to} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ transform: hover ? 'translateX(6px)' : 'none', background: hover ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
      {children}
    </Link>
  )
}
```

- ProtectedRoute (ตัวอย่าง)
```jsx
export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('api_token')
  if (!token) return <Navigate to="/" replace />
  return children
}
```

- Permissions editor (save handler ตัวอย่าง)
```jsx
function handleSave(){
  try{
    const parsed = JSON.parse(jsonText)
    localStorage.setItem('role_permissions', JSON.stringify(parsed))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  } catch(e){
    alert('Invalid JSON')
  }
}
```

- Logout helper (client-side)
```js
export async function logout() {
  try {
    const API_BASE = import.meta.env.VITE_API_URL || ''
    try { await axios.post(`${API_BASE}/api/auth/logout`) } catch (e) { }
  } finally {
    localStorage.removeItem('api_token')
    localStorage.removeItem('server_role')
    localStorage.removeItem('role')
    try { delete axios.defaults.headers.common['Authorization'] } catch (e) {}
  }
}
```

How auth state is used on the client
- `localStorage.api_token` — การมี token บ่งชี้ว่า authenticated (โดย `ProtectedRoute`)
- `localStorage.server_role` — role ดิบจาก backend (เช่น 'admin') สำหรับแสดงและ lookup permissions
- `localStorage.role` — UI role key mapping (ใช้โดย RoleSelect เพื่อ highlight)
- `localStorage.username` — ชื่อผู้ใช้สำหรับแสดงใน NavBar / badge
- `localStorage.role_permissions` — mapping ที่ admin ปรับได้ (client-side)

การรันโปรเจ็ค
- Backend: ตั้งค่า `.env` แล้วรัน `node server.js` (หรือ `npm start` ถ้ามี)
- Frontend: ใน `Frontend/pos-system` รัน `npm install` แล้ว `npm run dev`

ข้อเสนอแนะด้านความปลอดภัย & ปรับปรุง
- เก็บ JWT ใน localStorage มีความเสี่ยง XSS — แนะนำให้ใช้ HttpOnly cookies ใน production และสร้าง `/api/auth/me` เพื่อดึงโปรไฟล์ผู้ใช้
- ย้าย `role_permissions` ไปเก็บ server-side (DB) และทำ API สำหรับแก้ไขแทนการใช้ localStorage
- เพิ่ม rate limiting, การตรวจจับ brute-force, ตั้งค่า BCRYPT_ROUNDS ให้เหมาะสม และเก็บ PEPPER อย่างปลอดภัย (KMS)
- เพิ่ม unit/integration tests สำหรับ backend และ component tests สำหรับ frontend

สิ่งที่ควรทำต่อ (แนะนำ)
- สร้าง API สำหรับจัดเก็บ `role_permissions` และเชื่อมหน้า Admin ให้ทำงานร่วมกับ backend
- เปลี่ยน auth persistence เป็น HttpOnly cookies และปรับ front-end ให้ใช้ endpoint `/api/auth/me` เพื่อตรวจ session
- ปรับ ProtectedRoute ให้รองรับ token refresh / การจัดการหมดอายุ
- เพิ่มชุดทดสอบอัตโนมัติ (Jest / Supertest สำหรับ backend, React Testing Library สำหรับ frontend)

ถ้าต้องการ ผมสามารถช่วย:
- สร้าง README สั้นจากเอกสารนี้ (อังกฤษ/ไทย)
- สร้าง OpenAPI/Swagger สำหรับ backend
- ทำให้ `role_permissions` ถูกเก็บใน DB และเพิ่ม API เพื่อจัดการ

แจ้งผมได้เลยว่าต้องการให้ผมทำงานต่อในส่วนไหน — ผมจะแสดงแผนงานสั้นๆ ก่อนเริ่มและอัปเดตความคืบหน้าทีละขั้น
````
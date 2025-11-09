## สรุปการอัพเดท — 8 พฤศจิกายน 2025

วันนี้มีการแก้ไขและเพิ่มฟีเจอร์สำคัญในโปรเจกต์เพื่อรองรับการเก็บ ActivityLog ที่ครอบคลุม และปรับปรุงหน้า Logs ฝั่ง frontend ให้ทนทานต่อกรณีสินค้าถูกลบ รายการเปลี่ยนแปลงหลัก ๆ มีดังนี้:

- Backend
	- เพิ่ม helper กลางสำหรับเขียน ActivityLog: `Backend/utils/activityLogger.js` (ฟังก์ชัน `logActivity`)
	- เพิ่ม endpoint สำหรับดึงกิจกรรมที่เกี่ยวข้องกับคลังสินค้า: `GET /api/protect/logs/warehouse-activity` (ไฟล์: `Backend/routes/apiProtectRoutes.js`) — เงื่อนไขการกรองกว้างขึ้น (actorRole, action-prefix และการแมป path) เพื่อให้จับกิจกรรมที่มีผลต่อ warehouse ได้ครบ
	- เพิ่ม `GET /api/protect/products/:id` ใน `Backend/routes/apiProductRoutes.js` เพื่อให้ frontend ดึงชื่อสินค้า/sku ในการแสดงผล logs
	- เรียก `logActivity` ในจุดสำคัญ (เช่น product create/update/delete, stock in/out) เพื่อให้มี audit trail

- Frontend
	- รวมลิงก์ Logs ใน `NavBar` เป็นลิงก์เดียวและแสดงตาม permission (ไฟล์: `src/components/NavBar.jsx`, `src/App.jsx`)
	- รวมหน้า Admin logs ให้เป็นหน้าเดียว พร้อมตัวเลือก role filter (ไฟล์: `src/pages/admin/Logs.jsx`)
	- ปรับหน้า Warehouse logs เป็นตาราง: `src/pages/warehouse/Logs.jsx` — ดึงข้อมูลจาก `/api/protect/logs/warehouse-activity`, แสดงคอลัมน์ Action/Product/Actor/Change/Status/When
	- เพิ่มการ enrich ข้อมูล Product โดย fetch `GET /api/protect/products/:id` และ cache ผลลัพธ์ใน `productMap`
	- ทำให้การดึงข้อมูลหลายรายการทนทานขึ้นด้วย `Promise.allSettled` และเก็บ sentinel `{ missing: true, sku: ... }` เมื่อ fetch ล้มเหลว
	- อัปเดต UI ให้แสดง "Deleted product" เมื่อ sentinel ถูกเก็บไว้ใน `productMap` แทนแสดงเพียง '-' (ไฟล์: `src/pages/warehouse/Logs.jsx`)

- ปัญหาและการแก้ไขที่เกิดขึ้นวันนี้
	- เบราว์เซอร์รายงาน 404 สำหรับ `GET /api/protect/products/6902fb5f2e6aa23b01fff6b2` — สาเหตุที่เป็นไปได้: สินค้าถูกลบ, route ยังไม่ถูก mount (backend ต้อง restart), หรือ request ขาด Authorization (น้อยกว่า)
	- ก่อนหน้านี้มีปัญหา Promise.all ที่ทำให้การดึง product หลายรายการล้มทั้งหมดเมื่อมีตัวใดตัวหนึ่ง 404 — แก้เป็น `Promise.allSettled` แล้วเก็บ sentinel แทน
	- เกิดข้อผิดพลาดขณะ apply patch ครั้งแรกเพราะ context ไม่ตรง (invalid context) — แก้โดยอ่านไฟล์ใหม่และใช้ patch ย่อยจนสำเร็จ

- ข้อแนะนำถัดไป
	1. รีสตาร์ท backend เพื่อให้แน่ใจว่า route ใหม่ (รวมถึง `GET /api/protect/products/:id` และ `/api/protect/logs/warehouse-activity`) ถูกใช้งาน
	2. ทดสอบด้วยคำสั่ง curl (cmd.exe) พร้อม token เพื่อยืนยันว่า endpoint ตอบ 200/404 ตามสภาพจริงของฐานข้อมูล:
```cmd
curl -i -H "Authorization: Bearer <TOKEN>" "http://localhost:3000/api/protect/products/6902fb5f2e6aa23b01fff6b2"
```
	3. ถ้าต้องการลดการพึ่งพา product lookup ในอนาคต ให้เพิ่ม `productName` และ `sku` ลงใน `ActivityLog.details` ตอนเขียน log (เช่นตอน stock in/out หรือ product create/update/delete)
	4. (Optional) สแกนหา endpoint ที่ทำ DB mutation ที่ยังไม่เรียก `logActivity` และเพิ่มการบันทึกเพื่อให้ audit ครบ

หากต้องการ ผมสามารถทำการแก้ backend เพิ่ม `productName`/`sku` ลงใน ActivityLog ในทุกจุด mutation ได้เลย (patch เล็ก ๆ) — แจ้งมาได้ว่าต้องการให้ผมทำต่อหรือจะรันการตรวจสอบด้วยตัวเองแล้วส่งผลกลับมา

----
บันทึกนี้ถูกสร้างโดยการรวมการเปลี่ยนแปลงและการดีบักที่เกิดขึ้นใน session วันนี้ (8 พ.ย. 2025)


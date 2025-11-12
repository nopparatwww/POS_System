import axios from "axios";
import { logger } from "./utils/logger";

// สร้าง instance ของ axios ที่จะใช้ทั้งแอป
const api = axios.create({
  baseURL: "http://localhost:3000/api/protect",
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: แนบ token อัตโนมัติ
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem("api_token");
      logger.log("🔑 token attached:", token);
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      logger.error("Request interceptor error:", e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: จัดการ 401/403 และ behavior อื่น ๆ
api.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const status = error?.response?.status;
      const code = error?.response?.data?.code;
      const url = error?.config?.url || "";

      logger.warn("API response error:", status, url);

      if (status === 401 || status === 403) {
        try {
          localStorage.removeItem("api_token");
        } catch (e) {
          logger.error("Failed to remove api_token:", e);
        }

        if (code === "SHIFT_OUTSIDE") {
          if (url.includes("/api/auth/login")) {
            window.alert(
              "ไม่สามารถเข้าสู่ระบบได้ เนื่องจากคุณอยู่นอกเวลางานแล้ว"
            );
          } else {
            window.alert("คุณอยู่นอกเวลางานแล้ว ไม่สามารถใช้งานระบบได้");
            try {
              window.location.replace("/");
            } catch (e) {
              logger.error("redirect error:", e);
            }
          }
        }
      }
    } catch (e) {
      logger.error("Response interceptor error:", e);
    }

    return Promise.reject(error);
  }
);

// ส่งออกแบบ named export เพียงครั้งเดียว
export { api };

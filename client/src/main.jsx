import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Đăng ký service worker để trình duyệt trên điện thoại (Android/Chrome, và
// các trình duyệt hỗ trợ khác) cho phép "Cài đặt ứng dụng" lên màn hình
// chính, dùng như app riêng (không thanh địa chỉ). Chỉ chạy khi phục vụ qua
// HTTPS hoặc localhost — yêu cầu bắt buộc của Service Worker API.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Không đăng ký được service worker (cài PWA có thể không khả dụng):", err.message);
    });
  });
}

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
//
// Khi Claude/bạn deploy thêm tính năng mới lên server, trình duyệt sẽ tự
// phát hiện service worker mới → hiện banner nhỏ mời người dùng bấm tải lại
// để dùng bản mới ngay — KHÔNG cần gỡ và cài lại ứng dụng, KHÔNG mất dữ liệu
// (dữ liệu luôn nằm trên server, không nằm trên máy người dùng).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Chủ động hỏi lại server xem có bản mới không mỗi khi mở app, thay vì
      // chỉ chờ trình duyệt tự kiểm tra định kỳ.
      reg.update().catch(() => {});

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          // "installed" + đã có sẵn 1 service worker khác đang điều khiển
          // trang = đây là một bản CẬP NHẬT (không phải lần cài đầu tiên).
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(newWorker);
          }
        });
      });
    }).catch((err) => {
      console.warn("Không đăng ký được service worker (cài PWA có thể không khả dụng):", err.message);
    });

    // Nếu service worker mới đã sẵn sàng điều khiển trang (sau khi người
    // dùng bấm "Tải lại" ở banner), tự làm mới trang 1 lần để áp dụng bản mới.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

function showUpdateBanner(newWorker) {
  if (document.getElementById("app-update-banner")) return;
  const bar = document.createElement("div");
  bar.id = "app-update-banner";
  bar.style.cssText = [
    "position:fixed", "left:0", "right:0", "bottom:0", "z-index:99999",
    "background:#1E3A5F", "color:#fff", "font-family:'IBM Plex Sans',system-ui,sans-serif",
    "font-size:13px", "padding:10px 16px", "display:flex", "align-items:center",
    "justify-content:center", "gap:14px", "box-shadow:0 -4px 12px rgba(0,0,0,0.15)",
  ].join(";");
  bar.innerHTML =
    '<span>Đã có bản cập nhật mới của phần mềm.</span>' +
    '<button id="app-update-btn" style="background:#CA8A04;color:#1E293B;border:none;' +
    'border-radius:6px;padding:6px 14px;font-weight:600;cursor:pointer;font-size:13px;">Tải lại để dùng ngay</button>';
  document.body.appendChild(bar);
  document.getElementById("app-update-btn").addEventListener("click", () => {
    newWorker.postMessage({ type: "SKIP_WAITING" });
    bar.remove();
  });
}

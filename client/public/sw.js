// Service worker — vừa để trình duyệt cho phép "Cài đặt ứng dụng" lên màn
// hình chính, vừa cache nhẹ để mở nhanh hơn, NHƯNG luôn ưu tiên lấy bản MỚI
// NHẤT của trang mỗi khi có mạng — để khi Claude/bạn cập nhật thêm tính
// năng, người dùng chỉ cần MỞ LẠI ứng dụng là thấy bản mới ngay, không cần
// gỡ cài đặt hay cài lại. KHÔNG cache dữ liệu API (dữ liệu dự án luôn lấy
// mới từ server để tránh xem nhầm dữ liệu cũ/mất dữ liệu).
//
// Chiến lược:
//  - Trang HTML (điều hướng): NETWORK-FIRST — luôn thử lấy bản mới nhất từ
//    mạng trước; chỉ dùng bản cache khi mất mạng (xem offline).
//  - File JS/CSS/ảnh do Vite build ra (tên file có mã hash riêng theo nội
//    dung): cache-first — an toàn vì nội dung đổi thì tên file cũng đổi,
//    không bao giờ phục vụ nhầm bản cũ dưới tên file mới.

const CACHE_NAME = "nam-app-shell-v2";

self.addEventListener("install", (event) => {
  // KHÔNG tự động skipWaiting() ở đây nữa — đợi người dùng chủ động bấm
  // "Tải lại để dùng ngay" trên banner (main.jsx gửi message SKIP_WAITING)
  // để tránh tự làm mới trang đột ngột giữa lúc họ đang gõ dở nội dung.
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Không bao giờ cache các lời gọi API — luôn lấy dữ liệu mới nhất.
  if (url.pathname.startsWith("/api/")) return;
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Điều hướng trang (mở app / F5 / bấm icon trên điện thoại) → network-first
  // để LUÔN thấy bản mới nhất ngay khi có mạng.
  const isNavigation = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Tài nguyên tĩnh có hash trong tên file (JS/CSS/ảnh do Vite build) →
  // cache-first, cực nhanh, và luôn ĐÚNG vì nội dung đổi thì tên file đổi.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
  );
});

// Service worker tối giản — chỉ để trình duyệt (đặc biệt Android/Chrome) cho
// phép "Cài đặt ứng dụng" lên màn hình chính, và cache nhẹ các tài nguyên
// tĩnh (JS/CSS/icon) để mở app nhanh hơn ở lần sau. KHÔNG cache dữ liệu API —
// dữ liệu dự án luôn phải lấy mới từ server để tránh xem nhầm dữ liệu cũ.

const CACHE_NAME = "nam-app-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
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
  const url = new URL(event.request.url);

  // Không bao giờ cache các lời gọi API — luôn lấy dữ liệu mới nhất.
  if (url.pathname.startsWith("/api/")) return;

  // Chỉ cache GET tài nguyên tĩnh cùng gốc (JS/CSS/ảnh/font do Vite build ra).
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      // Trả cache ngay nếu có (mở nhanh), vẫn âm thầm cập nhật cache ở nền.
      return cached || networkFetch;
    })
  );
});

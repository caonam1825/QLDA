# Quản lý dự án đầu tư — Phần mềm nhiều người dùng

Ứng dụng web tự host, có đăng nhập riêng cho từng người, cho phép nhiều người
cùng quản lý & giao việc trên các dự án đầu tư khu đô thị / khu dân cư
(quy hoạch → chủ trương đầu tư → đấu thầu lựa chọn nhà đầu tư → giải phóng mặt
bằng → khởi công).

- **Backend**: Node.js + Express + SQLite (1 file, không cần cài đặt máy chủ
  cơ sở dữ liệu riêng).
- **Frontend**: React (Vite), được build thành file tĩnh và phục vụ luôn bởi
  backend — chỉ cần chạy **một** tiến trình, **một** cổng.
- **Đăng nhập**: email + mật khẩu, JWT. Mỗi dự án có chủ dự án (owner) và có
  thể mời thêm thành viên khác (quyền Chỉnh sửa hoặc Chỉ xem) bằng email đã
  đăng ký trên hệ thống.

---

## 1. Chạy thử trên máy cá nhân (development)

Yêu cầu: đã cài [Node.js](https://nodejs.org) bản 18 trở lên.

```bash
# Cài đặt
cd server && npm install
cd ../client && npm install

# Chạy backend (cổng 4000)
cd ../server
cp .env.example .env      # sửa JWT_SECRET trong file .env trước khi dùng thật
npm run dev

# Mở terminal khác — chạy frontend (cổng 5173, tự proxy /api sang cổng 4000)
cd ../client
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`, đăng ký tài khoản đầu tiên và bắt
đầu sử dụng.

---

## 2. Build bản chạy thật (production) — 1 server duy nhất

```bash
cd client
npm install
npm run build          # build ra thẳng thư mục ../server/public

cd ../server
npm install
cp .env.example .env   # BẮT BUỘC đổi JWT_SECRET thành chuỗi bí mật của riêng bạn
npm start               # chạy tại http://localhost:4000 (đổi PORT trong .env nếu cần)
```

Lúc này backend vừa phục vụ API (`/api/...`) vừa phục vụ luôn giao diện web đã
build — chỉ cần mở cổng 4000 (hoặc cổng bạn đặt trong `.env`) ra ngoài là mọi
người trong công ty/tổ chức có thể truy cập.

---

## 3. Chạy bằng Docker (khuyến nghị để triển khai)

```bash
docker compose up -d --build
```

Mặc định ứng dụng chạy tại `http://<địa-chỉ-server>:4000`. Dữ liệu SQLite được
lưu trong volume `nam-app-data` nên không mất khi container khởi động lại.

**Trước khi chạy thật, mở file `docker-compose.yml` và đổi giá trị
`JWT_SECRET` thành một chuỗi bí mật ngẫu nhiên, dài, do bạn tự đặt.**

---

## 4. Đưa lên Internet để gửi link cho mọi người dùng

Cách đơn giản nhất là thuê một VPS nhỏ (ví dụ DigitalOcean, Vultr, hoặc VPS
trong nước), cài Docker, rồi:

```bash
git clone <repo-của-bạn>    # hoặc copy toàn bộ thư mục lên server qua scp/rsync
cd nam-project-app
# sửa JWT_SECRET trong docker-compose.yml
docker compose up -d --build
```

Sau đó:
- Trỏ một tên miền (hoặc dùng thẳng IP:4000) tới server.
- Khuyến nghị đặt Nginx hoặc Caddy phía trước để bật HTTPS miễn phí
  (Let's Encrypt) — vì trình duyệt sẽ cảnh báo và một số tính năng có thể bị
  chặn nếu chạy HTTP thuần trên domain thật.
- Gửi đường link (VD: `https://duan.congty-cua-ban.vn`) cho đồng nghiệp —
  mỗi người tự đăng ký tài khoản bằng email của họ, sau đó bạn (chủ dự án)
  vào **"Thành viên"** trong từng dự án để thêm họ vào.

Nếu chưa có VPS, các nền tảng có gói miễn phí/giá rẻ hỗ trợ chạy Docker + ổ đĩa
bền vững (persistent volume) như Render, Railway, Fly.io cũng chạy được dự án
này gần như không cần sửa gì — chỉ cần cấu hình biến môi trường `JWT_SECRET`
và mount volume cho đường dẫn `DB_PATH`.

---

## 5. Cấu trúc dự án

```
server/            Backend Express + SQLite
  src/
    db.js          Tạo bảng dữ liệu (users, projects, groups, tasks, members)
    auth.js        Băm mật khẩu, tạo/kiểm tra JWT
    routes/auth.js       API đăng ký / đăng nhập / thông tin cá nhân
    routes/projects.js   API dự án / nhóm bước / công việc / thành viên
    templateData.js      Dữ liệu mẫu 98 bước từ hồ sơ gốc, dùng khi tạo dự án "Từ mẫu chuẩn"
    index.js        Điểm khởi chạy server, phục vụ luôn frontend đã build
  public/           (sinh ra sau khi build client — không cần commit)
  data/             (sinh ra khi chạy — chứa app.db, không cần commit)

client/             Frontend React (Vite)
  src/
    pages/          Login, Register, Dashboard
    components/     TaskRow, GroupBlock/PhaseBlock, ProjectSwitcher, MembersPanel...
    api.js           Gọi API kèm token đăng nhập
    constants.js      Danh sách giai đoạn, trạng thái, hàm hỗ trợ

docker-compose.yml  Chạy toàn bộ bằng 1 lệnh
Dockerfile          Build multi-stage: build client rồi đóng gói cùng server
```

---

## 6. Tính năng chính

- **Nhiều dự án**: mỗi người/dự án tạo bao nhiêu dự án tuỳ ý — từ mẫu chuẩn 98
  bước (Quy hoạch → Giai đoạn A: chủ trương đầu tư đến ký hợp đồng nhà đầu tư
  → Giai đoạn B: ký hợp đồng đến khởi công) hoặc bắt đầu trống hoàn toàn.
- **Tuỳ chỉnh linh hoạt**: thêm/xoá/sửa/sắp xếp lại từng nhóm bước và từng đầu
  việc — tên công việc, đơn vị thực hiện, đơn vị phối hợp, thời gian dự kiến,
  căn cứ pháp lý, ghi chú.
- **Giao việc & theo dõi**: trạng thái (chưa bắt đầu / đang thực hiện / hoàn
  thành / tạm dừng), người phụ trách, hạn hoàn thành, cảnh báo trễ hạn, % hoàn
  thành theo dự án / giai đoạn / nhóm.
- **Nhiều người cùng dùng thật sự**: mỗi dự án có chủ dự án (owner) mời thêm
  thành viên bằng email (quyền Chỉnh sửa hoặc Chỉ xem); dữ liệu lưu tập trung
  trên server, ai cũng thấy cùng một dữ liệu khi tải lại trang.

## 7. Giới hạn cần biết

- Ứng dụng **chưa** đồng bộ theo thời gian thực kiểu Google Docs (không dùng
  WebSocket) — mỗi người cần bấm "Tải lại" hoặc thao tác để lấy dữ liệu mới
  nhất người khác vừa cập nhật.
- SQLite phù hợp cho một tổ chức/phòng ban dùng nội bộ (vài chục đến vài trăm
  người dùng đồng thời); nếu quy mô lớn hơn nhiều, nên chuyển sang PostgreSQL.
- Nội dung "Căn cứ pháp lý" trong dữ liệu mẫu trích dẫn theo Luật Đất đai 2013,
  Luật Đấu thầu 2013 và các nghị định cũ; nhiều văn bản đã được thay thế bởi
  Luật Đất đai 2024, Luật Đấu thầu 2023, Luật Nhà ở 2023, Luật Kinh doanh Bất
  động sản 2023 cùng các nghị định hướng dẫn mới. Hãy cập nhật lại nội dung
  này (sửa trực tiếp trong app) hoặc tham vấn bộ phận pháp chế trước khi dùng
  cho dự án thực tế.

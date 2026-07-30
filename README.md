# Quản lý dự án đầu tư — Phần mềm nhiều người dùng

Ứng dụng web tự host, có đăng nhập riêng cho từng người, cho phép nhiều người
cùng quản lý & giao việc trên các dự án đầu tư khu đô thị / khu dân cư
(quy hoạch → chủ trương đầu tư → đấu thầu lựa chọn nhà đầu tư → giải phóng mặt
bằng → khởi công).

- **Backend**: Node.js + Express + SQLite (1 file, không cần cài đặt máy chủ
  cơ sở dữ liệu riêng).
- **Frontend**: React (Vite), được build thành file tĩnh và phục vụ luôn bởi
  backend — chỉ cần chạy **một** tiến trình, **một** cổng.
- **Đăng nhập**: số điện thoại + mật khẩu, JWT (email là tuỳ chọn, chỉ để hiển
  thị). Mỗi dự án có chủ dự án (owner) và có thể mời thêm thành viên khác
  (quyền Chỉnh sửa hoặc Chỉ xem) bằng số điện thoại đã đăng ký trên hệ thống.

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
    db.js          Tạo bảng dữ liệu (users, projects, groups, tasks, members, staff, reminder_log)
    auth.js        Băm mật khẩu, tạo/kiểm tra JWT
    phone.js        Chuẩn hoá & kiểm tra số điện thoại Việt Nam
    zalo.js         Gọi API gửi tin nhắn Zalo OA
    reminders.js     Bộ quét định kỳ tự nhắc việc trễ hạn/sắp đến hạn qua Zalo
    routes/auth.js        API đăng ký / đăng nhập bằng SĐT / thông tin cá nhân
    routes/projects.js    API dự án / nhóm bước / công việc / thành viên / nhân viên / liên kết Zalo
    routes/reports.js     API tổng hợp nhiều dự án + xếp hạng KPI nhân viên
    routes/zalo.js         Webhook nhận sự kiện từ Zalo OA
    templateData.js      Dữ liệu mẫu trình tự thực hiện dự án, dùng khi tạo dự án "Từ mẫu chuẩn"
    index.js        Điểm khởi chạy server, phục vụ luôn frontend đã build
  public/           (sinh ra sau khi build client — không cần commit)
  data/             (sinh ra khi chạy — chứa app.db, không cần commit)

client/             Frontend React (Vite)
  src/
    pages/          Login, Register, Dashboard
    components/     TaskRow, GroupBlock/PhaseBlock, ProjectSwitcher, MembersPanel,
                     StaffPanel (liên kết Zalo), ReportPanel, OverviewPanel (Tổng hợp & KPI)...
    api.js           Gọi API kèm token đăng nhập
    constants.js      Danh sách giai đoạn, trạng thái, hàm hỗ trợ

docker-compose.yml  Chạy toàn bộ bằng 1 lệnh
Dockerfile          Build multi-stage: build client rồi đóng gói cùng server
```

---

## 6. Tính năng chính

- **Nhiều dự án**: mỗi người/dự án tạo bao nhiêu dự án tuỳ ý — từ mẫu chuẩn
  trình tự thực hiện dự án (Khảo sát → Chủ trương đầu tư → Đấu thầu lựa chọn
  nhà đầu tư → Quy hoạch chi tiết 1/500 → Thu hồi đất, bồi thường GPMB →
  BCNCKT/Thiết kế cơ sở → Thiết kế xây dựng → Giấy phép xây dựng → Thi công →
  Nghiệm thu, bàn giao) hoặc bắt đầu trống hoàn toàn.
- **Tuỳ chỉnh linh hoạt**: thêm/xoá/sửa/sắp xếp lại từng nhóm bước và từng đầu
  việc — tên công việc, đơn vị thực hiện, đơn vị phối hợp, thời gian dự kiến,
  căn cứ pháp lý, ghi chú.
- **Danh sách nhân viên**: mỗi dự án có một danh bạ nhân viên riêng (tên, chức
  vụ, phòng/đơn vị, email, điện thoại) — gán trực tiếp cho từng công việc thay
  vì gõ tay tên mỗi lần, và dùng để tổng hợp báo cáo theo người.
- **Giao việc & theo dõi**: trạng thái (chưa bắt đầu / đang thực hiện / hoàn
  thành / tạm dừng), người phụ trách (chọn từ danh sách nhân viên), hạn hoàn
  thành, % hoàn thành theo dự án / giai đoạn / nhóm.
- **Cảnh báo & báo cáo theo từng dự án**: nút "Báo cáo" hiển thị số việc trễ
  hạn ngay trên header; bảng báo cáo Hôm nay / Tuần này liệt kê việc trễ hạn
  cần nhắc nhở, việc sắp đến hạn, việc đã hoàn thành, và bảng tổng hợp theo
  từng nhân viên.
- **Tổng hợp toàn hệ thống & xếp hạng KPI** (nút "Tổng hợp & KPI" trên header):
  gộp số liệu, việc trễ hạn/sắp đến hạn từ **tất cả** dự án bạn tham gia trong
  một bảng duy nhất; đồng thời tự động tính điểm KPI và xếp hạng từng nhân
  viên (hoàn thành đúng hạn, trễ hạn, đang vướng mắc, tỷ lệ hoàn thành) — một
  người làm nhiều dự án được gộp điểm theo số điện thoại.
- **Nhắc việc qua Zalo**: mỗi nhân viên có thể liên kết tài khoản Zalo cá nhân
  (qua Official Account của công ty); hệ thống tự động quét mỗi 30 phút và
  nhắn Zalo cho đúng người khi công việc của họ trễ hạn hoặc sắp đến hạn. Cần
  tự cấu hình Zalo OA trước — xem mục 9.
- **Gợi ý bước tiếp theo**: mỗi giai đoạn hiển thị sẵn công việc kế tiếp cần
  làm (theo đúng thứ tự đã sắp xếp) kèm căn cứ pháp lý và ghi chú quy trình
  của bước đó — không cần dò lại toàn bộ danh sách để biết "giờ phải làm gì".
- **Nhiều người cùng dùng thật sự**: mỗi dự án có chủ dự án (owner) mời thêm
  thành viên bằng số điện thoại; dữ liệu lưu tập trung trên server, ai cũng
  thấy cùng một dữ liệu khi tải lại trang.
- **Xem tiến độ dự án khác**: bất kỳ ai đã đăng nhập cũng xem được (chế độ chỉ
  xem) tiến độ của MỌI dự án trong hệ thống, kể cả dự án mình không phải
  thành viên chính thức — chỉ chỉnh sửa mới cần đúng quyền.
- **Phân quyền chi tiết theo từng thành viên/nhân viên** (không chỉ 2 mức
  "chỉnh sửa / chỉ xem" như trước): Chủ dự án, Chỉnh sửa toàn quyền, Chỉ thêm
  quy trình (thêm/xoá/sắp xếp nhóm bước — không sửa nội dung hay tiến độ), Chỉ
  sửa tên đầu việc (chỉ sửa tên/nội dung công việc có sẵn — không thêm/xoá,
  không cập nhật tiến độ), và Chỉ xem. Đổi quyền trong mục "Thành viên".
- **Thêm nhân viên không cần tự đăng ký**: mục "Nhân viên" cho phép thêm người
  vào danh bạ để gán việc mà không cần họ có tài khoản; nếu muốn họ tự đăng
  nhập xem/cập nhật việc của mình, admin có thể **cấp thẳng tài khoản** (số
  điện thoại + mật khẩu + vai trò) ngay khi thêm nhân viên, không cần qua màn
  hình đăng ký.
- **Quản trị hệ thống (Super Admin)**: người đăng ký đầu tiên của hệ thống tự
  động có quyền cao nhất — toàn quyền trên MỌI dự án (kể cả khoá/mở khoá hạn),
  không phụ thuộc có phải thành viên hay không. Có thể cấp/thu hồi quyền này
  cho người khác trong mục "Quản trị hệ thống" trên header.
- **Khoá hạn hoàn thành làm căn cứ KPI**: mỗi đầu việc có thể được chủ dự án
  khoá hạn hoàn thành lại — sau khi khoá, không ai (kể cả chủ dự án qua thao
  tác thường) sửa được hạn nữa cho đến khi mở khoá lại, đảm bảo dữ liệu KPI
  không bị chỉnh sửa giữa chừng.
- **Quản trị hệ thống (Super Admin)**: người đăng ký đầu tiên của hệ thống tự
  động có quyền cao nhất — toàn quyền trên MỌI dự án (kể cả khoá/mở khoá hạn),
  không phụ thuộc có phải thành viên hay không. Có thể cấp/thu hồi quyền này
  cho người khác trong mục "Quản trị hệ thống" trên header.
- **Việc của tôi & lọc nhanh**: mỗi nhân viên/quản lý có tài khoản đăng nhập
  thấy ngay nút "Việc của tôi" cùng các lọc nhanh Đang thực hiện / Đã hoàn
  thành / Trễ hạn ngay trên thanh công cụ, không cần dựng lại bộ lọc mỗi lần.
- **Bấm vào tên xem việc đang phụ trách**: bấm vào tên nhân viên (mục Nhân
  viên) hoặc tên trong bảng xếp hạng KPI để xem ngay danh sách công việc đang
  phụ trách kèm hạn hoàn thành, không cần lọc thủ công.

## 7. Cập nhật bản đang chạy (nếu đã triển khai trước đó)

Các thay đổi này chỉ **thêm** bảng/cột dữ liệu mới, không xoá dữ liệu cũ — an
toàn để cập nhật lên bản đang chạy:

1. Ghi đè toàn bộ file trong repo GitHub của bạn bằng bộ mã nguồn mới này
   (kéo-thả lại như lần đầu, hoặc `git push` nếu bạn dùng dòng lệnh).
2. Nếu triển khai qua Render: repo cập nhật sẽ tự kích hoạt "Deploy" mới (hoặc
   vào dashboard Render → bấm **Manual Deploy** → **Deploy latest commit**).
3. Nếu chạy bằng Docker/VPS: chạy lại `docker compose up -d --build`.
4. Không cần thao tác gì thêm với cơ sở dữ liệu — ứng dụng tự thêm bảng/cột
   mới khi khởi động lần đầu sau khi cập nhật.

**Lưu ý quan trọng về đổi sang đăng nhập bằng số điện thoại**: các tài khoản
đã tạo trước đây (đăng nhập bằng email) sẽ được tự động gán một số điện thoại
tạm là `cần-cập-nhật-<mã người dùng>` để không mất dữ liệu. Những người dùng
này **cần được cấp lại/đổi số điện thoại thật** trước khi có thể đăng nhập lại
bằng số điện thoại của họ — hiện tại việc này cần chỉnh trực tiếp trong cơ sở
dữ liệu (bảng `users`, cột `phone`) vì đây là thay đổi lớn về định danh tài
khoản. Nếu hệ thống của bạn còn ít người dùng, cách đơn giản nhất là mọi người
đăng ký lại tài khoản mới bằng số điện thoại.

## 8. Giới hạn cần biết

- Ứng dụng **chưa** đồng bộ theo thời gian thực kiểu Google Docs (không dùng
  WebSocket) — mỗi người cần bấm "Tải lại" hoặc thao tác để lấy dữ liệu mới
  nhất người khác vừa cập nhật.
- SQLite phù hợp cho một tổ chức/phòng ban dùng nội bộ (vài chục đến vài trăm
  người dùng đồng thời); nếu quy mô lớn hơn nhiều, nên chuyển sang PostgreSQL.
- Nội dung "Căn cứ pháp lý" trong dữ liệu mẫu đã cập nhật theo Luật Đầu tư
  143/2025/QH15, Luật Đất đai 2024, Luật Xây dựng 135/2025/QH15, Luật Quy
  hoạch đô thị và nông thôn 47/2024/QH15 cùng các nghị định hướng dẫn ban hành
  2025–2026 (NĐ 96/2026, NĐ 217/2026, NĐ 178/2025, NĐ 102/2024, NĐ 49/2026…).
  Đây vẫn là dữ liệu tổng hợp tham khảo ban đầu — vui lòng đối chiếu quy định
  hiện hành hoặc tham vấn đơn vị pháp chế trước khi áp dụng cho dự án thực tế,
  đặc biệt với các văn bản có hiệu lực theo mốc thời gian riêng (VD NĐ 96/2026
  có hiệu lực từ 31/03/2026).
- Điểm KPI là công thức mặc định đơn giản (xem `server/src/routes/reports.js`,
  hàm `/kpi`) — sửa trực tiếp trong file đó nếu công ty muốn đổi trọng số hoặc
  thêm tiêu chí khác (VD: mức độ khó của công việc, đánh giá định tính…).

## 9. Cấu hình nhắc việc qua Zalo (không bắt buộc)

Tính năng nhắc việc trễ hạn/sắp đến hạn qua Zalo cần bạn **tự chuẩn bị trước**
những thứ sau (phần mềm không thể tự tạo thay):

1. Một **Zalo Official Account (OA)** của công ty đã được xác thực — đăng ký
   tại <https://oa.zalo.me>.
2. Một ứng dụng trên <https://developers.zalo.me> liên kết với OA đó, được cấp
   quyền gửi "Tin nhắn tư vấn" (OA Message CS).
3. Lấy **access token** của OA qua luồng OAuth của Zalo, điền vào biến môi
   trường `ZALO_OA_ACCESS_TOKEN` trong file `.env` (xem `.env.example`).
   Access token của Zalo hết hạn định kỳ (thường ~25 giờ) — cần lấy lại và cập
   nhật `.env` theo chu kỳ, hoặc nhờ bộ phận kỹ thuật dựng thêm luồng tự làm
   mới token nếu dùng lâu dài.
4. Khai báo **Webhook URL** là `https://<địa-chỉ-server-của-bạn>/api/zalo/webhook`
   trong mục Webhook của ứng dụng Zalo, để hệ thống nhận được sự kiện khi nhân
   viên nhắn mã liên kết cho OA.

Sau khi cấu hình xong, cách liên kết cho từng nhân viên:

1. Vào mục **Nhân viên** trong dự án, bấm biểu tượng Zalo bên cạnh tên nhân
   viên để lấy **mã liên kết** 6 ký tự.
2. Nhờ nhân viên đó mở Zalo, tìm Official Account của công ty và nhắn đúng mã
   này cho OA.
3. Hệ thống tự động khớp mã và lưu lại — từ đó nhân viên sẽ nhận được tin nhắc
   việc qua Zalo khi công việc của họ trễ hạn hoặc sắp đến hạn (quét mỗi 30
   phút).

Lưu ý: theo chính sách của Zalo, OA chỉ được chủ động gửi tin trong vòng 48
giờ kể từ lần người dùng tương tác gần nhất với OA — nếu nhân viên không nhắn
tin lại với OA trong thời gian dài, tin nhắc việc có thể không gửi được cho
đến khi họ tương tác lại.

## 10. Cài đặt lên điện thoại (không cần lên App Store / CH Play)

Ứng dụng giờ là PWA (Progressive Web App) — cài được thẳng lên màn hình chính
điện thoại như một app riêng, không cần qua App Store/CH Play:

- **Điều kiện bắt buộc**: trang web phải chạy qua **HTTPS** (hoặc `localhost`
  khi test). PWA sẽ không cài được nếu chạy HTTP thuần trên domain thật — xem
  lại mục 4 về việc đặt Nginx/Caddy để bật HTTPS miễn phí.
- **Android (Chrome)**: mở link ứng dụng → trình duyệt tự hiện banner "Thêm
  vào Màn hình chính" / "Cài đặt ứng dụng", hoặc vào menu (⋮) → "Cài đặt ứng
  dụng".
- **iPhone/iPad (Safari)**: mở link ứng dụng → bấm nút Chia sẻ (hình vuông có
  mũi tên) → "Thêm vào MH chính" (Add to Home Screen). iOS không tự hiện
  banner như Android, phải làm thao tác này thủ công.
- Sau khi cài, ứng dụng mở toàn màn hình như app thường, có icon riêng, không
  hiện thanh địa chỉ trình duyệt.
- Dữ liệu dự án luôn được tải mới từ server (không cache), chỉ phần giao diện
  (JS/CSS/icon) được cache nhẹ để mở nhanh hơn ở lần sau — xem
  `client/public/sw.js` nếu muốn tuỳ chỉnh.
- Icon mặc định là icon tạm (chữ "NAM" nền xanh) — nên thay bằng logo thật của
  công ty tại `client/public/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` (giữ nguyên tên file và kích thước).

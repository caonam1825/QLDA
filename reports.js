const express = require("express");
const db = require("../db");
const { sendZaloText } = require("../zalo");

const router = express.Router();

// Zalo OA gọi vào đây mỗi khi có người nhắn tin cho OA (cần khai báo URL này
// trong mục Webhook của ứng dụng trên https://developers.zalo.me).
// Luồng liên kết: nhân viên bấm "Lấy mã liên kết Zalo" trong phần mềm (mục
// Nhân viên), rồi mở Zalo, tìm & nhắn đúng mã đó cho OA của công ty. Khi OA
// nhận được tin nhắn, webhook này khớp mã với đúng nhân viên và lưu zalo_id
// của họ để từ nay gửi được tin nhắc việc.
router.post("/webhook", express.json(), (req, res) => {
  try {
    const event = req.body || {};
    if (event.event_name === "user_send_text") {
      const zaloUserId = event.sender && event.sender.id;
      const text = ((event.message && event.message.text) || "").trim().toUpperCase();
      if (zaloUserId && text) {
        const staff = db.prepare("SELECT * FROM staff WHERE zalo_link_code = ?").get(text);
        if (staff) {
          db.prepare("UPDATE staff SET zalo_id = ?, zalo_link_code = '' WHERE id = ?").run(zaloUserId, staff.id);
          sendZaloText(
            zaloUserId,
            `Đã liên kết Zalo thành công cho ${staff.name}. Từ nay bạn sẽ nhận được tin nhắc việc trễ hạn / sắp đến hạn qua Zalo.`
          );
        }
      }
    }
  } catch (e) {
    console.error("[zalo webhook] Lỗi xử lý sự kiện:", e.message);
  }
  // Zalo chỉ cần HTTP 200 để biết webhook đã nhận, không quan tâm nội dung trả về.
  res.json({ ok: true });
});

module.exports = router;

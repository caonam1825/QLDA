// Tích hợp Zalo Official Account (OA) để nhắc việc cho từng nhân viên.
//
// ĐIỀU KIỆN CẦN CÓ TRƯỚC (tự chuẩn bị, phần mềm không tự tạo được):
//   1. Một tài khoản Zalo Official Account (OA) của công ty đã được xác thực
//      (đăng ký tại https://oa.zalo.me).
//   2. Một ứng dụng trên https://developers.zalo.me liên kết với OA đó, để lấy
//      APP_ID / APP_SECRET và cấp quyền gửi "Tin nhắn tư vấn" (OA Message CS).
//   3. Access token + refresh token của OA (lấy qua luồng OAuth của Zalo).
//   4. Khai báo Webhook URL của app này (…/api/zalo/webhook) trong mục
//      "Webhook" của ứng dụng Zalo, để nhận sự kiện nhân viên nhắn mã liên kết.
//
// Khai báo các biến môi trường tương ứng trong file .env (xem .env.example):
//   ZALO_OA_ACCESS_TOKEN, ZALO_OA_APP_SECRET
//
// Access token của Zalo OA hết hạn định kỳ (thường ~25 giờ) và cần refresh
// bằng refresh token — phần này CHƯA tự động hoá trong bản này (Zalo yêu cầu
// đăng ký "official" và luồng OAuth phức tạp hơn phạm vi 1 file). Trong lúc
// dùng thử/nội bộ, đơn giản nhất là định kỳ vào trang quản trị OA / Zalo
// Developers để lấy access token mới rồi cập nhật lại biến môi trường.

const ZALO_SEND_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";

function isZaloConfigured() {
  return !!process.env.ZALO_OA_ACCESS_TOKEN;
}

// Gửi tin nhắn văn bản tới một người dùng Zalo đã từng nhắn cho OA (bắt buộc
// theo chính sách "Message CS" của Zalo — chỉ gửi được trong vòng 48h kể từ
// tương tác gần nhất của người dùng với OA).
async function sendZaloText(zaloUserId, text) {
  if (!isZaloConfigured()) {
    console.warn("[zalo] Chưa cấu hình ZALO_OA_ACCESS_TOKEN — bỏ qua gửi tin nhắn.");
    return { skipped: true };
  }
  try {
    const res = await fetch(ZALO_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: process.env.ZALO_OA_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        recipient: { user_id: zaloUserId },
        message: { text },
      }),
    });
    const data = await res.json();
    if (data.error && data.error !== 0) {
      console.error("[zalo] Gửi thất bại:", data);
    }
    return data;
  } catch (e) {
    console.error("[zalo] Lỗi khi gọi API Zalo:", e.message);
    return { error: -1, message: e.message };
  }
}

module.exports = { isZaloConfigured, sendZaloText };

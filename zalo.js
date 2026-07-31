// Chuẩn hoá số điện thoại Việt Nam về dạng 0xxxxxxxxx (10 số, không khoảng trắng/dấu).
// Chấp nhận nhập vào dạng "+84...", "84...", "0..." hoặc có khoảng trắng/dấu chấm/gạch ngang.
function normalizePhone(raw) {
  if (!raw) return "";
  let s = String(raw).trim().replace(/[\s.\-()]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length >= 11) s = "0" + s.slice(2);
  return s;
}

// Số di động VN hợp lệ: bắt đầu bằng 0, theo sau là đầu số hợp lệ, tổng 10 số.
const VN_PHONE_RE = /^0(3[2-9]|5[5689]|7[06-9]|8[1-9]|9[0-9])\d{7}$/;

function isValidVNPhone(raw) {
  const n = normalizePhone(raw);
  return VN_PHONE_RE.test(n);
}

module.exports = { normalizePhone, isValidVNPhone };

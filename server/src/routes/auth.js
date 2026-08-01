const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { hashPassword, checkPassword, signToken, requireAuth } = require("../auth");
const { normalizePhone, isValidVNPhone } = require("../phone");

const router = express.Router();

function myLinkedStaff(userId) {
  // Người dùng có thể được liên kết với nhiều hồ sơ nhân viên (ở nhiều dự án
  // khác nhau) — lấy hồ sơ đầu tiên để hiển thị trạng thái Zalo tự phục vụ.
  return db.prepare("SELECT * FROM staff WHERE linked_user_id = ? ORDER BY created_at ASC LIMIT 1").get(userId);
}

function serializeUser(row) {
  const staff = myLinkedStaff(row.id);
  return {
    id: row.id, phone: row.phone, email: row.email || "", name: row.name,
    position: row.position || "", isSuperAdmin: !!row.is_super_admin,
    isApproved: !!row.is_approved,
    zaloLinked: !!(staff && staff.zalo_id),
    zaloStaffId: staff ? staff.id : null,
  };
}

router.post("/register", (req, res) => {
  const { phone, password, name, email } = req.body || {};
  if (!phone || !password || !name) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ họ tên, số điện thoại và mật khẩu" });
  }
  if (!isValidVNPhone(phone)) {
    return res.status(400).json({ error: "Số điện thoại không hợp lệ. Vui lòng nhập số di động Việt Nam (VD: 0912345678)" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Mật khẩu cần tối thiểu 6 ký tự" });
  }
  const normalizedPhone = normalizePhone(phone);
  const existing = db.prepare("SELECT id FROM users WHERE phone = ?").get(normalizedPhone);
  if (existing) return res.status(409).json({ error: "Số điện thoại này đã được đăng ký" });

  // Người đăng ký đầu tiên của hệ thống tự động là Quản trị hệ thống (quyền
  // cao nhất, vượt qua mọi phân quyền theo dự án) — để luôn có ít nhất 1
  // người quản lý được toàn bộ ngay từ đầu, và cũng tự động được duyệt.
  // Từ người thứ 2 trở đi, tài khoản TỰ ĐĂNG KÝ cần Quản trị hệ thống phê
  // duyệt mới đăng nhập được, để tránh người lạ tự tạo tài khoản truy cập.
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const isSuperAdmin = userCount === 0 ? 1 : 0;
  const isApproved = userCount === 0 ? 1 : 0;

  const id = nanoid();
  db.prepare(
    "INSERT INTO users (id, phone, email, password_hash, name, is_super_admin, is_approved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, normalizedPhone, (email && email.trim()) || null, hashPassword(password), name.trim(), isSuperAdmin, isApproved, Date.now());

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!isApproved) {
    return res.json({
      pending: true,
      message: "Đăng ký thành công — tài khoản của bạn đang chờ Quản trị hệ thống phê duyệt trước khi đăng nhập được.",
    });
  }
  res.json({ token: signToken(row), user: serializeUser(row) });
});

router.post("/login", (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ error: "Thiếu số điện thoại hoặc mật khẩu" });
  const normalizedPhone = normalizePhone(phone);
  const row = db.prepare("SELECT * FROM users WHERE phone = ?").get(normalizedPhone);
  if (!row || !checkPassword(password, row.password_hash)) {
    return res.status(401).json({ error: "Số điện thoại hoặc mật khẩu không đúng" });
  }
  if (!row.is_approved) {
    return res.status(403).json({ error: "Tài khoản của bạn đang chờ Quản trị hệ thống phê duyệt trước khi đăng nhập được." });
  }
  res.json({ token: signToken(row), user: serializeUser(row) });
});

router.get("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy người dùng" });
  res.json({ user: serializeUser(row) });
});

// Cập nhật thông tin cá nhân (đổi tên / email / chức vụ hiển thị). Đổi số
// điện thoại đăng nhập không hỗ trợ qua đây để tránh nhầm lẫn tài khoản —
// cần liên hệ quản trị.
router.patch("/me", requireAuth, (req, res) => {
  const { name, email, position } = req.body || {};
  const sets = [];
  const vals = [];
  if (name && name.trim()) { sets.push("name = ?"); vals.push(name.trim()); }
  if (email !== undefined) { sets.push("email = ?"); vals.push(email ? email.trim() : null); }
  if (position !== undefined) { sets.push("position = ?"); vals.push(position ? position.trim() : ""); }
  if (sets.length) {
    vals.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ user: serializeUser(row) });
});

// Đổi mật khẩu tự đặt (cần đúng mật khẩu hiện tại). Quản trị hệ thống muốn
// đặt lại mật khẩu HỘ người khác (quên mật khẩu) thì dùng
// PATCH /admin/users/:id/reset-password bên dưới thay vì API này.
router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Mật khẩu mới cần tối thiểu 6 ký tự" });
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!row || !checkPassword(currentPassword, row.password_hash)) {
    return res.status(401).json({ error: "Mật khẩu hiện tại không đúng" });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), req.user.id);
  res.json({ ok: true });
});

/* ---------------- Kết nối Zalo tự phục vụ (từ hồ sơ cá nhân) ---------------- */
// Khác với mục "Nhân viên" (cần quyền quản lý), đây là để CHÍNH người dùng tự
// lấy mã liên kết Zalo cho hồ sơ nhân viên của mình, không cần nhờ admin.

router.post("/zalo-code", requireAuth, (req, res) => {
  const staff = myLinkedStaff(req.user.id);
  if (!staff) {
    return res.status(404).json({
      error: "Bạn chưa được liên kết với hồ sơ nhân viên nào. Liên hệ quản trị dự án để được thêm vào danh bạ nhân viên trước.",
    });
  }
  let code = staff.zalo_link_code;
  if (!code) {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
    db.prepare("UPDATE staff SET zalo_link_code = ? WHERE id = ?").run(code, staff.id);
  }
  res.json({ code });
});

router.delete("/zalo-link", requireAuth, (req, res) => {
  const staff = myLinkedStaff(req.user.id);
  if (!staff) return res.status(404).json({ error: "Bạn chưa được liên kết với hồ sơ nhân viên nào." });
  db.prepare("UPDATE staff SET zalo_id = '', zalo_link_code = '' WHERE id = ?").run(staff.id);
  res.json({ ok: true });
});

module.exports = router;

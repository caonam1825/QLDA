const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { hashPassword, checkPassword, signToken, requireAuth } = require("../auth");
const { normalizePhone, isValidVNPhone } = require("../phone");

const router = express.Router();

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

  const id = nanoid();
  db.prepare(
    "INSERT INTO users (id, phone, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, normalizedPhone, (email && email.trim()) || null, hashPassword(password), name.trim(), Date.now());

  const user = { id, phone: normalizedPhone, email: (email && email.trim()) || "", name: name.trim() };
  res.json({ token: signToken(user), user });
});

router.post("/login", (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ error: "Thiếu số điện thoại hoặc mật khẩu" });
  const normalizedPhone = normalizePhone(phone);
  const row = db.prepare("SELECT * FROM users WHERE phone = ?").get(normalizedPhone);
  if (!row || !checkPassword(password, row.password_hash)) {
    return res.status(401).json({ error: "Số điện thoại hoặc mật khẩu không đúng" });
  }
  const user = { id: row.id, phone: row.phone, email: row.email || "", name: row.name };
  res.json({ token: signToken(user), user });
});

router.get("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT id, phone, email, name FROM users WHERE id = ?").get(req.user.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy người dùng" });
  res.json({ user: { ...row, email: row.email || "" } });
});

// Cập nhật thông tin cá nhân (đổi tên / email hiển thị). Đổi số điện thoại đăng
// nhập không hỗ trợ qua đây để tránh nhầm lẫn tài khoản — cần liên hệ quản trị.
router.patch("/me", requireAuth, (req, res) => {
  const { name, email } = req.body || {};
  const sets = [];
  const vals = [];
  if (name && name.trim()) { sets.push("name = ?"); vals.push(name.trim()); }
  if (email !== undefined) { sets.push("email = ?"); vals.push(email ? email.trim() : null); }
  if (sets.length) {
    vals.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
  const row = db.prepare("SELECT id, phone, email, name FROM users WHERE id = ?").get(req.user.id);
  res.json({ user: { ...row, email: row.email || "" } });
});

module.exports = router;

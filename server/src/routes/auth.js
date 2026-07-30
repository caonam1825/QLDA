const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { hashPassword, checkPassword, signToken, requireAuth } = require("../auth");

const router = express.Router();

router.post("/register", (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Mật khẩu cần tối thiểu 6 ký tự" });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) return res.status(409).json({ error: "Email này đã được đăng ký" });

  const id = nanoid();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, normalizedEmail, hashPassword(password), name.trim(), Date.now());

  const user = { id, email: normalizedEmail, name: name.trim() };
  res.json({ token: signToken(user), user });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Thiếu email hoặc mật khẩu" });
  const normalizedEmail = String(email).trim().toLowerCase();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
  if (!row || !checkPassword(password, row.password_hash)) {
    return res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
  }
  const user = { id: row.id, email: row.email, name: row.name };
  res.json({ token: signToken(user), user });
});

router.get("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(req.user.id);
  if (!row) return res.status(404).json({ error: "Không tìm thấy người dùng" });
  res.json({ user: row });
});

module.exports = router;

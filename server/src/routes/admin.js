const express = require("express");
const db = require("../db");
const { requireAuth, requireSuperAdmin, hashPassword } = require("../auth");

const router = express.Router();
router.use(requireAuth);
router.use(requireSuperAdmin);

// Danh sách toàn bộ người dùng trong hệ thống — chỉ Quản trị hệ thống xem được.
router.get("/users", (req, res) => {
  const rows = db
    .prepare("SELECT id, phone, email, name, is_super_admin, created_at FROM users ORDER BY created_at ASC")
    .all();
  res.json({
    users: rows.map(r => ({
      id: r.id, phone: r.phone, email: r.email || "", name: r.name,
      isSuperAdmin: !!r.is_super_admin, createdAt: r.created_at,
    })),
  });
});

// Cấp / thu hồi quyền Quản trị hệ thống cho một người dùng khác.
router.patch("/users/:id/super-admin", (req, res) => {
  const { value } = req.body || {};
  if (req.params.id === req.user.id && !value) {
    return res.status(400).json({ error: "Không thể tự thu hồi quyền Quản trị hệ thống của chính mình" });
  }
  db.prepare("UPDATE users SET is_super_admin = ? WHERE id = ?").run(value ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// Đặt lại mật khẩu HỘ một người dùng khác (khi họ quên mật khẩu) — chỉ
// Quản trị hệ thống làm được, không cần biết mật khẩu cũ.
router.post("/users/:id/reset-password", (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Mật khẩu mới cần tối thiểu 6 ký tự" });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng" });
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), req.params.id);
  res.json({ ok: true });
});

module.exports = router;

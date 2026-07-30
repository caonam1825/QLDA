const express = require("express");
const db = require("../db");
const { requireAuth, requireSuperAdmin } = require("../auth");

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

module.exports = router;

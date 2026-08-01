const express = require("express");
const db = require("../db");
const { requireAuth, requireSuperAdmin, hashPassword } = require("../auth");

const router = express.Router();
router.use(requireAuth);
router.use(requireSuperAdmin);

// Danh sách toàn bộ người dùng trong hệ thống — chỉ Quản trị hệ thống xem được.
router.get("/users", (req, res) => {
  const rows = db
    .prepare("SELECT id, phone, email, name, position, is_super_admin, is_approved, created_at FROM users ORDER BY created_at ASC")
    .all();
  res.json({
    users: rows.map(r => ({
      id: r.id, phone: r.phone, email: r.email || "", name: r.name, position: r.position || "",
      isSuperAdmin: !!r.is_super_admin, isApproved: !!r.is_approved, createdAt: r.created_at,
    })),
  });
});

// Phê duyệt 1 tài khoản tự đăng ký — từ đó họ mới đăng nhập được.
router.post("/users/:id/approve", (req, res) => {
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng" });
  db.prepare("UPDATE users SET is_approved = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Từ chối (xoá hẳn) 1 tài khoản đang chờ duyệt — dùng khi đây là người lạ /
// đăng ký nhầm, không nên để tồn tại trong hệ thống.
router.delete("/users/:id/reject", (req, res) => {
  const user = db.prepare("SELECT id, is_approved FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng" });
  if (user.is_approved) {
    return res.status(400).json({ error: "Tài khoản này đã được duyệt — dùng nút thu hồi quyền thay vì từ chối." });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
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

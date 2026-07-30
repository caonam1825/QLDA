const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
router.use(requireAuth);

const MAX_MESSAGES = 200;
const MAX_BODY_LEN = 2000;

// room = 'global' (chat toàn công ty) hoặc project_id (chat riêng 1 dự án).
// Ai đã đăng nhập cũng đọc/gửi được — khớp với việc mọi người đều xem được
// mọi dự án trong hệ thống (xem routes/projects.js).
function validRoom(room) {
  if (room === "global") return true;
  const proj = db.prepare("SELECT id FROM projects WHERE id = ?").get(room);
  return !!proj;
}

router.get("/:room/messages", (req, res) => {
  if (!validRoom(req.params.room)) return res.status(404).json({ error: "Không tìm thấy phòng chat" });
  const rows = db
    .prepare("SELECT * FROM messages WHERE room = ? ORDER BY created_at DESC LIMIT ?")
    .all(req.params.room, MAX_MESSAGES);
  res.json({
    messages: rows.reverse().map(m => ({
      id: m.id, senderId: m.sender_id, senderName: m.sender_name,
      body: m.body, createdAt: m.created_at, mine: m.sender_id === req.user.id,
    })),
  });
});

router.post("/:room/messages", (req, res) => {
  if (!validRoom(req.params.room)) return res.status(404).json({ error: "Không tìm thấy phòng chat" });
  const body = String((req.body && req.body.body) || "").trim();
  if (!body) return res.status(400).json({ error: "Tin nhắn trống" });
  if (body.length > MAX_BODY_LEN) return res.status(400).json({ error: "Tin nhắn quá dài" });
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    "INSERT INTO messages (id, room, sender_id, sender_name, body, created_at) VALUES (?,?,?,?,?,?)"
  ).run(id, req.params.room, req.user.id, req.user.name, body, now);
  res.json({ message: { id, senderId: req.user.id, senderName: req.user.name, body, createdAt: now, mine: true } });
});

module.exports = router;

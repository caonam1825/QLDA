const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-.env";
const TOKEN_TTL = "30d";

function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}

function checkPassword(pw, hash) {
  return bcrypt.compareSync(pw, hash);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, phone: user.phone, name: user.name }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Thiếu token xác thực" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, phone: payload.phone, name: payload.name };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
  }
}

function requireSuperAdmin(req, res, next) {
  // Luôn kiểm tra tươi trong DB (không dựa vào JWT) để thu hồi quyền có hiệu
  // lực ngay, không phải chờ người dùng đăng nhập lại.
  const db = require("./db");
  const row = db.prepare("SELECT is_super_admin FROM users WHERE id = ?").get(req.user.id);
  if (!row || !row.is_super_admin) {
    return res.status(403).json({ error: "Chỉ Quản trị hệ thống mới có quyền thực hiện thao tác này" });
  }
  next();
}

module.exports = { hashPassword, checkPassword, signToken, requireAuth, requireSuperAdmin };

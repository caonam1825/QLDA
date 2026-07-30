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

module.exports = { hashPassword, checkPassword, signToken, requireAuth };

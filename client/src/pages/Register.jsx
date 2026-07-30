import { useState } from "react";
import { UserPlus } from "lucide-react";
import { api, setToken } from "../api";

export default function Register({ onAuthed, goLogin }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.register(phone.trim(), password, name.trim(), email.trim());
      setToken(token);
      onAuthed(user);
    } catch (err) {
      setError(err.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-eyebrow">BAN DỰ ÁN - TCT CỔ PHẦN HỢP LỰC</div>
        <h1>Tạo tài khoản</h1>
        <p className="auth-sub">Tạo tài khoản để bắt đầu quản lý dự án và mời đồng nghiệp cùng dùng.</p>

        <label className="auth-field">
          <span>Họ và tên</span>
          <input type="text" required value={name} onChange={e => setName(e.target.value)} autoFocus />
        </label>
        <label className="auth-field">
          <span>Số điện thoại</span>
          <input type="tel" placeholder="VD: 0912345678" required value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <label className="auth-field">
          <span>Email (không bắt buộc)</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="auth-field">
          <span>Mật khẩu (tối thiểu 6 ký tự)</span>
          <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-submit" type="submit" disabled={loading}>
          <UserPlus size={15} /> {loading ? "Đang tạo…" : "Đăng ký"}
        </button>

        <button type="button" className="auth-switch" onClick={goLogin}>
          Đã có tài khoản? Đăng nhập
        </button>
      </form>
    </div>
  );
}

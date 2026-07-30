import { useState } from "react";
import { LogIn } from "lucide-react";
import { api, setToken } from "../api";

export default function Login({ onAuthed, goRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.login(email.trim(), password);
      setToken(token);
      onAuthed(user);
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-eyebrow">HỒ SƠ THỦ TỤC ĐẦU TƯ · ĐẤT ĐAI · XÂY DỰNG</div>
        <h1>Đăng nhập</h1>
        <p className="auth-sub">Quản lý &amp; giao việc theo dự án — nhiều người cùng dùng chung.</p>

        <label className="auth-field">
          <span>Email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="auth-field">
          <span>Mật khẩu</span>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-submit" type="submit" disabled={loading}>
          <LogIn size={15} /> {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>

        <button type="button" className="auth-switch" onClick={goRegister}>
          Chưa có tài khoản? Đăng ký ngay
        </button>
      </form>
    </div>
  );
}

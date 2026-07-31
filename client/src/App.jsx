import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import { api, getToken, setToken } from "./api";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState("login"); // 'login' | 'register'
  const [activeProjectId, setActiveProjectId] = useState(null); // null = màn hình chính (tất cả dự án)

  useEffect(() => {
    (async () => {
      if (!getToken()) { setChecking(false); return; }
      try {
        const { user: me } = await api.me();
        setUser(me);
      } catch (e) {
        setToken(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  function handleLogout() {
    setToken(null);
    setUser(null);
    setView("login");
    setActiveProjectId(null);
  }

  function handleUserUpdated(patch) {
    setUser(u => ({ ...u, ...patch }));
  }

  if (checking) {
    return (
      <div className="app-root app-loading">
        <p>Đang tải…</p>
      </div>
    );
  }

  if (!user) {
    return view === "login" ? (
      <Login onAuthed={setUser} goRegister={() => setView("register")} />
    ) : (
      <Register onAuthed={setUser} goLogin={() => setView("login")} />
    );
  }

  // Màn hình chính: tất cả dự án + thông số tổng quan. Bấm vào 1 dự án mới
  // vào chi tiết (giao việc, tiến độ…). Bấm "Trang chủ" trong chi tiết dự án
  // để quay lại đây.
  if (!activeProjectId) {
    return <Home user={user} onLogout={handleLogout} onOpenProject={setActiveProjectId} onUserUpdated={handleUserUpdated} />;
  }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      initialProjectId={activeProjectId}
      onBackHome={() => setActiveProjectId(null)}
      onUserUpdated={handleUserUpdated}
    />
  );
}

import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import { api, getToken, setToken } from "./api";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState("login"); // 'login' | 'register'

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

  return <Dashboard user={user} onLogout={handleLogout} />;
}

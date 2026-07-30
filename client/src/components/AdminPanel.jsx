import { useState, useEffect } from "react";
import { ShieldCheck, X } from "lucide-react";
import { api } from "../api";

export default function AdminPanel({ currentUserId, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api.adminListUsers()
      .then(d => setUsers(d.users))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggle(u) {
    try {
      await api.adminSetSuperAdmin(u.id, !u.isSuperAdmin);
      load();
    } catch (e) {
      setError(e.message || "Không đổi được quyền");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><ShieldCheck size={16} /> Quản trị hệ thống</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <p className="invite-hint">
          Quản trị hệ thống có toàn quyền trên MỌI dự án, kể cả khoá/mở khoá hạn hoàn thành, bất kể được thêm
          làm thành viên hay chưa. Chỉ cấp quyền này cho người thực sự cần thiết.
        </p>

        {loading && <p className="invite-hint">Đang tải…</p>}
        {error && <div className="auth-error">{error}</div>}

        {!loading && (
          <div className="members-list">
            {users.map(u => (
              <div key={u.id} className="member-row">
                <div className="member-info">
                  <span className="member-name">{u.name}</span>
                  <span className="member-email">{u.phone}{u.email ? ` · ${u.email}` : ""}</span>
                </div>
                {u.isSuperAdmin ? (
                  <span className="zalo-status zalo-status-on"><ShieldCheck size={12} /> Quản trị hệ thống</span>
                ) : (
                  <span className="zalo-status zalo-status-off">Người dùng thường</span>
                )}
                <button
                  className="icon-btn"
                  onClick={() => toggle(u)}
                  disabled={u.id === currentUserId && u.isSuperAdmin}
                  title={u.id === currentUserId && u.isSuperAdmin ? "Không thể tự thu hồi quyền của chính mình" : (u.isSuperAdmin ? "Thu hồi quyền" : "Cấp quyền Quản trị hệ thống")}
                  type="button"
                >
                  {u.isSuperAdmin ? "Thu hồi" : "Cấp quyền"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

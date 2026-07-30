import { useState } from "react";
import { Users, X, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "./Basics";
import { api } from "../api";
import { ROLE_OPTIONS, roleLabel } from "../constants";

export default function MembersPanel({ project, canManage, onClose, onChanged }) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.addMember(project.id, phone.trim(), role);
      setPhone("");
      onChanged();
    } catch (err) {
      setError(err.message || "Không thể thêm thành viên");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId) {
    try {
      await api.removeMember(project.id, userId);
      onChanged();
    } catch (err) {
      setError(err.message || "Không thể xoá thành viên");
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await api.updateMemberRole(project.id, userId, newRole);
      onChanged();
    } catch (err) {
      setError(err.message || "Không đổi được quyền");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><Users size={16} /> Thành viên dự án</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <p className="invite-hint">
          Mọi người dùng đã đăng nhập đều xem được tiến độ của mọi dự án. Danh sách dưới đây là những người
          được cấp quyền chỉnh sửa (một phần hoặc toàn bộ) trong dự án này.
        </p>

        <div className="members-list">
          {project.members.map(m => (
            <div key={m.id} className="member-row">
              <div className="member-info">
                <span className="member-name">{m.name}</span>
                <span className="member-email">{m.phone}{m.email ? ` · ${m.email}` : ""}</span>
              </div>
              {m.role === "owner" || !canManage ? (
                <span className={`member-role member-role-${m.role}`}>{roleLabel(m.role)}</span>
              ) : (
                <select className="member-role-select" value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)}>
                  {ROLE_OPTIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              )}
              {canManage && m.role !== "owner" && (
                <ConfirmButton icon={Trash2} title="Xoá khỏi dự án" confirmLabel="Xoá?" danger onConfirm={() => handleRemove(m.id)} />
              )}
            </div>
          ))}
        </div>

        {canManage && (
          <form className="invite-form" onSubmit={handleInvite}>
            <div className="invite-form-row">
              <input
                type="tel" placeholder="Số điện thoại người đã có tài khoản…" required
                value={phone} onChange={e => setPhone(e.target.value)}
              />
              <select value={role} onChange={e => setRole(e.target.value)}>
                {ROLE_OPTIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
              <button type="submit" disabled={busy}><Plus size={14} /> Thêm</button>
            </div>
            <p className="invite-hint">
              Người được mời cần đã đăng ký tài khoản trên hệ thống này bằng đúng số điện thoại trên — hoặc dùng
              mục "Nhân viên" để cấp tài khoản trực tiếp mà không cần họ tự đăng ký.
            </p>
            {error && <div className="auth-error">{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}

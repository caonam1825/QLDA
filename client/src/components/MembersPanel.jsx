import { useState, useEffect, useMemo } from "react";
import { Users, X, Plus, Trash2, Check } from "lucide-react";
import { ConfirmButton } from "./Basics";
import { api } from "../api";
import { ROLE_OPTIONS, roleLabel } from "../constants";

export default function MembersPanel({ project, canManage, onClose, onChanged }) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [rowRole, setRowRole] = useState({}); // staffId -> vai trò chọn trước khi tích

  useEffect(() => {
    api.getStaffDirectory()
      .then(d => setDirectory(d.staff))
      .catch(() => {})
      .finally(() => setLoadingDirectory(false));
  }, []);

  const memberUserIds = useMemo(() => new Set(project.members.map(m => m.id)), [project.members]);
  const staffWithAccounts = useMemo(() => directory.filter(s => s.hasLogin && s.linkedUserId), [directory]);

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

  async function handleToggleStaff(staff) {
    const already = memberUserIds.has(staff.linkedUserId);
    try {
      if (already) {
        await api.removeMember(project.id, staff.linkedUserId);
      } else {
        await api.addMember(project.id, staff.phone, rowRole[staff.id] || "editor");
      }
      onChanged();
    } catch (err) {
      setError(err.message || "Không cập nhật được thành viên");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card staff-modal-card" onClick={e => e.stopPropagation()}>
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
          <>
            <p className="report-section-title" style={{ marginTop: 14 }}>Tích chọn từ nhân viên đã có tài khoản</p>
            {loadingDirectory ? (
              <p className="invite-hint">Đang tải danh bạ…</p>
            ) : staffWithAccounts.length === 0 ? (
              <p className="invite-hint">
                Chưa có nhân viên nào có tài khoản đăng nhập — vào mục "Nhân viên" ở Trang chủ để cấp/liên kết
                tài khoản trước, sau đó quay lại đây tích chọn.
              </p>
            ) : (
              <div className="staff-directory-list">
                {staffWithAccounts.map(s => {
                  const checked = memberUserIds.has(s.linkedUserId);
                  return (
                    <div key={s.id} className={`staff-directory-row ${checked ? "staff-directory-row-checked" : ""}`}>
                      <button
                        type="button" className={`staff-check-btn ${checked ? "staff-check-btn-on" : ""}`}
                        onClick={() => handleToggleStaff(s)}
                        title={checked ? "Bỏ khỏi dự án" : "Tích để thêm vào dự án"}
                      >
                        {checked && <Check size={13} />}
                      </button>
                      <div className="member-info">
                        <span className="member-name">{s.name}</span>
                        <span className="member-email">{[s.position, s.department].filter(Boolean).join(" · ") || s.phone}</span>
                      </div>
                      {!checked && (
                        <select
                          className="member-role-select"
                          value={rowRole[s.id] || "editor"}
                          onChange={e => setRowRole(r => ({ ...r, [s.id]: e.target.value }))}
                        >
                          {ROLE_OPTIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <form className="invite-form" onSubmit={handleInvite}>
              <p className="invite-hint">Không thấy tên? Thêm bằng số điện thoại trực tiếp (họ cần đã có tài khoản):</p>
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
              {error && <div className="auth-error">{error}</div>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Users2, X, Plus, Trash2, MessageCircle, Link2Off, KeyRound, Search, Check, Building2 } from "lucide-react";
import { ConfirmButton } from "./Basics";
import { api } from "../api";
import { ROLE_OPTIONS } from "../constants";
import PersonTasksModal from "./PersonTasksModal";
import CompanyStaffPanel from "./CompanyStaffPanel";

const emptyForm = { name: "", position: "", department: "", email: "", phone: "" };
const emptyLogin = { mode: "none", loginPhone: "", loginPassword: "", role: "viewer" }; // mode: 'none' | 'grant' | 'link'

export default function StaffPanel({ project, canManage, onClose, onChanged }) {
  const [directory, setDirectory] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [query, setQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [login, setLogin] = useState(emptyLogin);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zaloCodeFor, setZaloCodeFor] = useState(null); // { staffId, code }
  const [tasksFor, setTasksFor] = useState(null); // staff object, để xem việc đang phụ trách
  const [companyPanelOpen, setCompanyPanelOpen] = useState(false);

  const currentIds = useMemo(() => new Set(project.staff.map(s => s.id)), [project.staff]);

  function loadDirectory() {
    setLoadingDirectory(true);
    api.getStaffDirectory()
      .then(d => setDirectory(d.staff))
      .catch(e => setError(e.message || "Không tải được danh bạ nhân viên"))
      .finally(() => setLoadingDirectory(false));
  }
  useEffect(loadDirectory, []);

  const filteredDirectory = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(s =>
      `${s.name} ${s.position} ${s.department} ${s.phone}`.toLowerCase().includes(q)
    );
  }, [directory, query]);

  async function toggleStaff(staffId) {
    const next = new Set(currentIds);
    if (next.has(staffId)) next.delete(staffId); else next.add(staffId);
    try {
      await api.setStaffSelection(project.id, Array.from(next));
      onChanged();
    } catch (err) {
      setError(err.message || "Không cập nhật được danh sách nhân viên của dự án");
    }
  }

  async function handleGetZaloCode(staffId) {
    try {
      const { code } = await api.getZaloCode(staffId);
      setZaloCodeFor({ staffId, code });
    } catch (err) {
      setError(err.message || "Không lấy được mã liên kết Zalo");
    }
  }

  async function handleUnlinkZalo(staffId) {
    try {
      await api.unlinkZalo(staffId);
      if (zaloCodeFor?.staffId === staffId) setZaloCodeFor(null);
      onChanged();
      loadDirectory();
    } catch (err) {
      setError(err.message || "Không huỷ được liên kết Zalo");
    }
  }

  async function handleSubmitNew(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Vui lòng nhập tên nhân viên"); return; }
    setError("");
    setBusy(true);
    try {
      const payload = { ...form };
      if (login.mode === "grant") {
        payload.grantLogin = true;
        payload.loginPhone = login.loginPhone || form.phone;
        payload.loginPassword = login.loginPassword;
        payload.role = login.role;
      } else if (login.mode === "link") {
        payload.linkExistingPhone = login.loginPhone || form.phone;
        payload.role = login.role;
      }
      await api.addStaff(project.id, payload);
      setForm(emptyForm);
      setLogin(emptyLogin);
      setShowNewForm(false);
      onChanged();
      loadDirectory();
    } catch (err) {
      setError(err.message || "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  async function handleUntickFromProject(staffId) {
    try {
      await api.untickStaff(project.id, staffId);
      onChanged();
    } catch (err) {
      setError(err.message || "Không bỏ được khỏi dự án");
    }
  }

  async function handleDeletePermanently(staffId) {
    try {
      await api.deleteStaffPermanently(staffId);
      if (tasksFor?.id === staffId) setTasksFor(null);
      onChanged();
      loadDirectory();
    } catch (err) {
      setError(err.message || "Không xoá được");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card staff-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><Users2 size={16} /> Nhân viên — Ban quản lý dự án</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>

        <p className="invite-hint">
          Danh bạ nhân viên dùng CHUNG cho toàn công ty — chỉ cần tạo hồ sơ 1 lần, sau đó <b>tích chọn</b> ai
          thuộc dự án nào ngay dưới đây, không cần nhập lại số điện thoại mỗi lần.
          {" "}<button type="button" className="staff-view-all-link" onClick={() => setCompanyPanelOpen(true)}>
            <Building2 size={12} style={{ verticalAlign: -1 }} /> Xem tất cả nhân viên công ty
          </button>
        </p>

        {error && <div className="auth-error">{error}</div>}

        <div className="staff-search-row">
          <Search size={14} />
          <input type="text" placeholder="Tìm theo tên, chức vụ, phòng ban, SĐT…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {loadingDirectory ? (
          <p className="invite-hint">Đang tải danh bạ…</p>
        ) : (
          <div className="staff-directory-list">
            {filteredDirectory.length === 0 && <p className="invite-hint">Không tìm thấy nhân viên phù hợp.</p>}
            {filteredDirectory.map(s => {
              const checked = currentIds.has(s.id);
              return (
                <div key={s.id} className={`staff-directory-row ${checked ? "staff-directory-row-checked" : ""}`}>
                  {canManage ? (
                    <button
                      type="button" className={`staff-check-btn ${checked ? "staff-check-btn-on" : ""}`}
                      onClick={() => toggleStaff(s.id)}
                      title={checked ? "Bỏ khỏi dự án này" : "Tích để thêm vào dự án này"}
                    >
                      {checked && <Check size={13} />}
                    </button>
                  ) : (
                    <span className={`staff-check-btn ${checked ? "staff-check-btn-on" : ""}`}>{checked && <Check size={13} />}</span>
                  )}

                  <span className="avatar-circle avatar-clickable" onClick={() => setTasksFor(s)} title={`Xem việc của ${s.name}`}>
                    {(s.name || "?").trim().charAt(0).toUpperCase()}
                  </span>

                  <div className="member-info">
                    <span className="member-name member-name-clickable" onClick={() => setTasksFor(s)}>{s.name}</span>
                    <span className="member-email">
                      {[s.position, s.department].filter(Boolean).join(" · ") || "—"}
                      {s.phone ? ` · ${s.phone}` : ""}
                      {" · thuộc "}{s.projectIds.length} dự án
                    </span>
                  </div>

                  {s.hasLogin && <span className="zalo-status zalo-status-on"><KeyRound size={12} /> Có tài khoản</span>}
                  <span className={`zalo-status ${s.zaloLinked ? "zalo-status-on" : "zalo-status-off"}`}>
                    <MessageCircle size={12} /> {s.zaloLinked ? "Đã liên kết Zalo" : "Chưa liên kết Zalo"}
                  </span>

                  {canManage && (
                    <>
                      {s.zaloLinked ? (
                        <button className="icon-btn" title="Huỷ liên kết Zalo" onClick={() => handleUnlinkZalo(s.id)} type="button"><Link2Off size={13} /></button>
                      ) : (
                        <button className="icon-btn" title="Lấy mã liên kết Zalo" onClick={() => handleGetZaloCode(s.id)} type="button"><MessageCircle size={13} /></button>
                      )}
                      {checked && (
                        <button className="icon-btn" title="Bỏ khỏi dự án này (vẫn còn trong danh bạ chung)" onClick={() => handleUntickFromProject(s.id)} type="button">
                          <X size={13} />
                        </button>
                      )}
                      <ConfirmButton icon={Trash2} title="Xoá vĩnh viễn khỏi toàn hệ thống" confirmLabel="Xoá hẳn?" danger onConfirm={() => handleDeletePermanently(s.id)} />
                    </>
                  )}

                  {zaloCodeFor?.staffId === s.id && (
                    <div className="zalo-code-hint zalo-code-hint-inline">
                      Nhờ <b>{s.name}</b> nhắn mã <code className="zalo-code">{zaloCodeFor.code}</code> cho Zalo OA công ty để liên kết.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canManage && (
          <div className="staff-new-section">
            {!showNewForm ? (
              <button className="add-task-btn" onClick={() => setShowNewForm(true)} type="button">
                <Plus size={13} /> Người này chưa có trong danh bạ — tạo hồ sơ mới
              </button>
            ) : (
              <form className="staff-form" onSubmit={handleSubmitNew}>
                <div className="staff-form-grid">
                  <input type="text" placeholder="Họ và tên *" required
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <input type="text" placeholder="Chức vụ"
                    value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
                  <input type="text" placeholder="Phòng / đơn vị"
                    value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                  <input type="email" placeholder="Email"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <input type="text" placeholder="Số điện thoại"
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>

                <div className="staff-login-box">
                  <div className="staff-login-mode-row">
                    <label className="staff-login-toggle">
                      <input type="radio" name="loginMode" checked={login.mode === "none"}
                        onChange={() => setLogin(l => ({ ...l, mode: "none" }))} />
                      <span>Không cấp đăng nhập (chỉ thêm vào danh bạ)</span>
                    </label>
                    <label className="staff-login-toggle">
                      <input type="radio" name="loginMode" checked={login.mode === "link"}
                        onChange={() => setLogin(l => ({ ...l, mode: "link" }))} />
                      <span>✓ Đã có tài khoản — chỉ liên kết bằng SĐT</span>
                    </label>
                    <label className="staff-login-toggle">
                      <input type="radio" name="loginMode" checked={login.mode === "grant"}
                        onChange={() => setLogin(l => ({ ...l, mode: "grant" }))} />
                      <span>Cấp tài khoản mới (đặt SĐT + mật khẩu)</span>
                    </label>
                  </div>

                  {login.mode === "link" && (
                    <div className="staff-form-grid">
                      <input type="tel" placeholder="SĐT đã đăng ký (mặc định lấy SĐT ở trên) *" required
                        value={login.loginPhone} onChange={e => setLogin(l => ({ ...l, loginPhone: e.target.value }))} />
                      <select value={login.role} onChange={e => setLogin(l => ({ ...l, role: e.target.value }))}>
                        {ROLE_OPTIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select>
                    </div>
                  )}

                  {login.mode === "grant" && (
                    <div className="staff-form-grid">
                      <input type="tel" placeholder="SĐT đăng nhập (mặc định lấy SĐT ở trên)"
                        value={login.loginPhone} onChange={e => setLogin(l => ({ ...l, loginPhone: e.target.value }))} />
                      <input type="text" placeholder="Mật khẩu (tối thiểu 6 ký tự) *" required
                        value={login.loginPassword} onChange={e => setLogin(l => ({ ...l, loginPassword: e.target.value }))} />
                      <select value={login.role} onChange={e => setLogin(l => ({ ...l, role: e.target.value }))}>
                        {ROLE_OPTIONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="staff-form-actions">
                  <button type="submit" disabled={busy}><Plus size={14} /> Tạo &amp; thêm vào dự án này</button>
                  <button type="button" className="staff-cancel-edit" onClick={() => { setShowNewForm(false); setForm(emptyForm); setLogin(emptyLogin); }}>
                    Huỷ
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {tasksFor && (
        <PersonTasksModal
          name={tasksFor.name}
          personKey={tasksFor.phone ? `phone:${tasksFor.phone}` : `name:${tasksFor.name}|${tasksFor.department}`}
          onClose={() => setTasksFor(null)}
        />
      )}

      {companyPanelOpen && (
        <CompanyStaffPanel canManage={canManage} onClose={() => { setCompanyPanelOpen(false); loadDirectory(); onChanged(); }} />
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  FolderKanban, Users2, ClipboardList, AlertTriangle, Clock3, LogOut,
  ListChecks, MessageSquare, LayoutGrid, ShieldCheck, Plus, ChevronRight, Loader2,
} from "lucide-react";
import { api, setToken } from "../api";
import { StatCard } from "../components/Basics";
import OverviewPanel from "../components/OverviewPanel";
import AdminPanel from "../components/AdminPanel";
import ChatPanel from "../components/ChatPanel";
import MyTasksPanel from "../components/MyTasksPanel";

export default function Home({ user, onLogout, onOpenProject }) {
  const [projects, setProjects] = useState(null);
  const [overview, setOverview] = useState(null);
  const [staffCount, setStaffCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingBusy, setCreatingBusy] = useState(false);

  const [overviewOpen, setOverviewOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [myTasksOpen, setMyTasksOpen] = useState(false);
  const [inProgressOpen, setInProgressOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ projects: list }, ov, dir] = await Promise.all([
        api.listProjects(), api.getOverview(), api.getStaffDirectory(),
      ]);
      setProjects(list);
      setOverview(ov);
      setStaffCount(dir.staff.length);
      setError("");
    } catch (e) {
      setError(e.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreatingBusy(true);
    try {
      const { project } = await api.createProject(newName || "Dự án mới", "template");
      setCreating(false);
      setNewName("");
      onOpenProject(project.id);
    } catch (e) {
      setError(e.message || "Không tạo được dự án");
    } finally {
      setCreatingBusy(false);
    }
  }

  const overviewByProjectId = new Map((overview?.projects || []).map(p => [p.id, p]));

  return (
    <div className="app-root">
      <div className="app-topbar">
        <button className="topbar-btn topbar-btn-primary" onClick={() => setMyTasksOpen(true)} type="button">
          <ListChecks size={14} /> Việc của tôi
        </button>
        <button className="topbar-btn" onClick={() => setInProgressOpen(true)} type="button">
          <Clock3 size={14} /> Đang thực hiện (tất cả dự án)
        </button>
        <button className="topbar-btn" onClick={() => setChatOpen(true)} type="button">
          <MessageSquare size={14} /> Chat
        </button>
      </div>

      <header className="home-header">
        <div className="home-header-inner">
          <div>
            <span className="app-eyebrow">BAN DỰ ÁN - TCT CỔ PHẦN HỢP LỰC</span>
            <h1>Tất cả dự án</h1>
            <p>Tổng quan toàn công ty — chọn 1 dự án bên dưới để xem chi tiết & giao việc.</p>
          </div>
          <div className="app-header-right">
            <button className="members-btn" onClick={() => setOverviewOpen(true)} type="button">
              <LayoutGrid size={14} /> Tổng hợp &amp; KPI
            </button>
            {user.isSuperAdmin && (
              <button className="members-btn members-btn-admin" onClick={() => setAdminOpen(true)} type="button">
                <ShieldCheck size={14} /> Quản trị hệ thống
              </button>
            )}
            <div className="user-chip">
              <span>{user.name}</span>
              <button onClick={onLogout} title="Đăng xuất" type="button"><LogOut size={13} /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        {error && <div className="notice-band notice-band-error"><AlertTriangle size={18} className="notice-icon" /><div className="notice-text">{error}</div></div>}

        {loading ? (
          <p className="invite-hint"><Loader2 size={13} className="spin" /> Đang tải…</p>
        ) : (
          <>
            <div className="stats-row">
              <StatCard icon={FolderKanban} label="Tổng số dự án" value={projects.length} tint="#1E2A44" />
              <StatCard icon={Users2} label="Nhân viên (Ban QLDA)" value={staffCount} tint="#2F6D5D" />
              <StatCard icon={ClipboardList} label="Tổng đầu việc" value={overview?.totals.total ?? 0} tint="#A9832E" />
              <StatCard icon={AlertTriangle} label="Trễ hạn toàn hệ thống" value={overview?.totals.overdue ?? 0} tint="#9E2B25" />
            </div>

            <div className="home-projects-head">
              <h2>Danh sách dự án ({projects.length})</h2>
              {!creating ? (
                <button className="home-new-project-btn" onClick={() => setCreating(true)} type="button">
                  <Plus size={14} /> Tạo dự án mới
                </button>
              ) : (
                <form className="home-new-project-form" onSubmit={handleCreate}>
                  <input autoFocus type="text" placeholder="Tên dự án mới…" value={newName} onChange={e => setNewName(e.target.value)} />
                  <button type="submit" disabled={creatingBusy}>Tạo</button>
                  <button type="button" onClick={() => setCreating(false)}>Huỷ</button>
                </form>
              )}
            </div>

            <div className="project-card-grid">
              {projects.map(p => {
                const stat = overviewByProjectId.get(p.id);
                return (
                  <button key={p.id} className="project-card" onClick={() => onOpenProject(p.id)} type="button">
                    <div className="project-card-head">
                      <FolderKanban size={18} />
                      <span className="project-card-name">{p.name}</span>
                      <ChevronRight size={16} className="project-card-arrow" />
                    </div>
                    {stat ? (
                      <>
                        <div className="project-card-bar">
                          <div className="project-card-bar-fill" style={{ width: `${stat.percent}%` }} />
                        </div>
                        <div className="project-card-stats">
                          <span>{stat.total} việc</span>
                          <span className="project-card-stat-ok">{stat.done} xong</span>
                          {stat.overdue > 0 && <span className="project-card-stat-danger">{stat.overdue} trễ hạn</span>}
                          <span>{stat.percent}%</span>
                        </div>
                      </>
                    ) : (
                      <p className="invite-hint">Chưa có dữ liệu công việc.</p>
                    )}
                    {!p.isMember && <span className="project-card-tag">Chỉ xem — chưa phải thành viên</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {overviewOpen && <OverviewPanel onClose={() => setOverviewOpen(false)} />}
      {adminOpen && <AdminPanel currentUserId={user.id} onClose={() => setAdminOpen(false)} />}
      {chatOpen && <ChatPanel currentUser={user} projectId={null} projectName="" onClose={() => setChatOpen(false)} />}
      {myTasksOpen && <MyTasksPanel onClose={() => setMyTasksOpen(false)} />}
      {inProgressOpen && (
        <div className="modal-overlay" onClick={() => setInProgressOpen(false)}>
          <div className="modal-card report-card" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3><Clock3 size={16} /> Đang thực hiện — tất cả dự án ({overview?.inProgressList?.length || 0})</h3>
              <button className="modal-close" onClick={() => setInProgressOpen(false)} type="button">✕</button>
            </div>
            {(overview?.inProgressList || []).length === 0 ? (
              <p className="invite-hint">Không có công việc nào đang thực hiện ở bất kỳ dự án nào.</p>
            ) : (
              <ul className="report-list">
                {overview.inProgressList.map(t => (
                  <li key={t.id} className="report-item report-item-warn">
                    <span className="report-item-title">{t.title}</span>
                    <span className="report-item-meta">{t.projectName} · <b>Người phụ trách:</b> {t.assignee}{t.due && <> · <b>Hạn:</b> {t.due}</>}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

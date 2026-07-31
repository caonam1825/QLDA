import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FolderKanban, Users2, ClipboardList, AlertTriangle, Clock3, LogOut,
  ListChecks, MessageSquare, LayoutGrid, ShieldCheck, Plus, ChevronRight, Loader2,
} from "lucide-react";
import { api, setToken } from "../api";
import { StatCard } from "../components/Basics";
import StackedBarChart from "../components/StackedBarChart";
import Sidebar from "../components/Sidebar";
import OverviewPanel from "../components/OverviewPanel";
import AdminPanel from "../components/AdminPanel";
import ChatPanel from "../components/ChatPanel";
import MyTasksPanel from "../components/MyTasksPanel";
import ChangePasswordModal from "../components/ChangePasswordModal";
import UpdateProfileModal from "../components/UpdateProfileModal";
import CompanyStaffPanel from "../components/CompanyStaffPanel";

export default function Home({ user, onLogout, onOpenProject, onUserUpdated }) {
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
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);

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
  const canManageStaff = user.isSuperAdmin || (projects || []).some(p => p.role === "owner" || p.role === "editor");

  const chartData = useMemo(() => {
    return (overview?.projects || []).slice(0, 8).map(p => ({
      label: p.name.length > 14 ? `${p.name.slice(0, 13)}…` : p.name,
      total: p.total, done: p.done, doing: p.doing, todo: p.todo, blocked: p.blocked, overdue: p.overdue,
    }));
  }, [overview]);

  return (
    <div className="app-root home-shell">
      <Sidebar
        user={user}
        projects={projects}
        currentProjectId={null}
        onSelectProject={onOpenProject}
        onGoHome={() => {}}
        onOpenMyTasks={() => setMyTasksOpen(true)}
        onOpenStaff={() => setStaffOpen(true)}
        onOpenOverview={() => setOverviewOpen(true)}
        onOpenAdmin={() => setAdminOpen(true)}
      />

      <div className="home-main-col">
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
              <h1>Tổng quan</h1>
              <p>Toàn bộ dự án, nhân viên và tiến độ công ty — chọn 1 dự án bên dưới để xem chi tiết &amp; giao việc.</p>
            </div>
            <div className="app-header-right">
              <div className="user-chip">
                <span className="avatar-circle avatar-clickable avatar-chip" onClick={() => setProfileOpen(true)} title="Thông tin cá nhân">
                  {(user.name || "?").trim().charAt(0).toUpperCase()}
                </span>
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
                <StatCard icon={FolderKanban} label="Tổng số dự án" value={projects.length} tint="#1E3A5F" />
                <StatCard icon={Users2} label="Nhân viên (Ban QLDA)" value={staffCount} tint="#059669" />
                <StatCard icon={ClipboardList} label="Tổng đầu việc" value={overview?.totals.total ?? 0} tint="#CA8A04" />
                <StatCard icon={AlertTriangle} label="Trễ hạn toàn hệ thống" value={overview?.totals.overdue ?? 0} tint="#DC2626" />
              </div>

              {chartData.length > 0 && (
                <section className="home-chart-section">
                  <h2 className="home-chart-title">Công việc theo từng dự án</h2>
                  <StackedBarChart data={chartData} />
                </section>
              )}

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
      </div>

      {overviewOpen && <OverviewPanel onClose={() => setOverviewOpen(false)} />}
      {adminOpen && <AdminPanel currentUserId={user.id} onClose={() => setAdminOpen(false)} />}
      {chatOpen && <ChatPanel currentUser={user} projectId={null} projectName="" onClose={() => setChatOpen(false)} />}
      {myTasksOpen && <MyTasksPanel onClose={() => setMyTasksOpen(false)} />}
      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
      {profileOpen && (
        <UpdateProfileModal
          user={user}
          onUpdated={(u) => onUserUpdated(u)}
          onOpenPassword={() => { setProfileOpen(false); setPasswordOpen(true); }}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {staffOpen && <CompanyStaffPanel canManage={canManageStaff} onClose={() => { setStaffOpen(false); load(); }} />}
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

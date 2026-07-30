import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, CheckCircle2, Circle, Clock3, AlertTriangle, RefreshCw,
  FileText, X, Landmark, ClipboardList, Users, LogOut, Users2, BarChart3, LayoutGrid, Eye,
} from "lucide-react";
import { api, setToken } from "../api";
import { PHASES, STATUS } from "../constants";
import { SealBadge, StatCard } from "../components/Basics";
import { PhaseBlock } from "../components/GroupPhaseBlocks";
import ProjectSwitcher from "../components/ProjectSwitcher";
import MembersPanel from "../components/MembersPanel";
import StaffPanel from "../components/StaffPanel";
import ReportPanel from "../components/ReportPanel";
import OverviewPanel from "../components/OverviewPanel";
import NextSteps from "../components/NextSteps";

const NO_PERMS = { editTaskFields: false, editProgress: false, addProcess: false, manageStaff: false, manageMembers: false, manageProject: false, manageLock: false };

export default function Dashboard({ user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [unitFilter, setUnitFilter] = useState("ALL");
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [saveState, setSaveState] = useState("idle");

  const loadProjectList = useCallback(async (preferId) => {
    const { projects: list } = await api.listProjects();
    setProjects(list);
    if (list.length === 0) {
      const { project: proj } = await api.createProject("Dự án 1", "template");
      setProjects([{ id: proj.id, name: proj.name, role: "owner", isMember: true }]);
      setCurrentId(proj.id);
      setProject(proj);
      return;
    }
    const pickId = preferId && list.some(p => p.id === preferId) ? preferId : list[0].id;
    setCurrentId(pickId);
    const { project: proj } = await api.getProject(pickId);
    setProject(proj);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadProjectList()
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadProjectList]);

  const listEntry = useMemo(() => projects.find(pr => pr.id === currentId), [projects, currentId]);
  const isOwner = (project?.myRole || listEntry?.role) === "owner";
  const isMember = listEntry ? listEntry.isMember : true;
  const perms = project?.myPerms || NO_PERMS;
  const hasAnyEdit = perms.editTaskFields || perms.editProgress || perms.addProcess;

  async function refreshProject(id = currentId) {
    const { project: proj } = await api.getProject(id);
    setProject(proj);
  }

  function flashSaved() {
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 900);
  }

  async function withSave(fn) {
    setSaveState("saving");
    try {
      await fn();
      flashSaved();
    } catch (e) {
      setSaveState("error");
      setError(e.message || "Có lỗi xảy ra");
    }
  }

  const handleSwitchProject = async (id) => {
    setCurrentId(id);
    setLoading(true);
    try { await refreshProject(id); } finally { setLoading(false); }
  };

  const handleCreateProject = async (name, seed) => {
    const { project: proj } = await api.createProject(name, seed);
    await loadProjectList(proj.id);
  };

  const handleRenameProject = async (id, name) => {
    await api.renameProject(id, name);
    await loadProjectList(id);
  };

  const handleDeleteProject = async (id) => {
    await api.deleteProject(id);
    await loadProjectList();
  };

  const handleProgressChange = (taskId, patch) =>
    withSave(async () => { await api.updateProgress(taskId, patch); await refreshProject(); });
  const handleFieldChange = (taskId, patch) =>
    withSave(async () => { await api.updateTaskField(taskId, patch); await refreshProject(); });
  const handleDeleteTask = (taskId) =>
    withSave(async () => { await api.deleteTask(taskId); await refreshProject(); });
  const handleMoveTask = (taskId, dir) =>
    withSave(async () => { await api.moveTask(taskId, dir); await refreshProject(); });
  const handleAddTask = (groupId) =>
    withSave(async () => { await api.addTask(groupId); await refreshProject(); });
  const handleAddGroup = (phaseKey) =>
    withSave(async () => { await api.addGroup(currentId, phaseKey, "Nhóm bước mới"); await refreshProject(); });
  const handleRenameGroup = (groupId, name) =>
    withSave(async () => { await api.renameGroup(groupId, name); await refreshProject(); });
  const handleDeleteGroup = (groupId) =>
    withSave(async () => { await api.deleteGroup(groupId); await refreshProject(); });
  const handleLockDue = (taskId) =>
    withSave(async () => { await api.lockTaskDue(taskId); await refreshProject(); });
  const handleUnlockDue = (taskId) =>
    withSave(async () => { await api.unlockTaskDue(taskId); await refreshProject(); });

  const units = useMemo(() => {
    if (!project) return [];
    const s = new Set();
    project.tasks.forEach(t => { if (t.unitDo) s.add(t.unitDo); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "vi"));
  }, [project]);

  const filteredTasks = useMemo(() => {
    if (!project) return [];
    const q = query.trim().toLowerCase();
    return project.tasks.filter(t => {
      if (phaseFilter !== "ALL" && t.phase !== phaseFilter) return false;
      if (unitFilter !== "ALL" && t.unitDo !== unitFilter) return false;
      if (statusFilter !== "ALL" && t.progress.status !== statusFilter) return false;
      if (q) {
        const hay = `${t.title} ${t.unitDo} ${t.unitCoord}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [project, query, phaseFilter, statusFilter, unitFilter]);

  const filtersActive = query.trim() !== "" || statusFilter !== "ALL" || unitFilter !== "ALL";

  const grouped = useMemo(() => {
    if (!project) return [];
    const byGroup = new Map();
    filteredTasks.forEach(t => {
      if (!byGroup.has(t.group)) byGroup.set(t.group, []);
      byGroup.get(t.group).push(t);
    });
    return PHASES
      .filter(phase => phaseFilter === "ALL" || phaseFilter === phase.key)
      .map(phase => {
        const phaseGroups = project.groups
          .filter(g => g.phase === phase.key)
          .sort((a, b) => a.order - b.order);
        const groups = phaseGroups
          .map(g => ({ ...g, tasks: (byGroup.get(g.id) || []).slice().sort((a, b) => a.order - b.order) }))
          .filter(g => !filtersActive || g.tasks.length > 0);
        return { phase, groups };
      })
      .filter(p => p.groups.length > 0 || !filtersActive);
  }, [project, filteredTasks, phaseFilter, filtersActive]);

  const stats = useMemo(() => {
    const counts = { todo: 0, doing: 0, done: 0, blocked: 0 };
    let overdue = 0;
    const total = project ? project.tasks.length : 0;
    if (project) {
      for (const t of project.tasks) {
        counts[t.progress.status] = (counts[t.progress.status] || 0) + 1;
        const due = t.progress.due;
        if (due && t.progress.status !== "done" && due < new Date().toISOString().slice(0, 10)) overdue++;
      }
    }
    const percent = total ? Math.round((counts.done / total) * 100) : 0;
    return { counts, overdue, total, percent };
  }, [project]);

  const activeFilterCount = [
    phaseFilter !== "ALL", statusFilter !== "ALL", unitFilter !== "ALL", query.trim() !== "",
  ].filter(Boolean).length;

  if (loading || !project) {
    return (
      <div className="app-root app-loading">
        <p>Đang tải dự án…</p>
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-text">
            <span className="app-eyebrow">HỒ SƠ THỦ TỤC ĐẦU TƯ · ĐẤT ĐAI · XÂY DỰNG</span>
            <div className="app-header-title-row">
              <h1>{project.name}</h1>
              <ProjectSwitcher
                projects={projects}
                currentId={currentId}
                onSelect={handleSwitchProject}
                onCreate={handleCreateProject}
                onRename={handleRenameProject}
                onDelete={handleDeleteProject}
              />
              <button className="members-btn" onClick={() => setMembersOpen(true)} type="button">
                <Users size={14} /> Thành viên ({project.members.length})
              </button>
              <button className="members-btn" onClick={() => setStaffOpen(true)} type="button">
                <Users2 size={14} /> Nhân viên ({project.staff.length})
              </button>
              <button className="members-btn" onClick={() => setReportOpen(true)} type="button">
                <BarChart3 size={14} /> Báo cáo
                {stats.overdue > 0 && <span className="header-badge">{stats.overdue}</span>}
              </button>
              <button className="members-btn" onClick={() => setOverviewOpen(true)} type="button">
                <LayoutGrid size={14} /> Tổng hợp &amp; KPI
              </button>
            </div>
            <p>
              Đấu thầu lựa chọn nhà đầu tư dự án có sử dụng đất — theo dõi &amp; giao việc cùng đồng nghiệp theo thời gian thực.
              {!isMember && <b> <Eye size={12} style={{ verticalAlign: -1 }} /> Bạn đang xem dự án này ở chế độ chỉ xem (chưa phải thành viên chính thức).</b>}
              {isMember && !hasAnyEdit && <b> Bạn đang xem ở chế độ chỉ xem.</b>}
            </p>
          </div>
          <div className="app-header-right">
            <SealBadge percent={stats.percent} />
            <div className="user-chip">
              <span>{user.name}</span>
              <button onClick={onLogout} title="Đăng xuất" type="button"><LogOut size={13} /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="notice-band notice-band-error">
            <AlertTriangle size={18} className="notice-icon" />
            <div className="notice-text">{error}</div>
            <button className="notice-close" onClick={() => setError("")} aria-label="Đóng"><X size={15} /></button>
          </div>
        )}

        {noticeOpen && (
          <div className="notice-band">
            <Landmark size={18} className="notice-icon" />
            <div className="notice-text">
              <b>Lưu ý về căn cứ pháp lý:</b> Nội dung mẫu đã cập nhật theo Luật Đầu tư 143/2025/QH15, Luật Đất đai 2024,
              Luật Xây dựng 135/2025/QH15, Luật Quy hoạch đô thị và nông thôn 47/2024/QH15 cùng các nghị định hướng dẫn
              ban hành 2025–2026 (NĐ 96/2026, NĐ 217/2026, NĐ 178/2025, NĐ 102/2024, NĐ 49/2026…). Một số văn bản có
              mốc hiệu lực riêng (VD NĐ 96/2026/NĐ-CP có hiệu lực từ 31/03/2026). Đây là dữ liệu tổng hợp tham khảo ban
              đầu — vui lòng đối chiếu quy định hiện hành hoặc tham vấn đơn vị pháp chế trước khi áp dụng cho dự án
              thực tế.
            </div>
            <button className="notice-close" onClick={() => setNoticeOpen(false)} aria-label="Đóng"><X size={15} /></button>
          </div>
        )}

        <div className="stats-row">
          <StatCard icon={ClipboardList} label="Tổng đầu việc" value={stats.total} tint="#1E2A44" />
          <StatCard icon={CheckCircle2} label="Hoàn thành" value={stats.counts.done} tint="#2F6D5D" />
          <StatCard icon={Clock3} label="Đang thực hiện" value={stats.counts.doing} tint="#A9832E" />
          <StatCard icon={Circle} label="Chưa bắt đầu" value={stats.counts.todo} tint="#5B6472" />
          <StatCard icon={AlertTriangle} label="Trễ hạn" value={stats.overdue} tint="#9E2B25" />
        </div>

        <NextSteps project={project} />

        <div className="toolbar">
          <div className="search-box">
            <Search size={15} />
            <input type="text" placeholder="Tìm theo tên công việc, đơn vị…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}>
            <option value="ALL">Tất cả giai đoạn</option>
            {PHASES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
            <option value="ALL">Tất cả đơn vị thực hiện</option>
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          {activeFilterCount > 0 && (
            <button className="clear-filters" onClick={() => { setQuery(""); setPhaseFilter("ALL"); setStatusFilter("ALL"); setUnitFilter("ALL"); }} type="button">
              <X size={13} /> Xoá lọc ({activeFilterCount})
            </button>
          )}

          <div className="toolbar-right">
            <span className={`save-indicator save-${saveState}`}>
              {saveState === "saving" ? "Đang lưu…" : saveState === "saved" ? "Đã lưu" : ""}
            </span>
            <button className="reset-btn" onClick={() => refreshProject()} type="button">
              <RefreshCw size={13} /> Tải lại
            </button>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="empty-state">
            <FileText size={28} />
            <p>Không tìm thấy đầu việc phù hợp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          grouped.map((g, i) => (
            <PhaseBlock
              key={g.phase.key}
              phase={g.phase}
              groups={g.groups}
              staffList={project.staff}
              perms={perms}
              onProgressChange={handleProgressChange}
              onFieldChange={handleFieldChange}
              onDeleteTask={handleDeleteTask}
              onMoveTask={handleMoveTask}
              onLockDue={handleLockDue}
              onUnlockDue={handleUnlockDue}
              onRenameGroup={handleRenameGroup}
              onDeleteGroup={handleDeleteGroup}
              onAddTask={handleAddTask}
              onAddGroup={handleAddGroup}
              firstPhase={i === 0}
            />
          ))
        )}

        <footer className="app-footer">
          Dữ liệu được lưu trên máy chủ và đồng bộ cho mọi thành viên của dự án theo thời gian thực khi tải lại trang.
        </footer>
      </main>

      {membersOpen && (
        <MembersPanel
          project={project}
          canManage={perms.manageMembers}
          onClose={() => setMembersOpen(false)}
          onChanged={() => refreshProject()}
        />
      )}

      {staffOpen && (
        <StaffPanel
          project={project}
          canManage={perms.manageStaff}
          onClose={() => setStaffOpen(false)}
          onChanged={() => refreshProject()}
        />
      )}

      {reportOpen && (
        <ReportPanel projectId={currentId} onClose={() => setReportOpen(false)} />
      )}

      {overviewOpen && (
        <OverviewPanel onClose={() => setOverviewOpen(false)} />
      )}
    </div>
  );
}

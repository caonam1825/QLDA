import { useState, useMemo } from "react";
import {
  ShieldCheck, Home as HomeIcon, ListChecks, Users2, BarChart3, Search, Plus,
} from "lucide-react";

const DOT_COLORS = ["#3B82F6", "#8B5CF6", "#22C55E", "#CA8A04", "#EF4444", "#06B6D4", "#EC4899"];

// Sidebar dùng chung — hiện y hệt nhau ở Trang chủ (Home.jsx) và bên trong
// từng dự án (Dashboard.jsx) để trải nghiệm nhất quán, đúng theo yêu cầu
// "giao diện trong từng dự án cũng thể hiện tương tự giao diện màn hình chính".
export default function Sidebar({
  user, projects, currentProjectId, onSelectProject, onGoHome,
  onOpenMyTasks, onOpenStaff, onOpenOverview, onOpenAdmin,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const list = projects || [];
    const q = query.trim().toLowerCase();
    return q ? list.filter(p => p.name.toLowerCase().includes(q)) : list;
  }, [projects, query]);

  return (
    <aside className="home-sidebar">
      <div className="home-sidebar-brand">
        <ShieldCheck size={18} />
        <span>BAN DỰ ÁN</span>
      </div>
      <div className="home-sidebar-sub">TCT Cổ phần Hợp Lực</div>

      <nav className="home-sidebar-nav">
        <button
          className={`home-sidebar-nav-item ${!currentProjectId ? "home-sidebar-nav-item-active" : ""}`}
          onClick={onGoHome} type="button"
        >
          <HomeIcon size={15} /> Tổng quan
        </button>
        <button className="home-sidebar-nav-item" onClick={onOpenMyTasks} type="button">
          <ListChecks size={15} /> Việc của tôi
        </button>
        <button className="home-sidebar-nav-item" onClick={onOpenStaff} type="button">
          <Users2 size={15} /> Nhân viên
        </button>
        <button className="home-sidebar-nav-item" onClick={onOpenOverview} type="button">
          <BarChart3 size={15} /> Báo cáo &amp; KPI
        </button>
        {user.isSuperAdmin && (
          <button className="home-sidebar-nav-item" onClick={onOpenAdmin} type="button">
            <ShieldCheck size={15} /> Quản trị hệ thống
          </button>
        )}
      </nav>

      <div className="home-sidebar-search">
        <Search size={13} />
        <input type="text" placeholder="Tìm dự án…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="home-sidebar-section-label">DỰ ÁN {projects ? `(${projects.length})` : ""}</div>
      <div className="home-sidebar-projects">
        {filtered.map((p, i) => (
          <button
            key={p.id}
            className={`home-sidebar-project-item ${p.id === currentProjectId ? "home-sidebar-project-item-active" : ""}`}
            onClick={() => onSelectProject(p.id)} type="button"
          >
            <span className="home-sidebar-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
            <span className="home-sidebar-project-name">{p.name}</span>
          </button>
        ))}
      </div>
      <button className="home-sidebar-add-project" onClick={onGoHome} type="button">
        <Plus size={13} /> Dự án mới (ở Trang chủ)
      </button>
    </aside>
  );
}

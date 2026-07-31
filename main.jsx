import { useState, useEffect, useRef } from "react";
import { FolderOpen, ChevronsUpDown, Check, Pencil, Trash2, Plus, Layers, FileText, LayoutGrid } from "lucide-react";
import { IconBtn, ConfirmButton } from "./Basics";

export default function ProjectSwitcher({ projects, currentId, onSelect, onCreate, onRename, onDelete, onShowAll }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setCreating(false); setRenamingId(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const current = projects.find(p => p.id === currentId);

  return (
    <div className="switcher" ref={ref}>
      <button className="switcher-trigger" onClick={() => setOpen(o => !o)} type="button">
        <FolderOpen size={14} />
        <span className="switcher-current-name">{current ? current.name : "Chọn dự án"}</span>
        <ChevronsUpDown size={13} />
      </button>

      {open && (
        <div className="switcher-panel">
          {onShowAll && (
            <>
              <button
                className="switcher-item-name switcher-all-projects-btn"
                onClick={() => { onShowAll(); setOpen(false); }}
                type="button"
              >
                <LayoutGrid size={13} /> Trang chủ (tất cả dự án)
              </button>
              <div className="switcher-divider" />
            </>
          )}
          <div className="switcher-list">
            {projects.map(p => (
              <div key={p.id} className={`switcher-item ${p.id === currentId ? "switcher-item-active" : ""}`}>
                {renamingId === p.id ? (
                  <input
                    className="switcher-rename-input"
                    autoFocus
                    value={renameDraft}
                    onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { onRename(p.id, renameDraft); setRenamingId(null); }
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => { onRename(p.id, renameDraft); setRenamingId(null); }}
                  />
                ) : (
                  <button className="switcher-item-name" onClick={() => { onSelect(p.id); setOpen(false); }} type="button">
                    {p.id === currentId && <Check size={13} />}
                    {p.name}
                    {p.role !== "owner" && <span className="switcher-role-tag">{p.role === "viewer" ? "chỉ xem" : "thành viên"}</span>}
                  </button>
                )}
                {p.role === "owner" && (
                  <span className="switcher-item-actions">
                    <IconBtn icon={Pencil} title="Đổi tên" onClick={() => { setRenamingId(p.id); setRenameDraft(p.name); }} />
                    <ConfirmButton icon={Trash2} title="Xoá dự án" confirmLabel="Xoá?" danger onConfirm={() => onDelete(p.id)} />
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="switcher-divider" />

          {creating ? (
            <div className="switcher-create">
              <input autoFocus type="text" placeholder="Tên dự án mới…" value={newName} onChange={e => setNewName(e.target.value)} />
              <div className="switcher-create-actions">
                <button className="switcher-create-btn" onClick={() => { onCreate(newName, "template"); setCreating(false); setNewName(""); setOpen(false); }} type="button">
                  <Layers size={12} /> Từ mẫu chuẩn
                </button>
                <button className="switcher-create-btn switcher-create-btn-secondary" onClick={() => { onCreate(newName, "empty"); setCreating(false); setNewName(""); setOpen(false); }} type="button">
                  <FileText size={12} /> Dự án trống
                </button>
              </div>
            </div>
          ) : (
            <button className="switcher-new-btn" onClick={() => setCreating(true)} type="button">
              <Plus size={14} /> Tạo dự án mới
            </button>
          )}
        </div>
      )}
    </div>
  );
}

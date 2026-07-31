import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, FolderPlus, Users } from "lucide-react";
import { toRoman, STATUS } from "../constants";
import { MiniBar, IconBtn, ConfirmButton } from "./Basics";
import TaskRow from "./TaskRow";

function BulkAssignForm({ group, tasks, staffList, onBulkAssign, onCancel }) {
  const [status, setStatus] = useState("");
  const [assigneeStaffId, setAssigneeStaffId] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    const patch = {};
    if (status) patch.status = status;
    if (assigneeStaffId) { patch.assigneeStaffId = assigneeStaffId; patch.assignee = ""; }
    if (due) patch.due = due;
    if (Object.keys(patch).length === 0) { onCancel(); return; }
    setBusy(true);
    try {
      await onBulkAssign(group.id, patch);
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bulk-assign-box" onClick={e => e.stopPropagation()}>
      <div className="bulk-assign-title">
        Giao tiến độ cho cả nhóm "{group.name}" ({tasks.length} việc) — không cần sửa từng dòng bên trong
      </div>
      <div className="bulk-assign-grid">
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">— Giữ nguyên trạng thái —</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={assigneeStaffId} onChange={e => setAssigneeStaffId(e.target.value)}>
          <option value="">— Giữ nguyên người phụ trách —</option>
          {staffList.map(s => <option key={s.id} value={s.id}>{s.name}{s.position ? ` (${s.position})` : ""}</option>)}
        </select>
        <input type="date" value={due} onChange={e => setDue(e.target.value)} title="Hạn hoàn thành chung (bỏ trống = giữ nguyên)" />
      </div>
      <div className="bulk-assign-actions">
        <button type="button" disabled={busy} onClick={apply}>{busy ? "Đang áp dụng…" : "Áp dụng cho cả nhóm"}</button>
        <button type="button" className="staff-cancel-edit" onClick={onCancel}>Huỷ</button>
      </div>
    </div>
  );
}

export function GroupBlock({
  group, roman, tasks, staffList, perms,
  onProgressChange, onFieldChange, onDeleteTask, onMoveTask,
  onLockDue, onUnlockDue, onBulkAssign,
  onRenameGroup, onDeleteGroup, onAddTask, defaultOpen,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name || "");
  const [bulkOpen, setBulkOpen] = useState(false);
  const done = tasks.filter(t => t.progress.status === "done").length;
  const canManage = !!perms?.addProcess;
  const canEditProgress = !!perms?.editProgress;
  const canLock = !!perms?.manageLock;
  const hasOverdue = tasks.some(t => {
    const due = t.progress.due;
    return due && t.progress.status !== "done" && due < new Date().toISOString().slice(0, 10);
  });

  return (
    <div className="group-block">
      <div className="group-head">
        <button className="group-chevron-btn" onClick={() => setOpen(o => !o)} type="button">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <span className="group-roman">{roman}</span>
        {editingName ? (
          <input
            className="group-name-input"
            autoFocus
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { onRenameGroup(group.id, nameDraft); setEditingName(false); }
              if (e.key === "Escape") { setNameDraft(group.name || ""); setEditingName(false); }
            }}
            onBlur={() => { onRenameGroup(group.id, nameDraft); setEditingName(false); }}
          />
        ) : (
          <span className="group-name" onClick={() => setOpen(o => !o)}>{group.name || "(Nhóm chưa đặt tên)"}</span>
        )}
        <MiniBar done={done} total={tasks.length} />
        {canEditProgress && tasks.length > 0 && (
          <IconBtn icon={Users} title="Giao tiến độ cho cả nhóm" onClick={() => { setBulkOpen(o => !o); setOpen(true); }} />
        )}
        {canManage && (
          <span className="group-actions">
            <IconBtn icon={Pencil} title="Đổi tên nhóm" onClick={() => setEditingName(true)} />
            <ConfirmButton
              icon={Trash2} title={hasOverdue && !canLock ? "Nhóm có việc trễ hạn — chỉ Chủ dự án được xoá" : "Xoá cả nhóm"}
              confirmLabel="Xoá nhóm?" danger onConfirm={() => onDeleteGroup(group.id)}
              disabled={hasOverdue && !canLock}
            />
          </span>
        )}
      </div>
      {open && bulkOpen && (
        <BulkAssignForm group={group} tasks={tasks} staffList={staffList} onBulkAssign={onBulkAssign} onCancel={() => setBulkOpen(false)} />
      )}
      {open && (
        <div className="group-body">
          {tasks.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              staffList={staffList}
              code={`${roman}.${i + 1}`}
              onProgressChange={onProgressChange}
              onFieldChange={onFieldChange}
              onDelete={onDeleteTask}
              onMove={onMoveTask}
              onLockDue={onLockDue}
              onUnlockDue={onUnlockDue}
              canMoveUp={i > 0}
              canMoveDown={i < tasks.length - 1}
              perms={perms}
            />
          ))}
          {canManage && (
            <button className="add-task-btn" onClick={() => onAddTask(group.id)} type="button">
              <Plus size={13} /> Thêm bước trong nhóm này
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PhaseBlock({
  phase, groups, staffList, perms, onProgressChange, onFieldChange, onDeleteTask,
  onMoveTask, onLockDue, onUnlockDue, onBulkAssign, onRenameGroup, onDeleteGroup, onAddTask, onAddGroup, firstPhase,
}) {
  const allTasks = groups.flatMap(g => g.tasks);
  const done = allTasks.filter(t => t.progress.status === "done").length;
  const canManage = !!perms?.addProcess;

  return (
    <section className="phase-block">
      <div className="phase-head">
        <div className="phase-head-left">
          <span className="phase-tab">{phase.key}</span>
          <div>
            <h2>{phase.label}</h2>
            <p>{phase.sub}</p>
          </div>
        </div>
        <MiniBar done={done} total={allTasks.length} />
      </div>
      <div className="phase-body">
        {groups.length === 0 && <div className="phase-empty">Chưa có nhóm bước nào trong giai đoạn này.</div>}
        {groups.map((g, i) => (
          <GroupBlock
            key={g.id}
            group={g}
            roman={toRoman(i + 1)}
            tasks={g.tasks}
            staffList={staffList}
            perms={perms}
            onProgressChange={onProgressChange}
            onFieldChange={onFieldChange}
            onDeleteTask={onDeleteTask}
            onMoveTask={onMoveTask}
            onLockDue={onLockDue}
            onUnlockDue={onUnlockDue}
            onBulkAssign={onBulkAssign}
            onRenameGroup={onRenameGroup}
            onDeleteGroup={onDeleteGroup}
            onAddTask={onAddTask}
            defaultOpen={firstPhase && i === 0}
          />
        ))}
        {canManage && (
          <button className="add-group-btn" onClick={() => onAddGroup(phase.key)} type="button">
            <FolderPlus size={14} /> Thêm nhóm bước mới trong {phase.label}
          </button>
        )}
      </div>
    </section>
  );
}

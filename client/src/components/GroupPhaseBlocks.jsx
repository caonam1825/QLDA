import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, FolderPlus } from "lucide-react";
import { toRoman } from "../constants";
import { MiniBar, IconBtn, ConfirmButton } from "./Basics";
import TaskRow from "./TaskRow";

export function GroupBlock({
  group, roman, tasks,
  onProgressChange, onFieldChange, onDeleteTask, onMoveTask,
  onRenameGroup, onDeleteGroup, onAddTask, defaultOpen, readOnly,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name || "");
  const done = tasks.filter(t => t.progress.status === "done").length;

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
        {!readOnly && (
          <span className="group-actions">
            <IconBtn icon={Pencil} title="Đổi tên nhóm" onClick={() => setEditingName(true)} />
            <ConfirmButton icon={Trash2} title="Xoá cả nhóm" confirmLabel="Xoá nhóm?" danger onConfirm={() => onDeleteGroup(group.id)} />
          </span>
        )}
      </div>
      {open && (
        <div className="group-body">
          {tasks.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              code={`${roman}.${i + 1}`}
              onProgressChange={onProgressChange}
              onFieldChange={onFieldChange}
              onDelete={onDeleteTask}
              onMove={onMoveTask}
              canMoveUp={i > 0}
              canMoveDown={i < tasks.length - 1}
              readOnly={readOnly}
            />
          ))}
          {!readOnly && (
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
  phase, groups, onProgressChange, onFieldChange, onDeleteTask,
  onMoveTask, onRenameGroup, onDeleteGroup, onAddTask, onAddGroup, firstPhase, readOnly,
}) {
  const allTasks = groups.flatMap(g => g.tasks);
  const done = allTasks.filter(t => t.progress.status === "done").length;

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
            onProgressChange={onProgressChange}
            onFieldChange={onFieldChange}
            onDeleteTask={onDeleteTask}
            onMoveTask={onMoveTask}
            onRenameGroup={onRenameGroup}
            onDeleteGroup={onDeleteGroup}
            onAddTask={onAddTask}
            defaultOpen={firstPhase && i === 0}
            readOnly={readOnly}
          />
        ))}
        {!readOnly && (
          <button className="add-group-btn" onClick={() => onAddGroup(phase.key)} type="button">
            <FolderPlus size={14} /> Thêm nhóm bước mới trong {phase.label}
          </button>
        )}
      </div>
    </section>
  );
}

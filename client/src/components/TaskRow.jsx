import { useState, memo } from "react";
import {
  ChevronDown, ChevronRight, Building2, CalendarDays, AlertTriangle,
  ArrowUp, ArrowDown, Trash2, User, Lock, Unlock,
} from "lucide-react";
import { STATUS, isOverdue } from "../constants";
import { IconBtn, ConfirmButton, DebouncedInput, DebouncedTextarea } from "./Basics";

function TaskRow({
  task, code, staffList, onProgressChange, onFieldChange, onDelete, onMove,
  onLockDue, onUnlockDue, canMoveUp, canMoveDown, perms,
}) {
  const [open, setOpen] = useState(false);
  const entry = task.progress;
  const st = STATUS[entry.status] || STATUS.todo;
  const StIcon = st.icon;
  const overdue = isOverdue(entry.due, entry.status);
  const indent = task.level >= 4 ? 1 : 0;
  const [customMode, setCustomMode] = useState(!!entry.assignee && !entry.assigneeStaffId);
  const usingCustomName = customMode && !entry.assigneeStaffId;
  const assigneeLabel = entry.assigneeStaffId
    ? (staffList.find(s => s.id === entry.assigneeStaffId)?.name || "")
    : entry.assignee;

  const canEditFields = !!perms?.editTaskFields;
  const canEditProgress = !!perms?.editProgress;
  const canManage = !!perms?.addProcess; // thêm/xoá/sắp xếp lại
  const canLock = !!perms?.manageLock;
  const dueLocked = !!entry.dueLocked;
  const dueDisabled = !canEditProgress || dueLocked;

  // Các ô nhập văn bản dùng DebouncedInput/DebouncedTextarea: gõ mượt ngay
  // lập tức (state cục bộ trong ô), chỉ gọi API lưu sau khi ngừng gõ ~500ms
  // hoặc khi rời khỏi ô — tránh gọi API + tải lại cả dự án trên từng ký tự.
  return (
    <div className="task-row" style={{ marginLeft: indent ? 22 : 0 }}>
      <div className="task-row-head">
        <button className="task-chevron-btn" onClick={() => setOpen(o => !o)} type="button">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <span className="task-code">{code}</span>
        <span className="task-title" onClick={() => setOpen(o => !o)}>{task.title || "(Chưa đặt tên bước)"}</span>
        <span className="task-tags">
          {task.unitDo && <span className="tag tag-unit"><Building2 size={11} />{task.unitDo}</span>}
          {task.duration && <span className="tag tag-duration"><CalendarDays size={11} />{task.duration}</span>}
          {assigneeLabel && <span className="tag tag-assignee"><User size={11} />{assigneeLabel}</span>}
          {dueLocked && <span className="tag tag-locked"><Lock size={11} />Đã khoá hạn</span>}
        </span>
        <span className="task-status-pill" style={{ color: st.color, background: st.bg }}>
          <StIcon size={12} />{st.label}
        </span>
        {overdue && <span className="tag tag-overdue"><AlertTriangle size={11} />Trễ hạn</span>}
        {canManage && (
          <span className="task-row-actions">
            <IconBtn icon={ArrowUp} title="Chuyển lên" onClick={() => onMove(task.id, -1)} disabled={!canMoveUp} />
            <IconBtn icon={ArrowDown} title="Chuyển xuống" onClick={() => onMove(task.id, 1)} disabled={!canMoveDown} />
            <ConfirmButton icon={Trash2} title="Xoá bước này" confirmLabel="Xoá?" danger onConfirm={() => onDelete(task.id)} />
          </span>
        )}
      </div>

      {open && (
        <div className="task-detail">
          <div className="field field-full">
            <span className="field-label">Tên công việc / đầu mục</span>
            <DebouncedInput
              type="text" value={task.title} disabled={!canEditFields}
              placeholder="Nhập tên bước công việc…"
              onCommit={v => onFieldChange(task.id, { title: v })}
            />
          </div>

          <div className="task-detail-grid">
            <label className="field">
              <span className="field-label">Đơn vị thực hiện</span>
              <DebouncedInput
                type="text" placeholder="VD: Sở Kế hoạch và Đầu tư" disabled={!canEditFields}
                value={task.unitDo}
                onCommit={v => onFieldChange(task.id, { unitDo: v })}
              />
            </label>
            <label className="field">
              <span className="field-label">Đơn vị phối hợp / trình</span>
              <DebouncedInput
                type="text" placeholder="VD: Các sở, ngành liên quan" disabled={!canEditFields}
                value={task.unitCoord}
                onCommit={v => onFieldChange(task.id, { unitCoord: v })}
              />
            </label>
            <label className="field">
              <span className="field-label">Thời gian dự kiến</span>
              <DebouncedInput
                type="text" placeholder="VD: 10 ngày" disabled={!canEditFields}
                value={task.duration}
                onCommit={v => onFieldChange(task.id, { duration: v })}
              />
            </label>
          </div>

          <div className="task-detail-grid">
            <label className="field">
              <span className="field-label">Trạng thái</span>
              <select
                value={entry.status} disabled={!canEditProgress}
                onChange={e => onProgressChange(task.id, { status: e.target.value })}
              >
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Người phụ trách</span>
              <select
                disabled={!canEditProgress}
                value={usingCustomName ? "__custom__" : (entry.assigneeStaffId || "")}
                onChange={e => {
                  const v = e.target.value;
                  if (v === "__custom__") { setCustomMode(true); onProgressChange(task.id, { assigneeStaffId: "" }); }
                  else { setCustomMode(false); onProgressChange(task.id, { assigneeStaffId: v, assignee: "" }); }
                }}
              >
                <option value="">— Chưa gán —</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}{s.position ? ` (${s.position})` : ""}</option>)}
                <option value="__custom__">Khác (nhập tay)…</option>
              </select>
              {usingCustomName && (
                <DebouncedInput
                  type="text" disabled={!canEditProgress}
                  placeholder="Nhập tên người phụ trách…"
                  value={entry.assignee}
                  onCommit={v => onProgressChange(task.id, { assignee: v })}
                  style={{ marginTop: 4 }}
                />
              )}
            </label>
            <label className="field">
              <span className="field-label">
                Hạn hoàn thành
                {canLock && (
                  dueLocked ? (
                    <button type="button" className="due-lock-btn" title="Mở khoá hạn" onClick={() => onUnlockDue(task.id)}>
                      <Unlock size={11} /> Mở khoá
                    </button>
                  ) : (
                    <button type="button" className="due-lock-btn" title="Khoá hạn làm căn cứ KPI" onClick={() => onLockDue(task.id)}>
                      <Lock size={11} /> Khoá hạn
                    </button>
                  )
                )}
              </span>
              <input
                type="date" disabled={dueDisabled}
                value={entry.due}
                onChange={e => onProgressChange(task.id, { due: e.target.value })}
                title={dueLocked ? "Hạn đã bị khoá làm căn cứ tính KPI — chỉ chủ dự án mở khoá được" : undefined}
              />
            </label>
          </div>

          <label className="field field-full">
            <span className="field-label">Căn cứ pháp lý</span>
            <DebouncedInput
              type="text" placeholder="VD: Điều 31 Nghị định số 31/2021/NĐ-CP" disabled={!canEditFields}
              value={task.legal}
              onCommit={v => onFieldChange(task.id, { legal: v })}
            />
          </label>

          <label className="field field-full">
            <span className="field-label">Ghi chú quy trình</span>
            <DebouncedTextarea
              rows={2} disabled={!canEditFields}
              placeholder="VD: mốc thời gian rút gọn, điều kiện áp dụng…"
              value={task.origNote}
              onCommit={v => onFieldChange(task.id, { origNote: v })}
            />
          </label>

          <label className="field field-full field-note">
            <span className="field-label">Ghi chú thực tế / cập nhật tiến độ</span>
            <DebouncedTextarea
              rows={2} disabled={!canEditProgress}
              placeholder="Ghi chú riêng cho công việc này…"
              value={entry.note}
              onCommit={v => onProgressChange(task.id, { note: v })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

// So sánh nông (shallow) đủ dùng: task/entry là object mới mỗi lần cha
// render lại toàn bộ dự án, nhưng nếu nội dung con TASK NÀY không đổi thì bỏ
// qua render lại — giảm hẳn số dòng phải vẽ lại khi chỉ 1 công việc thay đổi.
function areEqual(prev, next) {
  return (
    JSON.stringify(prev.task) === JSON.stringify(next.task) &&
    prev.code === next.code &&
    prev.canMoveUp === next.canMoveUp &&
    prev.canMoveDown === next.canMoveDown &&
    prev.perms === next.perms &&
    prev.staffList === next.staffList
  );
}

export default memo(TaskRow, areEqual);

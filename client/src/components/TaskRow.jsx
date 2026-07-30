import { useState } from "react";
import {
  ChevronDown, ChevronRight, Building2, CalendarDays, AlertTriangle,
  ArrowUp, ArrowDown, Trash2,
} from "lucide-react";
import { STATUS, isOverdue } from "../constants";
import { IconBtn, ConfirmButton } from "./Basics";

export default function TaskRow({
  task, code, onProgressChange, onFieldChange, onDelete, onMove,
  canMoveUp, canMoveDown, readOnly,
}) {
  const [open, setOpen] = useState(false);
  const entry = task.progress;
  const st = STATUS[entry.status] || STATUS.todo;
  const StIcon = st.icon;
  const overdue = isOverdue(entry.due, entry.status);
  const indent = task.level >= 4 ? 1 : 0;

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
        </span>
        <span className="task-status-pill" style={{ color: st.color, background: st.bg }}>
          <StIcon size={12} />{st.label}
        </span>
        {overdue && <span className="tag tag-overdue"><AlertTriangle size={11} />Trễ hạn</span>}
        {!readOnly && (
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
            <input
              type="text" value={task.title} disabled={readOnly}
              placeholder="Nhập tên bước công việc…"
              onChange={e => onFieldChange(task.id, { title: e.target.value })}
            />
          </div>

          <div className="task-detail-grid">
            <label className="field">
              <span className="field-label">Đơn vị thực hiện</span>
              <input
                type="text" placeholder="VD: Sở Kế hoạch và Đầu tư" disabled={readOnly}
                value={task.unitDo}
                onChange={e => onFieldChange(task.id, { unitDo: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Đơn vị phối hợp / trình</span>
              <input
                type="text" placeholder="VD: Các sở, ngành liên quan" disabled={readOnly}
                value={task.unitCoord}
                onChange={e => onFieldChange(task.id, { unitCoord: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Thời gian dự kiến</span>
              <input
                type="text" placeholder="VD: 10 ngày" disabled={readOnly}
                value={task.duration}
                onChange={e => onFieldChange(task.id, { duration: e.target.value })}
              />
            </label>
          </div>

          <div className="task-detail-grid">
            <label className="field">
              <span className="field-label">Trạng thái</span>
              <select
                value={entry.status} disabled={readOnly}
                onChange={e => onProgressChange(task.id, { status: e.target.value })}
              >
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Người / đơn vị phụ trách</span>
              <input
                type="text" placeholder="VD: Nguyễn Văn A – P.QLDA" disabled={readOnly}
                value={entry.assignee}
                onChange={e => onProgressChange(task.id, { assignee: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Hạn hoàn thành</span>
              <input
                type="date" disabled={readOnly}
                value={entry.due}
                onChange={e => onProgressChange(task.id, { due: e.target.value })}
              />
            </label>
          </div>

          <label className="field field-full">
            <span className="field-label">Căn cứ pháp lý</span>
            <input
              type="text" placeholder="VD: Điều 31 Nghị định số 31/2021/NĐ-CP" disabled={readOnly}
              value={task.legal}
              onChange={e => onFieldChange(task.id, { legal: e.target.value })}
            />
          </label>

          <label className="field field-full">
            <span className="field-label">Ghi chú quy trình</span>
            <textarea
              rows={2} disabled={readOnly}
              placeholder="VD: mốc thời gian rút gọn, điều kiện áp dụng…"
              value={task.origNote}
              onChange={e => onFieldChange(task.id, { origNote: e.target.value })}
            />
          </label>

          <label className="field field-full field-note">
            <span className="field-label">Ghi chú thực tế / cập nhật tiến độ</span>
            <textarea
              rows={2} disabled={readOnly}
              placeholder="Ghi chú riêng cho công việc này…"
              value={entry.note}
              onChange={e => onProgressChange(task.id, { note: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

import { ArrowRightCircle, Scale, CheckCircle2 } from "lucide-react";
import { PHASES } from "../constants";

// For each phase, find the first task (in stored group/task order) that
// isn't marked "done" yet — this is what the team should logically tackle
// next, since the sample process and most custom processes are sequential.
function computeNextSteps(project) {
  const groupsByPhase = new Map();
  project.groups.forEach(g => {
    if (!groupsByPhase.has(g.phase)) groupsByPhase.set(g.phase, []);
    groupsByPhase.get(g.phase).push(g);
  });
  const tasksByGroup = new Map();
  project.tasks.forEach(t => {
    if (!tasksByGroup.has(t.group)) tasksByGroup.set(t.group, []);
    tasksByGroup.get(t.group).push(t);
  });

  return PHASES.map(phase => {
    const groups = (groupsByPhase.get(phase.key) || []).slice().sort((a, b) => a.order - b.order);
    for (const g of groups) {
      const tasks = (tasksByGroup.get(g.id) || []).slice().sort((a, b) => a.order - b.order);
      const next = tasks.find(t => t.progress.status !== "done");
      if (next) return { phase, group: g, task: next };
    }
    if (groups.length > 0) return { phase, group: null, task: null }; // phase fully done
    return null; // phase has no groups/tasks at all yet
  }).filter(Boolean);
}

export default function NextSteps({ project }) {
  const steps = computeNextSteps(project);
  if (steps.length === 0) return null;

  return (
    <div className="next-steps">
      <div className="next-steps-head">
        <ArrowRightCircle size={15} />
        <span>Bước tiếp theo cần thực hiện</span>
      </div>
      <div className="next-steps-grid">
        {steps.map(({ phase, group, task }) => (
          <div key={phase.key} className="next-step-card">
            <span className="next-step-phase">{phase.label}</span>
            {task ? (
              <>
                <div className="next-step-title">{task.title || "(chưa đặt tên bước)"}</div>
                {group && <div className="next-step-group">Nhóm: {group.name}</div>}
                {task.legal && (
                  <div className="next-step-legal"><Scale size={12} /> {task.legal}</div>
                )}
                {task.origNote && <div className="next-step-note">{task.origNote}</div>}
              </>
            ) : (
              <div className="next-step-done"><CheckCircle2 size={14} /> Đã hoàn thành hết giai đoạn này</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

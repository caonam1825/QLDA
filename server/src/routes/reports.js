const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
router.use(requireAuth);

// Từ khi mọi người dùng đã đăng nhập đều xem được mọi dự án trong hệ thống,
// báo cáo tổng hợp & KPI cũng tính trên TOÀN BỘ dự án (không chỉ dự án mình
// là thành viên chính thức) để phản ánh đúng bức tranh toàn công ty.
function allProjectIds() {
  return db.prepare("SELECT id FROM projects").all().map(r => r.id);
}

/* ---------------- Tổng hợp nhiều dự án ---------------- */

router.get("/overview", (req, res) => {
  const projectIds = allProjectIds();
  if (projectIds.length === 0) {
    return res.json({ projects: [], overdueList: [], dueSoonList: [], totals: { total: 0, done: 0, overdue: 0 } });
  }
  const placeholders = projectIds.map(() => "?").join(",");
  const projects = db.prepare(`SELECT id, name FROM projects WHERE id IN (${placeholders})`).all(...projectIds);
  const allTasks = db.prepare(`SELECT * FROM tasks WHERE project_id IN (${placeholders})`).all(...projectIds);
  const allStaff = db.prepare(`SELECT * FROM staff WHERE project_id IN (${placeholders})`).all(...projectIds);
  const staffById = new Map(allStaff.map(s => [s.id, s]));
  const projectNameById = new Map(projects.map(p => [p.id, p.name]));

  const todayStr = new Date().toISOString().slice(0, 10);
  const in2days = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  function labelFor(t) {
    if (t.assignee_staff_id && staffById.has(t.assignee_staff_id)) return staffById.get(t.assignee_staff_id).name;
    return t.assignee || "Chưa gán";
  }

  const perProject = new Map(projects.map(p => [p.id, { id: p.id, name: p.name, total: 0, done: 0, doing: 0, todo: 0, blocked: 0, overdue: 0 }]));
  const overdueList = [];
  const dueSoonList = [];

  for (const t of allTasks) {
    const bucket = perProject.get(t.project_id);
    if (!bucket) continue;
    bucket.total++;
    bucket[t.status] = (bucket[t.status] || 0) + 1;
    if (t.due_date && t.status !== "done" && t.due_date < todayStr) {
      bucket.overdue++;
      overdueList.push({
        id: t.id, title: t.title, due: t.due_date, assignee: labelFor(t),
        projectId: t.project_id, projectName: projectNameById.get(t.project_id) || "",
      });
    } else if (t.due_date && t.status !== "done" && t.due_date >= todayStr && t.due_date <= in2days) {
      dueSoonList.push({
        id: t.id, title: t.title, due: t.due_date, assignee: labelFor(t),
        projectId: t.project_id, projectName: projectNameById.get(t.project_id) || "",
      });
    }
  }

  overdueList.sort((a, b) => (a.due < b.due ? -1 : 1));
  dueSoonList.sort((a, b) => (a.due < b.due ? -1 : 1));

  const projectSummaries = Array.from(perProject.values()).map(p => ({
    ...p,
    percent: p.total ? Math.round((p.done / p.total) * 100) : 0,
  }));

  const totals = projectSummaries.reduce(
    (acc, p) => ({ total: acc.total + p.total, done: acc.done + p.done, overdue: acc.overdue + p.overdue }),
    { total: 0, done: 0, overdue: 0 }
  );

  res.json({ projects: projectSummaries, overdueList, dueSoonList, totals });
});

/* ---------------- Xếp hạng KPI nhân viên ---------------- */
//
// Công thức KPI (có thể điều chỉnh lại trong file này nếu công ty muốn trọng
// số khác):
//   điểm = (số việc hoàn thành đúng hạn × 3) + (số việc hoàn thành trễ hạn × 1)
//          − (số việc đang trễ hạn chưa xong × 2) − (số việc đang vướng mắc × 1)
// Nhân viên được gộp theo SỐ ĐIỆN THOẠI (nếu có) để một người tham gia nhiều
// dự án vẫn được tính KPI gộp chung; nếu không có số điện thoại thì gộp theo
// tên + đơn vị.
router.get("/kpi", (req, res) => {
  const projectIds = allProjectIds();
  if (projectIds.length === 0) return res.json({ ranking: [] });
  const placeholders = projectIds.map(() => "?").join(",");
  const projects = db.prepare(`SELECT id, name FROM projects WHERE id IN (${placeholders})`).all(...projectIds);
  const projectNameById = new Map(projects.map(p => [p.id, p.name]));
  const allTasks = db.prepare(`SELECT * FROM tasks WHERE project_id IN (${placeholders}) AND assignee_staff_id != ''`).all(...projectIds);
  const allStaff = db.prepare(`SELECT * FROM staff WHERE project_id IN (${placeholders})`).all(...projectIds);
  const staffById = new Map(allStaff.map(s => [s.id, s]));

  const todayStr = new Date().toISOString().slice(0, 10);
  const byPerson = new Map(); // key -> aggregate

  function keyFor(staff) {
    return staff.phone ? `phone:${staff.phone}` : `name:${staff.name}|${staff.department}`;
  }

  for (const t of allTasks) {
    const staff = staffById.get(t.assignee_staff_id);
    if (!staff) continue;
    const key = keyFor(staff);
    if (!byPerson.has(key)) {
      byPerson.set(key, {
        key, name: staff.name, position: staff.position, department: staff.department,
        projects: new Set(), assigned: 0, completed: 0, completedOnTime: 0, completedLate: 0,
        overdueOpen: 0, blocked: 0, doing: 0, todo: 0,
      });
    }
    const agg = byPerson.get(key);
    agg.projects.add(projectNameById.get(t.project_id) || "");
    agg.assigned++;
    if (t.status === "done") {
      agg.completed++;
      // Không có ngày hoàn thành riêng — dùng thời điểm cập nhật trạng thái
      // gần nhất (updated_at) so với hạn (due_date) để coi là đúng/trễ hạn.
      const completedDateStr = t.updated_at ? new Date(t.updated_at).toISOString().slice(0, 10) : null;
      if (!t.due_date || !completedDateStr || completedDateStr <= t.due_date) agg.completedOnTime++;
      else agg.completedLate++;
    } else if (t.status === "blocked") {
      agg.blocked++;
    } else if (t.status === "doing") {
      agg.doing++;
    } else {
      agg.todo++;
    }
    if (t.status !== "done" && t.due_date && t.due_date < todayStr) agg.overdueOpen++;
  }

  const ranking = Array.from(byPerson.values()).map(a => {
    const score = a.completedOnTime * 3 + a.completedLate * 1 - a.overdueOpen * 2 - a.blocked * 1;
    return {
      key: a.key,
      name: a.name,
      position: a.position,
      department: a.department,
      projects: Array.from(a.projects).filter(Boolean),
      assigned: a.assigned,
      completed: a.completed,
      completedOnTime: a.completedOnTime,
      completedLate: a.completedLate,
      overdueOpen: a.overdueOpen,
      blocked: a.blocked,
      completionRate: a.assigned ? Math.round((a.completed / a.assigned) * 100) : 0,
      onTimeRate: a.completed ? Math.round((a.completedOnTime / a.completed) * 100) : 0,
      score,
    };
  }).sort((a, b) => b.score - a.score || b.completionRate - a.completionRate);

  ranking.forEach((r, i) => { r.rank = i + 1; });

  res.json({ ranking });
});

/* ---------------- Việc của tôi (mọi dự án) ---------------- */

router.get("/my-tasks", (req, res) => {
  const myStaff = db.prepare("SELECT * FROM staff WHERE linked_user_id = ?").all(req.user.id);
  if (myStaff.length === 0) return res.json({ tasks: [] });
  const staffIds = myStaff.map(s => s.id);
  const placeholders = staffIds.map(() => "?").join(",");
  const tasks = db
    .prepare(
      `SELECT t.*, p.name AS project_name FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.assignee_staff_id IN (${placeholders})`
    )
    .all(...staffIds);
  const todayStr = new Date().toISOString().slice(0, 10);
  res.json({
    tasks: tasks.map(t => ({
      id: t.id, title: t.title || "(chưa đặt tên)", status: t.status, due: t.due_date || "",
      dueLocked: !!t.due_locked, phase: t.phase, projectId: t.project_id, projectName: t.project_name,
      overdue: !!(t.due_date && t.status !== "done" && t.due_date < todayStr),
    })),
  });
});

/* ---------------- Việc theo từng người (khi bấm vào tên) ---------------- */
// key: "phone:<sđt>" hoặc "name:<tên>|<phòng ban>" — khớp với keyFor() trong /kpi
router.get("/by-person", (req, res) => {
  const key = String(req.query.key || "");
  if (!key) return res.status(400).json({ error: "Thiếu key" });
  const projectIds = allProjectIds();
  if (projectIds.length === 0) return res.json({ tasks: [] });
  const placeholders = projectIds.map(() => "?").join(",");
  const allStaff = db.prepare(`SELECT * FROM staff WHERE project_id IN (${placeholders})`).all(...projectIds);
  const matchStaffIds = allStaff
    .filter(s => (s.phone ? `phone:${s.phone}` : `name:${s.name}|${s.department}`) === key)
    .map(s => s.id);
  if (matchStaffIds.length === 0) return res.json({ tasks: [] });
  const sPlaceholders = matchStaffIds.map(() => "?").join(",");
  const projectNameById = new Map(db.prepare(`SELECT id, name FROM projects WHERE id IN (${placeholders})`).all(...projectIds).map(p => [p.id, p.name]));
  const tasks = db
    .prepare(`SELECT * FROM tasks WHERE assignee_staff_id IN (${sPlaceholders})`)
    .all(...matchStaffIds);
  const todayStr = new Date().toISOString().slice(0, 10);
  res.json({
    tasks: tasks.map(t => ({
      id: t.id, title: t.title || "(chưa đặt tên)", status: t.status, due: t.due_date || "",
      dueLocked: !!t.due_locked, phase: t.phase, projectId: t.project_id,
      projectName: projectNameById.get(t.project_id) || "",
      overdue: !!(t.due_date && t.status !== "done" && t.due_date < todayStr),
    })),
  });
});

module.exports = router;

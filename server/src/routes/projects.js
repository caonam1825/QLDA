const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { requireAuth } = require("../auth");
const { DEFAULT_TASKS, DEFAULT_GROUPS } = require("../templateData");

const router = express.Router();
router.use(requireAuth);

/* ---------------- helpers ---------------- */

function getMembership(projectId, userId) {
  return db
    .prepare("SELECT * FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, userId);
}

function requireMember(req, res, projectId, opts = {}) {
  const m = getMembership(projectId, req.user.id);
  if (!m) {
    res.status(403).json({ error: "Bạn không phải thành viên của dự án này" });
    return null;
  }
  if (opts.ownerOnly && m.role !== "owner") {
    res.status(403).json({ error: "Chỉ chủ dự án mới có quyền thực hiện thao tác này" });
    return null;
  }
  if (opts.blockViewer && m.role === "viewer") {
    res.status(403).json({ error: "Bạn chỉ có quyền xem, không thể chỉnh sửa dự án này" });
    return null;
  }
  return m;
}

function projectIdOfGroup(groupId) {
  const row = db.prepare("SELECT project_id FROM groups_ WHERE id = ?").get(groupId);
  return row ? row.project_id : null;
}

function projectIdOfTask(taskId) {
  const row = db.prepare("SELECT project_id FROM tasks WHERE id = ?").get(taskId);
  return row ? row.project_id : null;
}

function serializeGroup(g) {
  return { id: g.id, phase: g.phase, name: g.name, order: g.sort_order };
}

function serializeTask(t) {
  return {
    id: t.id,
    phase: t.phase,
    group: t.group_id,
    level: t.level,
    title: t.title,
    unitDo: t.unit_do,
    unitCoord: t.unit_coord,
    duration: t.duration,
    legal: t.legal,
    origNote: t.orig_note,
    order: t.sort_order,
    progress: {
      status: t.status,
      assignee: t.assignee,
      assigneeStaffId: t.assignee_staff_id || "",
      due: t.due_date,
      note: t.progress_note,
    },
    updatedAt: t.updated_at || null,
  };
}

function serializeStaff(s) {
  return {
    id: s.id, name: s.name, position: s.position, department: s.department,
    email: s.email, phone: s.phone,
  };
}

function projectIdOfStaff(staffId) {
  const row = db.prepare("SELECT project_id FROM staff WHERE id = ?").get(staffId);
  return row ? row.project_id : null;
}

function fullProject(projectId) {
  const proj = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!proj) return null;
  const groups = db
    .prepare("SELECT * FROM groups_ WHERE project_id = ? ORDER BY sort_order ASC")
    .all(projectId)
    .map(serializeGroup);
  const tasks = db
    .prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC")
    .all(projectId)
    .map(serializeTask);
  const staff = db
    .prepare("SELECT * FROM staff WHERE project_id = ? ORDER BY created_at ASC")
    .all(projectId)
    .map(serializeStaff);
  const members = db
    .prepare(
      `SELECT u.id, u.name, u.email, pm.role FROM project_members pm
       JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY pm.added_at ASC`
    )
    .all(projectId);
  return {
    id: proj.id,
    name: proj.name,
    ownerId: proj.owner_id,
    createdAt: proj.created_at,
    groups,
    tasks,
    members,
    staff,
  };
}

/* ---------------- projects ---------------- */

// list projects the user belongs to
router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.created_at, pm.role FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = ? ORDER BY p.created_at ASC`
    )
    .all(req.user.id);
  res.json({ projects: rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at, role: r.role })) });
});

// create project (creator becomes owner), optional seed from template
router.post("/", (req, res) => {
  const { name, seed } = req.body || {};
  const projectId = nanoid();
  const now = Date.now();
  const insert = db.transaction(() => {
    db.prepare("INSERT INTO projects (id, name, owner_id, created_at) VALUES (?,?,?,?)").run(
      projectId, (name && name.trim()) || "Dự án mới", req.user.id, now
    );
    db.prepare(
      "INSERT INTO project_members (project_id, user_id, role, added_at) VALUES (?,?,?,?)"
    ).run(projectId, req.user.id, "owner", now);

    if (seed === "template") {
      const groupIdMap = {};
      DEFAULT_GROUPS.forEach((g, i) => {
        const gid = nanoid();
        groupIdMap[`${g.phase}::${g.id}`] = gid;
        db.prepare(
          "INSERT INTO groups_ (id, project_id, phase, name, sort_order) VALUES (?,?,?,?,?)"
        ).run(gid, projectId, g.phase, g.name, i);
      });
      DEFAULT_TASKS.forEach((t) => {
        const gid = groupIdMap[`${t.phase}::${t.group}`];
        if (!gid) return;
        db.prepare(
          `INSERT INTO tasks
           (id, project_id, group_id, phase, level, title, unit_do, unit_coord, duration, legal, orig_note, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
        ).run(
          nanoid(), projectId, gid, t.phase, t.level || 2, t.title || "",
          t.unitDo || "", t.unitCoord || "", t.duration || "", t.legal || "", t.origNote || "", t.order || 0
        );
      });
    }
  });
  insert();
  res.json({ project: fullProject(projectId) });
});

router.get("/:id", (req, res) => {
  if (!requireMember(req, res, req.params.id)) return;
  const proj = fullProject(req.params.id);
  if (!proj) return res.status(404).json({ error: "Không tìm thấy dự án" });
  res.json({ project: proj });
});

router.patch("/:id", (req, res) => {
  if (!requireMember(req, res, req.params.id, { ownerOnly: true })) return;
  const { name } = req.body || {};
  if (name && name.trim()) {
    db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(name.trim(), req.params.id);
  }
  res.json({ project: fullProject(req.params.id) });
});

router.delete("/:id", (req, res) => {
  if (!requireMember(req, res, req.params.id, { ownerOnly: true })) return;
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------------- members / sharing ---------------- */

router.post("/:id/members", (req, res) => {
  if (!requireMember(req, res, req.params.id, { ownerOnly: true })) return;
  const { email, role } = req.body || {};
  if (!email) return res.status(400).json({ error: "Thiếu email" });
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ error: "Chưa có tài khoản nào đăng ký với email này. Người dùng cần đăng ký trước." });
  }
  const existing = getMembership(req.params.id, user.id);
  if (existing) return res.status(409).json({ error: "Người này đã là thành viên" });
  db.prepare(
    "INSERT INTO project_members (project_id, user_id, role, added_at) VALUES (?,?,?,?)"
  ).run(req.params.id, user.id, role === "viewer" ? "viewer" : "editor", Date.now());
  res.json({ project: fullProject(req.params.id) });
});

router.delete("/:id/members/:userId", (req, res) => {
  if (!requireMember(req, res, req.params.id, { ownerOnly: true })) return;
  const target = getMembership(req.params.id, req.params.userId);
  if (target && target.role === "owner") {
    return res.status(400).json({ error: "Không thể xoá chủ dự án" });
  }
  db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(
    req.params.id, req.params.userId
  );
  res.json({ project: fullProject(req.params.id) });
});

/* ---------------- groups ---------------- */

router.post("/:id/groups", (req, res) => {
  if (!requireMember(req, res, req.params.id, { blockViewer: true })) return;
  const { phase, name } = req.body || {};
  if (!phase) return res.status(400).json({ error: "Thiếu giai đoạn (phase)" });
  const maxOrder = db
    .prepare("SELECT MAX(sort_order) AS m FROM groups_ WHERE project_id = ? AND phase = ?")
    .get(req.params.id, phase);
  const gid = nanoid();
  db.prepare(
    "INSERT INTO groups_ (id, project_id, phase, name, sort_order) VALUES (?,?,?,?,?)"
  ).run(gid, req.params.id, phase, name || "Nhóm bước mới", (maxOrder.m ?? -1) + 1);
  res.json({ project: fullProject(req.params.id) });
});

router.patch("/groups/:groupId", (req, res) => {
  const projectId = projectIdOfGroup(req.params.groupId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy nhóm" });
  if (!requireMember(req, res, projectId, { blockViewer: true })) return;
  const { name } = req.body || {};
  if (name && name.trim()) {
    db.prepare("UPDATE groups_ SET name = ? WHERE id = ?").run(name.trim(), req.params.groupId);
  }
  res.json({ project: fullProject(projectId) });
});

router.delete("/groups/:groupId", (req, res) => {
  const projectId = projectIdOfGroup(req.params.groupId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy nhóm" });
  if (!requireMember(req, res, projectId, { blockViewer: true })) return;
  db.prepare("DELETE FROM groups_ WHERE id = ?").run(req.params.groupId);
  res.json({ project: fullProject(projectId) });
});

/* ---------------- tasks ---------------- */

router.post("/groups/:groupId/tasks", (req, res) => {
  const projectId = projectIdOfGroup(req.params.groupId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy nhóm" });
  if (!requireMember(req, res, projectId, { blockViewer: true })) return;
  const group = db.prepare("SELECT * FROM groups_ WHERE id = ?").get(req.params.groupId);
  const maxOrder = db
    .prepare("SELECT MAX(sort_order) AS m FROM tasks WHERE group_id = ?")
    .get(req.params.groupId);
  const tid = nanoid();
  db.prepare(
    `INSERT INTO tasks (id, project_id, group_id, phase, level, sort_order)
     VALUES (?,?,?,?,?,?)`
  ).run(tid, projectId, req.params.groupId, group.phase, 2, (maxOrder.m ?? -1) + 1);
  res.json({ project: fullProject(projectId) });
});

router.patch("/tasks/:taskId", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  if (!requireMember(req, res, projectId, { blockViewer: true })) return;
  const allowed = ["title", "unitDo", "unitCoord", "duration", "legal", "origNote"];
  const colMap = { title: "title", unitDo: "unit_do", unitCoord: "unit_coord", duration: "duration", legal: "legal", origNote: "orig_note" };
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      sets.push(`${colMap[key]} = ?`);
      vals.push(req.body[key]);
    }
  }
  if (sets.length) {
    vals.push(req.params.taskId);
    db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
  res.json({ project: fullProject(projectId) });
});

router.patch("/tasks/:taskId/progress", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  if (!requireMember(req, res, projectId, { blockViewer: true })) return;
  const { status, assignee, assigneeStaffId, due, note } = req.body || {};
  const sets = [];
  const vals = [];
  if (status !== undefined) { sets.push("status = ?"); vals.push(status); }
  if (assignee !== undefined) { sets.push("assignee = ?"); vals.push(assignee); }
  if (assigneeStaffId !== undefined) { sets.push("assignee_staff_id = ?"); vals.push(assigneeStaffId); }
  if (due !== undefined) { sets.push("due_date = ?"); vals.push(due); }
  if (note !== undefined) { sets.push("progress_note = ?"); vals.push(note); }
  sets.push("updated_by = ?"); vals.push(req.user.id);
  sets.push("updated_at = ?"); vals.push(Date.now());
  vals.push(req.params.taskId);
  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ project: fullProject(projectId) });
});

router.post("/tasks/:taskId/move", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  if (!requireMember(req, res, projectId, { blockViewer: true })) return;
  const { direction } = req.body || {};
  const dir = direction === -1 || direction === "-1" ? -1 : 1;
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.taskId);
  const siblings = db
    .prepare("SELECT * FROM tasks WHERE group_id = ? ORDER BY sort_order ASC")
    .all(task.group_id);
  const idx = siblings.findIndex(t => t.id === task.id);
  const swapIdx = idx + dir;
  if (swapIdx >= 0 && swapIdx < siblings.length) {
    const other = siblings[swapIdx];
    const tx = db.transaction(() => {
      db.prepare("UPDATE tasks SET sort_order = ? WHERE id = ?").run(other.sort_order, task.id);
      db.prepare("UPDATE tasks SET sort_order = ? WHERE id = ?").run(task.sort_order, other.id);
    });
    tx();
  }
  res.json({ project: fullProject(projectId) });
});

router.delete("/tasks/:taskId", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  if (!requireMember(req, res, projectId, { blockViewer: true })) return;
  db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.taskId);
  res.json({ project: fullProject(projectId) });
});

/* ---------------- staff directory (nhân viên) ---------------- */

router.post("/:id/staff", (req, res) => {
  if (!requireMember(req, res, req.params.id, { blockViewer: true })) return;
  const { name, position, department, email, phone } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Thiếu tên nhân viên" });
  const sid = nanoid();
  db.prepare(
    `INSERT INTO staff (id, project_id, name, position, department, email, phone, created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(sid, req.params.id, name.trim(), position || "", department || "", email || "", phone || "", Date.now());
  res.json({ project: fullProject(req.params.id) });
});

router.patch("/staff/:staffId", (req, res) => {
  const projectId = projectIdOfStaff(req.params.staffId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
  if (!requireMember(req, res, projectId, { blockViewer: true })) return;
  const allowed = ["name", "position", "department", "email", "phone"];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      sets.push(`${key} = ?`);
      vals.push(req.body[key]);
    }
  }
  if (sets.length) {
    vals.push(req.params.staffId);
    db.prepare(`UPDATE staff SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }
  res.json({ project: fullProject(projectId) });
});

router.delete("/staff/:staffId", (req, res) => {
  const projectId = projectIdOfStaff(req.params.staffId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
  if (!requireMember(req, res, projectId, { blockViewer: true })) return;
  const tx = db.transaction(() => {
    db.prepare("UPDATE tasks SET assignee_staff_id = '' WHERE assignee_staff_id = ?").run(req.params.staffId);
    db.prepare("DELETE FROM staff WHERE id = ?").run(req.params.staffId);
  });
  tx();
  res.json({ project: fullProject(projectId) });
});

/* ---------------- báo cáo ngày / tuần ---------------- */

router.get("/:id/report", (req, res) => {
  if (!requireMember(req, res, req.params.id)) return;
  const range = req.query.range === "week" ? "week" : "day";

  const now = new Date();
  let rangeStart;
  if (range === "day") {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  } else {
    const day = now.getDay(); // 0 = Sunday
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    rangeStart = monday.getTime();
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const allTasks = db.prepare("SELECT * FROM tasks WHERE project_id = ?").all(req.params.id);
  const staffList = db.prepare("SELECT * FROM staff WHERE project_id = ?").all(req.params.id);
  const staffById = new Map(staffList.map(s => [s.id, s]));

  function labelFor(t) {
    if (t.assignee_staff_id && staffById.has(t.assignee_staff_id)) return staffById.get(t.assignee_staff_id).name;
    if (t.assignee) return t.assignee;
    return "Chưa gán";
  }

  const updatedInRange = allTasks
    .filter(t => t.updated_at && t.updated_at >= rangeStart)
    .sort((a, b) => b.updated_at - a.updated_at)
    .map(t => ({
      id: t.id, title: t.title, status: t.status, assignee: labelFor(t),
      updatedAt: t.updated_at, phase: t.phase,
    }));

  const doneInRange = updatedInRange.filter(t => t.status === "done");

  const overdueList = allTasks
    .filter(t => t.due_date && t.status !== "done" && t.due_date < todayStr)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
    .map(t => ({ id: t.id, title: t.title, due: t.due_date, assignee: labelFor(t), phase: t.phase }));

  const dueSoonList = allTasks
    .filter(t => t.due_date && t.status !== "done" && t.due_date >= todayStr &&
      t.due_date <= new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10))
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
    .map(t => ({ id: t.id, title: t.title, due: t.due_date, assignee: labelFor(t), phase: t.phase }));

  const byStaffMap = new Map();
  function bucket(name) {
    if (!byStaffMap.has(name)) byStaffMap.set(name, { name, done: 0, doing: 0, todo: 0, blocked: 0, overdue: 0 });
    return byStaffMap.get(name);
  }
  for (const t of allTasks) {
    const name = labelFor(t);
    const b = bucket(name);
    b[t.status] = (b[t.status] || 0) + 1;
    if (t.due_date && t.status !== "done" && t.due_date < todayStr) b.overdue++;
  }

  res.json({
    range,
    rangeStart,
    updatedTasks: updatedInRange,
    doneCount: doneInRange.length,
    overdueList,
    dueSoonList,
    byStaff: Array.from(byStaffMap.values()).sort((a, b) => b.done - a.done),
  });
});

module.exports = router;

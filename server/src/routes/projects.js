const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../db");
const { requireAuth, hashPassword } = require("../auth");
const { DEFAULT_TASKS, DEFAULT_GROUPS } = require("../templateData");
const { normalizePhone, isValidVNPhone } = require("../phone");
const { permsFor, ROLE_LABELS, isKnownRole } = require("../permissions");

const router = express.Router();
router.use(requireAuth);

/* ---------------- helpers ---------------- */

function getMembership(projectId, userId) {
  return db
    .prepare("SELECT * FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, userId);
}

function isSuperAdmin(userId) {
  const row = db.prepare("SELECT is_super_admin FROM users WHERE id = ?").get(userId);
  return !!(row && row.is_super_admin);
}

// Nhân viên giờ là danh bạ DÙNG CHUNG toàn công ty (không thuộc riêng 1 dự
// án) — quyền thêm/sửa/xoá hồ sơ nhân viên ở cấp Trang chủ dựa trên: có quản
// lý (quyền "manageStaff") ít nhất 1 dự án nào đó trong hệ thống, hoặc là
// Quản trị hệ thống.
function userManagesAnyProject(userId) {
  if (isSuperAdmin(userId)) return true;
  const rows = db.prepare("SELECT role FROM project_members WHERE user_id = ?").all(userId);
  return rows.some(r => permsFor(r.role).manageStaff);
}

function requireCompanyStaffAccess(req, res) {
  if (!userManagesAnyProject(req.user.id)) {
    res.status(403).json({ error: "Bạn cần quản lý ít nhất 1 dự án để thêm/sửa nhân viên trong danh bạ chung" });
    return false;
  }
  return true;
}

// Bất kỳ ai đã đăng nhập cũng XEM được mọi dự án trong hệ thống (để các
// thành viên có thể theo dõi tiến độ dự án khác), nhưng chỉ những quyền cụ
// thể (`need`) mới cần đúng vai trò trong project_members. `need` là một
// khoá quyền trong permissions.js (VD: 'editTaskFields', 'editProgress',
// 'addProcess', 'manageStaff', 'manageMembers', 'manageProject', 'manageLock').
// Không truyền `need` nghĩa là chỉ cần xem được (view-only) là đủ.
// Quản trị hệ thống (super admin) luôn có toàn quyền trên MỌI dự án.
function requireProjectAccess(req, res, projectId, need) {
  const proj = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!proj) {
    res.status(404).json({ error: "Không tìm thấy dự án" });
    return null;
  }
  if (isSuperAdmin(req.user.id)) {
    return { role: "owner", isMember: true, isSuperAdmin: true };
  }
  const m = getMembership(projectId, req.user.id);
  const role = m ? m.role : "viewer"; // không phải thành viên chính thức -> chỉ xem
  if (need) {
    const perms = permsFor(role);
    if (!perms[need]) {
      res.status(403).json({
        error: m
          ? "Bạn không có quyền thực hiện thao tác này trong dự án"
          : "Bạn chỉ đang xem dự án này (không phải thành viên), không thể chỉnh sửa",
      });
      return null;
    }
  }
  return { role, isMember: !!m };
}

function projectIdOfGroup(groupId) {
  const row = db.prepare("SELECT project_id FROM groups_ WHERE id = ?").get(groupId);
  return row ? row.project_id : null;
}

function projectIdOfTask(taskId) {
  const row = db.prepare("SELECT project_id FROM tasks WHERE id = ?").get(taskId);
  return row ? row.project_id : null;
}

// Công việc coi là "trễ hạn": có hạn, chưa hoàn thành, và hạn đã qua hôm nay.
function isTaskOverdue(t) {
  if (!t || !t.due_date || t.status === "done") return false;
  return t.due_date < new Date().toISOString().slice(0, 10);
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
      dueLocked: !!t.due_locked,
    },
    updatedAt: t.updated_at || null,
  };
}

function serializeStaff(s) {
  return {
    id: s.id, name: s.name, position: s.position, department: s.department,
    email: s.email, phone: s.phone,
    zaloLinked: !!s.zalo_id,
    zaloLinkCode: s.zalo_link_code || "",
    hasLogin: !!s.linked_user_id,
    linkedUserId: s.linked_user_id || "",
  };
}

function projectIdOfStaff(staffId) {
  const row = db.prepare("SELECT project_id FROM staff WHERE id = ?").get(staffId);
  return row ? row.project_id : null;
}

function fullProject(projectId, viewerRole) {
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
    .prepare(
      `SELECT s.* FROM project_staff ps
       JOIN staff s ON s.id = ps.staff_id
       WHERE ps.project_id = ? ORDER BY ps.added_at ASC`
    )
    .all(projectId)
    .map(serializeStaff);
  const members = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, pm.role FROM project_members pm
       JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY pm.added_at ASC`
    )
    .all(projectId)
    .map(m => ({ ...m, roleLabel: ROLE_LABELS[m.role] || m.role }));
  return {
    id: proj.id,
    name: proj.name,
    ownerId: proj.owner_id,
    createdAt: proj.created_at,
    groups,
    tasks,
    members,
    staff,
    myRole: viewerRole || null,
    myPerms: viewerRole ? permsFor(viewerRole) : null,
  };
}

/* ---------------- projects ---------------- */

// Danh sách TẤT CẢ dự án trong hệ thống — mọi người dùng đã đăng nhập đều
// xem được để theo dõi tiến độ dự án khác, kèm cờ isMember/role thật của họ.
router.get("/", (req, res) => {
  const superAdmin = isSuperAdmin(req.user.id);
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.created_at,
              (SELECT role FROM project_members WHERE project_id = p.id AND user_id = ?) AS role
       FROM projects p ORDER BY p.created_at ASC`
    )
    .all(req.user.id);
  res.json({
    projects: rows.map(r => ({
      id: r.id, name: r.name, createdAt: r.created_at,
      role: superAdmin ? "owner" : (r.role || "viewer"),
      isMember: superAdmin ? true : !!r.role,
    })),
  });
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
  res.json({ project: fullProject(projectId, "owner") });
});

// Danh bạ nhân viên TOÀN CÔNG TY ("Ban quản lý dự án") — thêm 1 lần, dùng
// tích chọn (checkbox) cho mọi dự án, không cần nhập lại số điện thoại mỗi
// lần. Đặt route này TRƯỚC "GET /:id" để tránh Express hiểu nhầm
// "staff-directory" là :id.
// Thêm nhân viên mới NGAY TỪ TRANG CHỦ — không cần gắn với 1 dự án cụ thể.
// Sau khi tạo, vào từng dự án chỉ cần TÍCH CHỌN người này (PUT
// "/:id/staff-selection"), không cần nhập lại thông tin.
router.post("/staff-directory", (req, res) => {
  if (!requireCompanyStaffAccess(req, res)) return;
  const {
    name, position, department, email, phone,
    grantLogin, loginPhone, loginPassword, linkExistingPhone,
  } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Thiếu tên nhân viên" });

  let linkedUserId = "";
  if (linkExistingPhone) {
    const user = db.prepare("SELECT * FROM users WHERE phone = ?").get(normalizePhone(linkExistingPhone));
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy tài khoản nào đã đăng ký với số điện thoại này." });
    }
    linkedUserId = user.id;
  } else if (grantLogin) {
    const rawPhone = loginPhone || phone;
    if (!rawPhone || !isValidVNPhone(rawPhone)) {
      return res.status(400).json({ error: "Số điện thoại cấp tài khoản không hợp lệ" });
    }
    if (!loginPassword || loginPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu cấp cho nhân viên cần tối thiểu 6 ký tự" });
    }
    const normalizedPhone = normalizePhone(rawPhone);
    let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(normalizedPhone);
    if (!user) {
      const uid = nanoid();
      db.prepare(
        "INSERT INTO users (id, phone, email, password_hash, name, is_approved, created_at) VALUES (?,?,?,?,?,?,?)"
      ).run(uid, normalizedPhone, (email && email.trim()) || null, hashPassword(loginPassword), name.trim(), 1, Date.now());
      user = { id: uid };
    }
    linkedUserId = user.id;
  }

  const sid = nanoid();
  db.prepare(
    `INSERT INTO staff (id, project_id, name, position, department, email, phone, linked_user_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(sid, null, name.trim(), position || "", department || "", email || "", phone || "", linkedUserId, Date.now());
  const staff = db.prepare("SELECT * FROM staff WHERE id = ?").get(sid);
  res.json({ staff: { ...serializeStaff(staff), projectIds: [] } });
});

router.get("/staff-directory", (req, res) => {
  const rows = db.prepare("SELECT * FROM staff ORDER BY created_at ASC").all().map(serializeStaff);
  // Kèm luôn danh sách project_id mà mỗi người đang được tích chọn, để giao
  // diện tô sẵn checkbox mà không cần gọi thêm API.
  const psRows = db.prepare("SELECT staff_id, project_id FROM project_staff").all();
  const projectIdsByStaff = new Map();
  for (const r of psRows) {
    if (!projectIdsByStaff.has(r.staff_id)) projectIdsByStaff.set(r.staff_id, []);
    projectIdsByStaff.get(r.staff_id).push(r.project_id);
  }
  res.json({
    staff: rows.map(s => ({ ...s, projectIds: projectIdsByStaff.get(s.id) || [] })),
  });
});

router.get("/:id", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id);
  if (!access) return;
  const proj = fullProject(req.params.id, access.role);
  if (!proj) return res.status(404).json({ error: "Không tìm thấy dự án" });
  res.json({ project: proj });
});

router.patch("/:id", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "manageProject");
  if (!access) return;
  const { name } = req.body || {};
  if (name && name.trim()) {
    db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(name.trim(), req.params.id);
  }
  res.json({ project: fullProject(req.params.id, access.role) });
});

router.delete("/:id", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "manageProject");
  if (!access) return;
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------------- members / sharing / phân quyền ---------------- */

router.post("/:id/members", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "manageMembers");
  if (!access) return;
  const { phone, role } = req.body || {};
  if (!phone) return res.status(400).json({ error: "Thiếu số điện thoại" });
  const user = db.prepare("SELECT * FROM users WHERE phone = ?").get(normalizePhone(phone));
  if (!user) {
    return res.status(404).json({ error: "Chưa có tài khoản nào đăng ký với số điện thoại này. Người dùng cần đăng ký trước, hoặc dùng mục Nhân viên để cấp tài khoản trực tiếp." });
  }
  const existing = getMembership(req.params.id, user.id);
  if (existing) return res.status(409).json({ error: "Người này đã là thành viên" });
  const finalRole = isKnownRole(role) && role !== "owner" ? role : "editor";
  db.prepare(
    "INSERT INTO project_members (project_id, user_id, role, added_at) VALUES (?,?,?,?)"
  ).run(req.params.id, user.id, finalRole, Date.now());
  res.json({ project: fullProject(req.params.id, access.role) });
});

// Đổi quyền (phân quyền) của một thành viên đã có trong dự án: chỉ xem /
// chỉ sửa tên / thêm quy trình / chỉnh sửa toàn quyền.
router.patch("/:id/members/:userId", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "manageMembers");
  if (!access) return;
  const { role } = req.body || {};
  const target = getMembership(req.params.id, req.params.userId);
  if (!target) return res.status(404).json({ error: "Không tìm thấy thành viên" });
  if (target.role === "owner") return res.status(400).json({ error: "Không thể đổi quyền chủ dự án" });
  if (!isKnownRole(role) || role === "owner") {
    return res.status(400).json({ error: "Vai trò không hợp lệ" });
  }
  db.prepare("UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?").run(
    role, req.params.id, req.params.userId
  );
  res.json({ project: fullProject(req.params.id, access.role) });
});

router.delete("/:id/members/:userId", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "manageMembers");
  if (!access) return;
  const target = getMembership(req.params.id, req.params.userId);
  if (target && target.role === "owner") {
    return res.status(400).json({ error: "Không thể xoá chủ dự án" });
  }
  db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(
    req.params.id, req.params.userId
  );
  res.json({ project: fullProject(req.params.id, access.role) });
});

/* ---------------- groups ---------------- */

router.post("/:id/groups", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "addProcess");
  if (!access) return;
  const { phase, name } = req.body || {};
  if (!phase) return res.status(400).json({ error: "Thiếu giai đoạn (phase)" });
  const maxOrder = db
    .prepare("SELECT MAX(sort_order) AS m FROM groups_ WHERE project_id = ? AND phase = ?")
    .get(req.params.id, phase);
  const gid = nanoid();
  db.prepare(
    "INSERT INTO groups_ (id, project_id, phase, name, sort_order) VALUES (?,?,?,?,?)"
  ).run(gid, req.params.id, phase, name || "Nhóm bước mới", (maxOrder.m ?? -1) + 1);
  res.json({ project: fullProject(req.params.id, access.role) });
});

router.patch("/groups/:groupId", (req, res) => {
  const projectId = projectIdOfGroup(req.params.groupId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy nhóm" });
  const access = requireProjectAccess(req, res, projectId, "addProcess");
  if (!access) return;
  const { name } = req.body || {};
  if (name && name.trim()) {
    db.prepare("UPDATE groups_ SET name = ? WHERE id = ?").run(name.trim(), req.params.groupId);
  }
  res.json({ project: fullProject(projectId, access.role) });
});

router.delete("/groups/:groupId", (req, res) => {
  const projectId = projectIdOfGroup(req.params.groupId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy nhóm" });
  const access = requireProjectAccess(req, res, projectId, "addProcess");
  if (!access) return;
  if (access.role !== "owner") {
    const tasksInGroup = db.prepare("SELECT * FROM tasks WHERE group_id = ?").all(req.params.groupId);
    if (tasksInGroup.some(isTaskOverdue)) {
      return res.status(403).json({
        error: "Nhóm này có công việc đã trễ hạn — chỉ Chủ dự án mới được xoá cả nhóm, để giữ đúng dữ liệu làm căn cứ họp/KPI.",
      });
    }
  }
  db.prepare("DELETE FROM groups_ WHERE id = ?").run(req.params.groupId);
  res.json({ project: fullProject(projectId, access.role) });
});

/* ---------------- tasks ---------------- */

router.post("/groups/:groupId/tasks", (req, res) => {
  const projectId = projectIdOfGroup(req.params.groupId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy nhóm" });
  const access = requireProjectAccess(req, res, projectId, "addProcess");
  if (!access) return;
  const group = db.prepare("SELECT * FROM groups_ WHERE id = ?").get(req.params.groupId);
  const maxOrder = db
    .prepare("SELECT MAX(sort_order) AS m FROM tasks WHERE group_id = ?")
    .get(req.params.groupId);
  const tid = nanoid();
  db.prepare(
    `INSERT INTO tasks (id, project_id, group_id, phase, level, sort_order)
     VALUES (?,?,?,?,?,?)`
  ).run(tid, projectId, req.params.groupId, group.phase, 2, (maxOrder.m ?? -1) + 1);
  res.json({ project: fullProject(projectId, access.role) });
});

router.patch("/tasks/:taskId", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  const access = requireProjectAccess(req, res, projectId, "editTaskFields");
  if (!access) return;
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
  res.json({ project: fullProject(projectId, access.role) });
});

router.patch("/tasks/:taskId/progress", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  const access = requireProjectAccess(req, res, projectId, "editProgress");
  if (!access) return;
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.taskId);
  const { status, assignee, assigneeStaffId, due, note } = req.body || {};
  const sets = [];
  const vals = [];
  if (status !== undefined) { sets.push("status = ?"); vals.push(status); }
  if (assignee !== undefined) { sets.push("assignee = ?"); vals.push(assignee); }
  if (assigneeStaffId !== undefined) { sets.push("assignee_staff_id = ?"); vals.push(assigneeStaffId); }
  if (due !== undefined) {
    if (task.due_locked) {
      return res.status(423).json({ error: "Hạn hoàn thành đã bị khoá làm căn cứ tính KPI — chỉ chủ dự án được mở khoá trước khi sửa." });
    }
    sets.push("due_date = ?"); vals.push(due);
  }
  if (note !== undefined) { sets.push("progress_note = ?"); vals.push(note); }
  sets.push("updated_by = ?"); vals.push(req.user.id);
  sets.push("updated_at = ?"); vals.push(Date.now());
  vals.push(req.params.taskId);
  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ project: fullProject(projectId, access.role) });
});

// Giao tiến độ HÀNG LOẠT cho cả 1 nhóm bước (VD cả mục "I. Chấp thuận chủ
// trương đầu tư") — áp dụng người phụ trách/trạng thái/hạn cho TẤT CẢ công
// việc trong nhóm cùng lúc, không phải tích từng dòng bên trong. Việc nào
// đã bị khoá hạn thì bỏ qua phần hạn của riêng việc đó (không lỗi cả loạt).
router.patch("/groups/:groupId/bulk-progress", (req, res) => {
  const projectId = projectIdOfGroup(req.params.groupId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy nhóm" });
  const access = requireProjectAccess(req, res, projectId, "editProgress");
  if (!access) return;
  const { status, assigneeStaffId, assignee, due } = req.body || {};
  const tasks = db.prepare("SELECT * FROM tasks WHERE group_id = ?").all(req.params.groupId);
  const now = Date.now();
  const tx = db.transaction(() => {
    for (const t of tasks) {
      const sets = [];
      const vals = [];
      if (status !== undefined) { sets.push("status = ?"); vals.push(status); }
      if (assigneeStaffId !== undefined) { sets.push("assignee_staff_id = ?"); vals.push(assigneeStaffId); }
      if (assignee !== undefined) { sets.push("assignee = ?"); vals.push(assignee); }
      if (due !== undefined && !t.due_locked) { sets.push("due_date = ?"); vals.push(due); }
      if (!sets.length) continue;
      sets.push("updated_by = ?"); vals.push(req.user.id);
      sets.push("updated_at = ?"); vals.push(now);
      vals.push(t.id);
      db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    }
  });
  tx();
  res.json({ project: fullProject(projectId, access.role) });
});

// Giao tiến độ HÀNG LOẠT cho cả 1 GIAI ĐOẠN LỚN (VD toàn bộ "Chủ trương đầu
// tư & Lựa chọn nhà đầu tư") — áp dụng cho MỌI công việc trong TẤT CẢ các
// nhóm bước thuộc giai đoạn đó, không cần vào từng nhóm bên trong.
router.patch("/:id/phases/:phaseKey/bulk-progress", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "editProgress");
  if (!access) return;
  const { status, assigneeStaffId, assignee, due } = req.body || {};
  const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ? AND phase = ?").all(req.params.id, req.params.phaseKey);
  const now = Date.now();
  const tx = db.transaction(() => {
    for (const t of tasks) {
      const sets = [];
      const vals = [];
      if (status !== undefined) { sets.push("status = ?"); vals.push(status); }
      if (assigneeStaffId !== undefined) { sets.push("assignee_staff_id = ?"); vals.push(assigneeStaffId); }
      if (assignee !== undefined) { sets.push("assignee = ?"); vals.push(assignee); }
      if (due !== undefined && !t.due_locked) { sets.push("due_date = ?"); vals.push(due); }
      if (!sets.length) continue;
      sets.push("updated_by = ?"); vals.push(req.user.id);
      sets.push("updated_at = ?"); vals.push(now);
      vals.push(t.id);
      db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    }
  });
  tx();
  res.json({ project: fullProject(req.params.id, access.role) });
});
// căn cứ cố định khi tính KPI (không ai — kể cả chủ dự án qua API thường —
// sửa được due_date nữa cho đến khi mở khoá lại ở đây).
router.post("/tasks/:taskId/lock-due", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  const access = requireProjectAccess(req, res, projectId, "manageLock");
  if (!access) return;
  db.prepare("UPDATE tasks SET due_locked = 1, due_locked_by = ?, due_locked_at = ? WHERE id = ?").run(
    req.user.id, Date.now(), req.params.taskId
  );
  res.json({ project: fullProject(projectId, access.role) });
});

router.post("/tasks/:taskId/unlock-due", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  const access = requireProjectAccess(req, res, projectId, "manageLock");
  if (!access) return;
  db.prepare("UPDATE tasks SET due_locked = 0, due_locked_by = '', due_locked_at = NULL WHERE id = ?").run(
    req.params.taskId
  );
  res.json({ project: fullProject(projectId, access.role) });
});

router.post("/tasks/:taskId/move", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  const access = requireProjectAccess(req, res, projectId, "addProcess");
  if (!access) return;
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
  res.json({ project: fullProject(projectId, access.role) });
});

router.delete("/tasks/:taskId", (req, res) => {
  const projectId = projectIdOfTask(req.params.taskId);
  if (!projectId) return res.status(404).json({ error: "Không tìm thấy công việc" });
  const access = requireProjectAccess(req, res, projectId, "addProcess");
  if (!access) return;
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.taskId);
  // Công việc đã trễ hạn: chỉ Chủ dự án / Quản trị hệ thống được xoá — để
  // nhân viên không thể xoá bỏ bằng chứng trễ hạn trước khi họp / tính KPI.
  // (access.role đã là "owner" nếu người thao tác là super admin.)
  if (isTaskOverdue(task) && access.role !== "owner") {
    return res.status(403).json({
      error: "Công việc này đã trễ hạn — chỉ Chủ dự án mới được xoá, để giữ đúng dữ liệu làm căn cứ họp/KPI. Hãy báo Chủ dự án nếu cần xoá.",
    });
  }
  db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.taskId);
  res.json({ project: fullProject(projectId, access.role) });
});

/* ---------------- staff directory (nhân viên / Ban quản lý dự án) ---------------- */

// Thêm MỘT nhân viên HOÀN TOÀN MỚI (người chưa từng có hồ sơ trong hệ thống)
// — tạo hồ sơ 1 lần rồi tự động tích chọn luôn vào dự án đang mở. Với người
// ĐÃ CÓ hồ sơ sẵn ở dự án khác, dùng PUT ":id/staff-selection" để tích chọn
// thay vì gọi lại API này (tránh tạo trùng hồ sơ).
//
// Vẫn hỗ trợ cấp/liên kết tài khoản đăng nhập ngay lúc tạo:
//  1) Chỉ thêm vào danh bạ (mặc định) — không đăng nhập được.
//  2) grantLogin=true — admin cấp TÀI KHOẢN MỚI (SĐT + mật khẩu do admin đặt).
//  3) linkExistingPhone — liên kết với tài khoản đã đăng ký sẵn bằng SĐT.
router.post("/:id/staff", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "manageStaff");
  if (!access) return;
  const {
    name, position, department, email, phone,
    grantLogin, loginPhone, loginPassword,
    linkExistingPhone, role,
  } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Thiếu tên nhân viên" });

  let linkedUserId = "";

  if (linkExistingPhone) {
    const user = db.prepare("SELECT * FROM users WHERE phone = ?").get(normalizePhone(linkExistingPhone));
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy tài khoản nào đã đăng ký với số điện thoại này." });
    }
    linkedUserId = user.id;
    const already = getMembership(req.params.id, user.id);
    const finalRole = isKnownRole(role) && role !== "owner" ? role : "viewer";
    if (!already) {
      db.prepare(
        "INSERT INTO project_members (project_id, user_id, role, added_at) VALUES (?,?,?,?)"
      ).run(req.params.id, user.id, finalRole, Date.now());
    }
  } else if (grantLogin) {
    const rawPhone = loginPhone || phone;
    if (!rawPhone || !isValidVNPhone(rawPhone)) {
      return res.status(400).json({ error: "Số điện thoại cấp tài khoản không hợp lệ" });
    }
    if (!loginPassword || loginPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu cấp cho nhân viên cần tối thiểu 6 ký tự" });
    }
    const normalizedPhone = normalizePhone(rawPhone);
    let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(normalizedPhone);
    if (!user) {
      const uid = nanoid();
      db.prepare(
        "INSERT INTO users (id, phone, email, password_hash, name, is_approved, created_at) VALUES (?,?,?,?,?,?,?)"
      ).run(uid, normalizedPhone, (email && email.trim()) || null, hashPassword(loginPassword), name.trim(), 1, Date.now());
      user = { id: uid };
    }
    linkedUserId = user.id;
    const already = getMembership(req.params.id, user.id);
    const finalRole = isKnownRole(role) && role !== "owner" ? role : "viewer";
    if (!already) {
      db.prepare(
        "INSERT INTO project_members (project_id, user_id, role, added_at) VALUES (?,?,?,?)"
      ).run(req.params.id, user.id, finalRole, Date.now());
    }
  }

  const sid = nanoid();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO staff (id, project_id, name, position, department, email, phone, linked_user_id, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(sid, req.params.id, name.trim(), position || "", department || "", email || "", phone || "", linkedUserId, Date.now());
    // Tự động tích chọn vào dự án đang mở — người này ngay lập tức xuất hiện
    // trong danh sách nhân viên của dự án, không cần thêm thao tác nào khác.
    db.prepare(
      "INSERT INTO project_staff (project_id, staff_id, added_at) VALUES (?,?,?)"
    ).run(req.params.id, sid, Date.now());
  });
  tx();
  res.json({ project: fullProject(req.params.id, access.role) });
});

// Tích/bỏ tích hàng loạt: truyền TOÀN BỘ danh sách staffId đang muốn có mặt
// trong dự án này — hệ thống tự thêm những ID mới, bỏ những ID không còn
// trong danh sách. Đây là cách nhanh nhất để đưa người ĐÃ CÓ SẴN trong danh
// bạ công ty (tạo ở dự án khác, hoặc do người khác tạo) vào dự án này chỉ
// bằng cách tích chọn, không cần nhập lại tên/số điện thoại.
router.put("/:id/staff-selection", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "manageStaff");
  if (!access) return;
  const staffIds = Array.isArray(req.body?.staffIds) ? req.body.staffIds.filter(Boolean) : [];
  const current = db.prepare("SELECT staff_id FROM project_staff WHERE project_id = ?").all(req.params.id).map(r => r.staff_id);
  const currentSet = new Set(current);
  const nextSet = new Set(staffIds);
  const toAdd = staffIds.filter(id => !currentSet.has(id));
  const toRemove = current.filter(id => !nextSet.has(id));

  const tx = db.transaction(() => {
    const now = Date.now();
    for (const sid of toAdd) {
      db.prepare("INSERT OR IGNORE INTO project_staff (project_id, staff_id, added_at) VALUES (?,?,?)").run(req.params.id, sid, now);
    }
    for (const sid of toRemove) {
      db.prepare("DELETE FROM project_staff WHERE project_id = ? AND staff_id = ?").run(req.params.id, sid);
      db.prepare("UPDATE tasks SET assignee_staff_id = '' WHERE project_id = ? AND assignee_staff_id = ?").run(req.params.id, sid);
    }
  });
  tx();
  res.json({ project: fullProject(req.params.id, access.role) });
});

// Bỏ tích 1 người khỏi 1 dự án cụ thể (KHÔNG xoá hồ sơ khỏi hệ thống — người
// này vẫn còn trong danh bạ chung và ở các dự án khác họ đang tham gia).
router.delete("/:id/staff/:staffId", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id, "manageStaff");
  if (!access) return;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM project_staff WHERE project_id = ? AND staff_id = ?").run(req.params.id, req.params.staffId);
    db.prepare("UPDATE tasks SET assignee_staff_id = '' WHERE project_id = ? AND assignee_staff_id = ?").run(req.params.id, req.params.staffId);
  });
  tx();
  res.json({ project: fullProject(req.params.id, access.role) });
});

// Xoá VĨNH VIỄN 1 người khỏi toàn bộ danh bạ công ty (mọi dự án).
router.delete("/staff-directory/:staffId", (req, res) => {
  if (!requireCompanyStaffAccess(req, res)) return;
  const staff = db.prepare("SELECT id FROM staff WHERE id = ?").get(req.params.staffId);
  if (!staff) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
  const tx = db.transaction(() => {
    db.prepare("UPDATE tasks SET assignee_staff_id = '' WHERE assignee_staff_id = ?").run(req.params.staffId);
    db.prepare("DELETE FROM project_staff WHERE staff_id = ?").run(req.params.staffId);
    db.prepare("DELETE FROM staff WHERE id = ?").run(req.params.staffId);
  });
  tx();
  res.json({ ok: true });
});

router.patch("/staff/:staffId", (req, res) => {
  if (!requireCompanyStaffAccess(req, res)) return;
  const existing = db.prepare("SELECT id FROM staff WHERE id = ?").get(req.params.staffId);
  if (!existing) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
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
  const staff = db.prepare("SELECT * FROM staff WHERE id = ?").get(req.params.staffId);
  res.json({ staff: serializeStaff(staff) });
});

/* ---------------- liên kết Zalo cho nhân viên (nhắc việc) ---------------- */

// Sinh (hoặc lấy lại) mã liên kết 6 ký tự — nhân viên nhắn mã này cho Zalo OA
// của công ty để hệ thống tự động khớp zalo_id với đúng nhân viên.
router.post("/staff/:staffId/zalo-code", (req, res) => {
  if (!requireCompanyStaffAccess(req, res)) return;
  const staff = db.prepare("SELECT * FROM staff WHERE id = ?").get(req.params.staffId);
  if (!staff) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
  let code = staff.zalo_link_code;
  if (!code) {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
    db.prepare("UPDATE staff SET zalo_link_code = ? WHERE id = ?").run(code, req.params.staffId);
  }
  res.json({ code });
});

router.delete("/staff/:staffId/zalo-link", (req, res) => {
  if (!requireCompanyStaffAccess(req, res)) return;
  const staff = db.prepare("SELECT id FROM staff WHERE id = ?").get(req.params.staffId);
  if (!staff) return res.status(404).json({ error: "Không tìm thấy nhân viên" });
  db.prepare("UPDATE staff SET zalo_id = '', zalo_link_code = '' WHERE id = ?").run(req.params.staffId);
  res.json({ ok: true });
});

/* ---------------- báo cáo ngày / tuần ---------------- */

function computeProjectReport(projectId, range) {
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
  const soonLimit = new Date(Date.now() + (range === "week" ? 7 : 2) * 86400000).toISOString().slice(0, 10);

  const allTasks = db.prepare("SELECT * FROM tasks WHERE project_id = ?").all(projectId);
  const staffList = db.prepare("SELECT * FROM staff").all();
  const staffById = new Map(staffList.map(s => [s.id, s]));

  function labelFor(t) {
    if (t.assignee_staff_id && staffById.has(t.assignee_staff_id)) return staffById.get(t.assignee_staff_id).name;
    if (t.assignee) return t.assignee;
    return "Chưa gán";
  }
  function toItem(t) {
    return {
      id: t.id, title: t.title || "(chưa đặt tên)", status: t.status,
      assignee: labelFor(t), due: t.due_date || "", phase: t.phase,
      dueLocked: !!t.due_locked, note: t.progress_note || "",
    };
  }

  const updatedInRange = allTasks
    .filter(t => t.updated_at && t.updated_at >= rangeStart)
    .sort((a, b) => b.updated_at - a.updated_at)
    .map(t => ({ ...toItem(t), updatedAt: t.updated_at }));

  const doneInRange = updatedInRange.filter(t => t.status === "done");

  // Trễ hạn: rõ người phụ trách + đầu mục công việc
  const overdueList = allTasks
    .filter(t => t.due_date && t.status !== "done" && t.due_date < todayStr)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
    .map(toItem);

  // Đang thực hiện: toàn bộ việc status = doing, không phụ thuộc hạn — để biết rõ ai đang làm gì
  const inProgressList = allTasks
    .filter(t => t.status === "doing")
    .sort((a, b) => (a.due_date || "9999") < (b.due_date || "9999") ? -1 : 1)
    .map(toItem);

  // Dự kiến thực hiện: việc chưa xong, có hạn trong khoảng sắp tới (2 ngày cho báo cáo ngày, 7 ngày cho báo cáo tuần)
  const upcomingList = allTasks
    .filter(t => t.due_date && t.status !== "done" && t.due_date >= todayStr && t.due_date <= soonLimit)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
    .map(toItem);

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

  return {
    range,
    rangeStart,
    updatedTasks: updatedInRange,
    doneCount: doneInRange.length,
    doneList: doneInRange,
    overdueList,
    inProgressList,
    dueSoonList: upcomingList, // giữ tên cũ để tương thích ngược
    upcomingList,
    byStaff: Array.from(byStaffMap.values()).sort((a, b) => b.done - a.done),
  };
}

router.get("/:id/report", (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id);
  if (!access) return;
  const range = req.query.range === "week" ? "week" : "day";
  res.json(computeProjectReport(req.params.id, range));
});

router.get("/:id/report/export", async (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id);
  if (!access) return;
  const range = req.query.range === "week" ? "week" : "day";
  const format = req.query.format === "docx" ? "docx" : "pdf";
  const proj = db.prepare("SELECT name FROM projects WHERE id = ?").get(req.params.id);
  const data = computeProjectReport(req.params.id, range);
  try {
    const { buildProjectReportPdf, buildProjectReportDocx } = require("../export");
    const buffer = format === "docx"
      ? await buildProjectReportDocx(proj.name, range, data)
      : await buildProjectReportPdf(proj.name, range, data);
    const ext = format === "docx" ? "docx" : "pdf";
    const mime = format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="bao-cao-${range === "week" ? "tuan" : "ngay"}.${ext}"`);
    res.send(buffer);
  } catch (e) {
    console.error("[export] Lỗi xuất báo cáo:", e);
    res.status(500).json({ error: "Không tạo được file xuất báo cáo. Kiểm tra server đã cài đặt thư viện 'pdfkit' và 'docx' (npm install) chưa." });
  }
});

// Xuất TOÀN BỘ danh sách công việc (đầy đủ mọi cột) ra Word — dùng làm tài
// liệu cơ sở cho cuộc họp giao ban, khác với báo cáo ngày/tuần (chỉ tóm tắt).
router.get("/:id/export-detail", async (req, res) => {
  const access = requireProjectAccess(req, res, req.params.id);
  if (!access) return;
  const proj = fullProject(req.params.id, access.role);
  if (!proj) return res.status(404).json({ error: "Không tìm thấy dự án" });
  try {
    const { buildDetailedProjectDocx } = require("../export");
    const PHASE_LABELS = {
      CT: "Chủ trương đầu tư & Lựa chọn nhà đầu tư",
      QHDAT: "Quy hoạch & Đất đai",
      XD: "Chuẩn bị đầu tư xây dựng",
      THICONG: "Thi công & Nghiệm thu, bàn giao",
    };
    const groupsForDoc = proj.groups
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(g => ({ id: g.id, name: g.name, phaseLabel: PHASE_LABELS[g.phase] || g.phase }));
    const tasksForDoc = proj.tasks.map(t => ({
      group: t.group, title: t.title, unitDo: t.unitDo, unitCoord: t.unitCoord, duration: t.duration,
      legal: t.legal, status: t.progress.status, due: t.progress.due, dueLocked: t.progress.dueLocked,
      note: t.progress.note,
      assigneeName: t.progress.assigneeStaffId
        ? (proj.staff.find(s => s.id === t.progress.assigneeStaffId)?.name || "")
        : t.progress.assignee,
    }));
    const buffer = await buildDetailedProjectDocx(proj.name, groupsForDoc, tasksForDoc);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="chi-tiet-cong-viec.docx"`);
    res.send(buffer);
  } catch (e) {
    console.error("[export] Lỗi xuất báo cáo chi tiết:", e);
    res.status(500).json({ error: "Không tạo được file xuất báo cáo. Kiểm tra server đã cài đặt thư viện 'docx' (npm install) chưa." });
  }
});

module.exports = router;

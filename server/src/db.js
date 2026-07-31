const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "app.db");

const fs = require("fs");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_super_admin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor', -- 'owner' | 'editor' | 'process_editor' | 'name_editor' | 'viewer'
  added_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS groups_ (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  sort_order REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 2,
  title TEXT NOT NULL DEFAULT '',
  unit_do TEXT NOT NULL DEFAULT '',
  unit_coord TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  legal TEXT NOT NULL DEFAULT '',
  orig_note TEXT NOT NULL DEFAULT '',
  sort_order REAL NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'todo',
  assignee TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  progress_note TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at INTEGER,
  due_locked INTEGER NOT NULL DEFAULT 0,
  due_locked_by TEXT NOT NULL DEFAULT '',
  due_locked_at INTEGER
);

-- Danh bạ "nhân viên/Ban quản lý dự án" giờ dùng CHUNG cho toàn công ty —
-- staff.project_id chỉ còn ý nghĩa lịch sử (dự án tạo ra hồ sơ này lần đầu).
-- Việc 1 nhân viên có thuộc 1 dự án cụ thể hay không được quyết định bằng
-- bảng project_staff (tích chọn) bên dưới, để không phải nhập lại SĐT mỗi khi
-- thêm người vào dự án mới — chỉ cần tích chọn từ danh bạ đã có sẵn.
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  zalo_id TEXT NOT NULL DEFAULT '',
  zalo_link_code TEXT NOT NULL DEFAULT '',
  linked_user_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

-- Tích chọn: nhân viên nào (staff.id) thuộc dự án nào (project_id).
CREATE TABLE IF NOT EXISTS project_staff (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, staff_id)
);

-- Ghi lại các lần đã gửi nhắc việc qua Zalo, để không gửi trùng trong 1 ngày
CREATE TABLE IF NOT EXISTS reminder_log (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'due',
  sent_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(task_id, kind, sent_date)
);

-- Chat giữa các thành viên. room = 'global' (toàn công ty) hoặc project_id
-- (chat riêng của 1 dự án). Không mã hoá đầu-cuối — đây là chat nội bộ đơn
-- giản, không dùng cho thông tin nhạy cảm.
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_project ON groups_(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_project ON staff(project_id);
CREATE INDEX IF NOT EXISTS idx_staff_phone ON staff(phone);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room, created_at);
CREATE INDEX IF NOT EXISTS idx_project_staff_project ON project_staff(project_id);
CREATE INDEX IF NOT EXISTS idx_project_staff_staff ON project_staff(staff_id);
`);

// Safe migration for databases created before the "staff" feature existed:
// add the assignee_staff_id column to tasks if it isn't there yet.
const taskCols = db.prepare("PRAGMA table_info(tasks)").all().map((c) => c.name);
if (!taskCols.includes("assignee_staff_id")) {
  db.exec("ALTER TABLE tasks ADD COLUMN assignee_staff_id TEXT NOT NULL DEFAULT ''");
}

// Safe migration for staff created before Zalo linking existed.
const staffCols = db.prepare("PRAGMA table_info(staff)").all().map((c) => c.name);
if (!staffCols.includes("zalo_id")) {
  db.exec("ALTER TABLE staff ADD COLUMN zalo_id TEXT NOT NULL DEFAULT ''");
}
if (!staffCols.includes("zalo_link_code")) {
  db.exec("ALTER TABLE staff ADD COLUMN zalo_link_code TEXT NOT NULL DEFAULT ''");
}
if (!staffCols.includes("linked_user_id")) {
  db.exec("ALTER TABLE staff ADD COLUMN linked_user_id TEXT NOT NULL DEFAULT ''");
}

// Migration: databases created before "thêm nhân viên ở Trang chủ" existed
// had staff.project_id as NOT NULL. SQLite can't relax NOT NULL via ALTER,
// so rebuild the table when needed (dữ liệu cũ được giữ nguyên project_id).
// Tạo bảng mới rồi đổi tên (thay vì đổi tên bảng cũ trước) để tránh SQLite
// tự sửa định nghĩa khoá ngoại của project_staff trỏ nhầm sang bảng tạm.
const staffProjectIdInfo = db.prepare("PRAGMA table_info(staff)").all().find((c) => c.name === "project_id");
if (staffProjectIdInfo && staffProjectIdInfo.notnull) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    CREATE TABLE staff_new (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      zalo_id TEXT NOT NULL DEFAULT '',
      zalo_link_code TEXT NOT NULL DEFAULT '',
      linked_user_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    INSERT INTO staff_new SELECT * FROM staff;
    DROP TABLE staff;
    ALTER TABLE staff_new RENAME TO staff;
  `);
  db.pragma("foreign_keys = ON");
}

// Safe migration for databases created before due-date locking existed.
if (!taskCols.includes("due_locked")) {
  db.exec("ALTER TABLE tasks ADD COLUMN due_locked INTEGER NOT NULL DEFAULT 0");
  db.exec("ALTER TABLE tasks ADD COLUMN due_locked_by TEXT NOT NULL DEFAULT ''");
  db.exec("ALTER TABLE tasks ADD COLUMN due_locked_at INTEGER");
}

// Migration: databases created before phone-number login existed had
// users.email as UNIQUE NOT NULL and no phone column. SQLite can't relax a
// NOT NULL/UNIQUE constraint with ALTER TABLE, so rebuild the table when needed.
const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userCols.includes("phone")) {
  db.exec(`
    ALTER TABLE users RENAME TO users_old;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    INSERT INTO users (id, phone, email, password_hash, name, created_at)
      SELECT id, ('cần-cập-nhật-' || id), email, password_hash, name, created_at FROM users_old;
    DROP TABLE users_old;
  `);
  console.log(
    "[migration] Đã thêm số điện thoại đăng nhập. Tài khoản cũ có số điện thoại " +
    "tạm là 'cần-cập-nhật-<id>' — vào phần đổi thông tin cá nhân (hoặc DB) để cập nhật số thật."
  );
}

// Safe migration for databases created before "Quản trị hệ thống" (super admin) existed.
// Re-query columns here in case the block above just rebuilt the table.
const userColsNow = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColsNow.includes("is_super_admin")) {
  db.exec("ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0");
  // Gán quyền Quản trị hệ thống cho người dùng đầu tiên (theo ngày tạo) để hệ
  // thống luôn có ít nhất 1 người có quyền cao nhất sau khi nâng cấp.
  const first = db.prepare("SELECT id FROM users ORDER BY created_at ASC LIMIT 1").get();
  if (first) db.prepare("UPDATE users SET is_super_admin = 1 WHERE id = ?").run(first.id);
}

// Migration: databases created before "Ban quản lý dự án dùng chung" existed
// — mỗi nhân viên đã có sẵn chỉ gắn với đúng 1 dự án (project_id). Tự động
// tích chọn (project_staff) họ vào đúng dự án gốc đó để không mất phân công
// đã có, đồng thời từ nay có thể tích chọn thêm vào dự án khác mà không cần
// tạo lại hồ sơ / nhập lại số điện thoại.
const staffNeedingProjectStaff = db
  .prepare(
    `SELECT s.id, s.project_id FROM staff s
     LEFT JOIN project_staff ps ON ps.staff_id = s.id AND ps.project_id = s.project_id
     WHERE ps.staff_id IS NULL`
  )
  .all();
if (staffNeedingProjectStaff.length > 0) {
  const insertPS = db.prepare(
    "INSERT OR IGNORE INTO project_staff (project_id, staff_id, added_at) VALUES (?,?,?)"
  );
  const tx = db.transaction((rows) => {
    for (const r of rows) insertPS.run(r.project_id, r.id, Date.now());
  });
  tx(staffNeedingProjectStaff);
}

module.exports = db;

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

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_groups_project ON groups_(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_project ON staff(project_id);
CREATE INDEX IF NOT EXISTS idx_staff_phone ON staff(phone);
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

module.exports = db;

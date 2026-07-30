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
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
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
  role TEXT NOT NULL DEFAULT 'editor', -- 'owner' | 'editor' | 'viewer'
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
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_groups_project ON groups_(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON project_members(user_id);
`);

module.exports = db;

const TOKEN_KEY = "nam-app-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }

  if (!res.ok) {
    const message = (data && data.error) || `Lỗi ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (email, password, name) => request("POST", "/auth/register", { email, password, name }),
  login: (email, password) => request("POST", "/auth/login", { email, password }),
  me: () => request("GET", "/auth/me"),

  listProjects: () => request("GET", "/projects"),
  createProject: (name, seed) => request("POST", "/projects", { name, seed }),
  getProject: (id) => request("GET", `/projects/${id}`),
  renameProject: (id, name) => request("PATCH", `/projects/${id}`, { name }),
  deleteProject: (id) => request("DELETE", `/projects/${id}`),

  addMember: (id, email, role) => request("POST", `/projects/${id}/members`, { email, role }),
  removeMember: (id, userId) => request("DELETE", `/projects/${id}/members/${userId}`),

  addStaff: (projectId, data) => request("POST", `/projects/${projectId}/staff`, data),
  updateStaff: (staffId, patch) => request("PATCH", `/projects/staff/${staffId}`, patch),
  deleteStaff: (staffId) => request("DELETE", `/projects/staff/${staffId}`),

  getReport: (projectId, range) => request("GET", `/projects/${projectId}/report?range=${range}`),

  addGroup: (projectId, phase, name) => request("POST", `/projects/${projectId}/groups`, { phase, name }),
  renameGroup: (groupId, name) => request("PATCH", `/projects/groups/${groupId}`, { name }),
  deleteGroup: (groupId) => request("DELETE", `/projects/groups/${groupId}`),

  addTask: (groupId) => request("POST", `/projects/groups/${groupId}/tasks`),
  updateTaskField: (taskId, patch) => request("PATCH", `/projects/tasks/${taskId}`, patch),
  updateProgress: (taskId, patch) => request("PATCH", `/projects/tasks/${taskId}/progress`, patch),
  moveTask: (taskId, direction) => request("POST", `/projects/tasks/${taskId}/move`, { direction }),
  deleteTask: (taskId) => request("DELETE", `/projects/tasks/${taskId}`),
};

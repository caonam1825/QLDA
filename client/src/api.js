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
  register: (phone, password, name, email) => request("POST", "/auth/register", { phone, password, name, email }),
  login: (phone, password) => request("POST", "/auth/login", { phone, password }),
  me: () => request("GET", "/auth/me"),
  updateMe: (patch) => request("PATCH", "/auth/me", patch),
  changePassword: (currentPassword, newPassword) => request("POST", "/auth/change-password", { currentPassword, newPassword }),
  getMyZaloCode: () => request("POST", "/auth/zalo-code"),
  unlinkMyZalo: () => request("DELETE", "/auth/zalo-link"),

  adminResetPassword: (userId, newPassword) => request("POST", `/admin/users/${userId}/reset-password`, { newPassword }),

  listProjects: () => request("GET", "/projects"),
  createProject: (name, seed) => request("POST", "/projects", { name, seed }),
  getProject: (id) => request("GET", `/projects/${id}`),
  renameProject: (id, name) => request("PATCH", `/projects/${id}`, { name }),
  deleteProject: (id) => request("DELETE", `/projects/${id}`),

  addMember: (id, phone, role) => request("POST", `/projects/${id}/members`, { phone, role }),
  updateMemberRole: (id, userId, role) => request("PATCH", `/projects/${id}/members/${userId}`, { role }),
  removeMember: (id, userId) => request("DELETE", `/projects/${id}/members/${userId}`),

  addStaff: (projectId, data) => request("POST", `/projects/${projectId}/staff`, data),
  createCompanyStaff: (data) => request("POST", "/projects/staff-directory", data),
  getStaffDirectory: () => request("GET", "/projects/staff-directory"),
  setStaffSelection: (projectId, staffIds) => request("PUT", `/projects/${projectId}/staff-selection`, { staffIds }),
  untickStaff: (projectId, staffId) => request("DELETE", `/projects/${projectId}/staff/${staffId}`),
  deleteStaffPermanently: (staffId) => request("DELETE", `/projects/staff-directory/${staffId}`),
  updateStaff: (staffId, patch) => request("PATCH", `/projects/staff/${staffId}`, patch),
  getZaloCode: (staffId) => request("POST", `/projects/staff/${staffId}/zalo-code`),
  unlinkZalo: (staffId) => request("DELETE", `/projects/staff/${staffId}/zalo-link`),

  lockTaskDue: (taskId) => request("POST", `/projects/tasks/${taskId}/lock-due`),
  unlockTaskDue: (taskId) => request("POST", `/projects/tasks/${taskId}/unlock-due`),

  getReport: (projectId, range) => request("GET", `/projects/${projectId}/report?range=${range}`),
  getOverview: () => request("GET", "/reports/overview"),
  getKPI: () => request("GET", "/reports/kpi"),
  getMyTasks: () => request("GET", "/reports/my-tasks"),
  getByPerson: (key) => request("GET", `/reports/by-person?key=${encodeURIComponent(key)}`),

  adminListUsers: () => request("GET", "/admin/users"),
  adminSetSuperAdmin: (userId, value) => request("PATCH", `/admin/users/${userId}/super-admin`, { value }),
  adminApproveUser: (userId) => request("POST", `/admin/users/${userId}/approve`),
  adminRejectUser: (userId) => request("DELETE", `/admin/users/${userId}/reject`),
  adminDeleteUser: (userId) => request("DELETE", `/admin/users/${userId}`),

  getChatMessages: (room) => request("GET", `/chat/${room}/messages`),
  sendChatMessage: (room, body) => request("POST", `/chat/${room}/messages`, { body }),

  downloadFile: async (path, filename) => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api${path}`, { headers });
    if (!res.ok) {
      let msg = `Lỗi ${res.status}`;
      try { const data = await res.json(); if (data && data.error) msg = data.error; } catch (e) { /* empty */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  exportProjectReport: (projectId, range, format) =>
    api.downloadFile(`/projects/${projectId}/report/export?range=${range}&format=${format}`, `bao-cao-${range === "week" ? "tuan" : "ngay"}.${format}`),
  exportProjectDetail: (projectId) =>
    api.downloadFile(`/projects/${projectId}/export-detail`, "chi-tiet-cong-viec.docx"),
  exportOverview: (format) =>
    api.downloadFile(`/reports/overview/export?format=${format}`, `tong-hop-kpi.${format}`),

  addGroup: (projectId, phase, name) => request("POST", `/projects/${projectId}/groups`, { phase, name }),
  renameGroup: (groupId, name) => request("PATCH", `/projects/groups/${groupId}`, { name }),
  deleteGroup: (groupId) => request("DELETE", `/projects/groups/${groupId}`),

  addTask: (groupId) => request("POST", `/projects/groups/${groupId}/tasks`),
  updateTaskField: (taskId, patch) => request("PATCH", `/projects/tasks/${taskId}`, patch),
  updateProgress: (taskId, patch) => request("PATCH", `/projects/tasks/${taskId}/progress`, patch),
  bulkUpdateGroupProgress: (groupId, patch) => request("PATCH", `/projects/groups/${groupId}/bulk-progress`, patch),
  bulkUpdatePhaseProgress: (projectId, phaseKey, patch) => request("PATCH", `/projects/${projectId}/phases/${phaseKey}/bulk-progress`, patch),
  moveTask: (taskId, direction) => request("POST", `/projects/tasks/${taskId}/move`, { direction }),
  deleteTask: (taskId) => request("DELETE", `/projects/tasks/${taskId}`),
};

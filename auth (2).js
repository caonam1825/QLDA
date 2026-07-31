// Hệ thống phân quyền theo vai trò (role) trong project_members.role.
//
//   owner          Chủ dự án — toàn quyền, gồm cả mời/xoá thành viên, xoá dự
//                   án, khoá/mở khoá hạn hoàn thành.
//   editor         Toàn quyền chỉnh sửa nội dung + tiến độ + thêm/xoá bước,
//                   nhưng không quản trị thành viên/dự án.
//   process_editor  "Thêm quy trình" — chỉ được thêm/xoá/sắp xếp lại nhóm bước
//                   và đầu việc (cấu trúc quy trình), KHÔNG được sửa nội dung
//                   từng đầu việc, KHÔNG được cập nhật tiến độ (trạng thái,
//                   người phụ trách, hạn).
//   name_editor     "Chỉ sửa tên" — chỉ được sửa tên/nội dung của đầu việc đã
//                   có sẵn (title, đơn vị, ghi chú...), không thêm/xoá bước,
//                   không cập nhật tiến độ.
//   viewer          Chỉ xem, không chỉnh sửa gì.
//
// Ngoài ra: bất kỳ người dùng đã đăng nhập nào cũng được XEM (view) mọi dự án
// trong hệ thống dù không phải thành viên chính thức (xem requireProjectAccess
// trong routes/projects.js) — chỉ riêng quyền chỉnh sửa mới cần đúng vai trò.

const ROLE_PERMS = {
  owner: { editTaskFields: true, editProgress: true, addProcess: true, manageStaff: true, manageMembers: true, manageProject: true, manageLock: true },
  editor: { editTaskFields: true, editProgress: true, addProcess: true, manageStaff: true, manageMembers: false, manageProject: false, manageLock: false },
  process_editor: { editTaskFields: false, editProgress: false, addProcess: true, manageStaff: false, manageMembers: false, manageProject: false, manageLock: false },
  name_editor: { editTaskFields: true, editProgress: false, addProcess: false, manageStaff: false, manageMembers: false, manageProject: false, manageLock: false },
  viewer: { editTaskFields: false, editProgress: false, addProcess: false, manageStaff: false, manageMembers: false, manageProject: false, manageLock: false },
};

const ROLE_LABELS = {
  owner: "Chủ dự án",
  editor: "Chỉnh sửa toàn quyền",
  process_editor: "Chỉ thêm quy trình",
  name_editor: "Chỉ sửa tên đầu việc",
  viewer: "Chỉ xem",
};

function permsFor(role) {
  return ROLE_PERMS[role] || ROLE_PERMS.viewer;
}

function isKnownRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLE_PERMS, role);
}

module.exports = { ROLE_PERMS, ROLE_LABELS, permsFor, isKnownRole };

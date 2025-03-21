const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const timelineController = require("../controllers/timelineController");
const projectController = require("../controllers/projectController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeAdmin = require("../middleware/adminMiddleware");


// ✅ Đăng nhập
router.post("/login", authController.login);

// ✅ Lấy thông tin người dùng
router.get("/me", authenticateToken, authController.getUserInfo);

router.put("/update-profile", authenticateToken, authController.updateProfile);
// ✅ Đổi mật khẩu người dùng
router.put("/change-password", authenticateToken, authController.changePassword);

// ✅ Lấy roles của user 
router.get("/user-roles/:userId", authenticateToken, authController.getUserRoles);


// Timeline routes
router.get("/timeline/tasks", authenticateToken, timelineController.getAllTasks);
router.post("/timeline/tasks", authenticateToken, timelineController.createTask);
router.post("/timeline/tasks/batch", authenticateToken, timelineController.updateBatchTasks);
router.delete("/timeline/tasks/:id", authenticateToken, timelineController.deleteTask);

// Project routes
router.post("/projects", authenticateToken, projectController.createProject);
router.get("/projects", authenticateToken, projectController.getUserProjects);
router.delete("/projects/:id", authenticateToken, projectController.deleteProject);
router.get("/projects/tasks", authenticateToken, timelineController.getTasksByAccount);
router.put("/projects/:id", authenticateToken, projectController.updateProject);

// ✅ --- Quản lý tài khoản (Chỉ Admin) ---
router.use(authenticateToken, authorizeAdmin);

// 🔹 Lấy danh sách tài khoản
router.get("/users", authController.getAllUsers);

router.get("/roles", authController.getAllRoles);

// 🔹 Thêm tài khoản mới
router.post("/users", authController.createUser);

// 🔹 Chỉnh sửa thông tin tài khoản
router.put("/users/:id", authController.updateUser);

// 🔹 Đổi mật khẩu tài khoản
router.put("/users/:id/change-password", authController.changeUserPassword);

// 🔹 Xóa tài khoản
router.delete("/users/:id", authController.deleteUser);



module.exports = router;

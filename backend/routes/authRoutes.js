const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeAdmin = require("../middleware/adminMiddleware");

// ✅ Đăng nhập
router.post("/login", authController.login);

// ✅ Lấy thông tin người dùng
router.get("/me", authenticateToken, authController.getUserInfo);

router.put("/update-profile", authenticateToken, authController.updateProfile);
// ✅ Đổi mật khẩu người dùng
router.put("/change-password", authenticateToken, authController.changePassword);

// ✅ --- Quản lý tài khoản (Chỉ Admin) ---
router.use(authenticateToken, authorizeAdmin);

// 🔹 Lấy danh sách tài khoản
router.get("/users", authController.getAllUsers);

// 🔹 Thêm tài khoản mới
router.post("/users", authController.createUser);

// 🔹 Chỉnh sửa thông tin tài khoản
router.put("/users/:id", authController.updateUser);

// 🔹 Đổi mật khẩu tài khoản
router.put("/users/:id/change-password", authController.changeUserPassword);

// 🔹 Xóa tài khoản
router.delete("/users/:id", authController.deleteUser);

module.exports = router;

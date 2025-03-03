const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeAdmin = require("../middleware/adminMiddleware");

// Tất cả routes đều cần xác thực
router.use(authenticateToken);

// Routes cho admin
router.use(authorizeAdmin);

// Lấy danh sách danh mục
router.get("/", categoryController.getAllCategories);

// Thêm danh mục mới
router.post("/", categoryController.createCategory);

// Cập nhật danh mục
router.put("/:id", categoryController.updateCategory);

// Xóa danh mục
router.delete("/:id", categoryController.deleteCategory);

module.exports = router; 
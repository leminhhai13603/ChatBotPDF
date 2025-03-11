const express = require("express");
const router = express.Router();
const multer = require("multer");
const categoryController = require("../controllers/categoryController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeAdmin = require("../middleware/adminMiddleware");

// Cấu hình multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 
    }
});

// Tất cả routes đều cần xác thực
router.use(authMiddleware);

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

// Thêm routes mới cho danh mục con
router.get('/khong-gian-chung/sub', categoryController.getSubCategories);
router.get('/khong-gian-chung/sub/:subCategory', categoryController.getPDFsByCategory);

// Route upload file vào danh mục
router.post(
    '/khong-gian-chung/upload',
    upload.single('pdf'),
    categoryController.uploadPDFToCategory
);

module.exports = router; 
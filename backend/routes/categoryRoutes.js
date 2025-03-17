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
// Lấy danh sách danh mục con của Không gian chung
router.get('/khong-gian-chung/sub', categoryController.getSubCategories);

// Lấy danh sách PDF theo danh mục con
router.get('/khong-gian-chung/sub/:subCategory', categoryController.getPDFsByCategory);

// Upload file vào danh mục con
router.post(
    '/khong-gian-chung/upload',
    upload.single('file'),
    categoryController.uploadPDFToCategory
);

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
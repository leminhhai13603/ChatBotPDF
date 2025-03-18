const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const authenticateToken = require("../middleware/authMiddleware");

router.use(authenticateToken);

// Tạo dự án mới
router.post("/", projectController.createProject);

// Lấy tất cả dự án của user
router.get("/", projectController.getUserProjects);

// Xóa dự án
router.delete("/:id", projectController.deleteProject);

module.exports = router; 
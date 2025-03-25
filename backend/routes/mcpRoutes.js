const express = require('express');
const router = express.Router();
const mcpController = require('../controllers/mcpController');
const authMiddleware = require('../middleware/authMiddleware');

// Áp dụng middleware xác thực cho tất cả routes
router.use(authMiddleware);

// Tìm kiếm PDF bằng MCP
router.post("/search", mcpController.searchPDF);

// Thêm các routes khác nếu cần

module.exports = router; 
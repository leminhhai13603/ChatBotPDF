const express = require("express");
const multer = require("multer");
const pdfController = require("../controllers/pdfController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Thêm middleware xác thực cho tất cả routes
router.use(authenticateToken);

// Định nghĩa các routes
router.post("/upload", upload.single("pdf"), pdfController.uploadPDF);
router.get("/list", pdfController.getAllPDFs);
router.post("/search", pdfController.searchPDF);
router.delete("/delete/:id", pdfController.deletePDF);

// Thêm routes mới cho lịch sử hội thoại
router.get("/chat-history", pdfController.getChatHistory);
router.delete("/chat-history", pdfController.clearChatHistory);

// Thêm route để tái xử lý PDF đã tải lên
router.post("/reprocess/:id", pdfController.reprocessPDF);

module.exports = router;

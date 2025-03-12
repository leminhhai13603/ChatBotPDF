const express = require("express");
const multer = require("multer");
const pdfController = require("../controllers/pdfController");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

router.post("/upload", upload.single("pdf"), pdfController.uploadPDF);
router.get("/list", pdfController.getAllPDFs);
router.post("/search", pdfController.searchPDF);
router.delete("/delete/:id", pdfController.deletePDF);

router.get("/chat-history", pdfController.getChatHistory);
router.delete("/chat-history", pdfController.clearChatHistory);

router.post("/reprocess/:id", pdfController.reprocessPDF);

router.get("/details/:id", pdfController.getPDFDetails);
router.get("/category/:categoryId?", pdfController.getPDFsByCategory);

router.get("/tables/:id", pdfController.getPDFTables);

module.exports = router;

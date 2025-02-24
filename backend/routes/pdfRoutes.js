const express = require("express");
const multer = require("multer");
const { uploadPDF, searchPDF, getPDFs, deletePDF } = require("../controllers/pdfController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("pdf"), uploadPDF);
router.post("/search", searchPDF);
router.get("/list", getPDFs);
router.delete("/delete/:id", deletePDF);

module.exports = router;

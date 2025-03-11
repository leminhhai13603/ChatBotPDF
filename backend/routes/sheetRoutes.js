const express = require('express');
const router = express.Router();
const sheetController = require('../controllers/sheetController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/spreadsheets', sheetController.getAllSpreadsheets);
router.get('/spreadsheet/:id', sheetController.getSpreadsheetData);
router.get('/spreadsheet/:id/metadata', sheetController.getSpreadsheetMetadata);

module.exports = router; 
const googleSheetService = require('../services/googleSheetService');

exports.getAllSpreadsheets = async (req, res) => {
    try {
        const spreadsheets = await googleSheetService.getAllSpreadsheets();
        if (!spreadsheets || spreadsheets.length === 0) {
            return res.json([]);
        }
        res.json(spreadsheets);
    } catch (error) {
        console.error('Lỗi chi tiết:', error);
        res.status(500).json({ 
            error: 'Không thể lấy danh sách spreadsheets',
            details: error.message 
        });
    }
};

exports.getSpreadsheetData = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await googleSheetService.getSheetData(id);
        
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Không có dữ liệu' });
        }

        res.json({ data });
    } catch (error) {
        console.error('Controller - Error:', error);
        res.status(500).json({ 
            error: 'Không thể lấy dữ liệu spreadsheet',
            details: error.message
        });
    }
};

exports.getSpreadsheetMetadata = async (req, res) => {
    try {
        const { id } = req.params;
        const metadata = await googleSheetService.getSheetMetadata(id);
        if (!metadata) {
            return res.status(404).json({ error: 'Không tìm thấy spreadsheet' });
        }
        res.json(metadata);
    } catch (error) {
        console.error('Lỗi khi lấy metadata:', error);
        res.status(500).json({ 
            error: 'Không thể lấy metadata',
            details: error.message 
        });
    }
}; 
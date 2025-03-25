const mcpClient = require('../services/mcp/mcpClient');
const chatModel = require('../models/chatModel');
const pdfModel = require('../models/pdfModel');

exports.searchPDF = async (req, res) => {
  try {
    const { query, pdfId } = req.body;
    const userId = req.user?.id;

    console.log("🔍 Tìm kiếm PDF với MCP:", { query, pdfId, userId });

    // Sử dụng MCP client để tìm kiếm
    const answer = await mcpClient.searchPDF(query, pdfId);

    // Lưu lịch sử chat nếu có userId
    if (userId) {
      try {
        let source = "MCP";
        
        if (pdfId) {
          // Lấy tên PDF nếu có pdfId
          const pdf = await pdfModel.getPDFById(pdfId);
          if (pdf) {
            source = pdf.pdf_name;
          }
        }
        
        await chatModel.saveChatHistory(userId, query, answer, source);
        console.log("✅ Đã lưu lịch sử chat");
      } catch (chatError) {
        console.error("⚠️ Lỗi khi lưu lịch sử chat:", chatError);
        // Không ảnh hưởng đến response nếu lưu lịch sử thất bại
      }
    }

    res.json({ answer });
  } catch (error) {
    console.error("❌ Lỗi khi tìm kiếm với MCP:", error);
    res.status(500).json({ 
      error: "Lỗi khi tìm kiếm",
      details: error.message
    });
  }
};

// Thêm các phương thức khác nếu cần 
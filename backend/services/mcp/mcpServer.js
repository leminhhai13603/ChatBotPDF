const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const mcpConfig = require('../../config/mcp-config');
const mcpTools = require('./mcpTools');
const { v4: uuidv4 } = require('uuid');

/**
 * Tạo một instance của MCP Server
 * @returns {McpServer} Instance của MCP Server với đầy đủ resources, tools và prompts
 */
const createServer = () => {
  // Khởi tạo server với thông tin cấu hình
  const server = new McpServer({
    name: mcpConfig.serverName,
    version: mcpConfig.serverVersion
  });

  // Đăng ký resources - cho phép LLM truy cập dữ liệu
  mcpTools.registerResources(server);
  
  // Đăng ký tools - cho phép LLM thực hiện hành động
  mcpTools.registerTools(server);
  
  // Đăng ký prompts - cho phép LLM sử dụng mẫu câu
  mcpTools.registerPrompts(server);

  console.log(`✅ MCP Server đã được khởi tạo: ${mcpConfig.serverName} v${mcpConfig.serverVersion}`);
  return server;
};

// Tạo lưu trữ memory đơn giản
const conversationMemory = new Map();

const app = require('express')();

app.post("/api/pdf/query", async (req, res) => {
  try {
    const { query, pdfId } = req.body;
    const sessionId = req.headers['session-id'] || uuidv4();
    
    // Lấy lịch sử hội thoại hoặc tạo mới nếu chưa có
    if (!conversationMemory.has(sessionId)) {
      conversationMemory.set(sessionId, []);
    }
    
    const conversation = conversationMemory.get(sessionId);
    
    // Thêm câu hỏi mới vào context
    conversation.push({ role: "user", content: query });
    
    // Sử dụng context trong quá trình tìm kiếm
    const result = await mcpTools.searchPDF(query, pdfId, conversation);
    
    // Lưu câu trả lời vào context
    conversation.push({ role: "assistant", content: result });
    
    // Giữ context không quá dài (giữ 10 tin nhắn gần nhất)
    if (conversation.length > 20) {
      conversation.splice(0, 2);
    }
    
    // Trả về session ID để client lưu
    res.setHeader('session-id', sessionId);
    res.json({ answer: result });
  } catch (error) {
    // xử lý lỗi
  }
});

module.exports = { createServer }; 
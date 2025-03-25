/**
 * Cấu hình cho Model Context Protocol Server
 */
module.exports = {
  // Port của MCP Server
  serverPort: process.env.MCP_SERVER_PORT || 8080,
  
  // URL của MCP Server để client kết nối
  serverUrl: process.env.MCP_SERVER_URL || 'http://localhost:8080',
  
  // Thông tin cơ bản của server
  serverName: "ChatBotPDF-MCP",
  serverVersion: "1.0.0",
  
  // Cấu hình timeout (ms)
  requestTimeout: 60000, // 60 giây
  fileProcessingTimeout: 120000, // 2 phút
  
  // Giới hạn kích thước file (bytes)
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Model mặc định sử dụng
  defaultModel: "gemini-2.0-pro"
}; 
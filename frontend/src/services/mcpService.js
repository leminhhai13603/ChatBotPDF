import axios from 'axios';

// Sử dụng URL từ biến môi trường hoặc mặc định
const MCP_SERVER_URL = process.env.REACT_APP_MCP_SERVER_URL || 'http://localhost:8080';

class MCPService {
  constructor() {
    this.baseUrl = MCP_SERVER_URL;
  }

  async searchPDF(query, pdfId = null) {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Bạn cần đăng nhập để sử dụng tính năng này");
      }

      let sessionId = localStorage.getItem('mcp-session-id') || null;

      const headers = {
        Authorization: `Bearer ${token}`,
        'session-id': sessionId
      };

      const response = await axios.post(`${this.baseUrl}/api/pdf/query`, {
        query,
        pdfId
      }, { headers });
      
      // Lưu session ID mới nếu có
      const newSessionId = response.headers['session-id'];
      if (newSessionId) {
        sessionId = newSessionId;
        localStorage.setItem('mcp-session-id', sessionId);
      }
      
      return response.data.answer;
    } catch (error) {
      console.error("❌ Lỗi khi tìm kiếm qua MCP:", error);
      throw error;
    }
  }

  async createEmbedding(text) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/embedding`, { text });
      return response.data.embedding;
    } catch (error) {
      console.error("❌ Lỗi khi tạo embedding qua MCP:", error);
      throw error;
    }
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      return response.status === 200;
    } catch (error) {
      console.error("❌ MCP Server không hoạt động:", error);
      return false;
    }
  }
}

export default new MCPService(); 
const axios = require('axios');
const mcpConfig = require('../../config/mcp-config');

class MCPClient {
  constructor() {
    this.mcpClient = null;
    this.mcpUrl = mcpConfig.serverUrl;
    this.connected = false;
  }

  async connect() {
    try {
      const response = await axios.get(`${this.mcpUrl}/health`);
      if (response.status === 200) {
        console.log("✅ Đã kết nối thành công đến MCP Server");
        this.connected = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error("❌ Lỗi kết nối MCP Server:", error.message);
      this.connected = false;
      return false;
    }
  }

  async searchPDF(query, pdfId = null) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const payload = {
        query,
        ...(pdfId ? { pdfId } : {})
      };

      console.log(`🔍 MCP Client gửi yêu cầu tìm kiếm đến ${this.mcpUrl}/api/pdf/query`);
      const response = await axios.post(`${this.mcpUrl}/api/pdf/query`, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 
      });

      console.log("✅ Nhận phản hồi từ MCP Server");
      return response.data.answer;
    } catch (error) {
      console.error("❌ Lỗi khi tìm kiếm qua MCP:", error.message);
      throw new Error(`MCP search failed: ${error.message}`);
    }
  }

  async getEmbedding(text) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const response = await axios.post(`${this.mcpUrl}/api/embedding`, { text }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data.embedding;
    } catch (error) {
      console.error("❌ Lỗi khi tạo embedding qua MCP:", error.message);
      throw new Error(`MCP embedding failed: ${error.message}`);
    }
  }

  async processFile(fileBuffer, mimeType, query) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      // Chuyển buffer thành base64
      const base64Data = fileBuffer.toString('base64');
      
      const payload = {
        file: {
          data: base64Data,
          mimeType: mimeType
        },
        query: query
      };
      
      const response = await axios.post(`${this.mcpUrl}/api/process-file`, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 phút cho xử lý file
      });
      
      return response.data.answer;
    } catch (error) {
      console.error("❌ Lỗi khi xử lý file qua MCP:", error.message);
      throw new Error(`MCP file processing failed: ${error.message}`);
    }
  }

  async getPrompt(promptName, args) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const response = await axios.post(`${this.mcpUrl}/api/prompt`, {
        name: promptName,
        arguments: args
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data.prompt;
    } catch (error) {
      console.error(`❌ Lỗi khi lấy prompt ${promptName}:`, error.message);
      throw new Error(`MCP prompt fetch failed: ${error.message}`);
    }
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.mcpUrl}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error("❌ MCP Server không hoạt động:", error.message);
      return false;
    }
  }
}

module.exports = new MCPClient(); 
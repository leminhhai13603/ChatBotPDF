const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { createServer } = require('./services/mcp/mcpServer');
const mcpTools = require('./services/mcp/mcpTools');
const geminiService = require('./services/geminiService');
const mcpConfig = require('./config/mcp-config');
require('dotenv').config();

// Khởi tạo Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));

// Khởi tạo MCP Server
const server = createServer();

// Lưu danh sách các kết nối SSE
const sseConnections = new Map();

// Endpoint SSE cho MCP
app.get("/mcp/sse", async (req, res) => {
  try {
    // Thiết lập header cho SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Tạo ID cho kết nối SSE
    const connectionId = req.query.id || `connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔄 Khởi tạo kết nối SSE: ${connectionId}`);
    
    // Tạo transport và kết nối MCP Server
    const transport = new SSEServerTransport(`/mcp/messages?id=${connectionId}`, res);
    await server.connect(transport);
    
    // Lưu transport vào danh sách
    sseConnections.set(connectionId, transport);
    
    // Xử lý khi kết nối bị đóng
    res.on('close', () => {
      console.log(`❌ Kết nối SSE đã đóng: ${connectionId}`);
      sseConnections.delete(connectionId);
    });
  } catch (error) {
    console.error("❌ Lỗi khởi tạo SSE:", error);
    res.status(500).end();
  }
});

// Endpoint nhận các message từ client
app.post("/mcp/messages", express.json(), async (req, res) => {
  try {
    const connectionId = req.query.id;
    if (!connectionId || !sseConnections.has(connectionId)) {
      return res.status(400).json({ 
        error: "Invalid connection ID",
        message: "Không tìm thấy kết nối SSE tương ứng" 
      });
    }
    
    // Lấy transport tương ứng
    const transport = sseConnections.get(connectionId);
    await transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("❌ Lỗi xử lý message:", error);
    res.status(500).json({ error: error.message });
  }
});

// API không sử dụng SSE - Hỗ trợ các client không hỗ trợ SSE
app.post("/api/pdf/query", async (req, res) => {
  try {
    const { query, pdfId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query không được để trống" });
    }
    
    // Sử dụng trực tiếp mcpTools thay vì server.callTool
    const result = await mcpTools.searchPDF(query, pdfId);
    
    res.json({ answer: result });
  } catch (error) {
    console.error("❌ Lỗi khi xử lý query:", error);
    res.status(500).json({ error: error.message });
  }
});

// API tạo embedding
app.post("/api/embedding", async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Text không được để trống" });
    }
    
    // Sử dụng geminiService trực tiếp
    const embedding = await geminiService.createEmbedding(text);
    
    res.json({ embedding });
  } catch (error) {
    console.error("❌ Lỗi khi tạo embedding:", error);
    res.status(500).json({ error: error.message });
  }
});

// API xử lý file
app.post("/api/process-file", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { file, query } = req.body;
    
    if (!file || !file.data || !file.mimeType || !query) {
      return res.status(400).json({ error: "Thiếu thông tin file hoặc query" });
    }
    
    // Xử lý file trực tiếp bằng Gemini
    const buffer = Buffer.from(file.data, 'base64');
    const model = geminiService.model;
    
    const parts = [
      { text: query },
      { 
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      }
    ];
    
    const result = await model.generateContent({ contents: [{ parts }] });
    const answer = result.response.text();
    
    res.json({ answer });
  } catch (error) {
    console.error("❌ Lỗi khi xử lý file:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: "ok",
    serverName: mcpConfig.serverName,
    version: mcpConfig.serverVersion,
    timestamp: new Date().toISOString()
  });
});

// Khởi động MCP server
const PORT = mcpConfig.serverPort;
app.listen(PORT, () => {
  console.log(`🚀 MCP Server đang chạy tại http://localhost:${PORT}`);
  console.log(`✅ SSE endpoint: http://localhost:${PORT}/mcp/sse`);
  console.log(`✅ Message endpoint: http://localhost:${PORT}/mcp/messages`);
  console.log(`✅ Direct API: http://localhost:${PORT}/api/pdf/query`);
}); 
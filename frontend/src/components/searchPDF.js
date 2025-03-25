import React, { useState, useEffect } from "react";
import Chatbot from "react-chatbot-kit";
import "react-chatbot-kit/build/main.css";
import config from "../chatbot/config";
import MessageParser from "../chatbot/MessageParser";
import ActionProvider from "../chatbot/ActionProvider";
import "../css/chatbot.css";
import mcpService from "../services/mcpService";

const SearchPDF = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [useMcp, setUseMcp] = useState(true);
  const [mcpAvailable, setMcpAvailable] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
    
    // Kiểm tra MCP server có hoạt động không
    const checkMcpServer = async () => {
      try {
        const available = await mcpService.checkHealth();
        setMcpAvailable(available);
        // Nếu không khả dụng, chuyển về tìm kiếm thông thường
        if (!available) {
          setUseMcp(false);
        }
      } catch (error) {
        console.error("Không thể kết nối đến MCP server:", error);
        setMcpAvailable(false);
        setUseMcp(false);
      }
    };
    
    checkMcpServer();
  }, []);

  const toggleMcpMode = () => {
    setUseMcp(prev => !prev);
  };

  if (!isAuthenticated) {
    return (
      <div className="chat-section">
        <div className="auth-warning">
          <h3>⚠️ Bạn cần đăng nhập</h3>
          <p>Vui lòng đăng nhập để sử dụng tính năng tìm kiếm.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-section">
      {mcpAvailable && (
        <div className="mcp-toggle">
          <label className="switch">
            <input 
              type="checkbox" 
              checked={useMcp} 
              onChange={toggleMcpMode}
            />
            <span className="slider round"></span>
          </label>
          <span className="toggle-label">
            {useMcp ? "Đang sử dụng MCP 🔍" : "Đang sử dụng tìm kiếm thông thường 🔎"}
          </span>
        </div>
      )}
      
      <Chatbot
        config={config}
        messageParser={MessageParser}
        actionProvider={ActionProvider}
        headerText="Trợ lý tìm kiếm PDF"
        placeholderText="Nhập câu hỏi của bạn..."
        actionProviderProps={{ useMcp }}
      />
    </div>
  );
};

export default SearchPDF;

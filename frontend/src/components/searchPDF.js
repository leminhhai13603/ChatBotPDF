import React, { useState, useEffect } from "react";
import Chatbot from "react-chatbot-kit";
import "react-chatbot-kit/build/main.css";
import config from "../chatbot/config";
import MessageParser from "../chatbot/MessageParser";
import ActionProvider from "../chatbot/ActionProvider";
import "../css/chatbot.css";

const SearchPDF = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, []);

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
      <Chatbot
        config={config}
        messageParser={MessageParser}
        actionProvider={ActionProvider}
        headerText="Trợ lý tìm kiếm PDF"
        placeholderText="Nhập câu hỏi của bạn..."
      />
    </div>
  );
};

export default SearchPDF;

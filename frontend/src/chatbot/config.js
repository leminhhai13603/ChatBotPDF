import { createChatBotMessage } from "react-chatbot-kit";
import React from "react";

// Widget hiển thị kết quả từ database
const DatabaseWidget = (props) => {
  return (
    <div className="database-result">
      <div className="source-badge">📄 Kết quả từ tài liệu</div>
      <div className="result-content">{props.message}</div>
    </div>
  );
};

// Widget hiển thị kết quả từ AI
const AIWidget = (props) => {
  return (
    <div className="ai-result">
      <div className="source-badge">🤖 Kết quả từ AI</div>
      <div className="result-content">{props.message}</div>
    </div>
  );
};

const config = {
  botName: "Chatbot PDF",
  initialMessages: [
    createChatBotMessage("Xin chào! Tôi có thể giúp bạn tìm kiếm thông tin trong các tài liệu PDF. Bạn muốn tìm gì?"),
    createChatBotMessage("Gõ 'help' hoặc 'hướng dẫn' để xem cách sử dụng."),
  ],
  customStyles: {
    botMessageBox: {
      backgroundColor: "#376B7E",
      fontSize: "16px",
      padding: "12px",
    },
    chatButton: {
      backgroundColor: "#5ccc9d",
    },
  },
  widgets: [
    {
      widgetName: "📄 Database",
      widgetFunc: (props) => <DatabaseWidget {...props} />,
    },
    {
      widgetName: "🤖 AI",
      widgetFunc: (props) => <AIWidget {...props} />,
    },
  ],
  customComponents: {
    header: () => (
      <div className="chatbot-header">
        <h3>Trợ lý tìm kiếm PDF</h3>
      </div>
    ),
  },
};

export default config;

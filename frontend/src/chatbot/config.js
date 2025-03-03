import { createChatBotMessage } from "react-chatbot-kit";
import React from "react";

const DatabaseWidget = (props) => {
  return (
    <div className="database-result">
      <div className="source-badge">
        <span className="icon">📄</span>
        <span className="text">Kết quả từ tài liệu</span>
      </div>
      <div className="result-content">{props.message}</div>
    </div>
  );
};

const AIWidget = (props) => {
  return (
    <div className="ai-result">
      <div className="source-badge">
        <span className="icon">🤖</span>
        <span className="text">Kết quả từ AI</span>
      </div>
      <div className="result-content">{props.message}</div>
    </div>
  );
};

const config = {
  botName: "PDF Assistant",
  initialMessages: [
    createChatBotMessage(
      "Xin chào! 👋 Tôi là trợ lý tìm kiếm thông minh. Tôi có thể giúp bạn:",
      {
        widget: "features",
        delay: 500,
      }
    ),
    createChatBotMessage(
      "Hãy cho tôi biết bạn muốn tìm gì nhé! 🔍",
      {
        delay: 1000,
      }
    ),
  ],
  customStyles: {
    botMessageBox: {
      backgroundColor: "#376B7E",
    },
    chatButton: {
      backgroundColor: "#5ccc9d",
    },
  },
  widgets: [
    {
      widgetName: "📄 Database",
      widgetFunc: (props) => <DatabaseWidget {...props} />,
      mapStateToProps: ["messages"],
    },
    {
      widgetName: "🤖 AI",
      widgetFunc: (props) => <AIWidget {...props} />,
      mapStateToProps: ["messages"],
    },
    {
      widgetName: "features",
      widgetFunc: () => (
        <div className="features-list">
          <ul>
            <li>📄 Tìm kiếm trong tài liệu PDF</li>
            <li>💡 Trả lời câu hỏi thông minh</li>
            <li>📝 Tóm tắt nội dung quan trọng</li>
          </ul>
        </div>
      ),
    },
  ],
  customComponents: {
    header: () => (
      <div className="chatbot-header">
        <h3>
          <span className="icon">🤖</span>
          Trợ lý tìm kiếm PDF
        </h3>
      </div>
    ),
  },
};

export default config;

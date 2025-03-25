import { createChatBotMessage } from "react-chatbot-kit";
import React from "react";
import ReactMarkdown from 'react-markdown';

const DatabaseWidget = (props) => {
  // Đơn giản hóa: Lấy tất cả tin nhắn có widget "📄 Database"
  const relevantMessages = props.messages.filter(msg => msg.widget === "📄 Database" && msg.payload);
  
  // Lấy tin nhắn mới nhất
  const message = relevantMessages[relevantMessages.length - 1];
  
  // Kiểm tra nếu không có tin nhắn
  if (!message || !message.payload) {
    return null;
  }
  
  const content = message.payload.message || "";
  
  return (
    <div className="database-result">
      <div className="source-badge">
        <span className="icon">📄</span>
        <span className="text">Kết quả từ tài liệu</span>
      </div>
      <div 
        className="result-content" 
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
};

const AIWidget = (props) => {
  // Đơn giản hóa: Lấy tất cả tin nhắn có widget "🤖 AI"
  const relevantMessages = props.messages.filter(msg => msg.widget === "🤖 AI" && msg.payload);
  
  // Lấy tin nhắn mới nhất
  const message = relevantMessages[relevantMessages.length - 1];
  
  // Kiểm tra nếu không có tin nhắn
  if (!message || !message.payload) {
    return null;
  }
  
  const content = message.payload.message || "";
  
  return (
    <div className="ai-result">
      <div className="source-badge">
        <span className="icon">🤖</span>
        <span className="text">Kết quả từ AI</span>
      </div>
      <div 
        className="result-content" 
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
};

// Widget để hiển thị HTML
const HTMLDisplay = (props) => {
  const { htmlContent } = props.payload;
  
  return (
    <div 
      className="html-display-widget"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

// Tạo component mới hiển thị HTML
class CustomHtmlWidget extends React.Component {
  componentDidMount() {
    const container = document.getElementById(`html-widget-${this.props.payload.id || 'custom'}`);
    if (container) {
      container.innerHTML = this.props.payload.html;
    }
  }
  
  render() {
    return (
      <div 
        id={`html-widget-${this.props.payload.id || 'custom'}`} 
        className="custom-html-widget"
        style={{
          width: '100%',
          padding: '8px',
          fontFamily: 'Arial, sans-serif',
          color: '#333',
          lineHeight: 1.5,
          textAlign: 'left'
        }}
      />
    );
  }
}

// Tạo component MarkdownDisplay cho widget
const MarkdownDisplay = (props) => {
  const { content } = props.payload;
  
  return (
    <div className="markdown-display" style={{ 
      textAlign: 'left', 
      lineHeight: '1.5',
      fontFamily: 'Arial, sans-serif',
      color: '#333',
      padding: '10px',
      maxWidth: '100%',
      wordBreak: 'break-word'
    }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

// Thêm widget mới cho kết quả MCP
const MCPWidget = (props) => {
  const relevantMessages = props.messages.filter(msg => msg.widget === "🔍 MCP" && msg.payload);
  const message = relevantMessages[relevantMessages.length - 1];
  
  if (!message || !message.payload) {
    return null;
  }
  
  const content = message.payload.message || "";
  
  return (
    <div className="mcp-result">
      <div className="source-badge">
        <span className="icon">🔍</span>
        <span className="text">Kết quả từ MCP</span>
      </div>
      <div 
        className="result-content" 
        dangerouslySetInnerHTML={{ __html: content }}
      />
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
      backgroundColor: "#ffffff",
    },
    chatButton: {
      backgroundColor: "#3b82f6",
    },
  },
  widgets: [
    {
      widgetName: "markdownDisplay",
      widgetFunc: (props) => <MarkdownDisplay {...props} />,
    },
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
      widgetName: "🔍 MCP",
      widgetFunc: (props) => <MCPWidget {...props} />,
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
    {
      widgetName: "htmlDisplay",
      widgetFunc: (props) => <HTMLDisplay {...props} />
    },
    {
      widgetName: "customHtmlWidget",
      widgetFunc: (props) => <CustomHtmlWidget {...props} />,
      mapStateToProps: ["messages"]
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

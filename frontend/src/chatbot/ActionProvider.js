import axios from "axios";
import React from 'react';
import ReactMarkdown from 'react-markdown';
import mcpService from '../services/mcpService';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Thêm component này ở đầu file hoặc tạo file riêng
const MarkdownRenderer = (props) => {
  return (
    <div style={{ 
      textAlign: 'left', 
      lineHeight: '1.5',
      fontFamily: 'Arial, sans-serif',
      color: '#333',
      padding: '10px'
    }}>
      <ReactMarkdown>{props.content}</ReactMarkdown>
    </div>
  );
};

class ActionProvider {
  constructor(createChatBotMessage, setStateFunc) {
    this.createChatBotMessage = createChatBotMessage;
    this.setState = setStateFunc;
    this.userContext = {
      mood: 'neutral',
      topics: new Set(),
      lastInteraction: Date.now(),
      importantInfo: new Map(),
      chatHistory: []
    };
  }

  updateUserContext(message, response) {
    // Cập nhật tâm trạng dựa vào emoji
    if (message.includes('😊') || message.includes('😄')) {
      this.userContext.mood = 'happy';
    } else if (message.includes('😢') || message.includes('😞')) {
      this.userContext.mood = 'sad';
    }

    // Phát hiện chủ đề
    const topics = ['tài liệu', 'pdf', 'file', 'upload', 'tìm kiếm'];
    topics.forEach(topic => {
      if (message.toLowerCase().includes(topic)) {
        this.userContext.topics.add(topic);
      }
    });

    // Lưu thông tin quan trọng
    if (message.includes('cần tìm:')) {
      const searchInfo = message.split('cần tìm:')[1].trim();
      this.userContext.importantInfo.set('searchTarget', searchInfo);
    }

    // Cập nhật lịch sử chat
    this.userContext.chatHistory.push({
      role: 'user',
      content: message
    });
    if (response) {
      this.userContext.chatHistory.push({
        role: 'bot',
        content: response
      });
    }

    // Giới hạn lịch sử chat
    if (this.userContext.chatHistory.length > 10) {
      this.userContext.chatHistory = this.userContext.chatHistory.slice(-10);
    }

    this.userContext.lastInteraction = Date.now();
  }

  formatMessage(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // In đậm
      .replace(/\n/g, '<br>'); // Xuống dòng
  }

  convertMarkdownToHTML(text) {
    // Xử lý định dạng in đậm
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Thêm xuống dòng sau mỗi đánh số
    text = text.replace(/(\d+\.\s+)/g, '<br>$1');
    
    // Thêm xuống dòng sau mỗi dấu hai chấm tiêu đề
    text = text.replace(/(:\s*)(?=\d+\.)/g, ':<br><br>');
    
    // Thêm xuống dòng trước các phần Nguồn
    text = text.replace(/(Nguồn:)/g, '<br><br>$1');
    
    // Thêm xuống dòng sau các chữ đậm
    text = text.replace(/<\/strong>:/g, '</strong>:<br>');
    
    return text;
  }

  async handleUserMessage(query) {
    // Hiển thị tin nhắn loading
    const loadingMessage = this.createChatBotMessage("⏳ Đang tìm kiếm...");
    this.setState((prev) => ({
      ...prev,
      messages: [...prev.messages, loadingMessage],
    }));

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Bạn cần đăng nhập để sử dụng tính năng này");
      }

      let answer;
      let source = "AI";
      
      // Thử sử dụng MCP server
      try {
        // Kiểm tra xem MCP server có hoạt động không
        const mcpAvailable = await mcpService.checkHealth();
        
        if (mcpAvailable) {
          console.log("🤖 Đang sử dụng MCP Server để tìm kiếm...");
          answer = await mcpService.searchPDF(query);
          source = "MCP";
        } else {
          console.log("⚠️ MCP Server không khả dụng, chuyển sang phương pháp tìm kiếm cũ...");
          // Sử dụng API tìm kiếm cũ nếu MCP không khả dụng
          const response = await axios.post(
            `${API_BASE_URL}/pdf/search`, 
            { 
              query,
              format: "markdown"
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          answer = response.data.answer || "";
          source = response.data.source || "AI";
        }
      } catch (mcpError) {
        console.log("⚠️ Lỗi khi sử dụng MCP Server, chuyển sang phương pháp tìm kiếm cũ...", mcpError);
        // Sử dụng API tìm kiếm cũ nếu MCP gặp lỗi
        const response = await axios.post(
          `${API_BASE_URL}/pdf/search`, 
          { 
            query,
            format: "markdown"
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        answer = response.data.answer || "";
        source = response.data.source || "AI";
      }

      // Xóa tin nhắn loading
      this.setState((prev) => ({
        ...prev,
        messages: prev.messages.filter(msg => msg !== loadingMessage),
      }));

      // Thêm tin nhắn nguồn trước
      let sourceText = source === "database" ? "📄 Kết quả từ tài liệu" : 
                      source === "MCP" ? "🔍 Kết quả từ MCP" : "🤖 Kết quả từ AI";
      const sourceMessage = this.createChatBotMessage(sourceText);
      
      // Tạo tin nhắn với widget markdownDisplay
      const markdownMessage = this.createChatBotMessage(" ", {
        widget: "markdownDisplay",
        payload: {
          content: answer
        }
      });
      
      this.setState((prev) => ({
        ...prev,
        messages: [...prev.messages, sourceMessage, markdownMessage],
      }));
      
      // Thêm mã để đảm bảo CSS được áp dụng đúng cho ReactMarkdown
      setTimeout(() => {
        // Áp dụng CSS cho các thẻ Markdown
        const markdownContainers = document.querySelectorAll('.markdown-display');
        markdownContainers.forEach(container => {
          // Áp dụng style cho các thẻ con của markdown
          const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
          headings.forEach(heading => {
            heading.style.margin = '15px 0 10px 0';
            heading.style.fontWeight = 'bold';
          });
          
          const paragraphs = container.querySelectorAll('p');
          paragraphs.forEach(p => {
            p.style.margin = '8px 0';
          });
          
          const lists = container.querySelectorAll('ul, ol');
          lists.forEach(list => {
            list.style.paddingLeft = '20px';
            list.style.margin = '8px 0';
          });
          
          const listItems = container.querySelectorAll('li');
          listItems.forEach(item => {
            item.style.margin = '5px 0';
          });
        });
        
        // Scroll xuống cuối
        const messageContainer = document.querySelector('.react-chatbot-kit-chat-message-container');
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error("❌ Lỗi khi gọi API:", error);
      
      // Xóa tin nhắn loading
      this.setState((prev) => ({
        ...prev,
        messages: prev.messages.filter(msg => msg !== loadingMessage),
      }));
      
      // Hiển thị tin nhắn lỗi
      const errorMessage = this.createChatBotMessage(`❌ Lỗi: ${error.message || "Không thể kết nối đến server"}`);
      this.setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
      }));
    }
  }

  handleHelpRequest() {
    const helpMessage = this.createChatBotMessage(
      `Tôi có thể giúp bạn:\n- Tìm kiếm thông tin trong tài liệu PDF 📄\n- Trả lời các câu hỏi về nội dung tài liệu 💡\n- Tóm tắt nội dung quan trọng 📝\n\nHãy hỏi tôi bất kỳ điều gì bạn muốn tìm hiểu!`
    );
    
    this.setState((prev) => ({
      ...prev,
      messages: [...prev.messages, helpMessage],
    }));
  }

  clearContext() {
    this.userContext = {
      mood: 'neutral',
      topics: new Set(),
      lastInteraction: Date.now(),
      importantInfo: new Map(),
      chatHistory: []
    };
  }
}

export default ActionProvider;

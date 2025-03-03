import axios from "axios";
// import { createChatBotMessage } from "react-chatbot-kit";
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

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

  async handleUserMessage(query) {
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

      // Thêm context vào request
      const response = await axios.post(
        `${API_BASE_URL}/pdf/search`, 
        { 
          query,
          context: {
            mood: this.userContext.mood,
            topics: Array.from(this.userContext.topics),
            importantInfo: Object.fromEntries(this.userContext.importantInfo),
            recentMessages: this.userContext.chatHistory.slice(-5)
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      this.setState((prev) => ({
        ...prev,
        messages: prev.messages.filter(msg => msg !== loadingMessage),
      }));

      const source = response.data.source || "AI";
      let answer = response.data.answer || "Xin lỗi, tôi không tìm thấy câu trả lời.";

      // Thêm phản hồi theo tâm trạng
      if (this.userContext.mood === 'happy') {
        answer = `😊 ${answer}`;
      } else if (this.userContext.mood === 'sad') {
        answer = `💪 ${answer}\nHãy cố gắng lên nhé!`;
      }

      const sourceIcon = source === "database" ? "📄 Database" : "🤖 AI";
      
      const botMessage = this.createChatBotMessage(answer, { 
        widget: sourceIcon,
        loading: false,
        delay: 500,
      });

      this.updateUserContext(query, answer);

      this.setState((prev) => ({
        ...prev,
        messages: [...prev.messages, botMessage],
      }));
    } catch (error) {
      console.error("❌ Lỗi khi gọi API tìm kiếm:", error);

      this.setState((prev) => ({
        ...prev,
        messages: prev.messages.filter(msg => msg !== loadingMessage),
      }));
      
      const errorMessage = this.createChatBotMessage(
        error.message || "🚨 Lỗi server, vui lòng thử lại sau."
      );
      
      this.setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
      }));
    }
  }

  handleHelpRequest() {
    const helpMessage = this.createChatBotMessage(
      `Tôi có thể giúp bạn:
      - Tìm kiếm thông tin trong tài liệu PDF 📄
      - Trả lời các câu hỏi về nội dung tài liệu 💡
      - Tóm tắt nội dung quan trọng 📝
      
      Hãy hỏi tôi bất kỳ điều gì bạn muốn tìm hiểu!`
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

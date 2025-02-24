import axios from "axios";
import { createChatBotMessage } from "react-chatbot-kit";

class ActionProvider {
  constructor(createChatBotMessage, setStateFunc) {
    this.createChatBotMessage = createChatBotMessage;
    this.setState = setStateFunc;
  }

  async handleUserMessage(query) {
    try {
      const response = await axios.post("http://localhost:5000/api/pdf/search", { query });

      // Kiểm tra nếu response.data không có câu trả lời
      const answer = response.data.answer || "Xin lỗi, tôi không tìm thấy câu trả lời.";
      const source = response.data.source || "🤖 AI";

      const botMessage = this.createChatBotMessage(answer, { widget: source });

      this.setState((prev) => ({
        ...prev,
        messages: [...prev.messages, botMessage],
      }));
    } catch (error) {
      console.error("❌ Lỗi khi gọi API tìm kiếm:", error);
      const errorMessage = this.createChatBotMessage("🚨 Lỗi server, vui lòng thử lại sau.");
      this.setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
      }));
    }
  }
}

export default ActionProvider;

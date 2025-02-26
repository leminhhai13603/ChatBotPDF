import axios from "axios";
import { createChatBotMessage } from "react-chatbot-kit";

class ActionProvider {
  constructor(createChatBotMessage, setStateFunc) {
    this.createChatBotMessage = createChatBotMessage;
    this.setState = setStateFunc;
  }

  async handleUserMessage(query) {
    // Hiển thị thông báo đang xử lý
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

      const response = await axios.post(
        "http://localhost:5000/api/pdf/search", 
        { query },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Xóa thông báo loading
      this.setState((prev) => ({
        ...prev,
        messages: prev.messages.filter(msg => msg !== loadingMessage),
      }));

      // Kiểm tra nguồn dữ liệu
      const source = response.data.source || "AI";
      const answer = response.data.answer || "Xin lỗi, tôi không tìm thấy câu trả lời.";
      
      // Tạo icon dựa vào nguồn
      const sourceIcon = source === "database" ? "📄 Database" : "🤖 AI";
      
      const botMessage = this.createChatBotMessage(answer, { 
        widget: sourceIcon,
        loading: false,
        delay: 500,
      });

      this.setState((prev) => ({
        ...prev,
        messages: [...prev.messages, botMessage],
      }));
    } catch (error) {
      console.error("❌ Lỗi khi gọi API tìm kiếm:", error);
      
      // Xóa thông báo loading
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
      "Bạn có thể hỏi tôi bất kỳ câu hỏi nào liên quan đến tài liệu trong hệ thống. Tôi sẽ tìm kiếm trong các tài liệu mà bạn có quyền truy cập."
    );
    
    this.setState((prev) => ({
      ...prev,
      messages: [...prev.messages, helpMessage],
    }));
  }
}

export default ActionProvider;

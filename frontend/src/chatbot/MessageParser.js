class MessageParser {
    constructor(actionProvider) {
      this.actionProvider = actionProvider;
    }
  
    parse(message) {
      if (!message || message.trim().length === 0) {
        return;
      }
  
      const lowerCaseMessage = message.trim().toLowerCase();
  
      if (lowerCaseMessage.includes("help") || lowerCaseMessage.includes("hướng dẫn")) {
        this.actionProvider.handleUserMessage("Làm thế nào để sử dụng chatbot?");
      } else {
        this.actionProvider.handleUserMessage(lowerCaseMessage);
      }
    }
  }
  
  export default MessageParser;
  
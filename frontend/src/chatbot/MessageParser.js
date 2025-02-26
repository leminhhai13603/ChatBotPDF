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
        this.actionProvider.handleHelpRequest();
      } else {
        this.actionProvider.handleUserMessage(message);
      }
    }
  }
  
  export default MessageParser;
  
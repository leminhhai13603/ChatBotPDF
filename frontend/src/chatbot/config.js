import { createChatBotMessage } from "react-chatbot-kit";

const config = {
  botName: "Chatbot PDF",
  initialMessages: [createChatBotMessage("Xin chào! Bạn muốn tìm kiếm gì trong PDF?")],
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
      widgetFunc: (props) => <div>{props.message}</div>,
    },
    {
      widgetName: "🤖 GPT",
      widgetFunc: (props) => <div>{props.message}</div>,
    },
  ],
};

export default config;

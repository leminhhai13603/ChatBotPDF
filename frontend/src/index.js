import React from "react";
import ReactDOM from "react-dom/client"; 
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from "./App";
import "./css/index.css";
import 'antd/dist/reset.css';
import './css/chatbot.css';
import './css/chatbot-message.css';

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

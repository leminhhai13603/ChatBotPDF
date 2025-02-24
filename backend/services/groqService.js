const axios = require("axios");

exports.queryGroqAI = async (query) => {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.2-90b-vision-preview",
        messages: [{ role: "user", content: query }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content || "Không tìm thấy câu trả lời.";
  } catch (error) {
    console.error("❌ Lỗi khi gọi Groq AI:", error);
    return "Lỗi khi gọi AI.";
  }
};

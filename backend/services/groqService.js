const axios = require("axios");
require("dotenv").config();

// Hàm gọi Groq API để tạo embedding
exports.createEmbedding = async (text) => {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/embeddings',
            {
                input: text,
                model: "text-embedding-ada-002"
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data.data[0].embedding;
    } catch (error) {
        console.error("❌ Lỗi khi tạo embedding:", error.response?.data || error.message);
        throw error;
    }
};

// Hàm gọi Groq API để trả lời câu hỏi
exports.askGroq = async (query) => {
    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama3-8b-8192",
                messages: [
                    {
                        role: "system",
                        content: `Bạn là trợ lý AI thông minh, được tạo ra để hỗ trợ người dùng. 
                        Hãy trả lời câu hỏi bằng tiếng Việt một cách ngắn gọn, đầy đủ và chính xác. 
                        Nếu câu hỏi liên quan đến tài liệu, hãy cố gắng trả lời dựa trên kiến thức chung của bạn.
                        Định dạng câu trả lời rõ ràng, dễ đọc, sử dụng gạch đầu dòng khi cần thiết.
                        Luôn trả lời bằng tiếng Việt, ngay cả khi câu hỏi bằng tiếng Anh.`
                    },
                    {
                        role: "user",
                        content: query
                    }
                ],
                temperature: 0.5,
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("❌ Lỗi khi gọi Groq API:", error.response?.data || error.message);
        
        // Fallback sang OpenAI nếu Groq lỗi
        try {
            console.log("⚠️ Groq lỗi, chuyển sang OpenAI...");
            
            const openaiResponse = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: `Bạn là trợ lý AI thông minh, được tạo ra để hỗ trợ người dùng. 
                            Hãy trả lời câu hỏi bằng tiếng Việt một cách ngắn gọn, đầy đủ và chính xác. 
                            Nếu câu hỏi liên quan đến tài liệu, hãy cố gắng trả lời dựa trên kiến thức chung của bạn.
                            Định dạng câu trả lời rõ ràng, dễ đọc, sử dụng gạch đầu dòng khi cần thiết.
                            Luôn trả lời bằng tiếng Việt, ngay cả khi câu hỏi bằng tiếng Anh.`
                        },
                        {
                            role: "user",
                            content: query
                        }
                    ],
                    temperature: 0.5,
                    max_tokens: 1000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            return openaiResponse.data.choices[0].message.content;
        } catch (openaiError) {
            console.error("❌ Lỗi khi gọi OpenAI API:", openaiError.response?.data || openaiError.message);
            return "Xin lỗi, tôi không thể trả lời câu hỏi này do gặp lỗi khi kết nối với AI.";
        }
    }
};

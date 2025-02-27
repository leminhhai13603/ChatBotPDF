const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai");
require('dotenv').config();

// Khởi tạo Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Khởi tạo OpenAI cho việc tạo embeddings
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

class GeminiService {
    constructor() {
        // Khởi tạo model
        this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        // Cấu hình chat
        this.chatConfig = {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        };
    }

    /**
     * Gửi câu hỏi đến Gemini và nhận câu trả lời
     * @param {string} prompt - Câu hỏi cần hỏi
     * @returns {Promise<string>} Câu trả lời từ Gemini
     */
    async askGemini(prompt) {
        try {
            console.log("🤖 Đang gửi prompt đến Gemini:", prompt.substring(0, 100) + "...");

            // Tạo chat và gửi prompt
            const chat = this.model.startChat({
                generationConfig: this.chatConfig,
                history: [],
            });

            const result = await chat.sendMessage(prompt);
            const response = result.response;
            const text = response.text();

            console.log("✅ Gemini trả lời thành công");
            return text;
        } catch (error) {
            console.error("❌ Lỗi khi gọi Gemini:", error);
            
            // Xử lý các lỗi cụ thể
            if (error.message.includes("quota")) {
                throw new Error("Đã vượt quá giới hạn quota Gemini API");
            }
            if (error.message.includes("invalid")) {
                throw new Error("API key Gemini không hợp lệ");
            }
            
            throw new Error("Lỗi khi gọi Gemini API: " + error.message);
        }
    }

    /**
     * Tạo embedding cho văn bản sử dụng OpenAI
     * @param {string} text - Văn bản cần tạo embedding
     * @returns {Promise<number[]>} Vector embedding
     */
    async createEmbedding(text) {
        try {
            console.log("🔤 Đang tạo embedding cho văn bản:", text.substring(0, 100) + "...");

            const response = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: text,
            });

            console.log("✅ Tạo embedding thành công");
            return response.data[0].embedding;
        } catch (error) {
            console.error("❌ Lỗi khi tạo embedding:", error);
            throw new Error("Lỗi khi tạo embedding: " + error.message);
        }
    }

    /**
     * Xử lý văn bản dài bằng cách chia thành các phần nhỏ hơn
     * @param {string} text - Văn bản cần xử lý
     * @returns {Promise<string>} Kết quả tổng hợp
     */
    async processLongText(text) {
        try {
            // Chia văn bản thành các phần nhỏ hơn (khoảng 30k ký tự)
            const chunks = this.splitTextIntoChunks(text, 30000);
            const results = [];

            // Xử lý từng phần
            for (let i = 0; i < chunks.length; i++) {
                console.log(`🔄 Đang xử lý phần ${i + 1}/${chunks.length}`);
                const result = await this.askGemini(chunks[i]);
                results.push(result);
            }

            // Tổng hợp kết quả
            if (results.length === 1) {
                return results[0];
            }

            // Nếu có nhiều phần, tổng hợp lại
            const summaryPrompt = `Tổng hợp các thông tin sau thành một câu trả lời mạch lạc:

${results.join('\n\n')}`;

            return await this.askGemini(summaryPrompt);
        } catch (error) {
            console.error("❌ Lỗi khi xử lý văn bản dài:", error);
            throw error;
        }
    }

    /**
     * Chia văn bản thành các phần nhỏ hơn
     * @param {string} text - Văn bản cần chia
     * @param {number} maxLength - Độ dài tối đa của mỗi phần
     * @returns {string[]} Mảng các phần văn bản
     */
    splitTextIntoChunks(text, maxLength) {
        const chunks = [];
        let currentChunk = '';
        const sentences = text.split(/(?<=[.!?])\s+/);

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxLength) {
                chunks.push(currentChunk);
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    /**
     * Kiểm tra trạng thái của service
     * @returns {Promise<boolean>} true nếu service hoạt động bình thường
     */
    async checkHealth() {
        try {
            const response = await this.askGemini("Hello");
            return response && response.length > 0;
        } catch (error) {
            console.error("❌ Service không hoạt động:", error);
            return false;
        }
    }
}

module.exports = new GeminiService(); 
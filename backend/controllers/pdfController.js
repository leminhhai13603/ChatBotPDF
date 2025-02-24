const { savePDFMetadata, savePDFChunks, getAllPDFs, deletePDF, getVectorSearchResult } = require("../models/pdfModel");
const { generateEmbedding } = require("../services/openaiService");
const { queryGroqAI } = require("../services/groqService");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { OpenAIEmbeddings } = require("@langchain/openai");
const pdfParse = require("pdf-parse");

exports.uploadPDF = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Không có file được tải lên" });
    }

    try {
        const pdfBuffer = req.file.buffer;
        let pdfName = req.file.originalname;

        // 🔹 Đảm bảo tên file giữ nguyên Unicode
        pdfName = Buffer.from(pdfName, 'binary').toString('utf-8');

        // 🔹 Chuẩn hóa tên file nhưng vẫn giữ dấu tiếng Việt
        const normalizeFileName = (fileName) => {
            return fileName.normalize("NFC") // Giữ đúng Unicode
                           .replace(/\s+/g, "_") // Thay dấu cách bằng "_"
                           .replace(/[^a-zA-Z0-9_.\u00C0-\u1EF9]/g, ""); // Giữ Unicode tiếng Việt
        };

        pdfName = normalizeFileName(pdfName);

        // 🔹 Đọc nội dung PDF
        const data = await pdfParse(pdfBuffer);
        const fullText = data.text.trim();

        if (!fullText) {
            throw new Error("Không thể trích xuất nội dung từ PDF");
        }

        console.log(`📄 Đang xử lý file: ${pdfName}`);

        // 🔹 Lưu metadata của PDF vào database
        const pdfId = await savePDFMetadata(pdfName, fullText);

        // 🔹 Chia nhỏ văn bản thành từng đoạn (chunks)
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 3000,
            chunkOverlap: 200
        });

        const chunks = await textSplitter.createDocuments([fullText]);

        // 🔹 Tạo embedding bằng OpenAI
        const openaiEmbeddings = new OpenAIEmbeddings({
            model: "text-embedding-ada-002"
        });

        const embeddings = await openaiEmbeddings.embedDocuments(chunks.map(chunk => chunk.pageContent));

        // 🔹 Lưu các chunks và embeddings vào database
        await savePDFChunks(pdfId, chunks.map(chunk => chunk.pageContent), embeddings);

        console.log(`✅ Lưu thành công ${chunks.length} đoạn từ file ${pdfName}`);
        res.json({ message: "Tải lên thành công!", chunks: chunks.length, fileName: pdfName });
    } catch (error) {
        console.error("❌ Lỗi khi xử lý PDF:", error);
        res.status(500).json({ error: error.message });
    }
};


exports.searchPDF = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: "Không có truy vấn tìm kiếm" });
        }

        console.log(`🔎 Đang tìm kiếm trong database: ${query}`);

        // 🔹 Tạo embedding cho câu truy vấn
        const queryEmbedding = await generateEmbedding(query);

        // 🔹 Tìm kiếm trong database
        const searchResults = await getVectorSearchResult(queryEmbedding);

        if (searchResults) {
            console.log(`✅ Database có kết quả phù hợp.`);
            return res.json({ source: "database", answer: searchResults });
        }

        // 🔹 Nếu database không có, gọi AI
        console.log("🤖 Không tìm thấy kết quả trong database, gọi AI...");
        const aiResponse = await queryGroqAI(query);

        return res.json({
            source: "AI",
            answer: aiResponse || "Xin lỗi, tôi không có câu trả lời cho câu hỏi này."
        });

    } catch (error) {
        console.error("❌ Lỗi khi tìm kiếm:", error);
        res.status(500).json({ error: "Lỗi máy chủ khi tìm kiếm." });
    }
};



// ✅ Lấy danh sách file PDF
exports.getPDFs = async (req, res) => {
    try {
        const files = await getAllPDFs();
        res.json({ files });
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách file:", error);
        res.status(500).json({ error: "Lỗi khi lấy danh sách file" });
    }
};

// ✅ Xóa file PDF và các đoạn text liên quan
exports.deletePDF = async (req, res) => {
    const { id } = req.params;
    try {
        const success = await deletePDF(id);
        if (success) {
            res.json({ message: "Xóa file thành công!" });
        } else {
            res.status(404).json({ error: "File không tồn tại" });
        }
    } catch (error) {
        console.error("❌ Lỗi khi xóa file:", error);
        res.status(500).json({ error: "Lỗi khi xóa file" });
    }
};

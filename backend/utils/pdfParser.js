// utils/pdfParser.js

const pdfParse = require("pdf-parse");

// ✅ Trích xuất nội dung từ file PDF
exports.extractTextFromPDF = async (pdfBuffer) => {
    try {
        const data = await pdfParse(pdfBuffer);
        return data.text;
    } catch (error) {
        console.error("❌ Lỗi khi trích xuất nội dung PDF:", error);
        throw error;
    }
};

// ✅ Chia nhỏ đoạn văn bản thành các phần nhỏ để tìm kiếm
exports.chunkText = (text, chunkSize = 300, overlap = 50) => {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
};

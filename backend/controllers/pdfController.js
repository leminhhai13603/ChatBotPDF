const pdfModel = require("../models/pdfModel");
const openaiService = require("../services/openaiService");
const groqService = require("../services/groqService");
const langchainService = require("../services/langchainService");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const pdfParse = require("pdf-parse");
const pool = require("../config/db");
const chatModel = require("../models/chatModel");

exports.uploadPDF = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Không có file được upload" });
        }

        // Lấy tên file gốc từ form data hoặc từ originalname
        let pdfName;
        if (req.body.originalFileName) {
            pdfName = req.body.originalFileName;
        } else {
            pdfName = decodeURIComponent(req.file.originalname);
        }
        
        console.log("📄 Tên file:", {
            original: req.file.originalname,
            decoded: pdfName
        });
        
        // Xử lý nội dung file
        const buffer = req.file.buffer;
        const data = await pdfParse(buffer);
        
        // Xử lý text để giữ nguyên định dạng
        const fullText = data.text
            .replace(/\r\n/g, '\n') // Chuẩn hóa xuống dòng
            .replace(/\n{3,}/g, '\n\n'); // Giảm số dòng trống liên tiếp
        
        // Lấy thông tin user từ request
        const userId = req.user.id;
        const groupId = req.body.groupId;

        if (!groupId) {
            return res.status(400).json({ error: "Thiếu thông tin danh mục (groupId)" });
        }

        console.log("📤 Upload info:", {
            fileName: pdfName,
            userId,
            groupId,
            fileSize: buffer.length,
            textLength: fullText.length
        });

        // Lưu metadata và lấy ID - Trả về response trước khi xử lý embeddings
        const pdfId = await pdfModel.savePDFMetadata(pdfName, fullText, userId, groupId);
        
        // Trả về response ngay lập tức
        res.json({ 
            message: "Upload thành công, đang xử lý văn bản...", 
            pdfId,
            fileName: pdfName
        });
        
        // Tiếp tục xử lý embeddings trong background
        try {
            // Tạo chunks
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const docs = await splitter.createDocuments([fullText]);
            
            // Tạo embeddings cho từng chunk
            const chunks = docs.map(doc => doc.pageContent);
            
            // Xử lý embeddings theo batch để tăng tốc
            const batchSize = 5;
            const embeddings = [];
            
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                const batchEmbeddings = await Promise.all(
                    batch.map(chunk => openaiService.generateEmbedding(chunk))
                );
                embeddings.push(...batchEmbeddings);
                console.log(`✅ Đã xử lý ${i + batch.length}/${chunks.length} chunks`);
            }
            
            // Lưu chunks và embeddings
            await pdfModel.savePDFChunks(pdfId, chunks, embeddings);
            console.log(`✅ Hoàn tất xử lý file ${pdfName}`);
        } catch (embeddingError) {
            console.error("❌ Lỗi khi xử lý embeddings:", embeddingError);
            // Không ảnh hưởng đến response vì đã trả về trước đó
        }
    } catch (error) {
        console.error("❌ Lỗi khi upload file:", error);
        res.status(500).json({ 
            error: "Lỗi khi upload file",
            details: error.message
        });
    }
};

exports.getAllPDFs = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRoles = req.user.roles || [];
        
        const files = await pdfModel.getAllPDFs(userId, userRoles);
        res.json({
            files: files
        });
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách PDF:", error);
        res.status(500).json({ error: "Lỗi khi lấy danh sách file" });
    }
};

exports.deletePDF = async (req, res) => {
    const { id } = req.params;
    try {
        const success = await pdfModel.deletePDF(id);
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

exports.searchPDF = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: "Không có truy vấn tìm kiếm" });
        }

        // Lấy thông tin user từ request
        const userId = req.user.id;
        const userRoles = req.user.roles || [];

        console.log(`🔎 Đang tìm kiếm: "${query}" cho user ${userId} với roles ${userRoles.join(', ')}`);

        // Sử dụng LangChain retrieval chain để tìm kiếm và trả lời
        try {
            console.log("🔍 Sử dụng LangChain retrieval chain...");
            const answer = await langchainService.queryRetrievalChain(userId, query, userRoles);
            
            // Kiểm tra nếu không tìm thấy thông tin trong tài liệu
            if (answer.includes("Tôi không tìm thấy đủ thông tin trong tài liệu") || 
                answer.includes("không có đủ thông tin")) {
                
                console.log("⚠️ LangChain không tìm thấy thông tin, chuyển sang tìm kiếm thông thường...");
                
                // Tạo embedding cho query gốc
                const queryEmbedding = await groqService.createEmbedding(query);
                
                // Tìm kiếm trong database với phân quyền
                const searchResults = await pdfModel.getVectorSearchResultWithRoles(queryEmbedding, userId, userRoles);
                
                if (searchResults) {
                    console.log("✅ Database có kết quả phù hợp.");
                    
                    // Tạo prompt với kết quả tìm kiếm
                    const prompt = `
                    Dựa vào các đoạn văn bản sau đây, hãy trả lời câu hỏi: "${query}"
                    
                    ${searchResults.map(result => `Đoạn văn bản từ "${result.pdf_name}":\n${result.content}`).join('\n\n')}
                    
                    Trả lời bằng tiếng Việt, ngắn gọn, đầy đủ và chính xác. Nếu không có thông tin liên quan, hãy nói "Tôi không tìm thấy thông tin liên quan trong tài liệu."
                    `;
                    
                    // Gọi Groq AI với prompt
                    const answer = await groqService.askGroq(prompt);
                    
                    // Lưu lịch sử hội thoại (không thêm nguồn tài liệu)
                    await chatModel.saveChatHistory(userId, query, answer, "database");
                    
                    return res.json({
                        source: "database",
                        answer: answer
                    });
                } else {
                    console.log("⚠️ Database không có kết quả phù hợp, gọi AI...");
                    
                    // Gọi Groq AI
                    const answer = await groqService.askGroq(query);
                    
                    // Lưu lịch sử hội thoại
                    await chatModel.saveChatHistory(userId, query, answer, "groq");
                    
                    return res.json({
                        source: "groq",
                        answer: answer
                    });
                }
            } else {
                console.log("✅ LangChain tìm thấy thông tin phù hợp.");
                
                // Lưu lịch sử hội thoại
                await chatModel.saveChatHistory(userId, query, answer, "langchain");
                
                return res.json({
                    source: "langchain",
                    answer: answer
                });
            }
        } catch (langchainError) {
            console.error("❌ Lỗi khi sử dụng LangChain:", langchainError);
            
            // Nếu LangChain lỗi, chuyển sang tìm kiếm thông thường
            console.log("⚠️ LangChain lỗi, chuyển sang tìm kiếm thông thường...");
            
            // Tạo embedding cho query
            const queryEmbedding = await groqService.createEmbedding(query);
            
            // Tìm kiếm trong database với phân quyền
            const searchResults = await pdfModel.getVectorSearchResultWithRoles(queryEmbedding, userId, userRoles);
            
            if (searchResults) {
                console.log("✅ Database có kết quả phù hợp.");
                
                // Tạo prompt với kết quả tìm kiếm
                const prompt = `
                Dựa vào các đoạn văn bản sau đây, hãy trả lời câu hỏi: "${query}"
                
                ${searchResults.map(result => `Đoạn văn bản từ "${result.pdf_name}":\n${result.content}`).join('\n\n')}
                
                Trả lời bằng tiếng Việt, ngắn gọn, đầy đủ và chính xác. Nếu không có thông tin liên quan, hãy nói "Tôi không tìm thấy thông tin liên quan trong tài liệu."
                `;
                
                // Gọi Groq AI với prompt
                const answer = await groqService.askGroq(prompt);
                
                // Lưu lịch sử hội thoại (không thêm nguồn tài liệu)
                await chatModel.saveChatHistory(userId, query, answer, "database");
                
                return res.json({
                    source: "database",
                    answer: answer
                });
            } else {
                console.log("⚠️ Database không có kết quả phù hợp, gọi AI...");
                
                // Gọi Groq AI
                const answer = await groqService.askGroq(query);
                
                // Lưu lịch sử hội thoại
                await chatModel.saveChatHistory(userId, query, answer, "groq");
                
                return res.json({
                    source: "groq",
                    answer: answer
                });
            }
        }
    } catch (error) {
        console.error("❌ Lỗi khi tìm kiếm:", error);
        res.status(500).json({ error: "Lỗi máy chủ khi tìm kiếm." });
    }
};

// Thêm API để lấy lịch sử hội thoại
exports.getChatHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = req.query.limit || 10;
        
        const history = await chatModel.getChatHistory(userId, limit);
        
        res.json({ history });
    } catch (error) {
        console.error("❌ Lỗi khi lấy lịch sử hội thoại:", error);
        res.status(500).json({ error: "Lỗi máy chủ khi lấy lịch sử hội thoại." });
    }
};

// Thêm API để xóa lịch sử hội thoại
exports.clearChatHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        
        await chatModel.clearChatHistory(userId);
        langchainService.clearMemoryForUser(userId);
        
        res.json({ message: "Đã xóa lịch sử hội thoại." });
    } catch (error) {
        console.error("❌ Lỗi khi xóa lịch sử hội thoại:", error);
        res.status(500).json({ error: "Lỗi máy chủ khi xóa lịch sử hội thoại." });
    }
};

// Thêm controller để tái xử lý PDF
exports.reprocessPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRoles = req.user.roles || [];
        
        // Kiểm tra quyền truy cập
        const isAdmin = userRoles.some(role => role.toLowerCase() === 'admin');
        if (!isAdmin) {
            return res.status(403).json({ error: "Bạn không có quyền tái xử lý PDF này" });
        }
        
        // Lấy thông tin PDF từ database
        const pdfInfo = await pdfModel.getPDFById(id);
        if (!pdfInfo) {
            return res.status(404).json({ error: "Không tìm thấy PDF" });
        }
        
        // Xóa các chunks hiện tại
        await pdfModel.deleteChunks(id);
        
        // Xử lý lại PDF với cách chunking và embedding mới
        const pdfText = pdfInfo.full_text;
        
        // Tạo text splitter với cấu hình tối ưu
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000, // Giảm kích thước chunk để nắm bắt ngữ nghĩa tốt hơn
            chunkOverlap: 200, // Tăng overlap để giữ ngữ cảnh giữa các chunk
            separators: ["\n\n", "\n", ". ", "! ", "? ", ";", ":", " ", ""], // Thêm nhiều dấu phân cách
        });
        
        // Phân tách văn bản thành các đoạn nhỏ
        const chunks = await textSplitter.splitText(pdfText);
        console.log(`📄 Đã phân tách PDF thành ${chunks.length} đoạn`);
        
        // Trích xuất tiêu đề và các phần quan trọng
        const title = extractTitle(pdfText);
        const keywords = extractKeywords(pdfText);
        const sections = extractSections(pdfText);
        
        // Tạo metadata cho từng chunk
        const metadata = chunks.map((chunk, index) => {
            return {
                chunk_index: index,
                section_title: getSectionForChunk(chunk, sections),
                is_title_chunk: chunk.includes(title),
                keywords: keywords.filter(keyword => 
                    chunk.toLowerCase().includes(keyword.toLowerCase())
                ),
                chunk_length: chunk.length
            };
        });
        
        // Xử lý từng batch để tránh quá tải API
        const batchSize = 20;
        const embeddings = [];
        
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            console.log(`🔄 Đang xử lý batch ${i/batchSize + 1}/${Math.ceil(chunks.length/batchSize)}`);
            
            // Tạo embedding cho batch
            const batchEmbeddings = await Promise.all(
                batch.map(chunk => openaiService.generateEmbedding(chunk))
            );
            embeddings.push(...batchEmbeddings);
        }
        
        // Lưu chunks và embeddings với metadata
        await pdfModel.savePDFChunks(id, chunks, embeddings, metadata);
        
        res.json({ 
            success: true, 
            message: `Đã tái xử lý PDF thành công với ${chunks.length} đoạn` 
        });
    } catch (error) {
        console.error("❌ Lỗi khi tái xử lý PDF:", error);
        res.status(500).json({ 
            error: "Lỗi khi tái xử lý PDF",
            details: error.message
        });
    }
};

// Hàm trích xuất tiêu đề từ văn bản
const extractTitle = (text) => {
    // Lấy 5 dòng đầu tiên
    const firstLines = text.split('\n').slice(0, 5).join(' ');
    // Tìm tiêu đề bằng regex
    const titleMatch = firstLines.match(/^(.*?)(:|\.|\n)/);
    return titleMatch ? titleMatch[1].trim() : "Không có tiêu đề";
};

// Hàm trích xuất từ khóa từ văn bản
const extractKeywords = (text) => {
    // Danh sách từ khóa quan trọng cần tìm
    const importantKeywords = [
        "AI", "Agentic", "SME", "doanh nghiệp", "nghiên cứu", 
        "ứng dụng", "tự động hóa", "quản lý", "tối ưu hóa"
    ];
    
    // Tìm các từ khóa xuất hiện trong văn bản
    const foundKeywords = importantKeywords.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return foundKeywords;
};

// Hàm trích xuất các phần từ văn bản
const extractSections = (text) => {
    const sections = [];
    const lines = text.split('\n');
    
    // Tìm các dòng có thể là tiêu đề phần
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Kiểm tra nếu dòng có dạng "1. Tiêu đề" hoặc "1.1 Tiêu đề" hoặc "I. Tiêu đề"
        if (/^(\d+\.|\d+\.\d+|[IVX]+\.)/.test(line) && line.length < 100) {
            sections.push({
                title: line,
                startIndex: i
            });
        }
    }
    
    return sections;
};

// Hàm xác định phần cho chunk
const getSectionForChunk = (chunk, sections) => {
    // Tìm phần chứa chunk này
    for (let i = 0; i < sections.length - 1; i++) {
        const currentSection = sections[i];
        const nextSection = sections[i + 1];
        
        if (chunk.includes(currentSection.title) || 
            (chunk.indexOf(currentSection.title) <= 100 && chunk.indexOf(nextSection.title) === -1)) {
            return currentSection.title;
        }
    }
    
    // Nếu không tìm thấy, trả về phần cuối cùng hoặc "Không xác định"
    return sections.length > 0 ? sections[sections.length - 1].title : "Không xác định";
};

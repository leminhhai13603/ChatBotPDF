const pdfModel = require("../models/pdfModel");
const openaiService = require("../services/openaiService");
const groqService = require("../services/groqService");
const langchainService = require("../services/langchainService");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const pdfParse = require("pdf-parse");
const pool = require("../config/db");
const chatModel = require("../models/chatModel");
const PDFTableExtractor = require('pdf-table-extractor');
const fs = require('fs').promises;
const path = require('path');
const PDFParser = require('pdf2json');

// Hàm dọn dẹp file tạm
const cleanupTempFile = async (filePath) => {
    try {
        await fs.unlink(filePath);
        console.log("✅ Đã xóa file tạm:", filePath);
    } catch (error) {
        console.error("⚠️ Lỗi khi xóa file tạm:", error);
    }
};

exports.uploadPDF = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Không có file được upload" });
        }

        console.log("1. Bắt đầu xử lý file PDF");
        const pdfName = req.body.originalFileName || decodeURIComponent(req.file.originalname);
        const buffer = req.file.buffer;
        
        // Parse text thông thường
        const data = await pdfParse(buffer);
        let fullText = data.text
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n');
            
        console.log("2. Đã parse text thông thường");

        // Xử lý bảng với PDFParser
        const pdfParser = new PDFParser();
        const pdfData = await new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataReady", resolve);
            pdfParser.on("pdfParser_dataError", reject);
            pdfParser.parseBuffer(buffer);
        });

        // Trích xuất bảng từ dữ liệu PDF
        const extractedTables = [];
        let currentTable = [];
        
        pdfData.Pages.forEach(page => {
            let currentY = -1;
            let currentRow = [];
            const texts = page.Texts.sort((a, b) => {
                if (Math.abs(a.y - b.y) < 0.5) return a.x - b.x;
                return a.y - b.y;
            });

            texts.forEach(text => {
                const content = decodeURIComponent(text.R[0].T).trim();
                
                if (Math.abs(text.y - currentY) > 0.5) {
                    if (currentRow.length > 0) {
                        currentTable.push(currentRow);
                    }
                    currentRow = [content];
                    currentY = text.y;
                } else {
                    currentRow.push(content);
                }
            });

            if (currentRow.length > 0) {
                currentTable.push(currentRow);
            }

            // Kiểm tra xem có phải bảng không
            if (currentTable.length > 1 && currentTable[0].length > 1) {
                extractedTables.push(currentTable);
            }
            currentTable = [];
        });

        console.log("3. Số bảng đã trích xuất:", extractedTables.length);
        if (extractedTables.length > 0) {
            console.log("4. Mẫu bảng đầu tiên:", extractedTables[0]);
        }

        // Lưu vào database
        const userId = req.user.id;
        const groupId = req.body.groupId;

        const pdfId = await pdfModel.savePDFMetadata(
            pdfName,
            {
                text: fullText,
                tables: extractedTables
            },
            userId,
            groupId
        );

        res.json({
            message: "Upload thành công",
            pdfId,
            fileName: pdfName,
            tablesCount: extractedTables.length
        });

        // 4. Xử lý embeddings (bao gồm cả nội dung bảng)
        try {
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });

            // Tạo nội dung tổng hợp bao gồm cả text và bảng
            const tableContent = extractedTables.map((table, tableIndex) => {
                return `Bảng ${tableIndex + 1}:\n` + 
                    table.map(row => row.join(' | ')).join('\n');
            }).join('\n\n');

            const combinedContent = `${fullText}\n\nNội dung bảng:\n${tableContent}`;
            
            const docs = await splitter.createDocuments([combinedContent]);
            const chunks = docs.map(doc => doc.pageContent);
            
            // Xử lý embeddings theo batch
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
            
            await pdfModel.savePDFChunks(pdfId, chunks, embeddings);
            console.log(`✅ Hoàn tất xử lý file ${pdfName}`);
        } catch (embeddingError) {
            console.error("❌ Lỗi khi xử lý embeddings:", embeddingError);
        }

    } catch (error) {
        console.error("❌ Lỗi tổng thể:", error);
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

        const userId = req.user.id;
        const userRoles = req.user.roles || [];

        console.log(`🔎 Đang tìm kiếm: "${query}" cho user ${userId}`);

        // Tạo embedding cho query
        const queryEmbedding = await groqService.createEmbedding(query);
        
        // Tìm kiếm trong database với phân quyền
        const searchResults = await pdfModel.getVectorSearchResultWithRoles(queryEmbedding, userId, userRoles);
        
        if (searchResults) {
            console.log("✅ Tìm thấy kết quả trong database");
            
            // Tạo prompt thông minh hơn với context từ nhiều tài liệu
            const prompt = `
            Dựa vào các đoạn văn bản sau đây từ ${searchResults.length} tài liệu, hãy trả lời câu hỏi: "${query}"

            ${searchResults.map(doc => `
            📄 Từ tài liệu "${doc.pdf_name}":
            ${doc.chunks.map(chunk => `
            ${chunk.section_title ? `[${chunk.section_title}]` : ''}
            ${chunk.content}
            `).join('\n')}
            `).join('\n\n')}
            
            Trả lời bằng tiếng Việt, ngắn gọn, đầy đủ và chính xác. 
            Nếu thông tin từ nhiều tài liệu khác nhau, hãy tổng hợp và nêu rõ nguồn.
            Nếu không có thông tin liên quan, hãy nói "Tôi không tìm thấy thông tin liên quan trong tài liệu."
            `;
            
            const answer = await groqService.askGroq(prompt);
            
            return res.json({
                source: "database",
                answer: answer,
                documents: searchResults.map(doc => ({
                    name: doc.pdf_name,
                    relevance: doc.chunks[0].similarity
                }))
            });
        }

        // Nếu không tìm thấy, sử dụng AI
        console.log("⚠️ Không tìm thấy trong database, chuyển sang AI");
        const answer = await groqService.askGroq(query);
        
        return res.json({
            source: "groq",
            answer: answer
        });

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
    
    return sections.length > 0 ? sections[sections.length - 1].title : "Không xác định";
};

exports.getPDFDetails = async (req, res) => {
    const client = await pool.connect();
    try {
        const pdfId = req.params.id;

        const query = `
            SELECT 
                pf.id,
                pf.pdf_name,
                pf.uploaded_at,
                pf.full_text as content,
                pf.group_id,
                u.fullname as uploaded_by_name,
                r.name as category_name
            FROM pdf_files pf
            LEFT JOIN users u ON pf.uploaded_by = u.id
            LEFT JOIN roles r ON pf.group_id = r.id
            WHERE pf.id = $1
        `;

        const result = await client.query(query, [pdfId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy tài liệu" });
        }

        const pdf = result.rows[0];

        const response = {
            id: pdf.id,
            title: pdf.pdf_name,
            uploadedAt: pdf.uploaded_at,
            content: pdf.content,
            groupId: pdf.group_id,
            author: pdf.uploaded_by_name,
            category: pdf.category_name,
            readingTime: Math.ceil(pdf.content.split(' ').length / 200) // Ước tính thời gian đọc
        };

        res.json(response);

    } catch (error) {
        console.error("❌ Lỗi khi lấy chi tiết PDF:", error);
        res.status(500).json({ error: "Lỗi server" });
    } finally {
        client.release();
    }
};

exports.getPDFsByCategory = async (req, res) => {
    const client = await pool.connect();
    try {
        // Lấy role_id của "không gian chung"
        const publicSpaceQuery = `SELECT id FROM roles WHERE name ILIKE '%không gian chung%'`;
        const publicSpaceResult = await client.query(publicSpaceQuery);
        
        if (publicSpaceResult.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy danh mục không gian chung" });
        }

        const publicSpaceId = publicSpaceResult.rows[0].id;

        const query = `
            SELECT 
                pf.id,
                pf.pdf_name as title,
                pf.uploaded_at as "uploadedAt",
                LEFT(pf.full_text, 300) as excerpt,
                u.fullname as author,
                r.name as category,
                CEIL(LENGTH(pf.full_text) / 1000.0) as "readingTime"
            FROM pdf_files pf
            LEFT JOIN users u ON pf.uploaded_by = u.id
            LEFT JOIN roles r ON pf.group_id = r.id
            WHERE pf.group_id = $1
            ORDER BY pf.uploaded_at DESC
        `;

        const result = await client.query(query, [publicSpaceId]);

        // Format lại kết quả
        const pdfs = result.rows.map(pdf => ({
            id: pdf.id,
            title: pdf.title,
            excerpt: pdf.excerpt + '...',
            uploadedAt: pdf.uploadedAt,
            author: pdf.author,
            category: pdf.category,
            readingTime: pdf.readingTime
        }));

        res.json(pdfs);

    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách PDF:", error);
        res.status(500).json({ error: "Lỗi khi lấy danh sách PDF" });
    } finally {
        client.release();
    }
};

exports.getPDFTables = async (req, res) => {
    try {
        const pdfId = req.params.id;
        const tables = await pdfModel.getPDFTables(pdfId);
        res.json({ tables });
    } catch (error) {
        console.error("❌ Lỗi khi lấy bảng:", error);
        res.status(500).json({ error: "Lỗi khi lấy bảng" });
    }
};

const pdfModel = require("../models/pdfModel");
const openaiService = require("../services/openaiService");
const groqService = require("../services/groqService");
const langchainService = require("../services/langchainService");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const pdfParse = require("pdf-parse");
const pool = require("../config/db");
const chatModel = require("../models/chatModel");
const fs = require('fs').promises;
const csv = require('csv-parse/sync');

// Hàm dọn dẹp file tạm
const cleanupTempFile = async (filePath) => {
    try {
        await fs.unlink(filePath);
        console.log("✅ Đã xóa file tạm:", filePath);
    } catch (error) {
        console.error("⚠️ Lỗi khi xóa file tạm:", error);
    }
};

exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Không có file được upload" });
        }

        const fileName = req.body.originalFileName || decodeURIComponent(req.file.originalname);
        const buffer = req.file.buffer;
        const fileType = fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'csv';
        
        let fullText = '';
        let chunks = [];

        if (fileType === 'csv') {
            const csvString = buffer.toString('utf-8');
            
            // Parse CSV với xử lý đặc biệt cho multiline cells
            const parseCSV = (text) => {
                const rows = [];
                let currentRow = [];
                let currentCell = '';
                let insideQuotes = false;
                
                for (let i = 0; i < text.length; i++) {
                    const char = text[i];
                    const nextChar = text[i + 1];
                    
                    if (char === '"') {
                        if (insideQuotes && nextChar === '"') {
                            currentCell += '"';
                            i++;
                        } else {
                            insideQuotes = !insideQuotes;
                        }
                    } else if (char === ',' && !insideQuotes) {
                        currentRow.push(currentCell.trim());
                        currentCell = '';
                    } else if (char === '\n' && !insideQuotes) {
                        currentRow.push(currentCell.trim());
                        rows.push(currentRow);
                        currentRow = [];
                        currentCell = '';
                    } else {
                        currentCell += char;
                    }
                }
                
                if (currentCell) {
                    currentRow.push(currentCell.trim());
                }
                if (currentRow.length) {
                    rows.push(currentRow);
                }
                
                return rows;
            };

            const rows = parseCSV(csvString);
            
            // Tạo ASCII table để hiển thị
            const columnWidths = [];
            rows.forEach(row => {
                row.forEach((cell, i) => {
                    const cellLines = cell.split('\n');
                    const cellWidth = Math.max(...cellLines.map(line => line.length));
                    columnWidths[i] = Math.max(columnWidths[i] || 0, cellWidth);
                });
            });

            const createBorder = () => 
                '+' + columnWidths.map(w => '-'.repeat(w + 2)).join('+') + '+\n';

            const formatRow = (row) => {
                const lines = row.map(cell => cell.split('\n'));
                const maxLines = Math.max(...lines.map(cell => cell.length));
                
                let result = '';
                for (let i = 0; i < maxLines; i++) {
                    result += '|';
                    for (let j = 0; j < row.length; j++) {
                        const content = (lines[j][i] || '').padEnd(columnWidths[j]);
                        result += ` ${content} |`;
                    }
                    result += '\n';
                }
                return result;
            };

            // Tạo ASCII table
            let table = '';
            table += createBorder();
            table += formatRow(rows[0]);
            table += createBorder();
            
            for (let i = 1; i < rows.length; i++) {
                table += formatRow(rows[i]);
                table += createBorder();
            }

            fullText = table;

            // Chia chunks theo nhóm 3 dòng cho CSV
            for (let i = 0; i < rows.length; i += 3) {
                const chunkRows = rows.slice(i, Math.min(i + 3, rows.length));
                const chunk = chunkRows.map(row => row.join(' | ')).join('\n');
                chunks.push(chunk);
            }
        } else {
            const data = await pdfParse(buffer);
            fullText = data.text
                .replace(/\r\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n');

            // Chia chunks cho PDF
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            
            const docs = await splitter.createDocuments([fullText]);
            chunks = docs.map(doc => doc.pageContent);
        }

        // Lưu vào database
        const userId = req.user.id;
        const groupId = req.body.groupId;

        const fileId = await pdfModel.savePDFMetadata(
            fileName,
            {
                text: fullText,
                fileType: fileType,
                originalFile: buffer
            },
            userId,
            groupId
        );

        // Tạo embeddings cho chunks
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
        
        await pdfModel.savePDFChunks(fileId, chunks, embeddings);
        console.log(`✅ Hoàn tất xử lý file ${fileName}`);

        res.json({
            message: "Upload thành công",
            fileId,
            fileName: fileName
        });

    } catch (error) {
        console.error("❌ Lỗi chi tiết:", error);
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
        
        console.log("🔍 Đang lấy danh sách file cho user:", {
            userId,
            roles: userRoles
        });
        
        const files = await pdfModel.getAllPDFs(userId, userRoles);
        
        console.log(`✅ Đã tìm thấy ${files.length} file`);
        
        res.json({
            success: true,
            files: files.map(file => ({
                id: file.id,
                pdf_name: file.pdf_name,
                uploaded_at: file.uploaded_at,
                full_text: file.full_text,
                group_id: file.group_id,
                group_name: file.group_name,
                file_type: file.file_type || 'pdf',
                uploader_name: file.uploader_name
            }))
        });
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách file:", error);
        res.status(500).json({ 
            success: false,
            error: "Lỗi khi lấy danh sách file",
            message: error.message 
        });
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

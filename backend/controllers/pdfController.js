const pdfModel = require("../models/pdfModel");
const openaiService = require("../services/openaiService");
const groqService = require("../services/groqService");
const langchainService = require("../services/langchainService");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const pdfParse = require("pdf-parse");
const pool = require("../config/db");
const chatModel = require("../models/chatModel");
const geminiService = require("../services/geminiService");

// Thêm các hàm helper để tái sử dụng
exports.processFile = async (buffer, fileType) => {
    let fullText = '';
    let chunks = [];

    if (fileType === 'csv') {
        const csvString = buffer.toString('utf-8');
        const rows = parseCSV(csvString);
        fullText = createASCIITable(rows);
        chunks = createCSVChunks(rows);
    } else {
        const data = await pdfParse(buffer);
        fullText = data.text
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n');
        chunks = await splitTextIntoChunks(fullText);
    }

    return { fullText, chunks };
};

exports.generateEmbeddings = async (chunks) => {
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
    
    return embeddings;
};

// Sửa lại hàm uploadFile để thêm public_space_category_id
exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Không có file được upload" });
        }

        const fileName = req.body.originalFileName || decodeURIComponent(req.file.originalname);
        const buffer = req.file.buffer;
        const fileType = fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'csv';
        const userId = req.user.id;
        const groupId = req.body.groupId;
        const subCategoryId = req.body.subCategoryId; // Thêm subCategoryId từ request
        
        // Sử dụng hàm processFile
        const { fullText, chunks } = await exports.processFile(buffer, fileType);

        // Lưu metadata với subCategoryId
        const fileId = await pdfModel.savePDFMetadata(
            fileName,
            {
                text: fullText,
                fileType: fileType,
                originalFile: buffer
            },
            userId,
            groupId,
            subCategoryId // Thêm subCategoryId vào đây
        );

        // Sử dụng hàm generateEmbeddings
        const embeddings = await exports.generateEmbeddings(chunks);
        
        // Lưu chunks và embeddings
        await pdfModel.savePDFChunks(fileId, chunks, embeddings);

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
        const page = parseInt(req.query.page) || 1;
        const category = req.query.category; // Kiểm tra xem có đúng nhận tham số này không
        const search = req.query.search;
        
        console.log("📋 Params:", { page, category, search }); // Debug để xem giá trị thực tế
        
        // Lấy thông tin người dùng từ token
        const userId = req.user.id;
        const userRoles = req.user.roles || [];
        
        // Gọi model để lấy danh sách file
        const data = await pdfModel.getAllPDFs(userId, userRoles, page, category, search);
        
        res.json({
            success: true,
            ...data
        });
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách file:", error);
        res.status(500).json({
            success: false,
            error: "Lỗi khi lấy danh sách file"
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
        const { query, roleId } = req.body;
        
        if (!query || query.trim() === '') {
            return res.status(400).json({ error: "Câu hỏi không được để trống!" });
        }

        // Lấy danh sách tất cả các file để tìm file được đề cập trong câu hỏi
        const allFiles = await pdfModel.getAllFiles();
        let priorityFileIds = [];
        
        // Kiểm tra xem câu hỏi có nhắc đến tên file nào không
        if (allFiles && allFiles.length > 0) {
            const queryLower = query.toLowerCase();
            const mentionedFiles = allFiles.filter(file => 
                queryLower.includes(file.pdf_name.toLowerCase())
            );
            
            if (mentionedFiles.length > 0) {
                priorityFileIds = mentionedFiles.map(file => file.id);
                console.log(`🔍 Đã tìm thấy file được nhắc đến trong câu hỏi: ${mentionedFiles.map(f => f.pdf_name).join(', ')}`);
            }
        }

        // Tạo embedding cho query
        const embedding = await groqService.createEmbedding(query);
        
        // Tìm kiếm các chunks phù hợp nhất (ưu tiên file được nhắc đến nếu có)
        const relevantChunks = await pdfModel.searchSimilarChunks(embedding, roleId, 10, priorityFileIds);

        if (!relevantChunks || relevantChunks.length === 0) {
            // Không tìm thấy kết quả phù hợp, sử dụng Gemini trả lời chung
            const answer = await geminiService.askGemini(query);
            
            return res.json({
                answer: answer,
                source: "AI",
                chunks: []
            });
        }

        // Tìm tất cả file liên quan từ các chunks đã tìm được
        const fileIds = [...new Set(relevantChunks.map(chunk => chunk.file_id))];
        const fileInfos = await pdfModel.getFilesInfo(fileIds);
        
        try {
            // Tạo context từ nhiều file
            let context = "Dưới đây là thông tin liên quan từ các tài liệu:\n\n";
            
            // Thêm thông tin tóm tắt về các file (chỉ dùng cho context, không hiện trong câu trả lời)
            context += "Các tài liệu liên quan:\n";
            fileInfos.forEach(file => {
                context += `- ${file.pdf_name} (${file.file_type === 'csv' ? 'Dữ liệu bảng' : 'Tài liệu PDF'})\n`;
            });
            context += "\n";
            
            // Thêm nội dung từ các chunks
            relevantChunks.forEach((chunk, index) => {
                const fileInfo = fileInfos.find(f => f.id === chunk.file_id);
                const sectionInfo = chunk.section_title ? ` [${chunk.section_title}]` : '';
                // Không thêm thẻ nguồn tài liệu vào nội dung
                context += `${chunk.content}\n\n`;
            });
            
            // Tạo prompt để gửi cho Gemini
            const prompt = `Dựa trên thông tin từ NHIỀU tài liệu sau đây, hãy trả lời câu hỏi: "${query}"\n\n${context}

Hãy trả lời câu hỏi một cách ngắn gọn, chính xác và đầy đủ dựa trên thông tin được cung cấp.
TỔNG HỢP thông tin từ TẤT CẢ các tài liệu liên quan, KHÔNG chỉ dùng tài liệu đầu tiên.
So sánh thông tin từ các tài liệu khác nhau nếu có mâu thuẫn.
KHÔNG ĐÁNH DẤU NGUỒN hay trích dẫn tên tài liệu trong câu trả lời.
Nếu thông tin trong tài liệu không đủ để trả lời, hãy nói rõ điều đó.`;

            const answer = await geminiService.askGemini(prompt);
            
            res.json({
                answer: answer,
                source: "PDF",
                files: fileInfos.map(file => ({
                    id: file.id,
                    name: file.pdf_name,
                    type: file.file_type
                })),
                chunks: relevantChunks.map(chunk => ({
                    content: chunk.content.substring(0, 200) + "...",
                    fileId: chunk.file_id,
                    fileName: fileInfos.find(f => f.id === chunk.file_id)?.pdf_name || "Unknown",
                    sectionTitle: chunk.section_title || null 
                }))
            });
        } catch (error) {
            console.error("❌ Lỗi khi xử lý kết quả:", error);
            res.status(500).json({ error: "Lỗi khi xử lý kết quả", details: error.message });
        }
    } catch (error) {
        console.error("❌ Lỗi khi tìm kiếm:", error);
        res.status(500).json({ error: "Lỗi khi tìm kiếm", details: error.message });
    }
};

// Hàm định dạng câu trả lời sang văn bản có ký tự xuống dòng thay vì HTML
const formatResponseText = (text) => {
    if (!text) return '';
    
    // Chuẩn bị text
    let formatted = text.trim();
    
    // Đảm bảo các xuống dòng được giữ nguyên
    // Không chuyển đổi thành HTML nữa
    
    // Tiêu đề đậm
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '$1');
    
    // Đảm bảo có đủ dòng trống giữa các đoạn
    formatted = formatted.replace(/\n\s*\n/g, '\n\n');
    
    console.log("📝 Văn bản đã định dạng:", formatted);
    
    return formatted;
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
                pf.pdf_name as title,
                pf.uploaded_at as "uploadedAt",
                pf.full_text as content,
                pf.file_type,
                u.fullname as author,
                psc.name as category,
                r.name as group_name,
                CEIL(LENGTH(pf.full_text) / 1000.0) as "readingTime"
            FROM pdf_files pf
            LEFT JOIN users u ON pf.uploaded_by = u.id
            LEFT JOIN public_space_categories psc ON pf.public_space_category_id = psc.id
            LEFT JOIN roles r ON pf.group_id = r.id
            WHERE pf.id = $1
        `;

        const result = await client.query(query, [pdfId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy tài liệu" });
        }

        const pdf = result.rows[0];

        res.json({
            id: pdf.id,
            title: pdf.title,
            uploadedAt: pdf.uploadedAt,
            content: pdf.content,
            author: pdf.author,
            category: pdf.category,
            groupName: pdf.group_name,
            fileType: pdf.file_type || 'pdf',
            readingTime: pdf.readingTime
        });

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

// Hàm parse CSV
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

// Hàm tính toán độ rộng cột
const calculateColumnWidths = (rows) => {
    const columnWidths = [];
    rows.forEach(row => {
        row.forEach((cell, i) => {
            const cellLines = cell.split('\n');
            const cellWidth = Math.max(...cellLines.map(line => line.length));
            columnWidths[i] = Math.max(columnWidths[i] || 0, cellWidth);
        });
    });
    return columnWidths;
};

// Hàm tạo border
const createBorder = (columnWidths) => {
    return '+' + columnWidths.map(w => '-'.repeat(w + 2)).join('+') + '+\n';
};

// Hàm format row
const formatRow = (row, columnWidths) => {
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

// Hàm tạo ASCII table
const createASCIITable = (rows) => {
    const columnWidths = calculateColumnWidths(rows);
    let table = '';
    
    table += createBorder(columnWidths);
    table += formatRow(rows[0], columnWidths);
    table += createBorder(columnWidths);
    
    for (let i = 1; i < rows.length; i++) {
        table += formatRow(rows[i], columnWidths);
        table += createBorder(columnWidths);
    }
    
    return table;
};

// Hàm tạo chunks cho CSV
const createCSVChunks = (rows) => {
    const chunks = [];
    for (let i = 0; i < rows.length; i += 3) {
        const chunkRows = rows.slice(i, Math.min(i + 3, rows.length));
        const chunk = chunkRows.map(row => row.join(' | ')).join('\n');
        chunks.push(chunk);
    }
    return chunks;
};

// Hàm split text thành chunks
const splitTextIntoChunks = async (text) => {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });
    
    const docs = await splitter.createDocuments([text]);
    return docs.map(doc => doc.pageContent);
};

// Sửa lại hàm này để trả về HTML rõ ràng hơn
const formatResponseHTML = (text) => {
    if (!text) return '';
    
    let formatted = text.trim();
    
    // Đảm bảo đầu ra có các kí tự xuống dòng rõ ràng
    formatted = formatted
        // Xử lý tiêu đề đậm
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        
        // Xử lý danh sách có số
        .replace(/(\d+)\.\s+(.*?)(?=\n|$)/g, '<div class="numbered-item"><span class="number">$1.</span> $2</div>')
        
        // Xử lý bullet points
        .replace(/\*\s+(.*?)(?=\n|$)/g, '<div class="bullet-item">• $1</div>')
        
        // Xuống dòng rõ ràng
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    // Bọc trong p nếu cần
    if (!formatted.startsWith('<p>')) {
        formatted = '<p>' + formatted + '</p>';
    }
    
    // Thêm style trực tiếp để đảm bảo xuống dòng
    formatted = `
        <div style="white-space: pre-wrap; line-height: 1.5;">
            ${formatted}
        </div>
    `;
    
    console.log("HTML đã định dạng:", formatted);
    
    return formatted;
};

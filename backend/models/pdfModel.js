const pool = require("../config/db");

// ✅ Lưu metadata file PDF vào bảng pdf_files
exports.savePDFMetadata = async (pdfName, fullText) => {
    const client = await pool.connect();
    try {
        // Kiểm tra file đã tồn tại chưa
        const checkQuery = `SELECT id FROM pdf_files WHERE pdf_name = $1`;
        const checkResult = await client.query(checkQuery, [pdfName]);

        if (checkResult.rows.length > 0) {
            console.log(`⚠️ File ${pdfName} đã tồn tại.`);
            return checkResult.rows[0].id;
        }

        // Nếu chưa tồn tại, thêm mới với full_text
        const insertQuery = `
            INSERT INTO pdf_files (pdf_name, uploaded_at, full_text)
            VALUES ($1, NOW(), $2)
            RETURNING id;
        `;
        const result = await client.query(insertQuery, [pdfName, fullText]);
        return result.rows[0].id;
    } catch (error) {
        console.error("❌ Lỗi khi lưu metadata file PDF:", error);
        throw error;
    } finally {
        client.release();
    }
};

// ✅ Lưu từng đoạn text vào bảng pdf_chunks
exports.savePDFChunks = async (pdfId, chunks, embeddings) => {
    const client = await pool.connect();
    try {
        const insertQuery = `
            INSERT INTO pdf_chunks (pdf_id, content, embedding)
            VALUES ($1, $2, $3);
        `;
        for (let i = 0; i < chunks.length; i++) {
            if (!Array.isArray(embeddings[i])) {
                console.error(`⚠️ Lỗi dữ liệu embedding:`, embeddings[i]);
                throw new Error(`Embedding tại index ${i} không phải là mảng!`);
            }

            // ✅ Chuyển embedding thành chuỗi đúng format
            const embeddingStr = `[${embeddings[i].join(",")}]`;
            await client.query(insertQuery, [pdfId, chunks[i], embeddingStr]);
        }
        console.log(`✅ Đã lưu ${chunks.length} đoạn văn bản.`);
    } catch (error) {
        console.error("❌ Lỗi khi lưu các đoạn văn bản vào database:", error);
        throw error;
    } finally {
        client.release();
    }
};

// ✅ Lấy danh sách file PDF
exports.getAllPDFs = async () => {
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT * FROM pdf_files ORDER BY uploaded_at DESC");
        return result.rows;
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách file:", error);
        throw error;
    } finally {
        client.release();
    }
};

// ✅ Xóa file PDF và các đoạn text liên quan
exports.deletePDF = async (pdfId) => {
    const client = await pool.connect();
    try {
        await client.query("DELETE FROM pdf_files WHERE id = $1", [pdfId]);
        return true;
    } catch (error) {
        console.error("❌ Lỗi khi xóa file:", error);
        return false;
    } finally {
        client.release();
    }
};

// ✅ Tìm kiếm trong database trước khi gọi AI
exports.getVectorSearchResult = async (queryEmbedding) => {
    const client = await pool.connect();
    try {
        if (!queryEmbedding || queryEmbedding.length !== 1536) {
            console.error("❌ Lỗi: Embedding query không hợp lệ.");
            return null;
        }

        const similarity_threshold = 0.5;

        const searchQuery = `
            SELECT content, (1 - (embedding <-> $1::vector)) AS similarity
            FROM pdf_chunks
            WHERE (1 - (embedding <-> $1::vector)) > $2  -- Chỉ lấy những kết quả có độ tương đồng trên mức threshold
            ORDER BY embedding <-> $1::vector
            LIMIT 3;
        `;
        const result = await client.query(searchQuery, [JSON.stringify(queryEmbedding), similarity_threshold]);

        if (result.rows.length === 0) {
            console.log("⚠️ Không có kết quả phù hợp trong database.");
            return null;
        }

        console.log(`✅ Database có ${result.rows.length} kết quả phù hợp.`);
        return result.rows.map(row => row.content).join("\n\n");
    } catch (error) {
        console.error("❌ Lỗi khi tìm kiếm vector:", error);
        return null;
    } finally {
        client.release();
    }
};





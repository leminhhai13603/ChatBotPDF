const pool = require("../config/db");

// ✅ Lưu metadata file PDF vào bảng pdf_files
exports.savePDFMetadata = async (pdfName, fullText, uploadedBy, groupId) => {
    const client = await pool.connect();
    try {
        // Kiểm tra file đã tồn tại chưa
        const checkQuery = `SELECT id FROM pdf_files WHERE pdf_name = $1 AND group_id = $2`;
        const checkResult = await client.query(checkQuery, [pdfName, groupId]);

        if (checkResult.rows.length > 0) {
            console.log(`⚠️ File ${pdfName} đã tồn tại trong nhóm ${groupId}.`);
            return checkResult.rows[0].id;
        }

        // Nếu chưa tồn tại, thêm mới với full_text, uploaded_by và group_id
        const insertQuery = `
            INSERT INTO pdf_files (pdf_name, uploaded_at, full_text, uploaded_by, group_id)
            VALUES ($1, NOW(), $2, $3, $4)
            RETURNING id;
        `;
        
        // Đảm bảo text được lưu đúng định dạng
        const sanitizedText = fullText
            .replace(/\u0000/g, '') // Loại bỏ null bytes
            .replace(/\r\n/g, '\n'); // Chuẩn hóa xuống dòng
            
        const result = await client.query(insertQuery, [pdfName, sanitizedText, uploadedBy, groupId]);
        return result.rows[0].id;
    } catch (error) {
        console.error("❌ Lỗi khi lưu metadata file PDF:", error);
        throw error;
    } finally {
        client.release();
    }
};

// ✅ Lưu các đoạn văn bản và embedding vào bảng pdf_chunks
exports.savePDFChunks = async (pdfId, chunks, embeddings, metadata = []) => {
    const client = await pool.connect();
    try {
        // Cập nhật query để lưu thêm metadata
        const insertQuery = `
            INSERT INTO pdf_chunks (
                pdf_id, content, embedding, 
                chunk_index, section_title, is_title_chunk, 
                keywords, chunk_length
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `;
        
        await client.query('BEGIN');
        
        for (let i = 0; i < chunks.length; i++) {
            if (!Array.isArray(embeddings[i])) {
                console.error(`⚠️ Lỗi dữ liệu embedding:`, embeddings[i]);
                throw new Error(`Embedding tại index ${i} không phải là mảng!`);
            }

            // Lấy metadata cho chunk này hoặc tạo metadata mặc định
            const chunkMetadata = metadata[i] || {
                chunk_index: i,
                section_title: "Không xác định",
                is_title_chunk: false,
                keywords: [],
                chunk_length: chunks[i].length
            };

            // Chuyển embedding thành chuỗi đúng format
            const embeddingStr = `[${embeddings[i].join(",")}]`;
            
            await client.query(insertQuery, [
                pdfId, 
                chunks[i], 
                embeddingStr,
                chunkMetadata.chunk_index,
                chunkMetadata.section_title,
                chunkMetadata.is_title_chunk,
                chunkMetadata.keywords,
                chunkMetadata.chunk_length
            ]);
        }
        
        await client.query('COMMIT');
        console.log(`✅ Đã lưu ${chunks.length} đoạn văn bản với metadata.`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Lỗi khi lưu các đoạn văn bản vào database:", error);
        throw error;
    } finally {
        client.release();
    }
};

// ✅ Lấy danh sách tất cả file PDF
exports.getAllPDFs = async (userId, userRoles) => {
    const client = await pool.connect();
    try {
        const isAdmin = userRoles.some(role => role.toLowerCase() === 'admin');
        let query;
        
        if (isAdmin) {
            // Admin có thể xem tất cả file
            query = `
                SELECT pf.id, pf.pdf_name, pf.uploaded_at, pf.full_text, pf.group_id,
                       u.username as uploader_name
                FROM pdf_files pf
                LEFT JOIN users u ON pf.uploaded_by = u.id
                ORDER BY pf.uploaded_at DESC;
            `;
            const result = await client.query(query);
            return result.rows;
        } else {
            // User thường chỉ xem được file của nhóm mình
            query = `
                SELECT pf.id, pf.pdf_name, pf.uploaded_at, pf.full_text, pf.group_id,
                       u.username as uploader_name
                FROM pdf_files pf
                LEFT JOIN users u ON pf.uploaded_by = u.id
                WHERE pf.group_id IN (
                    SELECT role_id FROM user_roles WHERE user_id = $1
                )
                ORDER BY pf.uploaded_at DESC;
            `;
            const result = await client.query(query, [userId]);
            return result.rows;
        }
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách PDF:", error);
        throw error;
    } finally {
        client.release();
    }
};

// ✅ Xóa file PDF và các đoạn text liên quan
exports.deletePDF = async (pdfId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Xóa các chunks trước
        await client.query('DELETE FROM pdf_chunks WHERE pdf_id = $1', [pdfId]);
        
        // Sau đó xóa file
        const result = await client.query('DELETE FROM pdf_files WHERE id = $1 RETURNING id', [pdfId]);
        
        await client.query('COMMIT');
        
        return result.rows.length > 0;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Lỗi khi xóa PDF:", error);
        throw error;
    } finally {
        client.release();
    }
};

// ✅ Tìm kiếm theo tên file
exports.searchPDFByName = async (query, userId, userRoles) => {
    const client = await pool.connect();
    try {
        const isAdmin = userRoles.some(role => role.toLowerCase() === 'admin');
        const fileSearchQuery = `
            SELECT pf.id, pf.pdf_name, pf.full_text
            FROM pdf_files pf
            WHERE LOWER(pf.pdf_name) LIKE $1
            ${!isAdmin ? `AND pf.group_id IN (SELECT role_id FROM user_roles WHERE user_id = $2)` : ''}
            LIMIT 1;
        `;
        
        const params = [`%${query.toLowerCase().replace(/\s+/g, '%')}%`];
        if (!isAdmin) params.push(userId);
        
        const fileResult = await client.query(fileSearchQuery, params);
        
        if (fileResult.rows.length > 0) {
            return fileResult.rows[0];
        }
        return null;
    } catch (error) {
        console.error("❌ Lỗi khi tìm kiếm theo tên file:", error);
        return null;
    } finally {
        client.release();
    }
};

// ✅ Tìm kiếm trong database với phân quyền
exports.getVectorSearchResultWithRoles = async (queryEmbedding, userId, userRoles) => {
    const client = await pool.connect();
    try {
        if (!queryEmbedding || queryEmbedding.length !== 1536) {
            console.error("❌ Lỗi: Embedding query không hợp lệ.");
            return null;
        }

        // Giảm ngưỡng tương đồng để tìm được nhiều kết quả hơn
        const similarity_threshold = 0.1; // Giảm từ 0.2 xuống 0.15
        const isAdmin = userRoles.some(role => role.toLowerCase() === 'admin');
        
        let searchQuery;
        
        if (isAdmin) {
            // Admin có thể tìm kiếm trong tất cả tài liệu
            searchQuery = `
                SELECT 
                    pc.content, 
                    pf.pdf_name, 
                    pf.id, 
                    pc.section_title,
                    pc.is_title_chunk,
                    pc.keywords,
                    (1 - (pc.embedding <-> $1::vector)) AS similarity
                FROM pdf_chunks pc
                JOIN pdf_files pf ON pc.pdf_id = pf.id
                WHERE (1 - (pc.embedding <-> $1::vector)) > $2
                ORDER BY 
                    pc.is_title_chunk DESC,
                    similarity DESC
                LIMIT 8; 
            `;
            
            const result = await client.query(searchQuery, [JSON.stringify(queryEmbedding), similarity_threshold]);
            
            if (result.rows.length === 0) {
                console.log("⚠️ Admin không tìm thấy kết quả phù hợp.");
                return null;
            }
            
            console.log(`✅ Admin tìm thấy ${result.rows.length} kết quả phù hợp.`);
            
            return result.rows;
        } else {
            // Lấy danh sách role_id của user
            const roleQuery = `SELECT role_id FROM user_roles WHERE user_id = $1`;
            const roleResult = await client.query(roleQuery, [userId]);
            const roleIds = roleResult.rows.map(row => row.role_id);
            
            if (roleIds.length === 0) {
                console.log("⚠️ User không có quyền truy cập tài liệu nào.");
                return null;
            }
            
            searchQuery = `
                SELECT 
                    pc.content, 
                    pf.pdf_name, 
                    pf.id, 
                    pc.section_title,
                    pc.is_title_chunk,
                    pc.keywords,
                    (1 - (pc.embedding <-> $1::vector)) AS similarity
                FROM pdf_chunks pc
                JOIN pdf_files pf ON pc.pdf_id = pf.id
                WHERE (1 - (pc.embedding <-> $1::vector)) > $2
                AND pf.group_id = ANY($3)
                ORDER BY 
                    pc.is_title_chunk DESC, -- Ưu tiên các chunk chứa tiêu đề
                    similarity DESC
                LIMIT 8; -- Tăng từ 5 lên 8
            `;
            
            const result = await client.query(searchQuery, [JSON.stringify(queryEmbedding), similarity_threshold, roleIds]);
            
            if (result.rows.length === 0) {
                console.log(`⚠️ User ${userId} không tìm thấy kết quả phù hợp.`);
                return null;
            }
            
            console.log(`✅ User ${userId} tìm thấy ${result.rows.length} kết quả phù hợp.`);
            
            return result.rows;
        }
    } catch (error) {
        console.error("❌ Lỗi khi tìm kiếm vector:", error);
        return null;
    } finally {
        client.release();
    }
};

// Thêm hàm để lấy PDF theo ID
exports.getPDFById = async (pdfId) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT * FROM pdf_files WHERE id = $1
        `;
        const result = await client.query(query, [pdfId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error("❌ Lỗi khi lấy PDF theo ID:", error);
        return null;
    } finally {
        client.release();
    }
};

exports.deleteChunks = async (pdfId) => {
    const client = await pool.connect();
    try {
        const query = `
            DELETE FROM pdf_chunks WHERE pdf_id = $1
        `;
        await client.query(query, [pdfId]);
        return true;
    } catch (error) {
        console.error("❌ Lỗi khi xóa chunks:", error);
        return false;
    } finally {
        client.release();
    }
};

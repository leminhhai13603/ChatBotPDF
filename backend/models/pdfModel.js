const pool = require("../config/db");

// ✅ Lưu metadata file PDF vào bảng pdf_files
exports.savePDFMetadata = async (fileName, fileData, uploadedBy, groupId, subCategoryId = null) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Kiểm tra file trùng với cả subCategoryId
        const checkQuery = `
            SELECT id FROM pdf_files 
            WHERE pdf_name = $1 
            AND group_id = $2 
            AND ($3::integer IS NULL OR public_space_category_id = $3)
        `;
        const checkResult = await client.query(checkQuery, [
            fileName, 
            groupId,
            subCategoryId
        ]);

        if (checkResult.rows.length > 0) {
            throw new Error(`File ${fileName} đã tồn tại trong danh mục này`);
        }

        // Lưu file mới với public_space_category_id và uploadedBy có thể là null
        const insertQuery = `
            INSERT INTO pdf_files (
                pdf_name, 
                uploaded_at, 
                full_text, 
                uploaded_by, 
                group_id, 
                file_type,
                original_file,
                public_space_category_id
            )
            VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;
        
        const result = await client.query(insertQuery, [
            fileName,
            fileData.text,
            uploadedBy, // Có thể là null cho anonymous
            groupId,
            fileData.fileType,
            fileData.originalFile,
            subCategoryId
        ]);

        await client.query('COMMIT');
        return result.rows[0].id;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Lỗi chi tiết khi lưu file:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.savePDFChunks = async (pdfId, chunks, embeddings, metadata = []) => {
    const client = await pool.connect();
    try {
        // Kiểm tra file type
        const fileTypeQuery = `SELECT file_type FROM pdf_files WHERE id = $1`;
        const fileTypeResult = await client.query(fileTypeQuery, [pdfId]);
        const fileType = fileTypeResult.rows[0]?.file_type;

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

            // Xử lý metadata khác nhau cho CSV và PDF
            const chunkMetadata = fileType === 'csv' ? {
                chunk_index: i,
                section_title: `Dòng ${i * 3 + 1} - ${Math.min((i + 1) * 3, chunks.length)}`,
                is_title_chunk: i === 0, // Dòng đầu thường là header
                keywords: extractKeywordsFromCSV(chunks[i]),
                chunk_length: chunks[i].length
            } : (metadata[i] || {
                chunk_index: i,
                section_title: "Không xác định",
                is_title_chunk: false,
                keywords: [],
                chunk_length: chunks[i].length
            });
            
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

// Hàm helper để trích xuất keywords từ chunk CSV
const extractKeywordsFromCSV = (chunk) => {
    const words = chunk.split(/[\s,|]+/);
    return words.filter(word => 
        word.length > 3 && 
        !word.match(/^\d+$/) && 
        !word.match(/^[A-Z\s]+$/)
    ).slice(0, 5);
};

// ✅ Lấy danh sách tất cả file PDF
exports.getAllPDFs = async (userId, userRoles, page = 1) => {
    const client = await pool.connect();
    try {
        const limit = 5; // Cố định 5 file mỗi trang
        const offset = (page - 1) * limit;
        const isAdmin = userRoles.includes('admin');
        
        let query = `
            WITH total AS (
                SELECT COUNT(*) as total_count
                FROM pdf_files pf
                WHERE 1=1
                ${!isAdmin ? `AND pf.group_id IN (
                    SELECT role_id FROM user_roles WHERE user_id = $1
                )` : ''}
            )
            SELECT 
                pf.id, 
                pf.pdf_name, 
                pf.uploaded_at, 
                pf.full_text,
                pf.group_id,
                pf.file_type,
                u.username as uploader_name,
                r.name as group_name,
                t.total_count
            FROM pdf_files pf
            LEFT JOIN users u ON pf.uploaded_by = u.id
            LEFT JOIN roles r ON pf.group_id = r.id
            CROSS JOIN total t
            WHERE 1=1
        `;

        const params = [];
        
        if (!isAdmin) {
            query += ` AND pf.group_id IN (
                SELECT role_id FROM user_roles WHERE user_id = $1
            )`;
            params.push(userId);
        }

        query += ` ORDER BY pf.uploaded_at DESC
                  LIMIT ${limit} 
                  OFFSET $${params.length + 1}`;
        
        params.push(offset);

        const result = await client.query(query, params);
        
        return {
            files: result.rows,
            total: parseInt(result.rows[0]?.total_count || 0),
            totalPages: Math.ceil((result.rows[0]?.total_count || 0) / limit),
            currentPage: page
        };
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

        const isAdmin = userRoles.some(role => role.toLowerCase() === 'admin');
        
        // Tối ưu query với CTE (Common Table Expression)
        let searchQuery = `
            WITH ranked_chunks AS (
                SELECT 
                    pc.content,
                    pc.section_title,
                    pc.is_title_chunk,
                    pc.keywords,
                    pf.pdf_name,
                    pf.id as pdf_id,
                    (1 - (pc.embedding <-> $1::vector)) AS similarity,
                    -- Tính điểm ưu tiên
                    CASE 
                        WHEN pc.is_title_chunk THEN 0.3
                        WHEN pc.section_title IS NOT NULL THEN 0.2
                        WHEN array_length(pc.keywords, 1) > 0 THEN 0.1
                        ELSE 0
                    END as priority_score
                FROM pdf_chunks pc
                JOIN pdf_files pf ON pc.pdf_id = pf.id
                ${!isAdmin ? 'WHERE pf.group_id = ANY($3)' : ''}
                -- Lọc sơ bộ để giảm số lượng rows cần xử lý
                WHERE (1 - (pc.embedding <-> $1::vector)) > $2
            )
            SELECT 
                content,
                pdf_name,
                pdf_id,
                section_title,
                is_title_chunk,
                keywords,
                similarity,
                -- Tính điểm tổng hợp
                (similarity + priority_score) as final_score
            FROM ranked_chunks
            ORDER BY final_score DESC
            LIMIT 8;
        `;

        const similarity_threshold = 0.1;
        const params = [JSON.stringify(queryEmbedding), similarity_threshold];

        if (!isAdmin) {
            const roleQuery = `SELECT role_id FROM user_roles WHERE user_id = $1`;
            const roleResult = await client.query(roleQuery, [userId]);
            const roleIds = roleResult.rows.map(row => row.role_id);
            params.push(roleIds);
        }

        const result = await client.query(searchQuery, params);

        if (result.rows.length === 0) {
            // Thử tìm kiếm với ngưỡng thấp hơn
            const fallbackQuery = `
                SELECT 
                    pc.content,
                    pf.pdf_name,
                    pf.id as pdf_id,
                    pc.section_title,
                    pc.is_title_chunk,
                    pc.keywords,
                    (1 - (pc.embedding <-> $1::vector)) AS similarity
                FROM pdf_chunks pc
                JOIN pdf_files pf ON pc.pdf_id = pf.id
                ${!isAdmin ? 'WHERE pf.group_id = ANY($3)' : ''}
                ORDER BY pc.embedding <-> $1::vector
                LIMIT 3;
            `;

            const fallbackResult = await client.query(fallbackQuery, params);
            if (fallbackResult.rows.length > 0) {
                console.log("⚠️ Sử dụng kết quả fallback với độ tương đồng thấp hơn");
                return fallbackResult.rows;
            }
            return null;
        }

        // Gom nhóm các đoạn liên quan
        const groupedResults = result.rows.reduce((acc, row) => {
            const existingGroup = acc.find(g => g.pdf_id === row.pdf_id);
            if (existingGroup) {
                existingGroup.chunks.push({
                    content: row.content,
                    similarity: row.similarity,
                    section_title: row.section_title
                });
            } else {
                acc.push({
                    pdf_id: row.pdf_id,
                    pdf_name: row.pdf_name,
                    chunks: [{
                        content: row.content,
                        similarity: row.similarity,
                        section_title: row.section_title
                    }]
                });
            }
            return acc;
        }, []);

        console.log(`✅ Tìm thấy ${groupedResults.length} tài liệu phù hợp`);
        return groupedResults;

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

exports.getPDFDetails = async (pdfId, userId, userRoles) => {
    const client = await pool.connect();
    try {
        const isAdmin = userRoles.includes('admin');
        
        const query = `
            SELECT 
                pf.id,
                pf.pdf_name,
                pf.uploaded_at,
                pf.full_text as content,
                pf.group_id,
                u.fullname as uploaded_by_name,
                c.name as category_name,
                ARRAY_AGG(DISTINCT pc.section_title) FILTER (WHERE pc.section_title IS NOT NULL) as sections,
                ARRAY_AGG(DISTINCT pc.keywords) FILTER (WHERE pc.keywords IS NOT NULL) as keywords
            FROM pdf_files pf
            LEFT JOIN users u ON pf.uploaded_by = u.id
            LEFT JOIN categories c ON pf.category_id = c.id
            LEFT JOIN pdf_chunks pc ON pf.id = pc.pdf_id
            WHERE pf.id = $1
            ${!isAdmin ? 'AND pf.group_id = ANY($2)' : ''}
            GROUP BY pf.id, u.fullname, c.name
        `;

        const params = isAdmin ? [pdfId] : [pdfId, userRoles];
        const result = await client.query(query, params);

        if (result.rows.length === 0) {
            return null;
        }

        const pdf = result.rows[0];
        return {
            id: pdf.id,
            title: pdf.pdf_name,
            uploadedAt: pdf.uploaded_at,
            content: pdf.content,
            groupId: pdf.group_id,
            author: pdf.uploaded_by_name,
            category: pdf.category_name,
            sections: pdf.sections || [],
            keywords: pdf.keywords || [],
            readingTime: Math.ceil(pdf.content.split(' ').length / 200) // Ước tính thời gian đọc
        };

    } catch (error) {
        console.error("❌ Lỗi khi lấy chi tiết PDF:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.getPDFsByCategory = async (categoryId, userId, userRoles) => {
    const client = await pool.connect();
    try {
        const isAdmin = userRoles.includes('admin');
        
        const query = `
            SELECT 
                pf.id,
                pf.pdf_name as title,
                pf.uploaded_at,
                LEFT(pf.full_text, 300) as excerpt,
                pf.group_id,
                u.fullname as author,
                c.name as category,
                (
                    SELECT ARRAY_AGG(DISTINCT keywords) 
                    FROM pdf_chunks 
                    WHERE pdf_id = pf.id AND keywords IS NOT NULL
                ) as keywords
            FROM pdf_files pf
            LEFT JOIN users u ON pf.uploaded_by = u.id
            LEFT JOIN categories c ON pf.category_id = c.id
            WHERE ${categoryId ? 'pf.category_id = $1' : 'pf.category_id IS NOT NULL'}
            ${!isAdmin ? 'AND pf.group_id = ANY($2)' : ''}
            GROUP BY pf.id, u.fullname, c.name
            ORDER BY pf.uploaded_at DESC
        `;

        const params = categoryId 
            ? (isAdmin ? [categoryId] : [categoryId, userRoles])
            : (isAdmin ? [] : [userRoles]);

        const result = await client.query(query, params);

        return result.rows.map(pdf => ({
            id: pdf.id,
            title: pdf.title,
            excerpt: pdf.excerpt + '...',
            uploadedAt: pdf.uploaded_at,
            author: pdf.author,
            category: pdf.category,
            keywords: pdf.keywords || [],
            readingTime: Math.ceil(pdf.excerpt.split(' ').length / 200)
        }));

    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách PDF theo category:", error);
        throw error;
    } finally {
        client.release();
    }
};

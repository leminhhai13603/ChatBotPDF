const pool = require("../config/db");
const pdfModel = require("./pdfModel");
const pdfParse = require('pdf-parse');

exports.getAllCategories = async () => {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                r.id,
                r.name,
                COUNT(pf.id) as file_count
            FROM roles r
            LEFT JOIN pdf_files pf ON r.id = pf.group_id
            GROUP BY r.id, r.name
            ORDER BY r.id ASC
        `);
        return result.rows;
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.createCategory = async (name) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'INSERT INTO roles (name) VALUES ($1) RETURNING id',
            [name]
        );
        return result.rows[0].id;
    } catch (error) {
        console.error("❌ Lỗi khi tạo danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.updateCategory = async (id, name) => {
    const client = await pool.connect();
    try {
        await client.query(
            'UPDATE roles SET name = $1 WHERE id = $2',
            [name, id]
        );
    } catch (error) {
        console.error("❌ Lỗi khi cập nhật danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.deleteCategory = async (id) => {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM roles WHERE id = $1', [id]);
    } catch (error) {
        console.error("❌ Lỗi khi xóa danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.checkCategoryHasFiles = async (id) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT EXISTS(SELECT 1 FROM pdf_files WHERE group_id = $1)',
            [id]
        );
        return result.rows[0].exists;
    } catch (error) {
        console.error("❌ Lỗi khi kiểm tra danh mục có file:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.getAllPublicSpaceCategories = async () => {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT id, name, description, created_at
            FROM public_space_categories
            ORDER BY id ASC
        `);
        return result.rows;
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.getPublicSpaceRole = async () => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT id, name FROM roles WHERE name ILIKE $1',
            ['%không gian chung%']
        );
        return result.rows[0];
    } catch (error) {
        console.error("❌ Lỗi khi lấy thông tin Không gian chung:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.getSubCategoryByName = async (name) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT id, name FROM public_space_categories WHERE name = $1',
            [name]
        );
        return result.rows[0];
    } catch (error) {
        console.error("❌ Lỗi khi lấy thông tin danh mục con:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.savePDFWithCategory = async (pdfData) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Trích xuất text từ PDF bằng pdf-parse
        let extractedText = '';
        try {
            const pdfResult = await pdfParse(pdfData.content);
            extractedText = pdfResult.text
                .replace(/\u0000/g, '') // Xóa null bytes
                .replace(/\r\n/g, '\n') // Chuẩn hóa line endings
                .trim();
        } catch (error) {
            console.error("⚠️ Lỗi khi trích xuất text từ PDF:", error);
            extractedText = "Không thể trích xuất nội dung từ file PDF này.";
        }

        // Sử dụng pdfModel để lưu file với text đã được xử lý
        const pdfId = await pdfModel.savePDFMetadata(
            pdfData.fileName,
            extractedText,
            pdfData.userId,
            pdfData.groupId
        );

        // Cập nhật thông tin danh mục
        await client.query(`
            UPDATE pdf_files 
            SET public_space_category_id = $1
            WHERE id = $2
        `, [pdfData.subCategoryId, pdfId]);

        await client.query('COMMIT');
        return { id: pdfId, pdf_name: pdfData.fileName };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Lỗi khi lưu PDF:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.updatePDFCategory = async (pdfId, categoryId) => {
    const client = await pool.connect();
    try {
        await client.query(
            'UPDATE pdf_files SET public_space_category_id = $1 WHERE id = $2',
            [categoryId, pdfId]
        );
    } catch (error) {
        console.error("❌ Lỗi khi cập nhật danh mục cho PDF:", error);
        throw error;
    } finally {
        client.release();
    }
};

exports.getPDFsBySubCategory = async (subCategory) => {
    const client = await pool.connect();
    try {
        // Lấy thông tin danh mục con
        const subCategoryInfo = await exports.getSubCategoryByName(subCategory);
        if (!subCategoryInfo) {
            throw new Error("Không tìm thấy danh mục!");
        }

        // Lấy danh sách PDF theo danh mục con
        const query = `
            SELECT 
                pf.id,
                pf.pdf_name as title,
                pf.uploaded_at as "uploadedAt",
                LEFT(pf.full_text, 300) as excerpt,
                u.fullname as author,
                psc.name as category,
                CEIL(LENGTH(pf.full_text) / 1000.0) as "readingTime",
                pf.file_type
            FROM pdf_files pf
            LEFT JOIN users u ON pf.uploaded_by = u.id
            LEFT JOIN public_space_categories psc ON pf.public_space_category_id = psc.id
            WHERE pf.public_space_category_id = $1
            ORDER BY pf.uploaded_at DESC
        `;
        
        const result = await client.query(query, [subCategoryInfo.id]);
        return result.rows.map(row => ({
            ...row,
            excerpt: row.excerpt + '...'
        }));
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách PDF theo danh mục:", error);
        throw error;
    } finally {
        client.release();
    }
};
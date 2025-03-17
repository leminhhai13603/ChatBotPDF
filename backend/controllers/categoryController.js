const categoryModel = require("../models/categoryModel");
const pdfModel = require("../models/pdfModel");
const pdfController = require("../controllers/pdfController");

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await categoryModel.getAllCategories();
        res.json(categories);
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách danh mục:", error);
        res.status(500).json({ error: "Lỗi khi lấy danh sách danh mục" });
    }
};

exports.createCategory = async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Tên danh mục không được để trống!" });
    }

    try {
        const categoryId = await categoryModel.createCategory(name, description);
        res.json({ 
            message: "Tạo danh mục thành công!", 
            categoryId 
        });
    } catch (error) {
        console.error("❌ Lỗi khi tạo danh mục:", error);
        res.status(500).json({ error: "Lỗi khi tạo danh mục" });
    }
};

exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Tên danh mục không được để trống!" });
    }

    try {
        await categoryModel.updateCategory(id, name, description);
        res.json({ message: "Cập nhật danh mục thành công!" });
    } catch (error) {
        console.error("❌ Lỗi khi cập nhật danh mục:", error);
        res.status(500).json({ error: "Lỗi khi cập nhật danh mục" });
    }
};

exports.deleteCategory = async (req, res) => {
    const { id } = req.params;

    try {
        // Kiểm tra xem danh mục có PDF nào không
        const hasFiles = await categoryModel.checkCategoryHasFiles(id);
        if (hasFiles) {
            return res.status(400).json({ 
                error: "Không thể xóa danh mục đang chứa tài liệu!" 
            });
        }

        await categoryModel.deleteCategory(id);
        res.json({ message: "Xóa danh mục thành công!" });
    } catch (error) {
        console.error("❌ Lỗi khi xóa danh mục:", error);
        res.status(500).json({ error: "Lỗi khi xóa danh mục" });
    }
};

exports.getSubCategories = async (req, res) => {
    try {
        const subCategories = await categoryModel.getAllPublicSpaceCategories();
        res.json(subCategories);
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách danh mục con:", error);
        res.status(500).json({ error: "Lỗi server" });
    }
};

exports.getPDFsByCategory = async (req, res) => {
    try {
        const { subCategory } = req.params;
        
        if (!subCategory) {
            return res.status(400).json({ error: "Thiếu thông tin danh mục!" });
        }

        const pdfs = await categoryModel.getPDFsBySubCategory(subCategory);
        res.json(pdfs);
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách PDF:", error);
        res.status(500).json({ error: "Lỗi server" });
    }
};

exports.uploadPDFToCategory = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Không tìm thấy file!" });
        }

        const { originalFileName, subCategory } = req.body;
        const userId = req.user.id;
        
        // Lấy thông tin danh mục con
        const subCategoryInfo = await categoryModel.getSubCategoryByName(subCategory);
        if (!subCategoryInfo) {
            return res.status(404).json({ error: "Không tìm thấy danh mục!" });
        }

        // Kiểm tra nếu là hộp thư góp ý
        const isAnonymous = subCategoryInfo.name === 'Hộp thư góp ý';

        // Chuẩn bị dữ liệu file
        const fileName = originalFileName || decodeURIComponent(req.file.originalname);
        const buffer = req.file.buffer;
        const fileType = fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'csv';

        // Gọi hàm xử lý file từ pdfController
        const { fullText, chunks } = await pdfController.processFile(buffer, fileType);

        // Lấy ID của "Không gian chung"
        const publicSpaceRole = await categoryModel.getPublicSpaceRole();
        if (!publicSpaceRole) {
            return res.status(404).json({ error: "Không tìm thấy không gian chung!" });
        }

        // Lưu metadata file với userId là null nếu anonymous
        const fileId = await pdfModel.savePDFMetadata(
            fileName,
            {
                text: fullText,
                fileType: fileType,
                originalFile: buffer
            },
            isAnonymous ? null : userId,
            publicSpaceRole.id,
            subCategoryInfo.id
        );

        // Tạo embeddings cho chunks
        const embeddings = await pdfController.generateEmbeddings(chunks);
        
        // Lưu chunks và embeddings
        await pdfModel.savePDFChunks(fileId, chunks, embeddings);

        res.status(201).json({
            message: "Upload file thành công!",
            fileId,
            fileName
        });

    } catch (error) {
        console.error("❌ Lỗi chi tiết:", error);
        res.status(500).json({ 
            error: "Lỗi khi upload file",
            details: error.message 
        });
    }
}; 
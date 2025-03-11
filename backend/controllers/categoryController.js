const categoryModel = require("../models/categoryModel");

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
        const subCategories = await categoryModel.getSubCategories();
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
        console.log("📝 Request body:", req.body);
        console.log("📎 File info:", req.file);

        if (!req.file) {
            return res.status(400).json({ error: "Không tìm thấy file PDF!" });
        }

        const { originalFileName, subCategory } = req.body;
        
        if (!subCategory) {
            return res.status(400).json({ error: "Thiếu thông tin danh mục!" });
        }

        const userId = req.user.id;

        // Backend tự lấy ID của "Không gian chung"
        const publicSpaceRole = await categoryModel.getPublicSpaceRole();
        console.log("🏢 Public Space Role:", publicSpaceRole);

        if (!publicSpaceRole) {
            return res.status(404).json({ error: "Không tìm thấy không gian chung!" });
        }

        // Lấy thông tin danh mục con
        const subCategoryInfo = await categoryModel.getSubCategoryByName(subCategory);
        console.log("📂 Sub Category Info:", subCategoryInfo);

        if (!subCategoryInfo) {
            return res.status(404).json({ error: "Không tìm thấy danh mục!" });
        }

        // Xử lý file PDF và lưu vào database
        const pdfData = {
            fileName: originalFileName || req.file.originalname,
            content: req.file.buffer,
            userId: userId,
            groupId: publicSpaceRole.id,
            subCategoryId: subCategoryInfo.id
        };

        console.log("📤 Saving PDF with data:", {
            fileName: pdfData.fileName,
            userId: pdfData.userId,
            groupId: pdfData.groupId,
            subCategoryId: pdfData.subCategoryId
        });

        const result = await categoryModel.savePDFWithCategory(pdfData);

        res.status(201).json({
            message: "Upload file thành công!",
            data: result
        });

    } catch (error) {
        console.error("❌ Lỗi chi tiết:", error);
        res.status(500).json({ 
            error: "Lỗi khi upload file",
            details: error.message 
        });
    }
}; 
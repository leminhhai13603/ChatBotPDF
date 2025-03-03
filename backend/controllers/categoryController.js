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
const projectModel = require("../models/projectModel");

exports.createProject = async (req, res) => {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name) {
        return res.status(400).json({ error: "Tên dự án không được để trống!" });
    }

    try {
        const projectId = await projectModel.createProject(name, userId);
        res.json({ message: "Tạo dự án thành công!", projectId });
    } catch (error) {
        console.error("Lỗi tạo dự án:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

exports.getUserProjects = async (req, res) => {
    const userId = req.user.id;

    try {
        const projects = await projectModel.getProjectsByUserId(userId);
        res.json(projects);
    } catch (error) {
        console.error("Lỗi lấy dự án:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

exports.deleteProject = async (req, res) => {
    const { id } = req.params;

    try {
        await projectModel.deleteProject(id);
        res.json({ message: "Xóa dự án thành công!" });
    } catch (error) {
        console.error("Lỗi xóa dự án:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
}; 
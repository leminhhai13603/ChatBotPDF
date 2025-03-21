const projectModel = require("../models/projectModel");

exports.createProject = async (req, res) => {
    try {
        const { name, category } = req.body;
        // Kiểm tra token và userId
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: "Không tìm thấy token xác thực!" });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn!" });
        }

        if (!name) {
            return res.status(400).json({ error: "Tên dự án không được để trống!" });
        }

        const projectId = await projectModel.createProject(name, userId, category);
        res.json({ message: "Tạo dự án thành công!", projectId });
    } catch (error) {
        console.error("Lỗi tạo dự án:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

exports.getUserProjects = async (req, res) => {
    try {
        // Thêm kiểm tra token
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: "Không tìm thấy token xác thực!" });
        }

        // Kiểm tra và lấy userId từ token
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn!" });
        }
        
        // Kiểm tra vai trò admin
        const isAdmin = req.user.roles.includes('admin');
        
        let projects;
        if (isAdmin) {
            // Admin xem tất cả dự án
            projects = await projectModel.getAllProjects();
        } else {
            // User thường chỉ xem dự án của mình
            projects = await projectModel.getProjectsByUserId(userId);
        }

        res.json(projects);
    } catch (error) {
        console.error("Lỗi lấy dự án:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        // Kiểm tra token và userId
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: "Không tìm thấy token xác thực!" });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn!" });
        }

        await projectModel.deleteProject(id);
        res.json({ message: "Xóa dự án thành công!" });
    } catch (error) {
        console.error("Lỗi xóa dự án:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
};

// Thêm controller cập nhật dự án
exports.updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category } = req.body;
        
        // Kiểm tra token và userId
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: "Không tìm thấy token xác thực!" });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn!" });
        }

        if (!name) {
            return res.status(400).json({ error: "Tên dự án không được để trống!" });
        }

        const updatedProject = await projectModel.updateProject(id, name, category);
        res.json({ 
            message: "Cập nhật dự án thành công!", 
            project: updatedProject 
        });
    } catch (error) {
        console.error("Lỗi cập nhật dự án:", error);
        res.status(500).json({ error: "Lỗi máy chủ" });
    }
}; 
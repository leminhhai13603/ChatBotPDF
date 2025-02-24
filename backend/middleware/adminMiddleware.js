module.exports = (req, res, next) => {
    // Kiểm tra xem user đã đăng nhập chưa và có role không
    if (!req.user || !req.user.role) {
        return res.status(401).json({ error: "Bạn chưa đăng nhập!" });
    }

    // Kiểm tra quyền admin
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Bạn không có quyền truy cập!" });
    }

    next(); // Cho phép tiếp tục nếu là admin
};

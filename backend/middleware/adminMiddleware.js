module.exports = (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles)) {
        return res.status(403).json({ error: "Bạn không có quyền truy cập!" });
    }

    if (!req.user.roles.includes("admin")) {
        return res.status(403).json({ error: "Bạn không có quyền truy cập!" });
    }

    next(); 
};

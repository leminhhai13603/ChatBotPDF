const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: "Không có token xác thực" });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Token không hợp lệ" });
        }
    
        req.user = {
            ...user,
            roles: user.roles || []
        };
        
        // Chuyển đổi roles thành mảng nếu nó là string
        if (typeof req.user.roles === 'string') {
            req.user.roles = [req.user.roles];
        }
        
        next();
    });
};

module.exports = authenticateToken;

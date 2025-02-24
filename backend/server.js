const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const pdfRoutes = require("./routes/pdfRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// ✅ Đăng ký routes
app.use("/api/pdf", pdfRoutes);
app.use("/api/auth", authRoutes);

// ✅ Xử lý lỗi 404 (Không tìm thấy route)
app.use((req, res) => {
    res.status(404).json({ error: "Không tìm thấy route này!" });
});

// ✅ Khởi động server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});

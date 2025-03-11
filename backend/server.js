const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const pdfRoutes = require("./routes/pdfRoutes");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const sheetRoutes = require('./routes/sheetRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// ✅ Đăng ký routes
app.use("/api/pdf", pdfRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use('/api/sheets', sheetRoutes);

app.use((req, res) => {
    res.status(404).json({ error: "Không tìm thấy route này!" });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});

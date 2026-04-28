const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// صفحة الإدارة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// بوابة الطالب
app.get('/student', (req, res) => {
    res.sendFile(path.join(__dirname, 'student.html'));
});

// ملاحظة: جميع العمليات الحالية تتم مباشرة عبر Supabase من المتصفح
// لا توجد حاجة للاتصال بـ Google Docs أو Google Drive بعد الآن

if (process.env.NODE_ENV !== 'production') {
    const server = app.listen(PORT, () => {
        console.log(`\n🚀 Scout Pulse System Started!`);
        console.log(`📍 Local URL: http://localhost:${PORT}`);
        console.log(`✅ Backend: Connected to Supabase directly.\n`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n❌ Error: Port ${PORT} is already in use.`);
            console.error(`💡 Please close other applications running on this port or change the PORT in server.js.\n`);
        } else {
            console.error(`\n❌ Server Error:`, err);
        }
        process.exit(1);
    });
}

module.exports = app;

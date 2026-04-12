// ============================================
// ROUTES/MESSAGES.JS - Gửi/Nhận tin nhắn
// ============================================
const express = require('express');
const authenticateToken = require('../middleware/auth');
const { getPool } = require('../database');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

// Tất cả routes đều yêu cầu đăng nhập
router.use(authenticateToken);

/**
 * Hàm giả lập gọi API từ UTH Portal để lấy dữ liệu theo MSSV
 * (Sau này bạn có thể thay bằng axios.get('https://api.uth.edu.vn/...'))
 * @param {string} mssv - Mã số sinh viên
 */
async function fetchDataFromPortal(mssv, type) {
  // Giả lập độ trễ mạng khi gọi API
  await new Promise(resolve => setTimeout(resolve, 500));

  // Dữ liệu mock (tưởng tượng portal trả về như thế này)
  if (type === 'schedule') {
    return [
      { date: '14/4/2026', subject: 'Lập trình Web', room: 'C.201', time: '07:30' },
      { date: '15/4/2026', subject: 'Mạng máy tính', room: 'A.105', time: '13:00' },
      { date: '16/4/2026', subject: 'Cơ sở dữ liệu', room: 'B.302', time: '09:00' },
      { date: '18/4/2026', subject: 'Trí tuệ nhân tạo', room: 'C.305', time: '13:00' },
    ];
  }

  if (type === 'exam') {
    // Trả về danh sách bài kiểm tra / lịch thi sắp tới
    return [
      { date: '20/04/2026', subject: 'Kiểm tra Giữa kỳ - Lập trình Web', room: 'H.101', time: '08:00' },
      { date: '22/04/2026', subject: 'Kiểm tra Giữa kỳ - Mạng máy tính', room: 'H.202', time: '13:30' },
      { date: '25/04/2026', subject: 'Thi Cuối kỳ - Cơ sở dữ liệu', room: 'H.305', time: '07:30' },
    ];
  }

  return [];
}

/**
 * Tạo phản hồi từ Bot sử dụng Google Gemini AI và dữ liệu Portal
 * @param {string} userMessage - Tin nhắn của người dùng
 * @param {object} studentInfo - Thông tin sinh viên (từ req.student)
 * @returns {object} - { text, type, data }
 */
async function generateBotResponse(userMessage, studentInfo) {
  const lowerMsg = userMessage.toLowerCase();
  
  // ==========================================================
  // 1. XỬ LÝ CÁC TỪ KHÓA ĐẶC BIỆT CẦN DỮ LIỆU TỪ PORTAL
  // ==========================================================

  // A. Lịch học / Thời khóa biểu
  if (lowerMsg.includes('lịch học') || lowerMsg.includes('thời khóa biểu')) {
    try {
      // Gọi "API" lấy lịch học dựa trên mssv của sinh viên đang chat
      const scheduleData = await fetchDataFromPortal(studentInfo.mssv, 'schedule');
      
      return {
        text: `Đây là lịch học tuần này của bạn (MSSV: ${studentInfo.mssv}), được lấy từ UTH Portal:`,
        type: 'TABLE',
        data: scheduleData,
      };
    } catch (error) {
      return { text: 'Lỗi khi lấy dữ liệu từ Portal. Vui lòng thử lại sau!', type: 'TEXT', data: null };
    }
  }

  // B. Bài kiểm tra / Lịch thi
  if (lowerMsg.includes('kiểm tra') || lowerMsg.includes('lịch thi')) {
    try {
      const examData = await fetchDataFromPortal(studentInfo.mssv, 'exam');
      
      return {
        text: `Nhắc nhở: Bạn có ${examData.length} bài kiểm tra/thi sắp tới. Hãy chuẩn bị kỹ nhé!`,
        type: 'TABLE',
        data: examData,
      };
    } catch (error) {
      return { text: 'Lỗi khi lấy dữ liệu từ Portal. Vui lòng thử lại sau!', type: 'TEXT', data: null };
    }
  }

  // ==========================================================
  // 2. TÍCH HỢP GEMINI AI CHO CÁC CÂU HỎI KHÁC
  // ==========================================================
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("Chưa cấu hình GEMINI_API_KEY trong .env");
      return {
        text: "Hệ thống AI chưa được cấu hình khóa API. Vui lòng liên hệ quản trị viên.",
        type: 'TEXT',
        data: null
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    
    // Prompt ngữ cảnh cho AI biết nó đang nói chuyện với ai
    const prompt = `Bạn là trợ lý ảo hỗ trợ sinh viên của trường Đại học Giao thông Vận tải TP.HCM (UTH). 
Người đang hỏi bạn là sinh viên tên ${studentInfo.display_name} (MSSV: ${studentInfo.mssv}).
Hãy trả lời thân thiện, ngắn gọn, và xưng hô "mình" và "bạn". 
Câu hỏi của sinh viên: "${userMessage}"`;
    
    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();

    return { 
      text: textResponse, 
      type: 'TEXT', 
      data: null 
    };

  } catch (error) {
    console.error('Lỗi Gemini API:', error);
    return {
      text: "Xin lỗi, hiện tại tui đang bị bịnh hoặc không vui. Vui lòng thử lại sau nhé!",
      type: 'TEXT',
      data: null,
    };
  }
}

/**
 * POST /api/conversations/:id/messages
 * Gửi tin nhắn mới trong cuộc hội thoại
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const pool = getPool();
    const conversationId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tin nhắn không được để trống.' 
      });
    }

    // 1. Kiểm tra conversation thuộc về sinh viên này không
    const [convRows] = await pool.execute(
      'SELECT * FROM conversations WHERE id = ? AND student_id = ?',
      [conversationId, req.student.id]
    );

    if (convRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy cuộc hội thoại.' 
      });
    }

    // 2. Lấy thông tin sinh viên để truyền vào Bot (để Bot biết tên/MSSV)
    const [studentRows] = await pool.execute(
      'SELECT mssv, display_name FROM students WHERE id = ?',
      [req.student.id]
    );
    const studentInfo = studentRows[0];

    // 3. Lưu tin nhắn của user
    const [userResult] = await pool.execute(
      'INSERT INTO messages (conversation_id, role, text, type) VALUES (?, ?, ?, ?)',
      [conversationId, 'user', text.trim(), 'TEXT']
    );

    // 4. Cập nhật title nếu đây là tin nhắn đầu tiên của user
    const [msgCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND role = "user"',
      [conversationId]
    );

    if (msgCount[0].count === 1) {
      const title = text.trim().substring(0, 50) + (text.trim().length > 50 ? '...' : '');
      await pool.execute(
        'UPDATE conversations SET title = ? WHERE id = ?',
        [title, conversationId]
      );
    }

    // 5. Tạo phản hồi từ bot (truyền thêm studentInfo vào để gọi Portal & Gemini)
    const botResponse = await generateBotResponse(text.trim(), studentInfo);

    // 6. Lưu tin nhắn bot vào database
    const [botResult] = await pool.execute(
      'INSERT INTO messages (conversation_id, role, text, type, data) VALUES (?, ?, ?, ?, ?)',
      [conversationId, 'bot', botResponse.text, botResponse.type, botResponse.data ? JSON.stringify(botResponse.data) : null]
    );

    // 7. Cập nhật thời gian conversation
    await pool.execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    // Trả về response cho Frontend
    res.status(201).json({
      success: true,
      userMessage: {
        id: userResult.insertId,
        role: 'user',
        text: text.trim(),
        type: 'TEXT',
        data: null,
      },
      botMessage: {
        id: botResult.insertId,
        role: 'bot',
        text: botResponse.text,
        type: botResponse.type,
        data: botResponse.data,
      },
    });
  } catch (error) {
    console.error('Lỗi gửi tin nhắn:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

module.exports = router;
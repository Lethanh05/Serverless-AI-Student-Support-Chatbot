// ============================================
// ROUTES/MESSAGES.JS - Gửi/Nhận tin nhắn
// ============================================
const express = require('express');
const authenticateToken = require('../middleware/auth');
const { getPool } = require('../database');

const router = express.Router();

// Tất cả routes đều yêu cầu đăng nhập
router.use(authenticateToken);

/**
 * Tạo phản hồi từ Bot (tạm thời - sau này thay bằng Gemini API)
 * @param {string} userMessage - Tin nhắn của người dùng
 * @returns {object} - { text, type, data }
 */
async function generateBotResponse(userMessage) {
  // =============================================
  // TODO: Tích hợp Gemini API ở đây
  // const { GoogleGenerativeAI } = require('@google/generative-ai');
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  // const result = await model.generateContent(userMessage);
  // return { text: result.response.text(), type: 'TEXT', data: null };
  // =============================================

  const lowerMsg = userMessage.toLowerCase();

  // Phản hồi tĩnh dựa trên từ khóa (mô phỏng)
  if (lowerMsg.includes('lịch học') || lowerMsg.includes('thời khóa biểu')) {
    return {
      text: 'Đây là lịch học tuần này của bạn:',
      type: 'TABLE',
      data: [
        { date: '14/4/2026', subject: 'Lập trình Web', room: 'C.201', time: '07:30' },
        { date: '15/4/2026', subject: 'Mạng máy tính', room: 'A.105', time: '13:00' },
        { date: '16/4/2026', subject: 'Cơ sở dữ liệu', room: 'B.302', time: '09:00' },
      ],
    };
  }

  if (lowerMsg.includes('điểm') || lowerMsg.includes('kết quả')) {
    return {
      text: 'Đây là bảng điểm học kỳ gần nhất của bạn:',
      type: 'TABLE',
      data: [
        { subject: 'Lập trình Web', score: '8.5', grade: 'A' },
        { subject: 'Mạng máy tính', score: '7.0', grade: 'B' },
        { subject: 'Cơ sở dữ liệu', score: '9.0', grade: 'A+' },
      ],
    };
  }

  if (lowerMsg.includes('phòng thi') || lowerMsg.includes('lịch thi')) {
    return {
      text: 'Lịch thi sắp tới của bạn:',
      type: 'TABLE',
      data: [
        { date: '20/5/2026', subject: 'Lập trình Web', room: 'H.101', time: '08:00' },
        { date: '22/5/2026', subject: 'Mạng máy tính', room: 'H.202', time: '13:30' },
      ],
    };
  }

  if (lowerMsg.includes('học phí') || lowerMsg.includes('công nợ')) {
    return {
      text: 'Thông tin học phí của bạn: Học kỳ 2 năm 2025-2026, tổng học phí: 12.500.000 VNĐ. Trạng thái: Đã đóng đủ ✅',
      type: 'TEXT',
      data: null,
    };
  }

  // Phản hồi mặc định
  return {
    text: `Bạn vừa hỏi về "${userMessage}". Hiện tại mình đang kết nối dữ liệu từ UTH Portal. Bạn có thể hỏi về: lịch học, điểm số, phòng thi, hoặc học phí nhé!`,
    type: 'TEXT',
    data: null,
  };
}

/**
 * POST /api/conversations/:id/messages
 * Gửi tin nhắn mới trong cuộc hội thoại
 * Body: { text: string }
 * Response: { success, userMessage, botMessage }
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

    // Kiểm tra conversation thuộc về sinh viên này
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

    // 1. Lưu tin nhắn của user
    const [userResult] = await pool.execute(
      'INSERT INTO messages (conversation_id, role, text, type) VALUES (?, ?, ?, ?)',
      [conversationId, 'user', text.trim(), 'TEXT']
    );

    // 2. Cập nhật title nếu đây là tin nhắn đầu tiên của user
    const [msgCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND role = "user"',
      [conversationId]
    );

    if (msgCount[0].count === 1) {
      // Cắt title tối đa 50 ký tự
      const title = text.trim().substring(0, 50) + (text.trim().length > 50 ? '...' : '');
      await pool.execute(
        'UPDATE conversations SET title = ? WHERE id = ?',
        [title, conversationId]
      );
    }

    // 3. Tạo phản hồi từ bot
    const botResponse = await generateBotResponse(text.trim());

    // 4. Lưu tin nhắn bot vào database
    const [botResult] = await pool.execute(
      'INSERT INTO messages (conversation_id, role, text, type, data) VALUES (?, ?, ?, ?, ?)',
      [conversationId, 'bot', botResponse.text, botResponse.type, botResponse.data ? JSON.stringify(botResponse.data) : null]
    );

    // 5. Cập nhật thời gian conversation
    await pool.execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    // Trả về cả tin nhắn user và bot
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
    console.error('❌ Lỗi gửi tin nhắn:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
});

module.exports = router;

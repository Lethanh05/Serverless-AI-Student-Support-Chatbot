const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const authenticateToken = require('../middleware/auth');
const { getPool } = require('../database');
const { decrypt } = require('../crypto');

const router = express.Router();
router.use(authenticateToken);
const PYTHON_SERVICE_URL = (process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

function isScheduleQuery(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes('lich hoc') ||
    lower.includes('lịch học') ||
    lower.includes('thoi khoa bieu') ||
    lower.includes('thời khóa biểu') ||
    lower.includes('lich thi') ||
    lower.includes('lịch thi')
  );
}

async function generateWithGeminiFallback(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ];

  let lastError = null;
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      lastError = error;
      const statusMatch = String(error.message || '').match(/\[(\d{3})\s/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : null;
      if (statusCode === 429 || statusCode === 503) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }

  throw lastError || new Error('Khong the goi Gemini');
}

async function fetchScheduleFromPython(username, password, dateStr, scope = 'week') {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const normalizedScope = scope === 'day' ? 'day' : 'week';
  const endpoint = `${PYTHON_SERVICE_URL}/api/get-schedule?date=${encodeURIComponent(targetDate)}&scope=${normalizedScope}`;

  const pythonRes = await axios.post(endpoint, {
    username,
    password,
  });

  const payload = pythonRes.data || {};
  if (Array.isArray(payload)) {
    return { date: targetDate, schedule: payload };
  }

  return {
    date: payload.date || targetDate,
    scope: payload.scope || normalizedScope,
    schedule: Array.isArray(payload.schedule) ? payload.schedule : [],
  };
}

function inferScheduleScope(message) {
  const lower = message.toLowerCase();
  const dayHints = ['hôm nay', 'hom nay', 'today', 'ngày mai', 'ngay mai', 'tomorrow'];
  const hasDayHint = dayHints.some((hint) => lower.includes(hint));
  const hasExplicitDate = /\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/.test(lower) || /\b\d{4}-\d{2}-\d{2}\b/.test(lower);

  return hasDayHint || hasExplicitDate ? 'day' : 'week';
}

function normalizeScheduleRows(payload) {
  const dateLabel = payload.date || new Date().toISOString().split('T')[0];
  const rows = Array.isArray(payload.schedule) ? payload.schedule : [];

  return rows.map((item) => ({
    date: item.ngay_hoc || item.ngayBatDauHoc || dateLabel,
    subject: item.ten_mon || item.tenMonHoc || item.tenHocPhan || 'Chua ro mon hoc',
    room: item.phong_hoc || item.tenPhong || item.phongHoc || 'Chua co phong',
    time: item.thoi_gian || ([item.tuGio, item.denGio].filter(Boolean).join(' - ') || '--:--'),
  }));
}

async function generateBotResponse(userMessage, studentInfo) {
  const lowerMsg = userMessage.toLowerCase();
  const studentName = studentInfo.display_name || `Sinh vien ${studentInfo.mssv}`;
  const studentFaculty = studentInfo.faculty || 'chua cap nhat nganh';

  if (
    lowerMsg.includes('mình là ai') ||
    lowerMsg.includes('minh la ai') ||
    lowerMsg.includes('tôi là ai') ||
    lowerMsg.includes('toi la ai') ||
    lowerMsg.includes('thông tin cá nhân') ||
    lowerMsg.includes('thong tin ca nhan') ||
    lowerMsg.includes('ngành gì') ||
    lowerMsg.includes('nganh gi')
  ) {
    return {
      text: `Bạn là ${studentName} (MSSV: ${studentInfo.mssv}), ngành ${studentFaculty}. Mình chỉ hiển thị thông tin đúng với tài khoản bạn đang đăng nhập.`,
      type: 'TEXT',
      data: null,
    };
  }

  if (isScheduleQuery(userMessage)) {
    if (!Number(studentInfo.portal_verified || 0)) {
      return {
        text: 'Bạn cần xác thực tài khoản sinh viên trong menu 3 chấm trước khi xem lịch học.',
        type: 'TEXT',
        data: null,
      };
    }

    if (!studentInfo.decryptedPassword) {
      return {
        text: 'Không thể đọc thông tin đăng nhập Portal. Bạn hãy đăng xuất và đăng nhập lại.',
        type: 'TEXT',
        data: null,
      };
    }

    try {
      const targetDate = new Date().toISOString().split('T')[0];
      const scheduleScope = inferScheduleScope(userMessage);
      const schedulePayload = await fetchScheduleFromPython(
        studentInfo.mssv,
        studentInfo.decryptedPassword,
        targetDate,
        scheduleScope
      );

      const tableData = normalizeScheduleRows(schedulePayload);
      if (tableData.length === 0) {
        return {
          text:
            scheduleScope === 'week'
              ? 'Hiện tại không tìm thấy lịch học nào trong tuần này theo dữ liệu Portal.'
              : 'Hiện tại không tìm thấy lịch học nào cho ngày bạn yêu cầu.',
          type: 'TEXT',
          data: null,
        };
      }

      return {
        text:
          scheduleScope === 'week'
            ? 'Đây là lịch học trong tuần của bạn. '
            : 'Đây là lịch học theo ngày của bạn  ',
        type: 'TABLE',
        data: tableData,
      };
    } catch (error) {
      console.error('Loi lay lich hoc qua Python bot:', error.message);
      return {
        text: 'Không thể lấy lịch học lúc này. Có thể Portal đang bảo trì hoặc phiên đăng nhập đã hết hạn.',
        type: 'TEXT',
        data: null,
      };
    }
  }

  try {
    const prompt = `Bạn là trợ lý ảo hỗ trợ sinh viên Trường Đại học Giao thông Vận tải Thành phố Hồ Chí Minh (UTH). 
    Người đang hỏi bạn là sinh viên tên ${studentName} (MSSV: ${studentInfo.mssv}, ngành: ${studentFaculty}). 
    Bạn chỉ được phép trả thông tin cá nhân của chính sinh viên đang đăng nhập này. Nếu người dùng hỏi thông tin của sinh viên khác, hãy từ chối lịch sự và yêu cầu họ đăng nhập tài khoản tương ứng.
    Hãy trả lời thân thiện, ngắn gọn, đúng trọng tâm và xưng hô "mình" và "bạn". Chỉ chào hỏi lần đầu tiên và không cần nhắc lại tên/MSSV ở các câu trả lời sau. 
    Câu hỏi của sinh viên: ${userMessage}`;
    const textResponse = await generateWithGeminiFallback(prompt);

    return {
      text: textResponse,
      type: 'TEXT',
      data: null,
    };
  } catch (error) {
    console.error('Loi Gemini API:', error.message);
    if (String(error.message || '').includes('MISSING_GEMINI_API_KEY')) {
      return {
        text: 'Hệ thống AI chưa được cấu hình GEMINI_API_KEY.',
        type: 'TEXT',
        data: null,
      };
    }

    return {
      text: `Mình đang tạm lỗi AI, nhưng vẫn xác nhận bạn là ${studentName} (${studentInfo.mssv}).`,
      type: 'TEXT',
      data: null,
    };
  }
}

router.post('/:id/messages', async (req, res) => {
  try {
    const pool = getPool();
    const conversationId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tin nhắn không được để trống.',
      });
    }

    const [convRows] = await pool.execute(
      'SELECT * FROM conversations WHERE id = ? AND student_id = ?',
      [conversationId, req.student.id]
    );

    if (convRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc hội thoại.',
      });
    }

    const [studentRows] = await pool.execute(
      'SELECT mssv, display_name, faculty, password, portal_verified FROM students WHERE id = ?',
      [req.student.id]
    );

    const studentInfo = studentRows[0];
    try {
      studentInfo.decryptedPassword = decrypt(studentInfo.password);
    } catch {
      studentInfo.decryptedPassword = null;
    }

    const [userResult] = await pool.execute(
      'INSERT INTO messages (conversation_id, role, text, type) VALUES (?, ?, ?, ?)',
      [conversationId, 'user', text.trim(), 'TEXT']
    );

    const [msgCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND role = "user"',
      [conversationId]
    );

    if (msgCount[0].count === 1) {
      const title = text.trim().substring(0, 50) + (text.trim().length > 50 ? '...' : '');
      await pool.execute('UPDATE conversations SET title = ? WHERE id = ?', [title, conversationId]);
    }

    const botResponse = await generateBotResponse(text.trim(), studentInfo);

    const [botResult] = await pool.execute(
      'INSERT INTO messages (conversation_id, role, text, type, data) VALUES (?, ?, ?, ?, ?)',
      [
        conversationId,
        'bot',
        botResponse.text,
        botResponse.type,
        botResponse.data ? JSON.stringify(botResponse.data) : null,
      ]
    );

    await pool.execute('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);

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
    console.error('Loi gui tin nhan:', error);
    res.status(500).json({ success: false, message: 'Loi server.' });
  }
});

module.exports = router;

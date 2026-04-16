// ============================================
// ROUTES/MESSAGES.JS - Gửi/Nhận tin nhắn
// ============================================
const express = require('express');
const authenticateToken = require('../middleware/auth');
const { getPool } = require('../database');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const router = express.Router();
const { decrypt } = require('../crypto');
// Tất cả routes đều yêu cầu đăng nhập
router.use(authenticateToken);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
//TEST FALLBACK MỚI
/**
 * Gọi Gemini API với cơ chế Fallback tuần tự qua các model ưu tiên.
 * Đơn giản hóa: Bỏ qua việc gọi API lấy danh sách model, chỉ dùng mảng tĩnh.
 * Tăng thời gian chờ (delay) để tránh lỗi 429/503 từ Google.
 */
async function generateWithGeminiFallback(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }

  // Khởi tạo SDK một lần
  const genAI = new GoogleGenerativeAI(apiKey);

  
  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash',
    'gemini-3.1-flash-lite',
  ];

  let lastError = null;

  // Lặp qua từng model trong danh sách
  for (const modelName of modelsToTry) {
    try {
      console.log(`Đang thử gọi Gemini với model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Gọi AI
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Nếu thành công, trả về kết quả ngay lập tức
      console.log(`✅ Gọi thành công với model: ${modelName}`);
      return text;

    } catch (error) {
      lastError = error;
      const statusMatch = String(error.message).match(/\[(\d{3})\s/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : 'unknown';

      console.warn(`❌ Model ${modelName} thất bại (Status: ${statusCode}): ${error.message.substring(0, 100)}...`);

      // Nếu lỗi là 404 (Model không tồn tại/chưa mở), lập tức thử model tiếp theo (không cần chờ)
      if (statusCode === 404) {
        continue; 
      }

      // Nếu là lỗi 503 (Quá tải) hoặc 429 (Rate limit), dừng lại một chút trước khi thử model tiếp theo
      if (statusCode === 503 || statusCode === 429) {
        console.warn('Đang gặp lỗi quá tải/rate limit. Đợi 2 giây trước khi thử model khác...');
        await sleep(2000); 
        continue;
      }
      
      // Với các lỗi khác (ví dụ: sai API Key, lỗi cú pháp), có thể thử tiếp model khác hoặc dừng hẳn tùy logic của bạn.
      // Ở đây ta vẫn cho thử tiếp các model dự phòng.
    }
  }

  // Nếu vòng lặp kết thúc mà vẫn chưa return được text, tức là tất cả model đều thất bại.
  throw lastError || new Error('Tất cả model Gemini đều phản hồi thất bại.');
}

// Giữ lại hàm sleep đơn giản này nếu bạn đã xóa ở trên
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET ERROR FALLBACK CŨ
// function getGeminiStatusCode(error) {
//   const message = String(error?.message || '');
//   const match = message.match(/\[(\d{3})\s/);
//   return match ? Number(match[1]) : null;
// }

// function isRetryableGeminiError(error) {
//   const statusCode = getGeminiStatusCode(error);
//   return statusCode === 429 || statusCode === 503;
// }

// async function fetchAvailableGeminiModels(apiKey) {
//   try {
//     const res = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
//       params: { key: apiKey },
//       timeout: 8000
//     });

//     const models = Array.isArray(res?.data?.models) ? res.data.models : [];
//     return models
//       .filter((m) => {
//         const name = String(m?.name || '');
//         const methods = Array.isArray(m?.supportedGenerationMethods)
//           ? m.supportedGenerationMethods
//           : [];
//         return name.includes('gemini') && methods.includes('generateContent');
//       })
//       .map((m) => String(m.name || '').replace('models/', ''))
//       .filter(Boolean);
//   } catch (error) {
//     console.warn('Không lấy được danh sách model Gemini, sẽ dùng fallback tĩnh:', error.message);
//     return [];
//   }
// }

// async function generateWithGeminiFallback(prompt) {
//   const apiKey = process.env.GEMINI_API_KEY;
//   if (!apiKey) {
//     throw new Error('MISSING_GEMINI_API_KEY');
//   }

//   const discoveredModels = await fetchAvailableGeminiModels(apiKey);
//   const preferredModels = [
//     'gemini-2.5-flash',
//    'gemini-2.5-flash-lite',
//    'gemini-3-flash',
//    'gemini-3.1-flash-lite',
//   ];

//   const mergedCandidates = [...preferredModels, ...discoveredModels];
//   const modelCandidates = Array.from(new Set(mergedCandidates)).filter((name) => {
//     if (!discoveredModels.length) return true;
//     return discoveredModels.includes(name);
//   });

//   if (!modelCandidates.length) {
//     throw new Error('NO_AVAILABLE_GEMINI_MODEL');
//   }

//   const genAI = new GoogleGenerativeAI(apiKey);
//   let lastError = null;
//   const maxRetriesPerModel = 2;

//   for (const modelName of modelCandidates) {
//     for (let attempt = 0; attempt <= maxRetriesPerModel; attempt += 1) {
//       try {
//         const model = genAI.getGenerativeModel({ model: modelName });
//         const result = await model.generateContent(prompt);
//         return result.response.text();
//       } catch (error) {
//         lastError = error;
//         const retryable = isRetryableGeminiError(error);
//         const statusCode = getGeminiStatusCode(error);
//         console.error(
//           `Gemini fallback thất bại với model ${modelName} (lần ${attempt + 1}/${maxRetriesPerModel + 1}, status ${statusCode || 'unknown'}):`,
//           error.message
//         );

//         if (!retryable || attempt === maxRetriesPerModel) {
//           break;
//         }

//         const backoffMs = 700 * (attempt + 1);
//         await sleep(backoffMs);
//       }
//     }
//   }

//   throw lastError || new Error('Không thể gọi Gemini với tất cả model fallback');
// }

function formatScheduleFallback(rawPortalData) {
  if (!Array.isArray(rawPortalData) || rawPortalData.length === 0) {
    return 'Hiện tại mình chưa tìm thấy lịch học/lịch thi nào cho bạn trong thời gian này.';
  }

  const rows = rawPortalData.slice(0, 15).map((item, index) => {
    const subject = item.tenHocPhan || item.tenMonHoc || item.monHoc || 'Chưa rõ môn học';
    const fromTime = item.gioBatDau || item.tuGio || item.fromTime || '--:--';
    const toTime = item.gioKetThuc || item.denGio || item.toTime || '--:--';
    const room = item.phongHoc || item.phong || item.room || 'Chưa có phòng';
    return `${index + 1}. ${subject} | ${fromTime} - ${toTime} | Phòng: ${room}`;
  });

  return `Lịch học của bạn là:\n${rows.join('\n')}`;
}

/**
 * Hàm gọi API thực tế từ UTH Portal để lấy dữ liệu lịch học/thi
 */
async function fetchDataFromPortal(username, password, dateStr) {
  try {
    // 1. Tạo fake captcha và đăng nhập lấy Token
    const fakeCaptcha = Math.random().toString(36).substring(2, 15);
    const loginUrl = `https://portal.ut.edu.vn/api/v1/user/login?g-recaptcha-response=${fakeCaptcha}`;
    
    const loginRes = await axios.post(loginUrl, {
      username: username,
      password: password // Yêu cầu: Cần lấy mật khẩu portal của SV từ DB hoặc yêu cầu cung cấp
    });

    const token = loginRes.data.token;
    if (!token) throw new Error("Không thể lấy token, sai tài khoản/mật khẩu");

    // 2. Lấy dữ liệu lịch học dựa trên ngày (Mặc định lấy ngày hiện tại nếu không truyền)
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const scheduleUrl = `https://portal.ut.edu.vn/api/v1/lichhoc/lichTuan?date=${targetDate}`;
    
    const scheduleRes = await axios.get(scheduleUrl, {
      headers: {
        "authorization": `Bearer ${token}`,
        "Referer": "https://portal.ut.edu.vn/calendar",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "accept": "application/json, text/plain, */*"
      }
    });

    // Trả về dữ liệu JSON thô của portal
    return scheduleRes.data.body || [];
  } catch (error) {
    console.error("Lỗi khi gọi API Portal:", error.message);
    throw error;
  }
}

/**
 * Tạo phản hồi từ Bot sử dụng Google Gemini AI và dữ liệu Portal
 * @param {string} userMessage - Tin nhắn của người dùng
 * @param {object} studentInfo - Thông tin sinh viên (từ req.student)
 * @returns {object} - { text, type, data }
 */
async function generateBotResponse(userMessage, studentInfo) {
  const lowerMsg = userMessage.toLowerCase();
  const studentName = studentInfo.display_name || `Sinh viên ${studentInfo.mssv}`;
  const studentFaculty = studentInfo.faculty || 'chưa cập nhật ngành';

  if (
    lowerMsg.includes('mình là ai') ||
    lowerMsg.includes('tôi là ai') ||
    lowerMsg.includes('thông tin cá nhân') ||
    lowerMsg.includes('ngành gì')
  ) {
    return {
      text: `Bạn là ${studentName} (MSSV: ${studentInfo.mssv}), ngành ${studentFaculty}. Mình chỉ hiển thị thông tin đúng với tài khoản bạn đang đăng nhập.`,
      type: 'TEXT',
      data: null
    };
  }
  
  // ==========================================================
  // 1. XỬ LÝ CÁC TỪ KHÓA ĐẶC BIỆT CẦN DỮ LIỆU TỪ PORTAL
  // ==========================================================

    // A. Lịch học / Thời khóa biểu / Lịch thi
  if (lowerMsg.includes('lịch học') || lowerMsg.includes('thời khóa biểu') || lowerMsg.includes('lịch thi')) {
    try {
      if (!studentInfo.decryptedPassword) {
        return {
          text: 'Mình chưa thể xác thực Portal cho tài khoản này. Bạn vui lòng đăng xuất rồi đăng nhập lại để đồng bộ thông tin Portal nhé.',
          type: 'TEXT',
          data: null
        };
      }

      // Dùng studentInfo.password (pass đăng nhập chatbot) để đăng nhập Portal
      const rawPortalData = await fetchDataFromPortal(studentInfo.mssv, studentInfo.decryptedPassword, null);

      // Đưa dữ liệu thô cho Gemini để xử lý và tạo khuôn mẫu hiển thị
      const prompt = `Bạn là trợ lý ảo hỗ trợ sinh viên của Đại học Giao thông Vận tải TP.HCM (UTH).
        Sinh viên ${studentName} (MSSV: ${studentInfo.mssv}, ngành: ${studentFaculty}) vừa hỏi về lịch học.
        Chỉ chào lần đầu tiên, sau đó trả lời trực tiếp vào câu hỏi mà không cần chào lại ở các câu trả lời sau.
        Dưới đây là dữ liệu JSON thô lấy từ Portal của trường:
        ${JSON.stringify(rawPortalData)}
        Nhiệm vụ của bạn:
        1. Đọc hiểu dữ liệu JSON trên. Lọc những thông tin cần thiết để hiển thị lịch học.
        2. Nếu phòng học là E-learning là học trực tuyến, tách riêng với các môn học có phòng học cụ thể.
        3. Trích xuất,lọc và lấy những thông tin cần thiết. Định dạng lại thông tin theo ngày có lịch học. Ngày có lịch học thì ghi lịch học ngày đó rồi xuống dòng ghi ngày có lịch học tiếp theo. phân chia logic, đẹp mắt, không bị lệch các cột. 
        4. Các cột/thông tin cần thiết: Tên môn học, mã học phần, tiết học, Thời gian (Từ giờ - Đến giờ), Phòng học.
        5. Nếu dữ liệu JSON trống, hãy thông báo một cách thân thiện là hiện tại không có lịch học nào được tìm thấy.`;

      let formattedResponse;
      try {
        formattedResponse = await generateWithGeminiFallback(prompt);
      } catch (geminiError) {
        console.error('Gemini lỗi khi format lịch, dùng fallback local:', geminiError.message);
        formattedResponse = formatScheduleFallback(rawPortalData);
      }

      return {
        text: formattedResponse,
        type: 'TEXT',
        data: null,
      };
    } catch (error) {
      console.error("Lỗi Portal:", error);
      return { 
        text: 'Lỗi khi kết nối Portal. Có thể mật khẩu đăng nhập Chatbot của bạn không khớp với mật khẩu Portal hiện tại!', 
        type: 'TEXT', 
        data: null 
      };
    }
  }

  // ==========================================================
  // 2. TÍCH HỢP GEMINI AI CHO CÁC CÂU HỎI KHÁC
  // ==========================================================
  try {
    // Prompt ngữ cảnh cho AI biết nó đang nói chuyện với ai
    const prompt = `Bạn là trợ lý ảo hỗ trợ sinh viên của trường Đại học Giao thông Vận tải TP.HCM (UTH). Hãy cập nhật thông tin chính xác về trường. 
Người đang hỏi bạn là sinh viên tên ${studentName} (MSSV: ${studentInfo.mssv}, ngành: ${studentFaculty}).
Bạn chỉ được phép trả thông tin cá nhân của chính sinh viên đang đăng nhập này. Nếu người dùng hỏi thông tin của sinh viên khác, hãy từ chối lịch sự và yêu cầu họ đăng nhập tài khoản tương ứng.
Hãy trả lời thân thiện, ngắn gọn, đúng trọng tâm và xưng hô "mình" và "bạn". Chỉ chào hỏi lần đầu tiên và không cần nhắc lại tên/MSSV ở các câu trả lời sau.
Câu hỏi của sinh viên: "${userMessage}"`;

    const textResponse = await generateWithGeminiFallback(prompt);

    return { 
      text: textResponse, 
      type: 'TEXT', 
      data: null 
    };

  } catch (error) {
    console.error('Lỗi Gemini API:', error);
    const fallbackByProfile = `Mình đang tạm lỗi AI, nhưng mình vẫn biết bạn là ${studentName} (MSSV: ${studentInfo.mssv}, ngành: ${studentFaculty}). Bạn gửi lại câu hỏi sau ít phút nhé.`;

    if (String(error.message || '').includes('MISSING_GEMINI_API_KEY')) {
      return {
        text: 'Hệ thống AI chưa được cấu hình GEMINI_API_KEY. Vui lòng liên hệ quản trị viên để bật trợ lý AI.',
        type: 'TEXT',
        data: null
      };
    }

    return {
      text: fallbackByProfile,
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
      'SELECT mssv, display_name, faculty, password FROM students WHERE id = ?',
      [req.student.id]
    );
    const studentInfo = studentRows[0];
    
    // GIẢI MÃ MẬT KHẨU TỪ DATABASE ĐỂ ĐƯA CHO PORTAL
    try {
      studentInfo.decryptedPassword = decrypt(studentInfo.password);
    } catch (err) {
      console.error("Lỗi giải mã mật khẩu:", err);
      // Xử lý nếu mật khẩu cũ trong DB chưa được mã hóa bằng chuẩn này
    }
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
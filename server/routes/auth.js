// ============================================
// ROUTES/AUTH.JS - Đăng nhập & Tự động Đăng ký qua Portal UTH
// ============================================
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { getPool } = require('../database');
const { encrypt } = require('../crypto'); // Sử dụng mã hóa 2 chiều tự viết
require('dotenv').config();

const router = express.Router();

/**
 * Hàm kiểm tra đăng nhập thực tế qua Portal UTH
 */
async function verifyWithUthPortal(username, password) {
  try {
    const fakeCaptcha = Math.random().toString(36).substring(2, 15);
    const loginUrl = `https://portal.ut.edu.vn/api/v1/user/login?g-recaptcha-response=${fakeCaptcha}`;
    
    const loginRes = await axios.post(loginUrl, {
      username: username,
      password: password
    });

    // Nếu có token trả về nghĩa là đăng nhập thành công
    if (loginRes.data && loginRes.data.token) {
      return { success: true, message: "Thành công" };
    }
    return { success: false, message: loginRes.data.message || "Sai tài khoản hoặc mật khẩu" };
  } catch (error) {
    console.error("Lỗi kết nối Portal:", error.message);
    return { success: false, message: "Lỗi kết nối server trường. Vui lòng thử lại sau!" };
  }
}

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { mssv, password } = req.body;

    if (!mssv || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ MSSV và Mật khẩu.' });
    }

    // 1. Kiểm tra tài khoản/mật khẩu với trang Portal của trường
    const portalAuth = await verifyWithUthPortal(mssv, password);
    
    if (!portalAuth.success) {
      return res.status(401).json({ success: false, message: portalAuth.message });
    }

    // 2. Nếu trường xác nhận ĐÚNG -> Tiến hành xử lý DB nội bộ
    const pool = getPool();
    const encryptedPassword = encrypt(password); // Mã hoá mật khẩu để lưu an toàn

    // Tìm xem sinh viên đã có trong hệ thống Chatbot chưa
    const [rows] = await pool.execute('SELECT * FROM students WHERE mssv = ?', [mssv]);
    
    let studentId;
    let displayName = `Sinh viên ${mssv}`;

    if (rows.length === 0) {
      // 2.1. CHƯA CÓ -> TỰ ĐỘNG ĐĂNG KÝ
      const [insertResult] = await pool.execute(
        'INSERT INTO students (mssv, password, display_name) VALUES (?, ?, ?)',
        [mssv, encryptedPassword, displayName]
      );
      studentId = insertResult.insertId;
    } else {
      // 2.2. ĐÃ CÓ -> CẬP NHẬT LẠI MẬT KHẨU MỚI NHẤT VÀ LẤY THÔNG TIN
      studentId = rows[0].id;
      displayName = rows[0].display_name;
      await pool.execute(
        'UPDATE students SET password = ? WHERE id = ?',
        [encryptedPassword, studentId]
      );
    }

    // 3. Tạo JWT token (hết hạn sau 24 giờ) cho Chatbot
    const token = jwt.sign(
      { id: studentId, mssv: mssv, display_name: displayName },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Trả về token cho người dùng sử dụng
    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      student: {
        id: studentId,
        mssv: mssv,
        display_name: displayName
      }
    });

  } catch (error) {
    console.error('❌ Lỗi đăng nhập:', error);
    res.status(500).json({ success: false, message: 'Lỗi server. Vui lòng thử lại.' });
  }
});

module.exports = router;
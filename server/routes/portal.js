// ============================================
// ROUTES/PORTAL.JS - Cầu nối sang Python Bot
// ============================================
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getPool } = require('../database');
const { decrypt } = require('../crypto');

const router = express.Router();
const PYTHON_SERVICE_URL = (process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

const cleanProfileText = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (lower === 'chưa cập nhật' || lower === 'chua cap nhat') return null;
  return normalized;
};

// Middleware xác thực token chatbot nội bộ
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);
  
  if (!token) return res.status(401).json({ message: 'Thiếu token đăng nhập' });
  try {
    const dec = jwt.verify(token, process.env.JWT_SECRET);
    req.user = dec;
    next();
  } catch(e) {
    res.status(403).json({ message: 'Token không hợp lệ' });
  }
};

// 1. Kiểm tra xác thực qua Portal UTH
router.post('/authenticate', verifyToken, async (req, res) => {
  try {
    const { mssv: tokenMssv, id } = req.user;
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT mssv, password, display_name, faculty, portal_verified FROM students WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy user' });
    const dbStudent = rows[0];
    const loginMssv = dbStudent.mssv || tokenMssv;
    const decryptedPass = decrypt(dbStudent.password);

    // Gửi sang Python Bot (API FastAPI)
    const pythonRes = await axios.post(`${PYTHON_SERVICE_URL}/api/auth-and-info`, {
      username: loginMssv,
      password: decryptedPass
    });

    if (pythonRes.data && pythonRes.data.status === 'success') {
      const pythonStudent = pythonRes.data.student || {};
      const profileMssv = String(pythonStudent.mssv || pythonRes.data.mssv || loginMssv).trim();
      const profileName = cleanProfileText(pythonStudent.display_name || pythonRes.data.ho_ten);
      const profileFaculty = cleanProfileText(pythonStudent.faculty || pythonRes.data.nganh);
      const dashboardSource = pythonRes.data.source_endpoint || null;
      const dashboardJson = pythonRes.data.dashboard_json || null;

      const finalDisplayName = profileName || dbStudent.display_name || `Sinh viên ${profileMssv}`;
      const finalFaculty = profileFaculty || dbStudent.faculty || null;
      
      // Cập nhật Database với dữ liệu mới nhất từ portal (hoặc fallback dữ liệu hiện có)
      await pool.execute(
        'UPDATE students SET mssv = ?, display_name = ?, faculty = ?, portal_verified = 1 WHERE id = ?',
        [profileMssv, finalDisplayName, finalFaculty, id]
      );

      const [updatedRows] = await pool.execute(
        'SELECT mssv, display_name, faculty, portal_verified FROM students WHERE id = ?',
        [id]
      );
      const updatedStudent = updatedRows[0] || {
        mssv: profileMssv,
        display_name: finalDisplayName,
        faculty: finalFaculty,
        portal_verified: 1,
      };

      const profileFetched = Boolean(
        profileName || profileFaculty || pythonRes.data.profile_fetched
      );
      
      res.json({
        success: true,
        message: profileFetched
          ? 'Xác thực Portal thành công!'
          : 'Xác thực thành công nhưng chưa lấy đủ hồ sơ, đã giữ dữ liệu hiện có.',
        verified: Boolean(updatedStudent.portal_verified),
        mssv: updatedStudent.mssv,
        ho_ten: updatedStudent.display_name,
        nganh: updatedStudent.faculty,
        student: updatedStudent,
        profileFetched,
        sourceEndpoint: dashboardSource,
        dashboardJson,
      });
    } else {
      res.status(401).json({ success: false, message: 'Sai mật khẩu Portal UTH hoặc có lỗi từ Portal' });
    }
  } catch (error) {
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.response?.data?.message;
    console.error('Lỗi khi gọi Python Bot để auth:', status, detail || error.message);
    res.status(status).json({
      success: false,
      message: detail || 'Lỗi gọi Bot Python'
    });
  }
});

// 2. Lấy dữ liệu Lịch Học qua Python Bot
router.post('/schedule', verifyToken, async (req, res) => {
  try {
    // date định dạng YYYY-MM-DD
    const { date } = req.body;
    if (!date) return res.status(400).json({ message: "Thiếu ngày cần xem" });

    const { mssv, id } = req.user;
    
    const pool = getPool();
    const [rows] = await pool.execute('SELECT password, portal_verified FROM students WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    if (!Number(rows[0].portal_verified || 0)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chưa xác thực Portal. Vui lòng xác thực trước khi xem lịch học.'
      });
    }

    const decryptedPass = decrypt(rows[0].password);

    // Gửi sang Python Bot. Nó hỗ trợ query arg 'date' (theo file python api_service.py)
    const pythonRes = await axios.post(`${PYTHON_SERVICE_URL}/api/get-schedule?date=${date}`, {
      username: mssv,
      password: decryptedPass
    });

    const payload = pythonRes.data || {};
    const schedule = Array.isArray(payload.schedule) ? payload.schedule : [];
    const dateLabel = payload.date || date;

    res.json({
      success: true,
      date: dateLabel,
      schedule
    });

  } catch (error) {
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.response?.data?.message;
    console.error('Lỗi khi gọi Python Bot để lấy schedule:', status, detail || error.message);
    res.status(status).json({
      success: false,
      message: detail || 'Không thể lấy lịch học lúc này'
    });
  }
});

module.exports = router;

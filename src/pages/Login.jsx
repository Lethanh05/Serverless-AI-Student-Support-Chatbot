import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace(/\/+$/, '');

export default function Login() {
  const [mssv, setMssv] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Hàm xử lý khi bấm nút Đăng nhập
  const handleLogin = async (e) => {
    e.preventDefault(); // Ngăn trang web load lại khi submit form
    setError('');

    // Validate input
    if (mssv.trim() === '' || password.trim() === '') {
      setError('Vui lòng nhập đầy đủ MSSV và Mật khẩu!');
      return;
    }

    setIsLoading(true);

    try {
      // Gọi API đăng nhập
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mssv: mssv.trim(), password: password.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        // Lưu JWT token + thông tin sinh viên vào localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('student', JSON.stringify(data.student));

        // Điều hướng người dùng sang trang Chat
        navigate('/chat');
      } else {
        setError(data.message || 'Đăng nhập thất bại.');
      }
    } catch (err) {
      console.error('Lỗi kết nối:', err);
      setError('Không thể kết nối đến server. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        {/* Tiêu đề Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">UTH CHATBOT</h1>
          <p className="text-gray-500 mt-2">Hệ thống hỗ trợ sinh viên</p>
        </div>

        {/* Thông báo lỗi */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        {/* Form đăng nhập */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Mã số sinh viên (MSSV)</label>
            <input
              type="text"
              value={mssv}
              onChange={(e) => setMssv(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập MSSV của bạn..."
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Gợi ý tài khoản test */}
        <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-600 text-center font-medium">
            <strong>Chatbot hỗ trợ sinh viên & Hiển thị lịch học và kiểm tra</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [mssv, setMssv] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // Hàm xử lý khi bấm nút Đăng nhập
  const handleLogin = (e) => {
    e.preventDefault(); // Ngăn trang web load lại khi submit form
    
    // Giả lập kiểm tra: Chỉ cần nhập đủ MSSV và Password là cho qua
    if (mssv.trim() !== '' && password.trim() !== '') {
      // 1. Lưu một token giả vào localStorage của trình duyệt
      localStorage.setItem('token', 'uth-fake-jwt-token');
      
      // 2. Điều hướng người dùng sang trang Chat
      navigate('/chat');
    } else {
      alert("Vui lòng nhập đầy đủ MSSV và Mật khẩu!");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        {/* Tiêu đề Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">UTH PORTAL</h1>
          <p className="text-gray-500 mt-2">Hệ thống hỗ trợ sinh viên</p>
        </div>

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
            />
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
}
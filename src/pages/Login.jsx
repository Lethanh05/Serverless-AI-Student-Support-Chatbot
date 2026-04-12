import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [mssv, setMssv] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // Hàm xử lý khi bấm nút Đăng nhập
const handleLogin = (e) => {
  e.preventDefault();

  // Kiểm tra MSSV không được trống
  if (mssv.trim() === '') {
    alert("Vui lòng nhập MSSV!");
    return;
  }

  // Kiểm tra Mật khẩu phải đúng 6 số
  const passwordRegex = /^\d{6}$/;
  if (!passwordRegex.test(password)) {
    alert("Mật khẩu bắt buộc phải có đúng 6 con số!");
    return;
  }

  // Nếu thỏa mãn hết thì mới cho qua
  localStorage.setItem('token', 'uth-fake-jwt-token');
  navigate('/chat');
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
              autoComplete="off" // Tắt tính năng tự động điền của trình duyệt
              maxLength={12} // Giới hạn tối đa 12 ký tự
              pattern="\d{12}" // Chỉ cho phép nhập số và tối đa 12 ký tự
              title="MSSV chỉ chứa số và tối đa 12 ký tự"
              className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*$/.test(val)) {}
                  setMssv(val);
                }
              }
              
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
            <input
              type="password"
              value={password}
              className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
              maxLength ={6}
              autoComplete="new-password" // Tắt tính năng tự động điền mật khẩu của trình duyệt
               pattern="\d{6}" // Chỉ cho phép nhập đúng 6 số
               title="Mật khẩu chỉ chứa số"
              onChange={(e) => {
                const val = e.target.value;
              if (/^\d*$/.test(val)) {
                setPassword(val);
              }
            }}
               //
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
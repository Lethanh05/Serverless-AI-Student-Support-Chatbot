import React, { useState, useEffect, useRef } from 'react';
import { Send, User, History, GraduationCap, Plus, Trash2, LogOut, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ScheduleTable from '../components/RichUI';
import uthLogo from '../assets/logo/Logo_UTH.png';

const API_URL = 'http://localhost:3001/api';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [student, setStudent] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  // Lấy token từ localStorage
  const getToken = () => localStorage.getItem('token');

  // Headers cho API requests
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  });

  // Scroll xuống cuối khi có tin nhắn mới
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const closeMenuOnOutsideClick = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', closeMenuOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeMenuOnOutsideClick);
  }, []);

  // Load thông tin sinh viên + danh sách hội thoại khi mount
  useEffect(() => {
    const storedStudent = localStorage.getItem('student');
    if (storedStudent) {
      const parsedStudent = JSON.parse(storedStudent);
      if (parsedStudent && typeof parsedStudent.portal_verified === 'undefined') {
        parsedStudent.portal_verified = 0;
      }
      setStudent(parsedStudent);
    }
    loadConversations();
  }, []);

  /**
   * Load danh sách cuộc hội thoại (lịch sử tra cứu)
   */
  const loadConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/conversations`, { headers: getHeaders() });
      const data = await res.json();

      if (data.success) {
        setConversations(data.conversations);

        // Nếu có conversations, mở cái mới nhất
        if (data.conversations.length > 0 && !activeConversationId) {
          loadMessages(data.conversations[0].id);
        }
      }
    } catch (err) {
      console.error('Lỗi load conversations:', err);
    }
  };

  /**
   * Load messages của 1 cuộc hội thoại
   */
  const loadMessages = async (conversationId) => {
    try {
      const res = await fetch(`${API_URL}/conversations/${conversationId}`, { headers: getHeaders() });
      const data = await res.json();

      if (data.success) {
        setActiveConversationId(conversationId);
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Lỗi load messages:', err);
    }
  };

  /**
   * Tạo đoạn chat mới
   */
  const createNewChat = async () => {
    try {
      const res = await fetch(`${API_URL}/conversations`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();

      if (data.success) {
        // Reload danh sách & chuyển sang chat mới
        setActiveConversationId(data.conversation.id);
        await loadConversations();
        await loadMessages(data.conversation.id);
      }
    } catch (err) {
      console.error('Lỗi tạo chat mới:', err);
    }
  };

  /**
   * Xóa cuộc hội thoại
   */
  const deleteConversation = async (e, conversationId) => {
    e.stopPropagation(); // Ngăn click lan ra ngoài
    
    try {
      const res = await fetch(`${API_URL}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();

      if (data.success) {
        // Reload danh sách
        const updatedConversations = conversations.filter(c => c.id !== conversationId);
        setConversations(updatedConversations);

        // Nếu đang xem conversation bị xóa, chuyển sang cái khác
        if (activeConversationId === conversationId) {
          if (updatedConversations.length > 0) {
            loadMessages(updatedConversations[0].id);
          } else {
            setActiveConversationId(null);
            setMessages([]);
          }
        }
      }
    } catch (err) {
      console.error('Lỗi xóa conversation:', err);
    }
  };

  /**
   * Gửi tin nhắn
   */
  const handleSend = async () => {
    if (!input.trim()) return;

    // Nếu chưa có conversation, tạo mới trước
    let currentConvId = activeConversationId;
    if (!currentConvId) {
      try {
        const res = await fetch(`${API_URL}/conversations`, {
          method: 'POST',
          headers: getHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          currentConvId = data.conversation.id;
          setActiveConversationId(currentConvId);
        } else {
          return;
        }
      } catch (err) {
        console.error('Lỗi tạo conversation:', err);
        return;
      }
    }

    // Thêm tin nhắn user vào UI ngay (optimistic update)
    const userMsg = { role: 'user', text: input, type: 'TEXT' };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/conversations/${currentConvId}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text: currentInput }),
      });
      const data = await res.json();

      if (data.success) {
        // Thêm phản hồi bot
        setMessages(prev => [...prev, data.botMessage]);
        // Reload sidebar để cập nhật title
        loadConversations();
      }
    } catch (err) {
      console.error('Lỗi gửi tin nhắn:', err);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        text: 'Lỗi kết nối server. Vui lòng thử lại.', 
        type: 'TEXT' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Xác thực Portal theo Option 2
   */
  const handleAuthPortal = async () => {
    setIsLoading(true);
    setShowUserMenu(false);

    try {
      const res = await fetch(`${API_URL}/portal/authenticate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();

      if (!data.success) {
        window.alert(data.message || 'Xác thực Portal thất bại.');
        return;
      }

      const serverStudent = data.student || {};
      const updatedStudent = {
        ...student,
        mssv: serverStudent.mssv || data.mssv || student?.mssv,
        display_name: serverStudent.display_name || data.ho_ten || student?.display_name,
        faculty: serverStudent.faculty ?? data.nganh ?? student?.faculty,
        portal_verified: Number(serverStudent.portal_verified ?? data.verified ?? 0),
      };
      setStudent(updatedStudent);
      localStorage.setItem('student', JSON.stringify(updatedStudent));
      window.alert(data.message || 'Xác thực Portal thành công!');
    } catch (err) {
      console.error('Lỗi xác thực Portal:', err);
      window.alert('Không thể kết nối Bot Python hoặc Backend.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Đăng xuất
   */
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('student');
    navigate('/');
  };

  const isPortalVerified = Boolean(Number(student?.portal_verified || 0));

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar - Lịch sử tra cứu */}
      <div className="w-72 bg-[#003580] text-white p-6 hidden md:flex flex-col shadow-xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-1 rounded-lg">
            <img src={uthLogo} alt="UTH Logo" className="w-25 h-10" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">CHATBOT</h1>
        </div>
        
        <button 
          onClick={createNewChat}
          className="w-full bg-blue-600 hover:bg-blue-500 transition-colors py-3 rounded-xl font-medium mb-8 shadow-lg flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Đoạn chat mới
        </button>

        <div className="flex-1 overflow-y-auto">
          <p className="text-xs text-blue-300 font-semibold uppercase tracking-wider mb-4">Lịch sử tra cứu</p>
          
          {conversations.length === 0 ? (
            <p className="text-sm text-blue-400 italic">Chưa có cuộc hội thoại nào</p>
          ) : (
            conversations.map((conv) => (
              <div 
                key={conv.id}
                onClick={() => loadMessages(conv.id)}
                className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all mb-1 ${
                  activeConversationId === conv.id 
                    ? 'bg-blue-700/60' 
                    : 'hover:bg-blue-800/50'
                }`}
              >
                <History size={18} className="text-blue-400 flex-shrink-0" />
                <span className="text-sm truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => deleteConversation(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/30 rounded"
                  title="Xóa cuộc hội thoại"
                >
                  <Trash2 size={14} className="text-red-300" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="pt-6 border-t border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">
              {student?.display_name ? student.display_name.charAt(student.display_name.length - 1) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{student?.display_name || 'Sinh viên'}</p>
              <p className="text-xs text-blue-300">{student?.mssv || ''} - UTH</p>
              <p className="text-xs text-blue-200 truncate">{student?.faculty || 'Ngành: chưa cập nhật từ portal'}</p>
            </div>
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="p-2 hover:bg-blue-800/50 rounded-lg transition-colors"
                title="Menu tài khoản"
              >
                <MoreVertical size={18} className="text-blue-300" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 bottom-12 w-64 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                  <div className="px-4 py-3 text-xs border-b bg-slate-50">
                    {isPortalVerified ? 'Thông tin sinh viên: Đã xác thực' : 'Thông tin sinh viên: Chưa xác thực'}
                  </div>
                  {!isPortalVerified && (
                    <button
                      onClick={handleAuthPortal}
                      disabled={isLoading}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-orange-50 disabled:opacity-60"
                    >
                      Xác thực tài khoản sinh viên
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <LogOut size={16} />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Vùng Chat chính */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-16 bg-white border-b flex items-center px-8 shadow-sm justify-between">
          <span className="font-bold text-blue-900">Hỗ trợ đào tạo & Quản lý sinh viên</span>
          <div className="flex items-center gap-3">
            <div className={`text-xs px-3 py-1.5 rounded-full font-medium border shadow-sm ${isPortalVerified ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
              {isPortalVerified ? 'Đã xác thực Portal' : 'Chưa xác thực Portal'}
            </div>
            <div className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium border border-green-200 shadow-sm">
              Hệ thống sẵn sàng
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <GraduationCap size={48} className="mx-auto mb-4 text-blue-300" />
                <p className="text-lg font-medium">Chào mừng bạn đến với UTH Chatbot!</p>
                <p className="text-sm mt-2">Bấm "Đoạn chat mới" hoặc nhập câu hỏi để bắt đầu.</p>
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'bot' && (
                <img
                  src={uthLogo}
                  alt="Bot avatar"
                  className="w-8 h-8 rounded-full object-contain mt-1 bg-white border border-slate-200"
                />
              )}
              
              <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${
                msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border rounded-tl-none'
              }`}>
                <p className="text-sm">{msg.text}</p>
                {/* Dùng ScheduleTable ở đây giúp import sáng lên */}
                {msg.type === 'TABLE' && (
                  <div className="mt-3">
                    <ScheduleTable data={msg.data} />
                  </div>
                )}
              </div>

              {msg.role === 'user' && <User size={20} className="text-gray-400 mt-1" />}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start items-center gap-2">
              <img
                src={uthLogo}
                alt="Bot avatar"
                className="w-6 h-6 rounded-full object-contain bg-white border border-slate-200"
              />
              <div className="bg-gray-100 p-3 rounded-lg animate-pulse text-xs">Đang xử lý...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-white border-t">
          <div className="max-w-4xl mx-auto relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Hỏi về lịch học, điểm số hoặc phòng thi..."
              className="w-full p-4 pr-16 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-600 bg-slate-50"
            />
            <button 
              onClick={handleSend} 
              disabled={isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {/* Dùng Send ở đây giúp import sáng lên */}
              <Send size={20} />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-1 italic">
            Lịch học được cập nhật trực tiếp từ UTH Portal
          </p>
          <p className="text-center text-[10px] text-slate-400 mt-1 italic">
            AI Chatbot có thể mắc sai sót, hãy kiểm tra lại thông tin.
          </p>

        </div>
      </div>
    </div>
  );
}

export default Chat;
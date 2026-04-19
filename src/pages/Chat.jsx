import React, { useState, useEffect, useRef } from 'react';
import { Send, User, History, GraduationCap, Plus, Trash2, LogOut, MoreHorizontal, Pin, Edit3 } from 'lucide-react';
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
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renameModeId, setRenameModeId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [pinnedIds, setPinnedIds] = useState([]);
  const messagesEndRef = useRef(null);
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

  // Load thông tin sinh viên + danh sách hội thoại khi mount
  useEffect(() => {
    const storedStudent = localStorage.getItem('student');
    if (storedStudent) {
      setStudent(JSON.parse(storedStudent));
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

  const sortedConversations = [...conversations].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id);
    const bPinned = pinnedIds.includes(b.id);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  const toggleMenu = (e, id) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === id ? null : id);
  };

  const handlePinToggle = (e, id) => {
    e.stopPropagation();
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setMenuOpenId(null);
  };

  const startRenameConversation = (e, conv) => {
    e.stopPropagation();
    setRenameModeId(conv.id);
    setRenameValue(conv.title);
    setMenuOpenId(null);
  };

  const applyRenameConversation = (e, id) => {
    if (e) e.preventDefault();
    if (!renameValue.trim()) return;

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id ? { ...conv, title: renameValue.trim() } : conv
      )
    );
    setRenameModeId(null);
  };

  const cancelRename = (e) => {
    if (e) e.stopPropagation();
    setRenameModeId(null);
    setRenameValue('');
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
   * Đăng xuất
   */
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('student');
    navigate('/');
  };

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
            sortedConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadMessages(conv.id)}
                className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all mb-1 ${activeConversationId === conv.id
                  ? 'bg-blue-700/60'
                  : 'hover:bg-blue-800/50'
                  }`}
              >
                <History size={18} className="text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {renameModeId === conv.id ? (
                    <form onSubmit={(e) => applyRenameConversation(e, conv.id)} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="w-full px-2 py-1 rounded-md text-sm text-slate-900"
                        autoFocus
                      />
                      <button type="submit" className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md">Lưu</button>
                      <button type="button" onClick={cancelRename} className="text-xs text-slate-100 px-2 py-1 rounded-md hover:bg-slate-700">Hủy</button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate flex-1">{conv.title}</span>
                      {pinnedIds.includes(conv.id) && (
                        <span className="text-[10px] uppercase tracking-[0.1em] bg-blue-500/20 text-blue-100 px-2 py-0.5 rounded-full">Ghim</span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => toggleMenu(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-full"
                  title="Tùy chọn"
                >
                  <MoreHorizontal size={18} className="text-blue-200" />
                </button>

                {menuOpenId === conv.id && (
                  <div className="absolute right-0 top-full mt-2 w-44 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 z-20">
                    <button
                      type="button"
                      onClick={(e) => startRenameConversation(e, conv)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-sm"
                    >
                      <Edit3 size={14} />
                      Đổi tên
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handlePinToggle(e, conv.id)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-sm"
                    >
                      <Pin size={14} />
                      {pinnedIds.includes(conv.id) ? 'Bỏ ghim' : 'Ghim'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(e, conv.id)}
                      className="w-full text-left px-3 py-2 hover:bg-red-600/80 flex items-center gap-2 text-sm text-red-100"
                    >
                      <Trash2 size={14} />
                      Xóa
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pt-6 border-t border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">
              {student?.display_name?.charAt(student.display_name.length - 1) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{student?.display_name || 'Sinh viên'}</p>
              <p className="text-xs text-blue-300">{student?.mssv || ''} - UTH</p>
              <p className="text-xs text-blue-200 truncate">{student?.faculty || 'Ngành: chưa cập nhật từ portal'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-blue-800/50 rounded-lg transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={18} className="text-blue-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Vùng Chat chính */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-16 bg-white border-b flex items-center px-8 shadow-sm justify-between">
          <span className="font-bold text-blue-900">Hỗ trợ đào tạo & Quản lý sinh viên</span>
          <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">Hệ thống sẵn sàng</div>
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

              <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border rounded-tl-none'
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
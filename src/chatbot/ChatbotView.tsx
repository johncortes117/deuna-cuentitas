import React, { useState, useEffect } from 'react';

// Icons
const SparkleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#2FD9A9" stroke="#2FD9A9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const UserAvatar = () => (
  <div className="w-8 h-8 rounded-full bg-[#F4F4F6] flex items-center justify-center shrink-0 border border-gray-100">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  </div>
);

type Message = {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  time: string;
};

export function ChatbotView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/chat/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commerceId: 'NEG001', role: 'admin' })
    })
    .then(res => res.json())
    .then(data => {
      setSessionId(data.sessionId);
      setMessages([{
        id: Date.now().toString(),
        sender: 'bot',
        text: data.welcomeMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    })
    .catch(err => console.error('Error al iniciar sesión de IA:', err));
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    if (!sessionId) {
      console.warn("Intento de envío sin sessionId listo. Se intentará de todas formas.");
    }
    const currentSessionId = sessionId || 'temp-id';

    const textPayload = inputValue.trim();

    // Agregar mensaje del usuario
    const newUserMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textPayload,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');

    // LLamada real al backend
    try {
      const response = await fetch('http://localhost:3000/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, text: textPayload })
      });
      const data = await response.json();
      
      const botMsg: Message = {
        id: data.id,
        sender: 'bot',
        text: data.text,
        time: new Date(data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    }
  };

  return (
    <div className="flex flex-col flex-1 pb-2 bg-white">
      {/* Header Chat */}
      <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-10 h-10 bg-[#4C1D80] rounded-full flex items-center justify-center shadow-sm">
          <SparkleIcon />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-[#1a1a1a] leading-tight">Asistente IA</h2>
          <p className="text-[12px] text-[#2FD9A9] font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2FD9A9] inline-block animated-pulse"></span>
            En línea
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 bg-[#F8F8FA]">
        <div className="text-center">
          <span className="text-[11px] text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-full">Hoy</span>
        </div>

        {messages.map((msg) => {
          const isBot = msg.sender === 'bot';
          return (
            <div key={msg.id} className={`flex items-end gap-2 max-w-[85%] ${isBot ? 'self-start' : 'self-end flex-row-reverse'}`}>
              {isBot ? (
                 <div className="w-8 h-8 bg-[#4C1D80] rounded-full flex items-center justify-center shrink-0">
                   <span className="text-white font-black text-xs italic tracking-tighter">d!</span>
                 </div>
              ) : (
                <UserAvatar />
              )}
              
              <div className={`p-3.5 rounded-[20px] ${
                isBot 
                  ? 'bg-white border border-gray-100 rounded-bl-sm text-[#1a1a1a]' 
                  : 'bg-[#4C1D80] rounded-br-sm text-white'
              }`}>
                <p className="text-[13.5px] leading-[1.4]">{msg.text}</p>
                <div className={`text-[10px] mt-1 text-right ${isBot ? 'text-gray-400' : 'text-purple-200'}`}>
                  {msg.time}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="px-4 pt-3 pb-1 bg-white">
        <div className="flex items-end gap-2 bg-[#F4F4F6] rounded-[24px] p-2 border border-gray-100">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe tu consulta aquí..."
            className="flex-1 bg-transparent border-none focus:outline-none text-[14px] text-[#1a1a1a] resize-none max-h-[100px] min-h-[40px] px-3 py-2"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
              inputValue.trim() ? 'bg-[#2FD9A9] shadow-md hover:scale-105' : 'bg-gray-300'
            }`}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

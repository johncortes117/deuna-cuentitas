import React, { useState, useEffect, useRef } from 'react';

// ─── Tipos ───────────────────────────────────────────────────────

type Sender = 'bot' | 'user';

interface Message {
  id: string;
  sender: Sender;
  text: string;
  time: string;
}

interface QuickReply {
  id: string;
  label: string;
}

// ─── Config ──────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3000';

// ─── Íconos ──────────────────────────────────────────────────────

const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#2FD9A9" stroke="#2FD9A9"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const BotAvatar = () => (
  <div className="w-8 h-8 bg-[#4C1D80] rounded-full flex items-center justify-center shrink-0">
    <span className="text-white font-black text-xs italic tracking-tighter">d!</span>
  </div>
);

const UserAvatar = () => (
  <div className="w-8 h-8 rounded-full bg-[#F4F4F6] flex items-center justify-center shrink-0 border border-gray-100">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4C1D80"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  </div>
);

// ─── Indicador de "pensando" ─────────────────────────────────────

const ThinkingBubble = () => (
  <div className="flex items-end gap-2 self-start max-w-[85%]">
    <BotAvatar />
    <div className="bg-white border border-gray-100 rounded-[20px] rounded-bl-sm px-4 py-3.5">
      <div className="flex gap-1.5 items-center">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ─── Burbuja de mensaje ──────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isBot = msg.sender === 'bot';
  return (
    <div className={`flex items-end gap-2 max-w-[85%] ${isBot ? 'self-start' : 'self-end flex-row-reverse'}`}>
      {isBot ? <BotAvatar /> : <UserAvatar />}
      <div
        className={`rounded-[20px] ${isBot
            ? 'bg-white border border-gray-100 rounded-bl-sm text-[#1a1a1a]'
            : 'bg-[#4C1D80] rounded-br-sm text-white'
          }`}
        style={{ padding: '10px 14px' }}
      >
        <p className="text-[13.5px] leading-[1.5] whitespace-pre-wrap">{msg.text}</p>
        <p className={`text-[10px] mt-1 text-right ${isBot ? 'text-gray-400' : 'text-purple-200'}`}>
          {msg.time}
        </p>
      </div>
    </div>
  );
}

// ─── Quick replies ───────────────────────────────────────────────

function QuickReplies({
  replies,
  onSelect,
  disabled,
}: {
  replies: QuickReply[];
  onSelect: (qr: QuickReply) => void;
  disabled: boolean;
}) {
  if (replies.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-5 pb-3">
      {replies.map((qr) => (
        <button
          key={qr.id}
          onClick={() => onSelect(qr)}
          disabled={disabled}
          className="px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all active:scale-95 disabled:opacity-40"
          style={{ borderColor: '#4C1D80', color: '#4C1D80', backgroundColor: 'white' }}
        >
          {qr.label}
        </button>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════

export function ChatbotView({ commerceId = 'NEG001' }: { commerceId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Iniciar sesión ─────────────────────────────────────────────
  useEffect(() => {
    // Reset al cambiar de comercio
    setSessionId(null);
    setMessages([]);
    setQuickReplies([]);

    fetch(`${API_BASE}/chat/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commerceId, role: 'admin' }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSessionId(data.sessionId);
        setMessages([{
          id: Date.now().toString(),
          sender: 'bot',
          text: data.welcomeMessage,
          time: nowTime(),
        }]);
        setQuickReplies(data.quickReplies ?? []);
      })
      .catch((err) => console.error('Error al iniciar sesión:', err));
  }, [commerceId]);

  // ─── Auto-scroll ────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // ─── Enviar mensaje ─────────────────────────────────────────────

  const sendMessage = async (text?: string, actionId?: string) => {
    if (!sessionId) return;
    if (!text?.trim() && !actionId) return;

    const displayText =
      text?.trim() ?? quickReplies.find((q) => q.id === actionId)?.label ?? '';

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: displayText,
      time: nowTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setQuickReplies([]);
    setIsThinking(true);

    try {
      const body: Record<string, string> = { sessionId };
      if (text?.trim()) body.text = text.trim();
      if (actionId) body.actionId = actionId;

      const res = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: data.id ?? `b-${Date.now()}`,
          sender: 'bot',
          text: data.text,
          time: new Date(data.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
      setQuickReplies(data.quickReplies ?? []);
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'bot',
          text: 'Algo salió mal. Intenta de nuevo.',
          time: nowTime(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSend = () => sendMessage(inputValue);
  const handleQuickReply = (qr: QuickReply) => {
    if (qr.id.startsWith('sug_')) {
      sendMessage(qr.label);
    } else {
      sendMessage(undefined, qr.id);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 pb-2 bg-white overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 bg-[#4C1D80] rounded-full flex items-center justify-center shadow-sm shrink-0">
          <SparkleIcon />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-[#1a1a1a] leading-tight">Asistente IA</h2>
          <p className="text-[12px] text-[#2FD9A9] font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2FD9A9] inline-block animate-pulse" />
            En línea
          </p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 bg-[#F8F8FA]">
        <div className="text-center">
          <span className="text-[11px] text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-full">
            Hoy
          </span>
        </div>

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isThinking && <ThinkingBubble />}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies */}
      <div className="bg-[#F8F8FA] shrink-0">
        <QuickReplies replies={quickReplies} onSelect={handleQuickReply} disabled={isThinking} />
      </div>

      {/* Input */}
      <div className="px-4 pt-2 pb-1 bg-white shrink-0">
        <div className="flex items-end gap-2 bg-[#F4F4F6] rounded-[24px] p-2 border border-gray-100">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta aquí…"
            disabled={isThinking}
            rows={1}
            className="flex-1 bg-transparent border-none focus:outline-none text-[14px]
              text-[#1a1a1a] resize-none max-h-[100px] min-h-[40px] px-3 py-2 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isThinking}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
              transition-all active:scale-95
              ${inputValue.trim() && !isThinking ? 'bg-[#2FD9A9] shadow-md' : 'bg-gray-300'}`}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

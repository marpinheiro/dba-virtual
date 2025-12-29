'use client';

// 1. Adicionamos 'useCallback' na importação
import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sidebar } from '@/components/Sidebar';

// --- COMPONENTE INTERNO DE CÓDIGO COM COPY ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CodeBlock = ({ children, className, ...rest }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const isInline = !match && !String(children).includes('\n');

  if (isInline) {
    return (
      <code className="bg-black/30 rounded px-1.5 py-0.5 text-yellow-300 font-mono text-sm" {...rest}>
        {children}
      </code>
    );
  }

  const codeContent = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e] shadow-lg">
      <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono uppercase">
          {match ? match[1] : 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? (
            <span className="text-green-400">Copiado!</span>
          ) : (
            <span>Copiar</span>
          )}
        </button>
      </div>
      
      <div className="p-4 overflow-x-auto custom-scrollbar">
        <code className="font-mono text-sm text-gray-300" {...rest}>
          {children}
        </code>
      </div>
    </div>
  );
};

// Tipos
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
}

interface ApiMessage {
  role: string;
  content: string;
}

// 2. Movi o getUserId para fora do componente (é uma função pura/auxiliar)
// Isso evita problemas de dependência no useEffect
const getUserId = () => {
  if (typeof window === 'undefined') return ''; 
  let userId = localStorage.getItem('dba_user_id');
  if (!userId) {
    userId = crypto.randomUUID(); 
    localStorage.setItem('dba_user_id', userId);
  }
  return userId;
};

export default function Home() {
  // --- ESTADOS ---
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Referência para auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- FUNÇÕES DE API ---

  // 3. Envolvi o fetchSessions com useCallback
  // Agora o React sabe que essa função é estável e não vai causar loops infinitos
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/history', {
        headers: {
          'x-user-id': getUserId() 
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setIsSidebarLoading(false);
    }
  }, []); // Dependências vazias = cria apenas uma vez

  // 4. Agora podemos adicionar [fetchSessions] na dependência sem medo
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsLoading(true);
    setIsOnline(true); 

    try {
      const res = await fetch(`/api/history/${sessionId}`, {
        headers: { 'x-user-id': getUserId() }
      });
      const data = await res.json();
      
      const formattedMessages = data.map((msg: ApiMessage) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setIsOnline(true);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (isLoading) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': getUserId() 
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages, 
          sessionId: currentSessionId 
        }),
      });

      if (response.status === 429) {
        setIsOnline(false); 
        throw new Error("Limite de cota atingido (429).");
      }

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: 'assistant', content: data.result }]);

      if (!currentSessionId) {
        await fetchSessions();
      }

    } catch (error) {
      console.error(error);
      
      let errorMsg = "Erro ao conectar com o servidor.";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any).message?.includes('429')) {
        errorMsg = "⚠️ **PAUSA TÉCNICA:** O limite gratuito da IA foi atingido. Aguarde alguns instantes e tente novamente.";
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // --- RENDERIZAÇÃO ---
  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden font-sans">
      
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={loadSession}
        onNewChat={handleNewChat}
        isLoading={isSidebarLoading}
      />

      <main className="flex-1 flex flex-col h-full bg-[#0b141a] relative">
        
        {/* HEADER */}
        <header className="px-6 py-4 bg-[#202c33] border-b border-gray-700 flex items-center justify-between shadow-sm z-10">
          <div className="flex flex-col">
             <h1 className="text-md font-semibold text-gray-100">
               {currentSessionId ? 'Sessão Ativa' : 'Nova Consulta'}
             </h1>
             
             <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-red-400'} flex items-center gap-1 transition-colors duration-300`}>
               <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
               {isOnline ? 'DBA Virtual Online' : 'Serviço em Pausa (Cota Atingida)'}
             </span>
          </div>
        </header>

        {/* MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-[url('/bg-chat-tile.png')] bg-repeat opacity-95">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60 space-y-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isOnline ? 'bg-gray-800' : 'bg-red-900/20'}`}>
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                 </svg>
              </div>
              <p className="text-lg font-medium">
                {isOnline ? 'Como posso ajudar com seu Banco de Dados?' : 'Sistema temporariamente indisponível'}
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-xl shadow-sm text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#005c4b] text-white rounded-tr-none' 
                    : 'bg-[#202c33] text-gray-100 rounded-tl-none border border-gray-700/50'
                }`}
              >
                <ReactMarkdown components={{ code: CodeBlock }}>
                  {msg.content}
                </ReactMarkdown>
                
                <div className={`text-[10px] mt-2 text-right opacity-70`}>
                   {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#202c33] p-4 rounded-xl rounded-tl-none border border-gray-700/50 flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="p-4 bg-[#202c33] border-t border-gray-700">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <textarea
              className="flex-1 bg-[#2a3942] text-white rounded-lg p-3.5 outline-none focus:ring-1 focus:ring-green-500 resize-none custom-scrollbar min-h-12 max-h-32 placeholder-gray-400 border border-transparent focus:border-green-500/50 transition-all"
              rows={1}
              placeholder={isOnline ? "Digite sua query ou dúvida..." : "Sistema em pausa técnica..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !isOnline}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim() || !isOnline}
              aria-label="Enviar mensagem"
              className={`text-white p-3 rounded-full transition-all shadow-lg flex items-center justify-center h-12 w-12 hover:scale-105 active:scale-95
                ${isOnline ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700 cursor-not-allowed opacity-50'}
              `}
            >
              <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24">
                <path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path>
              </svg>
            </button>
          </div>
          <div className="text-center text-[10px] text-gray-500 mt-2 opacity-60">
            Pressione Enter para enviar
          </div>
        </div>
      </main>
    </div>
  );
}
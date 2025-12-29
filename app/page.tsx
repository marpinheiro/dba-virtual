'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sidebar } from '@/components/Sidebar';

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

// --- COMPONENTE INTERNO DE CÓDIGO COM COPY ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CodeBlock = ({ children, className, ...rest }: any) => {
  const [copied, setCopied] = useState(false);
  
  // Verifica se é código inline ou bloco
  const match = /language-(\w+)/.exec(className || '');
  const isInline = !match && !String(children).includes('\n');

  // Se for inline (ex: `SELECT`), renderiza simples
  if (isInline) {
    return (
      <code className="bg-black/30 rounded px-1.5 py-0.5 text-yellow-300 font-mono text-sm" {...rest}>
        {children}
      </code>
    );
  }

  // Se for BLOCO, renderiza com botão de copiar
  const codeContent = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e] shadow-lg">
      {/* Barra superior do código */}
      <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono uppercase">
          {match ? match[1] : 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-400">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              <span className="text-green-400">Copiado!</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      
      {/* Área do código */}
      <div className="p-4 overflow-x-auto custom-scrollbar">
        <code className="font-mono text-sm text-gray-300" {...rest}>
          {children}
        </code>
      </div>
    </div>
  );
};

export default function Home() {
  // --- ESTADOS ---
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- FUNÇÕES DE API ---
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setSessions(data);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setIsSidebarLoading(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/history/${sessionId}`);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages, 
          sessionId: currentSessionId 
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: 'assistant', content: data.result }]);
      if (!currentSessionId) await fetchSessions();

    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: 'assistant', content: "Erro ao conectar com o servidor." }]);
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
        
        {/* Header do Chat */}
        <header className="px-6 py-4 bg-[#202c33] border-b border-gray-700 flex items-center justify-between shadow-sm z-10">
          <div className="flex flex-col">
             <h1 className="text-md font-semibold text-gray-100">
               {currentSessionId ? 'Sessão Ativa' : 'Nova Consulta'}
             </h1>
             <span className="text-xs text-green-400 flex items-center gap-1">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               DBA Virtual Online
             </span>
          </div>
        </header>

        {/* Área de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-[url('/bg-chat-tile.png')] bg-repeat opacity-95">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60 space-y-4">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-green-500">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                 </svg>
              </div>
              <p className="text-lg font-medium">Como posso ajudar com seu Banco de Dados?</p>
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
                {/* Markdown com componente de código customizado */}
                <ReactMarkdown 
                  components={{
                    code: CodeBlock
                  }}
                >
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

        {/* Input */}
        <div className="p-4 bg-[#202c33] border-t border-gray-700">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <textarea
              className="flex-1 bg-[#2a3942] text-white rounded-lg p-3.5 outline-none focus:ring-1 focus:ring-green-500 resize-none custom-scrollbar min-h-12 max-h-32 placeholder-gray-400 border border-transparent focus:border-green-500/50 transition-all"
              rows={1}
              placeholder="Digite sua query ou dúvida..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              aria-label="Enviar mensagem"
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white p-3 rounded-full transition-all shadow-lg flex items-center justify-center h-12 w-12 hover:scale-105 active:scale-95"
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
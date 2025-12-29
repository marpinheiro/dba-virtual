import React from 'react';

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
}

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  isLoading: boolean;
}

export function Sidebar({ sessions, currentSessionId, onSelectSession, onNewChat, isLoading }: SidebarProps) {
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="w-80 h-full flex flex-col border-r border-gray-700 bg-gray-900 text-white font-sans">
      
      {/* --- TOPO: Título e Botão Novo --- */}
      <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
        {/* CORREÇÃO AQUI: bg-linear-to-r em vez de bg-gradient-to-r */}
        <h2 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-linear-to-r from-green-400 to-emerald-500">
          CQLE-DBA
        </h2>
        
        <button 
          onClick={onNewChat}
          className="p-2 bg-gray-800 hover:bg-green-600 rounded-lg text-white transition-all duration-200 border border-gray-700 hover:border-green-500 shadow-md group"
          title="Nova Conversa"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 group-hover:rotate-90 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      {/* --- MEIO: Lista de Histórico (Scrollável) --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3 mt-2">
          Histórico
        </div>

        {isLoading ? (
          <div className="p-4 text-center text-gray-500 text-xs animate-pulse">Carregando...</div>
        ) : sessions.length === 0 ? (
          <div className="mt-10 text-center text-gray-500 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center opacity-50">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
               </svg>
            </div>
            <span className="text-sm opacity-60">Sem conversas anteriores</span>
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left p-3 mb-1 rounded-lg transition-all flex flex-col gap-1 group relative overflow-hidden
                ${currentSessionId === session.id 
                  ? 'bg-gray-800 text-green-100 shadow-md border border-gray-700' 
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                }
              `}
            >
              {currentSessionId === session.id && (
                <div className="absolute left-0 top-2 bottom-2 w-1 bg-green-500 rounded-r-full"></div>
              )}

              <div className="flex justify-between items-baseline w-full pl-2">
                <span className="font-medium text-sm truncate pr-2 w-48">
                  {session.title || "Nova Conversa"}
                </span>
                <span className="text-[10px] opacity-60 whitespace-nowrap">
                  {formatDate(session.createdAt)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* --- RODAPÉ: Créditos (Fixo embaixo) --- */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {/* CORREÇÃO AQUI: bg-linear-to-br em vez de bg-gradient-to-br */}
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-blue-600 flex items-center justify-center text-[10px] font-bold shadow-lg">
            CQ
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-gray-200">CQLE Softwares</span>
            <span className="text-[10px] text-gray-500">Dev. Marciano Silva</span>
          </div>
        </div>
      </div>

    </div>
  );
}
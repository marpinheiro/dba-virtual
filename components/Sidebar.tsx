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
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewChat, 
  isLoading,
  isOpen,   
  onClose   
}: SidebarProps) {
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <>
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-gray-900 text-white border-r border-gray-700 flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        
        {/* TOPO */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          {/* CORREÇÃO: bg-linear-to-r */}
          <h2 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-linear-to-r from-green-400 to-emerald-500">
            CQLE-DBA
          </h2>
          
          <div className="flex gap-2">
            <button 
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onClose(); 
              }}
              className="p-2 bg-gray-800 hover:bg-green-600 rounded-lg text-white transition-all duration-200 border border-gray-700 hover:border-green-500 shadow-md group"
              title="Nova Conversa"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 group-hover:rotate-90 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>

            {/* CORREÇÃO: aria-label adicionado */}
            <button 
              onClick={onClose}
              aria-label="Fechar menu lateral"
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3 mt-2">
            Histórico
          </div>

          {isLoading ? (
            <div className="p-4 text-center text-gray-500 text-xs animate-pulse">Carregando...</div>
          ) : sessions.length === 0 ? (
            <div className="mt-10 text-center text-gray-500 flex flex-col items-center gap-3">
              <span className="text-2xl opacity-20">💬</span>
              <span className="text-sm opacity-60">Sem conversas anteriores</span>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  onSelectSession(session.id);
                  if (window.innerWidth < 768) onClose(); 
                }}
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

        {/* RODAPÉ */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
             {/* CORREÇÃO: bg-linear-to-br */}
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

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}
    </>
  );
}
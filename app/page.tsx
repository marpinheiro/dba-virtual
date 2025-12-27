'use client';

import { useState, useRef, useEffect } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg.content,
          history: messages 
        }),
      });

      const data = await response.json();
      
      if (data.result) {
        setMessages([...newHistory, { role: 'assistant', content: data.result }]);
      } else if (data.error) {
        setMessages([...newHistory, { role: 'assistant', content: `Erro: ${data.error}` }]);
      }
    } catch (error) {
      console.error(error);
      setMessages([...newHistory, { role: 'assistant', content: "Erro de conexão com o servidor." }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000); // Reseta o ícone após 2 segundos
  };

  const isDanger = (text: string) => text.includes('[ALERTA DE PERIGO]');

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center gap-3 shadow-md">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl text-white">CQ</div>
        <div>
          <h1 className="font-bold text-lg text-white">CQLE DBA VIRTUAL</h1>
          <p className="text-xs text-indigo-400">Oracle • SQL Server • Mongo</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center mt-20 opacity-60">
            <h2 className="text-2xl font-bold">Bem vindo ao DBA Virtual</h2>
            <p>Envie sua dúvida SQL.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const danger = msg.role === 'assistant' && isDanger(msg.content);
          return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative max-w-[85%] md:max-w-[70%] p-4 rounded-xl whitespace-pre-wrap group ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : danger 
                      ? 'bg-red-950 border border-red-500 text-red-100 rounded-tl-none' 
                      : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Botão de Copiar (Aparece só nas mensagens do Assistente) */}
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(msg.content.replace('[ALERTA DE PERIGO]', ''), i)}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-black/20 hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100"
                    title="Copiar resposta"
                  >
                    {copiedIndex === i ? (
                      <span className="text-green-400 text-xs font-bold">Copiado! ✓</span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    )}
                  </button>
                )}
                
                {msg.content.replace('[ALERTA DE PERIGO]', '')}
              </div>
            </div>
          );
        })}
        {loading && <div className="flex justify-start"><div className="bg-slate-800 p-3 rounded-xl rounded-tl-none text-slate-400 text-sm animate-pulse">Analisando...</div></div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-3">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none text-white" 
          placeholder="Digite sua dúvida..." 
          disabled={loading}
        />
        <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50">Enviar</button>
      </form>
    </div>
  );
}
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
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      // [CORREÇÃO] O erro agora é usado no console, resolvendo o aviso do ESLint
      console.error("Erro fatal na requisição:", error);
      alert('Erro de conexão. Verifique o console.');
    } finally {
      setLoading(false);
    }
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
              <div className={`max-w-[80%] p-4 rounded-xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600' : danger ? 'bg-red-900 border-red-500 border' : 'bg-slate-800'}`}>
                {msg.content.replace('[ALERTA DE PERIGO]', '')}
              </div>
            </div>
          );
        })}
        {loading && <div className="p-4 text-slate-500 animate-pulse">Digitando...</div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-3">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none" 
          placeholder="Digite sua dúvida..." 
          disabled={loading}
        />
        <button type="submit" disabled={loading} className="bg-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50">Enviar</button>
      </form>
    </div>
  );
}
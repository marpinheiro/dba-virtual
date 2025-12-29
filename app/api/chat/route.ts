import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma"; // Importando a conexão centralizada
import dns from 'node:dns';

// Fix DNS para evitar timeouts na conexão
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignora se não suportado
}

export const dynamic = 'force-dynamic';

const SYSTEM_MESSAGE_TEXT = `
INSTRUÇÃO DO SISTEMA: Você é o "CQLE DBA VIRTUAL", Consultor Sênior em Banco de Dados.
DIRETRIZES:
1. Ajude com queries e performance (Oracle, SQL Server, Mongo, etc).
2. [ALERTA DE PERIGO]: Se o usuário pedir DELETE/DROP/TRUNCATE, avise o risco.
Seja direto e técnico.
`;

interface MessageHistory {
  role: string;
  content: string;
}

export async function POST(req: Request) {
  try {
    // 1. Rate Limit (Opcional - Proteção contra abuso)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      const ratelimit = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(20, "60 m"), 
        analytics: true,
      });
      const ip = req.headers.get("x-forwarded-for") || "ip-local";
      const { success } = await ratelimit.limit(ip);
      if (!success) return NextResponse.json({ error: "Muitas requisições. Aguarde um pouco." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API Key ausente." }, { status: 500 });
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" },{apiVersion: "v1beta"});

    const body = await req.json();
    const message: string = body.message;
    const history: MessageHistory[] = body.history || [];
    const requestSessionId: string | undefined = body.sessionId;
    const userId = req.headers.get("x-user-id") || "anonimo";

    let finalMessage = message;
    
    // Prepara histórico para o formato do Google
    const chatHistory = history.map((msg: MessageHistory) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    if (chatHistory.length === 0) {
        finalMessage = `${SYSTEM_MESSAGE_TEXT}\n\nPERGUNTA DO USUÁRIO: ${message}`;
    }

    const chat = model.startChat({ history: chatHistory });
    console.log(`Enviando mensagem para Gemini...`);
    
    const result = await chat.sendMessage(finalMessage);
    const responseText = result.response.text();

    // Salvar no Banco
    try {
      let sessionId = requestSessionId;

      if (!sessionId) {
        const title = message.length > 30 ? message.substring(0, 30) + "..." : message;
        
        const newSession = await prisma.chatSession.create({
          data: {
            title: title,
            userId: userId,
          }
        });
        sessionId = newSession.id;
      }

      await prisma.chatMessage.create({
        data: { role: 'user', content: message, sessionId: sessionId }
      });
      await prisma.chatMessage.create({
        data: { role: 'assistant', content: responseText, sessionId: sessionId }
      });

    } catch (dbError) {
      console.error("Erro ao salvar no banco:", dbError);
    }

    return NextResponse.json({ result: responseText });

  } catch (unknownError: unknown) {
    console.error("ERRO API:", unknownError);
    
    let errorMessage = "Erro desconhecido";
    if (unknownError instanceof Error) errorMessage = unknownError.message;
    else if (typeof unknownError === "string") errorMessage = unknownError;

    // --- DETECÇÃO DO ERRO DE COTA (429) ---
    // Se o Google disser que acabou a cota, avisamos o front com status 429
    if (errorMessage.includes('429') || errorMessage.includes('Quota exceeded')) {
       return NextResponse.json(
         { error: "Limite de cota da IA atingido. Sistema em pausa técnica." },
         { status: 429 } 
       );
    }

    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
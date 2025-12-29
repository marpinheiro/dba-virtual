import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 1. FORÇA O MODO DINÂMICO
export const dynamic = 'force-dynamic';

// 2. CONFIGURAÇÃO DO BANCO (Singleton do Prisma)
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const SYSTEM_MESSAGE_TEXT = `
INSTRUÇÃO DO SISTEMA: Você é o "CQLE DBA VIRTUAL", Consultor Sênior em Banco de Dados.
DIRETRIZES:
1. Ajude com queries e performance (Oracle, SQL Server, Mongo, etc).
2. [ALERTA DE PERIGO]: Se o usuário pedir DELETE/DROP/TRUNCATE, avise o risco.
Seja direto e técnico.
`;

interface MessageItem {
  role: string;
  content: string;
}

export async function POST(req: Request) {
  try {
    // A. RATE LIMIT (Proteção)
    let ratelimit = null;
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      
      ratelimit = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(20, "60 m"), 
        analytics: true,
      });
    }

    if (ratelimit) {
      const ip = req.headers.get("x-forwarded-for") || "ip-local";
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: "Limite de uso excedido (Rate Limit). Aguarde um pouco." },
          { status: 429 }
        );
      }
    }

    // B. CONFIGURAÇÃO GEMINI
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Configuração de API ausente (GEMINI_API_KEY)." }, { status: 500 });
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);

    // --- CORREÇÃO AQUI ---
    // Usamos o 'gemini-1.5-flash' por ser o padrão estável global (Tier 1).
    // O 2.0-flash às vezes requer endpoints v1beta específicos que variam por versão do SDK.
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest" 
    },{apiVersion: "v1beta"});

    const body = await req.json();
    const message: string = body.message;
    const history: MessageItem[] = body.history || [];

    // C. CONTEXTO
    let finalMessage = message;
    
    // Converte histórico para formato do Google
    const chatHistory = history.map((msg: MessageItem) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    if (chatHistory.length === 0) {
        finalMessage = `${SYSTEM_MESSAGE_TEXT}\n\nPERGUNTA DO USUÁRIO: ${message}`;
    }

    const chat = model.startChat({
      history: chatHistory,
    });

    console.log(`Enviando mensagem para Gemini (${message.substring(0, 20)}... model: gemini-flash-latest)`);

    // Envio da mensagem
    const result = await chat.sendMessage(finalMessage);
    const responseText = result.response.text();

    // D. SALVAR NO BANCO
    try {
      await prisma.chatLog.create({
        data: {
          question: message,
          answer: responseText,
        }
      });
    } catch (dbError) {
      console.error("Erro ao salvar no banco (não crítico):", dbError);
    }

    return NextResponse.json({ result: responseText });

  } catch (unknownError: unknown) {
    console.error("--- ERRO CRÍTICO NA API ---");
    console.error(unknownError);
    
    let errorMessage = "Erro desconhecido";
    
    if (unknownError instanceof Error) {
        errorMessage = unknownError.message;
    } else if (typeof unknownError === "object" && unknownError !== null && "message" in unknownError) {
        errorMessage = String((unknownError as { message: unknown }).message);
    } else if (typeof unknownError === "string") {
        errorMessage = unknownError;
    }

    let msg = "Erro interno no servidor.";
    
    // Tratamento específico do erro atual
    if (errorMessage.includes('fetch failed')) {
        msg = "Falha de conexão do Node.js com o Google. Verifique sua internet ou firewall.";
    }
    if (errorMessage.includes('404')) msg = "Modelo não encontrado (404).";
    if (errorMessage.includes('429')) msg = "Sistema sobrecarregado (429).";

    return NextResponse.json({ error: msg, details: errorMessage }, { status: 500 });
  }
}
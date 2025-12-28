import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 1. FORÇA O MODO DINÂMICO (Evita erro de Build da Vercel)
export const dynamic = 'force-dynamic';

// 2. CONFIGURAÇÃO DO BANCO (Singleton do Prisma)
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// --- AQUI ESTÁ O TRUQUE ---
// Como o 'gemini-pro' antigo não aceita System Instruction nativo,
// vamos mandar isso como texto normal no início.
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
        limiter: Ratelimit.slidingWindow(5, "60 m"),
        analytics: true,
      });
    }

    if (ratelimit) {
      const ip = req.headers.get("x-forwarded-for") || "ip-local";
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: "Você atingiu o limite de 5 perguntas. Aguarde 60 minutos." },
          { status: 429 }
        );
      }
    }

    // B. CONFIGURAÇÃO GEMINI
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chave Gemini não encontrada.");
    
    const genAI = new GoogleGenerativeAI(apiKey);

    // MUDANÇA CRUCIAL: Usamos 'gemini-pro' (Estável)
    // E removemos o 'systemInstruction' daqui para não dar erro.
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro"
    });

    const body = await req.json();
    const message: string = body.message;
    const history: MessageItem[] = body.history || [];

    // C. TRUQUE DO CONTEXTO
    // Se não tiver histórico, adicionamos a instrução do sistema antes da pergunta
    let finalMessage = message;
    
    // Convertemos o histórico para o formato do Google
    // Se o histórico estiver vazio, significa que é a primeira mensagem.
    // Nesse caso, grudamos a instrução do sistema junto com a pergunta.
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
      console.error("Erro banco:", dbError);
    }

    return NextResponse.json({ result: responseText });

  } catch (unknownError: unknown) {
    console.error("--- ERRO ---", unknownError);
    const error = unknownError as { message?: string, status?: number };
    
    let msg = "Erro interno.";
    if (error.message?.includes('429')) msg = "Sistema sobrecarregado (Cota). Tente depois.";
    if (error.message?.includes('404')) msg = "Erro de Modelo (404).";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
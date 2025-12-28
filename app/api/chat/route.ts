import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 1. FORÇA O MODO DINÂMICO (Essencial para não dar erro de Build)
export const dynamic = 'force-dynamic';

// 2. CONFIGURAÇÃO DO BANCO (PRISMA)
// O Prisma precisa ficar fora para manter a conexão viva (Singleton Pattern)
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const SYSTEM_INSTRUCTION = `
Você é o "CQLE DBA VIRTUAL", Consultor Sênior em Banco de Dados.
DIRETRIZES:
1. Ajude com queries e performance (Oracle, SQL Server, Mongo, etc).
2. [ALERTA DE PERIGO]: Se o usuário pedir DELETE/DROP/TRUNCATE, avise o risco.
`;

interface MessageItem {
  role: string;
  content: string;
}

// Interface para tipagem de erros
interface GoogleGenAIError {
  message?: string;
  status?: number;
}

export async function POST(req: Request) {
  try {
    // --- INICIALIZAÇÃO "LAZY" (DENTRO DA FUNÇÃO) ---
    // Isso evita que o Build da Vercel quebre ao ler o arquivo
    
    // A. CONFIGURAÇÃO REDIS
    let ratelimit = null;
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      
      ratelimit = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(5, "60 m"), // 5 msg / 60 min
        analytics: true,
      });
    }

    // B. VERIFICAÇÃO DE SEGURANÇA
    if (ratelimit) {
      const ip = req.headers.get("x-forwarded-for") || "ip-local";
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json(
          { error: "Você atingiu o limite de 5 perguntas. Aguarde 60 minutos para continuar." },
          { status: 429 }
        );
      }
    }

    // C. CONFIGURAÇÃO GEMINI (Só inicia se tiver a chave)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Chave da API Gemini não configurada no servidor.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Usando modelo 1.5-flash-001 (Estável e com alta cota)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-001", 
      systemInstruction: SYSTEM_INSTRUCTION 
    });

    // D. PROCESSAMENTO DA MENSAGEM
    const body = await req.json();
    const message: string = body.message;
    const history: MessageItem[] = body.history || [];

    const chat = model.startChat({
      history: history.map((msg: MessageItem) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // E. SALVAR NO BANCO
    try {
      await prisma.chatLog.create({
        data: {
          question: message,
          answer: responseText,
        }
      });
      console.log("✅ Log salvo.");
    } catch (dbError) {
      console.error("Erro banco (não fatal):", dbError);
    }

    return NextResponse.json({ result: responseText });

  } catch (unknownError: unknown) {
    console.error("--- ERRO NA ROTA ---", unknownError);
    
    const error = unknownError as GoogleGenAIError;
    let userMessage = "Ocorreu um erro interno. Tente novamente.";
    let statusCode = 500;

    if (error.message?.includes('429') || error.status === 429) {
      userMessage = "O sistema está com alto tráfego (Limite da IA). Tente em 1 minuto.";
      statusCode = 429;
    } else if (error.message?.includes('404') || error.status === 404) {
      userMessage = "Erro de modelo IA (404). Contate o administrador.";
    }

    return NextResponse.json({ error: userMessage }, { status: statusCode });
  }
}
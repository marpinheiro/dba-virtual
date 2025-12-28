import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// --- 1. CONFIGURAÇÃO DE TIPAGEM (Para o TypeScript não reclamar) ---
interface MessageItem {
  role: string;
  content: string;
}

// --- 2. CONFIGURAÇÃO DO REDIS (RATE LIMIT) ---
// Verifica se as chaves existem. Se não existirem (ex: ambiente local sem env), desativa o limitador.
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Regra: 5 requisições a cada 15 minutos
const ratelimit = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, "60 m"),
      analytics: true,
    })
  : null;

// --- 3. CONFIGURAÇÃO DO BANCO (PRISMA) ---
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// --- 4. CONFIGURAÇÃO GEMINI ---
const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

const SYSTEM_INSTRUCTION = `
Você é o "CQLE DBA VIRTUAL", Consultor Sênior em Banco de Dados.
DIRETRIZES:
1. Ajude com queries e performance (Oracle, SQL Server, Mongo, etc).
2. [ALERTA DE PERIGO]: Se o usuário pedir DELETE/DROP/TRUNCATE, avise o risco.
`;

export async function POST(req: Request) {
  try {
    // A. SEGURANÇA (RATE LIMIT)
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

    // B. RECEBE DADOS
    const body = await req.json();
    const message: string = body.message;
    // Aqui usamos a tipagem MessageItem[] para corrigir o erro do "any"
    const history: MessageItem[] = body.history || [];

    // C. IA GERA RESPOSTA
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest", 
      systemInstruction: SYSTEM_INSTRUCTION 
    });

    const chat = model.startChat({
      history: history.map((msg: MessageItem) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // D. SALVA NO BANCO
    try {
      await prisma.chatLog.create({
        data: {
          question: message,
          answer: responseText,
        }
      });
      console.log("✅ Log salvo.");
    } catch (e) {
      console.error("Erro banco (não fatal):", e);
    }

    return NextResponse.json({ result: responseText });

  } catch (error: unknown) {
    // Tratamento de erro tipado (substituindo o 'any')
    console.error("--- ERRO GERAL ---", error);
    
    let errorMessage = "Erro interno.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
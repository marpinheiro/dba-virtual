import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// --- 1. CONFIGURAÇÃO ESSENCIAL PARA VERCEL ---
export const dynamic = 'force-dynamic';

// --- 2. CONFIGURAÇÃO DE TIPAGEM ---
interface MessageItem {
  role: string;
  content: string;
}

// Interface para tratar o erro sem usar 'any'
interface GoogleGenAIError {
  message?: string;
  status?: number;
}

// --- 3. CONFIGURAÇÃO DO REDIS (RATE LIMIT) ---
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Regra: 5 requisições a cada 60 minutos
const ratelimit = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, "60 m"),
      analytics: true,
    })
  : null;

// --- 4. CONFIGURAÇÃO DO BANCO (PRISMA) ---
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// --- 5. CONFIGURAÇÃO GEMINI ---
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
    const history: MessageItem[] = body.history || [];

    // C. IA GERA RESPOSTA
    // Usando modelo com cota alta (1.5 Flash)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
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
    } catch (dbError) {
      console.error("Erro banco (não fatal):", dbError);
    }

    return NextResponse.json({ result: responseText });

  } catch (unknownError: unknown) {
    // CORREÇÃO AQUI: Trocamos 'any' por 'unknown' e fazemos o cast seguro
    console.error("--- ERRO NA IA ---", unknownError);
    
    // Tratamos o erro como um objeto que pode ter message ou status
    const error = unknownError as GoogleGenAIError;
    
    let userMessage = "Ocorreu um erro interno. Tente novamente.";
    let statusCode = 500;

    // Lógica para detectar erro de Cota (429) ou Modelo não encontrado (404)
    if (error.message?.includes('429') || error.status === 429) {
      userMessage = "O sistema está com alto tráfego no momento (Limite da IA atingido). Por favor, tente novamente em alguns instantes.";
      statusCode = 429;
    } 
    else if (error.message?.includes('404') || error.status === 404) {
      userMessage = "Erro de configuração da IA (Modelo não encontrado ou biblioteca desatualizada).";
    }

    return NextResponse.json({ error: userMessage }, { status: statusCode });
  }
}
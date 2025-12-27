import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Interface para garantir a tipagem
interface MessageItem {
  role: string;
  content: string;
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY não encontrada no .env.local");
}

const genAI = new GoogleGenerativeAI(apiKey);

const SYSTEM_INSTRUCTION = `
Você é o "CQLE DBA VIRTUAL", Consultor Sênior em Banco de Dados.
DIRETRIZES:
1. Ajude com queries e performance (Oracle, SQL Server, Mongo, etc).
2. [ALERTA DE PERIGO]: Se o usuário pedir DELETE/DROP/TRUNCATE, avise o risco.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = body.message;
    const history: MessageItem[] = body.history;

    // --- CORREÇÃO FINAL BASEADA NO SEU JSON ---
    // Sua lista JSON mostrou que você tem acesso ao "gemini-flash-latest".
    // Esse é o alias correto para a versão Flash mais atual na sua conta.
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
    const response = result.response.text();

    return NextResponse.json({ result: response });

  } catch (error: unknown) { 
    console.error("--- ERRO NO GEMINI ---", error);
    
    let errorMessage = "Erro interno.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: `Erro na IA: ${errorMessage}` }, 
      { status: 500 }
    );
  }
}
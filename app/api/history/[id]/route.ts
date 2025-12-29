import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// Correção: Definimos que 'params' é uma Promise que devolve um objeto com id
type Props = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, props: Props) {
  try {
    // A MÁGICA: Usamos 'await' para desembrulhar os parâmetros
    const params = await props.params;
    const sessionId = params.id;

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
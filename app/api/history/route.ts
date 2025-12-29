import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
        return NextResponse.json([]); 
    }

    const sessions = await prisma.chatSession.findMany({
      where: {
        userId: userId, // <--- FILTRA SÓ AS CONVERSAS DESTE USUÁRIO
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    return NextResponse.json({ error: "Erro ao buscar histórico" }, { status: 500 });
  }
}
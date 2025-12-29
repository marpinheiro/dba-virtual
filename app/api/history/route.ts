import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Importando do arquivo que criamos no passo 1

export const dynamic = 'force-dynamic'; // Garante que não faça cache velho

export async function GET() {
  try {
    // Busca as sessões ordenadas pela mais recente
    const sessions = await prisma.chatSession.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        // Opcional: Pegar a primeira mensagem só pra mostrar um "preview" se quiser
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    return NextResponse.json({ error: "Erro ao buscar histórico" }, { status: 500 });
  }
}
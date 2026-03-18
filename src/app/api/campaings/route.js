import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "10");

        const skip = (page - 1) * pageSize;

        // Obtener campañas con conteo de clientes (sin traer todos los registros)
        const [campaigns, totalCount] = await Promise.all([
            prisma.campanha.findMany({
                skip,
                take: pageSize,
                include: {
                    template: true,
                    _count: {
                        select: { cliente_campanha: true }
                    }
                },
                orderBy: { fecha_creacion: "desc" }
            }),
            prisma.campanha.count()
        ]);

        return NextResponse.json({ campaigns: campaigns || [], totalCount });
    } catch (error) {
        console.error("Error al obtener campañas:", error);
        return NextResponse.json({ error: "Error al obtener campañas" }, { status: 500 });
    }
}

// Crear campaña
export async function POST(req) {
    try {
        const { nombre_campanha, descripcion, template_id, fecha_fin } = await req.json();
        const campanha = await prisma.campanha.create({
            data: { nombre_campanha, descripcion, template_id: null, fecha_fin: new Date(fecha_fin) },
        });

        return NextResponse.json({ message: "Campaña creada con éxito", campanha });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Error al crear la campaña" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";


export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "10");

        // 🔹 Calcular skip correctamente
        const skip = (page - 1) * pageSize;

        // 🔹 Obtener campañas con paginación
        const campaigns = await prisma.campanha.findMany({
            skip: skip,
            take: pageSize,
            include: { 
                template: true,
                cliente_campanha: {
                    include: {
                        cliente: true
                    }
                }
            },
            orderBy: { fecha_creacion: "desc" }
        });

        // 🔹 Validar si `campaigns` es `null` o `undefined`
        if (!campaigns) {
            return NextResponse.json({ campaigns: [], totalCount: 0 });
        }

        // 🔹 Contar total de campañas
        const totalCount = await prisma.campanha.count();

        return NextResponse.json({ campaigns, totalCount });
    } catch (error) {
        console.error("Error al obtener campañas:", error);
        return NextResponse.json({ error: "Error al obtener campañas" }, { status: 500 });
    }
}

// 📌 Crear campaña
export async function POST(req) {
    try {
        const { nombre_campanha, descripcion, template_id, fecha_fin } = await req.json();
        console.log("Campaña",nombre_campanha,descripcion,template_id,fecha_fin);
        const campanha = await prisma.campanha.create({
            data: { nombre_campanha, descripcion, template_id : null, fecha_fin: new Date(fecha_fin) },
        });
        
        return NextResponse.json({ message: "Campaña creada con éxito", campanha });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Error al crear la campaña" }, { status: 500 });
    }
}

// 📌 Cargar clientes a la campaña
export async function PATCH(req) {
    try {
        const { id } = req.query;
        const formData = await req.formData();
        const file = formData.get("archivo");

        if (!file) return NextResponse.json({ error: "No se proporcionó archivo" }, { status: 400 });

        const filePath = path.join(process.cwd(), "uploads", file.name);
        await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

        // 🚀 Leer archivo Excel y agregar clientes
        const clientesData = [{ nombre: "Juan", celular: "123456789" }]; // (Simulado)

        for (const cliente of clientesData) {
            const clienteExistente = await prisma.cliente.findUnique({
                where: { celular: cliente.celular },
            });

            const cliente_id = clienteExistente
                ? clienteExistente.cliente_id
                : (await prisma.cliente.create({ data: cliente })).cliente_id;

            await prisma.cliente_campanha.create({ data: { cliente_id, campanha_id: parseInt(id) } });
        }

        return NextResponse.json({ message: "Clientes agregados" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Error al cargar clientes" }, { status: 500 });
    }
}

// 📌 Eliminar campaña
export async function DELETE(req) {
    try {
        const { id } = req.query;

        await prisma.cliente_campanha.deleteMany({ where: { campanha_id: parseInt(id) } });
        await prisma.campanha.delete({ where: { campanha_id: parseInt(id) } });

        return NextResponse.json({ message: "Campaña eliminada" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Error al eliminar la campaña" }, { status: 500 });
    }
}

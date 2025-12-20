import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { MongoClient } from "mongodb";
require("dotenv").config();

const uri = process.env.DATABASE_URL_MONGODB;
const clientPromise = new MongoClient(uri).connect();

export async function POST(req, context) {
    try {
      console.log("📌 Iniciando carga de clientes...");
  
      const { params } = context;
      if (!params || !params.id) {
        console.error("❌ Error: ID de campaña no válido");
        return NextResponse.json({ error: "ID de campaña no válido" }, { status: 400 });
      }
  
      const campanhaId = Number(params.id);
      if (isNaN(campanhaId)) {
        console.error("❌ Error: El ID de la campaña no es un número válido");
        return NextResponse.json({ error: "El ID de la campaña no es un número válido" }, { status: 400 });
      }
  
      console.log(`✅ ID de campaña recibido: ${campanhaId}`);
  
      const formData = await req.formData();
      const file = formData.get("archivo");
  
      if (!file) {
        console.error("❌ Error: No se proporcionó ningún archivo");
        return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
      }
  
      console.log(`📌 Archivo recibido: ${file.name}`);
  
      const buffer = Buffer.from(await file.arrayBuffer());
      let clientes = [];
  
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        console.log("📌 Procesando archivo Excel...");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        clientes = XLSX.utils.sheet_to_json(sheet);
      } else {
        console.error("❌ Error: Formato de archivo no válido");
        return NextResponse.json({ error: "Formato de archivo no válido. Debe ser .xlsx o .csv" }, { status: 400 });
      }
  
      if (clientes.length === 0) {
        console.error("❌ Error: El archivo está vacío o tiene formato incorrecto");
        return NextResponse.json({ error: "El archivo está vacío o no tiene formato válido" }, { status: 400 });
      }
  
      console.log("📌 Clientes cargados desde archivo:", clientes);

      const clientesProcesados = [];
      const mongoClient = await clientPromise;
      const db = mongoClient.db(process.env.MONGODB_DB);

      // ✅ OPTIMIZACIÓN 1: Normalizar todos los números de una vez
      const clientesNormalizados = clientes
        .filter(c => c.Numero && c.Nombre)
        .map(cliente => {
          let numero = String(cliente.Numero).trim();
          if (!numero.startsWith("+51")) {
            numero = `+51${numero}`;
          }
          return {
            ...cliente,
            celularNormalizado: numero
          };
        });

      if (clientesNormalizados.length === 0) {
        console.warn("⚠️ No hay clientes válidos para procesar");
        return NextResponse.json({
          message: "No hay clientes válidos en el archivo",
          clientes: []
        });
      }

      const celulares = clientesNormalizados.map(c => c.celularNormalizado);
      console.log(`📊 Total de clientes a procesar: ${celulares.length}`);

      // ✅ OPTIMIZACIÓN 2: Traer todos los clientes existentes en UN SOLO query
      console.log("🔍 Consultando clientes existentes en MySQL...");
      const existingClientesMySQL = await prisma.cliente.findMany({
        where: { celular: { in: celulares } }
      });
      const mysqlClientesMap = new Map(existingClientesMySQL.map(c => [c.celular, c]));
      console.log(`✅ Encontrados ${existingClientesMySQL.length} clientes existentes en MySQL`);

      // ✅ OPTIMIZACIÓN 3: Traer todos los clientes de MongoDB en UN SOLO query
      console.log("🔍 Consultando clientes existentes en MongoDB...");
      const existingClientesMongo = await db.collection("clientes").find({
        celular: { $in: celulares }
      }).toArray();
      const mongoClientesMap = new Map(existingClientesMongo.map(c => [c.celular, c]));
      console.log(`✅ Encontrados ${existingClientesMongo.length} clientes existentes en MongoDB`);

      // ✅ OPTIMIZACIÓN 4: Crear nuevos clientes en MySQL con createMany (batch)
      const nuevosClientesMySQL = clientesNormalizados
        .filter(c => !mysqlClientesMap.has(c.celularNormalizado))
        .map(c => ({
          celular: c.celularNormalizado,
          nombre: c.Nombre,
          documento_identidad: "",
          tipo_documento: "Desconocido",
          estado: "no contactado",
          gestor: c.Asesor || null
        }));

      let clientesCreadosMySQL = [];
      if (nuevosClientesMySQL.length > 0) {
        console.log(`🔹 Creando ${nuevosClientesMySQL.length} nuevos clientes en MySQL...`);
        try {
          await prisma.cliente.createMany({
            data: nuevosClientesMySQL,
            skipDuplicates: true
          });

          // Volver a consultar para obtener los IDs
          clientesCreadosMySQL = await prisma.cliente.findMany({
            where: { celular: { in: nuevosClientesMySQL.map(c => c.celular) } }
          });

          // Actualizar el mapa
          clientesCreadosMySQL.forEach(c => mysqlClientesMap.set(c.celular, c));
          console.log(`✅ ${clientesCreadosMySQL.length} clientes creados en MySQL`);
        } catch (err) {
          console.error("❌ Error al crear clientes en MySQL:", err);
        }
      }

      // ✅ OPTIMIZACIÓN 5: Crear nuevos clientes en MongoDB con insertMany (batch)
      const nuevosClientesMongo = clientesNormalizados
        .filter(c => !mongoClientesMap.has(c.celularNormalizado))
        .map(c => {
          const clienteMySQL = mysqlClientesMap.get(c.celularNormalizado);
          return {
            id_cliente: `cli_${clienteMySQL?.cliente_id}`,
            nombre: c.Nombre,
            celular: c.celularNormalizado,
            correo: "",
            conversaciones: []
          };
        });

      if (nuevosClientesMongo.length > 0) {
        console.log(`🔹 Creando ${nuevosClientesMongo.length} nuevos clientes en MongoDB...`);
        try {
          await db.collection("clientes").insertMany(nuevosClientesMongo, { ordered: false });
          console.log(`✅ ${nuevosClientesMongo.length} clientes creados en MongoDB`);
        } catch (err) {
          // insertMany con ordered:false continúa incluso si hay duplicados
          if (err.code === 11000) {
            console.log(`⚠️ Algunos clientes ya existían en MongoDB (esperado)`);
          } else {
            console.error("❌ Error al crear clientes en MongoDB:", err);
          }
        }
      }

      // ✅ OPTIMIZACIÓN 6: Consultar relaciones cliente_campanha existentes en UN SOLO query
      const clienteIds = Array.from(mysqlClientesMap.values()).map(c => c.cliente_id);
      console.log("🔍 Consultando relaciones cliente-campaña existentes...");
      const existingRelaciones = await prisma.cliente_campanha.findMany({
        where: {
          cliente_id: { in: clienteIds },
          campanha_id: campanhaId
        }
      });
      const relacionesSet = new Set(existingRelaciones.map(r => r.cliente_id));
      console.log(`✅ Encontradas ${existingRelaciones.length} relaciones existentes`);

      // ✅ OPTIMIZACIÓN 7: Crear relaciones cliente_campanha con createMany (batch)
      const nuevasRelaciones = clienteIds
        .filter(id => !relacionesSet.has(id))
        .map(id => ({
          cliente_id: id,
          campanha_id: campanhaId
        }));

      if (nuevasRelaciones.length > 0) {
        console.log(`🔹 Creando ${nuevasRelaciones.length} nuevas relaciones cliente-campaña...`);
        try {
          await prisma.cliente_campanha.createMany({
            data: nuevasRelaciones,
            skipDuplicates: true
          });
          console.log(`✅ ${nuevasRelaciones.length} relaciones creadas`);
        } catch (err) {
          console.error("❌ Error al crear relaciones:", err);
        }
      }

      // Construir resultado final
      clientesNormalizados.forEach(c => {
        const clienteMySQL = mysqlClientesMap.get(c.celularNormalizado);
        if (clienteMySQL) {
          clientesProcesados.push({
            cliente_id: clienteMySQL.cliente_id,
            nombre: clienteMySQL.nombre,
            celular: clienteMySQL.celular,
            gestor: clienteMySQL.gestor
          });
        }
      });
  
      console.log(`✅ Carga de clientes completada con éxito. Total procesados: ${clientesProcesados.length}`);
  
      return NextResponse.json({
        message: `Clientes procesados con éxito en la campaña ${campanhaId}`,
        clientes: clientesProcesados,
      });
    } catch (error) {
      console.error("❌ Error al cargar clientes:", error);
      return NextResponse.json({ error: "Error al procesar el archivo" }, { status: 500 });
    }
  }

// 🔹 Obtener clientes de una campaña
export async function GET(req, { params }) {
  try {
    const clientes = await prisma.cliente_campanha.findMany({
      where: { campanha_id: parseInt(params.id) },
      include: { cliente: true },
    });

    return NextResponse.json(clientes);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 🔹 Eliminar cliente de campaña
export async function DELETE(req, { params }) {
  try {
    const { cliente_id } = await req.json();
    await prisma.cliente_campanha.deleteMany({
      where: { campanha_id: parseInt(params.id), cliente_id },
    });

    return NextResponse.json({ message: "Cliente eliminado" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
  import admin from "firebase-admin";
  import { getToken } from "next-auth/jwt";
  import prisma from "@/lib/prisma";
    
  // Inicializar Firestore solo si no está inicializado
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),    
    });
  }
    
  const db = admin.firestore();

  export async function GET(request, context) {
    try {
      let celularFormatted;
      const params = await context.params;
      const { id } = params;//se obtiene de clientesService

      let registro;            // contendrá o bien el cliente normal o el “nuevo”
      let esTelefono = false

      console.log("id es: ",id);
      // Buscar cliente en Prisma (MySQL/PostgreSQL)
      if(/^\d+$/.test(id)){
        const cliente = await prisma.cliente.findUnique({
          where: { cliente_id: parseInt(id) },
          select: {
            cliente_id: true,
            nombre: true,
            apellido: true,
            celular: true,
          },
        });
    
        if (!cliente) {
          return NextResponse.json({ message: "Cliente no encontrado" }, { status: 404 });
        }
        celularFormatted = cliente.celular.trim();
        if (!celularFormatted.startsWith("+51")) {
          celularFormatted = `+51${celularFormatted}`;
        }
        registro=cliente; 
        esTelefono = false;
      }else if (/^\+51\d+$/.test(id)) {
        celularFormatted=id;
        if (!celularFormatted.startsWith("+51")) {
          celularFormatted = `+51${celularFormatted}`;
        }
        const nuevo = await prisma.campanha_temporal.findFirst({
          where: { celular: id },
          select: {
            nombre: true,
            celular: true,
          },
        });
        registro=nuevo;
        esTelefono = true;
      // 3️⃣ Cualquier otro formato, devolvemos error
      } else {
        return NextResponse.json(
          { message: "Formato de ID inválido" },
          { status: 400 }
        );
      }
      
  
      /* // Consultar Firestore: Obtener mensajes del cliente con id_bot = codigopago
      const mensajesRef = db.collection("test")
        .where("celular", "==", cliente.celular)
        .where("id_bot", "==", "codigopago");
        //.orderBy("fecha", "asc");

      console.log("celu:", cliente.celular);

      const mensajesSnap = await mensajesRef.get();

      console.log("Cantidad de documentos encontrados:", mensajesSnap.size); 
      
      
      const mensajes = mensajesSnap.docs.map(doc => {
        console.log("ID del documento:", doc.id); // Ver los IDs en la consola
        //console.log("Datos del mensaje:", doc.data);
        return {
          id: doc.id,
          ...doc.data(),
        };
      });

      console.log("Todos los mensajes obtenidos:", mensajes);
      const mensajesFormateados = mensajes.map((msg) => ({
        ...msg,
        fecha: msg.fecha?._seconds 
          ? new Date(msg.fecha._seconds * 1000).toLocaleString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Fecha no disponible"
      })); */
      
      // Consultar Firestore: Obtener mensajes del cliente con id_bot = codigopago
    let celularSinMas = celularFormatted.startsWith("+") ? celularFormatted.slice(1) : celularFormatted;
let celularesParaBuscar = [celularFormatted, celularSinMas];
  const mensajesRef = db.collection("fidelizacion")
  .where("celular", "in", celularesParaBuscar)
  .where("id_bot", "in", ["fidelizacionbot", "fidelizacion"]); 
  


  console.log("📞 Buscando mensajes para celular:", celularFormatted);

  const mensajesSnap = await mensajesRef.get();
  console.log("📊 Cantidad de documentos encontrados:", mensajesSnap.size);

  // Extraer datos y asegurar que `fecha` es un objeto Date
  const mensajes = mensajesSnap.docs.map(doc => ({
  id: doc.id,
  ...doc.data(),
  fecha: doc.data().fecha?._seconds 
    ? new Date(doc.data().fecha._seconds * 1000) 
    : null, // Si no tiene fecha, dejar null para filtrar después
  }));

  // Filtrar mensajes sin fecha y ordenar ascendentemente
  // const mensajesOrdenados = mensajes
  // .filter(msg => msg.fecha !== null) // Eliminar mensajes sin fecha
  // .sort((a, b) => a.fecha - b.fecha);

  //console.log("✅ Mensajes ordenados:", mensajesOrdenados);

  // Mapear a formato final
    const mensajesFormateados = mensajes
      .sort((a, b) => (a.fecha > b.fecha ? 1 : -1)) // Ordenar los mensajes aquí
      .map(msg => ({
        ...msg,
        sender: msg.sender === true || msg.sender === "true", // Normaliza a booleano
        fecha: msg.fecha
          ? msg.fecha.toLocaleString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Fecha no disponible",
      }));
      
      console.log(mensajesFormateados); // Verifica el cambio
      const clientePayload = esTelefono
      ? {
          // en el caso del “nuevo” sólo tenemos nombre y celular
          cliente_id:     null,
          nombreCompleto: registro.nombre,
          celular:        registro.celular,
        }
      : {
          // cliente normal
          cliente_id:     registro.cliente_id,
          nombreCompleto: `${registro.nombre} ${registro.apellido}`,
          celular:        registro.celular,
        };

    return NextResponse.json({
      cliente:        clientePayload,
      conversaciones: mensajesFormateados,
    });
      
      // return NextResponse.json({
      //   cliente: {
      //     cliente_id: cliente.id,
      //     nombreCompleto: `${cliente.nombre} ${cliente.apellido}`,
      //     celular: cliente.celular,
      //   },
      //   conversaciones: mensajesFormateados,
      // });
    } catch (error) {
      console.error("Error al obtener conversaciones del cliente:", error);
      return NextResponse.json(
        { message: "Error interno del servidor al obtener las conversaciones" },
        { status: 500 }
      );
    }
  }




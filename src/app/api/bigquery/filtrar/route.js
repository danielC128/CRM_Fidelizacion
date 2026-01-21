import bq from '@/lib/bigquery';
import getBigQueryCache from '@/lib/bigqueryCache';

// ✅ Inicializar caché con configuración personalizada
const cache = getBigQueryCache({
  ttl: 3600000,  // 1 hora
  maxSize: 100   // Máximo 100 consultas cacheadas
});

/* ── 1. Normaliza el tipo al formato oficial de BigQuery ── */
const normalizeType = (t = 'STRING') => ({
  STRING: 'STRING', BYTES: 'BYTES',
  BOOL: 'BOOL', BOOLEAN: 'BOOL',
  INT64: 'INT64', INTEGER: 'INT64',
  FLOAT64: 'FLOAT64', FLOAT: 'FLOAT64', DOUBLE: 'FLOAT64',
  NUMERIC: 'NUMERIC', BIGNUMERIC: 'BIGNUMERIC',
  DATE: 'DATE', TIME: 'TIME', DATETIME: 'DATETIME', TIMESTAMP: 'TIMESTAMP',
}[t.toUpperCase()] || 'STRING');

/* ── 2. Cache de esquema por tabla ───────────────────────── */
const schemaCache = new Map();         // { 'proyecto.dataset.tabla' → { col:type,… } }

async function getSchema(project, dataset, table) {
  const key = `${project}.${dataset}.${table}`;
  if (schemaCache.has(key)) return schemaCache.get(key);

  const sql = `
    SELECT column_name, data_type
    FROM   \`${project}.${dataset}.INFORMATION_SCHEMA.COLUMNS\`
    WHERE  table_name = @tbl
  `;
  const [rows] = await bq.query({
    query: sql,
    params: { tbl: table },
    parameterMode: 'named',
  });

  const dict = {};
  rows.forEach(r => { dict[r.column_name] = normalizeType(r.data_type); });
  schemaCache.set(key, dict);
  return dict;
}

/* ── 3. POST /api/filtrar ────────────────────────────────── */
export async function POST(req) {
  try {
    const { table, filters, tipoCampana, modoEnvio } = await req.json();
    if (!table || !Array.isArray(filters))
      return new Response('Payload inválido', { status: 400 });

    // ✅ Generar clave de caché
    const cacheKey = cache.generateKey(table, filters, tipoCampana, modoEnvio);

    // ✅ Intentar obtener del caché primero
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      console.log('✅ [CACHE] Retornando resultado cacheado');
      return Response.json({ rows: cachedResult, fromCache: true });
    }

    /* Ajusta aquí si cambian proyecto/dataset */
    const project = 'peak-emitter-350713';
    const dataset = 'FR_RetFid_output';

    const schema = await getSchema(project, dataset, table);

    /* 3.1 WHERE y params primitivos */
    const params = {};          // { val0: 'ALTA', val1: 'convencional', val2: 0.72 }
    const whereParts = [];

    filters.forEach((f, idx) => {
      const p = `val${idx}`;
      const colName = f.column;
      const colType = schema[colName] || 'STRING';

      // Si el valor es null o vacío, se pone `TRUE` en el WHERE (no afecta el filtro)
      let val = f.value;
      if (val == null || val === '' || val === 'Todos') {
        whereParts.push(`1=1`);  // Siempre verdadero, se omite este filtro
        return; // No agregamos más lógica para este filtro
      }

      if (
    (colName === 'feccuota' || colName === 'Fec_Venc_Cuota') &&
    tipoCampana === "Fidelizacion"
  ) {
    // Ejemplo de val: "viernes, 19 de septiembre"
    // Extrae día y mes en español
    const partes = val.split(',')[1].trim().split(' de ');
    const dia = Number(partes[0]); // "19"
    const mesTexto = partes[1].toLowerCase(); // "septiembre"

    // Mapeo de meses en español a número
    const meses = {
      enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
      julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
    };
    const mes = meses[mesTexto];

    params[`${p}_month`] = mes;
    params[`${p}_day`] = dia;
    whereParts.push(`EXTRACT(MONTH FROM DATE(\`${colName}\`)) = @${p}_month`);
    whereParts.push(`EXTRACT(DAY FROM DATE(\`${colName}\`)) = @${p}_day`);
    return;
  }

      // Si es fecha, castea y filtra solo por la parte de la fecha
      if (colName === 'DATETIME' || colType === 'DATE') {

        console.log('Es fecha:', colName, 'Valor:', val);
        // Extrae solo la fecha (YYYY-MM-DD)
        const fechaSolo = val.split('T')[0];
        params[p] = fechaSolo;
        whereParts.push(`DATE(\`${colName}\`) = @${p}`);
        return;
      }

      // convierte a número si la columna es numérica
      if (colType === 'INT64') val = Number.parseInt(val, 10);
      if (colType === 'FLOAT64') val = Number.parseFloat(val);
      console.log(`Columna: ${colName}, Tipo: ${colType}, Valor: ${val}`);
      params[p] = val;                          // se guarda como PRIMITIVO
      whereParts.push(`\`${colName}\` = @${p}`);
    });

    const whereSQL = whereParts.join(' AND ') || '1=1';
    console.log('WHERE SQL:', whereSQL);
    /* 3.2 columnas extra con alias legibles */
    const ALIAS = { segmentacion: 'segmento', cluster: 'cluster', estrategia: 'estrategia' };
    const selectExtra = filters
      .map(f => `\`${f.column}\` AS ${ALIAS[f.type] || f.column}`)
      .join(', ');
    let QUERY = "";
    console.log('La timpo de camnañasdma ese askjriaspjrfuosadfhoasdfñ:', tipoCampana);
    /* 3.3 consulta final con JOIN */
    if (tipoCampana === "Recordatorio") {
      // NEW: elegir envios_cobranzas_m0 o _m1
      const modo = (modoEnvio || "M1").toString().toUpperCase(); // fallback M1
      const enviosTable =
        modo === "M0"
          ? "peak-emitter-350713.FR_general.envios_cobranzas_m0"
          : "peak-emitter-350713.FR_general.envios_cobranzas_m1";
      QUERY = `
   WITH cte_M1 AS (
    SELECT 
      base.Codigo_Asociado,
      base.segmentacion,
      base.Cluster,
      base.gestion,
      fondos.Cta_Act_Pag,
      CAST(fondos.Telf_SMS AS STRING) AS Telf_wsp,
      fondos.E_mail,
      fondos.Linea
    FROM   \`${project}.${dataset}.${table}\` AS base
    LEFT JOIN peak-emitter-350713.FR_general.bd_fondos AS fondos
      ON base.Codigo_Asociado = fondos.Codigo_Asociado
  ),
  ranked AS (
    SELECT 
      M1.Codigo_Asociado,
      M1.segmentacion,
      M1.Linea,
      envios.Email AS email,
      M1.Cta_Act_Pag,
      envios.TelfSMS AS telefono,
      envios.Primer_Nombre AS nombre,
      envios.Cod_Banco AS codpago,
      envios.Fec_Venc_Cuota AS feccuota,
      envios.Modelo AS modelo,
      FORMAT('%.2f', envios.Monto) AS monto,
      ROW_NUMBER() OVER (PARTITION BY envios.TelfSMS ORDER BY envios.N_Doc) AS row_num  -- Asigna un número a cada fila por TelfSMS
    FROM cte_M1 AS M1
    INNER JOIN ${enviosTable} AS envios
      ON M1.Telf_wsp = CAST(envios.TelfSMS AS STRING)
    WHERE   
      ${whereSQL}
  )
  SELECT 
    Cta_Act_Pag,
    Codigo_Asociado,
    segmentacion,
    email,
    telefono,
    nombre,
    codpago,
    feccuota,
    modelo,
    monto,
    Linea
  FROM ranked
  WHERE row_num = 1;  -- Selecciona solo la primera fila de cada grupo de TelfSMS
`;
    } else {
      QUERY = `
        WITH ranked AS (
          SELECT 
            base.Codigo_Asociado,
            base.segmentacion,
            base.gestion,
            base.Cluster,
            fondos.Fec_Venc_Cuota AS feccuota,
            fondos.E_mail AS email,
            CAST(fondos.Telf_SMS AS STRING) AS telefono,
            fondos.Primer_Nombre AS nombre,
            fondos.Cta_Act_Pag,
            fondos.Cod_Bco AS codpago,
            fondos.Linea,
            fondos.Modelo AS modelo,
            (fondos.C_Adm + fondos.C_Cap) AS monto,
            ROW_NUMBER() OVER (PARTITION BY CAST(fondos.Telf_SMS AS STRING) ORDER BY base.Codigo_Asociado) AS row_num
          FROM \`${project}.${dataset}.${table}\` AS base
          LEFT JOIN peak-emitter-350713.FR_general.bd_fondos AS fondos 
            ON base.Codigo_Asociado = fondos.Codigo_Asociado
          WHERE ${whereSQL}
        )
        SELECT 
         Cta_Act_Pag,
    Codigo_Asociado,
    segmentacion,
    email,
    telefono,
    nombre,
    codpago,
    feccuota,
    modelo,
    monto,
    Linea
        FROM ranked
        WHERE row_num = 1;
      `;
    }

    console.log('Consulta SQL:', QUERY);

    /* 3.4 ejecutar */
    const [rows] = await bq.query({
      query: QUERY,
      params,
      parameterMode: 'named',
    });

    // ✅ Guardar resultado en caché
    cache.set(cacheKey, rows);
    console.log(`💾 [CACHE] Resultado guardado en caché (${rows.length} filas)`);

    return Response.json({ rows, fromCache: false });         // 200 OK
  } catch (err) {
    console.error('Error en /api/filtrar:', err);
    return new Response('Error ejecutando consulta', { status: 500 });
  }
}

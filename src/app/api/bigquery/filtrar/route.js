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
    const { table, filters, modoEnvio } = await req.json();
    if (!table || !Array.isArray(filters))
      return new Response('Payload inválido', { status: 400 });

    // ✅ Generar clave de caché
    const cacheKey = cache.generateKey(table, filters, modoEnvio);

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

    /* 3.2 Elegir tabla de envios según modo M0/M1 */
    const modo = (modoEnvio || "M0").toString().toUpperCase(); // fallback M0
    const enviosTable =
      modo === "M0"
        ? "peak-emitter-350713.FR_general.envios_cobranzas_m0"
        : "peak-emitter-350713.FR_general.envios_cobranzas_m1";

    /* 3.3 Consulta con JOIN a bd_fondos y envios_cobranzas (cruce por N_Doc) */
    const QUERY = `
      WITH datos_bd_fondos AS (
        SELECT Codigo_Asociado, N_Doc, Cta_Act_Pag, Linea
        FROM \`peak-emitter-350713.FR_general.bd_fondos\`
      ),
      datos_segmentacion AS (
        SELECT
          base.Codigo_Asociado,
          fondos.N_Doc,
          base.segmentacion,
          base.Cluster,
          base.gestion,
          fondos.Cta_Act_Pag,
          fondos.Linea
        FROM \`${project}.${dataset}.${table}\` AS base
        JOIN datos_bd_fondos AS fondos
          ON base.Codigo_Asociado = fondos.Codigo_Asociado
        WHERE ${whereSQL}
      ),
      datos_envios AS (
        SELECT
          N_Doc,
          TelfSMS AS telefono,
          Primer_Nombre AS nombre,
          Cod_Banco AS codpago,
          FORMAT('%.2f', Monto) AS monto,
          Fec_Venc_Cuota AS feccuota,
          Email AS email,
          Modelo AS modelo
        FROM \`${enviosTable}\`
      ),
      datos_final AS (
        SELECT
          seg.Codigo_Asociado,
          seg.segmentacion,
          seg.Linea,
          seg.Cta_Act_Pag,
          env.telefono,
          env.nombre,
          env.codpago,
          env.monto,
          env.feccuota,
          env.email,
          env.modelo,
          ROW_NUMBER() OVER (PARTITION BY env.N_Doc ORDER BY env.feccuota DESC) AS row_num_ndoc
        FROM datos_envios AS env
        JOIN datos_segmentacion AS seg
          ON env.N_Doc = seg.N_Doc
      ),
      dedup_telefono AS (
        SELECT
          *,
          ROW_NUMBER() OVER (PARTITION BY telefono ORDER BY feccuota DESC) AS row_num_telefono
        FROM datos_final
        WHERE row_num_ndoc = 1
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
      FROM dedup_telefono
      WHERE row_num_telefono = 1
    `;

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

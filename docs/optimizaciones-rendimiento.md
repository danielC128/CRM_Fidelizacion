# Optimizaciones de Rendimiento - CRM Fidelización

## Fecha: 2026-03-18

---

## 1. Batch Updates de Pago (PostgreSQL)

**Archivo:** `src/app/api/clientes/route.js`
**Pestaña:** Clientes, Gestión de Clientes

**Problema:** Al cargar la lista de clientes, se consultaba BigQuery para obtener el estado de pago y luego se hacía un `UPDATE` individual por cada cliente. Con 200 clientes = 200 queries secuenciales al servidor de base de datos.

**Solución:** Agrupar todos los updates en una sola transacción con `prisma.$transaction()`. PostgreSQL recibe todo de golpe, lo procesa internamente y responde una sola vez.

**Impacto:** ~5-10x más rápido en la carga de clientes.

---

## 2. Query BigQuery Unificado (Dashboard)

**Archivo:** `src/app/api/bigquery/dashboard/route.js`
**Pestaña:** Dashboard

**Problema:** El dashboard ejecutaba 2 queries separados a BigQuery (`KPI_QUERY` y `CHART_QUERY`) que escaneaban las mismas tablas con los mismos JOINs. BigQuery cobra por bytes escaneados, por lo que se pagaba doble.

**Solución:** Combinar ambos queries en uno solo usando CTEs (`WITH`). BigQuery escanea los datos una sola vez y devuelve ambos resultados diferenciados por un campo `_type`.

**Impacto:** ~50% menos tiempo de respuesta y costo BigQuery.

---

## 3. Include Ligero en Lista de Campañas

**Archivo:** `src/app/api/campaings/route.js`
**Pestaña:** Reminders (lista de campañas)

**Problema:** Al listar campañas, se hacía `include: { cliente_campanha: { include: { cliente: true } } }` que traía TODOS los clientes de cada campaña con toda su información. Con 10 campañas de 500 clientes cada una = 5,000 registros innecesarios.

**Solución:** Reemplazar el include completo por `_count: { select: { cliente_campanha: true } }` que solo devuelve el conteo. También se paralelizó el conteo total con `Promise.all`.

**Impacto:** ~3-5x más rápido en la lista de campañas.

---

## Limpieza adicional

- Eliminados métodos `PATCH` y `DELETE` muertos en `campaings/route.js` (usaban `req.query` que no funciona en App Router)

---

## Optimizaciones pendientes

| Prioridad | Descripción | Archivo |
|-----------|-------------|---------|
| Alta | PrismaClient duplicado (no reutiliza conexiones) | `clientes/export/route.js` |
| Alta | Archivos basura (_new, _fixed, routej.js) | Varios en `src/app/api/` |
| Alta | Índices faltantes en PostgreSQL | `prisma/schema.prisma` |
| Media | next.config.mjs vacío (sin compresión ni optimización) | `next.config.mjs` |
| Media | Charts sin lazy loading (Recharts en bundle principal) | Componentes dashboard |
| Media | Export sin paginación (trae todos los clientes a memoria) | `clientes/export/route.js` |
| Baja | Console.logs en producción | Varios archivos |

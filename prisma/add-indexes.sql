-- ========================================
-- Script de optimización de índices
-- Para mejorar el rendimiento de campañas
-- ========================================

-- 🔹 Índice para búsqueda de clientes por celular
-- Usado en: cargar-clientes/route.js, múltiples lugares
CREATE INDEX IF NOT EXISTS idx_cliente_celular
ON cliente(celular);

-- 🔹 Índice para relaciones cliente-campaña
-- Usado en: cargar-clientes/route.js (verificación de duplicados)
CREATE INDEX IF NOT EXISTS idx_cliente_campanha_lookup
ON cliente_campanha(cliente_id, campanha_id);

-- 🔹 Índice para búsqueda por estado de mensaje
-- Usado en: send/route.js (filtrar mensajes no enviados)
CREATE INDEX IF NOT EXISTS idx_cliente_campanha_estado
ON cliente_campanha(estado_mensaje);

-- 🔹 Índice para búsqueda por campaña y estado
-- Usado en: consultas de estadísticas y reportes
CREATE INDEX IF NOT EXISTS idx_cliente_campanha_campanha_estado
ON cliente_campanha(campanha_id, estado_mensaje);

-- 🔹 Índice para búsqueda de campañas por fecha
-- Usado en: listado de campañas ordenado por fecha
CREATE INDEX IF NOT EXISTS idx_campanha_fecha
ON campanha(fecha_creacion DESC);

-- 🔹 Índice para búsqueda de campañas por estado
-- Usado en: filtros de campañas activas/enviadas
CREATE INDEX IF NOT EXISTS idx_campanha_estado
ON campanha(estado_campanha);

-- 🔹 Índice para búsqueda de clientes por gestor
-- Usado en: filtros por asesor/gestor
CREATE INDEX IF NOT EXISTS idx_cliente_gestor
ON cliente(gestor);

-- 🔹 Índice para búsqueda de citas por cliente
-- Usado en: promesas-incumplidas/route.js
CREATE INDEX IF NOT EXISTS idx_cita_cliente
ON cita(cliente_id);

-- 🔹 Índice para búsqueda de citas por fecha
-- Usado en: promesas-incumplidas/route.js
CREATE INDEX IF NOT EXISTS idx_cita_fecha
ON cita(fecha_cita);

-- ========================================
-- Verificar índices creados
-- ========================================
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ========================================
-- Estadísticas de uso de índices
-- (Ejecutar después de usar la aplicación)
-- ========================================
-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     idx_scan as index_scans,
--     idx_tup_read as tuples_read,
--     idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

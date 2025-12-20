# Índices de Base de Datos para Optimización

Este directorio contiene scripts para optimizar el rendimiento de la base de datos mediante la creación de índices estratégicos.

## 📋 Archivo: `add-indexes.sql`

Script SQL que crea índices para optimizar las consultas más frecuentes en el sistema de campañas.

### Índices incluidos:

1. **idx_cliente_celular** - Búsqueda rápida de clientes por número de celular
2. **idx_cliente_campanha_lookup** - Verificación de relaciones cliente-campaña
3. **idx_cliente_campanha_estado** - Filtrado por estado de mensaje
4. **idx_cliente_campanha_campanha_estado** - Búsqueda combinada campaña+estado
5. **idx_campanha_fecha** - Ordenamiento de campañas por fecha
6. **idx_campanha_estado** - Filtrado de campañas por estado
7. **idx_cliente_gestor** - Búsqueda de clientes por gestor/asesor
8. **idx_cita_cliente** - Búsqueda de citas por cliente
9. **idx_cita_fecha** - Búsqueda de citas por fecha

## 🚀 Cómo ejecutar

### Opción 1: Usando psql (línea de comandos)

```bash
# Desde la carpeta del proyecto
psql "postgres://usuario:password@host:puerto/database" -f prisma/add-indexes.sql
```

### Opción 2: Usando la URL de conexión del .env

```bash
# Extraer la URL del .env
psql "$DATABASE_URL_MYSQL" -f prisma/add-indexes.sql
```

### Opción 3: Usando un cliente GUI (pgAdmin, DBeaver, etc.)

1. Abre tu cliente de PostgreSQL
2. Conecta a la base de datos
3. Abre el archivo `add-indexes.sql`
4. Ejecuta el script

### Opción 4: Usando Prisma

```bash
# Ejecutar directamente con Prisma
yarn prisma db execute --file prisma/add-indexes.sql --schema prisma/schema.prisma
```

## ✅ Verificar que los índices se crearon

Después de ejecutar el script, puedes verificar con esta query:

```sql
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

## 📊 Impacto esperado

- **Carga de clientes**: ~10x más rápido
- **Envío de campañas**: ~30% más rápido
- **Consultas de campañas**: ~5x más rápido
- **Promesas incumplidas**: ~3x más rápido

## ⚠️ Notas importantes

1. Los índices se crean con `IF NOT EXISTS`, por lo que es seguro ejecutar el script múltiples veces
2. La creación de índices puede tomar algunos minutos en tablas grandes
3. Los índices ocupan espacio adicional en disco (generalmente 10-20% del tamaño de la tabla)
4. PostgreSQL actualiza automáticamente los índices cuando se insertan/actualizan datos

## 🔍 Monitoreo

Para ver estadísticas de uso de índices después de usar la aplicación:

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

Esto te mostrará qué índices se están usando más frecuentemente.

# Cambios en Creación de Campañas - Marzo 2026

## Resumen

Se simplificó el flujo de creación de campañas eliminando la distinción entre "Fidelización" y "Recordatorio". Ahora todas las campañas usan la misma lógica de consulta a BigQuery con cruce por `N_Doc` (DNI).

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/app/reminders/new/page.js` | Eliminado selector "Tipo Campaña" |
| `src/app/api/bigquery/filtrar/route.js` | Query unificada con cruce por N_Doc |

---

## Cambios en el Frontend (`page.js`)

### Eliminado
- Estado `tipoCampaña`
- Selector de "Tipo Campaña" (Fidelización/Recordatorio)
- Procesamiento especial de fechas para Fidelización
- `tipoCampana` del payload enviado al backend

### Payload actual
```javascript
const payload = {
  table: selectedDatabase,  // nombre de la tabla en BigQuery
  filters,                  // array de filtros (segmento, cluster, estrategia, etc.)
  modoEnvio                 // "M0" o "M1"
};
```

---

## Cambios en el Backend (`filtrar/route.js`)

### Antes (dos queries diferentes)

```javascript
if (tipoCampana === "Recordatorio") {
  // Query con envios_cobranzas, cruce por teléfono
} else {
  // Query solo con bd_fondos
}
```

### Ahora (query única con cruce por N_Doc)

```sql
WITH datos_bd_fondos AS (
  SELECT Codigo_Asociado, N_Doc, Cta_Act_Pag, Linea
  FROM bd_fondos
),
datos_segmentacion AS (
  SELECT base.*, fondos.N_Doc
  FROM {tabla_seleccionada} AS base
  JOIN datos_bd_fondos AS fondos
    ON base.Codigo_Asociado = fondos.Codigo_Asociado
  WHERE {filtros}
),
datos_envios AS (
  SELECT N_Doc, TelfSMS, nombre, monto, feccuota, ...
  FROM envios_cobranzas_m0  -- o _m1 según modoEnvio
),
datos_final AS (
  SELECT seg.*, env.*,
    ROW_NUMBER() OVER (PARTITION BY env.N_Doc ORDER BY env.feccuota DESC) AS row_num_ndoc
  FROM datos_envios AS env
  JOIN datos_segmentacion AS seg ON env.N_Doc = seg.N_Doc
),
dedup_telefono AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY telefono ORDER BY feccuota DESC) AS row_num_telefono
  FROM datos_final
  WHERE row_num_ndoc = 1
)
SELECT * FROM dedup_telefono WHERE row_num_telefono = 1
```

---

## Tablas Involucradas

| Tabla | Dataset | Uso |
|-------|---------|-----|
| `{tabla_seleccionada}` | `FR_RetFid_output` | Tabla base con segmentación |
| `bd_fondos` | `FR_general` | Puente para obtener N_Doc |
| `envios_cobranzas_m0` | `FR_general` | Datos de envío (modo M0) |
| `envios_cobranzas_m1` | `FR_general` | Datos de envío (modo M1) |

---

## Flujo de Cruce

```
tabla_seleccionada (Codigo_Asociado, segmentacion, gestion, ...)
        │
        ├─ JOIN bd_fondos (por Codigo_Asociado)
        │       └─ Obtiene: N_Doc
        │
        └─ JOIN envios_cobranzas_m0/m1 (por N_Doc)
                └─ Obtiene: telefono, nombre, monto, feccuota, email, modelo, codpago
```

---

## Por qué cruce por N_Doc en vez de teléfono

Se detectó que algunos clientes tienen **teléfonos diferentes** en `bd_fondos` vs `envios_cobranzas`:

| Cliente | bd_fondos | envios_cobranzas |
|---------|-----------|------------------|
| C20134202 | 993967371 | 930639232 |

Con cruce por teléfono: **557 clientes**
Con cruce por N_Doc: **558 clientes**

El cruce por N_Doc (DNI) es más preciso porque el DNI no cambia, mientras que el teléfono puede actualizarse en una tabla pero no en la otra.

---

## Deduplicación

Se aplica doble deduplicación:

1. **Por N_Doc**: Un cliente con múltiples registros en envios_cobranzas queda con 1 solo (el de fecha más reciente)
2. **Por teléfono**: Si un teléfono aparece en múltiples DNIs, queda con 1 solo

---

## Filtros Disponibles

| Filtro | Columna en BigQuery |
|--------|---------------------|
| Segmento | `segmentacion` |
| Cluster | `Cluster` |
| Estrategia | `gestion` |
| Fecha Cuota | `Fec_Venc_Cuota` |
| Línea | `Linea` |

Si un filtro tiene valor "Todos" o está vacío, se ignora (no filtra).

---

## Modo de Envíos (M0/M1)

| Modo | Tabla utilizada |
|------|-----------------|
| M0 | `envios_cobranzas_m0` |
| M1 | `envios_cobranzas_m1` |

El modo determina qué tabla de envíos se usa para el cruce. Por defecto es M0.

---

## Campos de Salida

| Campo | Origen |
|-------|--------|
| Codigo_Asociado | tabla_base |
| segmentacion | tabla_base |
| Linea | bd_fondos |
| Cta_Act_Pag | bd_fondos |
| telefono | envios_cobranzas |
| nombre | envios_cobranzas |
| email | envios_cobranzas |
| monto | envios_cobranzas |
| feccuota | envios_cobranzas |
| modelo | envios_cobranzas |
| codpago | envios_cobranzas |

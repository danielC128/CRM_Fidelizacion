# Resumen de Sesión - 18 de Marzo 2026

## Contexto del Proyecto
- **Proyecto**: CRM Fidelización (bot_fidelizacion)
- **Stack**: Next.js 16.1.0, Prisma, BigQuery, Firebase, MUI
- **Repositorio**: https://github.com/danielC128/CRM_Fidelizacion.git

---

## 1. Revisión de Creación de Campañas (sin Excel)

### Archivos principales:
- Frontend: `src/app/reminders/new/page.js`
- Backend: `src/app/api/bigquery/filtrar/route.js`

### Flujo original:
1. Usuario selecciona base de datos (tabla BigQuery)
2. Aplica filtros: Segmento, Cluster, Estrategia, Fecha Cuota, Línea
3. Seleccionaba "Tipo Campaña" (Fidelización/Recordatorio)
4. Seleccionaba "Modo de envíos" (M0/M1)

---

## 2. Análisis de Queries BigQuery

### Problema identificado:
Se comparó el código actual con el "código Orlando" (query de referencia) y se encontraron diferencias en los resultados (557 vs 558 clientes).

### Tablas involucradas:
- `FR_general.bd_fondos` - Datos de fondos/clientes
- `FR_general.Fidelizacion_Marzo_2026` (u otra tabla de segmentación)
- `FR_general.envios_cobranzas_m0` - Para modo M0
- `FR_general.envios_cobranzas_m1` - Para modo M1

### Diferencia clave encontrada:
| Aspecto | Código anterior | Código Orlando |
|---------|-----------------|----------------|
| Cruce con envios_cobranzas | Por teléfono (Telf_SMS) | Por N_Doc (DNI) |
| Resultado | 557 clientes | 558 clientes |

### Causa de la diferencia:
Un cliente (C20134202) tenía números diferentes en las tablas:
- bd_fondos: 993967371
- envios_cobranzas: 930639232

Al cruzar por teléfono, este cliente no matcheaba. Al cruzar por N_Doc (DNI), sí matchea correctamente.

---

## 3. Cambios Realizados

### 3.1 Unificación de Query con Cruce por N_Doc

**Archivo**: `src/app/api/bigquery/filtrar/route.js`

Nueva estructura de query:
```sql
WITH datos_bd_fondos AS (
  SELECT Codigo_Asociado, N_Doc, Cta_Act_Pag, Linea
  FROM `peak-emitter-350713.FR_general.bd_fondos`
),
datos_segmentacion AS (
  SELECT base.*, fondos.N_Doc
  FROM `{tabla}` AS base
  JOIN datos_bd_fondos AS fondos ON base.Codigo_Asociado = fondos.Codigo_Asociado
  WHERE {filtros}
),
datos_envios AS (
  SELECT N_Doc, TelfSMS AS telefono, nombre, codpago, monto, feccuota, email, modelo
  FROM `{enviosTable}`  -- m0 o m1 según modoEnvio
),
datos_final AS (
  SELECT seg.*, env.*,
    ROW_NUMBER() OVER (PARTITION BY env.N_Doc ORDER BY env.feccuota DESC) AS row_num_ndoc
  FROM datos_envios AS env
  JOIN datos_segmentacion AS seg ON env.N_Doc = seg.N_Doc
),
dedup_telefono AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY telefono ORDER BY feccuota DESC) AS row_num_telefono
  FROM datos_final WHERE row_num_ndoc = 1
)
SELECT * FROM dedup_telefono WHERE row_num_telefono = 1
```

### 3.2 Eliminación del Selector "Tipo Campaña"

**Archivo**: `src/app/reminders/new/page.js`

- Se eliminó el estado `tipoCampaña` y su selector
- Ya no hay distinción entre "Fidelización" y "Recordatorio"
- Siempre se usa envios_cobranzas (M0 o M1 según selección)

### 3.3 Modo de Envíos Movido a Segmentación

- El selector M0/M1 se movió de "Datos Básicos" a la sección "Segmentación"
- Cambiado de ButtonGroup a Select (menú desplegable) para consistencia visual

### 3.4 Actualización de Credenciales BigQuery

**Archivo**: `.env` (variable `BIG_QUERY_KEY`)

Las credenciales anteriores daban error `Invalid JWT Signature`. Se actualizaron con:
- `private_key_id`: `0de1ac094d2abff36122b14f4c66b9fc2db8457f`
- Nueva private_key proporcionada por el usuario

**Nota**: También existe `key/json.json` pero NO se usa. El código lee de `.env`.

### 3.5 Logo Actualizado a Imagen Local

**Problema**: El logo se cargaba de URL externa que dejó de funcionar:
```
https://maquimas.pe/wp-content/themes/maquisistema/img/common/maquiplus-logo.png
```

**Solución**:
- Logo copiado a `public/logo_maqui.png`
- Referencias actualizadas en:
  - `src/app/components/Layout.js` (header)
  - `src/app/layout.js` (favicon)
  - `src/app/login/page.js` (página login)

---

## 4. Documentación Creada

- `docs/cambios-creacion-campanas.md` - Documentación de los cambios en creación de campañas
- `docs/OPTIMIZACIONES.md` - Movido desde la raíz, con nota de que es anterior
- `docs/resumen-sesion-2026-03-18.md` - Este archivo

---

## 5. Commits Realizados

### bot_fidelizacion (CRM_Fidelizacion)
```
1a27dbe - Unificar query BigQuery con cruce por N_Doc y mejoras UI
```

---

## 6. Otros Proyectos Actualizados

### CRM_CodigoPago (antes codigoPagoGandy/codigoPago)
- Logo actualizado a `/logo_maqui.png`
- Credenciales BigQuery actualizadas en `.env`
- Commit: `c34fc82`
- Repo: https://github.com/danielC128/CRM_CODPAGO.git

### scaling-dollop (CRM_Reactivaciones)
- Logo actualizado a `/logo_maqui.png`
- Credenciales BigQuery ya estaban actualizadas
- Commit: `8c7032b`
- Repo: https://github.com/danielC128/CRM_Reactivaciones.git

---

## 7. Reorganización de Carpetas

### Estructura anterior en `C:\Saya Proyectos\Front\`:
```
├── bot_fidelizacion/
├── codigoPago/          (eliminada - versión antigua)
├── codigoPagoGandy/
│   ├── codigoPago/
│   └── codigoPago.zip
└── scaling-dollop/
```

### Estructura actual:
```
├── CRM_Fidelizacion/    (renombrado exitosamente desde bot_fidelizacion)
├── CRM_CodigoPago/      (movido desde codigoPagoGandy/codigoPago)
└── scaling-dollop/      (pendiente renombrar a CRM_Reactivaciones)
```

---

## 8. Completado

### Renombrado exitoso:
- `bot_fidelizacion` → `CRM_Fidelizacion` ✓ (conversaciones preservadas)

### Pendiente (opcional):
- `scaling-dollop` → `CRM_Reactivaciones`

### Después de renombrar:
1. Eliminar `node_modules` y `.next`
2. Ejecutar `yarn install`

### Nota sobre conversaciones de Claude Code:

**Ubicación REAL de las conversaciones (confirmado):**

Las conversaciones de Claude Code se guardan en:
```
C:\Users\<usuario>\.claude\projects\<ruta-proyecto-codificada>\
```

Por ejemplo:
```
C:\Users\danie\.claude\projects\C--Saya-Proyectos-Front-bot-fidelizacion\
```

Contiene archivos `.jsonl` con las conversaciones completas (mensajes del usuario y respuestas de Claude). Se actualizan en tiempo real.

**Otras ubicaciones (NO contienen conversaciones):**

| Ubicación | Contenido |
|-----------|-----------|
| `%LOCALAPPDATA%\claude-cli-nodejs\Cache\` | Solo logs de MCP (depuración) |
| `%APPDATA%\Code\User\workspaceStorage\` | Estado de VS Code, NO conversaciones de Claude |

**Para mantener conversaciones al renombrar proyecto:**

1. Copiar la carpeta de conversaciones:
   ```bash
   cp -r ~/.claude/projects/C--Saya-Proyectos-Front-bot-fidelizacion ~/.claude/projects/C--Saya-Proyectos-Front-CRM-Fidelizacion
   ```

2. Renombrar la carpeta del proyecto

3. Abrir VS Code en la nueva ubicación

**Fuentes:**
- [Claude Code's hidden conversation history](https://kentgigger.com/posts/claude-code-conversation-history)
- [Feature request: Project-Local Conversation History Storage](https://github.com/anthropics/claude-code/issues/9306)

---

## 9. Comandos Útiles

```bash
# Desarrollo
yarn dev

# Build de producción
yarn build && yarn start

# Solo generar Prisma (si no cambió schema)
yarn prisma generate
```

---

## 10. Credenciales BigQuery (Referencia)

```json
{
  "type": "service_account",
  "project_id": "peak-emitter-350713",
  "private_key_id": "0de1ac094d2abff36122b14f4c66b9fc2db8457f",
  "client_email": "data-ingest-general@peak-emitter-350713.iam.gserviceaccount.com",
  "client_id": "111736193359616766222"
}
```

La private_key completa está en el `.env` de cada proyecto.

---

**Fecha**: 18 de Marzo 2026
**Autor**: Claude Code (Opus 4.5)

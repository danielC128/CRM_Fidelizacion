# Estructura Meta WhatsApp Business API

## Jerarquía completa

```
Usuario de Meta (cuenta personal de Facebook)
│   Puede administrar varios portafolios
│
├── Portafolio de Negocios 1 (Meta Business Suite)
│   │   Tiene su propia facturación, usuarios y permisos
│   │   Puede tener múltiples apps, WABAs y otros activos
│   │
│   ├── WABA (cuenta WhatsApp Business - Business ID)
│   │   │   Pertenece al portafolio, NO a una app específica
│   │   │   Múltiples apps del mismo portafolio pueden acceder a ella
│   │   │   Puede tener múltiples números de teléfono
│   │   │
│   │   ├── Número de teléfono 1 (Phone ID)
│   │   ├── Número de teléfono 2 (Phone ID)
│   │   └── Plantillas de mensajes (compartidas entre números)
│   │
│   ├── App de Meta Developers 1
│   │   │   Genera tokens de acceso
│   │   │   Configura webhook para recibir mensajes
│   │   └── Accede a las WABAs del portafolio (si el token tiene permisos)
│   │
│   ├── App de Meta Developers 2
│   │   └── Puede acceder a las mismas WABAs del portafolio
│   │
│   └── Otros activos (páginas de Facebook, Instagram, etc.)
│
└── Portafolio de Negocios 2 (completamente independiente)
    ├── WABA (otro Business ID)
    ├── Apps
    └── Otros activos
```

## Resumen de relaciones

| Nivel | Puede tener |
|-------|-------------|
| **Usuario de Meta** | Múltiples portafolios |
| **Portafolio** | Múltiples apps, WABAs, páginas, cuentas IG, etc. |
| **WABA (Business ID)** | Múltiples números, múltiples plantillas, accesible por múltiples apps del portafolio |
| **App de Meta Developers** | Acceso a WABAs del portafolio, 1 webhook, múltiples tokens |
| **Número (Phone ID)** | 1 sola WABA (no puede estar en 2 WABAs distintas) |

## Reglas y restricciones

### Portafolios
- Un **usuario de Meta** puede administrar **múltiples portafolios**
- Cada portafolio es **independiente** (facturación, usuarios, permisos)
- Una **WABA no puede estar en 2 portafolios** distintos
- Una **app no puede estar en 2 portafolios** distintos

### WABAs
- La **WABA** pertenece al **portafolio**, no a una app
- Una WABA puede ser accedida por **múltiples apps** del mismo portafolio
- Las **plantillas** pertenecen a la **WABA**, no al número ni a la app
- Si eliminas una WABA, pierdes todos sus números y plantillas

### Números de teléfono
- Un **número** solo puede estar en **1 WABA** (no en 2 WABAs diferentes)
- Para mover un número a otra WABA, primero hay que **desvincularlo** de la actual
- Un número no puede estar registrado simultáneamente en WhatsApp personal y en la API
- Un portafolio sin verificar puede tener máximo **2 números**, verificado hasta **20**

### Apps
- Las apps **no se conectan directamente al número**, la cadena es: App → WABA (del mismo portafolio) → Número
- Múltiples apps del mismo portafolio pueden **enviar mensajes** con el mismo número, siempre que la WABA que contiene ese número esté en el mismo portafolio
- Si la WABA está en otro portafolio, las apps **no pueden acceder** ni al número ni a las plantillas
- El **webhook** solo puede estar activo en **1 app** a la vez por número
- Cada app genera sus propios **tokens** (temporales o permanentes)
- Un token solo da acceso a las WABAs del portafolio al que pertenece la app

### Tokens
- Un token **permanente** (SYSTEM_USER) no expira
- Un token **temporal** (USER) tiene fecha de expiración
- Un token solo funciona con las WABAs a las que tiene **permisos asignados**
- Si revocas un token, las apps/servicios que lo usan dejan de funcionar inmediatamente

## Múltiples apps accediendo a la misma WABA

### ¿Por qué Meta lo permite?

Meta diseñó esto pensando en **empresas grandes** con equipos diferentes:

- **Equipo de marketing** usa una app para enviar campañas con su propio dashboard
- **Equipo de soporte** usa otra app (o un proveedor como Zendesk) para atender clientes
- **Equipo de desarrollo** tiene otra app para testing

Cada equipo gestiona sus propios tokens y permisos sin depender de los otros. En empresas con 50+ personas manejando WhatsApp, esto tiene sentido.

**Para equipos pequeños** (1-5 personas), esto solo genera confusión. Una sola app es suficiente para todo.

### ¿Qué puede hacer cada app?

| Acción | ¿Conflicto con 2 apps? | Detalle |
|--------|------------------------|---------|
| Enviar mensajes | No | Cualquier app con token válido puede enviar |
| Ver plantillas | No | Ambas ven las mismas plantillas de la WABA |
| Crear plantillas | No | Ambas pueden crear |
| **Recibir mensajes (webhook)** | **Sí** | **Solo 1 app recibe los mensajes entrantes** |

### Ejemplo: Caso del webhook con 2 apps

Si la app "Fidelización" y "FideV2" acceden a la misma WABA con el mismo número:

```
Escenario: CRM envía campaña con FideV2, cliente responde

1. CRM (token de FideV2) → envía campaña al cliente ✓
2. Cliente recibe el mensaje y responde
3. La respuesta llega al webhook de "Fidelización" (si fue la última en configurar webhook)
4. El bot de "Fidelización" procesa y responde al cliente
5. FideV2 nunca se entera de que el cliente respondió

→ El envío salió por una app, la respuesta la procesó otra
→ El cliente no nota nada porque es el mismo número
```

### Ejemplo: Empresa grande con 3 equipos

```
WABA de la empresa (1 número: +51 999 999 999)
│
├── App "Marketing" (equipo de marketing)
│   └── Envía campañas masivas con su token
│
├── App "Soporte" (equipo de soporte - tiene el webhook activo)
│   └── Recibe mensajes de clientes → los atiende
│
└── App "Testing" (equipo de desarrollo)
    └── Pruebas en ambiente de desarrollo

Servidor intermedio recibe en el webhook y distribuye
mensajes al equipo correcto según reglas internas
```

### Recomendación para equipos pequeños

Usar **1 sola app** para todo (campañas + bot + gestión de plantillas). No hay ventaja en separar y sí desventajas:

- Más tokens que mantener
- Confusión sobre qué app hace qué
- Si expira un token, parte del sistema deja de funcionar
- No se puede rastrear fácilmente el flujo completo

---

## Variables de entorno

| Variable | Qué es | Para qué se usa |
|----------|--------|-----------------|
| `META_ACCESS_TOKEN` | Token permanente (tipo SYSTEM_USER) | Autenticación en todas las llamadas a Meta API |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID de la WABA (Business ID) | Gestionar plantillas (listar, crear, eliminar) |
| `META_PHONE_NUMBER_ID` | ID del número de teléfono | Enviar mensajes de WhatsApp |

## Endpoints de Meta API

- **Enviar mensajes:** `POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/messages`
- **Gestionar plantillas:** `GET/POST/DELETE https://graph.facebook.com/v21.0/{WABA_ID}/message_templates`

## Cómo verificar un token

```
GET https://graph.facebook.com/v21.0/debug_token?input_token={TOKEN}&access_token={TOKEN}
```

Respuesta clave:
- `expires_at: 0` → Token permanente
- `type: SYSTEM_USER` → Token de usuario del sistema (recomendado)
- `type: USER` → Token temporal (expira)

## Cómo verificar un número

```
GET https://graph.facebook.com/v21.0/{PHONE_ID}?access_token={TOKEN}
```

Devuelve nombre, número y estado de verificación.

---

## Estructura actual

```
Daniel Castillo (cuenta Meta)
│
├── Portafolio "Digital"
│   │
│   ├── WABA (782209750926525)
│   │   ├── +51 913 497 805 (Phone ID: 768639522993701) - "Maqui" (Fidelización)
│   │   └── Plantillas de fidelización
│   │
│   ├── App "Fidelizacion" (antes FideV2, token permanente)
│   │
│   ├── WABA (pendiente configurar)
│   │   ├── +51 941 010 026 (Phone ID: 710553965483257) - "Maqui" (Código de Pago)
│   │   └── Plantillas de código de pago
│   │
│   ├── App "CodigoPago"
│   │
│   ├── WABA (2351686888612985)
│   │   ├── +51 913 427 083 (Phone ID: 1030376103492561) - "MaquiCM" (Comercial)
│   │   └── Plantillas comerciales
│   │
│   └── App Comercial
│
└── Portafolio "Maqui+"
    │
    ├── App Reactivaciones
    │   └── WABA (pendiente configurar)
    │
    └── App SOR
        └── WABA (pendiente configurar)
```

## Configuración por proyecto CRM

| Proyecto | App Meta | WABA (Business ID) | Phone ID | Número | Token |
|----------|----------|-------------------|----------|--------|-------|
| Fidelización | FideV2 | 782209750926525 | 768639522993701 | +51 913 497 805 | Permanente (SYSTEM_USER) |
| Código de Pago | (app propia) | (pendiente) | 710553965483257 | +51 941 010 026 | (pendiente verificar) |
| Reactivaciones | (app propia) | (pendiente) | (pendiente) | (pendiente) | (pendiente verificar) |

## Cómo funciona el webhook

El webhook es el endpoint que Meta llama cada vez que hay una novedad con tu número. **Todo llega al mismo endpoint**, Meta diferencia el tipo con la estructura del JSON:

### Qué recibe el webhook

1. **Mensajes de clientes** → cuando un cliente escribe al número de WhatsApp
2. **Actualizaciones de estado de mensajes** → cuando un mensaje enviado cambia a entregado, leído, fallido, etc.

### Flujo actual en Fidelización

```
Meta envía notificación
│
└── Webhook de FideV2 (bot en Cloud Run) recibe TODO:
    │
    ├── Si es mensaje de cliente → el bot procesa y responde
    │
    └── Si es actualización de estado → guarda en tabla mensaje_status_event (PostgreSQL)
                                         │
                                         └── El CRM lee esta tabla para mostrar
                                             estadísticas de campaña (sent, delivered, read, failed)
```

### Puntos clave

- El **CRM no recibe notificaciones de Meta directamente**, solo lee la base de datos
- El **microservicio/bot** es el que recibe y procesa todo vía webhook
- La tabla `mensaje_status_event` en PostgreSQL es el puente entre el bot y el CRM
- La app **UPDATESTATUS** era un intento anterior de recibir estados directamente en el CRM, pero no funciona porque FideV2 tiene el webhook activo (se puede eliminar)

### Por qué solo 1 webhook puede estar activo

Si 2 apps configuran webhook para el mismo número, solo la **última en configurar/verificar** recibe las notificaciones. La otra queda configurada pero no le llega nada. Por eso es importante tener claro cuál app tiene el webhook activo.

---

## Notas

- Cada proyecto tiene su propia app, WABA, token y número independientes
- El envío de campañas usa `PHONE_NUMBER_ID` + `ACCESS_TOKEN` (no necesita Business ID)
- La gestión de plantillas desde el CRM usa `BUSINESS_ID` + `ACCESS_TOKEN`
- La app antigua "Fidelización" puede eliminarse si todo funciona con FideV2

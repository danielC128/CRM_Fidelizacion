# Comandos Yarn - Guía Rápida

## yarn install

Descarga todas las dependencias listadas en `package.json` a la carpeta `node_modules`.

**Cuándo usarlo:**
- Al clonar el proyecto por primera vez
- Cuando alguien agrega/elimina dependencias (cambios en `package.json`)

---

## yarn dev

Servidor de desarrollo.

**Características:**
- Recarga automática cuando cambias código
- Errores detallados en pantalla
- Más lento, no optimizado
- Para trabajar localmente

**Uso:**
```bash
yarn dev
```

---

## yarn build

Compila el proyecto para producción. Genera la carpeta `.next` con:
- Código optimizado y minificado
- Páginas pre-renderizadas

**Cuándo usarlo:**
- Antes de deployar
- Para verificar que el código compila sin errores

**Uso:**
```bash
yarn build
```

---

## yarn start

Inicia el servidor con el build de producción.

**Requisito:** Ejecutar `yarn build` primero.

**Características:**
- Rápido y optimizado
- Sin recarga automática
- Para producción o probar el build final

**Uso:**
```bash
yarn build && yarn start
```

---

## Resumen

| Comando | Cuándo usar |
|---------|-------------|
| `yarn install` | Después de clonar o cambios en dependencias |
| `yarn dev` | Desarrollo diario |
| `yarn build` | Antes de deployar |
| `yarn start` | Probar build o producción |

---

## Relación con Vercel

En Vercel, automáticamente se ejecuta:
1. `yarn install` (instala dependencias)
2. `yarn build` (compila el proyecto)
3. `yarn start` (inicia el servidor)

**Si funciona localmente, funciona en Vercel:**

Si `yarn build` + `yarn start` funcionan localmente con las mismas variables de entorno que tienes en Vercel, el deploy debería funcionar sin problemas.

**Posibles diferencias:**
- Variables de entorno faltantes en Vercel
- Valores diferentes en las variables

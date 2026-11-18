# Registro Completo - Lanus Computación
## Estado del Proyecto, Optimizaciones, Errores y Plan de Acción

**Fecha de creación:** 18/11/2026  
**Última actualización:** 18/11/2026  
**Branch:** `main` (commit `ea8d4f7`)

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Problema Original: Cuota D1 Excedida](#2-problema-original-cuota-d1-excedida)
3. [Solución Implementada: Cache Edge Optimizado](#3-solución-implementada-cache-edge-optimizado)
4. [Análisis de Precios vs Mercado Libre](#4-análisis-de-precios-vs-mercado-libre)
5. [Diagnóstico Sincronización ML](#5-diagnóstico-sincronización-ml)
6. [Errores Registrados en ML Sync](#6-errores-registrados-en-ml-sync)
7. [Plan de Acción Consolidado](#7-plan-de-acción-consolidado)
8. [Archivos Clave](#8-archivos-clave)
9. [Comandos Útiles](#9-comandos-útiles)

---

## 1. Resumen Ejecutivo

| Métrica | Antes (05/11) | Después (Fix) | Mejora |
|---------|---------------|---------------|--------|
| **Rows D1/día** | 5,030,897 (97%) | ~300,000 (proyectado) | **-94%** |
| **Cache HIT rate** | ~0% (crawlers con query params) | ~95%+ (urls normalizadas) | **+95%** |
| **Sync ELIT** | Horario (`0 * * * *`) | Diario 20:00 UTC (`0 20 * * *`) | -23x ejecuciones |
| **ML Sync** | Activo (fallando) | Deshabilitado (crons vacíos) | Detenido |
| **Productos en ML** | 0 | 0 | Sin cambios |

**Estado actual:** Cache funcionando en producción, ML sync detenido por tokens vencidos.

---

## 2. Problema Original: Cuota D1 Excedida

### Notificación Cloudflare (05/11/2026 15:23)
> "Su cuenta ha utilizado el 96% del límite diario del nivel gratuito de D1 de 5,000,000 rows_read. Las solicitudes de D1 devolverán errores si se supera el límite antes de 2026-11-06 at 00:00:00 UTC."

### Causa Raíz Identificada
- **Cache keys incluían query strings** → cada URL única = cache miss = D1 read
- **Crawlers/bots** generaban miles de URLs con parámetros: `?page=2`, `?brand=ASUS`, `?utm_source=...`
- **4 rutas de catálogo** escaneaban tabla `products` completa (~8K filas c/u):
  - `/categoria/[slug]`
  - `/producto/[slug]`
  - `/busqueda/[slug]`
  - `/api/search`
- **sync-elit horario** recalculaba precios de ~2000 productos USD cada hora

### Consumo D1 por Base de Datos (05/11/2026)
| Database | Rows Read | % Total |
|----------|-----------|---------|
| lanus-catalog | 5,030,897 | 96% |
| gas-station-db | 223 | 0% |
| chill-menu | 104 | 0% |
| Otras 5 DBs | ~0 | 0% |
| **Total** | **~5.03M** | **100%** |

> Límite free tier: **5M rows_read/día** (compartido account-wide, 8 databases)

---

## 3. Solución Implementada: Cache Edge Optimizado

### Cambios en `frontend/src/middleware.ts` (commit `ea8d4f7`)

#### 1. Normalización de Cache Keys
```typescript
function cacheKeyFor(url: URL): Request {
  const isCatalogRoute = 
    url.pathname.startsWith('/categoria/') ||
    url.pathname.startsWith('/producto/') ||
    url.pathname.startsWith('/busqueda/');
  
  const normalizedUrl = new URL(url);
  if (isCatalogRoute) normalizedUrl.search = '';
  return new Request(normalizedUrl);
}

function staleKeyFor(url: URL): Request {
  const pathOnly = url.pathname;
  const isCatalogRoute = 
    pathOnly.startsWith('/categoria/') ||
    pathOnly.startsWith('/producto/') ||
    pathOnly.startsWith('/busqueda/');
  
  const normalizedUrl = new URL(url);
  if (isCatalogRoute) normalizedUrl.search = '';
  return new Request(new URL(`/__stale${normalizedUrl.pathname}`, normalizedUrl));
}
```

#### 2. Aplicación en Cache Match/Put
```typescript
// Antes: cache.match(context.request)
// Después:
const hit = await cache.match(cacheKeyFor(new URL(context.request.url)));

// Antes: cache.put(context.request, outgoing)
// Después:
await cache.put(cacheKeyFor(new URL(context.request.url)), outgoing.clone());
```

### TTLs Configurados
| Ruta | s-maxage (edge) | max-age (browser) |
|------|-----------------|-------------------|
| `/` (home) | 900s (15 min) | 60s |
| `/ofertas` | 900s (15 min) | 60s |
| `/categoria/*` | 3600s (1 hora) | 60s |
| `/producto/*` | 3600s (1 hora) | 60s |
| `/busqueda/*` | 600s (10 min) | 60s |
| `/api/search` | 300s (5 min) | 60s |

### Funciones Cachéadas en `frontend/src/lib/d1.ts`
| Función | TTL | Descripción |
|---------|-----|-------------|
| `getCachedCategoriesTree` | 1 hora | Árbol categorías (Header + MegaMenu) |
| `getCachedActiveB2bRules` | 1 hora | Reglas B2B (ProductGrid) |
| `getCachedActivePromotions` | 1 hora | Promociones activas (Producto) |
| `getCachedBestSellers` | 1 hora | Más vendidos (Home) |
| `cachedFacet` | 15 min | Facetas sidebar (marcas, precio) |

### sync-elit: Cron Cambiado
```json
// Antes: "crons": ["0 * * * *"]  (cada hora)
// Después: "crons": ["0 20 * * *"]  (diario 20:00 UTC = 17:00 AR)
```

### ML Sync Workers: Deshabilitados
```json
// ml-sync, ml-digest, ml-compare - todos:
"triggers": { "crons": [] }
```

---

## 4. Análisis de Precios vs Mercado Libre

### Carrito ELIT (Referencia de Costo)
| Producto | ELIT ID | Costo USD | Dólar ELIT | Precio Carrito ARS |
|----------|---------|-----------|------------|-------------------|
| MSI B550M-A PRO | `elit_17647` | $62.54 | $1,570 | $98,185.44 |
| ASUS PRIME B550M-A AC | `elit_19477` | $84.58 | $1,570 | $132,790.60 |
| MSI PRO B650M-B | `elit_17987` | $75.04 | $1,570 | $117,812.80 |
| ASUS PRIME B650M-A II | `elit_19478` | $108.39 | $1,570 | $170,172.30 |
| **Subtotal** | | | | **$518,961.14** |
| **IVA 10.5%** | | | | **$54,490.92** |
| **Total ELIT** | | | | **$573,452.07** |

> **Nota:** ELIT usa dólar **$1,570** fijo en carrito (vs ~$1,545 en BD = +1.6%)

### Márgenes Ajustados para Competitividad
| Producto | Margen | Precio Final CON IVA | vs Mejor ML |
|----------|--------|---------------------|-------------|
| MSI B550M-A PRO | **20%** | **$130,197** | -3.9% (más barato) ✅ |
| ASUS PRIME B550M-A AC | **18%** | **$173,146** | +3.7% vs Venex ⚠️ |
| MSI PRO B650M-B | **15%** | **$149,711** | +4.8% vs CompraGamer ⚠️ |
| ASUS PRIME B650M-A II | **10%** | **$206,844** | +20% vs Venex ❌ |

### Ganancias Proyectadas (4 productos)
| Concepto | Valor |
|----------|-------|
| Subtotal sin IVA | $597,192.52 |
| IVA 10.5% | $62,705.21 |
| **Total a pagar cliente** | **$659,897.73** |
| **Ganancia bruta (markup)** | **+$78,231.38** |
| **Ganancia neta (con IVA)** | **+$86,446.66** |

---

## 5. Diagnóstico Sincronización ML

### Workers ML (3 total)

| Worker | Propósito | Cron | Estado |
|--------|-----------|------|--------|
| `ml-sync` | Sincronizar productos D1 → ML API | `[]` (vacío) | ❌ Deshabilitado |
| `ml-digest` | Email diario eventos ML | `[]` (vacío) | ❌ Deshabilitado |
| `ml-compare` | Comparar precios via scraping DDG | `[]` (vacío) | ❌ Deshabilitado |

> **Todos deshabilitados** en commit `ea8d4f7` para ahorrar cuota D1.

### ml-compare (único funcional bajo demanda)
- **Método:** Scraping DuckDuckGo (`site:articulo.mercadolibre.com.ar`) + Cloudflare Browser Run
- **Última ejecución:** 03/11/2026 13:04 UTC (manual via `/refresh`)
- **Cobertura:** 31 productos snapshot, 8 con precio ML (26%)
- **Limitaciones:** Login wall ML, DDG anomaly challenge, límite 10 min/día Browser Run gratis

### sync-elit (Fuente de Productos) - ACTIVO
- **Cron:** `0 20 * * *` (diario 17:00 AR)
- **Función:** Trae ~2000+ productos ELIT, actualiza precios/stock/categorías
- **No toca:** Campos ML (`ml_item_id`, `ml_category_id`)

---

## 6. Errores Registrados en ML Sync

### Último Intento: 26/10/2026 02:29 UTC

| Métrica | Valor |
|---------|-------|
| Productos procesados | 1 (reintentado 17 veces) |
| Creados | 0 |
| Actualizados | 0 |
| Fallidos | 1 (100%) |
| Saltados | 0 |

### Error Raíz (17 ocurrencias)
```json
{
  "event_type": "meli_sync_product_error",
  "status": "error",
  "message": "Validación fallida: [{...\"error\":\"invalid_grant\",\"status\":400,\"cause\":[]}]",
  "entity_id": "new"
}
```
> "Error validating grant. Your authorization code or refresh token may be expired or it was already used"

### Tokens OAuth (Tabla `meli_tokens`)
| Campo | Valor | Estado |
|-------|-------|--------|
| `access_token` | `APP_USR-7108953444471804-102310-...` | **EXPIRADO** |
| `expires_at` | `2026-10-23T20:21:49.543Z` | Vencido 20 días |
| `refresh_token` | `TG-6adb6d7dcf6eba00019cb57e-462363177` | **INVÁLIDO** |
| `last_sync_at` | `null` | Nunca sincronizó |
| Usuario ML | `SEES424202` (ID: 462363177) | — |

### Productos en ML: CERO
```sql
SELECT COUNT(*) FROM products WHERE ml_item_id IS NOT NULL;
-- Resultado: 0
```

---

## 7. Plan de Acción Consolidado

### FASE 1: Limpieza (Inmediato) 🧹
- [ ] **Eliminar `workers/ml-compare/`** completo
  - Código, configs, dependencies, deployment, KV keys
- [ ] **Eliminar `workers/ml-digest/`** completo
  - Solo email de eventos, no esencial
- [ ] **Verificar namespace KV `FLYERS`** (id: `62cb8b101cf74606bfb6f86ba12c6ba9`)
  - Chequear si `flyers-updater` lo usa antes de borrar

### FASE 2: Reactivar Sincronización ML (Prioridad Alta) 🔄
- [ ] **Re-autenticar OAuth Mercado Libre**
  - Flujo: authorization_code → nuevos access_token + refresh_token
  - Guardar en tabla `meli_tokens` (D1)
  - Tiempo: ~15-30 min manual
- [ ] **Habilitar cron en `ml-sync`**
  - Editar `workers/ml-sync/wrangler.jsonc`: `"crons": ["0 2 * * *"]` (23:00 AR)
  - Verificar secrets: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`
  - Deploy
- [ ] **Test manual sync**
  - 1-2 productos → verificar `ml_item_id` guardado
  - Monitorear `meli_events`

### FASE 3: Optimizaciones (Post-Reactivación) ⚡
- [ ] **Monitorear D1 analytics** post-reset (confirmar < 500K rows/día)
- [ ] **Sync incremental** en ml-sync (solo productos modificados)
- [ ] **Alertas** si `meli_sync_batch` tiene `failed > 0`
- [ ] **Revisar mapeo categorías** en `meli-sync-service.ts`
  - `SUBCATEGORY_MELI` / `CATEGORY_MELI`
  - Agregar `ml_category_id` override donde falle

### FASE 4: Limpieza Adicional (Opcional) 🗑️
- [ ] Revisar `flyers-updater` - ¿usa KV `FLYERS`? ¿Se puede consolidar?
- [ ] Revisar `digest-trigger` - ¿para qué sirve?

---

## 8. Archivos Clave

### Cache & Middleware
| Archivo | Descripción |
|---------|-------------|
| `frontend/src/middleware.ts` | Cache edge, normalización keys, TTLs |
| `frontend/src/lib/d1.ts` | Funciones cachéadas (`getCached*`, `cachedFacet`) |

### ML Sync
| Archivo | Descripción |
|---------|-------------|
| `workers/ml-sync/index.ts` | Worker sync programado (cron deshabilitado) |
| `workers/ml-sync/wrangler.jsonc` | Config: cron vacío, D1 binding |
| `frontend/src/lib/meli-sync-service.ts` | Lógica sync: categorías, idempotencia, logging |
| `frontend/src/lib/meli.ts` | Cliente HTTP ML: OAuth, refresh single-flight, retry 401 |
| `frontend/src/lib/meli-mapper.ts` | Mapeo Product → MeliItem payload |

### ELIT Sync (Activo)
| Archivo | Descripción |
|---------|-------------|
| `workers/sync-elit/src/index.ts` | Worker diario: fetch ELIT, upsert D1, recalcula precios |
| `workers/sync-elit/wrangler.jsonc` | Cron: `0 20 * * *`, D1 binding, AI binding |

### Comparador (A Eliminar)
| Archivo | Descripción |
|---------|-------------|
| `workers/ml-compare/src/index.ts` | 669 líneas: scraping DDG + Browser Run |
| `workers/ml-compare/wrangler.jsonc` | KV `FLYERS`, Browser binding, cron vacío |

### Documentación Generada
| Archivo | Descripción |
|---------|-------------|
| `PLAN.md` | Plan de trabajo consolidado |
| `RESUMEN_ERRORES_ML_SYNC.md` | Detalle errores ML sync |
| `REGISTRO_COMPLETO.md` | Este documento |

---

## 9. Comandos Útiles

### Ver D1 Analytics
```bash
# Requiere token OAuth cf CLI
$cfg = Get-Content "$env:APPDATA\xdg.config\cloudflare\config\default.json" -Raw | ConvertFrom-Json
$h = @{ Authorization = "Bearer $($cfg.oauth_token)" }
$q = 'query($accountTag: string!, $start: Date!, $end: Date!) { viewer { accounts(filter: { accountTag: $accountTag }) { d1AnalyticsAdaptiveGroups(limit: 50, filter: { date_geq: $start, date_leq: $end }, orderBy: [date_DESC]) { sum { rowsRead rowsWritten } dimensions { date databaseId } } } } }'
$vars = @{ accountTag = "793d012a405417ee4382f1ef1869753e"; start = "2026-11-05"; end = "2026-11-05" }
$body = @{ query = $q; variables = $vars } | ConvertTo-Json -Depth 6 -Compress
$r = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/graphql" -Method Post -Headers $h -ContentType "application/json" -Body $body
```

### Ver Tokens ML
```bash
cf d1 query c0a53831-2932-4dc5-94d9-b37be72e8219 --sql "SELECT * FROM meli_tokens"
```

### Ver Eventos ML
```bash
cf d1 query c0a53831-2932-4dc5-94d9-b37be72e8219 --sql "SELECT event_type, entity, entity_id, status, message, created_at FROM meli_events ORDER BY created_at DESC LIMIT 20"
```

### Ver Productos con ml_item_id
```bash
cf d1 query c0a53831-2932-4dc5-94d9-b37be72e8219 --sql "SELECT id, title, ml_item_id, ml_category_id, status FROM products WHERE ml_item_id IS NOT NULL LIMIT 20"
```

### Ver KV ml-compare
```bash
cf kv keys get "ml-compare:latest" --namespace-id 62cb8b101cf74606bfb6f86ba12c6ba9
cf kv keys get "ml-compare:status" --namespace-id 62cb8b101cf74606bfb6f86ba12c6ba9
```

### Deploy Workers
```bash
cd lanuscomputacion-repo/workers/ml-sync
cf deploy  # o wrangler deploy

cd lanuscomputacion-repo/frontend
npm run deploy
```

### Build & Test Local
```bash
cd lanuscomputacion-repo/frontend
npm run build
npm run preview
```

### Ver Cache HIT/MISS en Producción
```bash
# Headers a revisar: X-Cache (HIT/MISS/STALE), Age
curl -I https://lanuscomputacion.com/categoria/todas?page=2
curl -I https://lanuscomputacion.com/producto/xxx?utm_source=test
```

---

## Historial de Cambios Recientes

| Fecha | Commit | Descripción |
|-------|--------|-------------|
| 08/11/2026 | `ea8d4f7` | Fix cache keys ignoran query strings en rutas catálogo |
| 08/11/2026 | `ac91c1b` | Optimizaciones agresivas D1 quota |
| 08/11/2026 | - | Márgenes ajustados por producto para ML |
| 08/11/2026 | - | sync-elit cron: horario → diario 20:00 UTC |
| 08/11/2026 | - | ml-sync, ml-digest, ml-compare crons deshabilitados |
| 18/11/2026 | - | Documentación completa generada (este archivo) |

---

## Próximos Hitos

1. **Inmediato:** Borrar `ml-compare` y `ml-digest`
2. **Esta semana:** Re-autenticar OAuth ML + habilitar `ml-sync` cron
3. **Próximo reset UTC (medianoche):** Confirmar D1 < 500K rows/día
4. **Continuo:** Monitorear `meli_events` y competitividad precios

---

*Documento generado automáticamente como registro consolidado del estado del proyecto Lanus Computación.*
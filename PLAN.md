# Plan de Trabajo - Lanus Computación

## Objetivo Principal
Mantener la sincronización de productos con Mercado Libre operativa y competitiva, dentro de los límites del plan gratuito de Cloudflare (D1: 5M rows_read/día).

---

## Estado Actual (2026-11-12)

### ✅ Completado
- **Cache edge optimizado** (commit `ea8d4f7`): Cache keys ignoran query strings en `/categoria/*`, `/producto/*`, `/busqueda/*`
- **Consumo D1 reducido**: De ~5.5M a ~300K rows/día proyectado (94% reducción)
- **sync-elit cron**: Cambiado de horario a diario 20:00 UTC (17:00 AR)
- **ML sync workers deshabilitados**: ml-sync, ml-digest, ml-compare (crons vacíos)
- **Márgenes ajustados** por producto para competitividad vs ML:
  - MSI B550M-A PRO: 20%
  - ASUS PRIME B550M-A AC: 18%
  - MSI PRO B650M-B: 15%
  - ASUS PRIME B650M-A II: 10%

### 🔴 Crítico - Pendiente
- **Token ML vencido** (access + refresh token expirados 23/10/2026)
- **Cero productos publicados en ML** (`ml_item_id` nulo en todos)

---

## Plan de Acción

### Fase 1: Limpieza (Inmediato)
- [ ] **Eliminar worker `ml-compare` completo** (carpeta `workers/ml-compare/`)
  - Borrar código fuente (`src/index.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `wrangler.jsonc`)
  - Borrar namespace KV `FLYERS` si no se usa en otro lado (verificar `flyers-updater`)
  - Eliminar deployment en Cloudflare Pages/Workers
  - Limpiar keys KV `ml-compare:latest` y `ml-compare:status`

- [ ] **Eliminar worker `ml-digest`** (carpeta `workers/ml-digest/`)
  - Solo enviaba email de eventos, no esencial
  - Borrar código y deployment

### Fase 2: Reactivar Sincronización ML (Prioridad Alta)
- [ ] **Re-autenticar OAuth Mercado Libre**
  - Obtener nuevo `authorization_code` vía flujo OAuth
  - Generar nuevos `access_token` + `refresh_token`
  - Guardar en tabla `meli_tokens` (D1)

- [ ] **Habilitar `ml-sync` con cron diario**
  - Editar `workers/ml-sync/wrangler.jsonc`: `"crons": ["0 2 * * *"]` (23:00 AR)
  - Verificar secrets: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`
  - Deploy y test manual

- [ ] **Verificar mapeo de categorías ML**
  - Revisar `frontend/src/lib/meli-sync-service.ts`: `SUBCATEGORY_MELI` y `CATEGORY_MELI`
  - Agregar `ml_category_id` override en productos problemáticos

### Fase 3: Optimizaciones Adicionales
- [ ] **Monitorear D1 analytics** post-reset (confirmar < 500K rows/día)
- [ ] **Implementar sync incremental** en ml-sync (solo productos modificados)
- [ ] **Agregar alertas** si `meli_sync_batch` tiene `failed > 0`
- [ ] **Revisar `flyers-updater`** - ver si usa KV `FLYERS` y si se puede consolidar

---

## Archivos Relacionados a Eliminar (ml-compare)

```
workers/ml-compare/
├── src/index.ts           # 669 líneas - scraping DDG + Browser Run
├── package.json
├── package-lock.json
├── tsconfig.json
├── wrangler.jsonc         # nombre: "lanus-ml-compare", KV binding FLYERS, Browser binding
└── node_modules/          # (ignorado por git)
```

## Keys KV a Limpiar
- `ml-compare:latest` (informe JSON completo)
- `ml-compare:status` (estado de ejecución)

## Namespace KV: `FLYERS` (id: `62cb8b101cf74606bfb6f86ba12c6ba9`)
- Verificar si `flyers-updater` lo usa antes de borrar

---

## Próximos Pasos Inmediatos
1. Borrar `workers/ml-compare/` completo
2. Borrar `workers/ml-digest/`
3. Verificar uso de KV `FLYERS` en `flyers-updater`
4. Re-autenticar OAuth ML
5. Habilitar cron en `ml-sync`
# Resumen Ejecutivo: Errores en Sincronización Automática con Mercado Libre

**Fecha:** 12/11/2026  
**Estado:** Sincronización **DETENIDA** (crons deshabilitados, tokens vencidos)  
**Impacto:** Cero productos publicados en ML (`ml_item_id` = NULL en 100% del catálogo)

---

## 1. Errores Registrados (Tabla `meli_events`)

### Último intento masivo: **26/10/2026 02:29 UTC**

| Métrica | Valor |
|---------|-------|
| Productos procesados | 1 (reintentado 17 veces) |
| Creados | 0 |
| Actualizados | 0 |
| Fallidos | 1 (100%) |
| Saltados | 0 |

### Error Raíz (repetido 17 veces)

```
event_type: meli_sync_product_error
status: error
message: "Validación fallida: [{""message"":""Error validating grant. Your authorization code or refresh token may be expired or it was already used"",""error"":""invalid_grant"",""status"":400,""cause"":[]}]"
entity_id: "new"
created_at: 2026-10-26 02:29:29-30
```

### Error de Lote (repetido 10 veces)

```
event_type: meli_sync_batch_completed
status: partial
message: "Procesados: 1, Creados: 0, Actualizados: 0, Fallidos: 1"
```

---

## 2. Causa Raíz: Token OAuth Vencido

| Campo | Valor | Estado |
|-------|-------|--------|
| `access_token` | `APP_USR-7108953444471804-102310-...` | **EXPIRADO** |
| `expires_at` | **2026-10-23T20:21:49.543Z** | Vencido hace 20 días |
| `refresh_token` | `TG-6adb6d7dcf6eba00019cb57e-462363177` | **INVÁLIDO** (ya usado/expirado) |
| `last_sync_at` | `null` | Nunca sincronizó exitosamente |
| Usuario ML | `SEES424202` (ID: 462363177) | — |

**Diagnóstico:** El `refresh_token` fue consumido/invalidado en un intento previo y el `access_token` expiró. El flujo de *single-flight refresh* en `MeliClient` no puede recuperarse sin un `refresh_token` válido. **Requiere re-autenticación OAuth completa (nuevo authorization_code).**

---

## 3. Estado de Workers ML

| Worker | Cron | Estado | Última Ejecución |
|--------|------|--------|------------------|
| `ml-sync` | `[]` (vacío) | **DESHABILITADO** | Nunca (cron deshabilitado) |
| `ml-digest` | `[]` (vacío) | **DESHABILITADO** | 26/10/2026 (¿manual?) |
| `ml-compare` | `[]` (vacío) | **DESHABILITADO** | 03/11/2026 (scraping, no API) |

> **Nota:** Los 3 workers tienen cron deshabilitado desde commit `ea8d4f7` para ahorrar cuota D1.

---

## 4. Productos en ML: Cero Publicados

```sql
SELECT COUNT(*) FROM products WHERE ml_item_id IS NOT NULL;
-- Resultado: 0
```

- **0 productos** tienen `ml_item_id` guardado
- **0 productos** publicados/actualizados en ML exitosamente
- Todo el catálogo (~2000 productos) solo existe en D1 local

---

## 5. Código de Sincronización: Listo pero Sin Ejecutar

El flujo `MeliSyncService.syncAllProducts()` está **implementado y funcional**:
- Resuelve categoría MLA (`resolveMeliCategoryId()` con mapeos `SUBCATEGORY_MELI` / `CATEGORY_MELI`)
- Mapea payload (`mapProductToMeli()`: título, precio, stock, imágenes, descripción)
- Idempotente: POST si no tiene `ml_item_id`, PUT si ya existe
- Registra eventos en `meli_events` (creado/actualizado/error/saltado)
- Manejo de errores por producto (no corta el lote)
- Refresh automático de token ante 401 (single-flight)

**Bloqueador único:** Token OAuth válido + cron habilitado.

---

## 6. Plan de Recuperación (3 pasos)

| Paso | Acción | Tiempo Estimado |
|------|--------|-----------------|
| 1 | **Re-autenticar OAuth ML**: Generar nuevo `authorization_code` → obtener nuevos tokens → guardar en `meli_tokens` | 15-30 min (manual) |
| 2 | **Habilitar cron en `ml-sync`**: Editar `wrangler.jsonc` → `"crons": ["0 2 * * *"]` (23:00 AR) → deploy | 5 min |
| 3 | **Test manual**: Ejecutar sync de 1-2 productos → verificar `ml_item_id` guardado → monitorear `meli_events` | 10 min |

---

## 7. Riesgos Post-Reactivación

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Categorías ML inválidas → productos `skipped: missing_category` | Media | Revisar mapeos en `meli-sync-service.ts`; agregar `ml_category_id` override |
| Imágenes faltantes → error 173 `LTP_PICTURE_REQUIRED` | Baja | `meli-mapper` omite `pictures` si thumbnail inválido; ML puede rechazar |
| Rate limit ML API (429) | Baja | Sync secuencial (1 req/producto); ~2000 productos = ~30 min |
| Cuota D1 excedida | Baja | Ya mitigado: cache edge ignora query strings (commit `ea8d4f7`) |

---

## 8. Métricas de Éxito Post-Reactivación

- [ ] `meli_tokens.expires_at` > ahora + 5 horas
- [ ] `ml-sync` cron ejecuta diario sin errores
- [ ] `meli_events`: `status = 'created' | 'updated'` > 0
- [ ] `products.ml_item_id` NOT NULL > 0 (creciente diario)
- [ ] `ml-digest` email diario muestra actividad real
- [ ] `ml-compare` (si se mantiene) muestra precios competitivos vs ML

---

## Conclusión

**La sincronización no falla por bugs de código, sino por credenciales vencidas y crons deshabilitados.** El sistema está diseñado para ser robusto (idempotencia, logging, retry, single-flight refresh). Con tokens válidos y cron habilitado, la sincronización diaria debería funcionar automáticamente.

**Acción inmediata requerida:** Re-autenticar OAuth Mercado Libre.
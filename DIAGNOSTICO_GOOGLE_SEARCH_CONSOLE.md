# Diagnóstico Google Search Console - Lanus Computación

**Fecha:** 18/11/2026  
**Análisis de:** Fragmentos de productos (Product Snippets), Fichas de comerciantes (Merchant Listings) e Indexación de páginas  
**URLs:** [Product Snippets](https://search.google.com/search-console/r/product/drilldown?resource_id=sc-domain%3Alanuscomputacion.com) | [Merchant Listings](https://search.google.com/search-console/r/merchant-listings?resource_id=sc-domain%3Alanuscomputacion.com) | [Indexación](https://search.google.com/search-console/index)

---

## 🔴 Hallazgo Crítico #1: Solo 15 de 2,196 productos indexados

| Métrica | Valor |
|---------|-------|
| Productos en BD (total) | **2,196** (975 published + 1,221 archived) |
| Productos **visibles en web** (crawlables) | **2,196** (archivados SÍ son accesibles por URL y categorías) |
| URLs en sitemap.xml | **~2,196** (incluye published + archived) |
| Indexados por Google | **15** (0.7%) |
| **Brecha real** | **~2,181 productos no indexados (99.3%)** |

> **El problema principal NO es el structured data, sino que Google no ha rastreado/indexado el 99.3% del catálogo.**

---

## 🔴 Hallazgo Crítico #2: 1,690 páginas "Duplicada sin versión canónica"

**Estado GSC (12/11/26):** Error de validación desde 07/11/26  
**Páginas afectadas:** **1,690** (casi todo el catálogo)

### Ejemplos de duplicados detectados:

| Tipo | URLs Duplicadas |
|------|-----------------|
| **www vs non-www** | `https://www.lanuscomputacion.com/categoria/todas?brand=ASUS` ↔ `https://lanuscomputacion.com/categoria/todas?brand=ASUS` |
| **Parámetros URL** | `.../categoria/imagen?brand=CORSAIR?page=1` (doble `?`) |
| **Paginación** | `.../categoria/seguridad?page=88`, `?page=11`, `?page=14`, etc. |
| **Filtros + paginación** | `.../categoria/estuches?brand=KLIP XTREME?page=3` |
| **Producto** | `https://www.lanuscomputacion.com/producto/...` vs `https://lanuscomputacion.com/producto/...` |
| **Rutas extrañas** | `/categoria/celulares?brand=INTEL?page=3` (categoría "celulares" no existe en sitemap) |

---

## 📊 Incidencias Structured Data (en los 15 indexados)

### Errores Críticos (Impiden rich snippets completos)

| Incidencia | Elementos | Estado | Causa Raíz |
|------------|-----------|--------|------------|
| **Falta `aggregateRating`** | 15 | No iniciada | **No existe sistema de reseñas** (tabla `reviews`: 0 rows) |
| **Falta `review`** | 15 | No iniciada | **No existe sistema de reseñas** |
| **Falta `hasMerchantReturnPolicy`** (en `offers`) | 15 | No iniciada | No implementado en schema.org Product |
| **Falta `shippingDetails`** (en `offers`) | 15 | No iniciada | No implementado en schema.org Product |

### Advertencias (Mejoran presentación)

| Incidencia | Elementos | Estado | Causa Raíz |
|------------|-----------|--------|------------|
| **GTIN no válido** | 3 (reportados) / **~90 reales** | No iniciada | **~90 productos tienen `ean = "0"` o `null`** |
| **SKU no válido** | 1 | No iniciada | 1 producto con SKU problemático |

---

## 🔍 Análisis Detallado

### 1. Canonical URLs - **PROBLEMA MÁS GRAVE (1,690 páginas)**

**Causa:** Falta etiqueta `<link rel="canonical">` en todas las páginas.

**Patrones de duplicación:**
1. **www vs non-www** - Ambas accesibles sin redirect canónico
2. **Parámetros de filtro/paginación** - `?brand=X`, `?page=N`, `?brand=X?page=N` (malformado)
3. **Rutas legacy/extrañas** - `/categoria/celulares`, `/categoria/computadoras`, `/categoria/perif-ricos`, `/categoria/imagen`, `/categoria/insumos`, `/categoria/hardware`, `/categoria/unidad-de-energia`, `/categoria/estuches`, `/categoria/accesorios`, `/categoria/conectividad`, `/categoria/simuladores` - **no están en sitemap ni menú**

### 2. `aggregateRating` y `review` - **Bloqueador Principal**

**Estado actual:** Tabla `reviews` existe pero **0 filas**.

```sql
SELECT COUNT(*) FROM reviews; -- Resultado: 0
```

**Solución:** Implementar sistema de reseñas (UI + API + BD) o **omitir campos** hasta tener datos reales.

> ⚠️ **Google penaliza `aggregateRating` falso/vacío**. Mejor no incluirlo que poner datos inventados.

---

### 3. `hasMerchantReturnPolicy` y `shippingDetails` en `offers`

**Schema actual (producto/[slug].astro:49-68):**
```json
{
  "offers": {
    "@type": "Offer",
    "priceCurrency": "ARS",
    "price": 50876.61,
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "Lanús Computación" }
  }
}
```

**Faltante para Merchant Listings:**
```json
{
  "offers": {
    "@type": "Offer",
    "priceCurrency": "ARS",
    "price": 50876.61,
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "Lanús Computación", "url": "https://lanuscomputacion.com" },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "AR",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 30,
      "returnMethod": "https://schema.org/ReturnByMail",
      "returnFees": "https://schema.org/FreeReturn"
    },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": { "@type": "MonetaryAmount", "value": 0, "currency": "ARS" },
      "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "AR" },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": { "@type": "QuantitativeValue", "minValue": 1, "maxValue": 2, "unitCode": "DAY" },
        "transitTime": { "@type": "QuantitativeValue", "minValue": 1, "maxValue": 3, "unitCode": "DAY" },
        "cutOffTime": "14:00",
        "businessDays": { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "18:00" }
      }
    }
  }
}
```

---

### 4. GTIN no válido - **Problema de Datos Masivo (~90 productos)**

**Productos con EAN inválido (`"0"` o `null`): ~90 productos**

| Categoría | Cantidad | Ejemplos |
|-----------|----------|----------|
| `ean = "0"` | ~88 | Brother (tintas/tóneres), Cooler Master, Epson, ASUS, MSI, Gigabyte, etc. |
| `ean = null` | 2 | Productos de proveedor ML (`ml_MLA...`) |

**Regla Google:** GTIN debe ser **válido (13 dígitos, checksum correcto)** o **omitirse**. `"0"` y `null` son inválidos.

**Solución:** 
1. **No enviar `gtin13`** cuando EAN sea `"0"`, `null`, `""` o inválido
2. Validar checksum EAN-13 antes de incluir
3. Limpiar en origen (`sync-elit` normalizer)

---

## 🛠️ PLAN DE ARREGLO - PRIORIZADO

### FASE 1: Canonical URLs + Indexación (CRÍTICO - Esta semana)

| # | Acción | Archivo | Complejidad |
|---|--------|---------|-------------|
| 1.1 | **Agregar `<link rel="canonical">` en TODAS las páginas** | `frontend/src/layouts/BaseLayout.astro` | Media |
| 1.2 | **Redirect 301 www → non-www (o viceversa)** | Cloudflare Rules / `_headers` / middleware | Media |
| 1.3 | **Canonical en páginas con parámetros** → URL base sin parámetros | `BaseLayout.astro` + lógica en cada página | Media |
| 1.4 | **Canonical en paginación** → primera página o self | `categoria/[slug].astro` | Media |
| 1.5 | **Eliminar categorías fantasmas del rastreo** (celulares, computadoras, perif-ricos, imagen, insumos, hardware, unidad-de-energia, estuches, accesorios, conectividad, simuladores) | `robots.txt` + 404 en páginas | Baja |
| 1.6 | **Corregir URLs malformadas** `?brand=X?page=N` → `?brand=X&page=N` | Middleware o links en plantillas | Baja |
| 1.7 | **Excluir `/favoritos/` y páginas privadas del índice** | `robots.txt` + `noindex` | Baja |
| 1.8 | **Sitemap: `lastmod` real por producto** (no fecha fija 2026-10-02) | `sitemap.xml.ts` | Baja |
| 1.9 | **Solicitar re-indexación masiva en GSC** (API Indexing o manual) | GSC | 30 min |

---

### FASE 2: Structured Data - Correcciones Inmediatas (15 productos indexados)

| # | Corrección | Archivo | Complejidad |
|---|------------|---------|-------------|
| 2.1 | **Omitir `gtin13` cuando EAN inválido** (`"0"`, `null`, `""`, len≠13) | `frontend/src/pages/producto/[slug].astro` | Baja |
| 2.2 | **Agregar `hasMerchantReturnPolicy`** en `offers` | `frontend/src/pages/producto/[slug].astro` | Media |
| 2.3 | **Agregar `shippingDetails`** en `offers` | `frontend/src/pages/producto/[slug].astro` | Media |
| 2.4 | **Validar/sanitizar SKU** (alfanumérico, ≤70 chars) | `frontend/src/pages/producto/[slug].astro` | Baja |
| 2.5 | **NO agregar `aggregateRating`/`review`** hasta tener sistema real | — | — |

---

### FASE 3: Limpieza de Datos Origen (sync-elit)

| # | Acción | Archivo |
|---|--------|---------|
| 3.1 | **Normalizar EAN `"0"` → `null`** en normalizer | `workers/sync-elit/src/normalizer.ts` |
| 3.2 | **Validar checksum EAN-13** antes de guardar | `normalizer.ts` + nueva función |
| 3.3 | **Reportar a ELIT** productos sin GTIN real | Ticket soporte |

---

### FASE 4: Sistema de Reseñas (Futuro - Post indexación)

| Componente | Esfuerzo |
|------------|----------|
| Tabla `reviews` (ya existe) | — |
| API POST/GET reseñas | Media |
| UI reseñas en página producto | Media |
| Moderación/admin | Baja |
| Cálculo `aggregateRating` automático | Baja |

---

## 📝 Código: Fix Canónicos (BaseLayout.astro)

### `frontend/src/layouts/BaseLayout.astro` - Agregar en `<head>`

```astro
---
// ... imports existentes
const { pathname, search, origin } = Astro.url;
const canonicalBase = 'https://lanuscomputacion.com'; // Elegir versión preferida (non-www)

// Función para limpiar URL canónica
function getCanonicalUrl(pathname: string, search: string): string {
  // 1. Quitar www si viene en origin
  let url = canonicalBase + pathname;
  
  // 2. Parámetros permitidos en canonical (solo paginación limpia)
  if (search) {
    const params = new URLSearchParams(search.replace(/^\?/, ''));
    // Permitir solo 'page' numérico
    const page = params.get('page');
    const allowedParams: string[] = [];
    if (page && /^\d+$/.test(page) && parseInt(page) > 1) {
      allowedParams.push(`page=${page}`);
    }
    // NO incluir brand, sort, etc. en canonical → apuntan a página base
    if (allowedParams.length > 0) {
      url += '?' + allowedParams.join('&');
    }
  }
  return url;
}

const canonicalUrl = getCanonicalUrl(pathname, search);
---

<head>
  <!-- ... meta tags existentes ... -->
  
  <!-- CANONICAL - CRÍTICO PARA SEO -->
  <link rel="canonical" href={canonicalUrl} />
  
  <!-- Alternate para www (si se prefiere non-www) -->
  <link rel="alternate" href={canonicalUrl.replace('https://lanuscomputacion.com', 'https://www.lanuscomputacion.com')} />
  
  <!-- Preconnect para performance -->
  <link rel="preconnect" href="https://images.elit.com.ar" crossorigin />
  <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  
  <!-- Schema.org structured data (existente) -->
  <slot name="json-ld" />
</head>
```

### `frontend/src/pages/categoria/[slug].astro` - Canonical específico

```astro
---
// ... código existente ...

// Canonical: página base sin filtros, solo paginación válida
const cleanCanonical = `https://lanuscomputacion.com/categoria/${category.slug}${page > 1 ? `?page=${page}` : ''}`;
---

<BaseLayout title={...} canonicalUrl={cleanCanonical}>
  <slot name="json-ld">
    {JSON.stringify({...})}
  </slot>
</BaseLayout>
```

### `frontend/src/pages/producto/[slug].astro` - Canonical producto

```astro
---
// ... código existente ...

const canonicalUrl = `https://lanuscomputacion.com/producto/${product.slug}`;
---

<BaseLayout title={...} canonicalUrl={canonicalUrl}>
  <!-- ... -->
</BaseLayout>
```

### `frontend/src/layouts/BaseLayout.astro` - Recibir prop

```astro
---
interface Props {
  title: string;
  image?: string;
  canonicalUrl?: string; // NUEVO
}

const { title, image, canonicalUrl } = Astro.props;
const finalCanonical = canonicalUrl || `https://lanuscomputacion.com${Astro.url.pathname}${Astro.url.search}`;
---

<head>
  <link rel="canonical" href={finalCanonical} />
  <!-- ... -->
</head>
```

---

## 🔧 Fix: Redirect www → non-www (Cloudflare)

### Opción A: Cloudflare Redirect Rules (Recomendado - Edge)
**Dashboard > Rules > Redirect Rules**
```
Hostname matches "www.lanuscomputacion.com"
→ Dynamic redirect: https://lanuscomputacion.com${http.request.uri.path}${http.request.uri.query}
→ Status 301
```

### Opción B: `_headers` (si no hay Cloudflare Rules)
```
# No funciona para redirect 301, solo headers
```

### Opción C: Middleware (Astro)
```typescript
// frontend/src/middleware.ts - Al inicio
const url = new URL(context.request.url);
if (url.hostname === 'www.lanuscomputacion.com') {
  url.hostname = 'lanuscomputacion.com';
  return Response.redirect(url.toString(), 301);
}
```

---

## 🔧 Fix: Categorías Fantasmas (404 + noindex)

### `frontend/src/pages/categoria/[slug].astro` - Validar categoría real

```astro
---
// ... imports ...

const VALID_CATEGORIES = [
  'todas', 'celulares-telefonos', 'accesorios-celulares', 'repuestos-celulares',
  'camaras-digitales', 'camaras-accesorios', 'filmadoras-camaras-accion',
  'consolas-videojuegos', 'videojuegos', 'accesorios-consolas',
  'computacion', 'componentes-pc', 'impresion', 'tablets', 'pc-escritorio',
  'conectividad-redes', 'monitores-accesorios', 'electronica-audio-video',
  'audio', 'accesorios-audio-video', 'componentes-electronicos',
  'drones-accesorios', 'televisores', 'audio-vehiculos'
];

const { slug } = Astro.params;
if (!VALID_CATEGORIES.includes(slug!)) {
  return Astro.redirect('/404'); // O new Response(null, { status: 404 })
}
// ... resto del código
---
```

### `robots.txt` - Bloquear fantasmas

```
# Bloquear categorías que no existen en menú/sitemap
Disallow: /categoria/celulares
Disallow: /categoria/computadoras
Disallow: /categoria/perif-ricos
Disallow: /categoria/imagen
Disallow: /categoria/insumos
Disallow: /categoria/hardware
Disallow: /categoria/unidad-de-energia
Disallow: /categoria/estuches
Disallow: /categoria/accesorios
Disallow: /categoria/conectividad
Disallow: /categoria/simuladores

# Bloquear páginas privadas
Disallow: /favoritos/
Disallow: /carrito/
Disallow: /checkout/
Disallow: /login
Disallow: /register
Disallow: /perfil
Disallow: /compras
Disallow: /admin/
Disallow: /api/
```

---

## 🔧 Fix: Sitemap lastmod real

### `frontend/src/pages/sitemap.xml.ts` - Línea ~260

```typescript
// ANTES (fecha fija):
const now = new Date().toISOString();
// ...
<lastmod>${now}</lastmod>

// DESPUÉS (fecha real por producto):
for (const product of products) {
  const lastmod = product.last_api_update
    ? new Date(product.last_api_update).toISOString()
    : new Date(product.created_at || Date.now()).toISOString(); // fallback
  sitemap += `  <url>
  <loc>${baseUrl}/producto/${product.slug}</loc>
  <lastmod>${lastmod}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.6</priority>
</url>
`;
}
```

---

## ✅ Checklist Pre-Deploy FASE 1

- [ ] `<link rel="canonical">` en BaseLayout + props en páginas
- [ ] Redirect 301 www → non-www (Cloudflare Rules)
- [ ] Canonical limpio en categoría (solo `?page=N` si N>1)
- [ ] Canonical en producto (URL limpia sin parámetros)
- [ ] 404 en categorías fantasmas + `robots.txt` Disallow
- [ ] Corregir URLs malformadas `?brand=X?page=N` en plantillas/links
- [ ] `noindex` en `/favoritos/`, `/carrito/`, `/checkout/`, `/admin/`, `/api/`
- [ ] Sitemap `lastmod` real por producto
- [ ] Validar en [Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Solicitar indexación en GSC (URLs prioritarias + sitemap)

---

## 📈 Métricas de Éxito Post-Fix

| Métrica | Objetivo | Plazo |
|---------|----------|-------|
| Páginas "Duplicada sin canónico" | 0 | 2-4 semanas |
| Productos indexados | > 1,500 (70%) | 4-8 semanas |
| Cobertura GSC "Válidas con advertencias" | > 90% | 4 semanas |
| Rich snippets (Product) | > 500 productos | 8 semanas |
| Merchant Listings válidas | > 500 productos | 8 semanas |

---

## 🔗 Recursos

- [Google Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/canonical-url)
- [Consolidate Duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Product Structured Data](https://developers.google.com/search/docs/appearance/structured-data/product)
- [Merchant Listings Structured Data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- [Cloudflare Redirect Rules](https://developers.cloudflare.com/rules/url-forwarding/redirect-rules/)

---

## Resumen Ejecutivo

| Problema | Impacto | Fix | Tiempo |
|----------|---------|-----|--------|
| **1,690 páginas duplicadas sin canónico** | 🔴 **CRÍTICO** - Google no sabe cuál indexar | Canonical tags + redirect www + limpieza URLs | 1-2 días |
| **Solo 15/2,196 indexados** | 🔴 **CRÍTICO** - 99.3% invisible | Fix canónicos + sitemap + solicitar indexación | 2-4 semanas |
| **~90 GTIN inválidos ("0")** | 🟠 Alto | Omitir gtin13 + limpiar sync-elit | 1 día |
| **Faltan merchantReturnPolicy/shippingDetails** | 🟡 Medio | Agregar en schema.org Product | 2-3 días |
| **Sin aggregateRating/review** | 🟡 Medio | No inventar → sistema real futuro | Futuro |

**Próximo paso inmediato:** Implementar canonical URLs (BaseLayout + redirect www) y desplegar hoy mismo.
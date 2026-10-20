// Template web de flyers de campaña — Lanús Computación
// Port a TypeScript de datos/generar-flyers.mjs (misma salida HTML).
// El snapshot lo sirve KV (clave `snapshot:latest`), actualizado por el
// worker workers/flyers-updater a las 7:00 y 17:00 (ART).
import cssSitio from './css-sitio.css?raw';

export interface FlyerProduct {
  id: string;
  title: string;
  brand: string;
  category_name: string;
  price: number;
  mayorista: number;
  descuento_pct: number;
  min_qty: number;
  iva_pct: number;
  internal_tax_pct: number;
  thumbnail: string;
  slug: string;
  stock: number;
  url: string;
}

export interface FlyerSection {
  key: string;
  title: string;
  desc: string;
  productos: FlyerProduct[];
}

export interface FlyerSnapshot {
  fecha: string;
  fuente: string;
  secciones: FlyerSection[];
}

export const SITE = 'https://lanuscomputacion.com';
export const HEADER_IMG = `${SITE}/computaci%C3%B3n%20en%20lan%C3%BAs%20ofertas%20de%20tecnolog%C3%ADa.webp`;
const WA = '5491153323937'; // WhatsApp Lanús Computación
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── estilos del flyer (tokens del sitio: ml-*, b2b-*) ───────────────────────
const flyerCss = `
/* ===== Flyer campaña Lanús Computación (tokens del sitio) ===== */
body{margin:0;background:#EDEDED;font-family:'Proxima Nova',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333333}
.fl-wrap{max-width:640px;margin:0 auto;background:#FFFFFF}
.fl-logo{display:block;width:100%;height:auto}
.fl-body{padding:24px}
.fl-h1{font-size:22px;font-weight:700;color:#333333;margin:0 0 12px}
.fl-badges{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 20px}
.fl-badge{background:#F5F5F5;border:1px solid #E0E0E0;border-radius:8px;padding:10px 12px}
.fl-badge b{display:block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#333333}
.fl-badge span{display:block;font-size:11px;color:#999999;margin-top:2px}
.fl-cta{text-align:center;background:#F5F5F5;border:1px solid #E0E0E0;border-radius:8px;padding:20px;margin:0 0 8px}
.fl-btn{display:inline-block;background:#25D366;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:8px}
.fl-btn:hover{background:#20ba5a}
.fl-valid{font-size:11px;color:#999999;margin:10px 0 0}
.fl-section{margin-top:28px}
.fl-section h2{font-size:16px;font-weight:700;text-transform:uppercase;color:#333333;margin:0 0 4px}
.fl-desc{font-size:13px;color:#666666;margin:0 0 4px}
.fl-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.fl-card{display:flex;flex-direction:column;border:1px solid #E0E0E0;border-radius:8px;padding:12px;background:#FFFFFF;text-align:center}
.fl-img{width:100%;height:132px;display:flex;align-items:center;justify-content:center;background:#FFFFFF;margin-bottom:8px}
.fl-img img{max-width:100%;max-height:132px;object-fit:contain;display:block}
.fl-info{flex:1;display:flex;flex-direction:column;min-width:0}
.fl-title{font-size:12.5px;font-weight:600;color:#333333;margin:0 0 2px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em}
.fl-brand{font-size:11px;color:#999999;margin:0 0 6px}
.fl-price{font-size:18px;font-weight:700;color:#333333;line-height:1.15;margin:2px 0}
.fl-sinimp{font-size:11px;font-weight:400;color:#666666;margin:2px 0 10px}
.fl-buy{display:inline-block;align-self:center;background:#3483FA;color:#FFFFFF;font-size:12px;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:6px;margin-top:auto}
.fl-buy:hover{background:#2968c8}
.fl-closing{font-size:13px;color:#666666;line-height:1.65;margin:28px 0 0;padding:16px;background:#F5F5F5;border-radius:8px}
.fl-closing a{color:#3483FA}
.fl-footer{border-top:1px solid #E0E0E0;padding:16px 24px;text-align:center;font-size:11px;color:#999999;line-height:1.7}
.fl-footer b{color:#333333}
.fl-footer a{color:#3483FA;text-decoration:none}
@media (max-width:480px){
  .fl-badges{grid-template-columns:1fr}
  .fl-body{padding:16px}
  .fl-grid{gap:8px}
  .fl-card{padding:10px}
  .fl-img{height:100px}
  .fl-img img{max-height:100px}
  .fl-title{font-size:12px}
  .fl-price{font-size:16px}
}`;

export const FECHA_INICIO = Date.UTC(2026, 9, 9);
export const FECHA_FIN = Date.UTC(2027, 11, 31);

export function fechas(): Date[] {
  const out: Date[] = [];
  const d = new Date(FECHA_INICIO);
  const end = new Date(FECHA_FIN);
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow === 2 || dow === 5) out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function partes(d: Date) {
  const dia = DIAS[d.getUTCDay()];
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return { dia, fecha: `${dd}/${mm}/${yyyy}`, iso: `${yyyy}-${mm}-${dd}` };
}

export function flyerHref(d: Date): string {
  const { dia, iso } = partes(d);
  return `/lista/${iso.slice(0, 4)}/ofertas-lanus-${iso}-${dia}.html`;
}

export function productoCard(p: FlyerProduct): string {
  const iva = Number(p.iva_pct) > 0 ? Number(p.iva_pct) : 21;
  const interno = Number(p.internal_tax_pct) >= 0 ? Number(p.internal_tax_pct) : 0;
  const sinNacionales = Math.round(p.price / (1 + (iva + interno) / 100));
  const buy = `${SITE}/producto/${encodeURIComponent(p.slug)}?add=1`;
  return `
        <div class="fl-card" itemscope itemtype="https://schema.org/Product">
          <div class="fl-img"><img src="${esc(p.thumbnail)}" alt="${esc(p.title)}" title="${esc(p.title)}" width="128" height="128" loading="lazy" itemprop="image"></div>
          <div class="fl-info">
            <p class="fl-title" itemprop="name">${esc(p.title)}</p>
            ${p.brand ? `<p class="fl-brand" itemprop="brand">${esc(p.brand)}</p>` : '<p class="fl-brand">&nbsp;</p>'}
            <p class="fl-price">$${nf.format(Math.round(p.price))}<span itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="price" content="${p.price}"><meta itemprop="priceCurrency" content="ARS"><link itemprop="availability" href="https://schema.org/InStock"></span></p>
            <p class="fl-sinimp">Precio sin impuestos nacionales $${nf.format(sinNacionales)}</p>
            <a class="fl-buy" href="${esc(buy)}" target="_blank" rel="noopener" itemprop="url">Comprar</a>
          </div>
        </div>`;
}

export function flyer(d: Date, snapshot: FlyerSnapshot, opts?: { canonical?: string }): string {
  const { dia, fecha } = partes(d);
  const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1);
  const waCta = `https://wa.me/${WA}?text=${encodeURIComponent(`Hola, quiero consultar las ofertas mayoristas del ${dia} ${fecha}`)}`;
  const canonical = opts?.canonical || `${SITE}${flyerHref(d)}`;
  const cats = snapshot.secciones.map((s) => s.title.toLowerCase()).join(', ');
  const description = `Ofertas del ${dia} ${fecha} en Lanús Computación: ${cats} con entrega inmediata.`;
  const keywords = `ofertas tecnología, Lanús Computación, ${cats}, stock inmediato, envío a todo el país, mayoristas`;
  const secciones = snapshot.secciones
    .map(
      (s) => `
    <div class="fl-section">
      <h2>${esc(s.title)}</h2>
      <p class="fl-desc">${esc(s.desc)}</p>
      <div class="fl-grid">
        ${s.productos.map(productoCard).join('\n')}
      </div>
    </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ofertas de tecnología ${diaCap} ${fecha} | Lanús Computación</title>
<meta name="description" content="${esc(description)}">
<meta name="keywords" content="${esc(keywords)}">
<meta name="author" content="Lanús Computación">
<meta name="publisher" content="Lanús Computación">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}">
<meta name="image" content="${esc(HEADER_IMG)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lanús Computación">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${esc(`Ofertas de tecnología ${diaCap} ${fecha} | Lanús Computación`)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(HEADER_IMG)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(`Ofertas de tecnología ${diaCap} ${fecha} | Lanús Computación`)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(HEADER_IMG)}">
<style>${cssSitio}</style>
<style>${flyerCss}</style>
</head>
<body>
  <div class="fl-wrap" itemscope itemtype="https://schema.org/CollectionPage">
    <meta itemprop="name" content="${esc(`Ofertas de tecnología ${diaCap} ${fecha} | Lanús Computación`)}">
    <meta itemprop="description" content="${esc(description)}">
    <img class="fl-logo" src="${HEADER_IMG}" alt="Lanús Computación" title="Lanús Computación">
    <div class="fl-body">
      <h1 class="fl-h1">Ofertas de tecnología</h1>
      <div class="fl-badges">
        <div class="fl-badge"><b>Entrega inmediata</b><span>listo para despachar</span></div>
        <div class="fl-badge"><b>Atención postventa</b><span>Servicio técnico</span></div>
        <div class="fl-badge"><b>Garantía oficial</b><span>directa de marca</span></div>
        <div class="fl-badge"><b>Envío a todo el país</b><span>Tarifa plana</span></div>
      </div>
      ${secciones}
      <p class="fl-closing">¿No encontrás lo que buscás? Consultanos igual: te cotizamos cualquier equipo y te lo hacemos llegar lo más rápido posible. Si comprás para tu negocio o revendés tecnología, <a href="${SITE}/b2b" target="_blank" rel="noopener">registrá tu cuenta mayorista</a> y accedé a precios especiales automáticamente.</p>
      <div class="fl-cta">
        <a class="fl-btn" href="${waCta}" target="_blank" rel="noopener">Pedir por WhatsApp</a>
        <p class="fl-valid">Precios válidos para consultas del ${dia} ${fecha}. Sujetos a stock.</p>
      </div>
    </div>
    <div class="fl-footer">
      <b>Lanús Computación</b> · Tecnología en oferta<br>
      <a href="${SITE}" target="_blank" rel="noopener">lanuscomputacion.com</a> ·
      <a href="${SITE}/b2b" target="_blank" rel="noopener">Mayoristas</a> ·
      WhatsApp <b>11 5332-3937</b><br>
      Imágenes ilustrativas. Precios sujetos a cambios sin previo aviso.<br>
      Si no querés recibir más estas ofertas, respondé este mail con la palabra BAJA.
    </div>
  </div>
</body>
</html>`;
}

// ===== Versión para imprimir: /print/{año}/ofertas-lanus-{fecha}-{día}.html =====
// Todo el contenido de la campaña acomodado en una hoja A4 vertical
// (@page size:A4 portrait): header compacto, secciones en grilla de 4
// columnas y cards sin botón de compra.
const printCss = `
@page{size:A4 portrait;margin:8mm}
*{box-sizing:border-box}
body{margin:0;background:#EDEDED;font-family:'Proxima Nova',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333333}
.pr-sheet{width:210mm;min-height:297mm;margin:12px auto;background:#FFFFFF;padding:8mm;box-shadow:0 2px 14px rgba(0,0,0,.25)}
.pr-logo{display:block;width:auto;height:14mm;margin:0 auto 2mm}
.pr-h1{font-size:12pt;font-weight:700;margin:0 0 1.5mm;text-align:center}
.pr-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:1.5mm;margin:0 0 1mm}
.pr-chip{background:#F5F5F5;border:1px solid #E0E0E0;border-radius:2mm;padding:.6mm 2mm;font-size:5.5pt;color:#666666}
.pr-chip b{color:#333333;text-transform:uppercase;letter-spacing:.02em}
.pr-sec{margin-top:3.5mm}
.pr-sec h2{font-size:8.5pt;font-weight:700;text-transform:uppercase;margin:0;border-bottom:.4mm solid #333333;padding-bottom:.6mm;line-height:1.3}
.pr-sec h2 span{font-size:5.5pt;font-weight:400;text-transform:none;color:#777777;letter-spacing:0}
.pr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin-top:1.5mm}
.pr-card{border:.3mm solid #E0E0E0;border-radius:1.5mm;padding:1.2mm;display:flex;gap:1.2mm;align-items:flex-start;background:#FFFFFF}
.pr-img{width:12mm;height:12mm;flex:0 0 12mm;object-fit:contain}
.pr-info{flex:1;min-width:0}
.pr-title{font-size:5.5pt;font-weight:600;line-height:1.25;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pr-brand{font-size:5pt;color:#999999;margin:.5mm 0 0}
.pr-price{font-size:8pt;font-weight:700;margin:.5mm 0 0;line-height:1.1}
.pr-sin{font-size:4.5pt;color:#777777;margin:.4mm 0 0;line-height:1.2}
.pr-close{font-size:5.5pt;line-height:1.5;margin:4mm 0 0;padding:2mm;background:#F5F5F5;border-radius:1.5mm}
.pr-close a{color:#3483FA}
.pr-cta{margin-top:2mm;text-align:center;font-size:5.5pt;color:#666666}
.pr-cta a{color:#3483FA;font-weight:700}
.pr-foot{margin-top:3mm;border-top:.3mm solid #E0E0E0;padding-top:1.5mm;text-align:center;font-size:5pt;color:#999999;line-height:1.6}
.pr-foot b{color:#333333}
.pr-foot a{color:#3483FA;text-decoration:none}
@media print{
  body{background:#FFFFFF}
  .pr-sheet{box-shadow:none;margin:0;width:auto;min-height:0;padding:0}
}`;

function productoCardPrint(p: FlyerProduct): string {
  const iva = Number(p.iva_pct) > 0 ? Number(p.iva_pct) : 21;
  const interno = Number(p.internal_tax_pct) >= 0 ? Number(p.internal_tax_pct) : 0;
  const sinNacionales = Math.round(p.price / (1 + (iva + interno) / 100));
  return `
        <div class="pr-card">
          <img class="pr-img" src="${esc(p.thumbnail)}" alt="${esc(p.title)}" title="${esc(p.title)}" loading="lazy">
          <div class="pr-info">
            <p class="pr-title">${esc(p.title)}</p>
            ${p.brand ? `<p class="pr-brand">${esc(p.brand)}</p>` : '<p class="pr-brand">&nbsp;</p>'}
            <p class="pr-price">$${nf.format(Math.round(p.price))}</p>
            <p class="pr-sin">Precio sin impuestos nacionales $${nf.format(sinNacionales)}</p>
          </div>
        </div>`;
}

export function flyerPrint(d: Date, snapshot: FlyerSnapshot): string {
  const { dia, fecha } = partes(d);
  const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1);
  const canonical = `${SITE}${flyerHref(d)}`;
  const description = `Versión imprimible de las ofertas de tecnología del ${dia} ${fecha} en Lanús Computación.`;
  const waCta = `https://wa.me/${WA}?text=${encodeURIComponent(`Hola, quiero consultar las ofertas mayoristas del ${dia} ${fecha}`)}`;
  const secciones = snapshot.secciones
    .map(
      (s) => `
    <section class="pr-sec">
      <h2>${esc(s.title)} <span>— ${esc(s.desc)}</span></h2>
      <div class="pr-grid">
        ${s.productos.map(productoCardPrint).join('\n')}
      </div>
    </section>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ofertas de tecnología ${diaCap} ${fecha} | Lanús Computación (imprimible)</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${esc(canonical)}">
<style>${printCss}</style>
</head>
<body>
  <div class="pr-sheet">
    <img class="pr-logo" src="${HEADER_IMG}" alt="Lanús Computación" title="Lanús Computación">
    <h1 class="pr-h1">Ofertas de tecnología — ${diaCap} ${fecha}</h1>
    <div class="pr-chips">
      <span class="pr-chip"><b>Entrega inmediata</b> · listo para despachar</span>
      <span class="pr-chip"><b>Atención postventa</b> · Servicio técnico</span>
      <span class="pr-chip"><b>Garantía oficial</b> · directa de marca</span>
      <span class="pr-chip"><b>Envío a todo el país</b> · Tarifa plana</span>
    </div>
    ${secciones}
    <p class="pr-close">¿No encontrás lo que buscás? Consultanos igual: te cotizamos cualquier equipo y te lo hacemos llegar lo más rápido posible. Si comprás para tu negocio o revendés tecnología, <a href="${SITE}/b2b" target="_blank" rel="noopener">registrá tu cuenta mayorista</a> y accedé a precios especiales automáticamente.</p>
    <div class="pr-cta">
      <a href="${waCta}" target="_blank" rel="noopener">Pedir por WhatsApp</a> · Precios válidos para consultas del ${dia} ${fecha}. Sujetos a stock.
    </div>
    <div class="pr-foot">
      <b>Lanús Computación</b> · Tecnología en oferta ·
      <a href="${SITE}" target="_blank" rel="noopener">lanuscomputacion.com</a> ·
      <a href="${SITE}/b2b" target="_blank" rel="noopener">Mayoristas</a> ·
      WhatsApp <b>11 5332-3937</b><br>
      Imágenes ilustrativas. Precios sujetos a cambios sin previo aviso.
    </div>
  </div>
</body>
</html>`;
}

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
export const LOGO = `${SITE}/logo.png`;
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
.fl-header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #E0E0E0}
.fl-header img{height:44px;display:block}
.fl-tag{background:#DC2626;color:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:6px}
.fl-body{padding:24px}
.fl-h1{font-size:22px;font-weight:700;color:#333333;margin:0 0 12px}
.fl-intro{font-size:14px;color:#666666;line-height:1.65;margin:0 0 20px}
.fl-badges{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 20px}
.fl-badge{background:#F5F5F5;border:1px solid #E0E0E0;border-radius:8px;padding:10px 12px}
.fl-badge b{display:block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#333333}
.fl-badge span{display:block;font-size:11px;color:#999999;margin-top:2px}
.fl-cta{text-align:center;background:#F5F5F5;border:1px solid #E0E0E0;border-radius:8px;padding:20px;margin:0 0 8px}
.fl-btn{display:inline-block;background:#25D366;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:8px}
.fl-btn:hover{background:#20ba5a}
.fl-valid{font-size:11px;color:#999999;margin:10px 0 0}
.fl-section{margin-top:28px}
.fl-section h2{font-size:16px;font-weight:700;text-transform:uppercase;color:#333333;margin:0 0 4px;display:flex;align-items:center;gap:8px}
.fl-count{background:#FEE2E2;color:#DC2626;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:none;letter-spacing:0}
.fl-desc{font-size:13px;color:#666666;margin:0 0 12px}
.fl-card{display:flex;gap:16px;border:1px solid #E0E0E0;border-radius:8px;padding:12px;margin-bottom:10px;background:#FFFFFF}
.fl-img{width:128px;height:128px;flex:0 0 128px;display:flex;align-items:center;justify-content:center;background:#FFFFFF}
.fl-img img{max-width:128px;max-height:128px;object-fit:contain;display:block}
.fl-info{flex:1;min-width:0}
.fl-title{font-size:14px;font-weight:600;color:#333333;margin:0 0 2px;line-height:1.35}
.fl-brand{font-size:12px;color:#999999;margin:0 0 8px}
.fl-price{font-size:22px;font-weight:700;color:#333333;line-height:1.15;margin:2px 0}
.fl-sinimp{font-size:14px;font-weight:400;color:#666666;margin:2px 0 10px}
.fl-buy{display:inline-block;background:#3483FA;color:#FFFFFF;font-size:12px;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:6px}
.fl-buy:hover{background:#2968c8}
.fl-closing{font-size:13px;color:#666666;line-height:1.65;margin:28px 0 0;padding:16px;background:#F5F5F5;border-radius:8px}
.fl-closing a{color:#3483FA}
.fl-footer{border-top:1px solid #E0E0E0;padding:16px 24px;text-align:center;font-size:11px;color:#999999;line-height:1.7}
.fl-footer b{color:#333333}
.fl-footer a{color:#3483FA;text-decoration:none}
@media (max-width:480px){
  .fl-badges{grid-template-columns:1fr}
  .fl-card{flex-direction:column;align-items:center;text-align:center}
  .fl-info{width:100%}
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
  return `/flyers/${iso.slice(0, 4)}/ofertas-lanus-${iso}-${dia}.html`;
}

export function productoCard(p: FlyerProduct): string {
  const iva = Number(p.iva_pct) > 0 ? Number(p.iva_pct) : 21;
  const interno = Number(p.internal_tax_pct) >= 0 ? Number(p.internal_tax_pct) : 0;
  const sinNacionales = Math.round(p.price / (1 + (iva + interno) / 100));
  const buy = `${SITE}/producto/${encodeURIComponent(p.slug)}?add=1`;
  return `
        <div class="fl-card">
          <div class="fl-img"><img src="${esc(p.thumbnail)}" alt="${esc(p.title)}" width="128" height="128" loading="lazy"></div>
          <div class="fl-info">
            <p class="fl-title">${esc(p.title)}</p>
            ${p.brand ? `<p class="fl-brand">${esc(p.brand)}</p>` : '<p class="fl-brand">&nbsp;</p>'}
            <p class="fl-price">$${nf.format(Math.round(p.price))}</p>
            <p class="fl-sinimp">Precio sin impuestos nacionales $${nf.format(sinNacionales)}</p>
            <a class="fl-buy" href="${esc(buy)}" target="_blank" rel="noopener">Comprar</a>
          </div>
        </div>`;
}

export function flyer(d: Date, snapshot: FlyerSnapshot): string {
  const { dia, fecha } = partes(d);
  const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1);
  const waCta = `https://wa.me/${WA}?text=${encodeURIComponent(`Hola, quiero consultar las ofertas mayoristas del ${dia} ${fecha}`)}`;
  const secciones = snapshot.secciones
    .map(
      (s) => `
    <div class="fl-section">
      <h2>${esc(s.title)} <span class="fl-count">${s.productos.length} EQUIPOS EN OFERTA</span></h2>
      <p class="fl-desc">${esc(s.desc)}</p>
      ${s.productos.map(productoCard).join('\n')}
    </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ofertas Mayoristas Lanús Computación — ${dia} ${fecha}</title>
<style>${cssSitio}</style>
<style>${flyerCss}</style>
</head>
<body>
  <div class="fl-wrap">
    <div class="fl-header">
      <img src="${LOGO}" alt="Lanús Computación">
      <span class="fl-tag">Precios mayoristas</span>
    </div>
    <div class="fl-body">
      <h1 class="fl-h1">Ofertas Mayoristas — ${diaCap} ${fecha}</h1>
      <p class="fl-intro">Hola, ¿cómo estás? Te compartimos nuestra selección de la semana con <b>stock inmediato</b> y <b>precios mayoristas</b>: NAS, notebooks, PCs, monitores, redes, UPS y discos. En cada equipo te dejamos el precio vigente y el precio sin impuestos nacionales, con el botón para comprarlo directo en el sitio con el carrito cargado. Y si lo que buscás no está en la lista, consultanos igual por WhatsApp: te lo cotizamos.</p>
      <div class="fl-badges">
        <div class="fl-badge"><b>Stock disponible</b><span>listo para despachar</span></div>
        <div class="fl-badge"><b>Precios mayoristas</b><span>para cuentas aprobadas</span></div>
        <div class="fl-badge"><b>Garantía oficial</b><span>directa de marca</span></div>
        <div class="fl-badge"><b>Envío 24/48h</b><span>a todo el país</span></div>
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

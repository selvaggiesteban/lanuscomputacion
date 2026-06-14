# StarTech Design System

## Filosofía Visual

StarTech es un e-commerce B2B/B2C especializado en tecnología. El diseño es una
**réplica exacta de MercadoLibre Argentina**, aprovechando su interfaz probada
y familiar para millones de usuarios. La identidad de marca se diferencia por un
logotipo propio y un tratamiento cromático que enfatiza la confianza y la
velocidad de la tecnología.

Cada elección visual —desde el amarillo institucional hasta las cards de
producto— está diseñada para que el usuario se sienta inmediatamente en un
entorno de compra conocido, mientras que los elementos B2B (precios mayoristas,
badges, toggle) se integran de forma orgánica sin romper la experiencia.

La paleta hereda los colores funcionales de MercadoLibre:
- **Amarillo** (#FFE600) para acentos y badges promocionales
- **Azul** (#3483FA) para acciones principales (Comprar, Confirmar)
- **Verde** (#00a650) para envío gratis, cuotas sin interés, descuentos
- **Gris neutro** (#EDEDED, #999999, #333333) para fondos, textos y bordes

## Tokens de Diseño

### Colores

| Token | Hex | Uso |
|---|---|---|
| `--ml-yellow` | #FFE600 | Badge descuento, acentos |
| `--ml-yellow-hover` | #FFF059 | Hover amarillo |
| `--ml-blue` | #3483FA | Botón primario, links |
| `--ml-blue-hover` | #1259c3 | Hover botón |
| `--ml-blue-light` | #E4F1FE | Fondo botón secundario |
| `--ml-green` | #00a650 | Envío gratis, cuotas, OFF |
| `--ml-green-bg` | #E6F7ED | Fondo badge envío gratis |
| `--ml-text` | #333333 | Texto principal |
| `--ml-text-secondary` | #666666 | Texto secundario |
| `--ml-text-muted` | #999999 | Texto tenue, precios tachados |
| `--ml-border` | #E0E0E0 | Bordes, separadores |
| `--ml-bg` | #EDEDED | Fondo de página |
| `--ml-white` | #FFFFFF | Fondos de cards, header |
| `--ml-star` | #FFD700 | Estrellas de rating |
| `--b2b-purple` | #7C3AED | Badge B2B mayorista |

### Tipografía

**Familia principal:** `Proxima Nova`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif

| Escala | Tamaño | Peso | Uso |
|---|---|---|---|
| `.text-xs` | 12px | 400 | Labels, metadata |
| `.text-sm` | 14px | 400 | Cuerpo, descripciones |
| `.text-base` | 16px | 400 | Texto general |
| `.text-lg` | 18px | 600 | Subtítulos |
| `.text-xl` | 24px | 600 | Títulos de sección |
| `.text-2xl` | 28px | 700 | Título de producto |
| `.text-3xl` | 32px | 700 | Precio producto |
| `.text-4xl` | 40px | 700 | Hero / ofertas |

**Precios:** Usar `tabular-nums` para alineación vertical de números.

### Espaciado

Sistema basado en 4px (Tailwind defaults):
- `gap-1` = 4px | `gap-2` = 8px | `gap-3` = 12px | `gap-4` = 16px
- `gap-6` = 24px | `gap-8` = 32px | `gap-12` = 48px
- Padding de cards: `p-4` (16px)
- Grid gap: `gap-4` (16px)

### Bordes y Sombras

- `rounded-sm` (2px): badges, etiquetas
- `rounded` (4px): cards, inputs, botones
- `rounded-lg` (8px): modales, drawers
- `shadow-sm`: cards de producto
- `shadow-md`: header, mega menú

## Componentes

### Header
```
┌──────────────────────────────────────────────────────────┐
│ Logo  [Buscador...                   ]  PC  Perfil ★ 🔔 🛒│
├──────────────────────────────────────────────────────────┤
│ Celulares │ Computación │ Electrónica │ Consolas │ Cámaras│
└──────────────────────────────────────────────────────────┘
```
- Altura: 56px + 40px (mega menú)
- Fondo: white, borde inferior 1px solid #E0E0E0
- Logo: 134px x 34px (proporción ML)
- Buscador: input con búsqueda, borde #E0E0E0, focus #3483FA
- Iconos header: 24x24, grises (#666), hover azul (#3483FA)

### ProductCard (grid)
```
┌───────────────────┐
│      Imagen       │  ← 200x200, object-contain
│                   │
│ Título producto   │  ← 14px, #333, max 2 líneas
│ (max 2 líneas)    │
│                   │
│ $ 1.249.000       │  ← 24px bold, #333
│ $ 1.399.000 11%OFF│  ← 14px #999 tachado + badge #FFE600
│                   │
│ en 6x $ 208.167   │  ← 14px #00a650
│ sin interés       │
│                   │
│ 🚚 Envío gratis   │  ← 12px #00a650 con icono
│                   │
│ ★★★★★ (150)       │  ← 12px #666
└───────────────────┘
```
- Card: 224px ancho, rounded, shadow-sm, bg white
- Imagen: 200x200, padding 16px
- Precio: text-3xl (32px) bold
- Precio tachado: text-sm #999, line-through
- OFF badge: bg #FFE600, text-xs bold, px-1
- Cuotas: text-sm #00a650
- Envío gratis: text-xs #00a650, bg #E6F7ED badge

### Sidebar Filtros
```
┌──────────────────┐
│  Marca           │
│  □ Samsung  (12) │  ← checkbox + label + count
│  □ Apple    (8)  │
│  □ HP       (5)  │
├──────────────────┤
│  Precio          │
│  [Mín] — [Máx]   │  ← inputs 80px + label
│  [▶ Aplicar]     │
├──────────────────┤
│  Condición       │
│  □ Nuevo  (50)   │
│  □ Usado  (3)    │
├──────────────────┤
│  Descuento       │
│  □ 10% o más     │  ← radio group
│  □ 30% o más     │
│  □ 50% o más     │
├──────────────────┤
│  Envío           │
│  □ Gratis        │
└──────────────────┘
```
- 224px ancho, sticky top-20
- Títulos: text-sm uppercase tracking-wide #666
- Checkboxes: accent-color #3483FA
- Labels: text-sm #333
- Counts: text-xs #999

### ProductDetail Page (clon exacto ML)
```
┌─────────────────────────────────────────────────────────┐
│ Migas: Tecnología > Computación > Notebooks > Lenovo    │
├──────────────────────────────┬──────────────────────────┤
│  ┌──────────────────────┐   │ Lenovo ThinkPad X1       │
│  │                      │   │ ★★★★☆ (328 opiniones)    │
│  │    Imagen Principal  │   │                          │
│  │      500x500         │   │ Nuevo | 256GB | 16GB RAM │
│  │                      │   │                          │
│  └──────────────────────┘   │ $ 1.249.000              │
│  [1] [2] [3] [4] [5]       │ $ 1.399.000  11% OFF     │
│  (miniaturas 48x48)        │                          │
│                            │ en 6x $ 208.167 sin int. │
│  Compartir  Vender uno igual│                          │
│                            │ Cantidad: [-] 1 [+]      │
│  Vendido por StarTech      │                          │
│  ★★★★★ (100% positivo)    │ [Comprar ahora]  💙      │
│                            │ [Agregar al carrito]     │
│                            ├──────────────────────────┤
│                            │ 🚚 Envío gratis           │
│                            │ a todo el país            │
│                            │ 📦 [Calcular envío]       │
│                            ├──────────────────────────┤
│                            │ [B2B] Precio mayorista:   │
│                            │ $1.124.100 (10% off)      │
│                            │ Mín 6 unidades            │
│                            ├──────────────────────────┤
│                            │ Medios de pago            │
│                            │ 💳 Mercado Pago           │
│                            │ 🏦 Transferencia bancaria │
└────────────────────────────┴──────────────────────────┘
│  Especificaciones técnicas                             │
│  Marca: Lenovo | Modelo: ThinkPad X1 | RAM: 16GB ...  │
│                                                        │
│  Productos relacionados                                │
│  [Card] [Card] [Card] [Card]                           │
└────────────────────────────────────────────────────────┘
```

### Badges
| Badge | Estilo |
|---|---|
| `11% OFF` | bg #FFE600, text #333, text-xs, px-1, rounded-sm, font-bold |
| `Envío gratis` | bg #E6F7ED, text #00a650, text-xs, px-2, rounded-sm |
| `Nuevo` | bg #3483FA, text white, text-xs, px-2, rounded-sm |
| `INTERNATIONAL` | bg #E6F7ED, text #00a650, text-xs, px-1 |
| `B2B` | bg #7C3AED, text white, text-xs, px-2, rounded-sm |
| `★` | Color #FFD700 |

### Botones
| Botón | Estilo |
|---|---|
| **Comprar ahora** | bg #3483FA → #1259c3 hover, text white, font-bold, px-8 py-3, rounded, text-base |
| **Agregar al carrito** | bg #E4F1FE → #D0E6FA hover, text #3483FA, font-bold, px-8 py-3, rounded |
| **Outline** | border #E0E0E0, text #333, hover:border #3483FA |
| **Cantidad [-] [+] | border #E0E0E0, rounded, 40x40px buttons |

### Mega Menú
- Trigger: hover sobre categoría principal
- Dropdown: bg white, shadow-lg, border-top 2px solid #FFE600
- Ancho: full-width (contraído al contenedor)
- Columnas: 3-4 columnas de subcategorías
- Items: text-sm #333, hover #3483FA
- Título categoría: text-sm font-bold, uppercase

## Responsive Breakpoints
- Mobile: < 768px (menú hamburguesa, 2 columnas de productos)
- Tablet: 768px - 1024px (sidebar colapsable, 3 columnas)
- Desktop: > 1024px (sidebar fija, 4-5 columnas)

## Animaciones
- Hover cards: translateY(-1px) + shadow-md, 200ms ease
- Mega menú: fadeIn + slideDown, 200ms
- Cart drawer: slideInRight, 300ms ease
- Skeleton loading: shimmer animation
- Microinteracciones: botones cambian de color en hover

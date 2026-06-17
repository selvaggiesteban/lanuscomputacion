// seed_categories.ts
// Seeds the categories table in D1 with Lanús Computación taxonomy
// Uses INSERT OR IGNORE so it's safe to run multiple times

export interface CategorySeed {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  level: number;
  picture: string;
}

const CATEGORIES: CategorySeed[] = [
  // ─── TOP-LEVEL CATEGORIES ───────────────────────────────────
  {
    id: "cat_celulares",
    name: "Celulares y Teléfonos",
    slug: "celulares-telefonos",
    parent_id: null,
    level: 0,
    picture: "",
  },
  {
    id: "cat_camaras",
    name: "Cámaras y Accesorios",
    slug: "camaras-accesorios",
    parent_id: null,
    level: 0,
    picture: "",
  },
  {
    id: "cat_consolas",
    name: "Consolas y Videojuegos",
    slug: "consolas-videojuegos",
    parent_id: null,
    level: 0,
    picture: "",
  },
  {
    id: "cat_computacion",
    name: "Computación",
    slug: "computacion",
    parent_id: null,
    level: 0,
    picture: "",
  },
  {
    id: "cat_electronica",
    name: "Electrónica, Audio y Video",
    slug: "electronica-audio-video",
    parent_id: null,
    level: 0,
    picture: "",
  },

  // ─── CELULARES Y TELÉFONOS ──────────────────────────────────
  {
    id: "sub_celulares_smartphones",
    name: "Celulares y Smartphones",
    slug: "celulares-smartphones",
    parent_id: "cat_celulares",
    level: 1,
    picture: "",
  },
  {
    id: "sub_celulares_accesorios",
    name: "Accesorios para Celulares",
    slug: "accesorios-celulares",
    parent_id: "cat_celulares",
    level: 1,
    picture: "",
  },
  {
    id: "sub_celulares_repuestos",
    name: "Repuestos de Celulares",
    slug: "repuestos-celulares",
    parent_id: "cat_celulares",
    level: 1,
    picture: "",
  },

  // ─── CÁMARAS Y ACCESORIOS ───────────────────────────────────
  {
    id: "sub_camaras_digitales",
    name: "Cámaras Digitales",
    slug: "camaras-digitales",
    parent_id: "cat_camaras",
    level: 1,
    picture: "",
  },
  {
    id: "sub_camaras_accesorios",
    name: "Accesorios para Cámaras",
    slug: "accesorios-camaras",
    parent_id: "cat_camaras",
    level: 1,
    picture: "",
  },
  {
    id: "sub_camaras_filmadoras",
    name: "Filmadoras y Cámaras de Acción",
    slug: "filmadoras-camaras-accion",
    parent_id: "cat_camaras",
    level: 1,
    picture: "",
  },

  // ─── CONSOLAS Y VIDEOJUEGOS ─────────────────────────────────
  {
    id: "sub_consolas_videojuegos",
    name: "Video Juegos",
    slug: "video-juegos",
    parent_id: "cat_consolas",
    level: 1,
    picture: "",
  },
  {
    id: "sub_consolas_playstation",
    name: "Para PlayStation",
    slug: "para-playstation",
    parent_id: "cat_consolas",
    level: 1,
    picture: "",
  },
  {
    id: "sub_consolas_nintendo",
    name: "Para Nintendo",
    slug: "para-nintendo",
    parent_id: "cat_consolas",
    level: 1,
    picture: "",
  },

  // ─── COMPUTACIÓN ────────────────────────────────────────────
  {
    id: "sub_computacion_componentes",
    name: "Componentes de PC",
    slug: "componentes-pc",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },
  {
    id: "sub_computacion_impresion",
    name: "Impresión",
    slug: "impresion",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },
  {
    id: "sub_computacion_tablets",
    name: "Tablets y Accesorios",
    slug: "tablets-accesorios",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },
  {
    id: "sub_computacion_pc",
    name: "PC",
    slug: "pc",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },
  {
    id: "sub_computacion_conectividad",
    name: "Conectividad y Redes",
    slug: "conectividad-redes",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },
  {
    id: "sub_computacion_monitores",
    name: "Monitores y Accesorios",
    slug: "monitores-accesorios",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },
  {
    id: "sub_computacion_almacenamiento",
    name: "Almacenamiento",
    slug: "almacenamiento",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },
  {
    id: "sub_computacion_memorias",
    name: "Memorias",
    slug: "memorias",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },
  {
    id: "sub_computacion_cables",
    name: "Cables",
    slug: "cables",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },
  {
    id: "sub_computacion_energia",
    name: "Fuentes y Estabilizadores",
    slug: "fuentes-estabilizadores",
    parent_id: "cat_computacion",
    level: 1,
    picture: "",
  },

  // ─── ELECTRÓNICA, AUDIO Y VIDEO ─────────────────────────────
  {
    id: "sub_electronica_audio",
    name: "Audio",
    slug: "audio",
    parent_id: "cat_electronica",
    level: 1,
    picture: "",
  },
  {
    id: "sub_electronica_accesorios_audio",
    name: "Accesorios para Audio y Video",
    slug: "accesorios-audio-video",
    parent_id: "cat_electronica",
    level: 1,
    picture: "",
  },
  {
    id: "sub_electronica_componentes",
    name: "Componentes Electrónicos",
    slug: "componentes-electronicos",
    parent_id: "cat_electronica",
    level: 1,
    picture: "",
  },
  {
    id: "sub_electronica_drones",
    name: "Drones y Accesorios",
    slug: "drones-accesorios",
    parent_id: "cat_electronica",
    level: 1,
    picture: "",
  },
  {
    id: "sub_electronica_audio_vehiculos",
    name: "Audio para Vehículos",
    slug: "audio-vehiculos",
    parent_id: "cat_electronica",
    level: 1,
    picture: "",
  },
  {
    id: "sub_electronica_televisores",
    name: "Televisores",
    slug: "televisores",
    parent_id: "cat_electronica",
    level: 1,
    picture: "",
  },
];

/**
 * Seeds categories into D1 using INSERT OR IGNORE (safe to run multiple times).
 */
export async function seedCategories(db: D1Database): Promise<{ inserted: number }> {
  let inserted = 0;

  for (const cat of CATEGORIES) {
    const result = await db.prepare(`
      INSERT OR IGNORE INTO categories (id, name, slug, parent_id, level, picture, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).bind(cat.id, cat.name, cat.slug, cat.parent_id, cat.level, cat.picture).run();

    if (result.meta.changes > 0) inserted++;
  }

  return { inserted };
}

/**
 * Returns all category seeds (for external use).
 */
export function getAllCategories(): CategorySeed[] {
  return CATEGORIES;
}

// category_mapping.ts
// Static mapping from ELIT categories/subcategories → Lanús Computación taxonomy
// If a combo isn't found here, AI classifier is used as fallback

export interface CategoryMapping {
  category_id: string;
  subcategory_name: string;
}

// Category IDs must match seed_categories.ts
const CAT = {
  CELULARES: "cat_celulares",
  CAMARAS: "cat_camaras",
  CONSOLAS: "cat_consolas",
  COMPUTACION: "cat_computacion",
  ELECTRONICA: "cat_electronica",
} as const;

const SUB = {
  // Celulares
  CEL_SMARTPHONES: "sub_celulares_smartphones",
  CEL_ACCESORIOS: "sub_celulares_accesorios",
  CEL_REPUESTOS: "sub_celulares_repuestos",
  // Cámaras
  CAM_DIGITALES: "sub_camaras_digitales",
  CAM_ACCESORIOS: "sub_camaras_accesorios",
  CAM_FILMADORAS: "sub_camaras_filmadoras",
  // Consolas
  CON_VIDEOJUEGOS: "sub_consolas_videojuegos",
  CON_PLAYSTATION: "sub_consolas_playstation",
  CON_NINTENDO: "sub_consolas_nintendo",
  // Computación
  COMP_COMPONENTES: "sub_computacion_componentes",
  COMP_IMPRESION: "sub_computacion_impresion",
  COMP_TABLETS: "sub_computacion_tablets",
  COMP_PC: "sub_computacion_pc",
  COMP_CONECTIVIDAD: "sub_computacion_conectividad",
  COMP_MONITORES: "sub_computacion_monitores",
  COMP_ALMACENAMIENTO: "sub_computacion_almacenamiento",
  COMP_MEMORIAS: "sub_computacion_memorias",
  COMP_CABLES: "sub_computacion_cables",
  COMP_ENERGIA: "sub_computacion_energia",
  // Electrónica
  ELEC_AUDIO: "sub_electronica_audio",
  ELEC_ACC_AUDIO: "sub_electronica_accesorios_audio",
  ELEC_COMPONENTES: "sub_electronica_componentes",
  ELEC_DRONES: "sub_electronica_drones",
  ELEC_AUDIO_VEHICULOS: "sub_electronica_audio_vehiculos",
  ELEC_TELEVISORES: "sub_electronica_televisores",
} as const;

// ============================================================
// SUBCATEGORY-LEVEL MAPPING (most specific)
// Key: "ELIT_CATEGORY|ELIT_SUBCATEGORY" → value: our taxonomy
// ============================================================
const SUBCATEGORY_MAP: Record<string, CategoryMapping> = {
  // --- Audio ---
  "Audio|Auriculares":                     { category_id: CAT.ELECTRONICA, subcategory_name: SUB.ELEC_AUDIO },
  "Audio|Parlantes":                       { category_id: CAT.ELECTRONICA, subcategory_name: SUB.ELEC_AUDIO },
  "Audio|Microfonos":                      { category_id: CAT.ELECTRONICA, subcategory_name: SUB.ELEC_AUDIO },
  "Audio|Audio para Vehículos":            { category_id: CAT.ELECTRONICA, subcategory_name: SUB.ELEC_AUDIO_VEHICULOS },

  // --- Computadoras ---
  "Computadoras|Notebooks Consumo":        { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_PC },
  "Computadoras|Notebooks Corporativo":    { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_PC },
  "Computadoras|Mini PC":                  { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_PC },

  // --- Hardware ---
  "Hardware|Motherboards":                 { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_COMPONENTES },
  "Hardware|Procesadores":                 { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_COMPONENTES },
  "Hardware|Coolers":                      { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_COMPONENTES },
  "Hardware|Gabinetes":                    { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_COMPONENTES },
  "Hardware|Fuentes":                      { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_COMPONENTES },
  "Hardware|Placas de Video":              { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_COMPONENTES },

  // --- Conectividad ---
  "Conectividad|Routers":                  { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_CONECTIVIDAD },
  "Conectividad|Switches":                 { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_CONECTIVIDAD },
  "Conectividad|Placas de Red":            { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_CONECTIVIDAD },

  // --- Impresoras ---
  "Impresoras|Impresoras Inkjet":          { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },
  "Impresoras|Impresoras Laser":           { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },
  "Impresoras|Impresoras de Sistema Continuo": { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },
  "Impresoras|Plotters":                   { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },

  // --- Periféricos ---
  "Perifericos|Teclados":                  { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_TABLETS },
  "Perifericos|Mouses":                    { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_TABLETS },
  "Perifericos|Mouse Pads":                { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_TABLETS },

  // --- Almacenamiento ---
  "Almacenamiento|Discos Externos":        { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_ALMACENAMIENTO },
  "Almacenamiento|Discos Externos SSD":    { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_ALMACENAMIENTO },
  "Almacenamiento|Discos Internos":        { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_ALMACENAMIENTO },
  "Almacenamiento|Discos Internos SSD":    { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_ALMACENAMIENTO },
  "Almacenamiento|Nas":                    { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_ALMACENAMIENTO },

  // --- Memorias ---
  "Memorias|Memorias Flash":              { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_MEMORIAS },
  "Memorias|Memorias PC":                 { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_MEMORIAS },
  "Memorias|Memorias Notebook":           { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_MEMORIAS },
  "Memorias|Pen Drives":                  { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_MEMORIAS },

  // --- Cables ---
  "Cables|Cables":                         { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_CABLES },

  // --- Unidad de Energia ---
  "Unidad de Energia|Ups":                { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_ENERGIA },
  "Unidad de Energia|Estabilizadores":    { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_ENERGIA },

  // --- Video Juegos ---
  "Video Juegos|Consolas":                 { category_id: CAT.CONSOLAS, subcategory_name: SUB.CON_VIDEOJUEGOS },
  "Video Juegos|Joysticks":               { category_id: CAT.CONSOLAS, subcategory_name: SUB.CON_VIDEOJUEGOS },
  "Video Juegos|Volantes":                { category_id: CAT.CONSOLAS, subcategory_name: SUB.CON_VIDEOJUEGOS },

  // --- Seguridad ---
  "Seguridad|Camaras IP":                  { category_id: CAT.CAMARAS, subcategory_name: SUB.CAM_DIGITALES },
  "Seguridad|Camaras WiFi":               { category_id: CAT.CAMARAS, subcategory_name: SUB.CAM_DIGITALES },
  "Seguridad|Camaras Web":                { category_id: CAT.CAMARAS, subcategory_name: SUB.CAM_DIGITALES },

  // --- Imagen ---
  "Imagen|Proyectores":                    { category_id: CAT.ELECTRONICA, subcategory_name: SUB.ELEC_TELEVISORES },
  "Imagen|Escaner":                        { category_id: CAT.ELECTRONICA, subcategory_name: SUB.ELEC_TELEVISORES },

  // --- Estuches ---
  "Estuches|Fundas":                       { category_id: CAT.CELULARES, subcategory_name: SUB.CEL_ACCESORIOS },
  "Estuches|Maletines":                    { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_TABLETS },
  "Estuches|Mochilas":                     { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_TABLETS },

  // --- Insumos ---
  "Insumos|Botellas de Tinta":             { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },
  "Insumos|Cartuchos de Tinta":            { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },
  "Insumos|Cartuchos de Plotters":         { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },
  "Insumos|Toners":                        { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },
  "Insumos|Cilindros":                     { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },

  // --- Accesorios ---
  "Accesorios|Adaptadores":                { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_CABLES },
  "Accesorios|Baterias":                   { category_id: CAT.CELULARES, subcategory_name: SUB.CEL_ACCESORIOS },
  "Accesorios|Cargadores Portatiles":      { category_id: CAT.CELULARES, subcategory_name: SUB.CEL_ACCESORIOS },
  "Accesorios|Candados":                   { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_TABLETS },
  "Accesorios|Extensores":                 { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_CABLES },
  "Accesorios|Protectores":                { category_id: CAT.CELULARES, subcategory_name: SUB.CEL_ACCESORIOS },
  "Accesorios|Soportes":                   { category_id: CAT.ELECTRONICA, subcategory_name: SUB.ELEC_ACC_AUDIO },
  "Accesorios|Trituradora":                { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_TABLETS },
};

// ============================================================
// CATEGORY-LEVEL FALLBACK (when subcategory not found)
// Key: ELIT_CATEGORY → value: our taxonomy
// ============================================================
const CATEGORY_MAP: Record<string, CategoryMapping> = {
  "Audio":              { category_id: CAT.ELECTRONICA, subcategory_name: SUB.ELEC_AUDIO },
  "Computadoras":       { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_PC },
  "Hardware":           { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_COMPONENTES },
  "Conectividad":       { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_CONECTIVIDAD },
  "Impresoras":         { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },
  "Perifericos":        { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_TABLETS },
  "Almacenamiento":     { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_ALMACENAMIENTO },
  "Memorias":           { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_MEMORIAS },
  "Cables":             { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_CABLES },
  "Unidad de Energia":  { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_ENERGIA },
  "Video Juegos":       { category_id: CAT.CONSOLAS, subcategory_name: SUB.CON_VIDEOJUEGOS },
  "Seguridad":          { category_id: CAT.CAMARAS, subcategory_name: SUB.CAM_DIGITALES },
  "Imagen":             { category_id: CAT.ELECTRONICA, subcategory_name: SUB.ELEC_TELEVISORES },
  "Estuches":           { category_id: CAT.CELULARES, subcategory_name: SUB.CEL_ACCESORIOS },
  "Insumos":            { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_IMPRESION },
  "Accesorios":         { category_id: CAT.COMPUTACION, subcategory_name: SUB.COMP_TABLETS },
};

/**
 * Maps an ELIT product category/subcategory to our taxonomy.
 * Returns null if no static mapping exists (AI fallback needed).
 */
export function mapElitToCategory(
  elitCategory: string,
  elitSubcategory: string,
): CategoryMapping | null {
  // 1. Try subcategory-level mapping (most specific)
  const key = `${elitCategory}|${elitSubcategory}`;
  if (SUBCATEGORY_MAP[key]) return SUBCATEGORY_MAP[key];

  // 2. Try category-level fallback
  if (CATEGORY_MAP[elitCategory]) return CATEGORY_MAP[elitCategory];

  // 3. No mapping found — AI classifier needed
  return null;
}

/**
 * Returns all category IDs that need subcategories in the seed.
 */
export function getAllCategoryIds(): string[] {
  return Object.values(CAT);
}

/**
 * Returns all subcategory IDs that need to be seeded.
 */
export function getAllSubcategoryIds(): string[] {
  return Object.values(SUB);
}

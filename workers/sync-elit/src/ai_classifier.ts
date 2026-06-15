// ai_classifier.ts
// Uses Cloudflare Workers AI to classify products that don't match static mapping
// Only called when mapElitToCategory() returns null

import type { CategoryMapping } from "./category_mapping";

// Category ID constants (must match category_mapping.ts)
const CAT = {
  CELULARES: "cat_celulares",
  CAMARAS: "cat_camaras",
  CONSOLAS: "cat_consolas",
  COMPUTACION: "cat_computacion",
  ELECTRONICA: "cat_electronica",
} as const;

const SUB = {
  CEL_SMARTPHONES: "sub_celulares_smartphones",
  CEL_ACCESORIOS: "sub_celulares_accesorios",
  CEL_REPUESTOS: "sub_celulares_repuestos",
  CAM_DIGITALES: "sub_camaras_digitales",
  CAM_ACCESORIOS: "sub_camaras_accesorios",
  CAM_FILMADORAS: "sub_camaras_filmadoras",
  CON_VIDEOJUEGOS: "sub_consolas_videojuegos",
  CON_PLAYSTATION: "sub_consolas_playstation",
  CON_NINTENDO: "sub_consolas_nintendo",
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
  ELEC_AUDIO: "sub_electronica_audio",
  ELEC_ACC_AUDIO: "sub_electronica_accesorios_audio",
  ELEC_COMPONENTES: "sub_electronica_componentes",
  ELEC_DRONES: "sub_electronica_drones",
  ELEC_AUDIO_VEHICULOS: "sub_electronica_audio_vehiculos",
  ELEC_TELEVISORES: "sub_electronica_televisores",
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  [CAT.CELULARES]: "Celulares y Teléfonos",
  [CAT.CAMARAS]: "Cámaras y Accesorios",
  [CAT.CONSOLAS]: "Consolas y Videojuegos",
  [CAT.COMPUTACION]: "Computación",
  [CAT.ELECTRONICA]: "Electrónica, Audio y Video",
};

const SUBCATEGORY_LABELS: Record<string, string> = {
  [SUB.CEL_SMARTPHONES]: "Celulares y Smartphones",
  [SUB.CEL_ACCESORIOS]: "Accesorios para Celulares",
  [SUB.CEL_REPUESTOS]: "Repuestos de Celulares",
  [SUB.CAM_DIGITALES]: "Cámaras Digitales",
  [SUB.CAM_ACCESORIOS]: "Accesorios para Cámaras",
  [SUB.CAM_FILMADORAS]: "Filmadoras y Cámaras de Acción",
  [SUB.CON_VIDEOJUEGOS]: "Video Juegos",
  [SUB.CON_PLAYSTATION]: "Para PlayStation",
  [SUB.CON_NINTENDO]: "Para Nintendo",
  [SUB.COMP_COMPONENTES]: "Componentes de PC",
  [SUB.COMP_IMPRESION]: "Impresión",
  [SUB.COMP_TABLETS]: "Tablets y Accesorios",
  [SUB.COMP_PC]: "PC",
  [SUB.COMP_CONECTIVIDAD]: "Conectividad y Redes",
  [SUB.COMP_MONITORES]: "Monitores y Accesorios",
  [SUB.COMP_ALMACENAMIENTO]: "Almacenamiento",
  [SUB.COMP_MEMORIAS]: "Memorias",
  [SUB.COMP_CABLES]: "Cables",
  [SUB.COMP_ENERGIA]: "Fuentes y Estabilizadores",
  [SUB.ELEC_AUDIO]: "Audio",
  [SUB.ELEC_ACC_AUDIO]: "Accesorios para Audio y Video",
  [SUB.ELEC_COMPONENTES]: "Componentes Electrónicos",
  [SUB.ELEC_DRONES]: "Drones y Accesorios",
  [SUB.ELEC_AUDIO_VEHICULOS]: "Audio para Vehículos",
  [SUB.ELEC_TELEVISORES]: "Televisores",
};

// Build the categories text for the prompt
const CATEGORIES_TEXT = Object.entries(CATEGORY_LABELS)
  .map(([catId, catName]) => {
    const subs = Object.entries(SUBCATEGORY_LABELS)
      .filter(([subId]) => subId.startsWith(catId.split("_")[1]))
      .map(([, subName]) => `  - ${subName}`)
      .join("\n");
    return `${catName}:\n${subs}`;
  })
  .join("\n\n");

interface AiClassificationResponse {
  category_id: string;
  subcategory_name: string;
}

const SYSTEM_PROMPT = `Sos un experto en clasificación de productos de tecnología para una tienda argentina. Tu trabajo es asignar productos a la categoría y subcategoría correcta.

Categorías disponibles:
${CATEGORIES_TEXT}

Reglas:
1. Analizá el título y descripción del producto
2. Considerá la categoría original de ELIT como hint
3. Asigná la categoría y subcategoría más específica posible
4. Si el producto es ambiguo, elegí la categoría más probable para una tienda de tecnología
5. Respondé SOLO con JSON válido, sin texto adicional

Formato de respuesta:
{"category_id":"cat_xxx","subcategory_name":"sub_xxx"}`;

// Rate limiter: max AI calls per sync batch
const MAX_AI_CALLS_PER_SYNC = 50;
let aiCallsThisSync = 0;

/**
 * Resets the AI call counter (call at start of each sync batch)
 */
export function resetAiCallCounter(): void {
  aiCallsThisSync = 0;
}

/**
 * Returns how many AI calls have been made this sync
 */
export function getAiCallCount(): number {
  return aiCallsThisSync;
}

/**
 * Classifies a product using Workers AI
 * Returns null if rate limited or on error
 */
export async function classifyWithAI(
  env: { AI: Ai },
  title: string,
  description: string,
  elitCategory: string,
  elitSubcategory: string,
): Promise<CategoryMapping | null> {
  // Rate limit check
  if (aiCallsThisSync >= MAX_AI_CALLS_PER_SYNC) {
    console.log(`[ai-classifier] Rate limit reached (${MAX_AI_CALLS_PER_SYNC}), skipping`);
    return null;
  }

  aiCallsThisSync++;

  try {
    const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Clasificá este producto:\n\nTítulo: ${title}\nDescripción: ${description}\nCategoría ELIT: ${elitCategory}\nSubcategoría ELIT: ${elitSubcategory}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });

    // Parse the response
    const text = response.response?.trim() ?? "";
    const jsonMatch = text.match(/\{[^}]+\}/);

    if (!jsonMatch) {
      console.log(`[ai-classifier] No JSON in response for "${title}"`);
      return null;
    }

    const parsed: AiClassificationResponse = JSON.parse(jsonMatch[0]);

    // Validate that the returned IDs exist in our taxonomy
    if (!CATEGORY_LABELS[parsed.category_id] || !SUBCATEGORY_LABELS[parsed.subcategory_name]) {
      console.log(`[ai-classifier] Invalid IDs for "${title}":`, parsed);
      return null;
    }

    return {
      category_id: parsed.category_id,
      subcategory_name: parsed.subcategory_name,
    };
  } catch (err) {
    console.error(`[ai-classifier] Error classifying "${title}":`, err);
    return null;
  }
}

// ============================================================
// CONTRATOS NÚCLEO — traducción a código de docs 08 §0 y 09
// Capa 1 (mecánicas) y Capa 2 (juego) se comunican SOLO por estos tipos.
// ============================================================

// ---------- Materia prima (subconjunto capas 1 y 3, doc 06) ----------

export interface Repertoire {
  repertoire_id: string;
  nombre: string;
  /** La intuición cotidiana que encarna, en palabras del estudiante típico */
  enunciado: string;
}

export interface Concept {
  concept_id: string;
  label: string;
  definicion_formal: string;
  definicion_intuitiva: string;
  sinonimos: string[];
  /** Enunciado correcto y uno incorrecto-pero-plausible, para B1 DISTINGUIR */
  enunciado_correcto: string;
  enunciado_incorrecto: string;
  /** Distractor caracterizado: concepto-señuelo que encarna un repertorio (capa 3) */
  distractor_caracterizado?: {
    label: string;
    repertoire_id: string;
  };
  /** Fragmento del corpus con '____' como blank (para A2 COMPLETAR) */
  fragmento?: string;
}

export interface Caso {
  case_id: string;
  texto: string;
  concepto_correcto: string; // concept_id
}

export interface Relacion {
  relation_id: string;
  origen: string; // concept_id
  destino: string; // concept_id
  tipo: string;
  enunciado: string; // la relación expresada como enunciado verificable
}

export interface MateriaPrima {
  course_id: string;
  course_nombre: string;
  concepts: Concept[];
  repertoires: Repertoire[];
  casos: Caso[]; // capa 5
  relaciones: Relacion[]; // capa 2
}

// ---------- MechanicOutput universal (doc 08 §0) ----------

export type MechanicStatus = 'completed' | 'abandoned' | 'partial' | 'timeout';

export interface CognitiveSignal {
  dimension:
    | 'recuperacion'
    | 'relacion'
    | 'transferencia'
    | 'anclaje'
    | 'srl_planeacion'
    | 'srl_accion'
    | 'srl_calibracion'
    | 'srl_autorreflexion';
  target: string; // concept_id | repertoire_id
  delta: number;
  confidence: number;
}

export interface MechanicOutput {
  // Identidad
  mechanic_id: string;
  mechanic_version: string;
  instance_id: string;
  composition_id: string;
  step_index: number;

  // Contexto temporal
  student_id: string;
  session_id: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  status: MechanicStatus;

  // Contenido tocado
  concepts_involved: string[];
  relations_involved: string[];
  cases_involved: string[];
  repertoires_activated: string[];

  // Performance
  is_correct: boolean | null;
  partial_score: number; // 0.0 - 1.0

  // Señal para el perfil cognitivo
  cognitive_signals: CognitiveSignal[];

  // Payload propio de cada mecánica
  mechanic_specific: Record<string, unknown>;
}

// ---------- Ítems (doc 09 §3) ----------

export type ItemId = 'botas' | 'amuleto' | 'lupa';

export interface ItemDef {
  item_id: ItemId;
  nombre: string;
  descripcion: string;
  tipo: 'pasivo' | 'consumible';
  icono: string; // emoji/glifo en v0.1; sprite en la skin futura
}

export interface ItemInstance {
  item_id: ItemId;
  usado: boolean;
}

// ---------- Mapa y salas (doc 09 §2) ----------

export type RoomKind = 'encounter' | 'branch' | 'treasure' | 'devil_deal' | 'boss';

/** Cómo se presenta la mecánica (Capa 3): tarjetas clásicas o arena de acción.
 *  Regla de integridad de señal: en arena, la habilidad (puntería, timing)
 *  modula la RECOMPENSA; el conocimiento (la intención) decide is_correct. */
export type InteractionMode = 'cards' | 'arena';

/** Configuración de una run elegida en el menú (o por sorteo — decisión Y) */
export interface RunConfig {
  mechanic_ids: string[];
  j1: boolean; // cronómetro en encuentros
  g1: boolean; // sala de tratos (apuestas)
  interaction: 'clasico' | 'arena' | 'mixto';
  seed?: number;
}

export interface MechanicConfig {
  n_opciones?: number;
  tiempo_limite_ms?: number | null;
  permitir_segunda_oportunidad?: boolean;
  mostrar_distractor_caracterizado_tras_error?: boolean;
  n_intentos_max?: number;
  [k: string]: unknown;
}

export interface RoomNode {
  room_index: number;
  kind: RoomKind;
  /** null solo para treasure */
  mechanic_id: string | null;
  interaction: InteractionMode;
  mechanic_config: MechanicConfig;
  concept_ids: string[];
  /** modificadores activos: 'J1' cronómetro, 'G1' apuesta previa */
  modifiers: string[];
  /** solo kind='branch': dos caminos de UNA sala cada uno en v0.1 */
  branch_options: RoomNode[] | null;
  reward_coins: number;
  /** ítem contenido, solo kind='treasure' */
  item_id?: ItemId;
  /** etiqueta narrativa que muestra la skin */
  label: string;
}

// ---------- RunState (doc 09 §1) ----------

export type RunStatus = 'active' | 'won' | 'game_over' | 'abandoned';

export interface RunState {
  run_id: string;
  student_id: string;
  course_id: string;
  seed: number;
  status: RunStatus;

  hearts: number;
  max_hearts: number;
  coins: number;

  streak: number;
  best_streak: number;

  items: ItemInstance[];

  map: RoomNode[];
  current_room: number;

  outputs: MechanicOutput[];
  started_at: string;
}

// ---------- EventSink (doc 09 §5) ----------

export interface EventSink {
  emit(output: MechanicOutput): Promise<void>;
}

// ---------- Contrato de props de toda mecánica (Capa 1) ----------
// Una mecánica NO conoce RunState. Recibe config + materia prima y
// devuelve su MechanicOutput parcial (el runner completa identidad/contexto).

export type MechanicResult = Pick<
  MechanicOutput,
  | 'status'
  | 'is_correct'
  | 'partial_score'
  | 'concepts_involved'
  | 'repertoires_activated'
  | 'cognitive_signals'
  | 'mechanic_specific'
>;

export interface MechanicProps {
  config: MechanicConfig;
  concepts: Concept[]; // materia prima ya seleccionada para esta instancia
  allConcepts: Concept[]; // universo del curso (para distractores)
  casos: Caso[]; // capa 5 del curso
  relaciones: Relacion[]; // capa 2 del curso
  rng: () => number; // RNG sembrado — la mecánica no usa Math.random
  /** Ayudas activas otorgadas por ítems (capa 2 → capa 1 vía parámetros) */
  lupaDisponible?: boolean;
  onUseLupa?: () => void;
  onComplete: (result: MechanicResult) => void;
}

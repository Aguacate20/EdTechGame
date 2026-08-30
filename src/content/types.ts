/** Tipos normalizados. El adaptador traduce el bundle del extractor a estas formas;
 *  el motor del juego NO conoce el JSON crudo. */

export type Familia = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'
export type MecanicaId = 'A1' | 'A3' | 'B1' | 'B2' | 'C1' | 'E1' | 'E2' | 'E3'
export type Carga = 'memorizar' | 'discriminar' | 'inferir' | 'integrar'
export type Distancia = 'cercana' | 'media' | 'lejana'

export interface Subdimension { nombre: string; descripcion: string }

export interface Concepto {
  id: string
  titulo: string
  definicion: string
  definicionCorta: string
  tipo: string
  unidadId: string
  clusterId: string | null
  importancia: number
  dificultad: number
  esPuerta: boolean
  esUmbral: boolean
  nEfectivo: number
  nOpciones: number
  nDistractores: number
  cargaCognitiva: Carga[]
  familias: string[]
  sinonimos: string[]
  subdimensiones: Subdimension[]
  tensiones: string[]
  paginas: number[]
}

export interface Arista {
  from: string
  to: string
  tipo: string
  descripcion: string
}

export interface Repertorio {
  id: string
  conceptId: string
  etiqueta: string
  descripcion: string
  ejemplo: string
  contrasteCientifico: string
  contextoDondeFunciona: string
  conceptoConfundido: string | null
}

export interface Caso {
  id: string
  descripcion: string
  conceptIds: string[]
  conceptoPrincipal: string | null
  dominio: string
  resolucionEsperada: string
  variablesClave: string[]
  prediccionHabilitada: boolean
}

export interface Escenario {
  id: string
  descripcion: string
  conceptIds: string[]
  distancia: Distancia
  dominio: string
  resolucionEsperada: string
  errorEmbebido: string | null
}

export interface Tesis {
  id: string
  enunciado: string
  conceptIds: string[]
  marcoId: string | null
  argumentosApoyo: string[]
  contraargumentos: string[]
  criteriosDefensa: string[]
  criteriosRefutacion: string[]
}

export interface Marco {
  id: string
  etiqueta: string
  conceptIds: string[]
  principios: string[]
  rivales: string[]
}

export interface Eje {
  id: string
  nombre: string
  provisional: boolean
  /** valor por concepto: número normalizado 0..1 o etiqueta */
  valores: Record<string, string | number>
}

export interface Unidad {
  id: string
  numero: number
  titulo: string
  conceptIds: string[]
  dificultadObjetivo: number
  nOpcionesSugerido: number
  andamiaje: string
  tienePuerta: boolean
  tieneUmbral: boolean
}

/** Un ítem crudo ya tipado. Se conserva casi tal cual: la corrección vive aquí. */
export interface ItemA1 {
  id: string; mecanica: 'A1'; conceptId: string; enunciado: string; dificultad: number
  opciones: { id: string; texto: string; esCorrecta: boolean; feedback: string; conceptoConfundido: string | null; repertoireId: string | null }[]
}
export interface ItemA3 {
  id: string; mecanica: 'A3'; conceptId: string; enunciado: string; dificultad: number
  respuestasAceptadas: string[]
}
export interface ItemB1 {
  id: string; mecanica: 'B1'; conceptId: string; enunciado: string; afirmacion: string
  dificultad: number; respuestaCorrecta: boolean; conceptoConfundido: string | null
  feedback: string; repertoireId: string | null
}
export interface ItemB2 {
  id: string; mecanica: 'B2'; enunciado: string; dificultad: number
  opciones: string[]; respuestaCorrecta: string; casoId: string | null
}
export interface ItemC1 {
  id: string; mecanica: 'C1'; par: [string, string]; enunciado: string; dificultad: number
  opciones: string[]; respuestaCorrecta: string; explicacion: string
}
export interface ItemE1 {
  id: string; mecanica: 'E1'; enunciado: string; dificultad: number; conceptIds: string[]
  variablesClave: string[]; resolucionEsperada: string; origenId: string | null
}
export interface ItemE3 {
  id: string; mecanica: 'E3'; enunciado: string; dificultad: number; conceptIds: string[]
  distancia: Distancia; resolucionEsperada: string; dominio: string
}

export type Item = ItemA1 | ItemA3 | ItemB1 | ItemB2 | ItemC1 | ItemE1 | ItemE3

/** Un distractor tal como lo emitió el extractor: el texto ya sabe con qué se
 *  confunde cada concepto, así que no hace falta inventarlo por vecindad. */
export interface Distractor {
  texto: string
  explicacion: string
  conceptoConfundido: string | null
  fuente: string
  repertorioId: string | null
}

export interface Diagnostico {
  clave: string
  estado: 'ok' | 'parcial' | 'ausente'
  detalle: string
}

export interface Contenido {
  /** pares que el texto hace aparecer juntos repetidamente (clave «a|b» ordenada) */
  coocurrencias: Set<string>
  /** puentes latentes del extractor: vínculos implícitos con su justificación textual */
  puentes: Record<string, string>
  fuente: string
  bundleVersion: string
  schema: string
  conceptos: Record<string, Concepto>
  ordenConceptos: string[]
  aristas: Arista[]
  frecuenciaRelacion: Record<string, number>
  unidades: Unidad[]
  clusters: { id: string; label: string; conceptIds: string[] }[]
  items: Record<MecanicaId, Item[]>
  repertorios: Repertorio[]
  casos: Caso[]
  escenarios: Escenario[]
  tesis: Tesis[]
  marcos: Marco[]
  ejes: Eje[]
  /** por concepto: con qué se confunde según el propio extractor */
  distractores: Record<string, Distractor[]>
  /** dominios de aplicación que aparecen en casos y escenarios */
  dominios: string[]
  condicionesDisponibles: string[]
  diagnostico: Diagnostico[]
}

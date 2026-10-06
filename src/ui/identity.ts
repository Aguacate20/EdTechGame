import type { Contenido } from '../content/types'
import type { Pieza } from '../engine/pieces'
import { hash } from '../engine/rng'

/* ==========================================================================
   La cédula visual.
   El contenido es infinito: un bundle nuevo por cada PDF. No se puede ilustrar
   concepto a concepto. Así que cada atributo gráfico se DERIVA de un campo del
   bundle, de forma determinista. El mismo concepto se ve siempre igual, y a los
   diez minutos el jugador reconoce de qué zona del texto viene una carta sin
   haber leído nada. El diseño de información hace el trabajo de la pedagogía.
   ========================================================================== */

export interface Cedula {
  /** matiz del papel, derivado del cluster: zonas del texto = familias de color */
  tono: string
  tonoBorde: string
  /** ornamento de esquina según el tipo epistémico del concepto */
  ornamento: string
  /** textura del papel según la causa de dificultad */
  textura: 'liso' | 'veteado' | 'rayado' | 'manchado'
  /** canto dorado para los conceptos umbral */
  canto: boolean
  /** grosor de la sombra según la importancia */
  elevacion: number
  /** ancho de la banda lateral según la clase de pieza */
  banda: string
}

/** Matices estables por cluster. Se reparten sobre la rueda evitando los
 *  extremos reservados: verdigrís (sostenido) y óxido (error). */
const MATICES = [96, 200, 268, 32, 172, 312, 224, 52, 140, 288]

const ORNAMENTO: Record<string, string> = {
  teorico: '❋',
  empirico: '⊞',
  metodologico: '⌗',
  aplicado: '◆',
  '': '·'
}

const TEXTURA: Record<string, Cedula['textura']> = {
  memorizar: 'liso',
  discriminar: 'rayado',
  inferir: 'veteado',
  integrar: 'manchado'
}

/** Un color por CLASE de pieza: es el lenguaje con el que se lee la mano.
 *  Regla de hierro: la apócrifa imita a la carta de concepto — si tuviera un
 *  color propio, se cazarían falsificaciones por la banda y la mecánica de
 *  discriminar moriría. */
export const BANDA: Record<Pieza['clase'], string> = {
  // v6.36 · un color por tipo de carta. Azul (nombre) + amarillo (descripción) = verde (idea)
  etiqueta: '#4f9be8',      // Nombre: azul
  definicion: '#e8c64f',    // Descripción: amarillo
  concepto: '#45b98a',      // Idea completa: verde
  apocrifa: '#45b98a',
  caso: '#f08a3c',          // Ejemplo: naranja
  tesis: '#e0564f',         // Afirmación: rojo
  criterio: '#f29bc1',      // Prueba: rosa
  marco: '#9b7fe8',         // Tema: morado
  intuicion: '#c85fb0',     // Creencia común: magenta
  contexto: '#b08a5a',      // Dónde aplica: café
  subdimension: '#3fc1c9'   // Parte: turquesa
}

export const NOMBRE_CLASE: Record<Pieza['clase'], string> = {
  etiqueta: 'Nombre', definicion: 'Descripción', concepto: 'Idea',
  apocrifa: 'Idea', caso: 'Ejemplo', tesis: 'Afirmación', criterio: 'Prueba',
  marco: 'Tema', intuicion: 'Creencia común', contexto: 'Dónde aplica', subdimension: 'Parte'
}

/** v6.36 · ¿estas dos cartas se pueden unir? Es la regla que pinta las franjas de
 *  compatibilidad: cada carta enseña los colores de las cartas con las que va. */
function vaCon(a: Pieza, b: Pieza): boolean {
  const idea = (p: Pieza) => p.clase === 'concepto' || p.clase === 'apocrifa'
  switch (a.clase) {
    case 'etiqueta': return (b.clase === 'definicion' && b.conceptId === a.conceptId) || (idea(b) && b.conceptId !== a.conceptId)
    case 'concepto': case 'apocrifa': return idea(b) && b.uid !== a.uid
    case 'caso': return idea(b) && (!a.conceptIds.length || (!!b.conceptId && a.conceptIds.includes(b.conceptId)))
    case 'tesis': return (b.clase === 'criterio' && b.tesisId === a.refId) || (idea(b) && !!b.conceptId && a.conceptIds.includes(b.conceptId))
    case 'marco': return idea(b) && !!b.conceptId && a.conceptIds.includes(b.conceptId)
    case 'intuicion': case 'contexto': return idea(b)
    case 'subdimension': return idea(b) && b.conceptId === a.conceptId
    default: return false
  }
}
export function coloresCompatibles(p: Pieza, todas: Pieza[]): string[] {
  const out: string[] = []
  for (const q of todas) {
    if (q.uid === p.uid) continue
    if ((vaCon(p, q) || vaCon(q, p)) && !out.includes(BANDA[q.clase])) out.push(BANDA[q.clase])
  }
  return out
}

export function cedulaDe(c: Contenido, p: Pieza): Cedula {
  const concepto = p.conceptId ? c.conceptos[p.conceptId] : null

  // el cluster decide el matiz: todas las piezas de una zona del texto riman
  const idxCluster = concepto?.clusterId
    ? c.clusters.findIndex((x) => x.id === concepto.clusterId)
    : -1
  const matiz = idxCluster >= 0
    ? MATICES[idxCluster % MATICES.length]
    : MATICES[hash(p.refId ?? p.clase) % MATICES.length]

  const carga = concepto?.cargaCognitiva[0] ?? ''
  const importancia = concepto?.importancia ?? 0.5

  return {
    tono: `hsl(${matiz} 22% 91%)`,
    tonoBorde: `hsl(${matiz} 20% 78%)`,
    ornamento: ORNAMENTO[concepto?.tipo ?? ''] ?? ORNAMENTO[''],
    textura: TEXTURA[carga] ?? 'liso',
    canto: !!concepto?.esUmbral,
    elevacion: Math.round(6 + importancia * 12),
    banda: BANDA[p.clase]
  }
}

export function estiloDeCedula(cd: Cedula): React.CSSProperties {
  return {
    background: cd.tono,
    borderColor: cd.tonoBorde,
    boxShadow: `0 1px 0 rgba(255,255,255,.5) inset, 0 ${Math.round(cd.elevacion / 2)}px ${cd.elevacion}px rgba(0,0,0,.34)`
  }
}

/* ==========================================================================
   Los ocho tratamientos de línea: el vocabulario visual central del juego.
   Cada tipo de relación se dibuja distinto, así que se aprenden mirando.
   ========================================================================== */

export interface TrazoRelacion {
  dash: string | undefined
  ancho: number
  /** una segunda línea paralela, para los tipos "dobles" */
  doble: boolean
  /** onda en vez de recta */
  ondulada: boolean
  punta: 'flecha' | 'barra' | 'ninguna' | 'doble'
}

export const ESTILO_RELACION: Record<string, TrazoRelacion> = {
  apoya:       { dash: undefined, ancho: 2.2, doble: false, ondulada: false, punta: 'flecha' },
  causa:       { dash: undefined, ancho: 3.2, doble: false, ondulada: false, punta: 'flecha' },
  requiere:    { dash: '10 4',    ancho: 3,   doble: false, ondulada: false, punta: 'barra' },
  contrasta:   { dash: undefined, ancho: 2.4, doble: true,  ondulada: false, punta: 'doble' },
  generaliza:  { dash: undefined, ancho: 2.4, doble: false, ondulada: false, punta: 'barra' },
  ejemplifica: { dash: '3 4',     ancho: 2.2, doble: false, ondulada: false, punta: 'flecha' },
  extiende:    { dash: '14 3 3 3', ancho: 2.2, doble: false, ondulada: false, punta: 'flecha' },
  matiza:      { dash: undefined, ancho: 1.8, doble: false, ondulada: true,  punta: 'flecha' }
}

export const estiloRelacion = (tipo: string | null): TrazoRelacion =>
  (tipo && ESTILO_RELACION[tipo]) || ESTILO_RELACION.apoya

/** Camino ondulado entre dos puntos, para `matiza`. */
export function ondaEntre(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const ondas = 4
  let d = `M${x1} ${y1}`
  for (let i = 1; i <= ondas; i++) {
    const t0 = (i - 0.5) / ondas
    const t1 = i / ondas
    const amp = (i % 2 ? 1 : -1) * 2.4
    d += ` Q${x1 + dx * t0 + nx * amp} ${y1 + dy * t0 + ny * amp} ${x1 + dx * t1} ${y1 + dy * t1}`
  }
  return d
}

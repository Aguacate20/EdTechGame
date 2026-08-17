import type { Contenido } from '../content/types'
import type { Rng } from './rng'

/* ==========================================================================
   Una sola forma de carta con ROLES.
   El tipo no encierra a la carta: un criterio de una tesis puede usarse como
   nodo suelto, y un marco puede usarse como campo. La flexibilidad no viene
   de tener muchos tipos, viene de que cada pieza declare qué papeles admite.
   ========================================================================== */

export type Rol =
  | 'nodo'        // puede estar en la punta de una flecha
  | 'etiqueta'    // es el nombre de algo
  | 'definicion'  // es la descripción de algo
  | 'caso'        // puede anclar un caso
  | 'tesis'       // puede ir en la balanza
  | 'criterio'    // puede ser el contrapeso de una balanza
  | 'campo'       // puede declarar un campo semántico entero
  | 'atributo'    // puede colocarse en un eje

export type ClasePieza =
  | 'etiqueta' | 'definicion' | 'concepto' | 'apocrifa'
  | 'caso' | 'tesis' | 'criterio' | 'marco' | 'intuicion' | 'subdimension'

export interface Pieza {
  uid: string
  clase: ClasePieza
  roles: Rol[]
  titulo: string
  cuerpo: string
  /** a qué concepto del grafo se refiere (etiqueta, definición, concepto, apócrifa) */
  conceptId: string | null
  /** id de caso, tesis, marco o repertorio */
  refId: string | null
  conceptIds: string[]
  conceptIdsRivales: string[]
  distancia: 'cercana' | 'media' | 'lejana' | null
  umbral: boolean
  importancia: number
  /** en una apócrifa, de quién es realmente esa definición */
  duenoReal: string | null
  explicacion: string
  cierre: string
  /** para criterios: a qué tesis pertenecen y si refutan o defienden */
  tesisId: string | null
  sentido: 'refuta' | 'defiende' | null
  sinonimos: string[]
}

let n = 0
const uid = (p: string) => `${p}${(n++).toString(36)}`

const base = (): Pieza => ({
  uid: uid('p'), clase: 'concepto', roles: ['nodo'], titulo: '', cuerpo: '',
  conceptId: null, refId: null, conceptIds: [], conceptIdsRivales: [],
  distancia: null, umbral: false, importancia: 0.5, duenoReal: null,
  explicacion: '', cierre: '', tesisId: null, sentido: null, sinonimos: []
})

/* ------------------------------ fábricas --------------------------------- */

/** El título y la definición viajan en cartas separadas. Emparejarlas es la
 *  jugada más sencilla del juego y la puerta de entrada para el novato. */
export function piezaEtiqueta(c: Contenido, conceptId: string): Pieza | null {
  const k = c.conceptos[conceptId]
  if (!k) return null
  return {
    ...base(), clase: 'etiqueta', roles: ['nodo', 'etiqueta'],
    titulo: k.titulo, cuerpo: '', conceptId,
    umbral: k.esUmbral, importancia: k.importancia, sinonimos: k.sinonimos
  }
}

export function piezaDefinicion(c: Contenido, conceptId: string): Pieza | null {
  const k = c.conceptos[conceptId]
  if (!k) return null
  return {
    ...base(), clase: 'definicion', roles: ['nodo', 'definicion'],
    titulo: 'Definición sin dueño', cuerpo: k.definicionCorta, conceptId,
    umbral: k.esUmbral, importancia: k.importancia
  }
}

/** Un concepto fusionado: el resultado de haber emparejado bien título y
 *  definición. Vale más y ocupa un solo hueco: el mazo mejora al aprender. */
export function piezaConcepto(c: Contenido, conceptId: string): Pieza | null {
  const k = c.conceptos[conceptId]
  if (!k) return null
  return {
    ...base(), clase: 'concepto', roles: ['nodo', 'etiqueta', 'definicion'],
    titulo: k.titulo, cuerpo: k.definicionCorta, conceptId,
    umbral: k.esUmbral, importancia: k.importancia, sinonimos: k.sinonimos
  }
}

/** Apócrifa: el título de uno con la definición de otro. Sale del propio grafo. */
export function piezaApocrifa(c: Contenido, conceptId: string, rng: Rng): Pieza | null {
  const k = c.conceptos[conceptId]
  if (!k) return null
  const vecinos = c.aristas
    .filter((a) => a.from === conceptId || a.to === conceptId)
    .map((a) => (a.from === conceptId ? a.to : a.from))
    .map((id) => c.conceptos[id])
    .filter((x): x is NonNullable<typeof x> => !!x && x.id !== conceptId && !!x.definicionCorta)
  const otros = Object.values(c.conceptos).filter(
    (x) => x.id !== conceptId && x.definicionCorta && x.definicionCorta !== k.definicionCorta
  )
  const pool = vecinos.length ? vecinos : otros
  if (!pool.length) return null
  const impostor = rng.pick(pool)
  return {
    ...base(), clase: 'apocrifa', roles: ['nodo', 'etiqueta', 'definicion'],
    titulo: k.titulo, cuerpo: impostor.definicionCorta, conceptId,
    umbral: k.esUmbral, importancia: k.importancia,
    duenoReal: impostor.id,
    explicacion: `Esa definición es de «${impostor.titulo}». ${k.titulo} es en realidad: ${k.definicionCorta}`
  }
}

export function piezaCaso(c: Contenido, id: string): Pieza | null {
  const k = c.casos.find((x) => x.id === id)
  if (k) {
    return {
      ...base(), clase: 'caso', roles: ['nodo', 'caso'],
      titulo: k.dominio || 'Caso', cuerpo: k.descripcion, refId: k.id,
      conceptIds: k.conceptIds, distancia: 'cercana', cierre: k.resolucionEsperada
    }
  }
  const e = c.escenarios.find((x) => x.id === id)
  if (!e) return null
  return {
    ...base(), clase: 'caso', roles: ['nodo', 'caso'],
    titulo: e.dominio || 'Escenario', cuerpo: e.descripcion, refId: e.id,
    conceptIds: e.conceptIds, distancia: e.distancia, cierre: e.resolucionEsperada
  }
}

export function piezaTesis(c: Contenido, id: string): Pieza | null {
  const t = c.tesis.find((x) => x.id === id)
  if (!t) return null
  const marco = t.marcoId ? c.marcos.find((m) => m.id === t.marcoId) : undefined
  const rivales = (marco?.rivales ?? [])
    .flatMap((rid) => c.marcos.find((m) => m.id === rid)?.conceptIds ?? [])
    .filter((cid) => c.conceptos[cid] && !t.conceptIds.includes(cid))
  return {
    ...base(), clase: 'tesis', roles: ['nodo', 'tesis'],
    titulo: 'Tesis', cuerpo: t.enunciado, refId: t.id,
    conceptIds: t.conceptIds, conceptIdsRivales: [...new Set(rivales)],
    cierre: t.criteriosDefensa[0] ?? ''
  }
}

/** Los criterios de refutación y los contraargumentos, como cartas jugables.
 *  Un criterio válido es contrapeso; un contraargumento suena bien y no lo es. */
export function piezasCriterio(c: Contenido, tesisId: string, rng: Rng): Pieza[] {
  const t = c.tesis.find((x) => x.id === tesisId)
  if (!t) return []
  const validos = rng.sample(t.criteriosRefutacion, 2).map((texto) => ({
    ...base(), clase: 'criterio' as ClasePieza, roles: ['nodo', 'criterio'] as Rol[],
    titulo: 'Criterio', cuerpo: texto, refId: t.id, tesisId: t.id,
    sentido: 'refuta' as const, cierre: ''
  }))
  const falsos = rng.sample(t.contraargumentos, 1).map((texto) => ({
    ...base(), clase: 'criterio' as ClasePieza, roles: ['nodo', 'criterio'] as Rol[],
    titulo: 'Objeción', cuerpo: texto, refId: t.id, tesisId: t.id,
    sentido: null,
    explicacion: 'Suena razonable, pero no dice qué observación obligaría a revisar la tesis: no es un criterio de refutación.'
  }))
  return [...validos, ...falsos]
}

export function piezaMarco(c: Contenido, id: string): Pieza | null {
  const m = c.marcos.find((x) => x.id === id)
  if (!m) return null
  return {
    ...base(), clase: 'marco', roles: ['nodo', 'campo'],
    titulo: m.etiqueta, cuerpo: m.principios[0] ?? '', refId: m.id,
    conceptIds: m.conceptIds,
    conceptIdsRivales: m.rivales.flatMap((r) => c.marcos.find((x) => x.id === r)?.conceptIds ?? [])
  }
}

export function piezaIntuicion(c: Contenido, id: string): Pieza | null {
  const r = c.repertorios.find((x) => x.id === id)
  if (!r) return null
  return {
    ...base(), clase: 'intuicion', roles: ['nodo'],
    titulo: r.etiqueta, cuerpo: r.ejemplo, refId: r.id, conceptId: r.conceptId,
    explicacion: r.contrasteCientifico, cierre: r.contextoDondeFunciona
  }
}

/** Las subdimensiones del bundle, que hoy nadie usa, se vuelven atributos
 *  colocables en un eje. */
export function piezasSubdimension(c: Contenido, conceptId: string): Pieza[] {
  const k = c.conceptos[conceptId]
  if (!k) return []
  return k.subdimensiones.map((s) => ({
    ...base(), clase: 'subdimension' as ClasePieza, roles: ['nodo', 'atributo'] as Rol[],
    titulo: s.nombre, cuerpo: s.descripcion, conceptId
  }))
}

export const tienRol = (p: Pieza, r: Rol): boolean => p.roles.includes(r)

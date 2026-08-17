import type {
  Contenido, Distancia, Familia, Item, ItemA1, ItemA3, ItemB1, ItemB2, ItemC1, ItemE1, ItemE3,
  MecanicaId, Repertorio
} from '../content/types'
import { FAMILIA_DE_MECANICA } from './cards'
import { Rng } from './rng'

/* --------------------------------- tipos ---------------------------------- */

export interface OpcionEmbate {
  id: string
  texto: string
  correcta: boolean
  /** por qué esa respuesta era razonable y qué criterio la separa */
  feedback: string
  conceptId: string | null
  repertoireId: string | null
}

export interface Embate {
  itemId: string
  mecanica: MecanicaId
  familia: Familia
  titulo: string
  enunciado: string
  contexto: string | null
  opciones: OpcionEmbate[]
  multi: boolean
  /** cuántas correctas hay cuando multi = true */
  nCorrectas: number
  conceptIds: string[]
  conceptoObjetivo: string | null
  dificultad: number
  peso: number
  tipoRelacion: string | null
  distancia: Distancia | null
  repertorioTocado: string | null
  cierre: string | null
  aristaRevelada: { from: string; to: string; tipo: string } | null
}

export type ArquetipoId =
  | 'vacio' | 'confuso' | 'espejo' | 'eco' | 'enjambre'
  | 'caso' | 'arquitecto' | 'marco'

export interface Arquetipo {
  id: ArquetipoId
  nombre: string
  lema: string
  descripcion: string
  mecanicas: MecanicaId[]
  vidaBase: number
  rango: 'comun' | 'elite' | 'jefe'
}

export const ARQUETIPOS: Record<ArquetipoId, Arquetipo> = {
  vacio: {
    id: 'vacio', nombre: 'El Vacío', lema: 'Una definición sin dueño',
    descripcion: 'Muestra una descripción y borra el nombre. Se estabiliza recuperando el concepto.',
    mecanicas: ['A1', 'A3'], vidaBase: 26, rango: 'comun'
  },
  confuso: {
    id: 'confuso', nombre: 'El Confuso', lema: 'Atribuye lo que no le toca',
    descripcion: 'Cuelga una afirmación del concepto equivocado. Se estabiliza devolviéndola a su dueño.',
    mecanicas: ['B1'], vidaBase: 30, rango: 'comun'
  },
  espejo: {
    id: 'espejo', nombre: 'El Espejo', lema: 'Dos ideas y un puente sin nombre',
    descripcion: 'Presenta un par dirigido. Se estabiliza nombrando el vínculo que va de una a otra.',
    mecanicas: ['C1'], vidaBase: 34, rango: 'comun'
  },
  eco: {
    id: 'eco', nombre: 'El Eco', lema: 'Una intuición fuera de su contexto',
    descripcion: 'Repite un razonamiento que sí funciona en otro lado. No se derrota: se estabiliza mostrando su límite.',
    mecanicas: ['A1', 'B1'], vidaBase: 28, rango: 'comun'
  },
  enjambre: {
    id: 'enjambre', nombre: 'El Enjambre', lema: 'Muchas rutas plausibles',
    descripcion: 'Multiplica opciones creíbles. Solo cede ante una distinción real, no ante el descarte.',
    mecanicas: ['A1', 'B1'], vidaBase: 30, rango: 'comun'
  },
  caso: {
    id: 'caso', nombre: 'El Caso', lema: 'La misma estructura, otra superficie',
    descripcion: 'Trae una situación de otro dominio. Se estabiliza aplicando los conceptos que sí operan ahí.',
    mecanicas: ['B2', 'E3', 'E1'], vidaBase: 44, rango: 'elite'
  },
  arquitecto: {
    id: 'arquitecto', nombre: 'El Arquitecto', lema: 'Ordena o serás ordenado',
    descripcion: 'Exige colocar conceptos sobre los ejes del dominio. Requiere ejes legibles en el bundle.',
    mecanicas: ['B2'], vidaBase: 40, rango: 'elite'
  },
  marco: {
    id: 'marco', nombre: 'El Marco', lema: 'Toda tesis se defiende desde algún lugar',
    descripcion: 'Defiende una tesis desde un marco rival. Se vence eligiendo la refutación que cumple la rúbrica.',
    mecanicas: ['C1'], vidaBase: 62, rango: 'jefe'
  }
}

/** Qué familias de verbo puede exigir un arquetipo. Se muestra en el escenario:
 *  reduce niebla de interfaz, no de contenido, y hace planificable la elección de objetivo. */
export function familiasDeArquetipo(id: ArquetipoId): Familia[] {
  return [...new Set(ARQUETIPOS[id].mecanicas.map((m) => FAMILIA_DE_MECANICA[m]))]
}

export const CONDICIONES = [
  { id: 'cadena', nombre: 'Cadena', regla: 'Cada embate parte del concepto donde terminó el anterior.' },
  { id: 'umbral', nombre: 'Umbral', regla: 'Solo aparecen embates que tocan un concepto umbral.' },
  { id: 'enjambre', nombre: 'Enjambre', regla: 'Los embates traen todas las opciones plausibles que el texto sostiene.' },
  { id: 'monocultivo', nombre: 'Monocultivo', regla: 'Un solo tipo de relación puntúa este combate.' },
  { id: 'eco_de_intuicion', nombre: 'Eco de intuición', regla: 'Entre las opciones se cuela una intuición razonable pero fuera de contexto.' },
  { id: 'marco_rival', nombre: 'Marco rival', regla: 'Un marco teórico rival comenta cada fallo. Los errores cuestan más.' },
  { id: 'portal_por_distancia', nombre: 'Portal', regla: 'Los casos vienen de dominios lejanos.' },
  { id: 'niebla', nombre: 'Niebla', regla: 'La dificultad del embate queda oculta hasta resolver.' },
  { id: 'mano_corta', nombre: 'Mano corta', regla: 'Robas una carta menos por turno.' }
] as const

export type CondicionId = (typeof CONDICIONES)[number]['id']
export const condicionPorId = (id: CondicionId) => CONDICIONES.find((c) => c.id === id)!

/** La causa de dificultad del concepto elige la condición: la carga cognitiva se vuelve mecánica. */
export const CONDICION_POR_CARGA: Record<string, CondicionId> = {
  memorizar: 'mano_corta',
  discriminar: 'enjambre',
  inferir: 'niebla',
  integrar: 'cadena'
}

/* ------------------------------ construcción ------------------------------ */

export interface OpcionesEmbate {
  rng: Rng
  contenido: Contenido
  condicion?: CondicionId | null
  /** para la condición cadena */
  conceptoAnterior?: string | null
}

const pesoDe = (c: Contenido, id: string | null): number =>
  id && c.conceptos[id] ? 0.35 + c.conceptos[id].importancia : 0.85

function titulo(c: Contenido, id: string): string {
  return c.conceptos[id]?.titulo ?? id
}

/** Baraja las opciones y desacopla la clave del orden. */
function barajar(rng: Rng, ops: OpcionEmbate[]): OpcionEmbate[] {
  return rng.shuffle(ops)
}

function distractoresRepertorio(
  contenido: Contenido, rng: Rng, conceptId: string, n: number
): OpcionEmbate[] {
  const reps = contenido.repertorios.filter((r) => r.conceptId === conceptId)
  const otros = contenido.repertorios.filter((r) => r.conceptId !== conceptId)
  const elegidos = [...reps, ...rng.shuffle(otros)].slice(0, n)
  return elegidos.map((r: Repertorio) => ({
    id: `rep_${r.id}`,
    texto: r.ejemplo,
    correcta: false,
    feedback: `${r.contrasteCientifico} Donde sí funciona: ${r.contextoDondeFunciona}`,
    conceptId: r.conceptoConfundido,
    repertoireId: r.id
  }))
}

export function construirEmbate(item: Item, o: OpcionesEmbate): Embate | null {
  switch (item.mecanica) {
    case 'A1': return deA1(item, o)
    case 'A3': return deA3(item, o)
    case 'B1': return deB1(item, o)
    case 'B2': return deB2(item, o)
    case 'C1': return deC1(item, o)
    case 'E1': return deE1(item, o)
    case 'E3': return deE3(item, o)
    default: return null
  }
}

function base(item: Item, o: OpcionesEmbate): Pick<Embate,
  'itemId' | 'mecanica' | 'familia' | 'dificultad' | 'multi' | 'nCorrectas' |
  'tipoRelacion' | 'distancia' | 'repertorioTocado' | 'cierre' | 'aristaRevelada' | 'contexto'> {
  void o
  return {
    itemId: item.id, mecanica: item.mecanica, familia: FAMILIA_DE_MECANICA[item.mecanica],
    dificultad: item.dificultad, multi: false, nCorrectas: 1,
    tipoRelacion: null, distancia: null, repertorioTocado: null,
    cierre: null, aristaRevelada: null, contexto: null
  }
}

function deA1(item: ItemA1, o: OpcionesEmbate): Embate {
  const { contenido, rng, condicion } = o
  const c = contenido.conceptos[item.conceptId]
  const tope = condicion === 'enjambre' ? c.nDistractores + 1 : c.nOpciones
  const correcta = item.opciones.find((x) => x.esCorrecta)!
  const malas = rng.shuffle(item.opciones.filter((x) => !x.esCorrecta)).slice(0, Math.max(1, tope - 1))
  let ops: OpcionEmbate[] = [correcta, ...malas].map((x) => ({
    id: x.id, texto: x.texto, correcta: x.esCorrecta,
    feedback: x.feedback, conceptId: x.conceptoConfundido, repertoireId: x.repertoireId
  }))
  if (condicion === 'eco_de_intuicion' && !ops.some((x) => x.repertoireId)) {
    ops = [...ops, ...distractoresRepertorio(contenido, rng, item.conceptId, 1)]
  }
  return {
    ...base(item, o),
    titulo: 'Recuperar',
    enunciado: item.enunciado || `¿Cuál corresponde a «${c.titulo}»?`,
    opciones: barajar(rng, ops),
    conceptIds: [item.conceptId],
    conceptoObjetivo: item.conceptId,
    peso: pesoDe(contenido, item.conceptId),
    repertorioTocado: ops.find((x) => x.repertoireId)?.repertoireId ?? null
  }
}

/** A3 se juega como reconocimiento de sinónimos: la respuesta libre exige juez. */
function deA3(item: ItemA3, o: OpcionesEmbate): Embate {
  const { contenido, rng } = o
  const c = contenido.conceptos[item.conceptId]
  const correcta: OpcionEmbate = {
    id: 'ok', texto: item.respuestasAceptadas[0], correcta: true,
    feedback: `Formas aceptadas: ${item.respuestasAceptadas.join(' · ')}`,
    conceptId: item.conceptId, repertoireId: null
  }
  const otros = rng
    .sample(Object.values(contenido.conceptos).filter((x) => x.id !== item.conceptId), Math.max(2, c.nOpciones - 1))
    .map((x) => ({
      id: `alt_${x.id}`, texto: x.sinonimos[0] ?? x.titulo, correcta: false,
      feedback: `Esa etiqueta nombra a «${x.titulo}»: ${x.definicionCorta}`,
      conceptId: x.id, repertoireId: null
    }))
  return {
    ...base(item, o),
    titulo: 'Evocar',
    enunciado: item.enunciado || '¿Qué concepto se define así?',
    opciones: barajar(rng, [correcta, ...otros]),
    conceptIds: [item.conceptId],
    conceptoObjetivo: item.conceptId,
    peso: pesoDe(contenido, item.conceptId)
  }
}

/** B1 como ATRIBUCIÓN, no como verdadero/falso: una moneda al aire no discrimina. */
function deB1(item: ItemB1, o: OpcionesEmbate): Embate {
  const { contenido, rng, condicion } = o
  const duenoReal = item.respuestaCorrecta ? item.conceptId : (item.conceptoConfundido as string)
  const c = contenido.conceptos[duenoReal] ?? contenido.conceptos[item.conceptId]
  const correcta: OpcionEmbate = {
    id: `ok_${duenoReal}`, texto: contenido.conceptos[duenoReal]?.titulo ?? duenoReal,
    correcta: true, feedback: item.feedback, conceptId: duenoReal, repertoireId: item.repertoireId
  }
  const vecinos = contenido.aristas
    .filter((a) => a.from === duenoReal || a.to === duenoReal)
    .map((a) => (a.from === duenoReal ? a.to : a.from))
  const candidatos = [
    ...(item.respuestaCorrecta ? [] : [item.conceptId]),
    ...rng.shuffle([...new Set(vecinos)])
  ].filter((x) => x !== duenoReal && contenido.conceptos[x])
  const tope = condicion === 'enjambre' ? 5 : Math.max(3, c?.nOpciones ?? 3)
  const malas: OpcionEmbate[] = [...new Set(candidatos)].slice(0, tope - 1).map((id) => ({
    id: `alt_${id}`, texto: contenido.conceptos[id].titulo, correcta: false,
    feedback: `«${contenido.conceptos[id].titulo}» es otra cosa: ${contenido.conceptos[id].definicionCorta}`,
    conceptId: id, repertoireId: null
  }))
  return {
    ...base(item, o),
    titulo: 'Atribuir',
    enunciado: '¿De qué concepto habla realmente esta afirmación?',
    contexto: item.afirmacion,
    opciones: barajar(rng, [correcta, ...malas]),
    conceptIds: [duenoReal],
    conceptoObjetivo: duenoReal,
    peso: pesoDe(contenido, duenoReal),
    repertorioTocado: item.repertoireId
  }
}

function deB2(item: ItemB2, o: OpcionesEmbate): Embate {
  const { contenido, rng } = o
  const ops: OpcionEmbate[] = item.opciones.map((id) => ({
    id: `c_${id}`,
    texto: contenido.conceptos[id]?.titulo ?? id,
    correcta: id === item.respuestaCorrecta,
    feedback: contenido.conceptos[id]?.definicionCorta ?? '',
    conceptId: id, repertoireId: null
  }))
  const caso = item.casoId ? contenido.casos.find((c) => c.id === item.casoId) : undefined
  return {
    ...base(item, o),
    titulo: 'Clasificar',
    enunciado: '¿Bajo qué concepto cae este caso?',
    contexto: item.enunciado,
    opciones: barajar(rng, ops),
    conceptIds: [item.respuestaCorrecta],
    conceptoObjetivo: item.respuestaCorrecta,
    peso: pesoDe(contenido, item.respuestaCorrecta),
    cierre: caso?.resolucionEsperada ?? null
  }
}

function deC1(item: ItemC1, o: OpcionesEmbate): Embate {
  const { contenido, rng, condicion } = o
  const [a, b] = item.par
  const ops: OpcionEmbate[] = item.opciones.map((t) => ({
    id: `r_${t}`, texto: t, correcta: t === item.respuestaCorrecta,
    feedback: t === item.respuestaCorrecta ? item.explicacion : GLOSA_RELACION[t] ?? '',
    conceptId: null, repertoireId: null
  }))
  const peso = (pesoDe(contenido, a) + pesoDe(contenido, b)) / 2
  return {
    ...base(item, o),
    titulo: 'Conectar',
    enunciado: `¿Qué vínculo va de «${titulo(contenido, a)}» hacia «${titulo(contenido, b)}»?`,
    contexto: condicion === 'niebla' ? null : `${contenido.conceptos[a]?.definicionCorta ?? ''}\n\n${contenido.conceptos[b]?.definicionCorta ?? ''}`,
    opciones: barajar(rng, ops),
    conceptIds: [a, b],
    conceptoObjetivo: b,
    peso,
    tipoRelacion: item.respuestaCorrecta,
    cierre: item.explicacion,
    aristaRevelada: { from: a, to: b, tipo: item.respuestaCorrecta }
  }
}

function deE1(item: ItemE1, o: OpcionesEmbate): Embate {
  const { contenido, rng } = o
  const otras = contenido.items.E1
    .filter((x): x is ItemE1 => x.mecanica === 'E1' && x.id !== item.id)
    .flatMap((x) => x.variablesClave)
  const correctas: OpcionEmbate[] = item.variablesClave.slice(0, 3).map((v, i) => ({
    id: `v_ok_${i}`, texto: v, correcta: true,
    feedback: 'Esta variable sí mueve el resultado del diseño.',
    conceptId: null, repertoireId: null
  }))
  const senuelos: OpcionEmbate[] = rng.sample([...new Set(otras)], Math.max(2, correctas.length))
    .map((v, i) => ({
      id: `v_no_${i}`, texto: v, correcta: false,
      feedback: 'Pertenece a otro diseño: aquí no es la variable que decide.',
      conceptId: null, repertoireId: null
    }))
  return {
    ...base(item, o),
    titulo: 'Predecir',
    enunciado: '¿Qué variables deciden el resultado de este diseño?',
    contexto: item.enunciado,
    opciones: barajar(rng, [...correctas, ...senuelos]),
    multi: true,
    nCorrectas: correctas.length,
    conceptIds: item.conceptIds,
    conceptoObjetivo: item.conceptIds[0] ?? null,
    peso: pesoDe(contenido, item.conceptIds[0] ?? null),
    cierre: item.resolucionEsperada
  }
}

function deE3(item: ItemE3, o: OpcionesEmbate): Embate {
  const { contenido, rng } = o
  const correctas: OpcionEmbate[] = item.conceptIds.map((id) => ({
    id: `c_${id}`, texto: contenido.conceptos[id]?.titulo ?? id, correcta: true,
    feedback: contenido.conceptos[id]?.definicionCorta ?? '',
    conceptId: id, repertoireId: null
  }))
  const senuelos: OpcionEmbate[] = rng
    .sample(Object.values(contenido.conceptos).filter((c) => !item.conceptIds.includes(c.id)),
      Math.min(6, item.conceptIds.length * 2))
    .map((c) => ({
      id: `c_${c.id}`, texto: c.titulo, correcta: false,
      feedback: `«${c.titulo}» no opera en esta situación: ${c.definicionCorta}`,
      conceptId: c.id, repertoireId: null
    }))
  return {
    ...base(item, o),
    titulo: item.distancia === 'lejana' ? 'Portal lejano' : item.distancia === 'media' ? 'Portal medio' : 'Portal cercano',
    enunciado: 'Selecciona todos los conceptos que operan en esta situación.',
    contexto: item.enunciado,
    opciones: barajar(rng, [...correctas, ...senuelos]),
    multi: true,
    nCorrectas: correctas.length,
    conceptIds: item.conceptIds,
    conceptoObjetivo: item.conceptIds[0] ?? null,
    peso: pesoDe(contenido, item.conceptIds[0] ?? null),
    distancia: item.distancia,
    cierre: item.resolucionEsperada
  }
}

export const GLOSA_RELACION: Record<string, string> = {
  apoya: 'A da respaldo o evidencia a B.',
  causa: 'A produce B.',
  requiere: 'B es condición previa de A.',
  contrasta: 'A se opone o se distingue de B.',
  generaliza: 'A abstrae a B.',
  ejemplifica: 'A es un caso concreto de B.',
  extiende: 'A amplía el alcance de B.',
  matiza: 'A precisa o limita a B.'
}

/* ------------------------- selección de ítems por nodo --------------------- */

export interface FiltroItems {
  mecanicas: MecanicaId[]
  conceptIds: string[]
  condicion: CondicionId | null
  conceptoAnterior: string | null
  soloRepertorio?: boolean
  distancia?: Distancia | null
}

export function itemsCandidatos(contenido: Contenido, f: FiltroItems): Item[] {
  const permitidos = new Set(f.conceptIds)
  const salida: Item[] = []
  for (const mec of f.mecanicas) {
    for (const it of contenido.items[mec] ?? []) {
      const ids = conceptosDeItem(it)
      if (ids.length && !ids.some((id) => permitidos.has(id))) continue
      if (f.soloRepertorio && !tieneRepertorio(it)) continue
      if (f.condicion === 'umbral' && !ids.some((id) => contenido.conceptos[id]?.esUmbral)) continue
      if (f.condicion === 'cadena' && f.conceptoAnterior && !ids.includes(f.conceptoAnterior)) continue
      if (f.distancia && it.mecanica === 'E3' && it.distancia !== f.distancia) continue
      salida.push(it)
    }
  }
  return salida
}

export function conceptosDeItem(it: Item): string[] {
  switch (it.mecanica) {
    case 'A1': case 'A3': return [it.conceptId]
    case 'B1': return [it.conceptId, ...(it.conceptoConfundido ? [it.conceptoConfundido] : [])]
    case 'B2': return [it.respuestaCorrecta]
    case 'C1': return [it.par[0], it.par[1]]
    case 'E1': case 'E3': return it.conceptIds
    default: return []
  }
}

function tieneRepertorio(it: Item): boolean {
  if (it.mecanica === 'B1') return !!it.repertoireId
  if (it.mecanica === 'A1') return it.opciones.some((o) => o.repertoireId)
  return false
}

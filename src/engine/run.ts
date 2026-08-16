import type { Contenido, MecanicaId } from '../content/types'
import { CATALOGO, INSTRUMENTOS, type EfectoInstrumento } from './cards'
import {
  ARQUETIPOS, CONDICION_POR_CARGA, itemsCandidatos, type ArquetipoId, type CondicionId
} from './encounters'
import { Rng } from './rng'

export type TipoNodo = 'combate' | 'elite' | 'refugio' | 'taller' | 'jefe'

export interface Nodo {
  id: string
  capa: number
  columna: number
  actoIndex: number
  tipo: TipoNodo
  arquetipo: ArquetipoId | null
  condicion: CondicionId | null
  conceptIds: string[]
  etiqueta: string
  pista: string
}

export interface Acto {
  index: number
  unidadId: string
  titulo: string
  dificultadObjetivo: number
  manoSugerida: number
  capas: Nodo[][]
}

export interface Ruta {
  semilla: string
  actos: Acto[]
}

/* ------------------------- qué arquetipos son viables ---------------------- */

export function arquetiposViables(contenido: Contenido, conceptIds: string[]): ArquetipoId[] {
  const salida: ArquetipoId[] = []
  const hay = (mecs: MecanicaId[], extra?: boolean) =>
    (extra ?? true) &&
    itemsCandidatos(contenido, {
      mecanicas: mecs, conceptIds, condicion: null, conceptoAnterior: null
    }).length > 0

  if (hay(['A1', 'A3'])) salida.push('vacio')
  if (hay(['B1'])) salida.push('confuso')
  if (hay(['C1'])) salida.push('espejo')
  if (contenido.repertorios.length > 0 &&
      itemsCandidatos(contenido, {
        mecanicas: ['A1', 'B1'], conceptIds, condicion: null, conceptoAnterior: null, soloRepertorio: true
      }).length > 0) salida.push('eco')
  const ricos = conceptIds.filter((id) => (contenido.conceptos[id]?.nDistractores ?? 0) >= 4)
  if (ricos.length >= 2 && hay(['A1', 'B1'])) salida.push('enjambre')
  if (hay(['B2', 'E3', 'E1'])) salida.push('caso')
  if (contenido.ejes.length >= 2) salida.push('arquitecto')
  return salida
}

function condicionPara(contenido: Contenido, conceptIds: string[], rng: Rng): CondicionId | null {
  const cargas = conceptIds.flatMap((id) => contenido.conceptos[id]?.cargaCognitiva ?? [])
  if (cargas.length === 0) return null
  const conteo: Record<string, number> = {}
  for (const c of cargas) conteo[c] = (conteo[c] ?? 0) + 1
  const dominante = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0]
  const propuesta = dominante ? CONDICION_POR_CARGA[dominante] : null
  if (!propuesta) return null
  // el compilador manda: si el bundle declara condiciones, respetamos su lista
  if (contenido.condicionesDisponibles.length > 0 &&
      !contenido.condicionesDisponibles.includes(propuesta) &&
      !['niebla', 'mano_corta'].includes(propuesta)) {
    const alternativas = contenido.condicionesDisponibles.filter(
      (c) => c !== 'portal_por_distancia' && c !== 'marco_rival'
    ) as CondicionId[]
    return alternativas.length ? rng.pick(alternativas) : null
  }
  return propuesta
}

/* ------------------------------ generación -------------------------------- */

const PISTAS: Record<ArquetipoId, string> = {
  vacio: 'Pide recuperar. Lleva verbos de la familia A.',
  confuso: 'Pide discriminar. Lleva verbos de la familia B.',
  espejo: 'Pide relacionar. Lleva verbos de la familia C.',
  eco: 'Una intuición razonable, mal ubicada. Familias A y B.',
  enjambre: 'Muchas opciones plausibles. Familias A y B.',
  caso: 'Pide transferir. Familias B y E.',
  arquitecto: 'Pide ordenar por ejes. Familia B.',
  marco: 'Defiende una tesis. Familias C y F.'
}

export function generarRuta(contenido: Contenido, semilla: string): Ruta {
  const rng = new Rng(semilla)
  const unidades = contenido.unidades.filter((u) => u.conceptIds.length > 0).slice(0, 5)
  const actos: Acto[] = []

  unidades.forEach((u, ai) => {
    const viables = arquetiposViables(contenido, u.conceptIds)
    const comunes = viables.filter((a) => ARQUETIPOS[a].rango === 'comun')
    const elites = viables.filter((a) => ARQUETIPOS[a].rango === 'elite')
    const esUltimo = ai === unidades.length - 1
    const capas: Nodo[][] = []
    const plantilla: TipoNodo[] = esUltimo
      ? ['combate', 'combate', 'taller', 'elite', 'refugio', 'jefe']
      : ['combate', 'combate', 'taller', 'elite', 'refugio']

    plantilla.forEach((tipo, capa) => {
      const opciones = tipo === 'jefe' || tipo === 'refugio' || tipo === 'taller' ? 1 : 2
      const fila: Nodo[] = []
      for (let col = 0; col < opciones; col++) {
        const pool = tipo === 'elite' ? (elites.length ? elites : comunes) : comunes
        const arq: ArquetipoId | null =
          tipo === 'jefe' ? 'marco'
          : tipo === 'refugio' || tipo === 'taller' ? null
          : pool.length ? pool[(col + capa + ai) % pool.length] : null
        const conceptIds = rng.sample(u.conceptIds, Math.max(3, Math.ceil(u.conceptIds.length * 0.7)))
        fila.push({
          id: `a${ai}c${capa}n${col}`,
          capa, columna: col, actoIndex: ai, tipo,
          arquetipo: arq,
          condicion: tipo === 'combate' || tipo === 'elite'
            ? condicionPara(contenido, conceptIds, rng)
            : null,
          conceptIds,
          etiqueta:
            tipo === 'refugio' ? 'Refugio'
            : tipo === 'taller' ? 'Taller de verbos'
            : arq ? ARQUETIPOS[arq].nombre : 'Encuentro',
          pista:
            tipo === 'refugio' ? 'Recupera lucidez y revisa tu mazo.'
            : tipo === 'taller' ? 'Añade, mejora o retira un verbo.'
            : arq ? PISTAS[arq] : ''
        })
      }
      capas.push(fila)
    })

    actos.push({
      index: ai,
      unidadId: u.id,
      titulo: u.titulo,
      dificultadObjetivo: u.dificultadObjetivo,
      manoSugerida: Math.max(3, Math.min(6, u.nOpcionesSugerido)),
      capas
    })
  })

  if (actos.length === 0) {
    throw new Error('El bundle no trae unidades con conceptos: no se puede trazar la expedición.')
  }
  return { semilla, actos }
}

/* ------------------------------- recompensas ------------------------------ */

export type Recompensa =
  | { tipo: 'verbo'; cardId: string }
  | { tipo: 'mejora'; cardId: string; reemplaza: string }
  | { tipo: 'instrumento'; id: EfectoInstrumento }
  | { tipo: 'lucidez'; cantidad: number }

export function ofrecerRecompensas(
  mazo: string[], instrumentos: EfectoInstrumento[], rng: Rng, elite: boolean
): Recompensa[] {
  const salida: Recompensa[] = []

  const nuevos = CATALOGO.filter((c) => !c.mejoraDe && !mazo.includes(c.id))
  if (nuevos.length) salida.push({ tipo: 'verbo', cardId: rng.pick(nuevos).id })

  const mejorables = CATALOGO.filter((c) => c.mejoraDe && mazo.includes(c.mejoraDe) && !mazo.includes(c.id))
  if (mejorables.length) {
    const m = rng.pick(mejorables)
    salida.push({ tipo: 'mejora', cardId: m.id, reemplaza: m.mejoraDe as string })
  }

  const libres = INSTRUMENTOS.filter((i) => !instrumentos.includes(i.id) && (elite || !i.maldito))
  if (libres.length && (elite || rng.next() < 0.6)) {
    salida.push({ tipo: 'instrumento', id: rng.pick(libres).id })
  }

  while (salida.length < 3) salida.push({ tipo: 'lucidez', cantidad: elite ? 12 : 7 })
  return rng.shuffle(salida).slice(0, 3)
}

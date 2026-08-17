import type { Contenido, MecanicaId } from '../content/types'
import { CATALOGO, INSTRUMENTOS, type EfectoInstrumento } from './cards'
import {
  ARQUETIPOS, CONDICION_POR_CARGA, itemsCandidatos, type ArquetipoId, type CondicionId
} from './encounters'
import { Rng } from './rng'

export type TipoNodo = 'combate' | 'elite' | 'refugio' | 'taller' | 'jefe'
export type EtiquetaRuta = 'consolidar' | 'elaborar' | 'umbral' | 'portal' | 'descanso'

export interface Nodo {
  id: string
  columna: number
  fila: number
  actoIndex: number
  tipo: TipoNodo
  etiquetaRuta: EtiquetaRuta
  arquetipos: ArquetipoId[]
  condicion: CondicionId | null
  conceptIds: string[]
  salidas: string[]
}

export interface Acto {
  index: number
  unidadId: string
  titulo: string
  dificultadObjetivo: number
  manoSugerida: number
  columnas: Nodo[][]
  entradas: string[]
}

export interface Ruta {
  semilla: string
  actos: Acto[]
}

export const RUTAS: Record<EtiquetaRuta, { nombre: string; promesa: string; riesgo: string }> = {
  consolidar: {
    nombre: 'Consolidar',
    promesa: 'Conceptos que se fijan de uno en uno.',
    riesgo: 'Seguro. Llena poco Atlas.'
  },
  elaborar: {
    nombre: 'Elaborar',
    promesa: 'Conceptos densos, con muchos vínculos alrededor.',
    riesgo: 'Exige relacionar. Llena mucho Atlas.'
  },
  umbral: {
    nombre: 'Umbral',
    promesa: 'Pasa por un concepto que reorganiza todo el mapa.',
    riesgo: 'Caro. Cambia cómo lees el resto del texto.'
  },
  portal: {
    nombre: 'Portal',
    promesa: 'Casos de dominios que el autor no menciona.',
    riesgo: 'El terreno más caro y el que más rinde.'
  },
  descanso: { nombre: 'Alto', promesa: 'Sin enemigos.', riesgo: 'Ninguno.' }
}

/* ------------------------- qué arquetipos son viables ---------------------- */

export function arquetiposViables(contenido: Contenido, conceptIds: string[]): ArquetipoId[] {
  const salida: ArquetipoId[] = []
  const hay = (mecs: MecanicaId[]) =>
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
  if (contenido.ejes.length >= 2 && hay(['B2'])) salida.push('arquitecto')
  return salida
}

/* --------------------------- selección por etiqueta ------------------------ */

function conceptosPara(
  contenido: Contenido, pool: string[], etiqueta: EtiquetaRuta, rng: Rng
): string[] {
  const grado = (id: string) =>
    contenido.aristas.filter((a) => a.from === id || a.to === id).length
  const carga = (id: string) => contenido.conceptos[id]?.cargaCognitiva ?? []

  let filtro: string[] = []
  switch (etiqueta) {
    case 'umbral':
      filtro = pool.filter((id) => contenido.conceptos[id]?.esUmbral || contenido.conceptos[id]?.esPuerta)
      break
    case 'elaborar':
      filtro = pool.filter((id) => grado(id) >= 2 || carga(id).includes('integrar'))
      break
    case 'consolidar':
      filtro = pool.filter((id) => carga(id).includes('memorizar') || (contenido.conceptos[id]?.nEfectivo ?? 0) >= 3)
      break
    case 'portal':
      filtro = pool.filter((id) => contenido.escenarios.some((s) => s.conceptIds.includes(id)))
      break
    default:
      filtro = pool
  }
  const base = filtro.length >= 3 ? filtro : pool
  const extra = rng.sample(pool.filter((id) => !base.includes(id)), 2)
  return [...new Set([...rng.sample(base, Math.max(3, Math.ceil(base.length * 0.8))), ...extra])]
}

/** La causa de dificultad del concepto elige la condición del combate. */
function condicionPara(
  contenido: Contenido, conceptIds: string[], etiqueta: EtiquetaRuta, rng: Rng
): CondicionId | null {
  if (etiqueta === 'portal') return 'portal_por_distancia'
  const cargas = conceptIds.flatMap((id) => contenido.conceptos[id]?.cargaCognitiva ?? [])
  if (cargas.length === 0) return null
  const conteo: Record<string, number> = {}
  for (const c of cargas) conteo[c] = (conteo[c] ?? 0) + 1
  const dominante = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0]
  const propuesta = dominante ? CONDICION_POR_CARGA[dominante] : null
  if (!propuesta) return null
  if (contenido.condicionesDisponibles.length > 0 &&
      !contenido.condicionesDisponibles.includes(propuesta) &&
      !['niebla', 'mano_corta'].includes(propuesta)) {
    const alternativas = contenido.condicionesDisponibles
      .filter((c) => c !== 'portal_por_distancia' && c !== 'marco_rival') as CondicionId[]
    return alternativas.length ? rng.pick(alternativas) : null
  }
  return propuesta
}

/* ------------------------------- generación -------------------------------- */

const ANCHOS_ACTO = [1, 2, 3, 2, 1]
const ANCHOS_FINAL = [1, 2, 3, 2, 1, 1]

export function generarRuta(contenido: Contenido, semilla: string): Ruta {
  const rng = new Rng(semilla)
  const unidades = contenido.unidades.filter((u) => u.conceptIds.length > 0).slice(0, 5)
  if (unidades.length === 0) {
    throw new Error('El bundle no trae unidades con conceptos: no se puede trazar la expedición.')
  }
  const actos: Acto[] = []

  unidades.forEach((u, ai) => {
    const esUltimo = ai === unidades.length - 1
    const anchos = esUltimo ? ANCHOS_FINAL : ANCHOS_ACTO
    const viables = arquetiposViables(contenido, u.conceptIds)
    const columnas: Nodo[][] = []

    anchos.forEach((ancho, col) => {
      const ultimaCol = col === anchos.length - 1
      const fila: Nodo[] = []
      for (let f = 0; f < ancho; f++) {
        let tipo: TipoNodo = 'combate'
        if (esUltimo && ultimaCol) tipo = 'jefe'
        else if (col === anchos.length - 2 && !esUltimo) tipo = 'refugio'
        else if (col === anchos.length - 2 && esUltimo) tipo = 'refugio'
        else if (col === 2 && f === 0) tipo = 'taller'
        else if (col === anchos.length - 3) tipo = 'elite'

        let etiqueta: EtiquetaRuta
        if (tipo === 'refugio' || tipo === 'taller') etiqueta = 'descanso'
        else if (tipo === 'jefe') etiqueta = 'umbral'
        else {
          const opciones: EtiquetaRuta[] = ['consolidar', 'elaborar', 'umbral', 'portal']
          etiqueta = opciones[(f + col + ai) % opciones.length]
          if (etiqueta === 'umbral' && !u.conceptIds.some((id) => contenido.conceptos[id]?.esUmbral)) {
            etiqueta = 'elaborar'
          }
          if (etiqueta === 'portal' && !viables.includes('caso')) etiqueta = 'consolidar'
        }

        const conceptIds = tipo === 'refugio' || tipo === 'taller'
          ? u.conceptIds
          : conceptosPara(contenido, u.conceptIds, etiqueta, rng)

        const pool = arquetiposViables(contenido, conceptIds)
        let arquetipos: ArquetipoId[] = []
        if (tipo === 'jefe') {
          arquetipos = ['marco']
        } else if (tipo === 'combate' || tipo === 'elite') {
          const fuente = pool.length ? pool : viables
          if (etiqueta === 'portal' && fuente.includes('caso')) arquetipos = ['caso']
          else if (tipo === 'elite') {
            const elites = fuente.filter((a) => ARQUETIPOS[a].rango === 'elite')
            arquetipos = elites.length ? elites : fuente
          } else {
            arquetipos = fuente.filter((a) => ARQUETIPOS[a].rango === 'comun')
            if (!arquetipos.length) arquetipos = fuente
          }
        }
        if ((tipo === 'combate' || tipo === 'elite' || tipo === 'jefe') && arquetipos.length === 0) {
          tipo = 'refugio'
          etiqueta = 'descanso'
        }

        fila.push({
          id: `a${ai}c${col}f${f}`,
          columna: col, fila: f, actoIndex: ai, tipo, etiquetaRuta: etiqueta,
          arquetipos,
          condicion: tipo === 'combate' || tipo === 'elite'
            ? condicionPara(contenido, conceptIds, etiqueta, rng)
            : null,
          conceptIds,
          salidas: []
        })
      }
      columnas.push(fila)
    })

    // aristas del grafo: cada nodo enlaza con 1-2 del siguiente, y ninguno queda huérfano
    for (let col = 0; col < columnas.length - 1; col++) {
      const actual = columnas[col]
      const siguiente = columnas[col + 1]
      const alcanzados = new Set<string>()
      actual.forEach((n, i) => {
        const centro = Math.round((i / Math.max(1, actual.length - 1)) * (siguiente.length - 1)) || 0
        const cand = [...new Set([
          siguiente[centro],
          siguiente[Math.max(0, centro - 1)],
          siguiente[Math.min(siguiente.length - 1, centro + 1)]
        ])].filter(Boolean)
        const cuantos = siguiente.length === 1 ? 1 : 1 + rng.int(2)
        const elegidos = rng.sample(cand, Math.min(cuantos, cand.length))
        n.salidas = elegidos.map((x) => x.id)
        elegidos.forEach((x) => alcanzados.add(x.id))
      })
      for (const s of siguiente) {
        if (!alcanzados.has(s.id)) {
          const donante = rng.pick(actual)
          if (!donante.salidas.includes(s.id)) donante.salidas.push(s.id)
        }
      }
    }

    actos.push({
      index: ai,
      unidadId: u.id,
      titulo: u.titulo,
      dificultadObjetivo: u.dificultadObjetivo,
      manoSugerida: Math.max(3, Math.min(6, u.nOpcionesSugerido)),
      columnas,
      entradas: columnas[0].map((n) => n.id)
    })
  })

  return { semilla, actos }
}

export function nodoPorId(acto: Acto, id: string): Nodo | null {
  for (const col of acto.columnas) {
    const n = col.find((x) => x.id === id)
    if (n) return n
  }
  return null
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

  while (salida.length < 3) salida.push({ tipo: 'lucidez', cantidad: elite ? 14 : 8 })
  return rng.shuffle(salida).slice(0, 3)
}

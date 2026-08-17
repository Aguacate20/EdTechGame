import type { Contenido } from '../content/types'
import type { Dificultad } from './lane'
import { LENTES } from './lenses'
import { Rng } from './rng'

export type TipoNodo = 'oleada' | 'refugio' | 'taller' | 'jefe'
export type EtiquetaRuta = 'consolidar' | 'elaborar' | 'umbral' | 'portal' | 'descanso'

export interface Nodo {
  id: string
  columna: number
  fila: number
  actoIndex: number
  tipo: TipoNodo
  dificultad: Dificultad
  etiquetaRuta: EtiquetaRuta
  conceptIds: string[]
  /** casos y tesis que esta casilla pone sobre la mesa */
  casos: string[]
  tesis: string[]
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

export interface Ruta { semilla: string; actos: Acto[] }

export const RUTAS: Record<EtiquetaRuta, { nombre: string; promesa: string; riesgo: string }> = {
  consolidar: {
    nombre: 'Consolidar',
    promesa: 'Conceptos frecuentes y bien poblados de distractores.',
    riesgo: 'Seguro. Llena poco Atlas.'
  },
  elaborar: {
    nombre: 'Elaborar',
    promesa: 'Conceptos densos, con muchos vínculos alrededor.',
    riesgo: 'Cadenas largas posibles. Llena mucho Atlas.'
  },
  umbral: {
    nombre: 'Umbral',
    promesa: 'Pasa por un concepto que reorganiza el mapa.',
    riesgo: 'Caro, y multiplica si lo sostienes.'
  },
  portal: {
    nombre: 'Portal',
    promesa: 'Casos de dominios que el autor no menciona.',
    riesgo: 'El terreno que más rinde y el que más cuesta.'
  },
  descanso: { nombre: 'Alto', promesa: 'Sin enemigos.', riesgo: 'Ninguno.' }
}

/* --------------------------- selección de material ------------------------- */

function conceptosPara(
  contenido: Contenido, pool: string[], etiqueta: EtiquetaRuta, rng: Rng
): string[] {
  const grado = (id: string) => contenido.aristas.filter((a) => a.from === id || a.to === id).length
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
  const base = filtro.length >= 4 ? filtro : pool
  // siempre se añaden vecinos de los elegidos: sin vecinos no hay cadenas posibles
  const elegidos = rng.sample(base, Math.min(base.length, Math.max(4, Math.ceil(base.length * 0.7))))
  const vecinos = elegidos.flatMap((id) =>
    contenido.aristas
      .filter((a) => a.from === id || a.to === id)
      .map((a) => (a.from === id ? a.to : a.from))
  ).filter((id) => pool.includes(id))
  return [...new Set([...elegidos, ...rng.sample([...new Set(vecinos)], 3)])]
}

function casosPara(contenido: Contenido, conceptIds: string[], etiqueta: EtiquetaRuta, rng: Rng): string[] {
  const candidatos = [
    ...contenido.escenarios.filter((s) =>
      s.conceptIds.some((c) => conceptIds.includes(c)) &&
      (etiqueta !== 'portal' || s.distancia !== 'cercana')),
    ...contenido.casos.filter((c) => c.conceptIds.some((x) => conceptIds.includes(x)))
  ].map((x) => x.id)
  return rng.sample([...new Set(candidatos)], etiqueta === 'portal' ? 2 : 1)
}

/* -------------------------------- generación ------------------------------- */

const ANCHOS = [1, 2, 3, 2, 1]
const ANCHOS_FINAL = [1, 2, 3, 2, 1, 1]

export function generarRuta(contenido: Contenido, semilla: string): Ruta {
  const rng = new Rng(semilla)
  const unidades = contenido.unidades.filter((u) => u.conceptIds.length >= 2).slice(0, 5)
  if (!unidades.length) {
    throw new Error('El bundle no trae unidades con conceptos suficientes: no se puede trazar la expedición.')
  }
  const actos: Acto[] = []

  unidades.forEach((u, ai) => {
    const esUltimo = ai === unidades.length - 1
    const anchos = esUltimo ? ANCHOS_FINAL : ANCHOS
    const columnas: Nodo[][] = []

    anchos.forEach((ancho, col) => {
      const ultima = col === anchos.length - 1
      const fila: Nodo[] = []
      for (let f = 0; f < ancho; f++) {
        let tipo: TipoNodo = 'oleada'
        if (esUltimo && ultima) tipo = 'jefe'
        else if (col === anchos.length - 2) tipo = 'refugio'
        else if (col === 2 && f === 0) tipo = 'taller'

        let etiqueta: EtiquetaRuta = 'descanso'
        let dificultad: Dificultad = 'facil'
        if (tipo === 'jefe') { etiqueta = 'umbral'; dificultad = 'jefe' }
        else if (tipo === 'oleada') {
          const opciones: EtiquetaRuta[] = ['consolidar', 'elaborar', 'umbral', 'portal']
          etiqueta = opciones[(f + col + ai) % opciones.length]
          if (etiqueta === 'umbral' && !u.conceptIds.some((id) => contenido.conceptos[id]?.esUmbral)) {
            etiqueta = 'elaborar'
          }
          if (etiqueta === 'portal' && contenido.escenarios.length === 0) etiqueta = 'consolidar'
          dificultad = etiqueta === 'consolidar' ? 'facil'
            : etiqueta === 'portal' || etiqueta === 'umbral' ? 'dura' : 'media'
          if (col === anchos.length - 3 && f === 0) dificultad = 'dura'
        }

        const conceptIds = tipo === 'refugio' || tipo === 'taller'
          ? u.conceptIds
          : conceptosPara(contenido, u.conceptIds, etiqueta, rng)
        const casos = tipo === 'oleada' || tipo === 'jefe'
          ? casosPara(contenido, conceptIds, etiqueta, rng)
          : []
        const tesis = tipo === 'jefe'
          ? rng.sample(contenido.tesis.map((t) => t.id), 2)
          : etiqueta === 'umbral'
            ? rng.sample(contenido.tesis.filter((t) => t.conceptIds.some((c) => conceptIds.includes(c))).map((t) => t.id), 1)
            : []

        fila.push({
          id: `a${ai}c${col}f${f}`, columna: col, fila: f, actoIndex: ai,
          tipo, dificultad, etiquetaRuta: etiqueta, conceptIds, casos, tesis, salidas: []
        })
      }
      columnas.push(fila)
    })

    for (let col = 0; col < columnas.length - 1; col++) {
      const actual = columnas[col]
      const siguiente = columnas[col + 1]
      const alcanzados = new Set<string>()
      actual.forEach((n, i) => {
        const centro = siguiente.length === 1
          ? 0
          : Math.round((i / Math.max(1, actual.length - 1)) * (siguiente.length - 1))
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
      index: ai, unidadId: u.id, titulo: u.titulo,
      dificultadObjetivo: u.dificultadObjetivo,
      manoSugerida: Math.max(6, Math.min(8, 5 + u.nOpcionesSugerido - 2)),
      columnas, entradas: columnas[0].map((n) => n.id)
    })
  })

  return { semilla, actos }
}

/* ------------------------------- recompensas ------------------------------- */

export type Recompensa =
  | { tipo: 'lente'; id: string }
  | { tipo: 'relacion'; tipoRelacion: string }
  | { tipo: 'caso'; id: string }
  | { tipo: 'tesis'; id: string }
  | { tipo: 'lucidez'; cantidad: number }
  | { tipo: 'ranura'; }

export function ofrecerRecompensas(
  contenido: Contenido, lentes: string[], relaciones: string[], rng: Rng,
  dura: boolean
): Recompensa[] {
  const salida: Recompensa[] = []

  const libres = LENTES.filter((l) => !lentes.includes(l.id) && (dura || !l.raro))
  if (libres.length && lentes.length < 5) salida.push({ tipo: 'lente', id: rng.pick(libres).id })

  // relaciones raras del texto: las que más multiplican y menos tienes
  const porRareza = Object.entries(contenido.frecuenciaRelacion)
    .sort((a, b) => a[1] - b[1])
    .map(([t]) => t)
  const candidata = porRareza.find((t) => relaciones.filter((r) => r === t).length < 2) ?? porRareza[0]
  if (candidata) salida.push({ tipo: 'relacion', tipoRelacion: candidata })

  if (dura && contenido.tesis.length) {
    salida.push({ tipo: 'tesis', id: rng.pick(contenido.tesis).id })
  } else if (contenido.escenarios.length) {
    const lejanos = contenido.escenarios.filter((s) => s.distancia !== 'cercana')
    salida.push({ tipo: 'caso', id: rng.pick(lejanos.length ? lejanos : contenido.escenarios).id })
  }

  if (salida.length < 3) salida.push({ tipo: 'lucidez', cantidad: dura ? 16 : 10 })
  return rng.shuffle(salida).slice(0, 3)
}

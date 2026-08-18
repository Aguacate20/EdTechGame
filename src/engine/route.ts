import type { Contenido } from '../content/types'
import type { Dificultad } from './lane'
import { LENTES, SELLOS, type SelloId } from './powers'
import { HERRAMIENTAS, type HerramientaId } from './tools'
import { Rng } from './rng'

export type TipoNodo = 'oleada' | 'refugio' | 'archivo' | 'jefe'
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
  /** los títulos que se anuncian en el mapa: elegir ruta es elegir temario */
  temas: string[]
  casos: string[]
  tesis: string[]
  /** tinta extra por despejarlo: lo difícil paga más */
  tinta: number
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
    promesa: 'Conceptos frecuentes, bien poblados de descripciones parecidas.',
    riesgo: 'Oleada ligera. Poca tinta.'
  },
  elaborar: {
    nombre: 'Elaborar',
    promesa: 'Conceptos densos, con muchos vínculos alrededor.',
    riesgo: 'Permite cadenas largas. Tinta media.'
  },
  umbral: {
    nombre: 'Umbral',
    promesa: 'Pasa por un concepto que reorganiza el mapa.',
    riesgo: 'Oleada dura. Multiplica si lo sostienes.'
  },
  portal: {
    nombre: 'Portal',
    promesa: 'Casos de dominios que el autor no menciona.',
    riesgo: 'Lo que más cuesta y lo que más tinta deja.'
  },
  descanso: { nombre: 'Alto', promesa: 'Sin enemigos.', riesgo: 'Ninguno.' }
}

/* ==========================================================================
   Reparto entre hermanos.
   Antes, dos nodos de la misma columna muestreaban del mismo saco: elegir
   rama cambiaba la etiqueta pero no el temario, así que la decisión era casi
   cosmética. Ahora cada hermano recibe un subconjunto distinto, sesgado por
   cluster, y el mapa anuncia qué conceptos vas a ver. Elegir ruta es elegir
   qué parte del texto vas a poder sellar en el Atlas.
   ========================================================================== */

/** Conceptos mínimos para que un nodo tenga aristas trazables dentro. */
const MIN_POR_NODO = 3

/** Cuántos hermanos admite un saco sin que los temarios se solapen:
 *  una unidad pequeña simplemente no se ramifica. */
export const hermanosPosibles = (n: number): number =>
  Math.max(1, Math.min(3, Math.floor(n / MIN_POR_NODO)))

export function repartirEntreHermanos(
  c: Contenido, pool: string[], k: number, rng: Rng
): string[][] {
  if (k <= 1) return [pool]

  // 1. agrupar por cluster: cada hermano tendrá un acento distinto del texto
  const porCluster = new Map<string, string[]>()
  for (const id of pool) {
    const cl = c.conceptos[id]?.clusterId ?? '—'
    porCluster.set(cl, [...(porCluster.get(cl) ?? []), id])
  }
  const grupos = [...porCluster.values()].sort((a, b) => b.length - a.length)

  // 2. repartir los grupos al hermano más vacío
  const cubos: string[][] = Array.from({ length: k }, () => [])
  for (const g of rng.shuffle(grupos)) {
    for (const id of g) {
      const destino = cubos.reduce((min, x) => (x.length < min.length ? x : min), cubos[0])
      destino.push(id)
    }
  }

  // 3. completar hasta el mínimo con vecinos de lo que ya tiene, para que
  //    siempre haya aristas trazables dentro del nodo
  const vecinosDe = (id: string) => c.aristas
    .filter((a) => a.from === id || a.to === id)
    .map((a) => (a.from === id ? a.to : a.from))
    .filter((x) => pool.includes(x))

  // el tamaño objetivo sale del saco, no de una constante: así el relleno
  // nunca obliga a que dos hermanos compartan casi todo
  const objetivo = Math.max(MIN_POR_NODO, Math.ceil(pool.length / k))

  for (const cubo of cubos) {
    const usadoPorOtros = new Set(cubos.filter((x) => x !== cubo).flatMap((x) => x))
    let guardia = 0
    while (cubo.length < Math.min(objetivo, pool.length) && guardia++ < 40) {
      const candidatos = [...new Set(cubo.flatMap(vecinosDe))].filter((x) => !cubo.includes(x))
      // primero vecinos que nadie más tiene; si no hay, se acepta el solape
      const propios = candidatos.filter((x) => !usadoPorOtros.has(x))
      const fuente = propios.length ? propios : candidatos.length ? candidatos
        : pool.filter((x) => !cubo.includes(x))
      if (!fuente.length) break
      cubo.push(rng.pick(fuente))
    }
  }
  return cubos
}

/** Solape medio entre hermanos: lo mide el smoke para que no vuelva a subir. */
export function solapeMedio(cubos: string[][]): number {
  if (cubos.length < 2) return 0
  let suma = 0, pares = 0
  for (let i = 0; i < cubos.length; i++) {
    for (let j = i + 1; j < cubos.length; j++) {
      const a = new Set(cubos[i])
      const comunes = cubos[j].filter((x) => a.has(x)).length
      suma += comunes / Math.max(1, Math.min(cubos[i].length, cubos[j].length))
      pares++
    }
  }
  return pares ? suma / pares : 0
}

/* --------------------------- etiqueta según el material -------------------- */

function etiquetaPara(c: Contenido, ids: string[], rng: Rng): EtiquetaRuta {
  const grado = (id: string) => c.aristas.filter((a) => a.from === id || a.to === id).length
  const tieneUmbral = ids.some((id) => c.conceptos[id]?.esUmbral || c.conceptos[id]?.esPuerta)
  const densidad = ids.reduce((n, id) => n + grado(id), 0) / Math.max(1, ids.length)
  const conEscenario = ids.filter((id) =>
    c.escenarios.some((s) => s.distancia !== 'cercana' && s.conceptIds.includes(id))).length

  const pesos: [EtiquetaRuta, number][] = [
    ['umbral', tieneUmbral ? 3 : 0],
    ['portal', conEscenario >= 1 ? 2.5 : 0],
    ['elaborar', densidad >= 2 ? 2.5 : 1],
    ['consolidar', densidad < 2 ? 2.5 : 1]
  ]
  const total = pesos.reduce((n, [, w]) => n + w, 0)
  let x = rng.next() * total
  for (const [et, w] of pesos) { x -= w; if (x <= 0) return et }
  return 'elaborar'
}

const DIFICULTAD: Record<EtiquetaRuta, Dificultad> = {
  consolidar: 'facil', elaborar: 'media', umbral: 'dura', portal: 'dura', descanso: 'facil'
}
const TINTA_EXTRA: Record<Dificultad, number> = { facil: 0, media: 3, dura: 7, jefe: 12 }

function casosPara(c: Contenido, ids: string[], etiqueta: EtiquetaRuta, rng: Rng): string[] {
  const candidatos = [
    ...c.escenarios.filter((s) =>
      s.conceptIds.some((x) => ids.includes(x)) &&
      (etiqueta !== 'portal' || s.distancia !== 'cercana')),
    ...c.casos.filter((k) => k.conceptIds.some((x) => ids.includes(x)))
  ].map((x) => x.id)
  return rng.sample([...new Set(candidatos)], etiqueta === 'portal' ? 2 : 1)
}

const temasDe = (c: Contenido, ids: string[]): string[] =>
  [...ids]
    .sort((a, b) => (c.conceptos[b]?.importancia ?? 0) - (c.conceptos[a]?.importancia ?? 0))
    .slice(0, 3)
    .map((id) => c.conceptos[id]?.titulo ?? id)

/* ==========================================================================
   Forma del acto, derivada del grafo y no de una plantilla
   ========================================================================== */

function formaDelActo(c: Contenido, conceptIds: string[], rng: Rng, esUltimo: boolean): number[] {
  const n = conceptIds.length
  const clusters = new Set(conceptIds.map((id) => c.conceptos[id]?.clusterId ?? '—')).size
  // un acto pequeño no merece el mismo mapa que uno grande
  const largo = Math.max(4, Math.min(7, 3 + Math.ceil(n / 4)))
  // el ancho lo limita el MATERIAL, no el número de clusters: los clusters dan
  // el sabor del reparto, pero una unidad de un solo cluster puede ramificarse
  // igual si tiene conceptos suficientes para dos temarios distintos
  const anchoMax = Math.min(3, hermanosPosibles(n) + (clusters >= 3 ? 1 : 0))

  const forma: number[] = [1]
  for (let i = 1; i < largo - 2; i++) {
    const subida = anchoMax <= 1
      ? 1
      : Math.min(anchoMax, 1 + Math.round((i / Math.max(1, largo - 3)) * (anchoMax - 1)) +
          (rng.next() < 0.25 ? 1 : 0))
    forma.push(Math.max(1, Math.min(anchoMax, subida)))
  }
  forma.push(1)                 // refugio: siempre columna única
  if (esUltimo) forma.push(1)   // y el jefe cierra el acto
  return forma
}

export function generarRuta(contenido: Contenido, semilla: string): Ruta {
  const rng = new Rng(semilla)
  const unidades = contenido.unidades.filter((u) => u.conceptIds.length >= 2).slice(0, 5)
  if (!unidades.length) {
    throw new Error('El bundle no trae unidades con conceptos suficientes: no se puede trazar la expedición.')
  }
  const actos: Acto[] = []

  unidades.forEach((u, ai) => {
    const esUltimo = ai === unidades.length - 1
    const anchos = formaDelActo(contenido, u.conceptIds, rng, esUltimo)
    const columnas: Nodo[][] = []
    const colArchivo = Math.max(1, Math.floor(anchos.length / 2) - 1)

    anchos.forEach((ancho, col) => {
      const ultima = col === anchos.length - 1
      // el refugio es la única columna de ancho 1 antes del cierre del acto
      const colRefugio = esUltimo ? anchos.length - 2 : anchos.length - 1
      const penultima = col === colRefugio
      // el reparto se hace UNA vez por columna: los hermanos no se solapan
      const reparto = repartirEntreHermanos(contenido, u.conceptIds, ancho, rng)
      const fila: Nodo[] = []

      for (let f = 0; f < ancho; f++) {
        let tipo: TipoNodo = 'oleada'
        if (esUltimo && ultima) tipo = 'jefe'
        else if (penultima) tipo = 'refugio'
        else if (col === colArchivo && f === 0) tipo = 'archivo'

        const conceptIds = tipo === 'refugio' || tipo === 'archivo'
          ? u.conceptIds
          : reparto[f] ?? u.conceptIds

        let etiqueta: EtiquetaRuta = 'descanso'
        let dificultad: Dificultad = 'facil'
        if (tipo === 'jefe') { etiqueta = 'umbral'; dificultad = 'jefe' }
        else if (tipo === 'oleada') {
          etiqueta = etiquetaPara(contenido, conceptIds, rng)
          if (etiqueta === 'portal' && !contenido.escenarios.length) etiqueta = 'consolidar'
          dificultad = DIFICULTAD[etiqueta]
        }

        fila.push({
          id: `a${ai}c${col}f${f}`, columna: col, fila: f, actoIndex: ai,
          tipo, dificultad, etiquetaRuta: etiqueta, conceptIds,
          temas: tipo === 'refugio' || tipo === 'archivo' ? [] : temasDe(contenido, conceptIds),
          casos: tipo === 'oleada' || tipo === 'jefe' ? casosPara(contenido, conceptIds, etiqueta, rng) : [],
          tesis: tipo === 'jefe'
            ? rng.sample(contenido.tesis.map((t) => t.id), 2)
            : etiqueta === 'umbral'
              ? rng.sample(contenido.tesis.filter((t) =>
                  t.conceptIds.some((x) => conceptIds.includes(x))).map((t) => t.id), 1)
              : [],
          tinta: TINTA_EXTRA[dificultad],
          salidas: []
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
  | { tipo: 'sello'; id: SelloId }
  | { tipo: 'herramienta'; id: HerramientaId }
  | { tipo: 'relacion'; tipoRelacion: string }
  | { tipo: 'caso'; id: string }
  | { tipo: 'tesis'; id: string }
  | { tipo: 'lucidez'; cantidad: number }
  | { tipo: 'tinta'; cantidad: number }

export function ofrecerRecompensas(
  contenido: Contenido, cartera: {
    lentes: string[]; sellos: SelloId[]; herramientas: HerramientaId[]; relaciones: string[]
  }, rng: Rng, dura: boolean
): Recompensa[] {
  const salida: Recompensa[] = []

  const libres = LENTES.filter((l) => !cartera.lentes.includes(l.id) &&
    (dura || l.rareza === 'comun'))
  if (libres.length) salida.push({ tipo: 'lente', id: rng.pick(libres).id })

  const sellosLibres = (Object.keys(SELLOS) as SelloId[]).filter((s) => !cartera.sellos.includes(s))
  if (sellosLibres.length && (dura || rng.next() < 0.55)) {
    salida.push({ tipo: 'sello', id: rng.pick(sellosLibres) })
  }

  const cuenta = (h: HerramientaId) => cartera.herramientas.filter((x) => x === h).length
  const herramientas = (Object.keys(HERRAMIENTAS) as HerramientaId[])
    .filter((h) => h !== 'eje' || contenido.ejes.length >= 1)
    .sort((a, b) => cuenta(a) - cuenta(b))
  if (salida.length < 3) salida.push({ tipo: 'herramienta', id: herramientas[rng.int(3)] })

  const porRareza = Object.entries(contenido.frecuenciaRelacion)
    .sort((a, b) => a[1] - b[1]).map(([t]) => t)
  const rel = porRareza.find((t) => cartera.relaciones.filter((r) => r === t).length < 2) ?? porRareza[0]
  if (rel && salida.length < 3) salida.push({ tipo: 'relacion', tipoRelacion: rel })

  while (salida.length < 3) salida.push({ tipo: 'tinta', cantidad: dura ? 14 : 9 })
  return rng.shuffle(salida).slice(0, 3)
}

import type { Contenido } from '../content/types'
import { crearEnemigo, type Enemigo } from './lane'
import type { HerramientaId } from './tools'
import type { Rng } from './rng'

/* ==========================================================================
   El Fragmento y el desvanecimiento.

   En modo aprendizaje una sala no es un combate largo con todo encima: son
   tres oleadas cortas. Cada una añade conceptos y una herramienta, y cada una
   EXIGE tocar algo de la anterior, así que no se avanza acumulando sino
   reusando.

   Y el andamio no está o no está: se retira en orden y anunciándolo. Esa es la
   diferencia entre un apoyo y una muleta.
   ========================================================================== */

export type NivelApoyo = 'total' | 'parcial' | 'ninguno'

export interface Oleada {
  indice: number
  /** conceptos que entran EN ESTA oleada */
  conceptIds: string[]
  /** los de las anteriores: hay que tocarlos para que la afirmación rinda */
  previos: string[]
  herramientas: HerramientaId[]
  enemigos: Enemigo[]
  apoyo: NivelApoyo
  titulo: string
  aviso: string
  /** oleada extra por un concepto puerta que sigue sin evidencia */
  esPuerta?: boolean
  /** v5.62 · transferencia: escenarios (media distancia en la última oleada, lejana en la de puerta) */
  escenarios?: string[]
}

const AVISOS: Record<NivelApoyo, string> = {
  total: 'Los conceptos llegan enteros, las falsificaciones vienen marcadas y no puedes caer.',
  parcial: 'Los conceptos siguen enteros, pero ya no te señalo nada más.',
  ninguno: 'A partir de aquí, sin ayudas: nombres y descripciones por separado, y la lucidez baja.'
}

const TITULOS = ['Reconocer', 'Relacionar', 'Sostener']

/** Reparte los conceptos de la sala en tres tandas, dejando los más centrales
 *  para el principio: lo que llega primero es lo que va a tener que reutilizarse. */
export function componerOleadas(
  c: Contenido, conceptIds: string[], herramientas: HerramientaId[], acto: number, rng: Rng,
  /** v5.62 · anclaje entre sesiones: conceptos con evidencia previa en el Atlas */
  conEvidencia: string[] = []
): Oleada[] {
  // lo ya visto en sesiones anteriores entra PRIMERO: la sala engancha con la
  // galaxia que ya existe, y lo nuevo se apoya en ello (aprendizaje significativo)
  const previo = new Set(conEvidencia)
  const orden = [...conceptIds].sort(
    (a, b) => (previo.has(b) ? 1 : 0) - (previo.has(a) ? 1 : 0)
      || (c.conceptos[b]?.importancia ?? 0) - (c.conceptos[a]?.importancia ?? 0)
  )
  const n = orden.length
  const corte1 = Math.max(2, Math.ceil(n * 0.4))
  const corte2 = Math.max(corte1 + 1, Math.ceil(n * 0.75))
  const tandas = [orden.slice(0, corte1), orden.slice(corte1, corte2), orden.slice(corte2)]
    .filter((t) => t.length > 0)

  // las herramientas entran de una en una: primero identificar, luego enlazar,
  // luego estructurar. Lo que el jugador ya tenga se reparte por encima.
  const base: HerramientaId[][] = [
    ['identidad', 'identidad'],
    ['flecha', 'flecha'],
    ['campo']
  ]
  const extra = herramientas.filter((h) => !['identidad', 'flecha', 'campo'].includes(h))
  const escala = 0.7 + acto * 0.1
  const niveles: NivelApoyo[] = ['total', 'parcial', 'ninguno']

  return tandas.map((tanda, i) => ({
    indice: i,
    conceptIds: tanda,
    previos: tandas.slice(0, i).flat(),
    // v5.63: las mismas herramientas que en una expedición normal, en todas las
    // oleadas. Empezar solo con Identidad dejaba la segunda oleada sin nada útil
    // cuando los conceptos llegan enteros. Las herramientas se ganan en el
    // refugio, con la escalera de andamiaje, no oleada a oleada.
    herramientas: [...new Set([...herramientas, ...(base[i] ?? []), ...extra])],
    enemigos: Array.from({ length: i === 0 ? 1 : 2 }, (_, k) =>
      crearEnemigo(
        i === 0 ? 'copista' : rng.pick(i === 1 ? ['copista', 'errata'] : ['dogma', 'apocrifo', 'eco']),
        escala * (0.55 + i * 0.2), 7 - k
      )
    ),
    apoyo: niveles[Math.min(i, niveles.length - 1)],
    titulo: `${TITULOS[Math.min(i, 2)]} · oleada ${i + 1} de ${tandas.length}`,
    aviso: AVISOS[niveles[Math.min(i, niveles.length - 1)]],
    // la última oleada trae un escenario de distancia media sobre sus conceptos:
    // comprender es poder usar el concepto donde no se aprendió
    escenarios: i === tandas.length - 1 ? escenariosDe(c, tanda, 'media', 1) : []
  }))
}

export function escenariosDe(c: Contenido, conceptIds: string[], distancia: 'cercana' | 'media' | 'lejana', n: number): string[] {
  return c.escenarios
    .filter((e) => e.distancia === distancia && e.conceptIds.some((id) => conceptIds.includes(id)))
    .slice(0, n).map((e) => e.id)
}

/** Si el concepto que ordena la unidad sigue sin sostenerse, la sala no está
 *  superada por mucho que el carril esté vacío: aparece una oleada más. */
export function oleadaDePuerta(
  c: Contenido, conceptIds: string[], sinEvidencia: string[], acto: number, previos: string[]
): Oleada | null {
  const puerta = conceptIds.find(
    (id) => (c.conceptos[id]?.esPuerta || c.conceptos[id]?.esUmbral) && sinEvidencia.includes(id)
  )
  if (!puerta) return null
  const vecinos = c.aristas
    .filter((a) => a.from === puerta || a.to === puerta)
    .map((a) => (a.from === puerta ? a.to : a.from))
    .filter((x) => conceptIds.includes(x))
    .slice(0, 3)

  return {
    indice: 99,
    conceptIds: [puerta, ...new Set(vecinos)],
    previos,
    herramientas: ['identidad', 'flecha', 'flecha'],
    enemigos: [crearEnemigo('dogma', 0.75 + acto * 0.08, 7)],
    apoyo: 'parcial',
    titulo: `El nudo · ${c.conceptos[puerta]?.titulo ?? ''}`,
    aviso: 'Este concepto ordena todo lo demás y todavía no lo has sostenido. La sala no se cierra sin él.',
    esPuerta: true, escenarios: escenariosDe(c, [puerta], 'lejana', 1)
  }
}

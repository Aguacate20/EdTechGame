import type { Contenido } from '../content/types'

const CLAVE = 'archivo-infinito:atlas:v1'
const CLAVE_LOG = 'archivo-infinito:log:v1'

export interface EvidenciaConcepto {
  aciertos: number
  fallos: number
  mecanicas: string[]
  /** con qué otros conceptos lo has sostenido: la memoria depende del contexto,
   *  así que acertar siempre con el mismo vecino no es lo mismo que acertar
   *  en varias zonas del grafo */
  vecinos: string[]
  /** cuántos de esos aciertos fueron con el andamio del modo aprendizaje.
   *  La evidencia con apoyo cuenta, pero no es la misma evidencia. */
  conApoyo: number
  ultimaApuestaAcertada: string | null
}

/** Lo que el estudiante conserva entre expediciones. El Atlas deja de ser solo
 *  un registro: es el estado del jugador y la pantalla de inicio. */
export interface Progreso {
  /** tipos de vínculo que ya descubrió: se desbloquean derribando enemigos */
  relaciones: string[]
  lentes: string[]
  herramientas: string[]
  sellos: string[]
  terrenos: string[]
  /** expediciones emprendidas: el carril escala con esto */
  expediciones: number
}

export interface Atlas {
  fuente: string
  progreso: Progreso
  aristas: Record<string, { from: string; to: string; tipo: string; aciertos: number }>
  conceptos: Record<string, EvidenciaConcepto>
  repertoriosEstabilizados: string[]
  runs: number
  victorias: number
  /** historial del mejor diagrama por sala, para poder mostrar tu propia curva */
  mejoresDiagramas: number[]
  apuestasTotales: number
  apuestasCalibradas: number
}

export const PROGRESO_INICIAL: Progreso = {
  // se empieza sabiendo solo respaldar y oponer: el resto se descubre jugando
  relaciones: ['apoya', 'contrasta'],
  lentes: [],
  herramientas: ['identidad', 'identidad', 'flecha', 'flecha', 'flecha', 'campo'],
  sellos: [],
  terrenos: [],
  expediciones: 0
}

export function atlasVacio(fuente: string): Atlas {
  return {
    fuente, progreso: { ...PROGRESO_INICIAL }, aristas: {}, conceptos: {},
    repertoriosEstabilizados: [], runs: 0, victorias: 0, mejoresDiagramas: [],
    apuestasTotales: 0, apuestasCalibradas: 0
  }
}

export function cargarAtlas(fuente: string): Atlas {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return atlasVacio(fuente)
    const a = JSON.parse(raw) as Atlas
    if (a.fuente !== fuente) return atlasVacio(fuente)
    const base = atlasVacio(fuente)
    return { ...base, ...a, progreso: { ...base.progreso, ...(a.progreso ?? {}) } }
  } catch {
    return atlasVacio(fuente)
  }
}

export function guardarAtlas(a: Atlas): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(a))
  } catch {
    /* almacenamiento no disponible: el Atlas vive solo en esta sesión */
  }
}

export function nivelDe(e: EvidenciaConcepto | undefined): number {
  if (!e) return 0
  const distintas = new Set(e.mecanicas).size
  const contextos = new Set(e.vecinos ?? []).size
  // el nivel máximo exige haberlo sostenido desde herramientas distintas Y en
  // vecindades distintas: una respuesta aislada es la punta del iceberg
  const sinApoyo = e.aciertos - (e.conApoyo ?? 0)
  // el nivel máximo exige al menos un acierto sin andamio: si no, el modelo
  // cognitivo estaría diciendo «lo domina» de algo que solo sostiene con ayuda
  if (e.aciertos >= 5 && distintas >= 3 && contextos >= 3 && sinApoyo >= 1) return 3
  if (e.aciertos >= 3 && distintas >= 2 && contextos >= 2) return 2
  if (e.aciertos >= 1) return 1
  return 0
}

export function coberturaAtlas(a: Atlas, c: Contenido): { aristas: number; conceptos: number; pct: number } {
  const totalAristas = Math.max(1, c.aristas.length)
  const totalConceptos = Math.max(1, Object.keys(c.conceptos).length)
  const aristas = Object.keys(a.aristas).length
  const conceptos = Object.values(a.conceptos).filter((e) => nivelDe(e) > 0).length
  const pct = Math.round(((aristas / totalAristas) * 0.5 + (conceptos / totalConceptos) * 0.5) * 100)
  return { aristas, conceptos, pct }
}

/* ==========================================================================
   El modelo cognitivo, visible para el propio estudiante.
   No es una nota: es un mapa de en qué anda firme y en qué le está costando,
   y es lo que decide qué se le propone en la siguiente expedición.
   ========================================================================== */

export type EstadoConcepto = 'dominado' | 'sostenido' | 'reconocido' | 'cuesta' | 'sin_tocar'

export function estadoDe(e: EvidenciaConcepto | undefined): EstadoConcepto {
  if (!e || (e.aciertos === 0 && e.fallos === 0)) return 'sin_tocar'
  const n = nivelDe(e)
  // más fallos que aciertos, habiéndolo intentado varias veces: le cuesta
  if (e.fallos >= 2 && e.fallos > e.aciertos) return 'cuesta'
  return n === 3 ? 'dominado' : n === 2 ? 'sostenido' : 'reconocido'
}

/** ¿Todo lo que sostiene de esto lo sostuvo con andamio? Es información honesta
 *  y además motivadora: «lo sostienes, pero siempre con ayuda». */
export const soloConApoyo = (e: EvidenciaConcepto | undefined): boolean =>
  !!e && e.aciertos > 0 && (e.conApoyo ?? 0) >= e.aciertos

export const ETIQUETA_ESTADO: Record<EstadoConcepto, string> = {
  dominado: 'lo dominas',
  sostenido: 'lo sostienes',
  reconocido: 'lo reconoces',
  cuesta: 'se te resiste',
  sin_tocar: 'sin tocar'
}

export interface Retrato {
  dominados: string[]
  sostenidos: string[]
  reconocidos: string[]
  cuestan: string[]
  sinTocar: string[]
}

export function retratoDe(a: Atlas, ids: string[]): Retrato {
  const r: Retrato = { dominados: [], sostenidos: [], reconocidos: [], cuestan: [], sinTocar: [] }
  for (const id of ids) {
    switch (estadoDe(a.conceptos[id])) {
      case 'dominado': r.dominados.push(id); break
      case 'sostenido': r.sostenidos.push(id); break
      case 'reconocido': r.reconocidos.push(id); break
      case 'cuesta': r.cuestan.push(id); break
      default: r.sinTocar.push(id)
    }
  }
  return r
}

/* ------------------------------- telemetría ------------------------------- */

export interface EventoJugada {
  ts: number
  runId: string
  nodoId: string
  arquetipo: string
  condicion: string | null
  mecanica: string
  itemId: string
  conceptIds: string[]
  operacion: string | null
  improvisado: boolean
  seleccion: string[]
  correcto: boolean
  apuesta: string
  calibrado: boolean
  latenciaMs: number
  ayuda: boolean
  repertorioTocado: string | null
}

let LOG: EventoJugada[] = []

export function registrar(e: EventoJugada): void {
  LOG.push(e)
  if (LOG.length % 10 === 0) {
    try { localStorage.setItem(CLAVE_LOG, JSON.stringify(LOG.slice(-500))) } catch { /* noop */ }
  }
}

export function log(): EventoJugada[] {
  return LOG
}

export function limpiarLog(): void {
  LOG = []
  try { localStorage.removeItem(CLAVE_LOG) } catch { /* noop */ }
}

export function descargarLog(): void {
  const blob = new Blob([JSON.stringify(LOG, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `archivo-infinito-senales-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

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
  ultimaApuestaAcertada: string | null
}

export interface Atlas {
  fuente: string
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

export function atlasVacio(fuente: string): Atlas {
  return {
    fuente, aristas: {}, conceptos: {}, repertoriosEstabilizados: [],
    runs: 0, victorias: 0, mejoresDiagramas: [], apuestasTotales: 0, apuestasCalibradas: 0
  }
}

export function cargarAtlas(fuente: string): Atlas {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return atlasVacio(fuente)
    const a = JSON.parse(raw) as Atlas
    if (a.fuente !== fuente) return atlasVacio(fuente)
    return { ...atlasVacio(fuente), ...a }
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
  if (e.aciertos >= 5 && distintas >= 3 && contextos >= 3) return 3
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

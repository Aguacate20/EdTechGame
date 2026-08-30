import type { HerramientaId } from './tools'
import type { SelloId } from './powers'

/* ==========================================================================
   Guardar la expedición a medias.
   El tiempo es la razón de abandono más citada en cursos en línea, así que
   poder salir y volver importa más que casi cualquier mecánica. Se guarda el
   estado del mapa, no el del combate: si te vas a mitad de una sala, vuelves
   al inicio de esa sala. Guardar un tablero a medio trazar sería frágil y no
   compensa la complejidad.
   ========================================================================== */

const CLAVE = 'archivo-infinito:expedicion:v1'

export interface ExpedicionGuardada {
  fuente: string
  semilla: string
  runId: string
  actoIdx: number
  alcanzables: string[]
  visitados: string[]
  nodoActual: string | null
  lucidez: number
  aprendizaje: boolean
  /** el equipo de ESTA expedición: no se hereda a la siguiente */
  lentes: string[]
  sellos: SelloId[]
  herramientas: HerramientaId[]
  manoExtra: number
  casos: string[]
  tesis: string[]
  fusionados: string[]
  intuiciones: string[]
  portadaId?: string
  marcados?: string[]
  archivados?: string[]
  quemasRun?: number
  inferenciasRun?: number
  guardadaEn: number
}

export function guardarExpedicion(e: ExpedicionGuardada): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(e)) } catch { /* sin almacenamiento */ }
}

export function leerExpedicion(fuente: string): ExpedicionGuardada | null {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return null
    const e = JSON.parse(raw) as ExpedicionGuardada
    return e.fuente === fuente ? e : null
  } catch {
    return null
  }
}

export function borrarExpedicion(): void {
  try { localStorage.removeItem(CLAVE) } catch { /* noop */ }
}

export function haceCuanto(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} día(s)`
}

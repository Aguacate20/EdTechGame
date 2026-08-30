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
/** Lo que se APRENDE se conserva; lo que se EQUIPA no.
 *  Los vínculos descubiertos y las intuiciones reubicadas son conocimiento y
 *  viajan con el estudiante. Las lentes, los sellos y las herramientas extra
 *  son poder de partida: cada expedición se arma de nuevo, o no habría run. */
export interface Progreso {
  /** tipos de vínculo que ya descubrió: se desbloquean derribando enemigos */
  relaciones: string[]
  terrenos: string[]
  /** expediciones emprendidas: el carril escala con esto */
  expediciones: number
}

/** Lo que el lector propone y el texto no dice. Vive en su propia capa: no se
 *  mezcla con la evidencia, porque si se mezclara el modelo cognitivo dejaría de
 *  distinguir a quien leyó de quien improvisó. Pero se guarda, se cuenta y se
 *  mira, porque proponer conexiones que el autor no hace es exactamente lo que
 *  hace un lector crítico. */
export interface Propuesta {
  from: string
  to: string
  tipo: string
  motivo: string
  veces: number
  /** el texto acabó dándote la razón: apareció la arista más adelante */
  confirmada: boolean
  ts: number
}

export interface Atlas {
  fuente: string
  progreso: Progreso
  /** capa propia: clave `from|to|tipo` */
  propuestas: Record<string, Propuesta>
  aristas: Record<string, { from: string; to: string; tipo: string; aciertos: number }>
  conceptos: Record<string, EvidenciaConcepto>
  repertoriosEstabilizados: string[]
  runs: number
  victorias: number
  /** historial del mejor diagrama por sala, para poder mostrar tu propia curva */
  mejoresDiagramas: number[]
  apuestasTotales: number
  apuestasCalibradas: number
  /** autorregulación: lo que se declaró y lo que resultó, por fase del ciclo */
  srl: {
    encargosElegidos: number
    encargosCumplidos: number
    /** suma de niveles elegidos: divide por elegidos para ver la ambición media */
    nivelAcumulado: number
    sellosHechos: number
    sellosAcertados: number
    reflexiones: number
    reflexionesAcertadas: number
  }
}

export const PROGRESO_INICIAL: Progreso = {
  // se empieza sabiendo solo respaldar y oponer: el resto se descubre jugando
  relaciones: ['apoya', 'contrasta'],
  terrenos: [],
  expediciones: 0
}

/** Con lo que se arranca cada expedición. El resto se gana jugando. */
export const EQUIPO_INICIAL = {
  lentes: [] as string[],
  sellos: [] as string[],
  herramientas: ['identidad', 'identidad', 'flecha', 'flecha', 'flecha', 'campo'],
  manoExtra: 0
}

export function atlasVacio(fuente: string): Atlas {
  return {
    fuente, progreso: { ...PROGRESO_INICIAL }, propuestas: {}, aristas: {}, conceptos: {},
    repertoriosEstabilizados: [], runs: 0, victorias: 0, mejoresDiagramas: [],
    apuestasTotales: 0, apuestasCalibradas: 0,
    srl: {
      encargosElegidos: 0, encargosCumplidos: 0, nivelAcumulado: 0,
      sellosHechos: 0, sellosAcertados: 0, reflexiones: 0, reflexionesAcertadas: 0
    }
  }
}

export function cargarAtlas(fuente: string): Atlas {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return atlasVacio(fuente)
    const a = JSON.parse(raw) as Atlas
    if (a.fuente !== fuente) return atlasVacio(fuente)
    const base = atlasVacio(fuente)
    return {
      ...base, ...a,
      progreso: { ...base.progreso, ...(a.progreso ?? {}) },
      propuestas: a.propuestas ?? {},
      srl: { ...base.srl, ...(a.srl ?? {}) }
    }
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

/** Guarda una propuesta. Devuelve true si es nueva. */
export function anotarPropuesta(
  a: Atlas, p: { from: string; to: string; tipo: string; motivo: string }
): boolean {
  const k = `${p.from}|${p.to}|${p.tipo}`
  const ya = a.propuestas[k]
  if (ya) { ya.veces += 1; return false }
  a.propuestas[k] = { ...p, veces: 1, confirmada: false, ts: Date.now() }
  return true
}

/** ¿Alguna propuesta anterior acaba de aparecer en el texto?
 *  Es el mejor momento del sistema: lo que aventuraste hace tres salas resulta
 *  que estaba ahí. Se marca y se paga. */
export function confirmarPropuestas(
  a: Atlas, aristas: { from: string; to: string; tipo: string }[]
): Propuesta[] {
  const nuevas: Propuesta[] = []
  for (const ar of aristas) {
    for (const k of [`${ar.from}|${ar.to}|${ar.tipo}`, `${ar.to}|${ar.from}|${ar.tipo}`]) {
      const p = a.propuestas[k]
      if (p && !p.confirmada) { p.confirmada = true; nuevas.push(p) }
    }
  }
  return nuevas
}

export const contarPropuestas = (a: Atlas) => {
  const t = Object.values(a.propuestas)
  return { total: t.length, confirmadas: t.filter((x) => x.confirmada).length }
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

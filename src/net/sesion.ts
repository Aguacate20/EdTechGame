/* Sesión del estudiante: nombre + código de jugador + campo. Sin contraseña.
 * Vive en localStorage y en el backend (POST /students). El Atlas se
 * sincroniza con POST/GET /students/{id}/atlas por campo, así el mismo
 * estudiante puede seguir en otro dispositivo y el profesor lo ve. */
import type { Atlas } from '../engine/atlas'

export interface Sesion {
  api: string
  nombre: string
  studentId: string
  codigoJugador: string
  /** código de 6 caracteres del campo temático; '' = bundle cargado a mano */
  campo: string
  campoId: string
  campoNombre: string
}

const CLAVE = 'ludus:sesion'
export const API_POR_DEFECTO = 'https://aguacate20-edtech-extractor.hf.space'

export function leerSesion(): Sesion | null {
  try {
    const raw = localStorage.getItem(CLAVE)
    return raw ? (JSON.parse(raw) as Sesion) : null
  } catch { return null }
}
export function guardarSesion(s: Sesion): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(s)) } catch { /* sin almacenamiento */ }
}
export function cerrarSesion(): void {
  try { localStorage.removeItem(CLAVE) } catch { /* noop */ }
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!r.ok) {
    let detalle = `${r.status}`
    try { detalle = ((await r.json()) as { detail?: string }).detail ?? detalle } catch { /* sin cuerpo */ }
    throw new Error(detalle)
  }
  return (await r.json()) as T
}

/** Crea el perfil o lo recupera (nombre + código de jugador). */
export async function entrar(api: string, nombre: string, codigoJugador?: string): Promise<{ studentId: string; codigoJugador: string }> {
  const r = await json<{ id: string; codigo_jugador: string }>(`${api}/students`, {
    method: 'POST',
    body: JSON.stringify({ display_name: nombre, ...(codigoJugador ? { codigo_jugador: codigoJugador } : {}) })
  })
  return { studentId: String(r.id), codigoJugador: r.codigo_jugador }
}

/** El bundle del campo temático detrás de un código. */
export async function cargarCampo(api: string, codigo: string): Promise<{ campoId: string; nombre: string; bundle: unknown }> {
  const r = await json<{ course_id: string; nombre: string | null; bundle: unknown }>(`${api}/campos/${encodeURIComponent(codigo)}`)
  return { campoId: String(r.course_id), nombre: r.nombre ?? codigo, bundle: r.bundle }
}

export async function bajarAtlas(s: Sesion): Promise<Atlas | null> {
  if (!s.campoId) return null
  try {
    const r = await json<{ atlas: Atlas | null }>(`${s.api}/students/${s.studentId}/atlas?campo=${encodeURIComponent(s.campoId)}`)
    return r.atlas ?? null
  } catch { return null }
}

let temporizador: number | null = null
/** Sube el Atlas sin bloquear: agrupa cambios en 4 s y usa keepalive para
 *  que el último POST sobreviva al cierre de la pestaña. */
export function subirAtlas(s: Sesion | null, atlas: Atlas): void {
  if (!s?.campoId || typeof fetch !== 'function') return
  if (temporizador) window.clearTimeout(temporizador)
  temporizador = window.setTimeout(() => {
    temporizador = null
    fetch(`${s.api}/students/${s.studentId}/atlas`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campo: s.campoId, atlas })
    }).catch(() => { /* sin red: el Atlas sigue en localStorage y se reintenta al siguiente cambio */ })
  }, 4000)
}

/** ¿Cuál de los dos Atlas lleva más camino? El que tenga más expediciones y
 *  más registros; en empate, el remoto (viene de otro dispositivo). */
export function masAvanzado(local: Atlas, remoto: Atlas | null): Atlas {
  if (!remoto) return local
  const peso = (a: Atlas) => (a.runs ?? 0) * 1000 + Object.keys(a.conceptos ?? {}).length * 10 + Object.keys(a.aristas ?? {}).length
  return peso(remoto) >= peso(local) ? remoto : local
}

/* ── lo que muestra la barra ── */
export function lucidezDe(a: Atlas | null): number {
  if (!a || !a.apuestasTotales) return 0
  return Math.round((100 * a.apuestasCalibradas) / a.apuestasTotales)
}
export function xpDe(a: Atlas | null): number {
  if (!a) return 0
  const aristas = Object.values(a.aristas ?? {}).reduce((n, x) => n + (x.aciertos ?? 0), 0)
  return a.victorias * 120 + Object.keys(a.conceptos ?? {}).length * 15 + aristas * 10 + (a.hazanas?.length ?? 0) * 60
}
export function nivelDe(xp: number): { nivel: number; enNivel: number; paraSiguiente: number } {
  const nivel = 1 + Math.floor(xp / 400)
  return { nivel, enNivel: xp - (nivel - 1) * 400, paraSiguiente: 400 }
}
export function hallazgosDe(a: Atlas | null): number {
  if (!a) return 0
  return Object.keys(a.aristas ?? {}).length + Object.keys(a.propuestas ?? {}).length
}

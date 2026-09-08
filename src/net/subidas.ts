/* Subidas que sobreviven a cualquier pantalla. El archivo se sube una vez;
 * después el extractor trabaja en el servidor y aquí solo se sigue el job.
 * Este módulo vive fuera de React (una lista + un sondeo), se guarda en
 * localStorage por perfil y cualquier componente se suscribe con
 * `useSubidas()`. Cambiar de menú o empezar una expedición no lo toca. */
import { useSyncExternalStore } from 'react'
import { estadoJob, subirDocumento, type Sesion } from './sesion'

export interface Subida {
  jobId: string
  nombre: string
  inicio: number
  estado: 'subiendo' | 'procesando' | 'lista' | 'aplicada' | 'error'
  fraccion: number
  capa: string | null
  error: string | null
}

const CAPAS: Record<string, string> = {
  layer1_concepts: 'Conceptos', layer1b_distinctions: 'Distinciones', layer1c_canonical: 'Unificando términos',
  layer2_relations: 'Relaciones', layer3_repertoires: 'Intuiciones cotidianas', layer4_arguments: 'Tesis y marcos',
  layer5_cases: 'Casos', layer5b_scenarios: 'Escenarios', compile: 'Compilando el mapa'
}
export const nombreCapa = (k: string | null) => (k ? CAPAS[k] ?? k.replace(/^layer\d\w*_/, '') : 'Leyendo el texto')

let sesion: Sesion | null = null
let lista: Subida[] = []
let oyentes = new Set<() => void>()
let sondeo: number | null = null

const clave = () => `ludus:subidas:${sesion?.studentId ?? 'anon'}`
function emitir() { oyentes.forEach((f) => f()) }
function persistir() { try { localStorage.setItem(clave(), JSON.stringify(lista)) } catch { /* sin almacenamiento */ } }
function fijar(nueva: Subida[]) { lista = nueva; persistir(); emitir(); vigilar() }

/** Al entrar con un perfil: recupera las subidas pendientes de ese perfil. */
export function iniciarSubidas(s: Sesion | null): void {
  sesion = s
  try { lista = s ? (JSON.parse(localStorage.getItem(clave()) ?? '[]') as Subida[]) : [] } catch { lista = [] }
  emitir(); vigilar()
}

export async function subir(archivo: File): Promise<void> {
  if (!sesion) return
  const temporal: Subida = { jobId: `local:${Date.now()}`, nombre: archivo.name, inicio: Date.now(), estado: 'subiendo', fraccion: 0, capa: null, error: null }
  fijar([...lista, temporal])
  try {
    const jobId = await subirDocumento(sesion.api, sesion.studentId, archivo)
    fijar(lista.map((x) => (x === temporal ? { ...x, jobId, estado: 'procesando' } : x)))
  } catch (e) {
    fijar(lista.map((x) => (x === temporal ? { ...x, estado: 'error', error: e instanceof Error ? e.message : 'No se pudo subir.' } : x)))
  }
}

export function marcarAplicada(jobId: string): void { fijar(lista.map((x) => (x.jobId === jobId ? { ...x, estado: 'aplicada' } : x))) }
export function quitar(jobId: string): void { fijar(lista.filter((x) => x.jobId !== jobId)) }

function vigilar() {
  const activas = lista.some((x) => x.estado === 'procesando')
  if (activas && sondeo === null) sondeo = window.setInterval(sondear, 3000)
  if (!activas && sondeo !== null) { window.clearInterval(sondeo); sondeo = null }
}
async function sondear() {
  if (!sesion) return
  for (const x of lista.filter((s) => s.estado === 'procesando')) {
    try {
      const j = await estadoJob(sesion.api, x.jobId) as { status: string; error?: string | null; progreso?: { fraccion?: number; ultima?: { layer?: string } | null } }
      const p = j.progreso
      if (j.status === 'completed' || j.status === 'done' || j.status === 'ok') fijar(lista.map((s) => (s.jobId === x.jobId ? { ...s, estado: 'lista', fraccion: 1, capa: null } : s)))
      else if (j.status === 'failed' || j.status === 'error') fijar(lista.map((s) => (s.jobId === x.jobId ? { ...s, estado: 'error', error: j.error || 'La extracción falló.' } : s)))
      else if (p) fijar(lista.map((s) => (s.jobId === x.jobId ? { ...s, fraccion: p.fraccion ?? s.fraccion, capa: p.ultima?.layer ?? s.capa } : s)))
    } catch { /* sin red: se reintenta en el siguiente sondeo */ }
  }
}

export function useSubidas(): Subida[] {
  return useSyncExternalStore(
    (f) => { oyentes.add(f); return () => { oyentes.delete(f) } },
    () => lista,
    () => lista
  )
}

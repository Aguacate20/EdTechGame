import type { Arista, Contenido } from '../content/types'
import type { Atlas } from './atlas'

/* ==========================================================================
   v6.24 · Aprendizaje significativo.

   El modo aprendizaje comprobaba que el estudiante RECONOCE vínculos. Estas
   piezas le piden además construir significado, y dejan cada cosa como señal
   propia (nada de esto toca la calibración):

   · predecir antes de entrar y volver a responder al salir (lo que cambió)
   · el porqué: qué frase del texto respalda un vínculo recién sostenido
   · repaso espaciado de constelaciones ya cristalizadas (intervalos crecientes)
   · el andamio arranca según lo que el Atlas dice que ya domina
   ========================================================================== */

const FRASE: Record<string, string> = {
  apoya: 'respalda a', causa: 'produce', requiere: 'necesita', contrasta: 'se opone a',
  generaliza: 'es la categoría que contiene a', ejemplifica: 'es un ejemplo de',
  extiende: 'amplía a', matiza: 'matiza a'
}
const TIPOS = Object.keys(FRASE)
const SIMETRICOS = ['contrasta']
const t = (c: Contenido, id: string) => c.conceptos[id]?.titulo ?? id
export const fraseVinculo = (c: Contenido, from: string, to: string, tipo: string) =>
  `«${t(c, from)}» ${FRASE[tipo] ?? tipo} «${t(c, to)}»`
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
function barajar<T>(xs: T[], semilla: string): T[] {
  // el índice se mezcla con multiplicación: sumar el índice al final del hash conservaba el orden
  const h = hash(semilla)
  return xs.map((x, i) => ({ x, k: Math.imul(h ^ Math.imul(i + 1, 0x9E3779B1), 0x85EBCA6B) >>> 0 })).sort((a, b) => a.k - b.k).map((o) => o.x)
}
export const claveArista = (a: { from: string; to: string; tipo: string }) => `${a.from}>${a.to}>${a.tipo}`

export interface OpcionVinculo { texto: string; ok: boolean }
export interface PreguntaVinculo { clave: string; arista: Arista; enunciado: string; opciones: OpcionVinculo[] }

/** Una pregunta de tres opciones sobre un vínculo real del texto: el verdadero, el mismo con
 *  otro tipo, y el mismo al revés (o con otro concepto de la sala si el tipo es simétrico). */
export function preguntaDeArista(c: Contenido, a: Arista, sala: string[], enunciado: string): PreguntaVinculo {
  const otroTipo = TIPOS.filter((x) => x !== a.tipo)[hash(claveArista(a)) % (TIPOS.length - 1)]
  const ajeno = sala.find((id) => id !== a.from && id !== a.to && c.conceptos[id] &&
    !c.aristas.some((x) => (x.from === a.from && x.to === id) || (x.from === id && x.to === a.from)))
  const tercero = !SIMETRICOS.includes(a.tipo)
    ? fraseVinculo(c, a.to, a.from, a.tipo)
    : ajeno ? fraseVinculo(c, a.from, ajeno, a.tipo) : fraseVinculo(c, a.from, a.to, TIPOS.filter((x) => x !== a.tipo && x !== otroTipo)[0])
  const opciones = barajar<OpcionVinculo>([
    { texto: fraseVinculo(c, a.from, a.to, a.tipo), ok: true },
    { texto: fraseVinculo(c, a.from, a.to, otroTipo), ok: false },
    { texto: tercero, ok: false }
  ], claveArista(a))
  return { clave: claveArista(a), arista: a, enunciado, opciones }
}

/** La predicción del Vistazo: el vínculo más firme del concepto que organiza la sala. Es la
 *  MISMA pregunta que se vuelve a hacer en el cierre, para poder comparar antes y después. */
export function prediccionDe(c: Contenido, sala: string[], focoId: string): PreguntaVinculo | null {
  const enSala = (id: string) => sala.includes(id)
  const cand = c.aristas
    .filter((a) => (a.from === focoId || a.to === focoId) && c.conceptos[a.from] && c.conceptos[a.to])
    .sort((x, y) => (Number(enSala(y.from) && enSala(y.to)) - Number(enSala(x.from) && enSala(x.to))) || (y.confianza - x.confianza))
  const a = cand[0]
  if (!a) return null
  return preguntaDeArista(c, a, sala, `Antes de ver nada: ¿qué crees que dice el texto sobre «${t(c, focoId)}»?`)
}

export interface PreguntaPorque { clave: string; enunciado: string; opciones: OpcionVinculo[] }
const textoDe = (a: Arista) => ((a as Arista & { evidencia?: string }).evidencia || a.descripcion || '').trim()

/** El porqué de un vínculo sostenido: tres frases, y solo una es la que lo respalda. Las
 *  otras dos son de vínculos vecinos (comparten concepto), que es donde de verdad se duda. */
export function porqueDe(c: Contenido, v: { from: string; to: string; tipo: string }): PreguntaPorque | null {
  const a = c.aristas.find((x) => x.from === v.from && x.to === v.to && x.tipo === v.tipo)
    ?? c.aristas.find((x) => (x.from === v.from && x.to === v.to) || (x.from === v.to && x.to === v.from))
  if (!a || textoDe(a).length < 14) return null
  const toca = (x: Arista) => [x.from, x.to].some((id) => id === a.from || id === a.to)
  const otros = c.aristas
    .filter((x) => x !== a && !(x.from === a.from && x.to === a.to) && !(x.from === a.to && x.to === a.from) && textoDe(x).length >= 14 && textoDe(x) !== textoDe(a))
    .sort((x, y) => Number(toca(y)) - Number(toca(x)) || hash(claveArista(x)) - hash(claveArista(y)))
  const vistos = new Set<string>(); const distractores: string[] = []
  for (const x of otros) { const s = textoDe(x); if (!vistos.has(s)) { vistos.add(s); distractores.push(s) } if (distractores.length === 2) break }
  if (distractores.length < 2) return null
  return {
    clave: claveArista(a),
    enunciado: `Sostuviste que ${fraseVinculo(c, a.from, a.to, a.tipo)}. ¿Cuál de estas frases es la que lo respalda?`,
    opciones: barajar<OpcionVinculo>([{ texto: textoDe(a), ok: true }, ...distractores.map((s) => ({ texto: s, ok: false }))], `pq:${claveArista(a)}`)
  }
}

/* ------------------------------ repaso espaciado ------------------------------ */
const DIA = 24 * 60 * 60 * 1000
/** días hasta el siguiente repaso según cuántos aciertos seguidos lleva */
export const INTERVALOS = [1, 3, 7, 16, 35]
type Constelacion = NonNullable<Atlas['constelaciones']>[number]
const racha = (k: Constelacion) => { let n = 0; for (const r of [...(k.repasos ?? [])].reverse()) { if (!r.ok) break; n++ } return n }
const ultimaVez = (k: Constelacion) => (k.repasos?.length ? k.repasos[k.repasos.length - 1].fecha : k.fecha)
export const venceEn = (k: Constelacion) => ultimaVez(k) + INTERVALOS[Math.min(racha(k), INTERVALOS.length - 1)] * DIA

export interface Repaso { constId: string; nombre: string; dias: number; pregunta: PreguntaVinculo }
/** La constelación más vencida, con una pregunta de recuperación sobre uno de sus vínculos.
 *  Sin ayudas: se responde de memoria, y la respuesta fija cuándo vuelve a tocar. */
export function repasoDe(c: Contenido, atlas: Atlas, ahora = Date.now()): Repaso | null {
  const vencidas = (atlas.constelaciones ?? []).filter((k) => venceEn(k) <= ahora).sort((x, y) => venceEn(x) - venceEn(y))
  for (const k of vencidas) {
    const dentro = c.aristas.filter((a) => k.conceptIds.includes(a.from) && k.conceptIds.includes(a.to))
    if (!dentro.length) continue
    const a = dentro[(k.repasos?.length ?? 0) % dentro.length]
    return {
      constId: k.id, nombre: k.nombre, dias: Math.max(1, Math.round((ahora - ultimaVez(k)) / DIA)),
      pregunta: preguntaDeArista(c, a, k.conceptIds, `De memoria, sin mirar: ¿cuál de estas sostuviste en «${k.nombre}»?`)
    }
  }
  return null
}
export function anotarRepaso(atlas: Atlas, constId: string, ok: boolean, ahora = Date.now()): Atlas {
  return {
    ...atlas,
    constelaciones: (atlas.constelaciones ?? []).map((k) => k.id === constId ? { ...k, repasos: [...(k.repasos ?? []), { fecha: ahora, ok }] } : k),
    srl: { ...atlas.srl, repasosHechos: (atlas.srl.repasosHechos ?? 0) + 1, repasosAcertados: (atlas.srl.repasosAcertados ?? 0) + (ok ? 1 : 0) }
  }
}

/** Con cuánto andamio arranca la sala: 0 total · 1 parcial · 2 ninguno, según qué parte de
 *  sus conceptos ya tiene evidencia en el Atlas. El apoyo que ya no hace falta es muleta. */
export function apoyoInicial(conceptIds: string[], sinTocar: string[]): 0 | 1 | 2 {
  if (!conceptIds.length) return 0
  const conocidos = conceptIds.filter((id) => !sinTocar.includes(id)).length / conceptIds.length
  return conocidos >= 0.8 ? 2 : conocidos >= 0.5 ? 1 : 0
}

/** suma contadores de autorregulación sin tocar los demás */
export function sumarSrl(atlas: Atlas, mas: Partial<Record<keyof Atlas['srl'], number>>): Atlas {
  const srl = { ...atlas.srl }
  for (const [k, n] of Object.entries(mas) as [keyof Atlas['srl'], number][]) srl[k] = ((srl[k] as number | undefined) ?? 0) + n
  return { ...atlas, srl }
}

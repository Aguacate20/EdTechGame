/* Simulación del gradiente de recompensa: ¿qué paga cada clase de jugada?
 *
 *   npm run creativo                       → bundle de muestra
 *   npm run creativo -- ruta/al/bundle.json → cualquier bundle 1.0.0 o 1.1.0
 *
 * Enumera todas las jugadas de UNA sola pieza de tiempo (un trazo) que un lector
 * podría hacer, por clase, y las pasa por el juez real (`evaluarDiagrama`, sin
 * lentes). Para cada clase imprime cuántas hay, qué veredictos reciben, cuánto
 * daño hacen en promedio y qué fracción hace cero. Es el mapa de incentivos:
 * si la jugada más fácil es la que más paga, el juego empuja hacia ella.
 *
 * Luego aplica un GRADIENTE PROPUESTO sobre las mismas jugadas (sin tocar el
 * motor): criterios y objeciones con conceptos (juzgables por membresía), y
 * propuestas pagadas por distancia estructural. Compara. No cambia nada del
 * juego: es un instrumento para decidir.
 */
import { readFileSync } from 'node:fs'
import { adaptarBundle } from '../src/content/adapter'
import type { Contenido } from '../src/content/types'
import { evaluarDiagrama, type Trazo } from '../src/engine/tools'
import { juzgarVinculo, gemelosDe } from '../src/engine/graph'
import {
  piezaConcepto, piezaEtiqueta, piezaDefinicion, piezaApocrifa, piezaCaso, piezaTesis,
  piezasCriterio, piezaMarco, type Pieza
} from '../src/engine/pieces'
import { Rng } from '../src/engine/rng'

const ruta = process.argv[2] ?? 'public/bundles/demo.json'
const c: Contenido = adaptarBundle(JSON.parse(readFileSync(ruta, 'utf8')))
const rng = new Rng('creativo')
const TIPOS = ['apoya', 'contrasta', 'causa', 'requiere', 'extiende', 'ejemplifica', 'generaliza', 'matiza', 'antecede']

// ── utilidades de grafo ────────────────────────────────────────────────────
const firme = (a: string, b: string) => c.aristas.find((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a))
const vecinos = (id: string) => new Set(c.aristas.filter((x) => x.from === id || x.to === id).map((x) => (x.from === id ? x.to : x.from)))
const clusterDe = (id: string) => c.clusters.find((k) => k.conceptIds.includes(id))?.id ?? null
const unidadDe = (id: string) => c.unidades.find((u) => u.conceptIds.includes(id))?.id ?? null
const comparten = (a: string, b: string) => [...vecinos(a)].some((v) => vecinos(b).has(v))
/** distancia estructural 0..3: mismo cluster+vecino común / mismo cluster / otra zona+vecino común / lejos */
const distancia = (a: string, b: string): number => {
  const mismoCluster = clusterDe(a) && clusterDe(a) === clusterDe(b)
  const vc = comparten(a, b)
  if (mismoCluster && vc) return 0
  if (mismoCluster) return 1
  if (vc) return 2
  return 3
}

// ── jugadas ────────────────────────────────────────────────────────────────
interface Jugada { clase: string; piezas: Pieza[]; trazo: Trazo; etiqueta: string; dist?: number }
const jugadas: Jugada[] = []
const trazo = (tool: Trazo['tool'], piezas: Pieza[], param: string | null): Trazo =>
  ({ uid: 't', tool, piezas: piezas.map((p) => p.uid), param })
const add = (clase: string, piezas: Pieza[], tool: Trazo['tool'], param: string | null, etiqueta: string, dist?: number) => {
  if (piezas.some((p) => !p)) return
  jugadas.push({ clase, piezas, trazo: trazo(tool, piezas, param), etiqueta, dist })
}

const ids = c.ordenConceptos
// A. identidad (la jugada más básica) — etiqueta + definición del mismo concepto
for (const id of ids) add('A identidad', [piezaEtiqueta(c, id)!, piezaDefinicion(c, id)!], 'identidad', null, c.conceptos[id].titulo)
// B. flecha firme: lo que el texto afirma, con el tipo exacto
for (const a of c.aristas) add('B flecha firme', [piezaConcepto(c, a.from)!, piezaConcepto(c, a.to)!], 'flecha', a.tipo, `${a.from} ${a.tipo} ${a.to}`)
// C. flecha insinuada: lo que el extractor infirió (bundle 1.1.0)
for (const a of c.insinuadas) if (!firme(a.from, a.to)) add('C flecha insinuada', [piezaConcepto(c, a.from)!, piezaConcepto(c, a.to)!], 'flecha', a.tipo, `${a.from} ${a.tipo} ${a.to}`)
// D. creativa concepto↔concepto: pares SIN arista firme, por distancia estructural
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const a = ids[i], b = ids[j]
  if (firme(a, b) || c.insinuadas.some((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a))) continue
  if (gemelosDe(c, a).includes(b)) continue
  const d = distancia(a, b)
  // un lector creativo elige el tipo con sentido; sin oráculo, muestreamos dos tipos
  for (const tipo of rng.sample(TIPOS, 2)) add(`D creativa d${d}`, [piezaConcepto(c, a)!, piezaConcepto(c, b)!], 'flecha', tipo, `${a} ${tipo} ${b}`, d)
}
// E. cruce de capas: lo que un lector crítico hace y el grafo bipartito no siempre ve
for (const t of c.tesis) {
  const pt = piezaTesis(c, t.id)!
  const crits = piezasCriterio(c, t.id, rng)
  for (const k of crits) {
    const que = k.sentido === 'refuta' ? 'criterio' : 'objeción'
    for (const m of c.marcos) add(`E ${que}↔marco`, [k, piezaMarco(c, m.id)!], 'flecha', 'contrasta', `${que} de ${t.id} contrasta ${m.id}`)
    for (const cid of t.conceptIds.slice(0, 2)) add(`E ${que}↔concepto`, [k, piezaConcepto(c, cid)!], 'flecha', 'matiza', `${que} de ${t.id} matiza ${cid}`)
    for (const caso of c.casos.slice(0, 2)) add(`E ${que}↔caso`, [k, piezaCaso(c, caso.id)!], 'flecha', 'ejemplifica', `${caso.id} ejemplifica ${que} de ${t.id}`)
  }
  for (const m of c.marcos) add('E tesis↔marco', [pt, piezaMarco(c, m.id)!], 'flecha', t.marcoId === m.id ? 'apoya' : 'contrasta', `${t.id} ↔ ${m.id}`)
  for (const caso of c.casos) add('E caso↔tesis', [piezaCaso(c, caso.id)!, pt], 'flecha', 'ejemplifica', `${caso.id} ejemplifica ${t.id}`)
}
for (const m of c.marcos) for (const cid of ids) {
  if (m.conceptIds.includes(cid)) continue
  const rival = c.marcos.filter((r) => m.rivales.includes(r.id)).some((r) => r.conceptIds.includes(cid))
  add(rival ? 'E concepto rival↔marco' : 'E concepto ajeno↔marco', [piezaConcepto(c, cid)!, piezaMarco(c, m.id)!], 'flecha', 'contrasta', `${cid} contrasta ${m.id}`)
}
// F. apócrifa: la trampa de la identidad, para tener el castigo en la misma tabla
for (const id of ids.slice(0, 12)) {
  const ap = piezaApocrifa(c, id, rng); if (!ap) continue
  add('F identidad con apócrifa', [ap, piezaDefinicion(c, id)!], 'identidad', null, id)
}

// ── evaluación ─────────────────────────────────────────────────────────────
interface Fila { n: number; dano: number[]; ceros: number; estados: Record<string, number> }
const filas = new Map<string, Fila>()
const resultado = new Map<Jugada, { estado: string; dano: number; fichas: number; mult: number; nota: string }>()
for (const j of jugadas) {
  const d = evaluarDiagrama(c, j.piezas, [j.trazo])
  const v = d.veredictos[0]
  resultado.set(j, { estado: v.estado, dano: d.dano, fichas: v.fichas, mult: v.mult, nota: v.nota })
  const f = filas.get(j.clase) ?? { n: 0, dano: [], ceros: 0, estados: {} }
  f.n++; f.dano.push(d.dano); if (d.dano === 0) f.ceros++
  f.estados[v.estado] = (f.estados[v.estado] ?? 0) + 1
  filas.set(j.clase, f)
}
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (a: number, b: number) => `${Math.round((100 * a) / Math.max(1, b))}%`
const top = (e: Record<string, number>) => Object.entries(e).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')

console.log(`\n${ruta} · ${ids.length} conceptos · ${c.aristas.length} aristas firmes · ${c.insinuadas.length} insinuadas · ${c.tesis.length} tesis · ${c.marcos.length} marcos · ${c.casos.length} casos\n`)
console.log('GRADIENTE ACTUAL — daño de un trazo solo, sin lentes (fichas × (1 + mult))')
console.log(' clase                        n   daño medio   0 daño   veredictos')
const baseIdentidad = media(filas.get('A identidad')!.dano)
for (const [clase, f] of [...filas.entries()].sort()) {
  console.log(` ${clase.padEnd(26)} ${String(f.n).padStart(4)}   ${media(f.dano).toFixed(1).padStart(7)} (${(media(f.dano) / baseIdentidad).toFixed(2)}× id)  ${pct(f.ceros, f.n).padStart(5)}   ${top(f.estados)}`)
}

// ── el caso de Sebastián, reproducido ─────────────────────────────────────
const caso = jugadas.find((j) => j.clase === 'E objeción↔marco')
if (caso) {
  const r = resultado.get(caso)!
  console.log(`\nEL CASO «objeción contrasta marco» → ${r.estado} · daño ${r.dano}\n   ${r.nota}`)
}

// ── GRADIENTE PROPUESTO (solo simulado) ────────────────────────────────────
// 1. criterios y objeciones llevan conceptIds (los que su texto invoca: aquí
//    por coincidencia de título/sinónimo; en el extractor los daría el LLM).
// 2. juzgarMixto sabe leerlos: si sus conceptos son del marco → «tensión
//    desde dentro» (sostenido, contrasta); si son del rival → sostenido; si
//    solo comparten conceptos con la tesis → convive.
// 3. propuesta concepto↔concepto pagada por distancia: d0 35% (hoy), d1 45%,
//    d2 55%, d3 65% — cuanto más lejos y con más apoyo, más vale.
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const conceptosEn = (texto: string): string[] => {
  const t = norm(texto)
  return ids.filter((id) => {
    const k = c.conceptos[id]
    return [k.titulo, ...(k.sinonimos ?? [])].some((s) => s && s.length > 3 && t.includes(norm(s)))
  })
}
const PROPUESTA_POR_DIST = [0.35, 0.45, 0.55, 0.65]
const filasP = new Map<string, Fila>()
for (const j of jugadas) {
  const r = resultado.get(j)!
  let dano = r.dano, estado = r.estado
  if (j.clase.startsWith('E criterio') || j.clase.startsWith('E objeción')) {
    const k = j.piezas.find((p) => p.clase === 'criterio')!
    const otro = j.piezas.find((p) => p !== k)!
    const invoca = conceptosEn(k.cuerpo)
    const tesis = c.tesis.find((t) => t.id === k.tesisId)!
    const propios = invoca.length ? invoca : tesis.conceptIds
    if (otro.clase === 'marco') {
      const m = c.marcos.find((x) => x.id === otro.refId)!
      const dentro = propios.filter((x) => m.conceptIds.includes(x))
      const rival = propios.filter((x) => c.marcos.filter((z) => m.rivales.includes(z.id)).some((z) => z.conceptIds.includes(x)))
      if (rival.length) { estado = 'sostenido'; dano = Math.round((12 + 2) * (1 + 1.4)) }
      else if (dentro.length) { estado = 'sostenido'; dano = Math.round(12 * (1 + 1.2)) }        // tensión desde dentro
      else if (propios.some((x) => comparten(x, m.conceptIds[0] ?? x))) { estado = 'convive'; dano = Math.round(5 * 1.4) }
      else { estado = 'silencio'; dano = 0 }
    } else if (otro.clase === 'concepto') {
      const cid = otro.conceptId!
      if (propios.includes(cid)) { estado = 'sostenido'; dano = Math.round(14 * (1 + 1.2)) }
      else if (propios.some((x) => vecinos(x).has(cid))) { estado = 'convive'; dano = Math.round(5 * 1.4) }
      else { estado = 'silencio'; dano = 0 }
    } else if (otro.clase === 'caso') {
      const comunes = propios.filter((x) => otro.conceptIds.includes(x))
      if (comunes.length) { estado = 'convive'; dano = Math.round(5 * 1.4) } else { estado = 'silencio'; dano = 0 }
    }
  }
  if (j.clase.startsWith('D creativa') && r.estado === 'propuesta') {
    const base = r.dano / 0.35
    dano = Math.round(base * PROPUESTA_POR_DIST[j.dist ?? 0])
  }
  const f = filasP.get(j.clase) ?? { n: 0, dano: [], ceros: 0, estados: {} }
  f.n++; f.dano.push(dano); if (dano === 0) f.ceros++
  f.estados[estado] = (f.estados[estado] ?? 0) + 1
  filasP.set(j.clase, f)
}
console.log('\nGRADIENTE PROPUESTO — mismas jugadas, criterios con conceptos y propuesta por distancia')
console.log(' clase                        n   daño medio   0 daño   veredictos')
for (const [clase, f] of [...filasP.entries()].sort()) {
  console.log(` ${clase.padEnd(26)} ${String(f.n).padStart(4)}   ${media(f.dano).toFixed(1).padStart(7)} (${(media(f.dano) / baseIdentidad).toFixed(2)}× id)  ${pct(f.ceros, f.n).padStart(5)}   ${top(f.estados)}`)
}
console.log('')

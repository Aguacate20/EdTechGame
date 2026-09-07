/* Auditoría de herramientas: ¿cada una de las 12 tiene validador, material en
 * el bundle y una jugada válida que el motor sostiene?
 *
 *   npm run herramientas                        → bundle de muestra
 *   npm run herramientas -- ruta/al/bundle.json → cualquier bundle
 *
 * Para cada herramienta intenta construir la MEJOR jugada posible con lo que el
 * bundle trae (un caso con sus conceptos, una tesis con su criterio, dos pares
 * con el mismo vínculo…) y la pasa por `evaluarDiagrama` sin lentes. Imprime
 * el veredicto y el daño. Si no hay material, lo dice: eso no es un bug del
 * motor sino un hueco del extractor para ese documento.
 */
import { readFileSync } from 'node:fs'
import { adaptarBundle } from '../src/content/adapter'
import type { Contenido } from '../src/content/types'
import { evaluarDiagrama, HERRAMIENTAS, type HerramientaId, type Trazo } from '../src/engine/tools'
import {
  piezaConcepto, piezaEtiqueta, piezaDefinicion, piezaCaso, piezaTesis, piezasCriterio,
  piezasSubdimension, type Pieza
} from '../src/engine/pieces'
import { Rng } from '../src/engine/rng'

const ruta = process.argv[2] ?? 'public/bundles/demo.json'
const c: Contenido = adaptarBundle(JSON.parse(readFileSync(ruta, 'utf8')))
const rng = new Rng('herramientas')
const ids = c.ordenConceptos
const K = (id: string) => piezaConcepto(c, id)!

interface Prueba { piezas: Pieza[]; param: string | null; material: string }
type Constructor = () => Prueba | null

const arista = (pred: (a: typeof c.aristas[number]) => boolean) => c.aristas.find(pred)

const pruebas: Record<HerramientaId, Constructor> = {
  identidad: () => ids.length ? { piezas: [piezaEtiqueta(c, ids[0])!, piezaDefinicion(c, ids[0])!], param: null, material: 'título + definición' } : null,
  flecha: () => { const a = c.aristas[0]; return a ? { piezas: [K(a.from), K(a.to)], param: a.tipo, material: `${c.aristas.length} aristas firmes` } : null },
  campo: () => {
    const k = c.clusters.find((x) => x.conceptIds.length >= 2)
    return k ? { piezas: k.conceptIds.slice(0, 3).map(K), param: null, material: `${c.clusters.length} clusters` } : null
  },
  jerarquia: () => {
    const padre = ids.find((p) => c.aristas.filter((x) => x.tipo === 'ejemplifica' && x.to === p).length >= 1)
    if (!padre) return null
    const hijos = c.aristas.filter((x) => x.tipo === 'ejemplifica' && x.to === padre).map((x) => x.from)
    return { piezas: [K(padre), ...hijos.slice(0, 2).map(K)], param: null, material: `${c.aristas.filter((x) => x.tipo === 'ejemplifica' || x.tipo === 'generaliza').length} aristas ejemplifica/generaliza` }
  },
  eje: () => {
    const e = c.ejes[0]
    // el eje agrupa piezas que comparten un valor: param = `${ejeId}::${valor}`
    const entradas = e ? Object.entries(e.valores).filter(([id]) => c.conceptos[id]) : []
    const porValor = new Map<string, string[]>()
    for (const [id, val] of entradas) porValor.set(String(val), [...(porValor.get(String(val)) ?? []), id])
    const grupo = [...porValor.entries()].find(([, xs]) => xs.length >= 2)
    if (!e || !grupo) return null
    return { piezas: grupo[1].slice(0, 3).map(K), param: `${e.id}::${grupo[0]}`, material: `${c.ejes.length} ejes` }
  },
  secuencia: () => {
    const cadena = (a: string) => {
      const out = [a]
      for (let i = 0; i < 3; i++) {
        const sig = arista((x) => x.from === out[out.length - 1] && ['antecede', 'causa', 'requiere'].includes(x.tipo) && !out.includes(x.to))
        if (!sig) break
        out.push(sig.to)
      }
      return out
    }
    const mejor = ids.map(cadena).sort((a, b) => b.length - a.length)[0]
    return mejor && mejor.length >= 3 ? { piezas: mejor.slice(0, 4).map(K), param: null, material: `cadena de ${mejor.length} por antecede/causa/requiere` } : null
  },
  ancla: () => {
    const caso = c.casos.find((k) => k.conceptIds.length >= 1)
    return caso ? { piezas: [piezaCaso(c, caso.id)!, ...caso.conceptIds.slice(0, 2).map(K)], param: null, material: `${c.casos.length} casos` } : null
  },
  balanza: () => {
    const t = c.tesis.find((x) => x.criteriosRefutacion.length >= 1)
    if (!t) return null
    const crit = piezasCriterio(c, t.id, rng).find((p) => p.sentido === 'refuta')
    return crit ? { piezas: [piezaTesis(c, t.id)!, crit], param: null, material: `${c.tesis.length} tesis con criterios` } : null
  },
  contraejemplo: () => {
    const caso = c.casos.find((k) => k.conceptIds.length >= 1)
    if (!caso) return null
    const ajeno = ids.find((id) => !caso.conceptIds.includes(id))
    return ajeno ? { piezas: [piezaCaso(c, caso.id)!, K(ajeno)], param: null, material: `${c.casos.length} casos` } : null
  },
  analogia: () => {
    for (const a1 of c.aristas) for (const a2 of c.aristas) {
      if (a1 === a2 || a1.tipo !== a2.tipo) continue
      if (new Set([a1.from, a1.to, a2.from, a2.to]).size < 4) continue
      return { piezas: [a1.from, a1.to, a2.from, a2.to].map(K), param: null, material: `pares con el mismo vínculo («${a1.tipo}»)` }
    }
    return null
  },
  alcance: () => {
    const m = arista((x) => x.tipo === 'matiza')
    if (m) return { piezas: [K(m.to), K(m.from)], param: null, material: 'arista matiza' }
    for (const id of ids) for (const t of c.conceptos[id].tensiones ?? []) {
      const otro = ids.find((o) => o !== id && t.toLowerCase().includes(c.conceptos[o].titulo.toLowerCase()))
      if (otro) return { piezas: [K(id), K(otro)], param: null, material: 'tensión que nombra a otro concepto' }
    }
    return null
  },
  descomposicion: () => {
    const id = ids.find((x) => (c.conceptos[x].subdimensiones ?? []).length >= 2)
    if (!id) return null
    const partes = piezasSubdimension(c, id).slice(0, 2)
    return { piezas: [K(id), ...partes], param: null, material: `${ids.filter((x) => (c.conceptos[x].subdimensiones ?? []).length).length} conceptos con subdimensiones` }
  }
}

console.log(`\n${ruta} · ${ids.length} conceptos · ${c.aristas.length} aristas · ${c.clusters.length} clusters · ${c.ejes.length} ejes · ${c.casos.length} casos · ${c.tesis.length} tesis\n`)
console.log(' herramienta      material en el bundle                       veredicto     daño  nota')
let sinMaterial = 0, mudas = 0
for (const id of Object.keys(HERRAMIENTAS) as HerramientaId[]) {
  const h = HERRAMIENTAS[id]
  const p = pruebas[id]()
  if (!p || p.piezas.some((x) => !x)) {
    sinMaterial++
    console.log(` ${h.glifo} ${h.nombre.padEnd(14)} ${'— sin material en este bundle —'.padEnd(43)} ${'(no se prueba)'.padEnd(13)}`)
    continue
  }
  const trazo: Trazo = { uid: 't', tool: id, piezas: p.piezas.map((x) => x.uid), param: p.param }
  const d = evaluarDiagrama(c, p.piezas, [trazo])
  const v = d.veredictos[0]
  if (v.estado === 'silencio') mudas++
  console.log(` ${h.glifo} ${h.nombre.padEnd(14)} ${p.material.padEnd(43)} ${v.estado.padEnd(13)} ${String(d.dano).padStart(4)}  ${v.nota.slice(0, 70)}`)
}
console.log(`\n ${12 - sinMaterial} herramientas probadas · ${sinMaterial} sin material en este bundle · ${mudas} mudas con material (eso sí sería un bug)\n`)

/* Temas del plan. Un perfil junta muchas lecturas; la galaxia las separa sola
 * (dos textos sin vínculos caen en zonas distintas) pero la expedición debe
 * saberlo: una sala no puede mezclar Los Juegos del Hambre con psicología.
 *
 * Regla: dos documentos son el MISMO tema si comparten al menos un concepto
 * fusionado (`fuentes` con los dos ids). Si el bundle no trae fuentes
 * (un solo texto, o versiones viejas), el tema es la componente conexa del
 * grafo. Los temas pequeños (< 4 conceptos) se pegan al tema con el que más
 * vínculos tienen, para no dejar migajas. */
import type { Contenido } from '../content/types'

export interface Tema { id: string; nombre: string; conceptIds: string[]; documentos: string[] }

class UF {
  p = new Map<string, string>()
  find(x: string): string { const p = this.p.get(x) ?? x; if (p === x) return x; const r = this.find(p); this.p.set(x, r); return r }
  union(a: string, b: string) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb) }
}

export function temasDe(c: Contenido): Tema[] {
  const ids = c.ordenConceptos
  const conFuentes = ids.some((id) => (c.conceptos[id].fuentes ?? []).length > 0)
  const uf = new UF()
  if (conFuentes) {
    for (const id of ids) {
      const fs = c.conceptos[id].fuentes ?? []
      for (let i = 1; i < fs.length; i++) uf.union(fs[0], fs[i])
    }
  } else {
    for (const x of [...c.aristas, ...(c.insinuadas ?? [])]) uf.union(x.from, x.to)
  }
  const grupos = new Map<string, string[]>()
  for (const id of ids) {
    const fs = c.conceptos[id].fuentes ?? []
    const raiz = conFuentes ? (fs.length ? uf.find(fs[0]) : '__sin_fuente') : uf.find(id)
    grupos.set(raiz, [...(grupos.get(raiz) ?? []), id])
  }
  let temas = [...grupos.entries()].map(([raiz, cids]) => ({ raiz, cids }))
  // las migajas se pegan al tema con el que más vínculos tienen
  const grandes = temas.filter((t) => t.cids.length >= 4)
  if (grandes.length) {
    for (const t of temas.filter((t) => t.cids.length < 4)) {
      const mejor = grandes.map((g) => ({ g, n: c.aristas.filter((x) => (t.cids.includes(x.from) && g.cids.includes(x.to)) || (t.cids.includes(x.to) && g.cids.includes(x.from))).length }))
        .sort((a, b) => b.n - a.n)[0]
      mejor.g.cids.push(...t.cids)
    }
    temas = grandes
  }
  return temas
    .sort((a, b) => b.cids.length - a.cids.length)
    .map((t, i) => {
      const docs = [...new Set(t.cids.flatMap((id) => c.conceptos[id].fuentes ?? []))]
      // el nombre del tema: su concepto más conectado
      const grado = (id: string) => c.aristas.filter((x) => x.from === id || x.to === id).length
      const eje = [...t.cids].sort((a, b) => grado(b) - grado(a) || c.conceptos[b].importancia - c.conceptos[a].importancia)[0]
      return { id: `tema_${i + 1}`, nombre: c.conceptos[eje]?.titulo ?? `Tema ${i + 1}`, conceptIds: t.cids, documentos: docs }
    })
}

/** El contenido recortado a un tema: solo sus conceptos y lo que los toca.
 *  El Atlas no se recorta: es del perfil y va por ids. */
export function recortar(c: Contenido, tema: Tema): Contenido {
  const dentro = new Set(tema.conceptIds)
  const alguno = (ids: string[]) => ids.some((x) => dentro.has(x))
  const conceptos: Contenido['conceptos'] = {}
  for (const id of tema.conceptIds) conceptos[id] = c.conceptos[id]
  return {
    ...c,
    conceptos,
    ordenConceptos: c.ordenConceptos.filter((id) => dentro.has(id)),
    aristas: c.aristas.filter((x) => dentro.has(x.from) && dentro.has(x.to)),
    insinuadas: (c.insinuadas ?? []).filter((x) => dentro.has(x.from) && dentro.has(x.to)),
    coocurrencias: c.coocurrencias,
    unidades: c.unidades.map((u) => ({ ...u, conceptIds: u.conceptIds.filter((id) => dentro.has(id)) })).filter((u) => u.conceptIds.length > 0),
    clusters: c.clusters.map((k) => ({ ...k, conceptIds: k.conceptIds.filter((id) => dentro.has(id)) })).filter((k) => k.conceptIds.length > 0),
    repertorios: c.repertorios.filter((r) => dentro.has(r.conceptId)),
    casos: c.casos.filter((k) => alguno(k.conceptIds)).map((k) => ({ ...k, conceptIds: k.conceptIds.filter((id) => dentro.has(id)) })),
    escenarios: c.escenarios.filter((e) => alguno(e.conceptIds)).map((e) => ({ ...e, conceptIds: e.conceptIds.filter((id) => dentro.has(id)) })),
    tesis: c.tesis.filter((t) => alguno(t.conceptIds)).map((t) => ({ ...t, conceptIds: t.conceptIds.filter((id) => dentro.has(id)) })),
    marcos: c.marcos.filter((m) => alguno(m.conceptIds)).map((m) => ({ ...m, conceptIds: m.conceptIds.filter((id) => dentro.has(id)) })),
    ejes: c.ejes.map((e) => ({ ...e, valores: Object.fromEntries(Object.entries(e.valores).filter(([id]) => dentro.has(id))) })).filter((e) => Object.keys(e.valores).length >= 2)
  }
}

/* Flexibilidad y creatividad por teoría de grafos (v5.99).
 *
 * Los validadores dicen sí o no contra la lista del texto. Esta capa corre después y,
 * para lo que quedó sin crédito, mide la DISTANCIA al texto con lo que el bundle ya
 * trae —vecinos, zonas, padres comunes, insinuadas, casos y tesis compartidos, no-vínculos—
 * y convierte el «no» en una escalera: derivado (se sigue del texto), aproximado (opera al
 * lado), plausible (hay apoyo). Cada veredicto abierto así se marca como inferencia: es una
 * propuesta del estudiante, y las propuestas con apoyo valen.
 *
 * Nada de esto inventa: solo lee el grafo. Y todo se explica en la nota. */
import type { Contenido } from '../content/types'
import type { Pieza } from './pieces'
import type { Veredicto } from './tools'

const TRANSITIVOS = new Set(['causa', 'generaliza', 'requiere', 'antecede', 'es_parte_de'])

const vecinos = (c: Contenido, id: string) => new Set(c.aristas.filter((a) => a.from === id || a.to === id).map((a) => (a.from === id ? a.to : a.from)))
const padres = (c: Contenido, id: string) => new Set(c.aristas.filter((a) => (a.tipo === 'generaliza' && a.to === id) || (a.tipo === 'ejemplifica' && a.from === id)).map((a) => (a.tipo === 'generaliza' ? a.from : a.to)))
const zona = (c: Contenido, id: string) => c.conceptos[id]?.clusterId ?? null
const T = (c: Contenido, id: string) => c.conceptos[id]?.titulo ?? id
const hayArista = (c: Contenido, a: string, b: string, tipos?: Set<string>) => c.aristas.some((x) => ((x.from === a && x.to === b) || (x.from === b && x.to === a)) && (!tipos || tipos.has(x.tipo)))
const insinuada = (c: Contenido, a: string, b: string) => (c.insinuadas ?? []).some((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a))
const noVinculo = (c: Contenido, a: string, b: string) => (c.noVinculos ?? []).some((n) => (n.a === a && n.b === b) || (n.a === b && n.b === a))

/** camino de hasta 3 saltos por aristas de tipos transitivos, todas en la misma dirección */
function caminoTransitivo(c: Contenido, from: string, to: string, tipo: string, max = 3): string[] | null {
  if (!TRANSITIVOS.has(tipo)) return null
  const paso = (x: string) => c.aristas.filter((a) => a.from === x && a.tipo === tipo).map((a) => a.to)
  let frente: string[][] = [[from]]
  for (let d = 0; d < max; d++) {
    const sig: string[][] = []
    for (const cam of frente) for (const n of paso(cam[cam.length - 1])) {
      if (cam.includes(n)) continue
      const nuevo = [...cam, n]
      if (n === to && nuevo.length > 2) return nuevo
      sig.push(nuevo)
    }
    frente = sig
  }
  return null
}

function abrir(v: Veredicto, estado: Veredicto['estado'], fichas: number, mult: number, nota: string): void {
  v.estado = estado; v.fichas = fichas; v.mult = mult; v.nota = nota; v.inferencia = true
}

export function flexibilizar(c: Contenido, veredictos: Veredicto[], piezas: Pieza[]): void {
  const pz = (uid: string) => piezas.find((p) => p.uid === uid)
  for (const v of veredictos) {
    if (v.estado !== 'error' && v.estado !== 'silencio' && v.estado !== 'plausible' && v.estado !== 'convive') continue
    const ps = v.trazo.piezas.map(pz).filter((p): p is Pieza => !!p)
    const ids = [...new Set(ps.map((p) => p.conceptId).filter((x): x is string => !!x))]
    const tool = v.trazo.tool

    // ── flecha: cadena transitiva de 3 (A causa B causa C ⇒ A causa C) ──
    if (tool === 'flecha' && ids.length === 2 && v.trazo.param && v.estado !== 'plausible') {
      const [a, b] = ids
      if (noVinculo(c, a, b)) continue
      const cam = caminoTransitivo(c, a, b, v.trazo.param) ?? caminoTransitivo(c, b, a, v.trazo.param)
      if (cam) { abrir(v, 'derivado', 12, 0.9, `Se sigue del texto por cadena: ${cam.map((x) => `«${T(c, x)}»`).join(' → ')}. Inferencia válida.`); continue }
    }

    // ── ancla: el caso no lo nombra, pero el concepto opera al lado ──
    if (tool === 'ancla') {
      const caso = ps.find((p) => p.clase === 'caso')
      const fuera = ids.filter((id) => caso && !caso.conceptIds.includes(id))
      if (caso && fuera.length) {
        const ilustrados = caso.conceptIds
        const vecinoDirecto = fuera.filter((id) => ilustrados.some((k) => hayArista(c, id, k)))
        if (vecinoDirecto.length === fuera.length) { abrir(v, 'aproximado', 9, 0.8, `El caso no nombra ${fuera.map((x) => `«${T(c, x)}»`).join(' ni ')}, pero opera al lado: es vecino directo de lo que el caso sí ilustra. Inferencia con apoyo.`); continue }
        const mismaZona = fuera.filter((id) => ilustrados.some((k) => zona(c, id) && zona(c, id) === zona(c, k)))
        if (mismaZona.length === fuera.length) { abrir(v, 'plausible', 4, 0.5, `Comparte zona con lo que el caso ilustra, pero el texto no los pone a operar juntos ahí. Propuesta anotada.`); continue }
      }
    }

    // ── contraejemplo: el texto contrapone ese concepto al caso → vale doble ──
    if (tool === 'contraejemplo' && v.estado !== 'error') continue
    if (tool === 'contraejemplo') {
      const caso = ps.find((p) => p.clase === 'caso')
      // v6.8 · solo cuenta un concepto que NO está en el caso: uno que sí opera ahí no es contraejemplo
      if (caso && ids.some((id) => !caso.conceptIds.includes(id) && caso.conceptIds.some((k) => noVinculo(c, id, k)))) { abrir(v, 'sostenido', 30, 1.6, 'El texto contrapone a propósito ese concepto con lo que el caso ilustra: contraejemplo de manual, vale doble.'); continue }
    }

    // ── campo: padre común o vecino común aunque las zonas no coincidan ──
    if (tool === 'campo' && ids.length >= 2) {
      const [a, ...resto] = ids
      const padreComun = resto.every((b) => [...padres(c, a)].some((p) => padres(c, b).has(p)))
      if (padreComun) { abrir(v, 'aproximado', 8 + 2 * ids.length, 0.8, 'No están en la misma zona, pero tienen un padre común en el texto: agrupación que el mapa no marcó y tú sí. Inferencia con apoyo.'); continue }
      const vecinoComun = resto.every((b) => [...vecinos(c, a)].some((n) => vecinos(c, b).has(n)))
      if (vecinoComun) { abrir(v, 'plausible', 4 + ids.length, 0.5, 'Comparten un vecino en el texto; el campo es defendible aunque el mapa no lo agrupe. Propuesta anotada.'); continue }
    }

    // ── jerarquía: transitividad (A generaliza B, B generaliza C ⇒ A contiene a C) ──
    if (tool === 'jerarquia' && ids.length >= 2) {
      const [padre, ...hijos] = ids
      const ok = hijos.every((h) => hayArista(c, padre, h, new Set(['generaliza', 'ejemplifica', 'requiere'])) || !!caminoTransitivo(c, padre, h, 'generaliza'))
      if (ok && hijos.some((h) => !hayArista(c, padre, h))) { abrir(v, 'derivado', 10 + 3 * hijos.length, 0.9, 'Jerarquía por transitividad: el texto la afirma en dos pasos y tú la cerraste en uno. Inferencia válida.'); continue }
    }

    // ── secuencia: eslabones por insinuadas ──
    if (tool === 'secuencia' && ids.length >= 3) {
      const eslabones = ids.slice(1).map((b, i) => ({ a: ids[i], b }))
      const firmes = eslabones.filter((e) => hayArista(c, e.a, e.b, new Set(['causa', 'antecede', 'requiere']))).length
      const sugeridos = eslabones.filter((e) => !hayArista(c, e.a, e.b) && insinuada(c, e.a, e.b)).length
      if (firmes + sugeridos === eslabones.length && sugeridos > 0) { abrir(v, 'aproximado', 6 + 3 * ids.length, 0.8, `Cadena con ${sugeridos} eslab${sugeridos === 1 ? 'ón' : 'ones'} que el texto sugiere sin afirmar. Inferencia con apoyo.`); continue }
    }
  }
}

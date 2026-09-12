/* Orientación precisa cuando un trazo no se sostiene (o se sostiene a medias).
 *
 * El veredicto dice QUÉ pasó; esto dice POR QUÉ y HACIA DÓNDE, con las
 * palabras del propio texto: la descripción de la arista real, la dirección
 * correcta, el tipo que el autor usa, qué dice el texto de cada concepto, de
 * quién es la descripción que se confundió. Todo se deriva del grafo: no hay
 * azar ni invención. Lo que el grafo no puede explicar (por qué esa confusión
 * es razonable, qué preguntarse) es el trabajo de la capa con LLM. */
import type { Contenido } from '../content/types'
import type { Pieza } from './pieces'
import type { Veredicto } from './tools'
import { DUALES } from './graph'

export interface Orientacion {
  /** una frase: la causa exacta */
  causa: string
  /** una frase: qué probar en el siguiente trazo (sin dar la respuesta entera) */
  siguiente: string
  /** la evidencia del texto que respalda la causa, si la hay */
  evidencia?: string
}

const VERBO: Record<string, string> = {
  apoya: 'apoya', causa: 'causa', requiere: 'requiere', ejemplifica: 'ejemplifica', generaliza: 'generaliza',
  contrasta: 'contrasta con', extiende: 'extiende', matiza: 'matiza', antecede: 'antecede a', mide: 'mide', es_parte_de: 'es parte de'
}
const verbo = (t: string) => VERBO[t] ?? t

function piezasDe(trazo: Veredicto['trazo'], piezas: Pieza[]): Pieza[] {
  return trazo.piezas.map((uid) => piezas.find((p) => p.uid === uid)).filter((p): p is Pieza => !!p)
}
const t = (c: Contenido, id: string) => c.conceptos[id]?.titulo ?? id
const vecinos = (c: Contenido, id: string, n = 2) =>
  c.aristas.filter((a) => a.from === id || a.to === id).slice(0, n)
    .map((a) => (a.from === id ? `${verbo(a.tipo)} «${t(c, a.to)}»` : `«${t(c, a.from)}» lo ${verbo(a.tipo)}`))

/** Devuelve null cuando el trazo se sostuvo del todo: no hay nada que orientar. */
export function orientar(c: Contenido, ver: Veredicto, piezas: Pieza[]): Orientacion | null {
  const ok = new Set(['sostenido', 'equivalente', 'derivado'])
  if (ok.has(ver.estado)) return null
  const ps = piezasDe(ver.trazo, piezas)
  const tool = ver.trazo.tool
  const ids = [...new Set(ps.map((p) => p.conceptId).filter((x): x is string => !!x))]

  // ── identidad: nombre + descripción ──
  if (tool === 'identidad') {
    const etiqueta = ps.find((p) => p.clase === 'etiqueta' || p.clase === 'concepto')
    const def = ps.find((p) => p.clase === 'definicion' || p.clase === 'apocrifa')
    if (def?.clase === 'apocrifa') {
      return { causa: 'Esa carta es una falsificación: lleva el nombre de un concepto con la descripción de otro.',
        siguiente: 'Compara la descripción con lo que sabes del concepto; si no encaja, quémala en vez de emparejarla.' }
    }
    if (etiqueta?.conceptId && def?.conceptId && etiqueta.conceptId !== def.conceptId) {
      const k = c.conceptos[def.conceptId]
      return { causa: `Esa descripción no es de «${t(c, etiqueta.conceptId)}»: es la de «${t(c, def.conceptId)}».`,
        siguiente: `Busca en la Mano la descripción que hable de lo que hace «${t(c, etiqueta.conceptId)}», no de lo que hace «${t(c, def.conceptId)}».`,
        evidencia: k?.evidencia ? `«${k.evidencia.slice(0, 160)}${k.evidencia.length > 160 ? '…' : ''}»` : undefined }
    }
    return { causa: 'El nombre y la descripción no corresponden al mismo concepto.', siguiente: 'Lee la descripción hasta el final: la clave suele estar en la segunda mitad.' }
  }

  // ── flecha / secuencia / jerarquía: vínculos entre dos conceptos ──
  if (ids.length >= 2 && ['flecha', 'secuencia', 'jerarquia', 'alcance', 'analogia'].includes(tool)) {
    const [a, b] = ids
    const directa = c.aristas.find((x) => x.from === a && x.to === b)
    const inversa = c.aristas.find((x) => x.from === b && x.to === a)
    const tipo = ver.trazo.param ?? ''
    if (ver.estado === 'invertido' && inversa) {
      return { causa: `La dirección va al revés: en el texto es «${t(c, b)}» ${verbo(inversa.tipo)} «${t(c, a)}», no al contrario.`,
        siguiente: `Traza de «${t(c, b)}» hacia «${t(c, a)}»${DUALES[inversa.tipo] ? `; o, si quieres empezar por «${t(c, a)}», el vínculo se llama «${DUALES[inversa.tipo]}»` : ''}.`,
        evidencia: inversa.descripcion ? `«${inversa.descripcion}»` : undefined }
    }
    const real = directa ?? inversa
    if (real && real.tipo !== tipo && tipo) {
      const lado = directa ? `«${t(c, a)}» → «${t(c, b)}»` : `«${t(c, b)}» → «${t(c, a)}»`
      return { causa: `El vínculo existe, pero el autor no lo llama «${tipo}»: ${lado} es «${real.tipo}».`,
        siguiente: `Vuelve a trazarlo eligiendo «${real.tipo}»${directa ? '' : ' y en esa dirección'}.`,
        evidencia: real.descripcion ? `«${real.descripcion}»` : undefined }
    }
    if (!real) {
      const va = vecinos(c, a), vb = vecinos(c, b)
      const caso = c.casos.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b))
      const tesis = c.tesis.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b))
      const junta = caso ? `Sí aparecen juntos en un caso: «${caso.descripcion.slice(0, 110)}…».` : tesis ? `Sí aparecen juntos en una tesis: «${tesis.enunciado.slice(0, 110)}…».` : ''
      return { causa: `El mapa del texto no registra un vínculo directo entre «${t(c, a)}» y «${t(c, b)}». ${junta}`.trim(),
        siguiente: `Lo que el texto sí dice: «${t(c, a)}» ${va.join(' y ') || 'no tiene vínculos registrados'}; «${t(c, b)}» ${vb.join(' y ') || 'no tiene vínculos registrados'}. Empieza por uno de esos.` }
    }
  }

  // ── campo / eje: agrupar ──
  if (tool === 'campo' && ids.length >= 2) {
    const zonas = new Map<string, string[]>()
    for (const id of ids) { const z = c.conceptos[id]?.clusterId ?? '—'; zonas.set(z, [...(zonas.get(z) ?? []), id]) }
    if (zonas.size > 1) {
      const desc = [...zonas.entries()].map(([z, xs]) => `${c.clusters.find((k) => k.id === z)?.label ?? 'otra zona'}: ${xs.map((x) => `«${t(c, x)}»`).join(', ')}`)
      return { causa: `No están en la misma zona del texto. ${desc.join(' · ')}.`, siguiente: 'Deja los de una zona y cambia el que sobra por otro de esa misma zona.' }
    }
  }
  if (tool === 'eje' && ids.length >= 2) {
    return { causa: 'No comparten el valor del eje que elegiste.', siguiente: 'Mira en la carta de cada concepto a qué lado del eje cae; agrupa los que caen al mismo lado.' }
  }

  // ── ancla / contraejemplo: caso + concepto ──
  if ((tool === 'ancla' || tool === 'contraejemplo') && ids.length >= 1) {
    const caso = ps.find((p) => p.clase === 'caso')
    if (caso?.conceptIds?.length) {
      const dentro = ids.filter((id) => caso.conceptIds.includes(id))
      const fuera = ids.filter((id) => !caso.conceptIds.includes(id))
      if (tool === 'ancla' && fuera.length) {
        return { causa: `El caso no ilustra ${fuera.map((x) => `«${t(c, x)}»`).join(' ni ')}${dentro.length ? `; sí ilustra ${dentro.map((x) => `«${t(c, x)}»`).join(' y ')}` : ''}.`,
          siguiente: `Los conceptos que este caso pone en juego son: ${caso.conceptIds.map((x) => `«${t(c, x)}»`).join(', ')}.` }
      }
      if (tool === 'contraejemplo' && dentro.length) {
        return { causa: `Ese caso no contradice a ${dentro.map((x) => `«${t(c, x)}»`).join(' ni ')}: lo ilustra.`, siguiente: 'Un contraejemplo es un caso donde el concepto debería aplicar y no aplica. Busca uno que el concepto no explique.' }
      }
    }
  }

  // ── balanza: tesis + criterio ──
  if (tool === 'balanza') {
    const crit = ps.find((p) => p.clase === 'criterio')
    if (crit && crit.sentido !== 'refuta') {
      return { causa: 'Eso es una objeción, no un criterio de refutación: suena razonable pero no dice qué observación obligaría a revisar la tesis.',
        siguiente: 'Un criterio válido nombra un dato o un resultado concreto que, si apareciera, cambiaría la tesis.' }
    }
  }

  // ── resto: lo que hay ──
  if (ver.estado === 'plausible') return { causa: 'Solo comparten página: el autor los menciona cerca, pero no los relaciona.', siguiente: 'Busca un vínculo que el texto afirme, o guarda esta idea como propuesta cuando tengas apoyo.' }
  if (ver.estado === 'convive') return { causa: 'El texto los pone juntos (en un caso, una tesis o un marco), pero no dice cómo se relacionan.', siguiente: 'Pregúntate qué hace uno respecto del otro en ese caso: eso es el vínculo que falta nombrar.' }
  return null
}

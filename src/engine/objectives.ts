import type { Contenido } from '../content/types'
import { nivelDe, type Atlas } from './atlas'

/** Dominios de aplicación de una unidad: para qué sirve fuera del texto. */
export function dominiosDeUnidad(c: Contenido, conceptIds: string[]): string[] {
  return [...new Set([
    ...c.escenarios.filter((e) => e.conceptIds.some((x) => conceptIds.includes(x))).map((e) => e.dominio),
    ...c.casos.filter((k) => k.conceptIds.some((x) => conceptIds.includes(x))).map((k) => k.dominio)
  ])].filter(Boolean)
}

/* ==========================================================================
   El vistazo previo.
   Material MÁS GENERAL que lo que viene, no un adelanto de lo mismo: eso es lo
   que distingue un organizador previo de un resumen. Y una pregunta abierta que
   el combate responderá, para que la sala tenga una incógnita y no un temario.
   ========================================================================== */

export interface Vistazo {
  conceptId: string
  titulo: string
  definicion: string
  pregunta: string
  conocidos: { tipo: string; otro: string }[]
  esPuerta: boolean
  esUmbral: boolean
}

export function vistazoDe(c: Contenido, conceptIds: string[], atlas: Atlas): Vistazo | null {
  if (!conceptIds.length) return null
  const puntua = (id: string) => {
    const k = c.conceptos[id]
    if (!k) return -1
    const generaliza = c.aristas.filter((a) => a.from === id && a.tipo === 'generaliza').length
    return k.importancia * 2 + generaliza * 1.5 + (k.esPuerta ? 2 : 0) + (k.esUmbral ? 1 : 0)
  }
  const id = [...conceptIds].sort((a, b) => puntua(b) - puntua(a))[0]
  const k = c.conceptos[id]
  if (!k) return null

  // la pregunta sale del propio texto: una tensión declarada, un caso sin
  // resolver, o los vínculos salientes que el jugador tendrá que nombrar
  const salientes = c.aristas.filter((a) => a.from === id).slice(0, 2)
  const caso = c.casos.find((x) => x.conceptIds.includes(id))
  const pregunta = k.tensiones[0]
    ? `Lo que vas a tener que resolver: ${k.tensiones[0]}`
    : caso
      ? `Lo que vas a tener que averiguar: ${caso.descripcion.slice(0, 130)}…`
      : salientes.length
        ? `Lo que vas a tener que averiguar: qué desencadena y qué se rompe alrededor de «${k.titulo}».`
        : `Lo que vas a tener que averiguar: dónde encaja «${k.titulo}» en el resto del texto.`

  return {
    conceptId: id, titulo: k.titulo,
    definicion: k.definicion || k.definicionCorta,
    pregunta,
    conocidos: Object.values(atlas.aristas)
      .filter((a) => a.from === id || a.to === id).slice(0, 4)
      .map((a) => ({ tipo: a.tipo, otro: c.conceptos[a.from === id ? a.to : a.from]?.titulo ?? '—' })),
    esPuerta: k.esPuerta, esUmbral: k.esUmbral
  }
}

export function unidadSellada(atlas: Atlas, contenido: Contenido, unidadId: string): boolean {
  const u = contenido.unidades.find((x) => x.id === unidadId)
  if (!u || !u.conceptIds.length) return false
  return u.conceptIds.every((id) => nivelDe(atlas.conceptos[id]) > 0)
}

export function unidadesSelladas(atlas: Atlas, contenido: Contenido): string[] {
  return contenido.unidades.filter((u) => unidadSellada(atlas, contenido, u.id)).map((u) => u.id)
}

export function edicionCriticaDisponible(atlas: Atlas, contenido: Contenido): boolean {
  return contenido.unidades.length > 0 &&
    unidadesSelladas(atlas, contenido).length === contenido.unidades.length
}

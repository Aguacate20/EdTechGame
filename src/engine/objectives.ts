import type { Contenido } from '../content/types'
import { nivelDe, type Atlas } from './atlas'

/** Dominios de aplicación de una unidad: para qué sirve fuera del texto. */
export function dominiosDeUnidad(c: Contenido, conceptIds: string[]): string[] {
  return [...new Set([
    ...c.escenarios.filter((e) => e.conceptIds.some((x) => conceptIds.includes(x))).map((e) => e.dominio),
    ...c.casos.filter((k) => k.conceptIds.some((x) => conceptIds.includes(x))).map((k) => k.dominio)
  ])].filter(Boolean)
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

import type { Contenido } from '../content/types'
import { nivelDe, type Atlas } from './atlas'

export type ObjetivoId = 'consolidar' | 'trazar' | 'salir'

export interface Objetivo {
  id: ObjetivoId
  nombre: string
  promesa: string
  costo: string
  lenteInicial: string
  relacionesIniciales: string[]
  dimensiones: string[]
}

/** Elegir plan es la mecánica I1 PLANEAR. Y como las relaciones que llevas
 *  deciden qué puedes afirmar, elegir plan y armar mazo son la misma decisión. */
export const OBJETIVOS: Objetivo[] = [
  {
    id: 'consolidar',
    nombre: 'Consolidar el vocabulario',
    promesa: 'Fijar los conceptos y no confundirlos entre sí.',
    costo: 'Con pocas relaciones raras, las cadenas rinden poco.',
    lenteInicial: 'lector_atento',
    relacionesIniciales: ['apoya', 'apoya', 'generaliza', 'requiere'],
    dimensiones: ['recuperación', 'discriminación']
  },
  {
    id: 'trazar',
    nombre: 'Trazar el mapa',
    promesa: 'Levantar el grafo entero del texto, vínculo por vínculo.',
    costo: 'Las relaciones raras castigan a quien no leyó las definiciones.',
    lenteInicial: 'puentes',
    relacionesIniciales: ['causa', 'apoya', 'contrasta', 'requiere'],
    dimensiones: ['relación', 'estructura']
  },
  {
    id: 'salir',
    nombre: 'Salir del texto',
    promesa: 'Llevar el mecanismo a dominios que el autor no menciona.',
    costo: 'Los casos lejanos ocupan hueco de línea y exigen saber qué opera en ellos.',
    lenteInicial: 'ejemplos',
    relacionesIniciales: ['ejemplifica', 'ejemplifica', 'apoya', 'causa'],
    dimensiones: ['transferencia']
  }
]

export const objetivoPorId = (id: ObjetivoId): Objetivo =>
  OBJETIVOS.find((o) => o.id === id) ?? OBJETIVOS[0]

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

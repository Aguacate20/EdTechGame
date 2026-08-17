import type { Contenido } from '../content/types'
import type { EfectoInstrumento } from './cards'
import { nivelDe, type Atlas } from './atlas'

export type ObjetivoId = 'consolidar' | 'trazar' | 'salir'

export interface Objetivo {
  id: ObjetivoId
  nombre: string
  promesa: string
  costo: string
  instrumentoInicial: EfectoInstrumento
  cartasIniciales: string[]
  /** dimensiones que este plan se compromete a llenar */
  dimensiones: string[]
}

/** Elegir objetivo al empezar la run es la mecánica I1 PLANEAR.
 *  Y como el mazo decide qué dimensiones puedes llenar, elegir plan
 *  y construir mazo terminan siendo la misma decisión. */
export const OBJETIVOS: Objetivo[] = [
  {
    id: 'consolidar',
    nombre: 'Consolidar el vocabulario',
    promesa: 'Fijar los conceptos uno a uno y no confundirlos entre sí.',
    costo: 'Llenas poco Atlas: reconocer no es lo mismo que relacionar.',
    instrumentoInicial: 'glosario',
    cartasIniciales: ['definir', 'distinguir'],
    dimensiones: ['recuperación', 'discriminación']
  },
  {
    id: 'trazar',
    nombre: 'Trazar el mapa',
    promesa: 'Nombrar los vínculos y levantar el grafo entero del texto.',
    costo: 'Las relaciones raras castigan al que no leyó las definiciones.',
    instrumentoInicial: 'cartografo',
    cartasIniciales: ['conectar', 'contrastar'],
    dimensiones: ['relación']
  },
  {
    id: 'salir',
    nombre: 'Salir del texto',
    promesa: 'Llevar el mecanismo a dominios que el autor no menciona.',
    costo: 'Los portales lejanos son el terreno más caro del juego.',
    instrumentoInicial: 'segunda_lectura',
    cartasIniciales: ['transferir', 'ejemplificar'],
    dimensiones: ['transferencia']
  }
]

export const objetivoPorId = (id: ObjetivoId): Objetivo =>
  OBJETIVOS.find((o) => o.id === id) ?? OBJETIVOS[0]

/** Una unidad queda sellada cuando todos sus conceptos tienen evidencia.
 *  No basta con atravesarla: hay que haberla sostenido. */
export function unidadSellada(atlas: Atlas, contenido: Contenido, unidadId: string): boolean {
  const u = contenido.unidades.find((x) => x.id === unidadId)
  if (!u || u.conceptIds.length === 0) return false
  return u.conceptIds.every((id) => nivelDe(atlas.conceptos[id]) > 0)
}

export function unidadesSelladas(atlas: Atlas, contenido: Contenido): string[] {
  return contenido.unidades.filter((u) => unidadSellada(atlas, contenido, u.id)).map((u) => u.id)
}

export function edicionCriticaDisponible(atlas: Atlas, contenido: Contenido): boolean {
  return contenido.unidades.length > 0 &&
    unidadesSelladas(atlas, contenido).length === contenido.unidades.length
}

import type { HerramientaId } from './tools'

/* ==========================================================================
   Portadas. En vez de empezar siempre igual, se elige con qué ojos se entra
   al texto. Cada portada es un plan de lectura: modula recursos y recompensa,
   NUNCA la corrección. Elegirla es en sí una señal (qué estilo prefiere el
   estudiante), y da la variación entre runs que hace decir «una más».
   ========================================================================== */

export interface Portada {
  id: string
  nombre: string
  glosa: string
  /** qué favorece y qué sacrifica, dicho al derecho */
  trato: string
  lentesIniciales: string[]
  herramientasExtra: HerramientaId[]
  /** cambios sobre la economía de la sala */
  manoDelta: number
  quemasDelta: number
  /** falsificaciones extra por sala: más riesgo, más señal de discriminación */
  apocrifasDelta: number
}

export const PORTADAS: Portada[] = [
  {
    id: 'clasica', nombre: 'La Clásica',
    glosa: 'El equipo estándar. Sin tratos.',
    trato: 'Identidades, flechas y un campo. Todo lo demás se gana en el camino.',
    lentesIniciales: [], herramientasExtra: [],
    manoDelta: 0, quemasDelta: 0, apocrifasDelta: 0
  },
  {
    id: 'disidente', nombre: 'El Disidente',
    glosa: 'Entras cazando oposiciones: los contrastes rinden desde el turno uno.',
    trato: 'Lente del disidente de inicio · una quema menos por sala.',
    lentesIniciales: ['disidente'], herramientasExtra: [],
    manoDelta: 0, quemasDelta: -1, apocrifasDelta: 0
  },
  {
    id: 'cartografo', nombre: 'El Cartógrafo',
    glosa: 'Entras dibujando el mapa: más estructura en la mano, menos cartas.',
    trato: 'Campo y jerarquía extra de inicio · mano una carta más corta.',
    lentesIniciales: [], herramientasExtra: ['campo', 'jerarquia'],
    manoDelta: -1, quemasDelta: 0, apocrifasDelta: 0
  },
  {
    id: 'esceptico', nombre: 'El Escéptico',
    glosa: 'Entras desconfiando: mejor caza de falsificaciones, pero hay más.',
    trato: 'Ojo crítico de inicio y una quema más · una falsificación extra por sala.',
    lentesIniciales: ['ojo_critico'], herramientasExtra: [],
    manoDelta: 0, quemasDelta: 1, apocrifasDelta: 1
  }
]

export const portadaPorId = (id: string): Portada =>
  PORTADAS.find((p) => p.id === id) ?? PORTADAS[0]

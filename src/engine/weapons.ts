import type { HerramientaId } from './tools'

/* ==========================================================================
   Las armas.
   Cada herramienta cognitiva dispara distinto, y dentro de la flecha cada tipo
   de vínculo tiene su propio proyectil. No es adorno: es la forma de que el
   jugador sienta la diferencia entre «apoya» y «generaliza» antes de saber
   explicarla, y de que combinar herramientas se vea además de puntuar.
   ========================================================================== */

export type FormaAtaque =
  | 'perdigon'    // impacto único y limpio
  | 'maza'        // pesado, un solo blanco, mucho retroceso
  | 'rayo'        // atraviesa en línea recta
  | 'onda'        // expansiva: alcanza a todos
  | 'lluvia'      // muchos impactos pequeños
  | 'gancho'      // salta de enemigo en enemigo
  | 'barrido'     // corta lateralmente
  | 'tenaza'      // dos impactos simultáneos desde arriba y abajo
  | 'sello'       // crítico único, lento y contundente

export interface Arma {
  forma: FormaAtaque
  nombre: string
  color: string
  /** duración de la animación en ms: lo grande tarda más y se entiende mejor */
  duracion: number
  /** cuántos proyectiles se dibujan */
  proyectiles: number
}

const ARMA_POR_RELACION: Record<string, Arma> = {
  apoya:       { forma: 'perdigon', nombre: 'Respaldo',   color: '#5fa78f', duracion: 620, proyectiles: 1 },
  causa:       { forma: 'rayo',     nombre: 'Descarga',   color: '#e0b64a', duracion: 720, proyectiles: 1 },
  requiere:    { forma: 'gancho',   nombre: 'Prerrequisito', color: '#7fa8d6', duracion: 860, proyectiles: 1 },
  contrasta:   { forma: 'tenaza',   nombre: 'Oposición',  color: '#c0705f', duracion: 780, proyectiles: 2 },
  generaliza:  { forma: 'onda',     nombre: 'Abstracción', color: '#9d93cc', duracion: 900, proyectiles: 1 },
  ejemplifica: { forma: 'lluvia',   nombre: 'Casuística', color: '#7fc0a8', duracion: 940, proyectiles: 5 },
  extiende:    { forma: 'barrido',  nombre: 'Alcance',    color: '#6fa8b8', duracion: 800, proyectiles: 1 },
  matiza:      { forma: 'perdigon', nombre: 'Matiz',      color: '#b0a06a', duracion: 660, proyectiles: 2 }
}

const ARMA_POR_HERRAMIENTA: Partial<Record<HerramientaId, Arma>> = {
  identidad: { forma: 'maza',    nombre: 'Reconocimiento', color: '#d8cfb8', duracion: 780, proyectiles: 1 },
  campo:     { forma: 'onda',    nombre: 'Campo',          color: '#9d93cc', duracion: 960, proyectiles: 1 },
  jerarquia: { forma: 'gancho',  nombre: 'Jerarquía',      color: '#7fa8d6', duracion: 900, proyectiles: 1 },
  eje:       { forma: 'barrido', nombre: 'Eje',            color: '#6fa8b8', duracion: 860, proyectiles: 1 },
  secuencia: { forma: 'gancho',  nombre: 'Secuencia',      color: '#e0b64a', duracion: 1020, proyectiles: 1 },
  ancla:     { forma: 'rayo',    nombre: 'Ancla',          color: '#7a6fb0', duracion: 840, proyectiles: 1 },
  balanza:   { forma: 'sello',   nombre: 'Refutación',     color: '#c9a227', duracion: 1100, proyectiles: 1 }
}

export interface Disparo {
  arma: Arma
  /** enemigos alcanzados, en orden */
  objetivos: string[]
  /** magnitud 0..1, para que lo grande se vea grande */
  magnitud: number
  /** combinar herramientas cambia el arma: se anuncia */
  combinado: string | null
}

/** Qué arma resulta del diagrama. La herramienta dominante manda, salvo que
 *  el jugador haya combinado varias: entonces el arma se transforma. */
export function armarDisparo(
  herramientas: HerramientaId[], relaciones: string[], dano: number, objetivos: string[]
): Disparo {
  const distintas = new Set(herramientas)
  let arma: Arma
  let combinado: string | null = null

  if (distintas.size >= 3) {
    arma = { forma: 'onda', nombre: 'Constelación', color: '#e8dcae', duracion: 1200, proyectiles: 3 }
    combinado = 'Constelación'
  } else if (distintas.size === 2) {
    const base = elegirArma(herramientas, relaciones)
    arma = { ...base, proyectiles: base.proyectiles + 1, duracion: base.duracion + 160 }
    combinado = `${base.nombre} reforzado`
  } else {
    arma = elegirArma(herramientas, relaciones)
  }

  return {
    arma,
    objetivos,
    magnitud: Math.max(0.15, Math.min(1, dano / 700)),
    combinado
  }
}

function elegirArma(herramientas: HerramientaId[], relaciones: string[]): Arma {
  const especial = herramientas.find((h) => ARMA_POR_HERRAMIENTA[h])
  if (especial && ARMA_POR_HERRAMIENTA[especial]) return ARMA_POR_HERRAMIENTA[especial]!
  const rel = relaciones.find((r) => ARMA_POR_RELACION[r])
  if (rel) return ARMA_POR_RELACION[rel]
  return ARMA_POR_RELACION.apoya
}

export const armaDeRelacion = (tipo: string): Arma =>
  ARMA_POR_RELACION[tipo] ?? ARMA_POR_RELACION.apoya

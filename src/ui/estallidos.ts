/* Las animaciones del ataque final (cristalizar). El juego las rota por el número de
 * constelaciones del perfil, así el jugador estrena una cada vez.
 *
 * v6.22 · cinco coreografías propias en vez de quince recoloreadas. Cada una tiene su
 * bloque `.estallido.<id>` en styles.css y usa las piezas de <Estallido>: fondo, gema,
 * facetas (16, en abanico) y estrellas (40, dispersas), además de los anillos, rayos y
 * texto de base. Para añadir otra: una entrada aquí y su bloque CSS. */
export interface Estallido { id: string; nombre: string; duracion: number; chispas: number }

export const ESTALLIDOS: Estallido[] = [
  { id: 'prisma', nombre: 'Prisma', duracion: 5200, chispas: 0 },
  { id: 'geoda', nombre: 'Geoda', duracion: 5600, chispas: 0 },
  { id: 'constelacion', nombre: 'Constelación', duracion: 5800, chispas: 0 },
  { id: 'vitral', nombre: 'Vitral', duracion: 5400, chispas: 0 },
  { id: 'escarcha', nombre: 'Escarcha', duracion: 5400, chispas: 0 }
]

/** azar con semilla: las mismas posiciones en cada render, sin saltos */
function azar(semilla: number) { let s = semilla; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

export const N_FACETAS = 16
/** 40 estrellas en polares desde el centro: ángulo, distancia (vmin), tamaño y retardo */
export const ESTRELLAS = (() => {
  const r = azar(7)
  return Array.from({ length: 40 }, (_, i) => ({
    a: Math.round(r() * 360), d: Math.round(10 + r() * 46), s: +(0.6 + r() * 1.4).toFixed(2), t: +(r() * 1.2).toFixed(2), i
  }))
})()
/** cuña i del vitral: triángulo con vértice en el centro (en % de la pantalla) */
export function cunaVitral(i: number): string {
  const paso = 360 / N_FACETAS, hueco = 0.9
  const p = (g: number) => `${(50 + 120 * Math.cos((g * Math.PI) / 180)).toFixed(1)}% ${(50 + 120 * Math.sin((g * Math.PI) / 180)).toFixed(1)}%`
  return `polygon(50% 50%, ${p(i * paso + hueco)}, ${p((i + 1) * paso - hueco)})`
}

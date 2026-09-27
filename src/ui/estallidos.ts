/* Las animaciones del ataque final. Cada entrada es una variante: el juego las rota por
 * el número de constelaciones del perfil, así el jugador siempre estrena una. Para añadir
 * una: una entrada aquí (id, nombre, duración, chispas) y su bloque CSS `.estallido.<id>`
 * en styles.css (anillos, chispas, rayos y texto ya existen como base; cada variante
 * redefine colores, tiempos y formas). Hasta 15 previstas; las que no tienen CSS propio
 * usan la base. */
export interface Estallido { id: string; nombre: string; duracion: number; chispas: number }

export const ESTALLIDOS: Estallido[] = [
  { id: 'supernova', nombre: 'Supernova', duracion: 5200, chispas: 36 },
  { id: 'aurora', nombre: 'Aurora', duracion: 5600, chispas: 20 },
  { id: 'eclipse', nombre: 'Eclipse', duracion: 5400, chispas: 16 },
  { id: 'lluvia', nombre: 'Lluvia de estrellas', duracion: 5800, chispas: 48 },
  { id: 'pulsar', nombre: 'Púlsar', duracion: 5000, chispas: 24 },
  { id: 'nebulosa', nombre: 'Nebulosa', duracion: 5400, chispas: 28 },
  { id: 'cometa', nombre: 'Cometa', duracion: 5200, chispas: 30 },
  { id: 'corona', nombre: 'Corona solar', duracion: 5600, chispas: 32 },
  { id: 'vortice', nombre: 'Vórtice', duracion: 5400, chispas: 40 },
  { id: 'cristal', nombre: 'Cristal', duracion: 5000, chispas: 18 },
  { id: 'marea', nombre: 'Marea', duracion: 5600, chispas: 22 },
  { id: 'faro', nombre: 'Faro', duracion: 5200, chispas: 14 },
  { id: 'enjambre', nombre: 'Enjambre', duracion: 5800, chispas: 60 },
  { id: 'trueno', nombre: 'Trueno', duracion: 5000, chispas: 26 },
  { id: 'amanecer', nombre: 'Amanecer', duracion: 6000, chispas: 20 }
]

import type { Familia, MecanicaId } from '../content/types'

export type EfectoCarta =
  | 'ninguno'
  | 'robar_2'          // utilidad: no responde
  | 'consultar'        // utilidad: revela la definición del objetivo, registra ayuda
  | 'robar_si_acierta'
  | 'bonus_relacion_rara'
  | 'bonus_distancia'
  | 'reduce_castigo'
  | 'bonus_umbral'

export interface CartaOperacion {
  id: string
  nombre: string
  verbo: string
  familias: Familia[]      // vacío = utilidad, no responde
  glosa: string
  efecto: EfectoCarta
  rareza: 'base' | 'comun' | 'rara'
  mejoraDe?: string
}

/** El mazo del jugador son VERBOS. El contenido lo reparte el currículo. */
export const CATALOGO: CartaOperacion[] = [
  { id: 'definir', nombre: 'Definir', verbo: 'DEFINIR', familias: ['A'], rareza: 'base', efecto: 'ninguno',
    glosa: 'Fija un concepto por su definición. Sirve contra embates de recuperación.' },
  { id: 'evocar', nombre: 'Evocar', verbo: 'EVOCAR', familias: ['A'], rareza: 'comun', efecto: 'robar_si_acierta',
    glosa: 'Recupera el nombre sin opciones a la vista. Al acertar, roba una carta.' },
  { id: 'distinguir', nombre: 'Distinguir', verbo: 'DISTINGUIR', familias: ['B'], rareza: 'base', efecto: 'ninguno',
    glosa: 'Separa dos ideas que se parecen. Sirve contra embates de atribución.' },
  { id: 'clasificar', nombre: 'Clasificar', verbo: 'CLASIFICAR', familias: ['B'], rareza: 'comun', efecto: 'ninguno',
    glosa: 'Decide bajo qué concepto cae un caso concreto.' },
  { id: 'conectar', nombre: 'Conectar', verbo: 'CONECTAR', familias: ['C'], rareza: 'base', efecto: 'ninguno',
    glosa: 'Nombra el vínculo entre dos conceptos. Sirve contra embates de relación.' },
  { id: 'contrastar', nombre: 'Contrastar', verbo: 'CONTRASTAR', familias: ['C'], rareza: 'comun', efecto: 'bonus_relacion_rara',
    glosa: 'Busca el vínculo poco frecuente. Rinde más cuanto más rara es la relación.' },
  { id: 'ejemplificar', nombre: 'Ejemplificar', verbo: 'EJEMPLIFICAR', familias: ['B', 'E'], rareza: 'comun', efecto: 'ninguno',
    glosa: 'Baja la abstracción con un caso. Sirve para clasificar y para transferir.' },
  { id: 'transferir', nombre: 'Transferir', verbo: 'TRANSFERIR', familias: ['E'], rareza: 'base', efecto: 'ninguno',
    glosa: 'Lleva el mecanismo a otro dominio. Sirve contra portales.' },
  { id: 'generalizar', nombre: 'Generalizar', verbo: 'GENERALIZAR', familias: ['E'], rareza: 'rara', efecto: 'bonus_distancia',
    glosa: 'Rinde más cuanto más lejos está el dominio del caso.' },
  { id: 'refutar', nombre: 'Refutar', verbo: 'REFUTAR', familias: ['F'], rareza: 'rara', efecto: 'ninguno',
    glosa: 'Responde a una tesis con el criterio que la limita. Solo el jefe la exige.' },
  { id: 'anclar', nombre: 'Anclar', verbo: 'ANCLAR', familias: ['A', 'B'], rareza: 'rara', efecto: 'bonus_umbral',
    glosa: 'Rinde más sobre conceptos umbral, los que reorganizan el mapa.' },
  { id: 'externalizar', nombre: 'Externalizar', verbo: 'EXTERNALIZAR', familias: [], rareza: 'comun', efecto: 'robar_2',
    glosa: 'Saca el problema de la cabeza al tablero: roba dos cartas. No responde por ti.' },
  { id: 'consultar', nombre: 'Consultar fuente', verbo: 'CONSULTAR', familias: [], rareza: 'comun', efecto: 'consultar',
    glosa: 'Muestra la definición completa y la página. Se registra como ayuda y baja la recompensa.' },
  // mejoras
  { id: 'definir_mas', nombre: 'Definir +', verbo: 'DEFINIR', familias: ['A'], rareza: 'rara', efecto: 'robar_si_acierta', mejoraDe: 'definir',
    glosa: 'Al acertar, roba una carta.' },
  { id: 'distinguir_mas', nombre: 'Distinguir +', verbo: 'DISTINGUIR', familias: ['B'], rareza: 'rara', efecto: 'reduce_castigo', mejoraDe: 'distinguir',
    glosa: 'El fallo cuesta la mitad: equivocarse discriminando sigue informando.' },
  { id: 'conectar_mas', nombre: 'Conectar +', verbo: 'CONECTAR', familias: ['C'], rareza: 'rara', efecto: 'bonus_relacion_rara', mejoraDe: 'conectar',
    glosa: 'Rinde más sobre relaciones poco frecuentes en este texto.' },
  { id: 'transferir_mas', nombre: 'Transferir +', verbo: 'TRANSFERIR', familias: ['E'], rareza: 'rara', efecto: 'bonus_distancia', mejoraDe: 'transferir',
    glosa: 'Rinde más cuanto mayor es la distancia de dominio.' }
]

export const porId = (id: string): CartaOperacion =>
  CATALOGO.find((c) => c.id === id) ?? CATALOGO[0]

export const MAZO_INICIAL = [
  'definir', 'definir', 'distinguir', 'distinguir',
  'conectar', 'conectar', 'transferir', 'externalizar'
]

export const FAMILIA_DE_MECANICA: Record<MecanicaId, Familia> = {
  A1: 'A', A3: 'A', B1: 'B', B2: 'B', C1: 'C', E1: 'E', E2: 'E', E3: 'E'
}

/* ------------------------------- instrumentos ------------------------------ */

export type EfectoInstrumento =
  | 'mano_mas_uno'
  | 'segunda_lectura'
  | 'cartografo'
  | 'conviccion'
  | 'brujula'
  | 'glosario'
  | 'curiosidad'
  | 'sesgo_confirmacion'

export interface Instrumento {
  id: EfectoInstrumento
  nombre: string
  regla: string
  costo: string
  maldito?: boolean
}

export const INSTRUMENTOS: Instrumento[] = [
  { id: 'mano_mas_uno', nombre: 'Memoria ampliada', regla: 'Robas una carta más al inicio de cada turno.', costo: 'Ninguno. Externalizar es legítimo.' },
  { id: 'segunda_lectura', nombre: 'Segunda lectura', regla: 'El primer fallo de cada combate no te quita lucidez.', costo: 'No cambia el registro: el error se sigue anotando.' },
  { id: 'cartografo', nombre: 'Cartógrafo', regla: 'Cada tipo de relación distinto que uses en un combate aumenta la recompensa.', costo: 'Premia variar, no repetir el par conocido.' },
  { id: 'conviccion', nombre: 'Convicción', regla: 'La apuesta alta rinde más de lo normal.', costo: 'Y el fallo con apuesta alta duele bastante más.' },
  { id: 'brujula', nombre: 'Brújula', regla: 'Muestra qué familia de operación pide cada embate antes de jugarlo.', costo: 'Ninguno. Reduce niebla de interfaz, no de contenido.' },
  { id: 'glosario', nombre: 'Glosario', regla: 'La primera consulta de cada combate no baja la recompensa.', costo: 'Ninguno. Pedir ayuda temprano deja de castigarse.' },
  { id: 'curiosidad', nombre: 'Curiosidad', regla: 'Descubrir una arista nueva del Atlas recupera lucidez.', costo: 'Premia explorar, no responder rápido.' },
  { id: 'sesgo_confirmacion', nombre: 'Sesgo de confirmación', maldito: true, regla: 'Aparecen con más frecuencia los conceptos que ya dominas.', costo: 'Tu Atlas crece más lento: repetir lo conocido no es aprender.' }
]

export const instrumentoPorId = (id: EfectoInstrumento): Instrumento =>
  INSTRUMENTOS.find((i) => i.id === id) ?? INSTRUMENTOS[0]

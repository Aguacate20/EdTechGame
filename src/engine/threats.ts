import type { Familia } from '../content/types'
import { ARQUETIPOS, type ArquetipoId } from './encounters'
import type { Rng } from './rng'

/** Lo que un enemigo le hace al jugador en su turno.
 *  Ninguna amenaza toca la corrección: estorban la mano, la lectura o el mazo. */
export type AmenazaId =
  | 'olvido'      // te quita una carta de la mano
  | 'ruido'       // robas una carta menos el turno siguiente
  | 'niebla'      // oculta la dificultad y el contexto del próximo embate
  | 'susurro'     // te mete una carta de Intuición en el mazo
  | 'superficie'  // el próximo embate llega sin definiciones de apoyo
  | 'insistencia' // se envalentona: pega más fuerte cada turno
  | 'escudo'      // se cubre: solo lo hieren ciertas familias

export interface Amenaza {
  id: AmenazaId
  nombre: string
  aviso: string
}

export const AMENAZAS: Record<AmenazaId, Amenaza> = {
  olvido: { id: 'olvido', nombre: 'Olvido', aviso: 'Se lleva una carta de tu mano.' },
  ruido: { id: 'ruido', nombre: 'Ruido', aviso: 'El turno siguiente robas una carta menos.' },
  niebla: { id: 'niebla', nombre: 'Niebla', aviso: 'Vela el contexto del próximo embate.' },
  susurro: { id: 'susurro', nombre: 'Susurro', aviso: 'Deja una Intuición en tu mazo.' },
  superficie: { id: 'superficie', nombre: 'Superficie', aviso: 'Retira las definiciones de apoyo.' },
  insistencia: { id: 'insistencia', nombre: 'Insistencia', aviso: 'Mantiene su versión y golpea más fuerte.' },
  escudo: { id: 'escudo', nombre: 'Escudo', aviso: 'Solo lo hiere el trabajo que exige.' }
}

export interface PerfilEnemigo {
  amenaza: AmenazaId
  /** familias que apenas lo tocan (40 % del daño) */
  resiste: Familia[]
  /** familias que lo hieren de más (150 %) */
  cede: Familia[]
  ataqueBase: number
}

export const PERFILES: Record<ArquetipoId, PerfilEnemigo> = {
  vacio:      { amenaza: 'olvido',      resiste: ['E'],      cede: ['A'], ataqueBase: 2 },
  confuso:    { amenaza: 'superficie',  resiste: ['A'],      cede: ['B'], ataqueBase: 2 },
  espejo:     { amenaza: 'niebla',      resiste: ['A', 'B'], cede: ['C'], ataqueBase: 2 },
  eco:        { amenaza: 'susurro',     resiste: ['C'],      cede: ['B'], ataqueBase: 2 },
  enjambre:   { amenaza: 'ruido',       resiste: [],         cede: ['B'], ataqueBase: 3 },
  caso:       { amenaza: 'superficie',  resiste: ['A'],      cede: ['E'], ataqueBase: 3 },
  arquitecto: { amenaza: 'insistencia', resiste: ['A'],      cede: ['C'], ataqueBase: 3 },
  marco:      { amenaza: 'escudo',      resiste: ['A', 'B'], cede: ['F'], ataqueBase: 4 }
}

export interface Enemigo {
  uid: string
  arquetipoId: ArquetipoId
  nombre: string
  hp: number
  hpMax: number
  fuerza: number
  perfil: PerfilEnemigo
  /** animación pendiente para el escenario */
  gesto: 'quieto' | 'golpea' | 'herido' | 'critico' | 'estabilizado' | 'cae'
  aturdido: boolean
}

export function crearEnemigo(
  arquetipoId: ArquetipoId, escala: number, rng: Rng, indice: number
): Enemigo {
  const arq = ARQUETIPOS[arquetipoId]
  const hp = Math.max(8, Math.round(arq.vidaBase * escala * (arq.rango === 'jefe' ? 1 : 0.55)))
  return {
    uid: `${arquetipoId}-${indice}-${rng.int(9999)}`,
    arquetipoId,
    nombre: arq.nombre,
    hp, hpMax: hp,
    fuerza: 0,
    perfil: PERFILES[arquetipoId],
    gesto: 'quieto',
    aturdido: false
  }
}

/** Modulación de daño por familia: la build decide cuánto rinde, nunca si acertaste. */
export function factorFamilia(e: Enemigo, familia: Familia): number {
  if (e.perfil.cede.includes(familia)) return 1.5
  if (e.perfil.resiste.includes(familia)) return 0.4
  return 1
}

export function ataqueDe(e: Enemigo): number {
  return e.perfil.ataqueBase + e.fuerza
}

/** Composición de un frente: qué enemigos y cuántos. */
export function componerFrente(
  disponibles: ArquetipoId[], tipo: 'combate' | 'elite' | 'jefe', escala: number, rng: Rng
): Enemigo[] {
  if (tipo === 'jefe') {
    const guardia = disponibles.filter((a) => ARQUETIPOS[a].rango === 'comun')
    return [
      crearEnemigo('marco', escala, rng, 0),
      ...(guardia.length ? [crearEnemigo(rng.pick(guardia), escala * 0.8, rng, 1)] : [])
    ]
  }
  const pool = disponibles.filter((a) => ARQUETIPOS[a].rango !== 'jefe')
  if (pool.length === 0) return [crearEnemigo('vacio', escala, rng, 0)]
  const n = tipo === 'elite' ? 3 : 2 + rng.int(2)
  const elegidos: ArquetipoId[] = []
  for (let i = 0; i < n; i++) {
    const elites = pool.filter((a) => ARQUETIPOS[a].rango === 'elite')
    const comunes = pool.filter((a) => ARQUETIPOS[a].rango === 'comun')
    const fuente = tipo === 'elite' && i === 0 && elites.length ? elites : (comunes.length ? comunes : pool)
    elegidos.push(rng.pick(fuente))
  }
  return elegidos.map((a, i) => crearEnemigo(a, escala * (tipo === 'elite' ? 1.1 : 1), rng, i))
}

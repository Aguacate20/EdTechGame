import type { Rng } from './rng'

/* ==========================================================================
   El carril. El jugador está en la casilla 0; los enemigos entran por la 8
   y avanzan una vez por cada afirmación que el jugador hace.
   ========================================================================== */

export const LARGO_CARRIL = 8

export type RasgoId =
  | 'ninguno'
  | 'apocrifo'         // al golpear, deja una carta apócrifa en tu mazo
  | 'blindado_cadena'  // solo lo hieren afirmaciones de 2+ eslabones
  | 'retrocede'        // al recibir daño retrocede en vez de morir la primera vez
  | 'salta'            // cada dos turnos se teletransporta hacia delante
  | 'roba'             // no ataca: se lleva una carta de tu mano
  | 'regenera'         // se cura si no lo tocas ese turno
  | 'divide'           // al morir deja dos crías
  | 'blindado_puente'  // solo lo hieren puentes o contrastes
  | 'fases'            // jefe: exige una jugada distinta en cada fase

export interface TipoEnemigo {
  id: string
  nombre: string
  glosa: string
  /** casillas que avanza por turno */
  velocidad: number
  /** ataca cuando su posición es <= alcance */
  alcance: number
  vidaBase: number
  ataque: number
  rasgo: RasgoId
  /** coste en el presupuesto de amenaza de la oleada */
  costo: number
  /** primer acto en el que puede aparecer */
  desdeActo: number
  rango: 'comun' | 'duro' | 'jefe'
}

export const ROSTER: TipoEnemigo[] = [
  {
    id: 'copista', nombre: 'El Copista', rango: 'comun',
    glosa: 'Copia sin entender. Avanza una casilla y golpea cuando llega.',
    velocidad: 1, alcance: 1, vidaBase: 26, ataque: 4, rasgo: 'ninguno', costo: 1, desdeActo: 0
  },
  {
    id: 'errata', nombre: 'La Errata', rango: 'comun',
    glosa: 'Se cuela rápido. Avanza dos casillas por turno, pero es frágil.',
    velocidad: 2, alcance: 1, vidaBase: 16, ataque: 4, rasgo: 'ninguno', costo: 2, desdeActo: 0
  },
  {
    id: 'rumor', nombre: 'El Rumor', rango: 'comun',
    glosa: 'No necesita acercarse: te alcanza desde el fondo del carril todos los turnos.',
    velocidad: 0, alcance: LARGO_CARRIL, vidaBase: 22, ataque: 2, rasgo: 'ninguno', costo: 2, desdeActo: 0
  },
  {
    id: 'apocrifo', nombre: 'El Apócrifo', rango: 'comun',
    glosa: 'Cuando golpea, deja una carta falsificada en tu mazo.',
    velocidad: 1, alcance: 1, vidaBase: 30, ataque: 3, rasgo: 'apocrifo', costo: 3, desdeActo: 0
  },
  {
    id: 'notaalpie', nombre: 'La Nota al Pie', rango: 'comun',
    glosa: 'No te hace daño: se lleva una carta de tu mano cada turno que está cerca.',
    velocidad: 1, alcance: 2, vidaBase: 24, ataque: 0, rasgo: 'roba', costo: 2, desdeActo: 0
  },
  {
    id: 'dogma', nombre: 'El Dogma', rango: 'duro',
    glosa: 'Blindado contra afirmaciones simples: solo lo hieren cadenas de dos eslabones o más.',
    velocidad: 1, alcance: 2, vidaBase: 54, ataque: 6, rasgo: 'blindado_cadena', costo: 4, desdeActo: 1
  },
  {
    id: 'eco', nombre: 'El Eco', rango: 'duro',
    glosa: 'No se derrota de golpe: la primera vez que lo hieres retrocede. Al atacar deja una intuición.',
    velocidad: 1, alcance: 1, vidaBase: 34, ataque: 4, rasgo: 'retrocede', costo: 3, desdeActo: 1
  },
  {
    id: 'cita', nombre: 'La Cita Descontextualizada', rango: 'duro',
    glosa: 'Cada dos turnos salta hacia delante sin avisar.',
    velocidad: 1, alcance: 1, vidaBase: 30, ataque: 6, rasgo: 'salta', costo: 3, desdeActo: 1
  },
  {
    id: 'palimpsesto', nombre: 'El Palimpsesto', rango: 'duro',
    glosa: 'Se reescribe: si en un turno no lo tocas, recupera vida.',
    velocidad: 1, alcance: 1, vidaBase: 44, ataque: 5, rasgo: 'regenera', costo: 4, desdeActo: 2
  },
  {
    id: 'bibliografia', nombre: 'La Bibliografía', rango: 'duro',
    glosa: 'Al caer se divide en dos entradas menores.',
    velocidad: 1, alcance: 1, vidaBase: 34, ataque: 4, rasgo: 'divide', costo: 4, desdeActo: 2
  },
  {
    id: 'ortodoxia', nombre: 'La Ortodoxia', rango: 'duro',
    glosa: 'Solo cede ante puentes y contrastes: no admite que se la relacione de frente.',
    velocidad: 1, alcance: 2, vidaBase: 48, ataque: 6, rasgo: 'blindado_puente', costo: 5, desdeActo: 2
  },
  {
    id: 'tratado', nombre: 'El Tratado', rango: 'jefe',
    glosa: 'No se mueve. Exige una jugada distinta en cada una de sus fases.',
    velocidad: 0, alcance: LARGO_CARRIL, vidaBase: 130, ataque: 7, rasgo: 'fases', costo: 10, desdeActo: 0
  }
]

export const tipoPorId = (id: string): TipoEnemigo =>
  ROSTER.find((t) => t.id === id) ?? ROSTER[0]

export interface Enemigo {
  uid: string
  tipoId: string
  nombre: string
  hp: number
  hpMax: number
  posicion: number
  ataque: number
  /** turnos vividos, para los rasgos con cadencia */
  edad: number
  retrocedioYa: boolean
  tocadoEsteTurno: boolean
  fase: number
  gesto: 'quieto' | 'avanza' | 'golpea' | 'herido' | 'critico' | 'cae' | 'retrocede'
}

let n = 0
export function crearEnemigo(tipoId: string, escala: number, posicion: number): Enemigo {
  const t = tipoPorId(tipoId)
  const hp = Math.max(8, Math.round(t.vidaBase * escala))
  return {
    uid: `${tipoId}-${n++}`, tipoId, nombre: t.nombre, hp, hpMax: hp, posicion,
    ataque: Math.max(0, Math.round(t.ataque * Math.min(1.9, 0.85 + escala * 0.3))),
    edad: 0, retrocedioYa: false, tocadoEsteTurno: false, fase: 0, gesto: 'quieto'
  }
}

/* -------------------------- generación de oleadas -------------------------- */

export type Dificultad = 'facil' | 'media' | 'dura' | 'jefe'

const PRESUPUESTO: Record<Dificultad, number> = { facil: 3, media: 6, dura: 9, jefe: 10 }

/** Presupuesto de amenaza: se van comprando enemigos hasta gastarlo.
 *  Así una casilla fácil del acto 1 son dos Copistas, y una dura del acto 3
 *  puede ser Dogma + Errata + Rumor. */
/** Estimación del aguante del frente para anunciarla en el mapa, sin gastar
 *  el RNG de la sala: presupuesto × vida media del roster disponible. */
export function estimarFrente(dificultad: Dificultad, acto: number): number {
  const escala = Math.pow(1.35, acto)
  if (dificultad === 'jefe') {
    const jefe = ROSTER.find((t) => t.id === 'tratado')
    return Math.round((jefe?.vidaBase ?? 120) * escala * 1.6)
  }
  const presupuesto = PRESUPUESTO[dificultad] + Math.floor(acto * 1.5)
  const pool = ROSTER.filter((t) => t.rango !== 'jefe' && t.desdeActo <= acto)
  const vidaPorCosto = pool.reduce((n, t) => n + t.vidaBase / t.costo, 0) / Math.max(1, pool.length)
  return Math.round(presupuesto * vidaPorCosto * escala / 10) * 10
}

export function generarOleada(dificultad: Dificultad, acto: number, rng: Rng): Enemigo[] {
  // la demanda ahora COMPONE: si el motor del jugador multiplica, el frente
  // también, o el número grande sería decorativo
  const escala = Math.pow(1.35, acto)
  if (dificultad === 'jefe') {
    const guardia = ROSTER.filter((t) => t.rango === 'comun' && t.desdeActo <= acto)
    return [
      crearEnemigo('tratado', escala * 1.6, LARGO_CARRIL),
      ...(guardia.length ? [crearEnemigo(rng.pick(guardia).id, escala * 0.8, LARGO_CARRIL - 2)] : [])
    ]
  }

  let presupuesto = PRESUPUESTO[dificultad] + Math.floor(acto * 1.5)
  const disponibles = ROSTER.filter((t) => t.rango !== 'jefe' && t.desdeActo <= acto)
  const salida: Enemigo[] = []
  let intentos = 0

  while (presupuesto > 0 && intentos++ < 24 && salida.length < 5) {
    const asequibles = disponibles.filter((t) => t.costo <= presupuesto)
    if (!asequibles.length) break
    // en las casillas duras se prefiere lo caro; en las fáciles, lo barato
    const orden = rng.shuffle(asequibles).sort((a, b) =>
      dificultad === 'facil' ? a.costo - b.costo : b.costo - a.costo)
    const elegido = orden[rng.int(Math.min(2, orden.length))]
    presupuesto -= elegido.costo
    salida.push(crearEnemigo(elegido.id, escala, LARGO_CARRIL - salida.length * (rng.int(2) ? 1 : 0)))
  }
  if (!salida.length) salida.push(crearEnemigo('copista', escala, LARGO_CARRIL))

  // separar los que comparten casilla para que el carril se lea
  salida.forEach((e, i) => { e.posicion = Math.min(LARGO_CARRIL, LARGO_CARRIL - i) })
  return salida
}

/* ------------------------------ ¿le entra el daño? ------------------------- */

export interface FormaAfirmacion {
  eslabones: number
  puente: boolean
  contraste: boolean
  jugadas: string[]
}

/** Los blindajes modulan el daño, nunca la corrección: se puede acertar y
 *  no herir, porque ese enemigo pide otra clase de trabajo. */
export function factorBlindaje(e: Enemigo, f: FormaAfirmacion): { factor: number; motivo: string | null } {
  const t = tipoPorId(e.tipoId)
  switch (t.rasgo) {
    case 'blindado_cadena':
      return f.eslabones >= 2
        ? { factor: 1, motivo: null }
        : { factor: 0.15, motivo: 'El Dogma no cede ante una afirmación de un solo eslabón.' }
    case 'blindado_puente':
      return f.puente || f.contraste
        ? { factor: 1, motivo: null }
        : { factor: 0.15, motivo: 'La Ortodoxia solo cede ante puentes y contrastes.' }
    case 'fases': {
      const exigida = FASES_JEFE[e.fase % FASES_JEFE.length]
      return f.jugadas.includes(exigida.jugada)
        ? { factor: 1.25, motivo: null }
        : { factor: 0.2, motivo: `El Tratado exige ahora: ${exigida.etiqueta}.` }
    }
    default:
      return { factor: 1, motivo: null }
  }
}

export const FASES_JEFE = [
  { jugada: 'enlace', etiqueta: 'un enlace sostenido' },
  { jugada: 'cadena', etiqueta: 'una cadena de dos o más' },
  { jugada: 'contraste', etiqueta: 'un contraste' },
  { jugada: 'puente', etiqueta: 'un puente entre zonas del texto' },
  { jugada: 'refutacion', etiqueta: 'una tesis situada' }
]

export function faseJefe(e: Enemigo): string | null {
  return tipoPorId(e.tipoId).rasgo === 'fases'
    ? FASES_JEFE[e.fase % FASES_JEFE.length].etiqueta
    : null
}

import type { Contenido } from '../content/types'
import { porId, type CartaOperacion, type EfectoInstrumento } from './cards'
import type { CondicionId, Embate } from './encounters'
import { esIntuicion } from './intuition'
import { AMENAZAS, ataqueDe, factorFamilia, type Enemigo } from './threats'
import type { Rng } from './rng'

export type Apuesta = 'baja' | 'media' | 'alta'

export const APUESTAS: Record<Apuesta, { mult: number; castigo: number; etiqueta: string; glosa: string }> = {
  baja: { mult: 1, castigo: 0, etiqueta: 'Baja', glosa: 'Sin penalización si fallas.' },
  media: { mult: 1.5, castigo: 2, etiqueta: 'Media', glosa: 'Rinde más; el fallo cuesta algo.' },
  alta: { mult: 2, castigo: 5, etiqueta: 'Alta', glosa: 'Rinde el doble; el fallo duele.' }
}

export interface CartaEnMano { uid: string; cardId: string }

export type Golpe =
  | 'limpio' | 'critico_rareza' | 'critico_apuesta' | 'torpe'
  | 'resistido' | 'estabilizado' | 'fallido' | 'pausa'

export interface Resolucion {
  correcto: boolean
  parcial: boolean
  dano: number
  golpe: Golpe
  objetivoUid: string | null
  derribado: boolean
  apuesta: Apuesta
  calibrado: boolean
  mensajes: { texto: string; tono: 'ok' | 'mal' | 'nota' }[]
  cierre: string | null
  aristaDescubierta: { from: string; to: string; tipo: string } | null
  repertorioTocado: string | null
  intuicionResuelta: string | null
  conceptIds: string[]
  latenciaMs: number
  ayuda: boolean
  improvisado: boolean
  turnoEnemigo: { texto: string; dano: number }[]
  danoRecibido: number
}

export interface EstadoCombate {
  tipo: 'combate' | 'elite' | 'jefe'
  enemigos: Enemigo[]
  objetivo: string | null
  condicion: CondicionId | null
  embate: Embate | null
  mano: CartaEnMano[]
  mazo: CartaEnMano[]
  descarte: CartaEnMano[]
  manoBase: number
  acciones: number
  seleccion: string[]
  cartaJugada: string | null
  apuesta: Apuesta | null
  fase: 'objetivo' | 'eligiendo' | 'resuelto' | 'ganado' | 'perdido'
  ultima: Resolucion | null
  turno: number
  consultas: number
  ayudaEnEmbate: boolean
  tiposRelacionUsados: string[]
  erroresEnCombate: number
  inicioEmbate: number
  definicionAbierta: string | null
  nieblaPendiente: boolean
  superficiePendiente: boolean
  ruidoPendiente: boolean
  intuicionesRecibidas: string[]
}

export interface ContextoCombate {
  contenido: Contenido
  instrumentos: EfectoInstrumento[]
  rng: Rng
}

/* ------------------------------ mazo y mano ------------------------------- */

export function armarMazo(cartas: string[], rng: Rng): CartaEnMano[] {
  return rng.shuffle(cartas.map((cardId, i) => ({ uid: `${cardId}#${i}#${rng.int(99999)}`, cardId })))
}

export function robar(e: EstadoCombate, n: number): void {
  for (let i = 0; i < n; i++) {
    if (e.mazo.length === 0) {
      if (e.descarte.length === 0) return
      e.mazo = e.descarte
      e.descarte = []
    }
    const c = e.mazo.shift()
    if (c) e.mano.push(c)
  }
}

export function tamanoMano(e: EstadoCombate, ctx: ContextoCombate): number {
  let n = e.manoBase
  if (ctx.instrumentos.includes('mano_mas_uno')) n += 1
  if (e.condicion === 'mano_corta') n -= 1
  if (e.ruidoPendiente) n -= 1
  return Math.max(2, n)
}

export function sirve(carta: CartaOperacion, embate: Embate): boolean {
  return carta.familias.includes(embate.familia)
}

export const vivos = (e: EstadoCombate): Enemigo[] => e.enemigos.filter((x) => x.hp > 0)
export const objetivoActual = (e: EstadoCombate): Enemigo | null =>
  e.enemigos.find((x) => x.uid === e.objetivo && x.hp > 0) ?? null

/* --------------------------------- daño ----------------------------------- */

/** El daño NUNCA se conoce antes de resolver. La familia del embate y el enemigo
 *  al que apuntas modulan cuánto rinde; nada de esto decide si acertaste. */
export function calcularGolpe(
  e: EstadoCombate, ctx: ContextoCombate, emb: Embate, aciertos: number, errores: number,
  carta: CartaOperacion | null, apuesta: Apuesta, objetivo: Enemigo | null
): { dano: number; golpe: Golpe } {
  let base = 4 + 6 * emb.peso
  base *= 0.8 + 0.6 * emb.dificultad
  let golpe: Golpe = 'limpio'

  if (emb.tipoRelacion) {
    const freqs = Object.values(ctx.contenido.frecuenciaRelacion)
    const max = Math.max(1, ...freqs)
    const f = ctx.contenido.frecuenciaRelacion[emb.tipoRelacion] ?? 1
    const rareza = 1 + (1 - f / max) * 0.8
    base *= rareza
    if (carta?.efecto === 'bonus_relacion_rara') base *= 1 + (1 - f / max) * 0.5
    if (rareza > 1.45) golpe = 'critico_rareza'
  }
  if (emb.distancia) {
    const m = emb.distancia === 'lejana' ? 1.6 : emb.distancia === 'media' ? 1.3 : 1.05
    base *= m
    if (carta?.efecto === 'bonus_distancia') base *= m > 1.2 ? 1.35 : 1
    if (emb.distancia === 'lejana') golpe = 'critico_rareza'
  }
  if (carta?.efecto === 'bonus_umbral' && emb.conceptoObjetivo &&
      ctx.contenido.conceptos[emb.conceptoObjetivo]?.esUmbral) base *= 1.4

  if (emb.multi) base = base * (aciertos / Math.max(1, emb.nCorrectas)) - errores * 3

  if (!carta) { base *= 0.4; golpe = 'torpe' }
  if (e.ayudaEnEmbate && !(ctx.instrumentos.includes('glosario') && e.consultas <= 1)) base *= 0.7

  let mult = APUESTAS[apuesta].mult
  if (apuesta === 'alta' && ctx.instrumentos.includes('conviccion')) mult = 2.5
  base *= mult
  if (apuesta === 'alta' && golpe === 'limpio') golpe = 'critico_apuesta'

  if (ctx.instrumentos.includes('cartografo')) base *= 1 + 0.12 * new Set(e.tiposRelacionUsados).size
  if (e.condicion === 'monocultivo' && emb.tipoRelacion && e.tiposRelacionUsados.length > 0 &&
      emb.tipoRelacion !== e.tiposRelacionUsados[0]) base *= 0.35

  if (objetivo) {
    const f = factorFamilia(objetivo, emb.familia)
    base *= f
    if (f < 1) golpe = 'resistido'
    else if (f > 1 && golpe === 'limpio') golpe = 'critico_rareza'
  }
  return { dano: Math.max(1, Math.round(base)), golpe }
}

/* ------------------------------- resolución ------------------------------- */

export function resolver(e: EstadoCombate, ctx: ContextoCombate): Resolucion {
  const emb = e.embate!
  const cartaRaw = e.cartaJugada ? e.mano.find((c) => c.uid === e.cartaJugada) : null
  const esIntu = !!cartaRaw && esIntuicion(cartaRaw.cardId)
  const carta = cartaRaw && !esIntu ? porId(cartaRaw.cardId) : null
  const cartaValida = carta && sirve(carta, emb) ? carta : null
  const apuesta = e.apuesta ?? 'baja'
  const objetivo = objetivoActual(e)

  const elegidas = emb.opciones.filter((o) => e.seleccion.includes(o.id))
  const aciertos = elegidas.filter((o) => o.correcta).length
  const errores = elegidas.filter((o) => !o.correcta).length
  const correcto = emb.multi
    ? aciertos === emb.nCorrectas && errores === 0
    : aciertos === 1 && errores === 0
  const parcial = emb.multi && aciertos > 0 && !correcto

  const mensajes: Resolucion['mensajes'] = []
  if (correcto) {
    mensajes.push({ texto: emb.opciones.find((o) => o.correcta)?.feedback || 'Sostenido por el texto.', tono: 'ok' })
  } else {
    for (const o of elegidas.filter((x) => !x.correcta)) {
      mensajes.push({ texto: o.feedback || 'El texto no atribuye esto a ese concepto.', tono: 'mal' })
    }
    const buenas = emb.opciones.filter((o) => o.correcta && !e.seleccion.includes(o.id))
    if (buenas.length) {
      mensajes.push({ texto: `Sostenido por el texto: ${buenas.map((b) => b.texto).join(' · ')}`, tono: 'nota' })
    }
  }
  if (e.condicion === 'marco_rival' && !correcto) {
    const marco = ctx.rng.pick(ctx.contenido.marcos)
    if (marco?.principios.length) {
      mensajes.push({ texto: `${marco.etiqueta} aprovecha el hueco: «${ctx.rng.pick(marco.principios)}».`, tono: 'nota' })
    }
  }

  let dano = 0
  let golpe: Golpe = 'fallido'
  if (esIntu) {
    golpe = correcto ? 'estabilizado' : 'pausa'
  } else if (correcto || parcial) {
    const g = calcularGolpe(e, ctx, emb, aciertos, errores, cartaValida, apuesta, objetivo)
    dano = g.dano
    golpe = g.golpe
  }

  const calibrado = (correcto && apuesta !== 'baja') || (!correcto && apuesta === 'baja')

  return {
    correcto, parcial, dano, golpe,
    objetivoUid: objetivo?.uid ?? null,
    derribado: !!objetivo && dano >= objetivo.hp,
    apuesta, calibrado, mensajes,
    cierre: emb.cierre,
    aristaDescubierta: correcto ? emb.aristaRevelada : null,
    repertorioTocado: elegidas.find((o) => o.repertoireId)?.repertoireId ?? emb.repertorioTocado,
    intuicionResuelta: esIntu && correcto ? cartaRaw!.cardId : null,
    conceptIds: emb.conceptIds,
    latenciaMs: Date.now() - e.inicioEmbate,
    ayuda: e.ayudaEnEmbate,
    improvisado: !esIntu && !cartaValida,
    turnoEnemigo: [],
    danoRecibido: 0
  }
}

/** Aplica el resultado al frente y deja los gestos listos para el escenario. */
export function aplicar(e: EstadoCombate, r: Resolucion): void {
  for (const en of e.enemigos) en.gesto = 'quieto'

  const objetivo = e.enemigos.find((x) => x.uid === r.objetivoUid)
  if (objetivo && r.dano > 0) {
    objetivo.hp = Math.max(0, objetivo.hp - r.dano)
    const critico = r.golpe === 'critico_rareza' || r.golpe === 'critico_apuesta'
    objetivo.gesto = objetivo.hp === 0 ? 'cae' : critico ? 'critico' : 'herido'
    // un crítico desarma al enemigo: el buen juego reduce el daño entrante
    if (critico && objetivo.hp > 0) objetivo.aturdido = true
  }
  if (r.golpe === 'estabilizado' && objetivo) objetivo.gesto = 'estabilizado'
  if (!r.correcto && objetivo) objetivo.fuerza += 1

  if (e.embate?.tipoRelacion && r.correcto) e.tiposRelacionUsados.push(e.embate.tipoRelacion)
  if (!r.correcto) e.erroresEnCombate += 1

  const jugada = e.mano.find((c) => c.uid === e.cartaJugada)
  if (jugada) {
    e.mano = e.mano.filter((c) => c.uid !== jugada.uid)
    if (!r.intuicionResuelta) e.descarte.push(jugada)
  }
  const carta = jugada && !esIntuicion(jugada.cardId) ? porId(jugada.cardId) : null
  if (r.correcto && carta?.efecto === 'robar_si_acierta') robar(e, 1)

  e.ultima = r
  e.fase = vivos(e).length === 0 ? 'ganado' : 'resuelto'
}

/** El turno del enemigo: cada superviviente pega y aplica su amenaza. */
export function turnoEnemigo(
  e: EstadoCombate, ctx: ContextoCombate, r: Resolucion
): { dano: number; intuiciones: string[] } {
  if (e.fase === 'ganado') return { dano: 0, intuiciones: [] }
  let total = 0
  const intuiciones: string[] = []

  for (const en of vivos(e)) {
    if (en.aturdido) {
      en.aturdido = false
      r.turnoEnemigo.push({ texto: `${en.nombre} pierde el turno.`, dano: 0 })
      continue
    }
    const d = ataqueDe(en)
    total += d
    en.gesto = 'golpea'
    const amenaza = AMENAZAS[en.perfil.amenaza]
    let extra = ''

    switch (en.perfil.amenaza) {
      case 'olvido':
        if (e.mano.length) {
          const i = ctx.rng.int(e.mano.length)
          e.descarte.push(e.mano[i])
          e.mano.splice(i, 1)
          extra = ' Se lleva una carta.'
        }
        break
      case 'ruido': e.ruidoPendiente = true; extra = ' El próximo turno robas menos.'; break
      case 'niebla': e.nieblaPendiente = true; extra = ' Vela el próximo embate.'; break
      case 'superficie': e.superficiePendiente = true; extra = ' Retira las definiciones de apoyo.'; break
      case 'susurro': {
        const reps = ctx.contenido.repertorios
        if (reps.length) {
          const rep = ctx.rng.pick(reps)
          intuiciones.push(rep.id)
          extra = ` Deja una intuición: «${rep.etiqueta}».`
        }
        break
      }
      case 'insistencia': en.fuerza += 1; extra = ' Se envalentona.'; break
      case 'escudo': extra = ` Solo lo hiere la familia ${en.perfil.cede.join('/') || 'que exige'}.`; break
    }
    r.turnoEnemigo.push({ texto: `${en.nombre} · ${amenaza.nombre}.${extra}`, dano: d })
  }

  const castigo = r.correcto ? 0 : APUESTAS[r.apuesta].castigo
  if (castigo) {
    r.turnoEnemigo.push({ texto: 'Tu apuesta no acompañó al resultado.', dano: castigo })
    total += castigo
  }
  r.danoRecibido = total
  e.intuicionesRecibidas.push(...intuiciones)
  return { dano: total, intuiciones }
}

export function siguienteTurno(e: EstadoCombate, ctx: ContextoCombate): void {
  e.turno += 1
  e.embate = null
  e.objetivo = null
  e.seleccion = []
  e.cartaJugada = null
  e.apuesta = null
  e.acciones = 2
  e.ayudaEnEmbate = false
  e.definicionAbierta = null
  e.inicioEmbate = Date.now()
  e.fase = 'objetivo'
  const objetivoMano = tamanoMano(e, ctx)
  e.ruidoPendiente = false
  robar(e, Math.max(0, objetivoMano - e.mano.length))
}

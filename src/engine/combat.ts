import type { Contenido } from '../content/types'
import { porId, type CartaOperacion, type EfectoInstrumento } from './cards'
import type { CondicionId, Embate, Arquetipo } from './encounters'
import type { Rng } from './rng'

export type Apuesta = 'baja' | 'media' | 'alta'

export const APUESTAS: Record<Apuesta, { mult: number; castigo: number; etiqueta: string; glosa: string }> = {
  baja: { mult: 1, castigo: 0, etiqueta: 'Baja', glosa: 'Sin penalización si fallas.' },
  media: { mult: 1.5, castigo: 2, etiqueta: 'Media', glosa: 'Rinde más; el fallo cuesta algo.' },
  alta: { mult: 2, castigo: 5, etiqueta: 'Alta', glosa: 'Rinde el doble; el fallo duele.' }
}

export interface CartaEnMano { uid: string; cardId: string }

export interface Resolucion {
  correcto: boolean
  parcial: boolean
  dano: number
  autodano: number
  aciertos: number
  errores: number
  apuesta: Apuesta
  calibrado: boolean
  mensajes: { texto: string; tono: 'ok' | 'mal' | 'nota' }[]
  cierre: string | null
  aristaDescubierta: { from: string; to: string; tipo: string } | null
  repertorioTocado: string | null
  conceptIds: string[]
  latenciaMs: number
  ayuda: boolean
  improvisado: boolean
}

export interface EstadoCombate {
  arquetipo: Arquetipo
  nombre: string
  hp: number
  hpMax: number
  condicion: CondicionId | null
  embate: Embate
  mano: CartaEnMano[]
  mazo: CartaEnMano[]
  descarte: CartaEnMano[]
  manoBase: number
  acciones: number
  seleccion: string[]
  cartaJugada: string | null
  apuesta: Apuesta | null
  fase: 'eligiendo' | 'resuelto' | 'ganado' | 'perdido'
  ultima: Resolucion | null
  turno: number
  consultas: number
  ayudaEnEmbate: boolean
  tiposRelacionUsados: string[]
  erroresEnCombate: number
  inicioEmbate: number
  definicionAbierta: string | null
  embatesResueltos: number
}

export interface ContextoCombate {
  contenido: Contenido
  instrumentos: EfectoInstrumento[]
  rng: Rng
}

/* ------------------------------ mazo y mano ------------------------------- */

export function armarMazo(cartas: string[], rng: Rng): CartaEnMano[] {
  return rng.shuffle(cartas.map((cardId, i) => ({ uid: `${cardId}#${i}`, cardId })))
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
  return Math.max(2, n)
}

/** ¿Esta carta puede responder a este embate? */
export function sirve(carta: CartaOperacion, embate: Embate): boolean {
  return carta.familias.includes(embate.familia)
}

export function hayCartaUtil(e: EstadoCombate): boolean {
  return e.mano.some((c) => sirve(porId(c.cardId), e.embate))
}

/* --------------------------------- daño ----------------------------------- */

/** El daño NUNCA se conoce antes de resolver. Se calcula aquí, después de comprobar. */
export function calcularDano(
  e: EstadoCombate, ctx: ContextoCombate, aciertos: number, errores: number,
  carta: CartaOperacion | null, apuesta: Apuesta
): number {
  const emb = e.embate
  let base = 4 + 6 * emb.peso
  base *= 0.8 + 0.6 * emb.dificultad

  if (emb.tipoRelacion) {
    const freqs = Object.values(ctx.contenido.frecuenciaRelacion)
    const max = Math.max(1, ...freqs)
    const f = ctx.contenido.frecuenciaRelacion[emb.tipoRelacion] ?? 1
    const rareza = 1 + (1 - f / max) * 0.8
    base *= rareza
    if (carta?.efecto === 'bonus_relacion_rara') base *= 1 + (1 - f / max) * 0.5
  }
  if (emb.distancia) {
    const m = emb.distancia === 'lejana' ? 1.6 : emb.distancia === 'media' ? 1.3 : 1.05
    base *= m
    if (carta?.efecto === 'bonus_distancia') base *= m > 1.2 ? 1.35 : 1
  }
  if (carta?.efecto === 'bonus_umbral' && emb.conceptoObjetivo &&
      ctx.contenido.conceptos[emb.conceptoObjetivo]?.esUmbral) base *= 1.4

  if (emb.multi) base = base * (aciertos / Math.max(1, emb.nCorrectas)) - errores * 3

  if (!carta) base *= 0.4                       // improvisar sin la operación adecuada
  if (e.ayudaEnEmbate && !ctx.instrumentos.includes('glosario')) base *= 0.7
  if (e.ayudaEnEmbate && ctx.instrumentos.includes('glosario') && e.consultas > 1) base *= 0.7

  let mult = APUESTAS[apuesta].mult
  if (apuesta === 'alta' && ctx.instrumentos.includes('conviccion')) mult = 2.5
  base *= mult

  if (ctx.instrumentos.includes('cartografo')) {
    base *= 1 + 0.12 * new Set(e.tiposRelacionUsados).size
  }
  if (e.condicion === 'monocultivo' && emb.tipoRelacion && e.tiposRelacionUsados.length > 0) {
    if (emb.tipoRelacion !== e.tiposRelacionUsados[0]) base *= 0.35
  }
  return Math.max(1, Math.round(base))
}

export function calcularAutodano(
  e: EstadoCombate, ctx: ContextoCombate, carta: CartaOperacion | null, apuesta: Apuesta
): number {
  if (e.erroresEnCombate === 0 && ctx.instrumentos.includes('segunda_lectura')) return 0
  let d = 3 + APUESTAS[apuesta].castigo
  if (apuesta === 'alta' && ctx.instrumentos.includes('conviccion')) d += 3
  if (e.condicion === 'marco_rival') d = Math.round(d * 1.5)
  if (carta?.efecto === 'reduce_castigo') d = Math.round(d / 2)
  return d
}

/* ------------------------------- resolución ------------------------------- */

export function resolver(e: EstadoCombate, ctx: ContextoCombate): Resolucion {
  const emb = e.embate
  const carta = e.cartaJugada ? porId(e.cartaJugada) : null
  const cartaValida = carta && sirve(carta, emb) ? carta : null
  const apuesta = e.apuesta ?? 'baja'
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
      mensajes.push({
        texto: o.feedback || `El texto no atribuye esto a ese concepto.`,
        tono: 'mal'
      })
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

  const dano = correcto || parcial ? calcularDano(e, ctx, aciertos, errores, cartaValida, apuesta) : 0
  const autodano = correcto ? 0 : calcularAutodano(e, ctx, cartaValida, apuesta)

  // calibración: apostar alto y acertar, o bajo y fallar
  const calibrado = (correcto && apuesta !== 'baja') || (!correcto && apuesta === 'baja')

  const latenciaMs = Date.now() - e.inicioEmbate

  return {
    correcto, parcial, dano, autodano, aciertos, errores, apuesta, calibrado, mensajes,
    cierre: emb.cierre,
    aristaDescubierta: correcto ? emb.aristaRevelada : null,
    repertorioTocado: elegidas.find((o) => o.repertoireId)?.repertoireId ?? emb.repertorioTocado,
    conceptIds: emb.conceptIds,
    latenciaMs,
    ayuda: e.ayudaEnEmbate,
    improvisado: !cartaValida
  }
}

/** Aplica la resolución al estado: descarta, roba y avanza el turno. */
export function aplicar(e: EstadoCombate, ctx: ContextoCombate, r: Resolucion): void {
  e.hp = Math.max(0, e.hp - r.dano)
  if (!r.correcto) e.erroresEnCombate += 1
  if (e.embate.tipoRelacion && r.correcto) e.tiposRelacionUsados.push(e.embate.tipoRelacion)
  e.embatesResueltos += 1

  const jugada = e.mano.find((c) => c.uid === e.cartaJugada || c.cardId === e.cartaJugada)
  if (jugada) {
    e.mano = e.mano.filter((c) => c.uid !== jugada.uid)
    e.descarte.push(jugada)
  }
  const carta = e.cartaJugada ? porId(e.cartaJugada) : null
  if (r.correcto && carta?.efecto === 'robar_si_acierta') robar(e, 1)

  e.ultima = r
  e.fase = e.hp <= 0 ? 'ganado' : 'resuelto'
  void ctx
}

export function siguienteTurno(e: EstadoCombate, ctx: ContextoCombate, embate: Embate): void {
  e.turno += 1
  e.embate = embate
  e.seleccion = []
  e.cartaJugada = null
  e.apuesta = null
  e.acciones = 2
  e.ayudaEnEmbate = false
  e.definicionAbierta = null
  e.inicioEmbate = Date.now()
  e.fase = 'eligiendo'
  const objetivo = tamanoMano(e, ctx)
  robar(e, Math.max(0, objetivo - e.mano.length))
}

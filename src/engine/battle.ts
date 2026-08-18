import type { Contenido } from '../content/types'
import {
  piezaApocrifa, piezaCaso, piezaConcepto, piezaDefinicion, piezaEtiqueta, piezaIntuicion,
  piezaMarco, piezaTesis, piezasCriterio, piezasSubdimension, type Pieza
} from './pieces'
import {
  evaluarDiagrama, HERRAMIENTAS, type Diagnostico, type Dimension, type HerramientaId,
  type ModificadoresLente, type Trazo
} from './tools'
import {
  crearEnemigo, factorBlindaje, generarOleada, tipoPorId, type Dificultad, type Enemigo
} from './lane'
import type { Rng } from './rng'
import { SELLOS, type SelloId } from './powers'

/* ==========================================================================
   Estado de la batalla. El tablero es libre: las piezas se sueltan donde el
   jugador quiera y las herramientas las relacionan.
   ========================================================================== */

export type AccionPozo = 'quemar' | 'cambiar'

export interface EventoPozo {
  accion: AccionPozo
  clase: Pieza['clase']
  conceptId: string | null
  apocrifa: boolean
  /** ¿pertenecía al material de esta casilla? */
  pertenece: boolean
  acertado: boolean
  dimension: Dimension
  nota: string
  /** recompensa inmediata: quemar bien tiene que sentirse */
  tinta: number
  bonusMult: number
  titulo: string
}

export interface FotoDiagrama {
  tablero: PiezaEnTablero[]
  trazos: Trazo[]
  piezas: Pieza[]
}

export interface ResultadoTurno {
  diag: Diagnostico
  /** el diagrama tal como quedó, para poder corregir SOBRE él */
  foto: FotoDiagrama
  impactos: { uid: string; nombre: string; dano: number; motivo: string | null; derribado: boolean }[]
  danoTotal: number
  parteEnemiga: { texto: string; dano: number }[]
  danoRecibido: number
  intuicionesNuevas: string[]
  apocrifasNuevas: number
  cartasPerdidas: number
}

export interface PiezaEnTablero { uid: string; x: number; y: number }

export interface EstadoBatalla {
  dificultad: Dificultad
  acto: number
  conceptIdsCasilla: string[]
  enemigos: Enemigo[]
  /** el mazo de piezas que reparte el currículo */
  mazo: Pieza[]
  mano: Pieza[]
  descarte: Pieza[]
  /** piezas ya soltadas en el tablero, con su posición */
  tablero: PiezaEnTablero[]
  trazos: Trazo[]
  /** herramientas disponibles este turno (el mazo del jugador) */
  herramientas: HerramientaId[]
  usadas: HerramientaId[]
  relacionesDisponibles: string[]
  quemasRestantes: number
  cambiosRestantes: number
  turno: number
  fase: 'jugando' | 'resuelto' | 'ganado' | 'perdido'
  ultima: ResultadoTurno | null
  manoBase: number
  pozo: EventoPozo[]
  /** el último gesto del pozo, para poder darle acuse de recibo en pantalla */
  ultimoPozo: EventoPozo | null
  /** conceptos fusionados: entran como carta completa en adelante */
  fusionados: string[]
  // — poderes —
  sellos: SelloId[]
  sellosUsados: SelloId[]
  /** falsificaciones ya señaladas (por Ojo crítico o por la Lupa) */
  reveladas: string[]
  /** bonificación acumulada para el próximo diagrama */
  bonusMult: number
  carrilCongelado: boolean
  tintaGanada: number
  quemasAcertadas: number
  inferenciasTotales: number
}

export interface ContextoBatalla {
  contenido: Contenido
  rng: Rng
  lentes: ModificadoresLente
}

export const TABLERO_ANCHO = 100 // porcentaje
export const TABLERO_ALTO = 100

/* ---------------------------- montaje del mazo ---------------------------- */

export interface Bolsa {
  herramientas: HerramientaId[]
  relaciones: string[]
  casos: string[]
  tesis: string[]
  intuiciones: string[]
  fusionados: string[]
  sellos: SelloId[]
  manoExtra: number
}

const APOCRIFAS: Record<Dificultad, number> = { facil: 1, media: 2, dura: 3, jefe: 4 }

export function montarMazo(
  c: Contenido, conceptIds: string[], bolsa: Bolsa, dificultad: Dificultad, rng: Rng
): Pieza[] {
  const piezas: Pieza[] = []

  for (const id of conceptIds) {
    if (bolsa.fusionados.includes(id)) {
      // ya lo aprendiste: entra como concepto completo, vale más y ocupa un hueco
      const p = piezaConcepto(c, id)
      if (p) piezas.push(p)
    } else {
      const e = piezaEtiqueta(c, id)
      const d = piezaDefinicion(c, id)
      if (e) piezas.push(e)
      if (d) piezas.push(d)
    }
  }
  for (let i = 0; i < APOCRIFAS[dificultad]; i++) {
    const p = piezaApocrifa(c, rng.pick(conceptIds), rng)
    if (p) piezas.push(p)
  }
  for (const id of bolsa.casos) { const p = piezaCaso(c, id); if (p) piezas.push(p) }
  for (const id of bolsa.tesis) {
    const p = piezaTesis(c, id)
    if (p) { piezas.push(p); piezas.push(...piezasCriterio(c, id, rng)) }
  }
  for (const id of bolsa.intuiciones) { const p = piezaIntuicion(c, id); if (p) piezas.push(p) }

  // un marco si alguno cubre esta casilla: sirve como campo semántico
  const marco = c.marcos.find((m) => m.conceptIds.filter((x) => conceptIds.includes(x)).length >= 2)
  if (marco) { const p = piezaMarco(c, marco.id); if (p) piezas.push(p) }

  // subdimensiones de los conceptos más ricos: atributos para el eje
  const conSub = conceptIds.filter((id) => (c.conceptos[id]?.subdimensiones.length ?? 0) > 0)
  for (const id of rng.sample(conSub, 2)) piezas.push(...piezasSubdimension(c, id).slice(0, 1))

  return rng.shuffle(piezas)
}

export function iniciarBatalla(
  ctx: ContextoBatalla, conceptIds: string[], bolsa: Bolsa, dificultad: Dificultad,
  acto: number, manoBase: number
): EstadoBatalla {
  const m = ctx.lentes
  const e: EstadoBatalla = {
    dificultad, acto, conceptIdsCasilla: conceptIds,
    enemigos: generarOleada(dificultad, acto, ctx.rng),
    mazo: montarMazo(ctx.contenido, conceptIds, bolsa, dificultad, ctx.rng),
    mano: [], descarte: [], tablero: [], trazos: [],
    herramientas: [...bolsa.herramientas, ...m.herramientasExtra], usadas: [],
    relacionesDisponibles: bolsa.relaciones,
    quemasRestantes: (dificultad === 'facil' ? 2 : 3) + m.quemasExtra,
    cambiosRestantes: 3 + m.cambiosExtra,
    turno: 1, fase: 'jugando', ultima: null,
    manoBase: manoBase + m.manoExtra + bolsa.manoExtra,
    pozo: [], ultimoPozo: null, fusionados: [...bolsa.fusionados],
    sellos: bolsa.sellos, sellosUsados: [], reveladas: [],
    bonusMult: 0, carrilCongelado: false,
    tintaGanada: 0, quemasAcertadas: 0, inferenciasTotales: 0
  }
  robar(e, e.manoBase)
  // Ojo crítico: algunas falsificaciones vienen ya señaladas
  if (m.revelaApocrifas > 0) {
    e.reveladas = e.mano.filter((p) => p.clase === 'apocrifa')
      .slice(0, m.revelaApocrifas).map((p) => p.uid)
  }
  return e
}

export function robar(e: EstadoBatalla, n: number): void {
  for (let i = 0; i < n; i++) {
    if (!e.mazo.length) {
      if (!e.descarte.length) return
      e.mazo = e.descarte
      e.descarte = []
    }
    const p = e.mazo.shift()
    if (p) e.mano.push(p)
  }
}

export const vivos = (e: EstadoBatalla): Enemigo[] => e.enemigos.filter((x) => x.hp > 0)

export function piezasDelTablero(e: EstadoBatalla): Pieza[] {
  const enMano = new Map(e.mano.map((p) => [p.uid, p]))
  const puestas = e.tablero
    .map((t) => e.mano.find((p) => p.uid === t.uid) ?? e.descarte.find((p) => p.uid === t.uid))
    .filter((p): p is Pieza => !!p)
  void enMano
  return puestas
}

/* ------------------------------ tablero ---------------------------------- */

export function soltar(e: EstadoBatalla, uid: string, x: number, y: number): void {
  const ya = e.tablero.find((t) => t.uid === uid)
  if (ya) { ya.x = x; ya.y = y; return }
  if (!e.mano.some((p) => p.uid === uid)) return
  e.tablero.push({ uid, x, y })
}

/** Qué se perdería al devolver esta pieza: la interfaz lo pregunta antes. */
export function trazosQueUsan(e: EstadoBatalla, uid: string): Trazo[] {
  return e.trazos.filter((t) => t.piezas.includes(uid))
}

export function devolverAMano(e: EstadoBatalla, uid: string): void {
  // al deshacer un trazo hay que devolver su herramienta al cinturón, o el
  // jugador la pierde por mover una carta de sitio
  for (const t of trazosQueUsan(e, uid)) borrarTrazo(e, t.uid)
  e.tablero = e.tablero.filter((t) => t.uid !== uid)
}

let nt = 0
export function trazar(
  e: EstadoBatalla, tool: HerramientaId, piezas: string[], param: string | null
): Trazo | null {
  const h = HERRAMIENTAS[tool]
  if (piezas.length < h.aridad[0] || piezas.length > h.aridad[1]) return null
  if (!e.herramientas.includes(tool)) return null
  const t: Trazo = { uid: `t${nt++}`, tool, piezas, param }
  e.trazos.push(t)
  e.usadas.push(tool)
  return t
}

export function borrarTrazo(e: EstadoBatalla, uid: string): void {
  const t = e.trazos.find((x) => x.uid === uid)
  if (!t) return
  e.trazos = e.trazos.filter((x) => x.uid !== uid)
  const i = e.usadas.indexOf(t.tool)
  if (i >= 0) e.usadas.splice(i, 1)
}

export function herramientasLibres(e: EstadoBatalla): HerramientaId[] {
  const restantes = [...e.herramientas]
  for (const u of e.usadas) {
    const i = restantes.indexOf(u)
    if (i >= 0) restantes.splice(i, 1)
  }
  return restantes
}

/* ==========================================================================
   El pozo. Quemar es afirmar que la carta es falsa; cambiar es decir que es
   verdadera pero no sirve aquí. Dos gestos, cuatro resultados, dos señales.
   ========================================================================== */

export function quemar(e: EstadoBatalla, ctx: ContextoBatalla, uid: string): EventoPozo | null {
  if (e.quemasRestantes <= 0) return null
  const p = e.mano.find((x) => x.uid === uid)
  if (!p) return null
  const apocrifa = p.clase === 'apocrifa' || (p.clase === 'criterio' && p.sentido !== 'refuta')
  const pertenece = !!p.conceptId && e.conceptIdsCasilla.includes(p.conceptId)

  e.mano = e.mano.filter((x) => x.uid !== uid)
  devolverAMano(e, uid)
  e.tablero = e.tablero.filter((t) => t.uid !== uid)
  e.quemasRestantes -= 1
  e.reveladas = e.reveladas.filter((x) => x !== uid)

  // quemar bien tiene que SENTIRSE: tinta, bonificación y una carta nueva
  const tinta = apocrifa ? 3 + ctx.lentes.tintaPorQuema : 0
  const bonusMult = apocrifa ? 0.8 : 0
  if (apocrifa) {
    e.quemasAcertadas += 1
    e.tintaGanada += tinta
    e.bonusMult += bonusMult
    robar(e, 1)
  }

  const ev: EventoPozo = {
    accion: 'quemar', clase: p.clase, conceptId: p.conceptId, apocrifa, pertenece,
    acertado: apocrifa, dimension: 'discriminacion', titulo: p.titulo,
    tinta, bonusMult,
    nota: apocrifa
      ? `Bien visto: ${p.explicacion} Ganas ${tinta} de tinta, robas una carta y tu próximo diagrama multiplica +${bonusMult.toFixed(1)}.`
      : `«${p.titulo}» era legítima. La destruiste y no volverá en esta expedición.`
  }
  e.pozo.push(ev)
  e.ultimoPozo = ev
  return ev
}

export function cambiar(e: EstadoBatalla, uid: string): EventoPozo | null {
  if (e.cambiosRestantes <= 0) return null
  const p = e.mano.find((x) => x.uid === uid)
  if (!p) return null
  const apocrifa = p.clase === 'apocrifa' || (p.clase === 'criterio' && p.sentido !== 'refuta')
  const pertenece = !!p.conceptId && e.conceptIdsCasilla.includes(p.conceptId)

  e.mano = e.mano.filter((x) => x.uid !== uid)
  devolverAMano(e, uid)
  e.descarte.push(p)
  e.cambiosRestantes -= 1
  robar(e, 1)

  const ev: EventoPozo = {
    accion: 'cambiar', clase: p.clase, conceptId: p.conceptId, apocrifa, pertenece,
    acertado: !apocrifa, titulo: p.titulo, tinta: 0, bonusMult: 0,
    dimension: apocrifa ? 'discriminacion' : 'srl_accion',
    nota: apocrifa
      ? 'Era una falsificación y vuelve al mazo: cambiarla no la retira.'
      : !pertenece && p.conceptId
        ? 'No venía al caso en esta casilla: buena gestión de la mano.'
        : 'Guardada para más adelante.'
  }
  e.pozo.push(ev)
  e.ultimoPozo = ev
  return ev
}

/* ============================== los sellos ================================ */

export function usarSello(e: EstadoBatalla, id: SelloId): string | null {
  if (!e.sellos.includes(id) || e.sellosUsados.includes(id)) return null
  e.sellosUsados.push(id)
  switch (id) {
    case 'lupa': {
      const falsas = e.mano.filter((p) => p.clase === 'apocrifa' ||
        (p.clase === 'criterio' && p.sentido !== 'refuta'))
      e.reveladas = [...new Set([...e.reveladas, ...falsas.map((p) => p.uid)])]
      return falsas.length
        ? `${falsas.length} falsificación(es) señalada(s) en tu mano.`
        : 'No hay ninguna falsificación en tu mano ahora mismo.'
    }
    case 'pluma':
      robar(e, 3)
      return 'Robas tres cartas.'
    case 'goma':
      e.carrilCongelado = true
      return 'El carril se detiene este turno.'
    case 'atajo':
      e.herramientas = [...e.herramientas, 'flecha', 'identidad']
      return 'Una flecha y una identidad extra para este turno.'
    case 'calco':
      e.bonusMult += 2
      return 'Tu próximo diagrama multiplica +2.0.'
    case 'purga': {
      e.descarte.push(...e.mano)
      const n = e.mano.length
      e.mano = []
      robar(e, Math.max(e.manoBase, n))
      return 'Mano nueva sin gastar cambios.'
    }
    default:
      return null
  }
}

export const selloDisponible = (e: EstadoBatalla, id: SelloId): boolean =>
  e.sellos.includes(id) && !e.sellosUsados.includes(id)

export const nombreSello = (id: SelloId): string => SELLOS[id].nombre

/* ==========================================================================
   Afirmar el diagrama completo
   ========================================================================== */

export function afirmar(e: EstadoBatalla, ctx: ContextoBatalla): ResultadoTurno {
  const piezas = [...e.mano, ...e.descarte]
  const lentesConBonus = e.bonusMult > 0
    ? { ...ctx.lentes, multGlobal: ctx.lentes.multGlobal + e.bonusMult }
    : ctx.lentes
  const diag = evaluarDiagrama(ctx.contenido, piezas, e.trazos, lentesConBonus)
  const impactos: ResultadoTurno['impactos'] = []
  let danoTotal = 0

  for (const en of e.enemigos) { en.gesto = 'quieto'; en.tocadoEsteTurno = false }

  const formaDiag = {
    eslabones: diag.sostenidos,
    puente: diag.combos.some((c) => c.id === 'cierre' || c.id === 'constelacion'),
    contraste: e.trazos.some((t) => t.param === 'contrasta'),
    jugadas: [
      ...e.trazos.map((t) => t.tool as string),
      ...diag.combos.map((c) => c.id as string),
      ...(diag.sostenidos >= 2 ? ['cadena'] : []),
      ...(diag.sostenidos >= 1 ? ['enlace'] : [])
    ]
  }

  if (diag.dano > 0) {
    const objetivos = vivos(e).sort((a, b) => a.posicion - b.posicion).slice(0, diag.alcance)
    let cascada = 1
    for (const en of objetivos) {
      const { factor, motivo } = factorBlindaje(en, formaDiag)
      const dano = Math.max(factor < 1 ? 1 : 2, Math.round(diag.dano * cascada * factor))
      const rasgo = tipoPorId(en.tipoId).rasgo

      if (rasgo === 'retrocede' && !en.retrocedioYa && dano >= en.hp) {
        en.retrocedioYa = true
        en.hp = Math.max(1, Math.round(en.hpMax * 0.45))
        en.posicion = Math.min(8, en.posicion + 3)
        en.gesto = 'retrocede'
        impactos.push({ uid: en.uid, nombre: en.nombre, dano, motivo: 'Retrocede en vez de caer.', derribado: false })
      } else {
        en.hp = Math.max(0, en.hp - dano)
        en.tocadoEsteTurno = true
        en.gesto = en.hp === 0 ? 'cae' : diag.mult >= 4 ? 'critico' : 'herido'
        if (rasgo === 'fases' && !motivo) en.fase += 1
        impactos.push({ uid: en.uid, nombre: en.nombre, dano, motivo, derribado: en.hp === 0 })
      }
      danoTotal += dano
      cascada *= 0.62
    }
    for (const en of [...e.enemigos]) {
      if (en.hp === 0 && tipoPorId(en.tipoId).rasgo === 'divide' && !en.uid.includes('cria')) {
        for (let i = 0; i < 2; i++) {
          const cria = crearEnemigo('copista', 0.65 + e.acto * 0.1, Math.min(8, en.posicion + 1 + i))
          cria.uid = `${cria.uid}-cria`
          cria.nombre = 'Entrada suelta'
          e.enemigos.push(cria)
        }
      }
    }
  }

  const r: ResultadoTurno = {
    diag, impactos, danoTotal, parteEnemiga: [], danoRecibido: 0,
    intuicionesNuevas: [], apocrifasNuevas: 0, cartasPerdidas: 0,
    // se congela ANTES de limpiar: el feedback ocurre sobre el propio dibujo
    foto: {
      tablero: e.tablero.map((t) => ({ ...t })),
      trazos: e.trazos.map((t) => ({ ...t })),
      piezas: e.tablero
        .map((t) => e.mano.find((x) => x.uid === t.uid))
        .filter((x): x is Pieza => !!x)
    }
  }

  // limpiar el tablero: lo usado va al descarte, lo reubicado sale de la run
  for (const t of e.tablero) {
    const p = e.mano.find((x) => x.uid === t.uid)
    if (!p) continue
    e.mano = e.mano.filter((x) => x.uid !== p.uid)
    const reubicada = p.clase === 'intuicion' && p.refId && diag.repertoriosReubicados.includes(p.refId)
    if (!reubicada) e.descarte.push(p)
  }
  e.fusionados = [...new Set([...e.fusionados, ...diag.fusiona])]
  e.tablero = []
  e.trazos = []
  e.usadas = []
  e.bonusMult = 0
  e.inferenciasTotales += diag.veredictos.filter((v) => v.inferencia).length
  // Impulso: cada acierto hace robar
  if (ctx.lentes.robarPorAcierto) robar(e, diag.sostenidos * ctx.lentes.robarPorAcierto)

  e.ultima = r
  e.fase = vivos(e).length === 0 ? 'ganado' : 'resuelto'
  return r
}

/* ------------------------------ turno del carril -------------------------- */

export function turnoDelCarril(e: EstadoBatalla, ctx: ContextoBatalla, r: ResultadoTurno): void {
  if (e.fase === 'ganado') return
  if (e.carrilCongelado) {
    e.carrilCongelado = false
    r.parteEnemiga.push({ texto: 'La Goma detiene el carril: nadie avanza ni golpea.', dano: 0 })
    r.danoRecibido = r.diag.autodano
    return
  }
  let total = r.diag.autodano
  if (total > 0) {
    r.parteEnemiga.push({ texto: 'Afirmar lo que el texto no dice te cuesta lucidez.', dano: total })
  }

  for (const en of vivos(e)) {
    const t = tipoPorId(en.tipoId)
    en.edad += 1

    if (t.rasgo === 'regenera' && !en.tocadoEsteTurno && en.hp < en.hpMax) {
      en.hp = Math.min(en.hpMax, en.hp + 6)
      r.parteEnemiga.push({ texto: `${en.nombre} se reescribe y recupera terreno.`, dano: 0 })
    }
    let avance = t.velocidad
    if (t.rasgo === 'salta' && en.edad % 2 === 0) avance += 2
    if (avance > 0 && en.posicion > 1) {
      en.posicion = Math.max(1, en.posicion - avance)
      en.gesto = 'avanza'
    }
    if (en.posicion <= t.alcance) {
      if (t.rasgo === 'roba') {
        if (e.mano.length) {
          const i = ctx.rng.int(e.mano.length)
          e.descarte.push(e.mano[i])
          e.mano.splice(i, 1)
          r.cartasPerdidas += 1
          r.parteEnemiga.push({ texto: `${en.nombre} se lleva una carta de tu mano.`, dano: 0 })
        }
      } else {
        total += en.ataque
        en.gesto = 'golpea'
        let extra = ''
        if (t.rasgo === 'apocrifo') {
          const p = piezaApocrifa(ctx.contenido, ctx.rng.pick(e.conceptIdsCasilla), ctx.rng)
          if (p) { e.descarte.push(p); r.apocrifasNuevas += 1; extra = ' Deja una falsificación en tu mazo.' }
        }
        if (t.rasgo === 'retrocede') {
          const reps = ctx.contenido.repertorios
          if (reps.length) {
            const rep = ctx.rng.pick(reps)
            r.intuicionesNuevas.push(rep.id)
            const p = piezaIntuicion(ctx.contenido, rep.id)
            if (p) e.descarte.push(p)
            extra = ` Deja una intuición: «${rep.etiqueta}».`
          }
        }
        r.parteEnemiga.push({ texto: `${en.nombre} golpea.${extra}`, dano: en.ataque })
      }
    }
  }
  r.danoRecibido = total
}

export function siguienteTurno(e: EstadoBatalla): void {
  e.turno += 1
  e.fase = 'jugando'
  e.ultimoPozo = null
  robar(e, Math.max(0, e.manoBase - e.mano.length))
}

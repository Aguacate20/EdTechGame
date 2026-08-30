import type { Contenido } from '../content/types'
import {
  piezaApocrifa, piezaCaso, piezaConcepto, piezaDefinicion, piezaEtiqueta, piezaIntuicion,
  piezaMarco, piezaTesis, piezasCriterio, piezasSubdimension, type Pieza
} from './pieces'
import {
  esAcierto, evaluarDiagrama, HERRAMIENTAS, type Diagnostico, type Dimension,
  type HerramientaId, type ModificadoresLente, type Trazo
} from './tools'
import {
  crearEnemigo, factorBlindaje, generarOleada, tipoPorId, type Dificultad, type Enemigo
} from './lane'
import type { Rng } from './rng'
import { SELLOS, type SelloId } from './powers'
import { piezaContexto } from './pieces'
import { armarDisparo, type Disparo } from './weapons'
import { componerOleadas, oleadaDePuerta, type NivelApoyo, type Oleada } from './aprendizaje'
import { juzgarSello, PRIMA_MARCADO, SELLO_FALLA, SELLO_X, type Encargo } from './srl'

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
  /** con qué arma salió el ataque: la herramienta dominante decide la forma */
  disparo: Disparo
  /** vínculos descubiertos al derribar enemigos en este turno */
  descubiertos: string[]
  /** el diagrama tal como quedó, para poder corregir SOBRE él */
  foto: FotoDiagrama
  impactos: { uid: string; nombre: string; dano: number; motivo: string | null; derribado: boolean }[]
  danoTotal: number
  parteEnemiga: { texto: string; dano: number }[]
  danoRecibido: number
  intuicionesNuevas: string[]
  apocrifasNuevas: number
  cartasPerdidas: number
  /** resultado del sello de confianza, si el jugador selló este diagrama */
  sello: { acertado: boolean; nota: string } | null
  /** lo que el golpe sobró tras derribar: se convierte en lucidez */
  sobredano: number
  /** conceptos marcados en la reflexión anterior que aquí se sostuvieron */
  cuentasSaldadas: string[]
}

export interface PiezaEnTablero { uid: string; x: number; y: number }

export interface EstadoBatalla {
  /** modo aprendizaje activo en esta sala */
  apoyo: boolean
  /** oleadas de la sala en modo aprendizaje; vacío en modo normal */
  oleadas: Oleada[]
  oleadaIdx: number
  nivelApoyo: NivelApoyo
  /** conceptos de oleadas anteriores: hay que reusarlos */
  previos: string[]
  /** pares que fallaste: vuelven en la siguiente oleada */
  paresFallados: [string, string][]
  /** conceptos de la sala sin evidencia, para decidir la oleada del nudo */
  sinEvidencia: string[]
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
  quemasAcertadas: number
  inferenciasTotales: number
  /** lo que el jugador sostuvo en este combate, para el mapa de cierre */
  hallazgos: Hallazgos
  /** vínculos descubiertos DENTRO de este combate, al derribar enemigos */
  relacionesNuevas: string[]
  /** cuándo se repartió la mano de este turno, para medir latencia */
  inicioTurno: number
  /** latencias por turno, y cuáles tenían una intuición en juego */
  latencias: { ms: number; conIntuicion: boolean; trazos: number }[]
  /** terrenos ganados: intuiciones que se conservan en vez de borrarse */
  terrenosGanados: string[]
  mejorGolpe: { dano: number; fichas: number; mult: number; trazos: number }
  // — autorregulación —
  /** el encargo elegido al entrar; null si no eligió (también es una señal) */
  encargo: Encargo | null
  /** encargos ofrecidos, para poder mostrarlos hasta que se elija o se trace */
  encargosOfrecidos: Encargo[]
  /** el jugador selló el diagrama de este turno */
  sellado: boolean
  sellosHechos: number
  sellosAcertados: number
  combosVistos: string[]
  conceptosSostenidos: string[]
  erroresTotales: number
  invertidosTotales: number
  /** fallos por concepto en esta sala: contra esto se juzga la reflexión */
  fallosPorConcepto: Record<string, number>
  /** conceptos marcados en la sala anterior: vuelven con prima */
  marcados: string[]
  /** turnos seguidos con al menos un acierto; solo error/inversión la rompen */
  racha: number
  condicion: string | null
  /** hazaña Catedral: una Constelación con el diagrama sellado */
  selladoConstelacion: boolean
}

/* Lo que el jugador sostuvo durante el combate, guardado para el mapa de cierre.
   Solo entran los ACIERTOS: el mapa final es lo que quedó en pie, no el borrador. */

export interface Vinculo {
  from: string
  to: string
  /** la etiqueta que se dibuja sobre la línea: «extiende», «ejemplifica»… */
  tipo: string
  estado: string
  herramienta: string
  nota: string
  /** cuántas veces se sostuvo a lo largo del combate */
  veces: number
}

export interface Grupo {
  ids: string[]
  etiqueta: string
  herramienta: string
  nota: string
}

export interface Hallazgos {
  vinculos: Vinculo[]
  grupos: Grupo[]
  /** conceptos cuyo nombre emparejaste con su descripción */
  reconocidos: string[]
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
  /** terrenos ya conquistados: entran al mazo como comodines de campo */
  terrenos: string[]
  /** modo aprendizaje: el andamio no se retira solo, se declara */
  apoyo: boolean
  /** el tutorial reparte una mano y un frente fijos, para poder guiar paso a paso */
  mazoFijo?: Pieza[]
  enemigosFijos?: Enemigo[]
  /** conceptos que el estudiante aún no ha tocado: con apoyo llegan enteros */
  sinTocar: string[]
  /** conceptos de la sala sin evidencia: deciden si hace falta la oleada del nudo */
  sinEvidencia?: string[]
  /** conceptos que el estudiante marcó como difíciles al cerrar la sala anterior */
  marcados?: string[]
  /** conceptos dominados retirados en el refugio: adelgazan la mano */
  archivados?: string[]
  /** tratos de la portada elegida */
  quemasDelta?: number
  apocrifasDelta?: number
  /** condición de la sala: modula la recompensa, nunca la corrección */
  condicion?: string | null
}

const APOCRIFAS: Record<Dificultad, number> = { facil: 1, media: 2, dura: 3, jefe: 4 }

export function montarMazo(
  c: Contenido, conceptIds: string[], bolsa: Bolsa, dificultad: Dificultad, rng: Rng
): Pieza[] {
  const piezas: Pieza[] = []

  for (const id of conceptIds) {
    // lo archivado en el refugio no vuelve: se dominó y salió de la mesa
    if (bolsa.archivados?.includes(id) && !bolsa.marcados?.includes(id)) continue
    // con andamio, lo que nunca has visto llega entero: primero se aprende qué
    // es, y solo después se pone a prueba si lo reconoces por su descripción
    const enteroPorApoyo = bolsa.apoyo && bolsa.sinTocar.includes(id)
    if (bolsa.fusionados.includes(id) || enteroPorApoyo) {
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
  for (let i = 0; i < Math.max(0, APOCRIFAS[dificultad] + (bolsa.apocrifasDelta ?? 0)); i++) {
    const p = piezaApocrifa(c, rng.pick(conceptIds), rng)
    if (p) piezas.push(p)
  }
  // lo que marcaste como difícil vuelve aunque la casilla no lo traiga: es la
  // práctica espaciada elegida por el propio estudiante
  for (const id of bolsa.marcados ?? []) {
    if (conceptIds.includes(id)) continue
    const p = piezaConcepto(c, id)
    if (p) piezas.push(p)
  }
  for (const id of bolsa.casos) { const p = piezaCaso(c, id); if (p) piezas.push(p) }
  for (const id of bolsa.tesis) {
    const p = piezaTesis(c, id)
    if (p) { piezas.push(p); piezas.push(...piezasCriterio(c, id, rng)) }
  }
  for (const id of bolsa.intuiciones) { const p = piezaIntuicion(c, id); if (p) piezas.push(p) }
  for (const id of bolsa.terrenos) { const p = piezaContexto(c, id); if (p) piezas.push(p) }

  // un marco si alguno cubre esta casilla: sirve como campo semántico
  const marco = c.marcos.find((m) => m.conceptIds.filter((x) => conceptIds.includes(x)).length >= 2)
  if (marco) { const p = piezaMarco(c, marco.id); if (p) piezas.push(p) }

  // subdimensiones de los conceptos más ricos: atributos para el eje
  const conSub = conceptIds.filter((id) => (c.conceptos[id]?.subdimensiones.length ?? 0) > 0)
  for (const id of rng.sample(conSub, 2)) piezas.push(...piezasSubdimension(c, id).slice(0, 3))

  return rng.shuffle(piezas)
}

export function iniciarBatalla(
  ctx: ContextoBatalla, conceptIds: string[], bolsa: Bolsa, dificultad: Dificultad,
  acto: number, manoBase: number
): EstadoBatalla {
  const m = ctx.lentes
  const e: EstadoBatalla = {
    apoyo: bolsa.apoyo,
    oleadas: [], oleadaIdx: 0,
    nivelApoyo: bolsa.apoyo ? 'total' : 'ninguno',
    previos: [], paresFallados: [], sinEvidencia: bolsa.sinEvidencia ?? [],
    dificultad, acto, conceptIdsCasilla: conceptIds,
    enemigos: bolsa.enemigosFijos ?? generarOleada(dificultad, acto, ctx.rng),
    mazo: bolsa.mazoFijo ?? montarMazo(ctx.contenido, conceptIds, bolsa, dificultad, ctx.rng),
    mano: [], descarte: [], tablero: [], trazos: [],
    herramientas: [...bolsa.herramientas, ...m.herramientasExtra], usadas: [],
    relacionesDisponibles: bolsa.relaciones,
    quemasRestantes: Math.max(1, (dificultad === 'facil' ? 2 : 3) + m.quemasExtra + (bolsa.quemasDelta ?? 0)),
    cambiosRestantes: 3 + m.cambiosExtra,
    turno: 1, fase: 'jugando', ultima: null,
    manoBase: manoBase + m.manoExtra,
    pozo: [], ultimoPozo: null, fusionados: [...bolsa.fusionados],
    sellos: bolsa.sellos, sellosUsados: [], reveladas: [],
    bonusMult: 0, carrilCongelado: false,
    quemasAcertadas: 0, inferenciasTotales: 0,
    hallazgos: { vinculos: [], grupos: [], reconocidos: [] },
    relacionesNuevas: [],
    inicioTurno: Date.now(), latencias: [], terrenosGanados: [], mejorGolpe: { dano: 0, fichas: 0, mult: 0, trazos: 0 },
    encargo: null, encargosOfrecidos: [], sellado: false, sellosHechos: 0, sellosAcertados: 0,
    combosVistos: [], conceptosSostenidos: [], erroresTotales: 0, invertidosTotales: 0,
    fallosPorConcepto: {}, marcados: bolsa.marcados ?? [],
    racha: 0, condicion: bolsa.condicion ?? null, selladoConstelacion: false
  }
  if (bolsa.apoyo && !bolsa.mazoFijo) {
    e.oleadas = componerOleadas(ctx.contenido, conceptIds, bolsa.herramientas, acto, ctx.rng)
    const primera = e.oleadas[0]
    if (primera) {
      e.enemigos = primera.enemigos
      e.herramientas = primera.herramientas
      e.nivelApoyo = primera.apoyo
      // partidas: la primera tanda es de reconocer, y la Identidad necesita
      // un nombre y una descripción sueltos para poder emparejarlos
      e.mazo = montarMazo(
        ctx.contenido, primera.conceptIds, { ...bolsa, sinTocar: [] }, 'facil', ctx.rng
      )
      e.mano = []
    }
  }
  robar(e, e.manoBase)
  // Ojo crítico: algunas falsificaciones vienen ya señaladas
  const aRevelar = m.revelaApocrifas + (bolsa.apoyo && acto <= 1 ? 9 : 0)
  if (aRevelar > 0) {
    e.reveladas = e.mano.filter((p) => p.clase === 'apocrifa')
      .slice(0, aRevelar).map((p) => p.uid)
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

  // quemar bien tiene que SENTIRSE: bonificación al próximo diagrama y carta nueva
  const bonusMult = apocrifa ? (ctx.lentes.quemasExtra >= 2 ? 1.6 : 0.8) : 0
  if (apocrifa) {
    e.quemasAcertadas += 1
    e.bonusMult += bonusMult
    robar(e, 1)
  }

  const ev: EventoPozo = {
    accion: 'quemar', clase: p.clase, conceptId: p.conceptId, apocrifa, pertenece,
    acertado: apocrifa, dimension: 'discriminacion', titulo: p.titulo,
    bonusMult,
    nota: apocrifa
      ? `Bien visto: ${p.explicacion} Robas una carta y tu próximo diagrama multiplica +${bonusMult.toFixed(1)}.`
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
    acertado: !apocrifa, titulo: p.titulo, bonusMult: 0,
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

/** Declarar que todo lo que hay en el tablero se sostiene. Se puede quitar. */
export function sellar(e: EstadoBatalla, v: boolean): void {
  if (e.fase !== 'jugando') return
  e.sellado = v
}

/** Elegir encargo (o ninguno). Solo antes del primer trazo de la sala. */
export function elegirEncargo(e: EstadoBatalla, en: Encargo | null): void {
  if (e.turno !== 1 || e.trazos.length > 0) return
  e.encargo = en
  e.encargosOfrecidos = []
}

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
  // no se avanza acumulando, se avanza reusando: si el diagrama no toca nada de
  // las oleadas anteriores, rinde la mitad
  if (e.previos.length && diag.dano > 0) {
    const tocaPrevios = diag.conceptIds.some((id) => e.previos.includes(id))
    if (!tocaPrevios) {
      diag.mult = Math.max(0.4, diag.mult * 0.5)
      diag.dano = Math.round(diag.fichas * diag.mult * diag.xmult)
      diag.cierre = 'Esto no engancha con lo de antes: en aprendizaje lo nuevo tiene que apoyarse en lo ya visto.'
    }
  }
  // cuenta pendiente: sostener algo sobre lo que marcaste como difícil paga fichas
  const cuentasSaldadas = e.marcados.filter((id) =>
    diag.veredictos.some((v) => esAcierto(v.estado) && v.conceptIds.includes(id)))
  if (cuentasSaldadas.length) {
    diag.fichas += PRIMA_MARCADO * cuentasSaldadas.length
    diag.dano = Math.round(diag.fichas * diag.mult * diag.xmult)
  }
  // condición MONOCULTIVO: las identidades no hieren (pero siguen fusionando)
  if (e.condicion === 'monocultivo') {
    const fichasIdent = diag.veredictos
      .filter((v) => v.trazo.tool === 'identidad')
      .reduce((n, v) => n + v.fichas, 0)
    if (fichasIdent > 0) {
      diag.fichas = Math.max(0, diag.fichas - fichasIdent)
      diag.dano = Math.round(diag.fichas * diag.mult * diag.xmult)
    }
  }
  // racha: turnos seguidos sosteniendo algo. Solo error/inversión la rompen.
  if (e.racha > 0 && diag.dano > 0) {
    diag.mult += 0.1 * e.racha
    diag.dano = Math.round(diag.fichas * diag.mult * diag.xmult)
  }
  // condición MARCO RIVAL: cada contraste sostenido suma medio punto de mult
  if (e.condicion === 'marco_rival') {
    const contrastes = diag.veredictos
      .filter((v) => esAcierto(v.estado) && v.trazo.param === 'contrasta').length
    if (contrastes > 0) {
      diag.mult += 0.5 * contrastes
      diag.dano = Math.round(diag.fichas * diag.mult * diag.xmult)
    }
  }
  // sello de confianza: no toca la corrección, solo la recompensa
  let sello: ResultadoTurno['sello'] = null
  if (e.sellado) {
    sello = juzgarSello(diag)
    e.sellosHechos += 1
    if (sello.acertado) {
      e.sellosAcertados += 1
      diag.xmult *= SELLO_X
      diag.xmultsActivos.push({ nombre: 'Sellado', factor: SELLO_X })
      if (diag.combos.some((x) => x.id === 'constelacion')) e.selladoConstelacion = true
    } else diag.mult = diag.mult * SELLO_FALLA
    diag.dano = Math.max(0, Math.round(diag.fichas * diag.mult * diag.xmult))
  }
  // con el andamio puesto, el número no se dispara: el modo aprendizaje
  // conserva las lentes pero acota la capa multiplicativa a ×2
  if (e.apoyo && diag.xmult > 2) {
    diag.xmult = 2
    diag.dano = Math.max(0, Math.round(diag.fichas * diag.mult * diag.xmult))
  }
  // condición CADENA: la frase suelta rinde el 40 %
  if (e.condicion === 'cadena' && e.trazos.length === 1 && diag.dano > 0) {
    diag.dano = Math.round(diag.dano * 0.4)
    diag.cierre = 'Cadena: aquí una afirmación suelta no abre camino. Encadena dos o más.'
  }
  const impactos: ResultadoTurno['impactos'] = []
  let danoTotal = 0
  let sobredano = 0

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
    // El golpe recorre el carril de cerca a lejos. Dentro del alcance, cada
    // objetivo recibe su parte (con la caída del 0.62); y lo que SOBRA al
    // derribar se ARRASTRA al siguiente, blindaje mediante, hasta agotarse.
    // Un supergolpe puede limpiar el carril entero; un tanque cuyo blindaje
    // tu diagrama no vence corta la cadena, que es exactamente su oficio.
    const objetivos = vivos(e).sort((a, b) => a.posicion - b.posicion)
    let cascada = 1
    let arrastre = 0
    for (let i = 0; i < objetivos.length; i++) {
      const en = objetivos[i]
      const base = i < diag.alcance ? diag.dano * cascada : 0
      const entrante = base + arrastre
      if (entrante <= 0) { if (i >= diag.alcance) break; cascada *= 0.62; continue }
      arrastre = 0
      const { factor, motivo } = factorBlindaje(en, formaDiag)
      const dano = Math.max(factor < 1 ? 1 : 2, Math.round(entrante * factor))
      const rasgo = tipoPorId(en.tipoId).rasgo

      if (rasgo === 'retrocede' && !en.retrocedioYa && dano >= en.hp) {
        // el Eco no cae: retrocede y ABSORBE el golpe, así que la cadena muere ahí
        en.retrocedioYa = true
        en.hp = Math.max(1, Math.round(en.hpMax * 0.45))
        en.posicion = Math.min(8, en.posicion + 3)
        en.gesto = 'retrocede'
        impactos.push({ uid: en.uid, nombre: en.nombre, dano, motivo: 'Retrocede en vez de caer.', derribado: false })
      } else {
        const hpAntes = en.hp
        en.hp = Math.max(0, en.hp - dano)
        en.tocadoEsteTurno = true
        en.gesto = en.hp === 0 ? 'cae' : diag.mult >= 4 ? 'critico' : 'herido'
        if (rasgo === 'fases' && !motivo) en.fase += 1
        impactos.push({
          uid: en.uid, nombre: en.nombre, dano,
          motivo: motivo ?? (base === 0 ? 'El golpe desborda desde el anterior.' : null),
          derribado: en.hp === 0
        })
        if (en.hp === 0 && dano > hpAntes) arrastre = dano - hpAntes
      }
      danoTotal += dano
      if (i < diag.alcance) cascada *= 0.62
    }
    // lo que sobra cuando ya no queda a quién golpear vuelve como claridad
    sobredano = arrastre
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

  // descubrimiento: cada enemigo derribado revela un tipo de vínculo del texto
  // que el jugador todavía no conocía. Las relaciones son de donde sale la
  // información cognitiva, así que conviene que se ganen jugando y no de golpe.
  const descubiertos: string[] = []
  for (const im of impactos) {
    if (!im.derribado) continue
    const nuevo = relacionPorDescubrir(e, ctx)
    if (nuevo) {
      e.relacionesDisponibles = [...e.relacionesDisponibles, nuevo]
      e.relacionesNuevas.push(nuevo)
      descubiertos.push(nuevo)
    }
  }

  const r: ResultadoTurno = {
    diag,
    disparo: armarDisparo(
      e.trazos.map((t) => t.tool),
      e.trazos.map((t) => t.param ?? '').filter(Boolean),
      diag.dano,
      impactos.map((i) => i.uid)
    ),
    descubiertos,
    impactos, danoTotal, parteEnemiga: [], danoRecibido: 0,
    intuicionesNuevas: [], apocrifasNuevas: 0, cartasPerdidas: 0,
    sello, sobredano, cuentasSaldadas,
    // se congela ANTES de limpiar: el feedback ocurre sobre el propio dibujo
    foto: {
      tablero: e.tablero.map((t) => ({ ...t })),
      trazos: e.trazos.map((t) => ({ ...t })),
      piezas: e.tablero
        .map((t) => e.mano.find((x) => x.uid === t.uid))
        .filter((x): x is Pieza => !!x)
    }
  }

  const nTrazos = e.trazos.length
  // limpiar el tablero: lo usado va al descarte, lo reubicado sale de la run
  for (const t of e.tablero) {
    const p = e.mano.find((x) => x.uid === t.uid)
    if (!p) continue
    e.mano = e.mano.filter((x) => x.uid !== p.uid)
    const reubicada = p.clase === 'intuicion' && p.refId && diag.repertoriosReubicados.includes(p.refId)
    if (reubicada && p.refId) {
      // no se borra: el cambio conceptual es coexistencia, no reemplazo.
      // vuelve al mazo dada la vuelta, sabiendo en qué terreno sí funcionaba
      if (!e.terrenosGanados.includes(p.refId)) e.terrenosGanados.push(p.refId)
      const terreno = piezaContexto(ctx.contenido, p.refId)
      if (terreno) e.descarte.push(terreno)
    } else e.descarte.push(p)
  }
  e.fusionados = [...new Set([...e.fusionados, ...diag.fusiona])]
  e.tablero = []
  e.trazos = []
  e.usadas = []
  e.bonusMult = 0
  e.inferenciasTotales += diag.veredictos.filter((v) => v.inferencia).length

  // La latencia solo dice algo cuando hay conflicto entre repertorios: si en la
  // mano había una intuición que confunde a un concepto del diagrama, tardar
  // más es el tira y afloja entre la idea previa y la científica.
  const conceptosEnJuego = new Set(diag.conceptIds)
  const conIntuicion = [...e.mano, ...e.descarte].some(
    (p) => p.clase === 'intuicion' && p.conceptId && conceptosEnJuego.has(p.conceptId)
  )
  e.latencias.push({
    ms: Date.now() - e.inicioTurno, conIntuicion, trazos: nTrazos
  })

  // memoria del combate: los aciertos se acumulan turno a turno, de modo que
  // «A extiende B» del turno 1 y «B ejemplifica C» del turno 3 acaban siendo
  // una sola cadena en el mapa de cierre
  registrarHallazgos(e, diag)
  // cuenta para el encargo y para la reflexión de cierre
  e.sellado = false
  e.combosVistos = [...new Set([...e.combosVistos, ...diag.combos.map((x) => x.id)])]
  e.conceptosSostenidos = [...new Set([
    ...e.conceptosSostenidos,
    ...diag.veredictos.filter((v) => esAcierto(v.estado)).flatMap((v) => v.conceptIds)
  ])]
  e.erroresTotales += diag.errores
  e.invertidosTotales += diag.invertidos
  // la racha respeta la regla 3: el silencio no castiga, así que no la rompe
  if (diag.errores > 0 || diag.invertidos > 0) e.racha = 0
  else if (diag.sostenidos > 0) e.racha += 1
  for (const v of diag.veredictos) {
    if (esAcierto(v.estado) || v.estado === 'silencio') continue
    for (const id of v.conceptIds) e.fallosPorConcepto[id] = (e.fallosPorConcepto[id] ?? 0) + 1
  }
  if (diag.dano > e.mejorGolpe.dano) {
    e.mejorGolpe = {
      dano: diag.dano, fichas: diag.fichas, mult: diag.mult, trazos: e.trazos.length
    }
  }
  // Impulso: cada acierto hace robar
  if (ctx.lentes.robarPorAcierto) robar(e, diag.sostenidos * ctx.lentes.robarPorAcierto)

  // los pares que fallaste vuelven en la oleada siguiente: el error es la vía,
  // no el castigo
  for (const v of diag.veredictos) {
    if (v.estado === 'invertido' || v.estado === 'error') {
      const [a, b] = v.conceptIds
      if (a && b) e.paresFallados.push([a, b])
    }
  }

  e.ultima = r
  if (vivos(e).length === 0 && e.oleadas.length && hayMasOleadas(e, ctx)) {
    e.fase = 'resuelto'
  } else {
    e.fase = vivos(e).length === 0 ? 'ganado' : 'resuelto'
  }
  return r
}

/* ==========================================================================
   Las oleadas del modo aprendizaje
   ========================================================================== */

function hayMasOleadas(e: EstadoBatalla, ctx: ContextoBatalla): boolean {
  if (e.oleadaIdx + 1 < e.oleadas.length) return true
  // ¿queda el nudo? el concepto que ordena la unidad sigue sin sostenerse
  return !!oleadaDePuerta(
    ctx.contenido, e.conceptIdsCasilla, e.sinEvidencia, e.acto, e.previos
  ) && !e.oleadas.some((o) => o.esPuerta)
}

export const oleadaActual = (e: EstadoBatalla): Oleada | null =>
  e.oleadas[e.oleadaIdx] ?? null

/** Entra la siguiente tanda: más conceptos, una herramienta más y un apoyo menos. */
export function avanzarOleada(e: EstadoBatalla, ctx: ContextoBatalla, bolsa: Bolsa): Oleada | null {
  let siguiente = e.oleadas[e.oleadaIdx + 1]
  if (!siguiente) {
    const nudo = oleadaDePuerta(
      ctx.contenido, e.conceptIdsCasilla, e.sinEvidencia, e.acto, e.previos
    )
    if (!nudo || e.oleadas.some((o) => o.esPuerta)) return null
    e.oleadas = [...e.oleadas, nudo]
    siguiente = nudo
  }
  e.oleadaIdx += 1
  e.previos = [...new Set([...e.previos, ...(oleadaActual(e)?.previos ?? []), ...e.conceptIdsCasilla
    .filter((id) => e.oleadas.slice(0, e.oleadaIdx).some((o) => o.conceptIds.includes(id)))])]
  e.enemigos = siguiente.enemigos
  e.herramientas = [...e.herramientas, ...siguiente.herramientas]
  e.usadas = []
  e.nivelApoyo = siguiente.apoyo
  e.reveladas = []

  // los conceptos nuevos entran al mazo, y con ellos los pares que fallaste
  const vuelven = [...new Set(e.paresFallados.flat())].filter(
    (id) => !siguiente!.conceptIds.includes(id) && e.conceptIdsCasilla.includes(id)
  )
  // lo que ya identificaste vuelve entero: te lo ganaste. Lo nuevo llega
  // partido si el andamio ya se retiró, y entero mientras siga puesto.
  const nuevas = montarMazo(
    ctx.contenido,
    [...siguiente.conceptIds, ...vuelven],
    {
      ...bolsa,
      fusionados: [...new Set([...bolsa.fusionados, ...e.fusionados, ...e.previos])],
      sinTocar: siguiente.apoyo === 'parcial' ? siguiente.conceptIds : []
    },
    siguiente.apoyo === 'ninguno' ? 'media' : 'facil',
    ctx.rng
  )
  e.mazo = ctx.rng.shuffle([...e.mazo, ...nuevas])
  e.paresFallados = []
  e.tablero = []
  e.trazos = []
  e.turno += 1
  e.fase = 'jugando'
  robar(e, Math.max(0, e.manoBase - e.mano.length))
  if (siguiente.apoyo !== 'ninguno') {
    e.reveladas = e.mano.filter((p) => p.clase === 'apocrifa').map((p) => p.uid)
  }
  return siguiente
}

/* ------------------------------ turno del carril -------------------------- */

/** Cada herramienta deja un rastro distinto: la flecha y la secuencia dejan
 *  vínculos dirigidos; el campo y el eje dejan agrupaciones; la identidad deja
 *  un concepto reconocido. Meterlo todo en «pares» fabricaba aristas falsas. */
function registrarHallazgos(e: EstadoBatalla, diag: Diagnostico): void {
  const h = e.hallazgos
  for (const v of diag.veredictos) {
    if (!esAcierto(v.estado)) continue
    const tool = v.trazo.tool

    if (tool === 'identidad') {
      for (const id of v.conceptIds) {
        if (!h.reconocidos.includes(id)) h.reconocidos.push(id)
      }
      continue
    }

    if (tool === 'campo' || tool === 'eje' || tool === 'ancla') {
      const etiqueta = tool === 'campo' ? 'mismo campo'
        : tool === 'eje' ? (v.trazo.param?.split('::').pop() ?? 'mismo eje')
        : 'opera en el caso'
      const clave = [...v.conceptIds].sort().join('|')
      if (!h.grupos.some((g) => [...g.ids].sort().join('|') === clave)) {
        h.grupos.push({ ids: v.conceptIds, etiqueta, herramienta: tool, nota: v.nota })
      }
      continue
    }

    // flecha, jerarquía y secuencia: las aristas literales cuando las hay,
    // y si no (caso de una inferencia) el par que el jugador afirmó
    const pares = v.aristas.length
      ? v.aristas
      : v.conceptIds.length >= 2
        ? [{ from: v.conceptIds[0], to: v.conceptIds[1], tipo: v.trazo.param ?? tool }]
        : []

    for (const a of pares) {
      const ya = h.vinculos.find((x) => x.from === a.from && x.to === a.to && x.tipo === a.tipo)
      if (ya) { ya.veces += 1; continue }
      h.vinculos.push({
        from: a.from, to: a.to, tipo: a.tipo,
        estado: v.estado, herramienta: tool, nota: v.nota, veces: 1
      })
    }
  }
}

/** Qué vínculo tiene sentido revelar aquí: uno que exista de verdad entre los
 *  conceptos de esta sala y que el jugador aún no tenga. */
function relacionPorDescubrir(e: EstadoBatalla, ctx: ContextoBatalla): string | null {
  const enSala = new Set(e.conceptIdsCasilla)
  const candidatos = [...new Set(
    ctx.contenido.aristas
      .filter((a) => enSala.has(a.from) || enSala.has(a.to))
      .map((a) => a.tipo)
  )].filter((t) => !e.relacionesDisponibles.includes(t))
  if (!candidatos.length) return null
  // primero los más escasos del texto: son los que más rinden y menos se ven
  return candidatos.sort(
    (a, b) => (ctx.contenido.frecuenciaRelacion[a] ?? 0) - (ctx.contenido.frecuenciaRelacion[b] ?? 0)
  )[0]
}

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
  e.inicioTurno = Date.now()
  e.fase = 'jugando'
  e.ultimoPozo = null
  robar(e, Math.max(0, e.manoBase - e.mano.length))
}

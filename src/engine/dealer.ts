/* ============================================================================
   El Repartidor.

   El azar puro reparte manos mudas y rachas injustas; un reparto guiado sin
   azar mataría la sorpresa. Esto es lo de en medio: un robo PONDERADO que
   garantiza un piso de jugabilidad y usa el modelo cognitivo para decidir
   qué conviene que aparezca — sin tocar jamás lo que las jugadas valen.

   Tiers de una carta del mazo, mirando la mano actual:
     · ancla    — completa una pareja de Identidad (nombre↔descripción)
     · veta     — su concepto tiene con la mano un vínculo INTERESANTE: de
                  un tipo que el jugador ya puede afirmar, que su Atlas no
                  ha sostenido todavía, y además raro en el texto o entre
                  zonas distintas. Es la carta que hace posible una relación
                  que valga la pena, no una repetición de lo ya sabido.
     · puente   — su concepto tiene arista con algo que ya está en la mano
     · chispa   — no tiene arista con la mano, pero está CERCA: vecino común,
                  misma zona, co-ocurrencia o un vínculo que el extractor lee
                  entre líneas. Es la materia de la creatividad: con ella en
                  la mesa el jugador puede proponer algo que el texto no dice
                  y que sin embargo es probable.
     · repaso   — es (o empareja con) un concepto MARCADO en la reflexión:
                  la cuenta pendiente vuelve a la mesa (práctica de
                  recuperación dirigida, Zimmerman)
     · reto     — su concepto no tiene ninguna arista asentada en el Atlas:
                  material aún no dominado
     · especial — caso/tesis/marco con algún miembro en la mano (el juez
                  mixto los hace jugables), o un criterio cuya tesis está
     · lastre   — caso/tesis/marco SIN miembro en la mano, o un criterio sin
                  su tesis: no engancha con nada y ocupa un hueco. Se sirve
                  poco, para que la mano no se ensucie de material inerte
     · resto    — lo demás

   Los pesos se corren con el acto (el andamio se retira: al principio pesan
   ancla y puente; después, veta, chispa, reto y especial) y con la PIEDAD:
   cada turno sin un solo logro sube el peso de las categorías fáciles; un
   logro la resetea. Motor de engagement con suelo, no tragamonedas.

   La APERTURA ya no es el tope de un mazo barajado. Se reparte con plan:
   una pareja para emparejar, un puente que valga la pena (veta si la hay),
   una chispa para poder proponer, y el resto por ruleta. Así la primera mano
   de cada sala —donde se decide si el jugador siente que puede pensar con
   estas cartas— nunca es una lotería.

   GUARDAS DE INTEGRIDAD DE SEÑAL — no negociables:
   1. El Repartidor cambia EXPOSICIÓN, nunca veredictos, fichas ni combos.
   2. Es CIEGO a la bandera de apócrifa: una falsificación puede ser el
      "ancla" servida. Discriminarla sigue siendo trabajo del jugador.
   3. Determinista: todo pasa por el RNG de la run. Misma semilla, misma
      expedición.
   ============================================================================ */

import type { Contenido } from '../content/types'
import { proximidad } from './graph'
import type { Pieza } from './pieces'
import type { Rng } from './rng'

export type Tier = 'ancla' | 'veta' | 'puente' | 'chispa' | 'repaso' | 'reto' | 'especial' | 'resto' | 'lastre'

export interface MiradaMano {
  /** conceptIds presentes en la mano (apócrifas incluidas: ceguera deliberada) */
  conceptos: Set<string>
  /** conceptIds cuya etiqueta está en mano sin su definición, y viceversa */
  mediasParejas: Set<string>
  marcados: Set<string>
  /** conceptIds con al menos una arista asentada (dominio previo) */
  dominados: Set<string>
  /** claves `from|to|tipo` ya sostenidas en el Atlas */
  asentadas: Set<string>
  /** tipos de vínculo que el jugador puede afirmar ahora (vacío = todos) */
  disponibles: Set<string>
  /** tesis presentes en la mano: sus criterios dejan de ser lastre */
  tesis: Set<string>
}

export function mirarMano(
  mano: Pieza[], marcados: string[], asentadas: string[], disponibles: string[] = []
): MiradaMano {
  const conceptos = new Set<string>()
  const etiquetas = new Set<string>()
  const definiciones = new Set<string>()
  for (const p of mano) {
    if (!p.conceptId) continue
    conceptos.add(p.conceptId)
    if (p.clase === 'etiqueta' || p.clase === 'apocrifa' || p.clase === 'concepto') etiquetas.add(p.conceptId)
    if (p.clase === 'definicion' || p.clase === 'concepto') definiciones.add(p.conceptId)
  }
  const mediasParejas = new Set<string>()
  for (const id of etiquetas) if (!definiciones.has(id)) mediasParejas.add(id)
  for (const id of definiciones) if (!etiquetas.has(id)) mediasParejas.add(id)
  const dominados = new Set<string>()
  for (const k of asentadas) {
    const [a, b] = k.split('|')
    if (a) dominados.add(a)
    if (b) dominados.add(b)
  }
  const tesis = new Set<string>()
  for (const p of mano) if (p.clase === 'tesis' && p.refId) tesis.add(p.refId)
  return {
    conceptos, mediasParejas, marcados: new Set(marcados), dominados,
    asentadas: new Set(asentadas), disponibles: new Set(disponibles), tesis
  }
}

/* -------------------------- qué vínculo interesa -------------------------- */

const clave = (a: string, b: string, t: string) => `${a}|${b}|${t}`

/** Un vínculo de un tipo escaso en este texto: lo que el autor apenas usa
 *  está menos trillado y es más difícil de ver. */
export function esTipoRaro(c: Contenido, tipo: string): boolean {
  const freqs = Object.values(c.frecuenciaRelacion).sort((a, b) => a - b)
  if (freqs.length < 3) return false
  const umbral = freqs[Math.floor(freqs.length / 3)] ?? 0
  return (c.frecuenciaRelacion[tipo] ?? 0) <= umbral
}

/** Interés de la arista entre `cid` y `otro`, para decidir si una carta es
 *  veta o solo puente. Cuenta: que el verbo esté disponible, que el Atlas no
 *  la haya sostenido ya, que sea rara y que cruce zonas del texto. */
export function interesArista(c: Contenido, cid: string, otro: string, m: MiradaMano): number {
  let mejor = 0
  for (const a of c.aristas) {
    const toca = (a.from === cid && a.to === otro) || (a.from === otro && a.to === cid)
    if (!toca) continue
    let s = 0
    if (m.disponibles.size === 0 || m.disponibles.has(a.tipo)) s += 2
    if (!m.asentadas.has(clave(a.from, a.to, a.tipo))) s += 1.5
    if (esTipoRaro(c, a.tipo)) s += 1
    const ca = c.conceptos[a.from]?.clusterId, cb = c.conceptos[a.to]?.clusterId
    if (ca && cb && ca !== cb) s += 1
    mejor = Math.max(mejor, s)
  }
  return mejor
}

/** ≥ 4.5 significa: verbo disponible, no asentada, y rara o entre zonas. */
export const UMBRAL_VETA = 4.5

/** ¿Está `cid` CERCA de algo de la mano sin tener arista directa con ello?
 *  Es lo que vuelve posible una propuesta con criterio. */
export function chispaCon(c: Contenido, cid: string, m: MiradaMano): string | null {
  for (const otro of m.conceptos) {
    if (otro === cid) continue
    const directa = c.aristas.some((a) =>
      (a.from === cid && a.to === otro) || (a.from === otro && a.to === cid))
    if (directa) continue
    const insinuada = (c.insinuadas ?? []).some((a) =>
      (a.from === cid && a.to === otro) || (a.from === otro && a.to === cid))
    if (insinuada) return otro
    const k = cid < otro ? `${cid}|${otro}` : `${otro}|${cid}`
    if (c.coocurrencias.has(k) || c.puentes[k]) return otro
    if (proximidad(c, cid, otro)) return otro
  }
  return null
}

const CLASES_NODO_SUELTO = new Set(['etiqueta', 'definicion', 'concepto', 'apocrifa'])

/** ¿Qué tier ocupa esta carta del mazo respecto de la mano? El primero que
 *  aplique, en orden de especificidad. */
export function tierDe(c: Contenido, p: Pieza, mirada: MiradaMano): Tier {
  if (['caso', 'tesis', 'marco'].includes(p.clase)) {
    return p.conceptIds.some((x) => mirada.conceptos.has(x)) ? 'especial' : 'lastre'
  }
  if (p.clase === 'criterio') return p.tesisId && mirada.tesis.has(p.tesisId) ? 'especial' : 'lastre'
  const cid = p.conceptId
  if (!cid) return 'resto'
  // un atributo de un concepto que ya está en la mesa es componible (eje,
  // descomposición): cuenta como puente
  if (p.clase === 'subdimension') return mirada.conceptos.has(cid) ? 'puente' : 'resto'
  const completaPareja =
    (p.clase === 'definicion' || p.clase === 'etiqueta' || p.clase === 'apocrifa') &&
    mirada.mediasParejas.has(cid)
  if (completaPareja) return mirada.marcados.has(cid) ? 'repaso' : 'ancla'
  if (mirada.marcados.has(cid)) return 'repaso'
  let interes = 0
  for (const otro of mirada.conceptos) {
    if (otro === cid) continue
    interes = Math.max(interes, interesArista(c, cid, otro, mirada))
  }
  if (interes >= UMBRAL_VETA) return 'veta'
  if (interes > 0) return 'puente'
  if (CLASES_NODO_SUELTO.has(p.clase) && chispaCon(c, cid, mirada)) return 'chispa'
  if (!mirada.dominados.has(cid)) return 'reto'
  return 'resto'
}

export function pesosDelReparto(acto: number, secos: number, condicion?: string | null): Record<Tier, number> {
  const w: Record<Tier, number> = {
    ancla: 3, veta: 2.2, puente: 3, chispa: 0.9, repaso: 2.2, especial: 1.4, reto: 1, resto: 2,
    lastre: 0.6
  }
  // el andamio se retira: los actos tardíos piden material no dominado, y
  // cada vez más relaciones que valgan la pena y más margen para proponer
  if (acto >= 1) {
    w.reto += 1; w.especial += 0.6; w.veta += 0.8; w.chispa += 0.5
    w.ancla = Math.max(1.2, w.ancla - 0.8)
  }
  if (acto >= 2) {
    w.reto += 1; w.veta += 0.6; w.chispa += 0.5
    w.puente = Math.max(1.4, w.puente - 0.8)
  }
  // la condición de la sala reordena qué es "componible" AQUÍ:
  // en Monocultivo las identidades no hieren — servirlas como piso sería
  // servir cartas muertas. La mesa se inclina hacia lo que la sala pide.
  if (condicion === 'monocultivo') {
    w.ancla = 0.6
    w.puente += 1.6
    w.veta += 1.6
    w.especial += 0.8
    w.repaso += 0.4
  }
  if (condicion === 'cadena') {
    // aquí una afirmación suelta rinde 40 %: conviene material encadenable
    w.puente += 1.2
    w.veta += 1.2
    w.especial += 0.4
  }
  if (condicion === 'marco_rival') {
    // la sala premia contrastes: marcos y vecinos del grafo al frente
    w.especial += 1.2
    w.puente += 0.8
    w.veta += 0.8
  }
  // piedad: la sequía inclina la mesa hacia lo componible, nunca la vuelca
  const alivio = Math.min(3, secos)
  if (condicion === 'monocultivo') { w.puente += alivio * 1.4; w.veta += alivio * 0.6 }
  else { w.ancla += alivio * 1.2; w.puente += alivio * 0.8; w.veta += alivio * 0.4 }
  if (alivio > 0) w.lastre = 0.2
  return w
}

/** Robo ponderado: elige tier por ruleta entre los tiers CON existencias,
 *  y dentro del tier, una carta al azar. Consume del mazo. */
export function robarRepartido(
  mazo: Pieza[], mano: Pieza[], c: Contenido, rng: Rng,
  acto: number, secos: number, marcados: string[], asentadas: string[],
  vetadas: string[], condicion?: string | null, disponibles: string[] = [],
  /** admisibilidad extra (la apertura la usa para no repetir nombres) */
  admite: (p: Pieza) => boolean = () => true
): Pieza | null {
  if (!mazo.length) return null
  const mirada = mirarMano(mano, marcados, asentadas, disponibles)
  const porTier = new Map<Tier, Pieza[]>()
  for (const p of mazo) {
    if (p.conceptId && vetadas.includes(p.conceptId)) continue
    if (!admite(p)) continue
    const t = tierDe(c, p, mirada)
    const lista = porTier.get(t) ?? []
    lista.push(p)
    porTier.set(t, lista)
  }
  const pesos = pesosDelReparto(acto, secos, condicion)
  const tiers = [...porTier.keys()]
  if (!tiers.length) return mazo.shift() ?? null
  let total = 0
  for (const t of tiers) total += pesos[t]
  let bola = rng.next() * total
  let elegido: Tier = tiers[0]
  for (const t of tiers) {
    bola -= pesos[t]
    if (bola <= 0) { elegido = t; break }
  }
  const lista = porTier.get(elegido)!
  const carta = lista[Math.floor(rng.next() * lista.length)]
  const i = mazo.findIndex((x) => x.uid === carta.uid)
  return i >= 0 ? mazo.splice(i, 1)[0] : mazo.shift() ?? null
}

/* ------------------------------- la apertura ------------------------------ */

export interface PlanApertura {
  acto: number
  marcados: string[]
  asentadas: string[]
  relacionesDisponibles: string[]
  condicion?: string | null
  /** cartas que debe tener la mano al terminar */
  tamano: number
}

export interface InformeApertura {
  ancla: boolean
  puente: Tier | null
  chispa: boolean
  especial: boolean
}

/** Cuántas cartas de un mismo concepto caben en la apertura. Más de tres es
 *  una mano monotemática: se ve un concepto y poco que relacionar. */
const TOPE_MISMO_CONCEPTO = 3

const esNombre = (p: Pieza) => p.clase === 'etiqueta' || p.clase === 'apocrifa' || p.clase === 'concepto'
const esDescripcion = (p: Pieza) => p.clase === 'definicion' || p.clase === 'concepto'

/** Regla de CONTENIDO, ciega a la bandera: en la apertura no se sirven dos
 *  nombres del mismo concepto ni dos descripciones del mismo concepto. Dos
 *  cartas que dicen «Confianza calibrada» en la misma mano son redundantes
 *  sea cual sea su autenticidad — y, de paso, evita que la apertura se llene
 *  de falsificaciones solo porque parecen buenos puentes. */
function repetiria(mano: Pieza[], p: Pieza): boolean {
  if (!p.conceptId) return false
  if (esNombre(p) && mano.some((x) => esNombre(x) && x.conceptId === p.conceptId)) return true
  if (esDescripcion(p) && mano.some((x) => esDescripcion(x) && x.conceptId === p.conceptId)) return true
  return false
}

const saca = (mazo: Pieza[], uid: string): Pieza | null => {
  const i = mazo.findIndex((x) => x.uid === uid)
  return i >= 0 ? mazo.splice(i, 1)[0] : null
}

const esNodoSuelto = (p: Pieza): boolean => !!p.conceptId && CLASES_NODO_SUELTO.has(p.clase)

/** Reparte la mano inicial con plan. Devuelve un pequeño informe (qué pudo
 *  garantizar) para el smoke y la telemetría; la mano se muta en sitio. */
export function repartirApertura(
  mano: Pieza[], mazo: Pieza[], c: Contenido, rng: Rng, plan: PlanApertura
): InformeApertura {
  const informe: InformeApertura = { ancla: false, puente: null, chispa: false, especial: false }
  const mirada = () => mirarMano(mano, plan.marcados, plan.asentadas, plan.relacionesDisponibles)
  const cuenta = (cid: string) => mano.filter((p) => p.conceptId === cid).length

  // 1. una pareja para emparejar (nombre + descripción del mismo concepto).
  //    Ciego a la apócrifa: una falsificación puede ser el nombre servido.
  //    En Monocultivo la identidad no hiere, así que no se garantiza.
  if (plan.condicion !== 'monocultivo') {
    const nombres = mazo.filter((p) => p.clase === 'etiqueta' || p.clase === 'apocrifa')
    const candidatos = nombres.filter((n) =>
      n.conceptId && mazo.some((d) => d.clase === 'definicion' && d.conceptId === n.conceptId))
    // primero lo marcado (cuenta pendiente), luego lo no dominado, luego azar
    const m0 = mirada()
    const ordenados = rng.shuffle(candidatos).sort((a, b) => {
      const pa = (m0.marcados.has(a.conceptId!) ? 0 : 1) + (m0.dominados.has(a.conceptId!) ? 1 : 0)
      const pb = (m0.marcados.has(b.conceptId!) ? 0 : 1) + (m0.dominados.has(b.conceptId!) ? 1 : 0)
      return pa - pb
    })
    const n = ordenados[0]
    if (n) {
      const d = mazo.find((x) => x.clase === 'definicion' && x.conceptId === n.conceptId)
      if (d) {
        const pn = saca(mazo, n.uid), pd = saca(mazo, d.uid)
        if (pn) mano.push(pn)
        if (pd) mano.push(pd)
        informe.ancla = true
      }
    }
  }

  // 2. un puente que valga la pena. Si hay veta (verbo disponible, no
  //    asentada, rara o entre zonas), veta; si no, cualquier puente.
  {
    const m1 = mirada()
    const nodos = mazo.filter((p) => esNodoSuelto(p) && !repetiria(mano, p))
    let mejor: { p: Pieza; s: number } | null = null
    if (m1.conceptos.size) {
      for (const p of rng.shuffle(nodos)) {
        let s = 0
        for (const otro of m1.conceptos) {
          if (otro !== p.conceptId) s = Math.max(s, interesArista(c, p.conceptId!, otro, m1))
        }
        // un NOMBRE es el nodo natural de una flecha; una descripción suelta
        // también sirve, pero es jugada de lector avanzado: se prefiere el nombre
        if (s > 0 && esNombre(p)) s += 0.25
        if (s > 0 && (!mejor || s > mejor.s)) mejor = { p, s }
      }
    }
    if (mejor) {
      const p = saca(mazo, mejor.p.uid)
      if (p) mano.push(p)
      informe.puente = mejor.s >= UMBRAL_VETA ? 'veta' : 'puente'
    } else {
      // sin mano aún (Monocultivo) o sin puente hacia ella: buscar un PAR del
      // mazo unido por la arista más interesante y servir los dos
      let par: { a: Pieza; b: Pieza; s: number } | null = null
      const vistos = new Set<string>()
      for (const a of rng.shuffle(nodos)) {
        for (const b of nodos) {
          if (a.conceptId === b.conceptId) continue
          const k = `${a.conceptId}|${b.conceptId}`
          if (vistos.has(k)) continue
          vistos.add(k)
          let s = interesArista(c, a.conceptId!, b.conceptId!, m1)
          if (s > 0) s += (esNombre(a) ? 0.25 : 0) + (esNombre(b) ? 0.25 : 0)
          if (s > 0 && (!par || s > par.s)) par = { a, b, s }
        }
      }
      if (par) {
        const pa = saca(mazo, par.a.uid), pb = saca(mazo, par.b.uid)
        if (pa) mano.push(pa)
        if (pb) mano.push(pb)
        informe.puente = par.s >= UMBRAL_VETA ? 'veta' : 'puente'
      }
    }
  }

  // 3. una chispa: algo cercano a la mano sin vínculo directo, para que
  //    proponer sea posible. Desde el acto 1 siempre; en el acto 0, a veces.
  if (plan.acto >= 1 || rng.next() < 0.5) {
    const m2 = mirada()
    const chispas = mazo.filter((p) => esNodoSuelto(p) && !repetiria(mano, p) &&
      cuenta(p.conceptId!) < TOPE_MISMO_CONCEPTO && tierDe(c, p, m2) === 'chispa')
    const conNombre = chispas.filter(esNombre)
    const bolsa = conNombre.length ? conNombre : chispas
    if (bolsa.length) {
      const p = saca(mazo, rng.pick(bolsa).uid)
      if (p) { mano.push(p); informe.chispa = true }
    }
  }

  // 4. un especial (caso, tesis o marco) si ya tiene miembro en la mesa:
  //    seguro desde el acto 1, a veces en el 0
  if (plan.acto >= 1 || rng.next() < 0.4) {
    const m3 = mirada()
    const esp = mazo.filter((p) => ['caso', 'tesis', 'marco'].includes(p.clase) &&
      p.conceptIds.some((x) => m3.conceptos.has(x)))
    if (esp.length) {
      const p = saca(mazo, rng.pick(esp).uid)
      if (p) { mano.push(p); informe.especial = true }
    }
  }

  // 5. el resto por ruleta, sin dejar que un concepto monopolice la mano
  let guardia = 0
  while (mano.length < plan.tamano && mazo.length && guardia++ < 60) {
    const vetadas = [...new Set(mano.map((p) => p.conceptId).filter((x): x is string => !!x))]
      .filter((cid) => cuenta(cid) >= TOPE_MISMO_CONCEPTO)
    const carta = robarRepartido(
      mazo, mano, c, rng, plan.acto, 0, plan.marcados, plan.asentadas, vetadas,
      plan.condicion, plan.relacionesDisponibles, (p) => !repetiria(mano, p))
    if (!carta) break
    mano.push(carta)
  }
  // si el veto dejó el mazo sin opción, completar sin veto
  while (mano.length < plan.tamano && mazo.length) mano.push(mazo.shift()!)

  // la mano se baraja para que el plan no se lea en el orden de las cartas
  const barajada = rng.shuffle(mano)
  mano.splice(0, mano.length, ...barajada)
  return informe
}

/** ¿Hay al menos una jugada componible en esta mano? El piso duro. */
export function manoJugable(mano: Pieza[], c: Contenido): boolean {
  const mirada = mirarMano(mano, [], [])
  const etiquetas = new Set<string>()
  const definiciones = new Set<string>()
  for (const p of mano) {
    if (!p.conceptId) continue
    if (p.clase === 'etiqueta' || p.clase === 'apocrifa' || p.clase === 'concepto') etiquetas.add(p.conceptId)
    if (p.clase === 'definicion' || p.clase === 'concepto') definiciones.add(p.conceptId)
  }
  for (const id of etiquetas) if (definiciones.has(id)) return true
  const ids = [...mirada.conceptos]
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (c.aristas.some((a) =>
        (a.from === ids[i] && a.to === ids[j]) || (a.from === ids[j] && a.to === ids[i]))) return true
    }
  }
  if (mano.some((p) => ['caso', 'tesis', 'marco'].includes(p.clase) &&
    p.conceptIds.some((x) => mirada.conceptos.has(x)))) return true
  if (mano.some((p) => p.clase === 'subdimension' && p.conceptId && mirada.conceptos.has(p.conceptId))) return true
  return false
}

/** ¿Permite esta mano una relación que valga la pena (veta) y una propuesta
 *  con criterio (chispa)? Es lo que el smoke mide sobre las aperturas: no
 *  basta con que la mano sea jugable, tiene que dar para pensar. */
export function manoInteresante(
  mano: Pieza[], c: Contenido, asentadas: string[] = [], disponibles: string[] = []
): { relacion: boolean; veta: boolean; chispa: boolean } {
  const m = mirarMano(mano, [], asentadas, disponibles)
  const ids = [...m.conceptos]
  let relacion = false, veta = false, chispa = false
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const s = interesArista(c, ids[i], ids[j], m)
      if (s > 0) relacion = true
      if (s >= UMBRAL_VETA) veta = true
      if (s === 0 && !chispa) {
        const sub = mirarMano(mano.filter((p) => p.conceptId !== ids[i]), [], asentadas, disponibles)
        if (chispaCon(c, ids[i], sub) === ids[j]) chispa = true
      }
    }
  }
  return { relacion, veta, chispa }
}

/** Repara una apertura muda: cambia cartas del final de la mano por la
 *  primera del mazo que componga con lo que hay. Máximo 3 intentos. */
export function repararApertura(
  mano: Pieza[], mazo: Pieza[], descarte: Pieza[], c: Contenido, rng: Rng,
  condicion?: string | null
): void {
  for (let intento = 0; intento < 3 && !manoJugable(mano, c); intento++) {
    const mirada = mirarMano(mano, [], [])
    // en Monocultivo la pareja de identidad no es un piso: se busca puente
    const orden: Tier[] = condicion === 'monocultivo'
      ? ['veta', 'puente', 'especial', 'ancla'] : ['ancla', 'veta', 'puente', 'especial']
    const idx = mazo.findIndex((p) => orden.includes(tierDe(c, p, mirada)))
    if (idx < 0) return
    const entra = mazo.splice(idx, 1)[0]
    const fuera = mano.splice(Math.floor(rng.next() * mano.length), 1)[0]
    if (fuera) descarte.push(fuera)
    mano.push(entra)
  }
}

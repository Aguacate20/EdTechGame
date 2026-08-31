/* ============================================================================
   El Repartidor.

   El azar puro reparte manos mudas y rachas injustas; un reparto guiado sin
   azar mataría la sorpresa. Esto es lo de en medio: un robo PONDERADO que
   garantiza un piso de jugabilidad y usa el modelo cognitivo para decidir
   qué conviene que aparezca — sin tocar jamás lo que las jugadas valen.

   Tiers de una carta del mazo, mirando la mano actual:
     · ancla    — completa una pareja de Identidad (nombre↔descripción)
     · puente   — su concepto tiene arista con algo que ya está en la mano
     · repaso   — es (o empareja con) un concepto MARCADO en la reflexión:
                  la cuenta pendiente vuelve a la mesa (práctica de
                  recuperación dirigida, Zimmerman)
     · reto     — su concepto no tiene ninguna arista asentada en el Atlas:
                  material aún no dominado
     · especial — caso/tesis/marco con algún miembro en la mano (el juez
                  mixto los hace jugables)
     · resto    — lo demás

   Los pesos se corren con el acto (el andamio se retira: al principio pesan
   ancla y puente; después, reto y especial) y con la PIEDAD: cada turno sin
   un solo acierto sube el peso de las categorías fáciles; un acierto la
   resetea. Motor de engagement con suelo, no tragamonedas.

   GUARDAS DE INTEGRIDAD DE SEÑAL — no negociables:
   1. El Repartidor cambia EXPOSICIÓN, nunca veredictos, fichas ni combos.
   2. Es CIEGO a la bandera de apócrifa: una falsificación puede ser el
      "ancla" servida. Discriminarla sigue siendo trabajo del jugador.
   3. Determinista: todo pasa por el RNG de la run. Misma semilla, misma
      expedición.
   ============================================================================ */

import type { Contenido } from '../content/types'
import type { Pieza } from './pieces'
import type { Rng } from './rng'

export type Tier = 'ancla' | 'puente' | 'repaso' | 'reto' | 'especial' | 'resto'

interface MiradaMano {
  /** conceptIds presentes en la mano (apócrifas incluidas: ceguera deliberada) */
  conceptos: Set<string>
  /** conceptIds cuya etiqueta está en mano sin su definición, y viceversa */
  mediasParejas: Set<string>
  marcados: Set<string>
  /** conceptIds con al menos una arista asentada (dominio previo) */
  dominados: Set<string>
}

export function mirarMano(
  mano: Pieza[], marcados: string[], asentadas: string[]
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
  return { conceptos, mediasParejas, marcados: new Set(marcados), dominados }
}

/** ¿Qué tier ocupa esta carta del mazo respecto de la mano? El primero que
 *  aplique, en orden de especificidad. */
export function tierDe(c: Contenido, p: Pieza, mirada: MiradaMano): Tier {
  if (['caso', 'tesis', 'marco'].includes(p.clase)) {
    return p.conceptIds.some((x) => mirada.conceptos.has(x)) ? 'especial' : 'resto'
  }
  const cid = p.conceptId
  if (!cid) return 'resto'
  const completaPareja =
    (p.clase === 'definicion' || p.clase === 'etiqueta' || p.clase === 'apocrifa') &&
    mirada.mediasParejas.has(cid)
  if (completaPareja) return mirada.marcados.has(cid) ? 'repaso' : 'ancla'
  if (mirada.marcados.has(cid)) return 'repaso'
  const conArista = [...mirada.conceptos].some((otro) => otro !== cid &&
    c.aristas.some((a) =>
      (a.from === cid && a.to === otro) || (a.from === otro && a.to === cid)))
  if (conArista) return 'puente'
  if (!mirada.dominados.has(cid)) return 'reto'
  return 'resto'
}

export function pesosDelReparto(acto: number, secos: number): Record<Tier, number> {
  const w: Record<Tier, number> = {
    ancla: 3, puente: 3, repaso: 2.2, especial: 1.4, reto: 1, resto: 2
  }
  // el andamio se retira: los actos tardíos piden material no dominado
  if (acto >= 1) { w.reto += 1; w.especial += 0.6; w.ancla = Math.max(1.2, w.ancla - 0.8) }
  if (acto >= 2) { w.reto += 1; w.puente = Math.max(1.4, w.puente - 0.8) }
  // piedad: la sequía inclina la mesa hacia lo componible, nunca la vuelca
  const alivio = Math.min(3, secos)
  w.ancla += alivio * 1.2
  w.puente += alivio * 0.8
  return w
}

/** Robo ponderado: elige tier por ruleta entre los tiers CON existencias,
 *  y dentro del tier, una carta al azar. Consume del mazo. */
export function robarRepartido(
  mazo: Pieza[], mano: Pieza[], c: Contenido, rng: Rng,
  acto: number, secos: number, marcados: string[], asentadas: string[],
  vetadas: string[]
): Pieza | null {
  if (!mazo.length) return null
  const mirada = mirarMano(mano, marcados, asentadas)
  const porTier = new Map<Tier, Pieza[]>()
  for (const p of mazo) {
    if (p.conceptId && vetadas.includes(p.conceptId)) continue
    const t = tierDe(c, p, mirada)
    const lista = porTier.get(t) ?? []
    lista.push(p)
    porTier.set(t, lista)
  }
  const pesos = pesosDelReparto(acto, secos)
  const disponibles = [...porTier.keys()]
  if (!disponibles.length) return mazo.shift() ?? null
  let total = 0
  for (const t of disponibles) total += pesos[t]
  let bola = rng.next() * total
  let elegido: Tier = disponibles[0]
  for (const t of disponibles) {
    bola -= pesos[t]
    if (bola <= 0) { elegido = t; break }
  }
  const lista = porTier.get(elegido)!
  const carta = lista[Math.floor(rng.next() * lista.length)]
  const i = mazo.findIndex((x) => x.uid === carta.uid)
  return i >= 0 ? mazo.splice(i, 1)[0] : mazo.shift() ?? null
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

/** Repara una apertura muda: cambia cartas del final de la mano por la
 *  primera del mazo que componga con lo que hay. Máximo 3 intentos. */
export function repararApertura(
  mano: Pieza[], mazo: Pieza[], descarte: Pieza[], c: Contenido, rng: Rng
): void {
  for (let intento = 0; intento < 3 && !manoJugable(mano, c); intento++) {
    const mirada = mirarMano(mano, [], [])
    const idx = mazo.findIndex((p) => {
      const t = tierDe(c, p, mirada)
      return t === 'ancla' || t === 'puente' || t === 'especial'
    })
    if (idx < 0) return
    const entra = mazo.splice(idx, 1)[0]
    const fuera = mano.splice(Math.floor(rng.next() * mano.length), 1)[0]
    if (fuera) descarte.push(fuera)
    mano.push(entra)
  }
}

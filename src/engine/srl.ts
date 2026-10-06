import type { Contenido } from '../content/types'
import type { Atlas } from './atlas'
import type { Pieza } from './pieces'
import { HERRAMIENTAS, type Diagnostico, type Trazo } from './tools'

/* ==========================================================================
   Autorregulación (Zimmerman) sin pausar el juego.

   La regla de diseño: cada fase del ciclo es una DECISIÓN con consecuencia
   mecánica, nunca una pantalla de preguntas. Si el jugador no la toma, el
   juego sigue igual; si la toma, gana algo y deja una señal.

     planeación    → Encargo: eliges qué te comprometes a lograr en esta sala,
                     viendo tu mano y el frente. Elegir es analizar la tarea.
     acción        → Sello de confianza: antes de afirmar, declaras que todo
                     lo que hay en el tablero se sostiene. Es una apuesta con
                     riesgo real, y es la calibración explícita (G1).
     autorreflexión→ Marca: al cerrar la sala señalas qué concepto te costó.
                     Lo que marcas vuelve en la próxima sala con prima. La
                     atribución se contrasta con lo que de verdad falló.
   ========================================================================== */

/* -------------------------------- Encargo -------------------------------- */

export type TipoEncargo =
  | 'vinculos'      // sostener N vínculos
  | 'combo'         // encender un combo concreto
  | 'concepto'      // sostener algo sobre un concepto sin evidencia
  | 'apocrifa'      // quemar una falsificación
  | 'sin_error'     // cerrar la sala sin ningún error ni inversión
  // v6.25 · los que hablan de cómo se juega hoy: el mapa, el cristal, las pistas
  | 'enlaces'       // enganchar N trazos con el mapa dorado
  | 'variedad'      // sostener con N herramientas distintas
  | 'golpe'         // un golpe de N o más
  | 'cristalizar'   // cristalizar un mapa en esta sala
  | 'sin_pista'     // N vínculos sin pedir pista

export interface Encargo {
  id: string
  tipo: TipoEncargo
  titulo: string
  detalle: string
  /** 1 fácil · 2 medio · 3 exigente. Decide la prima y es la señal de autoeficacia */
  nivel: 1 | 2 | 3
  /** parámetro según tipo: n de vínculos, id de combo, id de concepto */
  objetivo: string
  /** el concepto apuntaba a algo sin evidencia en el Atlas */
  sobreDebil: boolean
}

/** Lo que el motor lleva contado durante la sala para poder juzgar el encargo. */
export interface CuentaEncargo {
  vinculosSostenidos: number
  combosVistos: string[]
  conceptosSostenidos: string[]
  quemasAcertadas: number
  errores: number
  invertidos: number
  cristalizaciones?: number
  enlacesMapa?: number
  pistasPedidas?: number
  herramientasDistintas?: number
  mejorGolpe?: number
}

/** Tres encargos, de tres niveles, escogidos con lo que hay en la sala y en el Atlas.
 *  v6.25 · cada nivel tiene varias propuestas y rotan de sala en sala: antes el primero era
 *  SIEMPRE «sostener dos vínculos», y elegir lo mismo cada vez no es planear. El nivel 3
 *  sigue apuntando, cuando existe, a lo que el estudiante aún no sostiene. */
export function proponerEncargos(
  c: Contenido, conceptIds: string[], atlas: Atlas, mano: Pieza[], herramientas: string[]
): Encargo[] {
  const sinEvidencia = conceptIds.filter((id) => !atlas.conceptos[id])
  const conFallos = conceptIds
    .filter((id) => (atlas.conceptos[id]?.fallos ?? 0) > (atlas.conceptos[id]?.aciertos ?? 0))
  const hayApocrifa = mano.some((p) => p.clase === 'apocrifa')
  const distintas = new Set(herramientas).size
  const vinculosEnSala = c.aristas.filter((a) => conceptIds.includes(a.from) && conceptIds.includes(a.to)).length
  // la rotación depende de la sala y de cuántas expediciones lleva: estable al recargar, distinta cada vez
  let giro = (atlas.runs ?? 0) * 7 + conceptIds.length
  for (const id of conceptIds) for (let i = 0; i < id.length; i++) giro = (giro * 31 + id.charCodeAt(i)) >>> 0
  const elegir = <T,>(xs: T[], salto: number): T => xs[(giro + salto) % xs.length]
  type Borrador = Omit<Encargo, 'id' | 'nivel' | 'sobreDebil'> & { sobreDebil?: boolean }

  // nivel 1 · alcanzable con la mano de ahora
  const n1: Borrador[] = [
    { tipo: 'vinculos', objetivo: '2', titulo: 'Haz 2 conexiones correctas', detalle: 'En cualquier turno de esta sala.' },
    { tipo: 'golpe', objetivo: '150', titulo: 'Haz un ataque de 150 o más', detalle: 'Dos conexiones que compartan una carta suelen bastar.' },
    { tipo: 'enlaces', objetivo: '1', titulo: 'Conecta algo con una carta dorada', detalle: 'Las cartas doradas son las que ya acertaste.' }
  ]
  // nivel 2 · pide estructura o discriminación
  const n2: Borrador[] = [
    ...(hayApocrifa ? [{ tipo: 'apocrifa' as const, objetivo: '1', titulo: 'Quema una carta falsa', detalle: 'Hay al menos una carta falsa en tu mano. Encuéntrala y quémala.' }] : []),
    { tipo: 'enlaces', objetivo: '3', titulo: 'Haz 3 conexiones con cartas doradas', detalle: 'Construye sobre lo que ya acertaste.' },
    ...(distintas >= 3 ? [{ tipo: 'variedad' as const, objetivo: '3', titulo: 'Usa 3 herramientas distintas', detalle: 'Y que las tres conexiones sean correctas.' }] : []),
    { tipo: 'vinculos', objetivo: '4', titulo: 'Haz 4 conexiones correctas', detalle: 'A lo largo de esta sala.' },
    { tipo: 'golpe', objetivo: '500', titulo: 'Haz un ataque de 500 o más', detalle: 'Varias conexiones correctas que compartan cartas.' }
  ]
  // nivel 3 · lo que todavía no sostienes, o la jugada grande
  const debil = conFallos[0] ?? sinEvidencia[0]
  const n3: Borrador[] = [
    ...(debil && c.conceptos[debil] ? [{
      tipo: 'concepto' as const, objetivo: debil, sobreDebil: true,
      titulo: `Acierta algo sobre «${c.conceptos[debil].titulo}»`,
      detalle: conFallos.length
        ? 'Es la idea que más te ha costado. Haz una conexión correcta con ella.'
        : 'Todavía no la has usado. Haz una conexión correcta con ella.'
    }] : []),
    ...(vinculosEnSala >= 4 ? [{ tipo: 'cristalizar' as const, objetivo: '1', titulo: 'Haz el ataque final en esta sala', detalle: 'Cuatro conexiones correctas unidas entre sí.' }] : []),
    { tipo: 'sin_pista', objetivo: '3', titulo: 'Haz 3 conexiones sin pedir pista', detalle: 'Tres correctas sin usar el botón de pista.' },
    { tipo: 'sin_error', objetivo: '2', titulo: 'Haz 2 conexiones sin ningún error', detalle: 'Ni una conexión equivocada en toda la sala.' }
  ]
  // el concepto débil, cuando existe, sale dos de cada tres veces: es el encargo que más enseña
  const tercero = n3[0].tipo === 'concepto' && giro % 3 !== 0 ? n3[0] : elegir(n3, 2)
  // los tres niveles nunca piden lo mismo con distinto número
  const primero = elegir(n1, 0)
  const segundo = elegir(n2.filter((b) => b.tipo !== primero.tipo && b.tipo !== tercero.tipo), 1)
  return [primero, segundo, tercero].map((b, i) => ({
    ...b, id: `e${i + 1}`, nivel: (i + 1) as 1 | 2 | 3, sobreDebil: !!b.sobreDebil
  }))
}

export function encargoCumplido(en: Encargo, k: CuentaEncargo): boolean {
  switch (en.tipo) {
    case 'vinculos': return k.vinculosSostenidos >= Number(en.objetivo)
    case 'combo': return k.combosVistos.includes(en.objetivo)
    case 'concepto': return k.conceptosSostenidos.includes(en.objetivo)
    case 'apocrifa': return k.quemasAcertadas >= Number(en.objetivo)
    case 'sin_error': return k.errores === 0 && k.invertidos === 0 && k.vinculosSostenidos >= Number(en.objetivo)
    case 'enlaces': return (k.enlacesMapa ?? 0) >= Number(en.objetivo)
    case 'variedad': return (k.herramientasDistintas ?? 0) >= Number(en.objetivo)
    case 'golpe': return (k.mejorGolpe ?? 0) >= Number(en.objetivo)
    case 'cristalizar': return (k.cristalizaciones ?? 0) >= Number(en.objetivo)
    case 'sin_pista': return (k.pistasPedidas ?? 0) === 0 && k.vinculosSostenidos >= Number(en.objetivo)
  }
}

/** Prima al botín: el encargo cumplido sube la probabilidad de veta. */
export const primaEncargo = (en: Encargo | null, cumplido: boolean): number =>
  en && cumplido ? [0, 0.1, 0.2, 0.35][en.nivel] : 0

/** Lucidez que devuelve un encargo cumplido: cumplir lo que te propusiste cura. */
export const lucidezEncargo = (en: Encargo | null, cumplido: boolean): number =>
  en && cumplido ? [0, 4, 8, 14][en.nivel] : 0

/* --------------------------- Sello de confianza --------------------------- */

/** Sellar dice: «todo lo que hay en el tablero se sostiene». Si es verdad, el
 *  diagrama rinde más; si no, rinde menos. No toca la corrección, solo la
 *  recompensa; y es la única apuesta explícita del juego. */
export const SELLO_X = 1.5         // MULTIPLICA el daño entero: vale más cuanto más alto vuelas
export const SELLO_FALLA = 0.6     // factor sobre el daño si un trazo no se sostiene

export function juzgarSello(diag: Diagnostico): { acertado: boolean; nota: string } {
  const total = diag.veredictos.length
  const ok = total > 0 && diag.sostenidos === total
  return {
    acertado: ok,
    nota: ok
      ? 'Sellado y sostenido: sabías lo que sabías.'
      : `Sellaste ${total} trazo(s) y ${total - diag.sostenidos} no se sostuvo. Saber qué no sabes también cuenta.`
  }
}

/* ----------------------------- Marca de cierre ---------------------------- */

export interface Reflexion {
  /** lo que el estudiante dice que le costó (null = «nada me costó») */
  marcado: string | null
  /** lo que de verdad falló más, por los fallos de la sala */
  masFallado: string | null
  /** la atribución coincide con la evidencia */
  acertada: boolean
}

export function juzgarReflexion(
  marcado: string | null, fallos: Record<string, number>
): Reflexion {
  const ordenados = Object.entries(fallos).sort((a, b) => b[1] - a[1])
  const masFallado = ordenados.length && ordenados[0][1] > 0 ? ordenados[0][0] : null
  const acertada = marcado === null
    ? masFallado === null
    : (fallos[marcado] ?? 0) > 0 && (fallos[marcado] ?? 0) >= (ordenados[0]?.[1] ?? 0) * 0.5
  return { marcado, masFallado, acertada }
}

/** Fichas extra por sostener algo sobre un concepto marcado: la cuenta pendiente. */
export const PRIMA_MARCADO = 15

/* --------------------------- Previsualizar forma -------------------------- */

export interface Forma {
  piezas: number
  trazos: number
  /** combos que la estructura permitiría SI todo se sostiene */
  combosPosibles: string[]
  alcancePotencial: number
}

/** Anticipación sin trampa: se enseña qué forma tiene el diagrama y qué combos
 *  podría encender, nunca si es verdad. Es puramente estructural. */
export function previsualizarForma(trazos: Trazo[], piezas: Pieza[]): Forma {
  const porUid = new Map(piezas.map((p) => [p.uid, p]))
  const usadas = new Set(trazos.flatMap((t) => t.piezas))
  const posibles: string[] = []

  if (trazos.length >= 2) {
    const uso = new Map<string, number>()
    for (const t of trazos) for (const u of t.piezas) uso.set(u, (uso.get(u) ?? 0) + 1)
    if ([...uso.values()].some((n) => n >= 3)) posibles.push('Articulación')
    if (trazos.length >= 4) posibles.push('Constelación')

    const campos = trazos.filter((t) => t.tool === 'campo')
    for (const campo of campos) {
      const dentro = new Set(campo.piezas)
      const enlaces = trazos.filter((t) => t.tool === 'flecha' && t.piezas.every((u) => dentro.has(u)))
      if (enlaces.length >= dentro.size - 1) { posibles.push('Cierre'); break }
    }
    const ident = new Set(trazos.filter((t) => t.tool === 'identidad').flatMap((t) => t.piezas))
    const enlaz = new Set(trazos.filter((t) => t.tool === 'flecha').flatMap((t) => t.piezas))
    if ([...ident].some((u) => enlaz.has(u))) posibles.push('Doble registro')
    if (trazos.some((t) => t.tool === 'balanza') && campos.length) posibles.push('Refutación completa')
    if (trazos.some((t) => t.tool === 'ancla') && ident.size) posibles.push('Traducción')

    const clases = new Set(
      [...usadas].map((u) => porUid.get(u)?.clase).filter(Boolean)
        .map((cl) => (cl === 'apocrifa' ? 'concepto' : cl))
    )
    if (clases.size >= 3) posibles.push('Mestizaje')
    const tipos = new Set(trazos.filter((t) => t.tool === 'flecha').map((t) => t.param))
    if (tipos.size === 1 && trazos.filter((t) => t.tool === 'flecha').length >= 2) posibles.push('Coherencia')
  }

  const incompletos = trazos.filter((t) => t.piezas.length < HERRAMIENTAS[t.tool].aridad[0]).length
  return {
    piezas: usadas.size,
    trazos: trazos.length - incompletos,
    combosPosibles: [...new Set(posibles)],
    alcancePotencial: Math.min(4, 1 + Math.floor((trazos.length - incompletos) / 1.5))
  }
}


/** Un consejo ESTRUCTURAL de una línea: qué le falta a este diagrama para
 *  rendir más. Nunca dice qué es verdad; dice qué forma paga mejor. */
export function consejoDeForma(trazos: Trazo[], piezas: Pieza[], sellado: boolean): string | null {
  if (!trazos.length) return null
  const porUid = new Map(piezas.map((p) => [p.uid, p]))
  const flechas = trazos.filter((t) => t.tool === 'flecha')
  const campos = trazos.filter((t) => t.tool === 'campo')
  const ident = new Set(trazos.filter((t) => t.tool === 'identidad').flatMap((t) => t.piezas))
  const enlaz = new Set(flechas.flatMap((t) => t.piezas))

  for (const campo of campos) {
    const dentro = new Set(campo.piezas)
    const dentroN = flechas.filter((t) => t.piezas.every((u) => dentro.has(u))).length
    if (dentroN < dentro.size - 1) {
      return 'Teje el campo por dentro con flechas: un campo enlazado es un Cierre (+1.8 al filo).'
    }
  }
  if (ident.size && enlaz.size && ![...ident].some((u) => enlaz.has(u))) {
    return 'Identifica y enlaza la MISMA pieza: eso enciende Doble registro.'
  }
  const clases = new Set([...new Set(trazos.flatMap((t) => t.piezas))]
    .map((u) => porUid.get(u)?.clase).filter(Boolean)
    .map((c) => (c === 'apocrifa' ? 'concepto' : c)))
  if (trazos.length >= 2 && clases.size === 2) {
    return 'Cruza una clase de pieza más (un caso, una tesis, un marco): eso es Mestizaje.'
  }
  if (trazos.length === 3) {
    return 'Un cuarto trazo, si todo se sostiene y sin errores, enciende Constelación (+2).'
  }
  if (trazos.length >= 3 && !sellado) {
    return '¿Seguro de todo el tablero? El sello lo multiplica ×1.5.'
  }
  return null
}

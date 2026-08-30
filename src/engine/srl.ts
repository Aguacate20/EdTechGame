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
}

/** Tres encargos, de tres niveles, escogidos con lo que hay en la sala y en el
 *  Atlas. El nivel 3 apunta siempre a lo que el estudiante aún no sostiene. */
export function proponerEncargos(
  c: Contenido, conceptIds: string[], atlas: Atlas, mano: Pieza[], herramientas: string[]
): Encargo[] {
  const sinEvidencia = conceptIds.filter((id) => !atlas.conceptos[id])
  const conFallos = conceptIds
    .filter((id) => (atlas.conceptos[id]?.fallos ?? 0) > (atlas.conceptos[id]?.aciertos ?? 0))
  const hayApocrifa = mano.some((p) => p.clase === 'apocrifa')
  const tieneCampo = herramientas.includes('campo')
  const tieneIdentidad = herramientas.includes('identidad')

  const out: Encargo[] = []

  // nivel 1: algo alcanzable con la mano actual
  out.push({
    id: 'e1', tipo: 'vinculos', nivel: 1, objetivo: '2', sobreDebil: false,
    titulo: 'Sostener dos vínculos',
    detalle: 'Dos afirmaciones que el texto respalde, en cualquier turno de la sala.'
  })

  // nivel 2: exige estructura o discriminación
  if (hayApocrifa) {
    out.push({
      id: 'e2', tipo: 'apocrifa', nivel: 2, objetivo: '1', sobreDebil: false,
      titulo: 'Cazar una falsificación',
      detalle: 'Hay al menos una carta apócrifa en tu mano. Quémala antes de que te la cuelen.'
    })
  } else if (tieneCampo && tieneIdentidad) {
    out.push({
      id: 'e2', tipo: 'combo', nivel: 2, objetivo: 'doble_registro', sobreDebil: false,
      titulo: 'Encender un Doble registro',
      detalle: 'Identificar un concepto y enlazarlo en el mismo diagrama.'
    })
  } else {
    out.push({
      id: 'e2', tipo: 'vinculos', nivel: 2, objetivo: '4', sobreDebil: false,
      titulo: 'Sostener cuatro vínculos',
      detalle: 'Cuatro afirmaciones respaldadas a lo largo de la sala.'
    })
  }

  // nivel 3: lo que todavía no sostienes
  const debil = conFallos[0] ?? sinEvidencia[0]
  if (debil && c.conceptos[debil]) {
    out.push({
      id: 'e3', tipo: 'concepto', nivel: 3, objetivo: debil, sobreDebil: true,
      titulo: `Sostener algo sobre «${c.conceptos[debil].titulo}»`,
      detalle: conFallos.length
        ? 'Es el concepto que más te ha fallado. Una afirmación respaldada sobre él lo cambia.'
        : 'Aún no tienes evidencia de él en tu Atlas. Esta sala es para estrenarlo.'
    })
  } else if (tieneCampo) {
    out.push({
      id: 'e3', tipo: 'combo', nivel: 3, objetivo: 'cierre', sobreDebil: false,
      titulo: 'Encender un Cierre',
      detalle: 'Un campo cuyos miembros además estén enlazados por dentro.'
    })
  } else {
    out.push({
      id: 'e3', tipo: 'sin_error', nivel: 3, objetivo: '0', sobreDebil: false,
      titulo: 'Cerrar sin un solo error',
      detalle: 'Ni inversiones ni falsificaciones afirmadas en toda la sala.'
    })
  }
  return out
}

export function encargoCumplido(en: Encargo, k: CuentaEncargo): boolean {
  switch (en.tipo) {
    case 'vinculos': return k.vinculosSostenidos >= Number(en.objetivo)
    case 'combo': return k.combosVistos.includes(en.objetivo)
    case 'concepto': return k.conceptosSostenidos.includes(en.objetivo)
    case 'apocrifa': return k.quemasAcertadas >= Number(en.objetivo)
    case 'sin_error': return k.errores === 0 && k.invertidos === 0
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
export const SELLO_ACIERTA = 1.0   // se suma al multiplicador
export const SELLO_FALLA = 0.6     // factor sobre el daño

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

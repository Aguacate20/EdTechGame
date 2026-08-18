import type { Contenido } from '../content/types'
import type { HerramientaId, ModificadoresLente } from './tools'
import { HERRAMIENTAS } from './tools'
import { LENTES, SELLOS, lentePorId, selloPorId, type SelloId } from './powers'
import type { Rng } from './rng'

/* ==========================================================================
   La tinta.
   Se gana afirmando cosas verdaderas y detectando falsificaciones; se gasta en
   el Archivo entre salas. Es lo que convierte «gané el combate» en «puedo
   cambiar cómo se juega el resto de la run».
   ========================================================================== */

export interface GananciaTinta {
  total: number
  partes: { concepto: string; cantidad: number }[]
}

export function tintaDeCombate(
  dano: number, sostenidos: number, inferencias: number, quemasAcertadas: number,
  dificultad: string, mods: ModificadoresLente
): GananciaTinta {
  const partes: { concepto: string; cantidad: number }[] = []
  const empujar = (concepto: string, cantidad: number) => {
    if (cantidad > 0) partes.push({ concepto, cantidad })
  }
  const base = { facil: 5, media: 8, dura: 12, jefe: 18 }[dificultad] ?? 7
  empujar('sala despejada', base)
  empujar('afirmaciones sostenidas', sostenidos)
  empujar('inferencias', inferencias * (1 + mods.tintaPorInferencia))
  empujar('falsificaciones detectadas', quemasAcertadas * (3 + mods.tintaPorQuema))
  // el daño aporta poco y con techo: si no, un diagrama enorme paga la run entera
  empujar('contundencia', Math.min(8, Math.floor(dano / 150)))
  empujar('imprenta', mods.tintaPorCombate)
  return { total: partes.reduce((n, p) => n + p.cantidad, 0), partes }
}

/* ------------------------------- el Archivo ------------------------------- */

export type Oferta =
  | { tipo: 'lente'; id: string; precio: number }
  | { tipo: 'sello'; id: SelloId; precio: number }
  | { tipo: 'herramienta'; id: HerramientaId; precio: number }
  | { tipo: 'relacion'; tipoRelacion: string; precio: number }
  | { tipo: 'mano'; precio: number }
  | { tipo: 'caso'; id: string; precio: number }
  | { tipo: 'tesis'; id: string; precio: number }
  | { tipo: 'lucidez'; cantidad: number; precio: number }

export const PRECIO_REROLL = 4

export interface Cartera {
  tinta: number
  lentes: string[]
  sellos: SelloId[]
  herramientas: HerramientaId[]
  relaciones: string[]
  casos: string[]
  tesis: string[]
  manoExtra: number
}

/** El Archivo ofrece seis cosas, siempre de familias distintas: nunca se
 *  reduce a «compra la lente más cara». */
export function generarOfertas(c: Contenido, cartera: Cartera, rng: Rng, acto: number): Oferta[] {
  const ofertas: Oferta[] = []

  const lentesLibres = LENTES.filter((l) => !cartera.lentes.includes(l.id) &&
    (acto >= 1 || l.rareza === 'comun'))
  for (const l of rng.sample(lentesLibres, 2)) {
    ofertas.push({ tipo: 'lente', id: l.id, precio: l.precio })
  }

  const sellosLibres = Object.values(SELLOS).filter((s) => !cartera.sellos.includes(s.id))
  if (sellosLibres.length) {
    const s = rng.pick(sellosLibres)
    ofertas.push({ tipo: 'sello', id: s.id, precio: s.precio })
  }

  // herramientas: las que menos tienes, para que el cinturón se equilibre
  const cuenta = (h: HerramientaId) => cartera.herramientas.filter((x) => x === h).length
  const candidatas = (Object.keys(HERRAMIENTAS) as HerramientaId[])
    .filter((h) => h !== 'eje' || c.ejes.length >= 1)
    .sort((a, b) => cuenta(a) - cuenta(b))
  ofertas.push({ tipo: 'herramienta', id: candidatas[rng.int(Math.min(3, candidatas.length))], precio: 9 })

  // relaciones raras del texto: más multiplicador, menos frecuentes
  const porRareza = Object.entries(c.frecuenciaRelacion).sort((a, b) => a[1] - b[1]).map(([t]) => t)
  const rel = porRareza.find((t) => cartera.relaciones.filter((r) => r === t).length < 2) ?? porRareza[0]
  if (rel) ofertas.push({ tipo: 'relacion', tipoRelacion: rel, precio: 5 })

  // ampliar el fichero, o material nuevo
  if (rng.next() < 0.5 || !c.escenarios.length) {
    ofertas.push({ tipo: 'mano', precio: 10 + cartera.manoExtra * 4 })
  } else {
    const lejanos = c.escenarios.filter((s) => s.distancia !== 'cercana' && !cartera.casos.includes(s.id))
    const pool = lejanos.length ? lejanos : c.escenarios
    if (pool.length) ofertas.push({ tipo: 'caso', id: rng.pick(pool).id, precio: 7 })
  }

  ofertas.push({ tipo: 'lucidez', cantidad: 18, precio: 6 })
  return ofertas
}

export function describirOferta(c: Contenido, o: Oferta): { tt: string; nom: string; cuerpo: string; pie?: string } {
  switch (o.tipo) {
    case 'lente': {
      const l = lentePorId(o.id)
      return { tt: `Lente · ${l.rareza}`, nom: l.nombre, cuerpo: l.regla, pie: l.costo }
    }
    case 'sello': {
      const s = selloPorId(o.id)
      return { tt: 'Sello · un uso por combate', nom: `${s.glifo} ${s.nombre}`, cuerpo: s.efecto }
    }
    case 'herramienta': {
      const h = HERRAMIENTAS[o.id]
      return {
        tt: 'Herramienta', nom: `${h.glifo} ${h.nombre}`,
        cuerpo: `Una más por turno. ${h.afirma}`, pie: `Señal: ${h.dimension}`
      }
    }
    case 'relacion':
      return {
        tt: 'Carta de relación', nom: o.tipoRelacion,
        cuerpo: `Aparece ${c.frecuenciaRelacion[o.tipoRelacion] ?? 0} veces en este texto, así que multiplica ${(c.frecuenciaRelacion[o.tipoRelacion] ?? 0) <= 3 ? 'mucho' : 'poco'}.`
      }
    case 'mano':
      return { tt: 'Fichero', nom: 'Ampliar el fichero', cuerpo: 'Robas una carta más cada turno, para el resto de la expedición.' }
    case 'caso': {
      const e = c.escenarios.find((x) => x.id === o.id) ?? c.casos.find((x) => x.id === o.id)
      const dist = e && 'distancia' in e ? (e as { distancia?: string }).distancia : undefined
      return {
        tt: `Caso${dist ? ` · ${dist}` : ''}`,
        nom: (e && 'dominio' in e ? e.dominio : '') || 'Caso nuevo',
        cuerpo: e?.descripcion ?? ''
      }
    }
    case 'tesis': {
      const t = c.tesis.find((x) => x.id === o.id)
      return { tt: 'Tesis', nom: 'Tesis y sus criterios', cuerpo: t?.enunciado ?? '' }
    }
    default:
      return { tt: 'Descanso', nom: `Recuperas ${o.cantidad} de lucidez`, cuerpo: 'Volver entero a la siguiente sala también es una compra.' }
  }
}

import type { Contenido } from '../content/types'
import type { Embate, OpcionEmbate } from './encounters'
import type { Rng } from './rng'

/** Fase final del jefe: una tesis defendida desde un marco.
 *  Las respuestas válidas salen de `criterios_refutacion_valida`;
 *  los señuelos, de `counterarguments` — suenan razonables y no cumplen la rúbrica. */
export function embateDeTesis(contenido: Contenido, rng: Rng): Embate | null {
  const candidatas = contenido.tesis.filter((t) => t.criteriosRefutacion.length >= 1)
  if (candidatas.length === 0) return null
  const t = rng.pick(candidatas)
  const marco = t.marcoId ? contenido.marcos.find((m) => m.id === t.marcoId) : undefined
  const rival = marco?.rivales.length
    ? contenido.marcos.find((m) => m.id === rival_(marco.rivales, rng))
    : undefined

  const correctas: OpcionEmbate[] = rng.sample(t.criteriosRefutacion, 2).map((c, i) => ({
    id: `ref_ok_${i}`, texto: c, correcta: true,
    feedback: 'Cumple la rúbrica: fija qué evidencia obligaría a revisar la tesis.',
    conceptId: null, repertoireId: null
  }))
  const senuelosBase = [
    ...t.contraargumentos,
    ...(rival?.principios ?? []),
    ...t.argumentosApoyo.slice(0, 1)
  ]
  const senuelos: OpcionEmbate[] = rng.sample([...new Set(senuelosBase)], 3).map((s, i) => ({
    id: `ref_no_${i}`, texto: s, correcta: false,
    feedback: 'Suena razonable, pero no es un criterio de refutación: no dice qué observación cambiaría la conclusión.',
    conceptId: null, repertoireId: null
  }))
  if (correctas.length === 0 || senuelos.length === 0) return null

  return {
    itemId: `tesis_${t.id}`,
    mecanica: 'C1',
    familia: 'F',
    titulo: 'Refutar',
    enunciado: `Elige ${correctas.length === 1 ? 'el criterio' : `los ${correctas.length} criterios`} que sí refutarían esta tesis.`,
    contexto: `${marco ? `${marco.etiqueta} sostiene: ` : ''}${t.enunciado}`,
    opciones: rng.shuffle([...correctas, ...senuelos]),
    multi: true,
    nCorrectas: correctas.length,
    conceptIds: t.conceptIds,
    conceptoObjetivo: t.conceptIds[0] ?? null,
    dificultad: 0.9,
    peso: 1.3,
    tipoRelacion: null,
    distancia: null,
    repertorioTocado: null,
    cierre: t.criteriosDefensa[0]
      ? `Y para defenderla haría falta: ${t.criteriosDefensa[0]}`
      : null,
    aristaRevelada: null
  }
}

function rival_(rivales: string[], rng: Rng): string {
  return rng.pick(rivales)
}

import type { Contenido, Repertorio } from '../content/types'
import type { Embate, OpcionEmbate } from './encounters'
import type { Rng } from './rng'

export const PREFIJO_INTUICION = 'intuicion:'

export const esIntuicion = (cardId: string): boolean => cardId.startsWith(PREFIJO_INTUICION)
export const repertorioDe = (cardId: string): string => cardId.slice(PREFIJO_INTUICION.length)
export const cartaIntuicion = (repertorioId: string): string => `${PREFIJO_INTUICION}${repertorioId}`

/** El Eco no te castiga: te deja un asunto pendiente.
 *  La carta estorba en la mano y solo se retira reconociendo dónde esa intuición
 *  SÍ funcionaba — que es exactamente el campo `contexto_donde_funciona`. */
export function embateDeContexto(
  contenido: Contenido, repertorioId: string, rng: Rng
): Embate | null {
  const r = contenido.repertorios.find((x) => x.id === repertorioId)
  if (!r || !r.contextoDondeFunciona) return null

  const correcta: OpcionEmbate = {
    id: `ctx_ok`, texto: r.contextoDondeFunciona, correcta: true,
    feedback: r.contrasteCientifico, conceptId: r.conceptId, repertoireId: r.id
  }
  const otros = contenido.repertorios.filter(
    (x: Repertorio) => x.id !== r.id && x.contextoDondeFunciona
  )
  const senuelos: OpcionEmbate[] = rng.sample(otros, 3).map((x, i) => ({
    id: `ctx_no_${i}`, texto: x.contextoDondeFunciona, correcta: false,
    feedback: `Ese es el terreno de otra intuición: «${x.etiqueta}». Aquí no aplica.`,
    conceptId: x.conceptId, repertoireId: x.id
  }))
  if (senuelos.length === 0) return null

  return {
    itemId: `intuicion_${r.id}`,
    mecanica: 'B1',
    familia: 'G',
    titulo: 'Reconocer el contexto',
    enunciado: '¿Dónde sí funcionaba este razonamiento?',
    contexto: r.ejemplo,
    opciones: rng.shuffle([correcta, ...senuelos]),
    multi: false,
    nCorrectas: 1,
    conceptIds: r.conceptId ? [r.conceptId] : [],
    conceptoObjetivo: r.conceptId || null,
    dificultad: 0.5,
    peso: 0.6,
    tipoRelacion: null,
    distancia: null,
    repertorioTocado: r.id,
    cierre: `${r.contrasteCientifico} La intuición no era tonta: estaba fuera de sitio.`,
    aristaRevelada: null
  }
}

export function etiquetaIntuicion(contenido: Contenido, cardId: string): {
  nombre: string; glosa: string
} {
  const r = contenido.repertorios.find((x) => x.id === repertorioDe(cardId))
  return {
    nombre: r ? `Intuición: ${r.etiqueta}` : 'Intuición',
    glosa: r
      ? 'Ocupa sitio en tu mano. Juégala para reconocer dónde sí funcionaba y retirarla del mazo.'
      : 'Juégala para retirarla del mazo.'
  }
}

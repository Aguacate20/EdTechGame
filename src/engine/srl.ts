import type { Contenido } from '../content/types'
import type { Atlas } from './atlas'
import { nivelDe } from './atlas'
import type { Rng } from './rng'

/* ==========================================================================
   La fase de previsión.
   En los estudios sobre abandono en cursos en línea, los dos predictores más
   fuertes de terminar son fijarse una meta y verle valor a la tarea — ambos
   ANTES de estudiar, no durante. Nuestro juego era casi todo ejecución.
   Esta capa añade previsión sin tocar el combate: todo ocurre en pantallas
   previas, con uno o dos toques.
   ========================================================================== */

/* ------------------------------- el encargo ------------------------------- */

export type EncargoId = 'sellar' | 'trazar' | 'estabilizar' | 'entero' | 'lejos' | 'deducir'

export interface Encargo {
  id: EncargoId
  nombre: string
  descripcion: string
  meta: number
  /** por qué merece la pena: se anuncia antes de aceptar */
  premio: string
}

export interface ProgresoEncargo {
  encargo: Encargo
  hecho: number
  cumplido: boolean
}

export function encargosPosibles(c: Contenido, rng: Rng): Encargo[] {
  const todos: Encargo[] = [
    { id: 'trazar', nombre: 'Levantar el mapa', meta: Math.max(8, Math.round(c.aristas.length * 0.35)),
      descripcion: 'Sostener vínculos distintos a lo largo de la expedición.',
      premio: 'Una lente extra al cumplirlo.' },
    { id: 'sellar', nombre: 'Cerrar una unidad', meta: 1,
      descripcion: 'Dejar una unidad entera con evidencia en el Atlas.',
      premio: 'Una lente extra al cumplirlo.' },
    { id: 'estabilizar', nombre: 'Ordenar tus intuiciones', meta: 2,
      descripcion: 'Reubicar intuiciones en el terreno donde sí funcionaban.',
      premio: 'Una lente extra al cumplirlo.' },
    { id: 'entero', nombre: 'Llegar entero', meta: 45,
      descripcion: 'Alcanzar el jefe con al menos 45 de lucidez.',
      premio: 'Una lente extra al cumplirlo.' },
    { id: 'deducir', nombre: 'Pensar por tu cuenta', meta: 4,
      descripcion: 'Sostener afirmaciones que el texto no dice pero se siguen de él.',
      premio: 'Una lente extra al cumplirlo.' }
  ]
  if (c.escenarios.some((e) => e.distancia === 'lejana')) {
    todos.push({
      id: 'lejos', nombre: 'Salir del texto', meta: 3,
      descripcion: 'Anclar casos de dominios que el autor no menciona.',
      premio: 'Una lente extra al cumplirlo.'
    })
  }
  return rng.sample(todos, 3)
}

export interface ContadoresRun {
  vinculos: number
  intuicionesReubicadas: number
  inferencias: number
  anclasLejanas: number
  lucidez: number
  unidadesSelladas: number
}

export function progresoDe(e: Encargo, c: ContadoresRun): ProgresoEncargo {
  const hecho = {
    trazar: c.vinculos,
    sellar: c.unidadesSelladas,
    estabilizar: c.intuicionesReubicadas,
    entero: c.lucidez,
    deducir: c.inferencias,
    lejos: c.anclasLejanas
  }[e.id]
  return { encargo: e, hecho, cumplido: hecho >= e.meta }
}

/* ------------------------------ los desafíos ------------------------------ */

export type DesafioId = 'sin_identidad' | 'solo_raras' | 'mano_corta' | 'sin_quemar' | 'cadena_larga'

export interface Desafio {
  id: DesafioId
  nombre: string
  regla: string
}

/** Autoimponerse una restricción por más recompensa. Es el subproceso de
 *  «hacer la tarea más interesante para uno mismo», que casi nadie mide, y
 *  en un roguelike es la mecánica más natural que existe. */
export const DESAFIOS: Desafio[] = [
  { id: 'sin_identidad', nombre: 'De memoria', regla: 'Sin usar la Identidad en toda la sala.' },
  { id: 'solo_raras', nombre: 'Lo difícil', regla: 'Solo puntúan las relaciones poco frecuentes del texto.' },
  { id: 'mano_corta', nombre: 'A ciegas', regla: 'Dos cartas menos en la mano.' },
  { id: 'sin_quemar', nombre: 'Sin pozo', regla: 'Nada de quemar: convive con las falsificaciones.' },
  { id: 'cadena_larga', nombre: 'Aliento largo', regla: 'Solo puntúan los diagramas de tres trazos o más.' }
]

export const desafioPorId = (id: DesafioId): Desafio =>
  DESAFIOS.find((d) => d.id === id) ?? DESAFIOS[0]

export function desafiosPara(dificultad: string, rng: Rng): Desafio[] {
  const n = dificultad === 'facil' ? 2 : 3
  return rng.sample(DESAFIOS, n)
}

/* ------------------------------ la predicción ----------------------------- */

export type Prediccion = 'pocos' | 'justos' | 'muchos'

export const PREDICCIONES: { id: Prediccion; texto: string; rango: [number, number] }[] = [
  { id: 'pocos', texto: 'Pocos: voy a tantear', rango: [0, 3] },
  { id: 'justos', texto: 'Los justos para salir', rango: [4, 7] },
  { id: 'muchos', texto: 'Muchos: aquí me muevo bien', rango: [8, 99] }
]

export const prediccionPorId = (id: Prediccion) =>
  PREDICCIONES.find((p) => p.id === id) ?? PREDICCIONES[1]

export function juzgarPrediccion(id: Prediccion, sostenidos: number): {
  acertada: boolean
  texto: string
} {
  const [min, max] = prediccionPorId(id).rango
  if (sostenidos >= min && sostenidos <= max) {
    return { acertada: true, texto: `Dijiste «${prediccionPorId(id).texto.split(':')[0].toLowerCase()}» y sostuviste ${sostenidos}. Te leíste bien.` }
  }
  return {
    acertada: false,
    texto: sostenidos > max
      ? `Dijiste «${prediccionPorId(id).texto.split(':')[0].toLowerCase()}» y sostuviste ${sostenidos}: te subestimaste.`
      : `Dijiste «${prediccionPorId(id).texto.split(':')[0].toLowerCase()}» y sostuviste ${sostenidos}: esta sala pedía más de lo que parecía.`
  }
}

/* -------------------------- el organizador previo ------------------------- */

/** Ausubel: material introductorio de mayor abstracción, generalidad e
 *  inclusividad, presentado ANTES para orientar al aprendiz. Aquí es el
 *  concepto más inclusivo de la sala, con lo que ya sabes de él. */
export interface Organizador {
  conceptId: string
  titulo: string
  definicion: string
  /** vínculos que ya tenías con él en el Atlas */
  conocidos: { tipo: string; otro: string }[]
  esPuerta: boolean
  esUmbral: boolean
  nivel: number
}

export function organizadorDe(c: Contenido, conceptIds: string[], atlas: Atlas): Organizador | null {
  if (!conceptIds.length) return null
  const puntua = (id: string) => {
    const k = c.conceptos[id]
    if (!k) return -1
    const generaliza = c.aristas.filter((a) => a.from === id && a.tipo === 'generaliza').length
    return k.importancia * 2 + generaliza * 1.5 + (k.esPuerta ? 2 : 0) + (k.esUmbral ? 1 : 0)
  }
  const id = [...conceptIds].sort((a, b) => puntua(b) - puntua(a))[0]
  const k = c.conceptos[id]
  if (!k) return null

  const conocidos = Object.values(atlas.aristas)
    .filter((a) => a.from === id || a.to === id)
    .slice(0, 4)
    .map((a) => ({
      tipo: a.tipo,
      otro: c.conceptos[a.from === id ? a.to : a.from]?.titulo ?? '—'
    }))

  return {
    conceptId: id, titulo: k.titulo, definicion: k.definicion || k.definicionCorta,
    conocidos, esPuerta: k.esPuerta, esUmbral: k.esUmbral, nivel: nivelDe(atlas.conceptos[id])
  }
}

/* ------------------------- reflexión de cierre de acto -------------------- */

/** «¿Dónde te serviría esto?» — el subproceso de reflexión sobre el trabajo,
 *  que en los estudios diferencia a quien termina de quien abandona. Se
 *  responde eligiendo entre los dominios reales del texto: cero escritura. */
export function dominiosDeUnidad(c: Contenido, conceptIds: string[]): string[] {
  const d = [
    ...c.escenarios.filter((e) => e.conceptIds.some((x) => conceptIds.includes(x))).map((e) => e.dominio),
    ...c.casos.filter((k) => k.conceptIds.some((x) => conceptIds.includes(x))).map((k) => k.dominio)
  ].filter(Boolean)
  return [...new Set(d)]
}

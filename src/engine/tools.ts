import type { Contenido } from '../content/types'
import type { Pieza, Rol } from './pieces'
import { admisibleComoPropuesta, juzgarVinculo } from './graph'

/* ==========================================================================
   Las herramientas cognitivas. Cada una es una forma de AFIRMAR algo sobre
   el material, y cada una emite una señal distinta. El tablero es libre: el
   jugador combina las que quiera sobre las piezas que le tocaron.
   ========================================================================== */

export type HerramientaId =
  | 'flecha' | 'campo' | 'jerarquia' | 'eje' | 'identidad'
  | 'ancla' | 'balanza' | 'secuencia'
  // las cuatro que faltaban: falsar, analogizar, acotar y descomponer
  | 'contraejemplo' | 'analogia' | 'alcance' | 'descomposicion'

export type Dimension =
  | 'recuperacion' | 'discriminacion' | 'relacion' | 'estructura'
  | 'transferencia' | 'produccion' | 'calibracion' | 'srl_accion' | 'anclaje'

export interface Herramienta {
  id: HerramientaId
  nombre: string
  glifo: string
  afirma: string
  /** cuántas piezas admite: [mínimo, máximo] */
  aridad: [number, number]
  /** rol que debe cumplir cada pieza, por posición (la última se repite) */
  rolesExigidos: Rol[]
  /** ¿necesita un parámetro (tipo de relación, eje)? */
  parametro: 'relacion' | 'eje' | null
  dimension: Dimension
  ordenada: boolean
  /** un ejemplo con animales, para entender la herramienta sin saber del tema */
  ejemplo: string
}

export const HERRAMIENTAS: Record<HerramientaId, Herramienta> = {
  flecha: {
    id: 'flecha', nombre: 'Flecha', glifo: '→',
    afirma: 'Que existe este vínculo, con este tipo y en esta dirección.',
    aridad: [2, 2], rolesExigidos: ['nodo', 'nodo'], parametro: 'relacion',
    dimension: 'relacion', ordenada: true,
    ejemplo: "«Sequía» —causa→ «Migración de las aves». Una idea empuja a la otra."
  },
  identidad: {
    id: 'identidad', nombre: 'Identidad', glifo: '=',
    afirma: 'Que este nombre y esta descripción son la misma cosa.',
    aridad: [2, 2], rolesExigidos: ['nodo', 'nodo'], parametro: null,
    dimension: 'recuperacion', ordenada: false,
    ejemplo: "«Ballena» = «mamífero marino que filtra kril». El nombre y su descripción."
  },
  campo: {
    id: 'campo', nombre: 'Campo semántico', glifo: '◯',
    afirma: 'Que todo lo que encierro pertenece a la misma zona del texto.',
    aridad: [2, 6], rolesExigidos: ['nodo'], parametro: null,
    dimension: 'estructura', ordenada: false,
    ejemplo: "◯ ( «Lobo» · «Zorro» · «Coyote» ) — todos son cánidos: la misma zona del mapa."
  },
  jerarquia: {
    id: 'jerarquia', nombre: 'Jerarquía', glifo: '⊃',
    afirma: 'Que el primero es la categoría que contiene al segundo.',
    aridad: [2, 4], rolesExigidos: ['nodo'], parametro: null,
    dimension: 'estructura', ordenada: true,
    ejemplo: "«Ave» ⊃ «Pingüino». El primero es la categoría que contiene al segundo."
  },
  eje: {
    id: 'eje', nombre: 'Eje', glifo: '⊢',
    afirma: 'Que todo esto cae en el mismo extremo de un eje del dominio.',
    aridad: [2, 5], rolesExigidos: ['nodo'], parametro: 'eje',
    dimension: 'relacion', ordenada: false,
    ejemplo: "⊢ vuela: ( «Águila» · «Colibrí» ). Los dos caen en el mismo extremo del eje."
  },
  secuencia: {
    id: 'secuencia', nombre: 'Secuencia', glifo: '⇢',
    afirma: 'Que esto ocurre en este orden, cada paso llevando al siguiente.',
    aridad: [3, 4], rolesExigidos: ['nodo'], parametro: null,
    dimension: 'estructura', ordenada: true,
    ejemplo: "«Huevo» ⇢ «Oruga» ⇢ «Mariposa». Cada paso lleva al siguiente, en ese orden."
  },
  ancla: {
    id: 'ancla', nombre: 'Ancla', glifo: '⌖',
    afirma: 'Que estos conceptos son los que operan en este caso.',
    aridad: [2, 4], rolesExigidos: ['caso', 'nodo'], parametro: null,
    dimension: 'transferencia', ordenada: true,
    ejemplo: "⌖ «Un jardín sin abejas no da fruto» + ( «Polinización» · «Mutualismo» )."
  },
  balanza: {
    id: 'balanza', nombre: 'Balanza', glifo: '⚖',
    afirma: 'Que esto es lo que obligaría a revisar la tesis.',
    aridad: [2, 3], rolesExigidos: ['tesis', 'criterio'], parametro: null,
    dimension: 'produccion', ordenada: true,
    ejemplo: "⚖ «Los cuervos usan herramientas» + «Un cuervo criado aislado no las usaría»."
  }
  ,
  contraejemplo: {
    id: 'contraejemplo', nombre: 'Contraejemplo', glifo: '⊘',
    afirma: 'Que este concepto NO opera en este caso, aunque lo parezca.',
    aridad: [2, 3], rolesExigidos: ['caso', 'nodo'], parametro: null,
    dimension: 'discriminacion', ordenada: true,
    ejemplo: '⊘ «Un pingüino no vuela» + «Aerodinámica del vuelo batido». Se le parece, pero ahí no aplica.'
  },
  analogia: {
    id: 'analogia', nombre: 'Analogía', glifo: '≈',
    afirma: 'Que A es a B lo que C es a D, en dos zonas distintas del texto.',
    aridad: [4, 4], rolesExigidos: ['nodo'], parametro: null,
    dimension: 'transferencia', ordenada: true,
    ejemplo: '≈ «Corazón» es a «Sangre» lo que «Raíz» es a «Savia». Misma estructura, otro reino.'
  },
  alcance: {
    id: 'alcance', nombre: 'Alcance', glifo: '⊣',
    afirma: 'Que lo primero solo vale bajo la condición que pone lo segundo.',
    aridad: [2, 2], rolesExigidos: ['nodo', 'nodo'], parametro: null,
    dimension: 'discriminacion', ordenada: true,
    ejemplo: '⊣ «Los osos hibernan» vale bajo «Climas con invierno marcado». Fuera de ahí, no.'
  },
  descomposicion: {
    id: 'descomposicion', nombre: 'Descomposición', glifo: '⊟',
    afirma: 'Que lo primero se compone de las partes que siguen.',
    aridad: [2, 4], rolesExigidos: ['nodo'], parametro: null,
    dimension: 'estructura', ordenada: true,
    ejemplo: '⊟ «Colmena» ⊟ ( «Obreras» · «Zánganos» · «Reina» ). El todo y sus partes.'
  }
}

/** Qué clase de pieza admite cada ranura. Se usa para no dejar que el jugador
 *  gaste una herramienta en una combinación que el motor va a rechazar. */
export function aceptaEnRanura(h: HerramientaId, ranura: number, p: Pieza): boolean {
  switch (h) {
    case 'ancla':
    case 'contraejemplo':
      return ranura === 0 ? p.clase === 'caso' : p.roles.includes('nodo') && p.clase !== 'caso'
    case 'balanza':
      return ranura === 0 ? p.clase === 'tesis' : p.clase === 'criterio'
    case 'descomposicion':
      return ranura === 0
        ? !!p.conceptId && p.clase !== 'subdimension'
        : p.clase === 'subdimension'
    case 'identidad':
      return p.roles.includes('etiqueta') || p.roles.includes('definicion')
    case 'eje':
      return !!p.conceptId && p.clase !== 'subdimension'
    default:
      return p.roles.includes('nodo')
  }
}

/** Lo que hay que poner en esta ranura, dicho en llano. */
export function pistaDeRanura(h: HerramientaId, ranura: number): string {
  switch (h) {
    case 'ancla': return ranura === 0 ? 'un caso' : 'un concepto que opere en él'
    case 'contraejemplo': return ranura === 0 ? 'un caso' : 'un concepto que NO opere en él'
    case 'balanza': return ranura === 0 ? 'una tesis' : 'un criterio que la limite'
    case 'descomposicion': return ranura === 0 ? 'el todo' : 'una de sus partes'
    case 'identidad': return ranura === 0 ? 'un nombre' : 'su descripción'
    default: return 'un concepto'
  }
}

export const listaHerramientas = Object.values(HERRAMIENTAS)

/* --------------------------------- trazos --------------------------------- */

export interface Trazo {
  uid: string
  tool: HerramientaId
  piezas: string[]
  /** tipo de relación, o `ejeId::valor` */
  param: string | null
}

/** Escalera de veredictos. Solo `error` e `invertido` castigan: lo que el texto
 *  no dice no es una falta, y lo que se sigue del texto cuenta como acierto. */
export type Estado =
  | 'sostenido'    // el texto lo dice tal cual
  | 'equivalente'  // forma dual o simétrica: la misma afirmación dicha al revés
  | 'compatible'   // el texto lo dice de otro modo, pero lo tuyo también es cierto
  | 'derivado'     // no lo dice, pero se sigue de dos vínculos que sí están
  | 'convive'      // el texto los trata juntos, aunque no enuncie el vínculo
  | 'aproximado'   // el vínculo existe; el tipo es de la misma familia o vecino
  | 'plausible'    // no lo dice, pero están cerca en el grafo: sin castigo
  | 'silencio'     // nada
  | 'invertido'    // el texto dice lo contrario, con un tipo que sí tiene dirección
  | 'error'        // falsificación afirmada como verdadera, o tachón injusto

/** Los que cuentan como acierto para combos, alcance y Atlas. */
export const ACIERTA: Estado[] = ['sostenido', 'equivalente', 'compatible', 'derivado']
export const esAcierto = (e: Estado): boolean => ACIERTA.includes(e)

export interface Veredicto {
  trazo: Trazo
  estado: Estado
  fichas: number
  mult: number
  nota: string
  dimension: Dimension
  conceptIds: string[]
  aristas: { from: string; to: string; tipo: string }[]
  /** identidades resueltas: conceptos que quedan fusionados en el mazo */
  fusiona: string[]
  apocrifaDetectada: string | null
  repertorioReubicado: string | null
  /** anotación cuando el jugador usó una carta falsificada sin darse cuenta */
  reserva: string | null
  /** el veredicto salió de una inferencia, no de una lectura literal */
  inferencia: boolean
  /** conexión que el texto no hace y que el lector propone: se guarda aparte */
  propuesta: { from: string; to: string; tipo: string; motivo: string } | null
}

/** Cada pasiva toca un eje distinto a propósito: así apilarlas nunca es
 *  redundante y cada combinación produce una partida diferente. */
export interface ModificadoresLente {
  multPorTipo: Record<string, number>
  multPorHerramienta: Partial<Record<HerramientaId, number>>
  multPorCombo: Partial<Record<ComboId, number>>
  fichasPorSostenido: number
  multPorUmbral: number
  multGlobal: number
  alcanceExtra: number
  // — economía de mano y herramientas —
  manoExtra: number
  herramientasExtra: HerramientaId[]
  quemasExtra: number
  cambiosExtra: number
  robarPorAcierto: number
  // — la escalera de veredictos —
  fichasPorInferencia: number
  multPorAproximado: number
  plausibleCuenta: boolean
  sinCastigoInvertido: boolean
  // — información —
  revelaApocrifas: number
}

export const SIN_LENTES: ModificadoresLente = {
  multPorTipo: {}, multPorHerramienta: {}, multPorCombo: {},
  fichasPorSostenido: 0, multPorUmbral: 0, multGlobal: 0, alcanceExtra: 0,
  manoExtra: 0, herramientasExtra: [], quemasExtra: 0, cambiosExtra: 0,
  robarPorAcierto: 0, fichasPorInferencia: 0, multPorAproximado: 0, plausibleCuenta: false,
  sinCastigoInvertido: false, revelaApocrifas: 0
}

export type ComboId =
  | 'articulacion' | 'constelacion' | 'cierre' | 'doble_registro'
  | 'refutacion_completa' | 'traduccion' | 'coherencia'

export interface Combo {
  id: ComboId
  nombre: string
  fichas: number
  mult: number
  detalle: string
}

const NOMBRE_COMBO: Record<ComboId, string> = {
  articulacion: 'Articulación',
  constelacion: 'Constelación',
  cierre: 'Cierre',
  doble_registro: 'Doble registro',
  refutacion_completa: 'Refutación completa',
  traduccion: 'Traducción',
  coherencia: 'Coherencia'
}

export interface Diagnostico {
  veredictos: Veredicto[]
  combos: Combo[]
  fichas: number
  mult: number
  dano: number
  alcance: number
  sostenidos: number
  aproximados: number
  inferencias: number
  reservas: string[]
  errores: number
  invertidos: number
  dimensiones: Dimension[]
  conceptIds: string[]
  aristas: { from: string; to: string; tipo: string }[]
  fusiona: string[]
  /** lo que el lector propone y el texto no dice: capa aparte del Atlas */
  propuestas: { from: string; to: string; tipo: string; motivo: string }[]
  apocrifasDetectadas: string[]
  repertoriosReubicados: string[]
  autodano: number
  cierre: string | null
}

/* ==========================================================================
   Validación por herramienta
   ========================================================================== */

export function rarezaRelacion(c: Contenido, tipo: string): number {
  const freqs = Object.values(c.frecuenciaRelacion)
  const max = Math.max(1, ...freqs)
  const f = c.frecuenciaRelacion[tipo] ?? 1
  return 0.35 + (1 - f / max) * 1.05
}

const vacio = (t: Trazo, d: Dimension): Veredicto => ({
  trazo: t, estado: 'silencio', fichas: 0, mult: 0, nota: '', dimension: d,
  conceptIds: [], aristas: [], fusiona: [], apocrifaDetectada: null,
  repertorioReubicado: null, reserva: null, inferencia: false, propuesta: null
})

/** Una apócrifa ya NO derrumba el diagrama.
 *  Corrompe la identidad, no la relación: sigue apuntando a un concepto real
 *  (el que la titula) y se evalúa con una reserva anotada. */
function resolver(p: Pieza): { id: string | null; reserva: string | null } {
  if (p.clase === 'apocrifa') {
    return {
      id: p.conceptId,
      reserva: `Ojo: esa carta lleva el título de «${p.titulo}» con una descripción que no es suya. ${p.explicacion}`
    }
  }
  return { id: p.conceptId, reserva: null }
}

/** Crédito por veredicto: la escalera convertida en fichas y multiplicador. */
const PESO: Record<Estado, { f: number; m: number }> = {
  sostenido: { f: 1, m: 1 },
  equivalente: { f: 1, m: 1 },
  compatible: { f: 0.9, m: 0.85 },
  derivado: { f: 0.7, m: 0.65 },
  convive: { f: 0.55, m: 0.45 },
  aproximado: { f: 0.5, m: 0.35 },
  plausible: { f: 0.18, m: 0 },
  silencio: { f: 0, m: 0 },
  invertido: { f: 0, m: -1 },
  error: { f: 0, m: -0.6 }
}

const titulo = (c: Contenido, id: string | null) => (id && c.conceptos[id]?.titulo) || '—'

/** Reserva acumulada por usar cartas falsificadas: se anota, no se castiga
 *  con el derrumbe del diagrama. La falsificación corrompe la identidad,
 *  no la estructura que el jugador está afirmando. */
function reservaDe(ps: Pieza[]): string | null {
  const mala = ps.find((p) => p.clase === 'apocrifa')
  return mala
    ? `Ojo: usaste «${mala.titulo}» con una descripción que no es suya. ${mala.explicacion}`
    : null
}

function validarFlecha(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'relacion')
  const [a, b] = ps
  const tipo = t.param ?? 'apoya'
  if (!a || !b || !t.param) return { ...v, nota: 'Falta el tipo de vínculo.' }

  // el caso conecta ejemplificando; la tesis, apoyándose o contrastando
  if (a.clase === 'caso') {
    const ok = tipo === 'ejemplifica' && !!b.conceptId && a.conceptIds.includes(b.conceptId)
    return ok
      ? { ...v, estado: 'sostenido', fichas: 12 + lentes.fichasPorSostenido, mult: 1.2, nota: a.cierre, conceptIds: [b.conceptId!] }
      : { ...v, estado: 'plausible', fichas: 3, nota: 'Un caso se enlaza ejemplificando un concepto que sí opera en él.' }
  }
  if (a.clase === 'tesis') {
    const apoya = tipo === 'apoya' && !!b.conceptId && a.conceptIds.includes(b.conceptId)
    const contra = tipo === 'contrasta' && !!b.conceptId && a.conceptIdsRivales.includes(b.conceptId)
    return apoya || contra
      ? { ...v, estado: 'sostenido', fichas: 14 + lentes.fichasPorSostenido, mult: 1.3, nota: a.cierre || 'La tesis queda situada.', conceptIds: [b.conceptId!] }
      : { ...v, estado: 'plausible', fichas: 3, nota: 'Una tesis se apoya en los conceptos que la sostienen o contrasta con los del marco rival.' }
  }
  if (a.clase === 'contexto') {
    // ya la reubicaste una vez: repetirlo vale, pero mucho menos
    const ok = tipo === 'contrasta' && b.conceptId === a.conceptId
    return ok
      ? { ...v, estado: 'sostenido', fichas: 6 + lentes.fichasPorSostenido, mult: 0.5,
          nota: `${a.explicacion} Su terreno: ${a.cierre}`,
          conceptIds: a.conceptId ? [a.conceptId] : [] }
      : { ...v, estado: 'plausible', nota: 'El terreno de una intuición se contrasta con el concepto que ocupaba su lugar.' }
  }
  if (a.clase === 'intuicion') {
    const ok = tipo === 'contrasta' && b.conceptId === a.conceptId
    return ok
      ? {
          ...v, estado: 'sostenido', fichas: 12 + lentes.fichasPorSostenido, mult: 1.2,
          nota: `${a.explicacion} Donde sí funcionaba: ${a.cierre}`,
          conceptIds: a.conceptId ? [a.conceptId] : [], repertorioReubicado: a.refId
        }
      : { ...v, estado: 'plausible', nota: 'Una intuición se reubica contrastándola con el concepto que ocupaba su lugar.' }
  }

  const ra = resolver(a)
  const rb = resolver(b)
  if (!ra.id || !rb.id) return { ...v, nota: 'Esa pieza no es un nodo del texto.' }

  let h = juzgarVinculo(c, ra.id, rb.id, tipo)
  let desde = ra.id
  let hasta = rb.id
  let porContenido = false

  // Segunda oportunidad: si usaste una apócrifa, quizá razonaste por la
  // DESCRIPCIÓN y no por la etiqueta. Si la relación es cierta del dueño real
  // de esa descripción, eso es pensar por contenido y merece crédito.
  const ACIERTA_H = ['sostenida', 'equivalente', 'derivada']
  if ((a.clase === 'apocrifa' || b.clase === 'apocrifa') && !ACIERTA_H.includes(h.estado)) {
    const alt = {
      from: a.clase === 'apocrifa' ? (a.duenoReal ?? ra.id) : ra.id,
      to: b.clase === 'apocrifa' ? (b.duenoReal ?? rb.id) : rb.id
    }
    const h2 = juzgarVinculo(c, alt.from, alt.to, tipo)
    if (ACIERTA_H.includes(h2.estado)) {
      h = h2
      desde = alt.from
      hasta = alt.to
      porContenido = true
    }
  }

  const MAPA: Record<string, Estado> = {
    sostenida: 'sostenido', equivalente: 'equivalente', compatible: 'compatible',
    derivada: 'derivado',
    aproximada: 'aproximado', convive: 'convive', plausible: 'plausible',
    muda: 'silencio', invertida: 'invertido'
  }
  const estado = MAPA[h.estado] ?? 'silencio'
  const imp = (a.importancia + b.importancia) / 2
  const peso = PESO[estado]
  const fichasBase = 8 + Math.round(12 * imp) + lentes.fichasPorSostenido
  const multBase = rarezaRelacion(c, h.tipoReal ?? tipo) + (lentes.multPorTipo[tipo] ?? 0)
  const reserva = ra.reserva ?? rb.reserva

  return {
    ...v,
    estado,
    fichas: Math.round(fichasBase * peso.f),
    mult: peso.m < 0 ? peso.m : multBase * peso.m,
    nota: porContenido
      ? `Fuiste por la descripción y no por el título, y ahí acertaste: ${h.nota}`
      : h.nota,
    reserva,
    inferencia: estado === 'derivado',
    // una propuesta solo se guarda si los conceptos están cerca en el grafo:
    // el listón evita que la capa propia se llene de corazonadas sin fondo
    propuesta: estado === 'plausible' && !ra.reserva && !rb.reserva
      ? (() => {
          const motivo = admisibleComoPropuesta(c, desde, hasta)
          return motivo ? { from: desde, to: hasta, tipo, motivo } : null
        })()
      : null,
    conceptIds: [desde, hasta],
    // el Atlas solo recoge lo que el texto afirma literalmente, no lo inferido
    aristas: estado === 'sostenido' || estado === 'equivalente' || estado === 'compatible'
      ? [{ from: desde, to: hasta, tipo: h.tipoReal ?? tipo }]
      : []
  }
}

function validarIdentidad(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'recuperacion')
  const [a, b] = ps
  if (!a || !b) return v
  const apocrifa = [a, b].find((p) => p.clase === 'apocrifa')
  if (apocrifa) {
    return { ...v, estado: 'error', nota: `No son lo mismo. ${apocrifa.explicacion}` }
  }
  const nombre = [a, b].find((p) => p.roles.includes('etiqueta'))
  const desc = [a, b].find((p) => p.roles.includes('definicion') && p !== nombre)
  if (!nombre || !desc) {
    return { ...v, nota: 'La identidad empareja un nombre con una descripción.' }
  }
  const mismo = nombre.conceptId && nombre.conceptId === desc.conceptId
  if (mismo) {
    const k = c.conceptos[nombre.conceptId!]
    return {
      ...v, estado: 'sostenido',
      fichas: 6 + Math.round(8 * (k?.importancia ?? 0.5)) + lentes.fichasPorSostenido,
      mult: 0.6, nota: `${k?.titulo}: ${k?.definicion}`,
      conceptIds: [nombre.conceptId!], fusiona: [nombre.conceptId!]
    }
  }
  return {
    ...v, estado: 'error',
    nota: `Esa descripción es de «${titulo(c, desc.conceptId)}», no de «${nombre.titulo}».`,
    conceptIds: [nombre.conceptId, desc.conceptId].filter((x): x is string => !!x)
  }
}

function validarCampo(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'estructura')
  const reserva = reservaDe(ps)
  const marco = ps.find((p) => p.clase === 'marco')
  // el Terreno es comodín: sabes dónde vive esa intuición, así que ya no estorba
  const terrenos = ps.filter((p) => p.clase === 'contexto')
  const conceptos = ps.filter((p) => p.conceptId && p.clase !== 'marco' && p.clase !== 'contexto')
  if (conceptos.length < 2) return { ...v, reserva, nota: 'Un campo necesita al menos dos conceptos.' }

  if (marco) {
    const dentro = conceptos.filter((p) => marco.conceptIds.includes(p.conceptId!))
    const ok = dentro.length === conceptos.length
    return ok
      ? {
          ...v, estado: 'sostenido', fichas: 8 * conceptos.length + lentes.fichasPorSostenido,
          mult: 1.4, nota: `Todos pertenecen a ${marco.titulo}.`,
          conceptIds: conceptos.map((p) => p.conceptId!)
        }
      : {
          ...v, estado: 'aproximado', fichas: 4 * dentro.length,
          nota: `${conceptos.length - dentro.length} de esos conceptos no pertenecen a ${marco.titulo}.`,
          conceptIds: dentro.map((p) => p.conceptId!)
        }
  }
  const clusters = new Set(conceptos.map((p) => c.conceptos[p.conceptId!]?.clusterId ?? '—'))
  if (clusters.size === 1 && !clusters.has('—')) {
    return {
      ...v, reserva, estado: 'sostenido',
      fichas: 7 * conceptos.length + 5 * terrenos.length + lentes.fichasPorSostenido,
      mult: 0.9 + 0.25 * conceptos.length + 0.5 * terrenos.length,
      nota: terrenos.length
        ? 'Comparten zona del texto, y sabes qué intuición convive con ellos.'
        : 'Comparten zona del texto.',
      conceptIds: conceptos.map((p) => p.conceptId!)
    }
  }
  return {
    ...v, estado: 'silencio',
    nota: `Esos conceptos viven en ${clusters.size} zonas distintas del texto.`
  }
}

function validarJerarquia(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'estructura')
  const reserva = reservaDe(ps)
  const ids = ps.map((p) => p.conceptId).filter((x): x is string => !!x)
  if (ids.length < 2) return { ...v, reserva, nota: 'La jerarquía necesita dos conceptos.' }

  let ok = 0
  const aristas: Diagnostico['aristas'] = []
  for (let i = 0; i + 1 < ids.length; i++) {
    const arriba = ids[i], abajo = ids[i + 1]
    const gen = c.aristas.find((x) => x.from === arriba && x.to === abajo && (x.tipo === 'generaliza' || x.tipo === 'requiere'))
    if (gen) { ok++; aristas.push({ from: arriba, to: abajo, tipo: gen.tipo }) }
  }
  if (ok === ids.length - 1) {
    return {
      ...v, reserva, estado: 'sostenido', fichas: 10 * ok + lentes.fichasPorSostenido, mult: 1.1 * ok,
      nota: 'La contención categórica se sostiene de arriba abajo.', conceptIds: ids, aristas
    }
  }
  if (ok > 0) return { ...v, reserva, estado: 'aproximado', fichas: 5 * ok, nota: 'Parte de la jerarquía se sostiene.', conceptIds: ids, aristas }
  const alReves = c.aristas.some((x) => x.from === ids[1] && x.to === ids[0] && x.tipo === 'generaliza')
  return alReves
    ? { ...v, estado: 'invertido', mult: -1, nota: `«${titulo(c, ids[1])}» es la categoría, no lo contrario.`, conceptIds: ids }
    : { ...v, nota: 'El texto no establece esa contención.' }
}

function validarEje(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'relacion')
  const reserva = reservaDe(ps)
  if (!t.param) return { ...v, reserva, nota: 'Elige un eje y un extremo.' }
  const [ejeId, valor] = t.param.split('::')
  const eje = c.ejes.find((e) => e.id === ejeId)
  if (!eje) return { ...v, reserva, nota: 'Este texto no trae ese eje.' }
  const ids = ps.map((p) => p.conceptId).filter((x): x is string => !!x)
  if (ids.length < 2) return { ...v, reserva, nota: 'Coloca al menos dos piezas en el eje.' }
  const aciertos = ids.filter((id) => String(eje.valores[id] ?? '') === valor)
  if (aciertos.length === ids.length) {
    return {
      ...v, reserva, estado: 'sostenido', fichas: 9 * ids.length + lentes.fichasPorSostenido,
      mult: 1.2 + 0.2 * ids.length,
      nota: `Todos son «${valor}» en el eje ${eje.nombre}.`, conceptIds: ids
    }
  }
  if (aciertos.length) {
    return {
      ...v, reserva, estado: 'aproximado', fichas: 4 * aciertos.length,
      nota: `${ids.length - aciertos.length} de esas piezas están en el otro extremo de ${eje.nombre}.`,
      conceptIds: aciertos
    }
  }
  return { ...v, reserva, estado: 'invertido', mult: -1, nota: `Ninguno es «${valor}» en ${eje.nombre}.`, conceptIds: ids }
}

function validarSecuencia(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'estructura')
  const reserva = reservaDe(ps)
  const ids = ps.map((p) => p.conceptId).filter((x): x is string => !!x)
  if (ids.length < 3) return { ...v, reserva, nota: 'Una secuencia necesita tres pasos.' }
  const aristas: Diagnostico['aristas'] = []
  let ok = 0
  for (let i = 0; i + 1 < ids.length; i++) {
    const paso = c.aristas.find((x) => x.from === ids[i] && x.to === ids[i + 1] && (x.tipo === 'causa' || x.tipo === 'requiere'))
    if (paso) { ok++; aristas.push({ from: ids[i], to: ids[i + 1], tipo: paso.tipo }) }
  }
  if (ok === ids.length - 1) {
    return {
      ...v, reserva, estado: 'sostenido', fichas: 12 * ok + lentes.fichasPorSostenido, mult: 1.4 * ok,
      nota: 'El proceso ocurre en ese orden.', conceptIds: ids, aristas
    }
  }
  if (ok > 0) return { ...v, reserva, estado: 'aproximado', fichas: 6 * ok, nota: 'Parte del orden se sostiene.', conceptIds: ids, aristas }
  return { ...v, reserva, nota: 'El texto no encadena esos pasos así.' }
}

function validarAncla(_c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'transferencia')
  const caso = ps.find((p) => p.clase === 'caso')
  const resto = ps.filter((p) => p !== caso)
  const reserva = reservaDe(resto)
  if (!caso) return { ...v, reserva, nota: 'El ancla necesita un caso.' }
  const ids = resto.map((p) => p.conceptId).filter((x): x is string => !!x)
  if (!ids.length) return { ...v, reserva, nota: 'Ancla el caso a los conceptos que operan en él.' }
  const aciertos = ids.filter((id) => caso.conceptIds.includes(id))
  const m = caso.distancia === 'lejana' ? 2.2 : caso.distancia === 'media' ? 1.6 : 1.1
  if (aciertos.length === ids.length) {
    return {
      ...v, reserva, estado: 'sostenido', fichas: 10 * ids.length + 8 + lentes.fichasPorSostenido,
      mult: m + 0.2 * ids.length, nota: caso.cierre, conceptIds: ids
    }
  }
  if (aciertos.length) {
    return {
      ...v, reserva, estado: 'aproximado', fichas: 5 * aciertos.length, mult: m * 0.5,
      nota: `${ids.length - aciertos.length} de esos conceptos no operan en este caso. ${caso.cierre}`,
      conceptIds: aciertos
    }
  }
  return { ...v, reserva, estado: 'invertido', mult: -1, nota: `Ninguno opera ahí. ${caso.cierre}`, conceptIds: ids }
}

function validarBalanza(_c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'produccion')
  const tesis = ps.find((p) => p.clase === 'tesis')
  const criterios = ps.filter((p) => p.clase === 'criterio')
  if (!tesis) return { ...v, nota: 'La balanza necesita una tesis.' }
  if (!criterios.length) return { ...v, nota: 'Pon un criterio en el otro platillo.' }
  const validos = criterios.filter((k) => k.tesisId === tesis.refId && k.sentido === 'refuta')
  const objeciones = criterios.filter((k) => k.sentido !== 'refuta')
  if (validos.length && !objeciones.length) {
    return {
      ...v, estado: 'sostenido', fichas: 18 * validos.length + lentes.fichasPorSostenido,
      mult: 1.6 + 0.4 * validos.length,
      nota: 'Cumple la rúbrica: fija qué evidencia obligaría a revisar la tesis.',
      conceptIds: tesis.conceptIds
    }
  }
  if (objeciones.length) {
    return {
      ...v, estado: 'error',
      nota: objeciones[0].explicacion || 'Eso es una objeción, no un criterio de refutación.',
      conceptIds: tesis.conceptIds
    }
  }
  return { ...v, nota: 'Ese criterio pertenece a otra tesis.' }
}

/* --------------------- las cuatro herramientas nuevas --------------------- */

/** Falsar: decir dónde algo NO opera. Solo cuenta si el concepto era candidato
 *  plausible —vecino de lo que sí opera en el caso—; negar algo que nadie
 *  habría afirmado no demuestra nada. */
function validarContraejemplo(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'discriminacion')
  const reserva = reservaDe(ps)
  const caso = ps.find((p) => p.clase === 'caso')
  const resto = ps.filter((p) => p !== caso && p.conceptId)
  if (!caso) return { ...v, reserva, nota: 'El contraejemplo necesita un caso.' }
  if (!resto.length) return { ...v, reserva, nota: 'Señala qué concepto NO opera ahí.' }

  const dentro = new Set(caso.conceptIds)
  const vecinosDelCaso = new Set(
    c.aristas
      .filter((a) => dentro.has(a.from) || dentro.has(a.to))
      .flatMap((a) => [a.from, a.to])
  )

  const errados = resto.filter((p) => dentro.has(p.conceptId!))
  if (errados.length) {
    return {
      ...v, reserva, estado: 'invertido', mult: -1,
      nota: `«${errados[0].titulo}» sí opera en ese caso: ${caso.cierre}`,
      conceptIds: errados.map((p) => p.conceptId!)
    }
  }
  const finos = resto.filter((p) => vecinosDelCaso.has(p.conceptId!))
  if (finos.length === resto.length) {
    return {
      ...v, reserva, estado: 'sostenido',
      fichas: 14 * resto.length + lentes.fichasPorSostenido,
      mult: 1.5 + 0.3 * resto.length,
      nota: `Buena distinción: se le parece, pero el texto no lo pone a operar ahí. ${caso.cierre}`,
      conceptIds: resto.map((p) => p.conceptId!)
    }
  }
  return {
    ...v, reserva, estado: 'plausible', fichas: 4,
    nota: 'Cierto, pero demasiado fácil: ese concepto ni siquiera rondaba el caso.',
    conceptIds: resto.map((p) => p.conceptId!)
  }
}

/** Analogizar: A es a B lo que C es a D. La jugada más difícil del juego y la
 *  única que mide transferencia estructural en vez de aplicación reconocida.
 *  Solo vale si los dos pares están unidos por el MISMO tipo de vínculo y viven
 *  en zonas distintas del texto. */
function validarAnalogia(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'transferencia')
  const reserva = reservaDe(ps)
  const ids = ps.map((p) => p.conceptId).filter((x): x is string => !!x)
  if (ids.length < 4) return { ...v, reserva, nota: 'La analogía necesita cuatro conceptos: A, B, C y D.' }
  const [a, b, cc, d] = ids

  const tipos1 = c.aristas.filter((x) => x.from === a && x.to === b).map((x) => x.tipo)
  const tipos2 = c.aristas.filter((x) => x.from === cc && x.to === d).map((x) => x.tipo)
  const comun = tipos1.find((x) => tipos2.includes(x))

  if (!comun) {
    const hayAlgo = tipos1.length && tipos2.length
    return {
      ...v, reserva, estado: hayAlgo ? 'aproximado' : 'silencio',
      fichas: hayAlgo ? 6 : 0,
      nota: hayAlgo
        ? `Los dos pares existen, pero no con el mismo vínculo: «${tipos1[0]}» frente a «${tipos2[0]}». La analogía exige la misma forma.`
        : 'Al menos uno de los dos pares no está en el texto.',
      conceptIds: ids
    }
  }
  const zona = (id: string) => c.conceptos[id]?.clusterId ?? '—'
  const lejos = zona(a) !== zona(cc) || zona(b) !== zona(d)
  return {
    ...v, reserva, estado: 'sostenido',
    fichas: 26 + lentes.fichasPorSostenido,
    mult: lejos ? 3 : 1.4,
    nota: lejos
      ? `Misma estructura en dos zonas distintas del texto: ambos pares se unen por «${comun}». Eso es transferencia de verdad.`
      : `Los dos pares se unen por «${comun}», pero son de la misma zona: la analogía es correcta y algo fácil.`,
    conceptIds: ids
  }
}

/** Acotar: bajo qué condición vale algo. Es la discriminabilidad de la que
 *  depende poder seleccionar entre repertorios, y usa las aristas `matiza`
 *  y el campo `tensiones`, que estaba sin usar. */
function validarAlcance(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'discriminacion')
  const reserva = reservaDe(ps)
  const [a, b] = ps
  if (!a?.conceptId || !b?.conceptId) return { ...v, reserva, nota: 'El alcance necesita dos conceptos.' }

  const matiza = c.aristas.find(
    (x) => x.tipo === 'matiza' &&
      ((x.from === b.conceptId && x.to === a.conceptId) || (x.from === a.conceptId && x.to === b.conceptId))
  )
  if (matiza) {
    return {
      ...v, reserva, estado: 'sostenido', fichas: 16 + lentes.fichasPorSostenido, mult: 1.8,
      nota: `${matiza.descripcion} Saber dónde deja de valer algo es tan importante como saber qué es.`,
      conceptIds: [a.conceptId, b.conceptId],
      aristas: [{ from: b.conceptId, to: a.conceptId, tipo: 'matiza' }]
    }
  }
  const tension = (c.conceptos[a.conceptId]?.tensiones ?? []).some(
    (x) => x.toLowerCase().includes((c.conceptos[b.conceptId!]?.titulo ?? '').toLowerCase())
  )
  if (tension) {
    return {
      ...v, reserva, estado: 'sostenido', fichas: 14 + lentes.fichasPorSostenido, mult: 1.5,
      nota: 'El texto reconoce esa tensión: ahí está el límite de lo que afirma.',
      conceptIds: [a.conceptId, b.conceptId]
    }
  }
  const requiere = c.aristas.find(
    (x) => x.tipo === 'requiere' && x.from === a.conceptId && x.to === b.conceptId
  )
  if (requiere) {
    return {
      ...v, reserva, estado: 'aproximado', fichas: 7,
      nota: `Va por ahí: el texto lo dice como prerrequisito, no como límite. ${requiere.descripcion}`,
      conceptIds: [a.conceptId, b.conceptId]
    }
  }
  return { ...v, reserva, nota: 'El texto no pone esa condición sobre ese concepto.' }
}

/** Descomponer: el todo y sus partes. No es lo mismo que jerarquizar: una
 *  categoría contiene ejemplares, un todo contiene componentes. */
function validarDescomposicion(_c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'estructura')
  const reserva = reservaDe(ps)
  const todo = ps[0]
  const partes = ps.slice(1)
  if (!todo?.conceptId || !partes.length) {
    return { ...v, reserva, nota: 'Pon primero el todo y después sus partes.' }
  }
  const buenas = partes.filter((p) => p.clase === 'subdimension' && p.conceptId === todo.conceptId)
  const ajenas = partes.filter((p) => p.clase === 'subdimension' && p.conceptId !== todo.conceptId)

  if (buenas.length === partes.length) {
    return {
      ...v, reserva, estado: 'sostenido',
      fichas: 11 * buenas.length + lentes.fichasPorSostenido,
      mult: 1.2 + 0.35 * buenas.length,
      nota: `El texto desglosa «${todo.titulo}» exactamente en esas partes.`,
      conceptIds: [todo.conceptId]
    }
  }
  if (ajenas.length) {
    return {
      ...v, reserva, estado: 'invertido', mult: -1,
      nota: `«${ajenas[0].titulo}» es parte de otro concepto, no de «${todo.titulo}».`,
      conceptIds: [todo.conceptId]
    }
  }
  if (buenas.length) {
    return {
      ...v, reserva, estado: 'aproximado', fichas: 6 * buenas.length,
      nota: 'Parte del desglose se sostiene; el resto no son componentes de eso.',
      conceptIds: [todo.conceptId]
    }
  }
  return { ...v, reserva, nota: 'Las partes se toman de las subdimensiones que el texto declara.' }
}

const VALIDADORES: Record<HerramientaId, (c: Contenido, t: Trazo, ps: Pieza[], l: ModificadoresLente) => Veredicto> = {
  flecha: validarFlecha,
  identidad: validarIdentidad,
  campo: validarCampo,
  jerarquia: validarJerarquia,
  eje: validarEje,
  secuencia: validarSecuencia,
  ancla: validarAncla,
  balanza: validarBalanza,
  contraejemplo: validarContraejemplo,
  analogia: validarAnalogia,
  alcance: validarAlcance,
  descomposicion: validarDescomposicion,
}

/* ==========================================================================
   El diagrama completo: los combos salen de que los trazos COMPARTAN piezas
   ========================================================================== */

export function evaluarDiagrama(
  c: Contenido, piezas: Pieza[], trazos: Trazo[], lentes: ModificadoresLente = SIN_LENTES
): Diagnostico {
  const porUid = new Map(piezas.map((p) => [p.uid, p]))
  const veredictos: Veredicto[] = []

  for (const t of trazos) {
    const ps = t.piezas.map((u) => porUid.get(u)).filter((p): p is Pieza => !!p)
    const h = HERRAMIENTAS[t.tool]
    if (ps.length < h.aridad[0]) {
      veredictos.push({ ...vacio(t, h.dimension), nota: `${h.nombre} necesita al menos ${h.aridad[0]} piezas.` })
      continue
    }
    const ver = VALIDADORES[t.tool](c, t, ps, lentes)
    const extra = lentes.multPorHerramienta[t.tool] ?? 0
    veredictos.push({ ...ver, mult: ver.mult + (ver.estado === 'sostenido' ? extra : 0) })
  }

  // acierto = lo que el texto sostiene, dicho al derecho, al revés o inferido
  // Una propuesta deja de ser corazonada si en el MISMO diagrama anclas los dos
  // conceptos al mismo caso: ahí ya has mostrado dónde operan juntos.
  const anclas = veredictos.filter((v) => v.trazo.tool === 'ancla' && esAcierto(v.estado))
  if (anclas.length) {
    for (const v of veredictos) {
      if (v.estado !== 'plausible' || v.conceptIds.length < 2) continue
      const [a, b] = v.conceptIds
      const sostenida = anclas.some((x) => x.conceptIds.includes(a) && x.conceptIds.includes(b))
      if (!sostenida) continue
      v.estado = 'convive'
      v.fichas = Math.round(v.fichas * 3)
      v.mult = 0.8
      v.propuesta = null
      v.nota = 'Lo has sostenido con un caso: los dos operan ahí, así que ya no es una corazonada.'
    }
  }

  const sostenidos = veredictos.filter((v) => esAcierto(v.estado))
  const aproximados = veredictos.filter((v) => v.estado === 'aproximado')
  const errores = veredictos.filter((v) => v.estado === 'error')
  const invertidos = veredictos.filter((v) => v.estado === 'invertido')
  const reservas = veredictos.map((v) => v.reserva).filter((x): x is string => !!x)

  let fichas = veredictos.reduce((n, v) => n + v.fichas, 0)
  let mult = 1 + veredictos.reduce((n, v) => n + v.mult, 0)

  const combos: Combo[] = []
  const anadir = (id: ComboId, f: number, m: number, detalle: string) => {
    const bonus = lentes.multPorCombo[id] ?? 0
    combos.push({ id, nombre: NOMBRE_COMBO[id], fichas: f, mult: m + bonus, detalle })
    fichas += f
    mult += m + bonus
  }

  if (sostenidos.length >= 2) {
    // articulación: una pieza que participa en tres trazos sostenidos
    const uso = new Map<string, number>()
    for (const v of sostenidos) for (const u of v.trazo.piezas) uso.set(u, (uso.get(u) ?? 0) + 1)
    const articuladas = [...uso.values()].filter((n) => n >= 3).length
    if (articuladas > 0) {
      anadir('articulacion', 10 * articuladas, 1.2 * articuladas,
        `${articuladas} pieza(s) sostienen tres afirmaciones a la vez.`)
    }
    // constelación: cuatro trazos sostenidos sin un solo error
    if (sostenidos.length >= 4 && errores.length === 0) {
      anadir('constelacion', 25, 2, 'Cuatro afirmaciones sostenidas y ningún derrumbe.')
    }
    // cierre: un campo cuyos miembros además están enlazados entre sí
    const campos = sostenidos.filter((v) => v.trazo.tool === 'campo')
    for (const campo of campos) {
      const dentro = new Set(campo.trazo.piezas)
      const enlaces = sostenidos.filter((v) =>
        v.trazo.tool === 'flecha' && v.trazo.piezas.every((u) => dentro.has(u)))
      if (enlaces.length >= dentro.size - 1) {
        anadir('cierre', 18, 1.8, 'El campo no solo agrupa: además está tejido por dentro.')
        break
      }
    }
    // doble registro: un concepto identificado Y enlazado en el mismo diagrama
    const identificados = new Set(sostenidos.filter((v) => v.trazo.tool === 'identidad').flatMap((v) => v.conceptIds))
    const enlazados = new Set(sostenidos.filter((v) => v.trazo.tool === 'flecha').flatMap((v) => v.conceptIds))
    const dobles = [...identificados].filter((id) => enlazados.has(id)).length
    if (dobles > 0) {
      anadir('doble_registro', 12 * dobles, 1 * dobles,
        'Sabes qué es y además qué hace: reconocimiento y relación sobre el mismo concepto.')
    }
    // refutación completa: balanza + campo del marco rival
    if (sostenidos.some((v) => v.trazo.tool === 'balanza') &&
        sostenidos.some((v) => v.trazo.tool === 'campo')) {
      anadir('refutacion_completa', 22, 2.2, 'Sitúas la tesis y además delimitas el marco al que responde.')
    }
    // traducción: un caso anclado y sus conceptos también definidos
    if (sostenidos.some((v) => v.trazo.tool === 'ancla') && identificados.size > 0) {
      anadir('traduccion', 14, 1.4, 'Llevas el concepto al caso sin perder de vista qué era.')
    }
    // coherencia: todas las flechas del mismo tipo
    const tipos = new Set(sostenidos.filter((v) => v.trazo.tool === 'flecha').map((v) => v.trazo.param))
    if (tipos.size === 1 && sostenidos.filter((v) => v.trazo.tool === 'flecha').length >= 2) {
      anadir('coherencia', 0, 0.9, `Todo el diagrama es «${[...tipos][0]}».`)
    }
  }

  const umbrales = new Set(
    sostenidos.flatMap((v) => v.conceptIds).filter((id) => c.conceptos[id]?.esUmbral)
  ).size
  if (umbrales > 0) {
    anadir('articulacion', 0, umbrales * (0.5 + lentes.multPorUmbral), `${umbrales} concepto(s) umbral.`)
    combos[combos.length - 1].nombre = 'Umbral'
  }

  // bonificaciones de pasivas sobre la escalera
  const nInf = veredictos.filter((v) => v.inferencia).length
  if (nInf) fichas += lentes.fichasPorInferencia * nInf
  if (aproximados.length) mult += lentes.multPorAproximado * aproximados.length
  if (lentes.plausibleCuenta) {
    const pl = veredictos.filter((v) => v.estado === 'plausible').length
    fichas += pl * 6
  }
  // un error resta, pero ya no derrumba el diagrama entero: lo demás sigue en pie
  if (errores.length) mult = Math.max(0.4, mult - 0.5 * errores.length)
  // usar una falsificación sin darse cuenta cuesta rendimiento, no la jugada
  if (reservas.length) mult = Math.max(0.4, mult * (1 - 0.15 * reservas.length))
  mult = Math.max(0, mult + lentes.multGlobal)

  const dano = Math.max(0, Math.round(fichas * mult))
  const dims = [...new Set(sostenidos.map((v) => v.dimension))]

  return {
    veredictos, combos, fichas, mult, dano,
    alcance: Math.min(4, 1 + Math.floor(sostenidos.length / 1.5) + lentes.alcanceExtra),
    sostenidos: sostenidos.length,
    aproximados: aproximados.length,
    inferencias: veredictos.filter((v) => v.inferencia).length,
    reservas,
    errores: errores.length,
    invertidos: invertidos.length,
    dimensiones: dims,
    conceptIds: [...new Set(veredictos.flatMap((v) => v.conceptIds))],
    aristas: sostenidos.flatMap((v) => v.aristas),
    fusiona: [...new Set(sostenidos.flatMap((v) => v.fusiona))],
    propuestas: veredictos.map((v) => v.propuesta).filter((x): x is NonNullable<typeof x> => !!x),
    apocrifasDetectadas: sostenidos.map((v) => v.apocrifaDetectada).filter((x): x is string => !!x),
    repertoriosReubicados: sostenidos.map((v) => v.repertorioReubicado).filter((x): x is string => !!x),
    autodano: errores.length * 4 + (lentes.sinCastigoInvertido ? 0 : invertidos.length * 3),
    cierre: sostenidos.length ? sostenidos[sostenidos.length - 1].nota : null
  }
}

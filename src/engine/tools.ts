import type { Contenido } from '../content/types'
import type { Pieza, Rol } from './pieces'

/* ==========================================================================
   Las herramientas cognitivas. Cada una es una forma de AFIRMAR algo sobre
   el material, y cada una emite una señal distinta. El tablero es libre: el
   jugador combina las que quiera sobre las piezas que le tocaron.
   ========================================================================== */

export type HerramientaId =
  | 'flecha' | 'campo' | 'jerarquia' | 'eje' | 'identidad'
  | 'tachon' | 'ancla' | 'balanza' | 'secuencia'

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
}

export const HERRAMIENTAS: Record<HerramientaId, Herramienta> = {
  flecha: {
    id: 'flecha', nombre: 'Flecha', glifo: '→',
    afirma: 'Que existe este vínculo, con este tipo y en esta dirección.',
    aridad: [2, 2], rolesExigidos: ['nodo', 'nodo'], parametro: 'relacion',
    dimension: 'relacion', ordenada: true
  },
  identidad: {
    id: 'identidad', nombre: 'Identidad', glifo: '=',
    afirma: 'Que este nombre y esta descripción son la misma cosa.',
    aridad: [2, 2], rolesExigidos: ['nodo', 'nodo'], parametro: null,
    dimension: 'recuperacion', ordenada: false
  },
  campo: {
    id: 'campo', nombre: 'Campo semántico', glifo: '◯',
    afirma: 'Que todo lo que encierro pertenece a la misma zona del texto.',
    aridad: [2, 6], rolesExigidos: ['nodo'], parametro: null,
    dimension: 'estructura', ordenada: false
  },
  jerarquia: {
    id: 'jerarquia', nombre: 'Jerarquía', glifo: '⊃',
    afirma: 'Que el primero es la categoría que contiene al segundo.',
    aridad: [2, 4], rolesExigidos: ['nodo'], parametro: null,
    dimension: 'estructura', ordenada: true
  },
  eje: {
    id: 'eje', nombre: 'Eje', glifo: '⊢',
    afirma: 'Que todo esto cae en el mismo extremo de un eje del dominio.',
    aridad: [2, 5], rolesExigidos: ['nodo'], parametro: 'eje',
    dimension: 'relacion', ordenada: false
  },
  secuencia: {
    id: 'secuencia', nombre: 'Secuencia', glifo: '⇢',
    afirma: 'Que esto ocurre en este orden, cada paso llevando al siguiente.',
    aridad: [3, 4], rolesExigidos: ['nodo'], parametro: null,
    dimension: 'estructura', ordenada: true
  },
  ancla: {
    id: 'ancla', nombre: 'Ancla', glifo: '⌖',
    afirma: 'Que estos conceptos son los que operan en este caso.',
    aridad: [2, 4], rolesExigidos: ['caso', 'nodo'], parametro: null,
    dimension: 'transferencia', ordenada: true
  },
  balanza: {
    id: 'balanza', nombre: 'Balanza', glifo: '⚖',
    afirma: 'Que esto es lo que obligaría a revisar la tesis.',
    aridad: [2, 3], rolesExigidos: ['tesis', 'criterio'], parametro: null,
    dimension: 'produccion', ordenada: true
  },
  tachon: {
    id: 'tachon', nombre: 'Tachón', glifo: '✗',
    afirma: 'Que esta carta es una falsificación.',
    aridad: [1, 1], rolesExigidos: ['nodo'], parametro: null,
    dimension: 'discriminacion', ordenada: false
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

export type Estado = 'sostenido' | 'parcial' | 'silencio' | 'invertido' | 'error'

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
}

export interface ModificadoresLente {
  multPorTipo: Record<string, number>
  multPorHerramienta: Partial<Record<HerramientaId, number>>
  multPorCombo: Partial<Record<ComboId, number>>
  fichasPorSostenido: number
  multPorUmbral: number
  multGlobal: number
  alcanceExtra: number
}

export const SIN_LENTES: ModificadoresLente = {
  multPorTipo: {}, multPorHerramienta: {}, multPorCombo: {},
  fichasPorSostenido: 0, multPorUmbral: 0, multGlobal: 0, alcanceExtra: 0
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
  errores: number
  invertidos: number
  dimensiones: Dimension[]
  conceptIds: string[]
  aristas: { from: string; to: string; tipo: string }[]
  fusiona: string[]
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
  conceptIds: [], aristas: [], fusiona: [], apocrifaDetectada: null, repertorioReubicado: null
})

const titulo = (c: Contenido, id: string | null) => (id && c.conceptos[id]?.titulo) || '—'

/** ¿Es esta pieza legítima como nodo del grafo? Una apócrifa no lo es. */
function nodoValido(p: Pieza): boolean {
  return p.clase !== 'apocrifa'
}

function validarFlecha(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'relacion')
  const [a, b] = ps
  const tipo = t.param ?? 'apoya'
  if (!a || !b || !t.param) return { ...v, nota: 'Falta el tipo de vínculo.' }

  for (const p of [a, b]) {
    if (!nodoValido(p)) {
      return { ...v, estado: 'error', nota: `«${p.titulo}» no dice eso. ${p.explicacion}` }
    }
  }
  // el caso conecta ejemplificando; la tesis, apoyándose o contrastando
  if (a.clase === 'caso') {
    const ok = tipo === 'ejemplifica' && !!b.conceptId && a.conceptIds.includes(b.conceptId)
    return ok
      ? { ...v, estado: 'sostenido', fichas: 12 + lentes.fichasPorSostenido, mult: 1.2, nota: a.cierre, conceptIds: [b.conceptId!] }
      : { ...v, nota: 'Un caso se enlaza ejemplificando un concepto que sí opera en él.' }
  }
  if (a.clase === 'tesis') {
    const apoya = tipo === 'apoya' && !!b.conceptId && a.conceptIds.includes(b.conceptId)
    const contra = tipo === 'contrasta' && !!b.conceptId && a.conceptIdsRivales.includes(b.conceptId)
    return apoya || contra
      ? { ...v, estado: 'sostenido', fichas: 14 + lentes.fichasPorSostenido, mult: 1.3, nota: a.cierre || 'La tesis queda situada.', conceptIds: [b.conceptId!] }
      : { ...v, nota: 'Una tesis se apoya en los conceptos que la sostienen o contrasta con los del marco rival.' }
  }
  if (a.clase === 'intuicion') {
    const ok = tipo === 'contrasta' && b.conceptId === a.conceptId
    return ok
      ? {
          ...v, estado: 'sostenido', fichas: 12 + lentes.fichasPorSostenido, mult: 1.2,
          nota: `${a.explicacion} Donde sí funcionaba: ${a.cierre}`,
          conceptIds: a.conceptId ? [a.conceptId] : [], repertorioReubicado: a.refId
        }
      : { ...v, estado: 'error', nota: 'Una intuición se reubica contrastándola con el concepto que ocupaba su lugar.' }
  }
  if (!a.conceptId || !b.conceptId) {
    return { ...v, nota: 'Esa pieza no es un nodo del texto.' }
  }

  const directa = c.aristas.filter((x) => x.from === a.conceptId && x.to === b.conceptId)
  const inversa = c.aristas.filter((x) => x.from === b.conceptId && x.to === a.conceptId)
  const exacta = directa.find((x) => x.tipo === tipo)
  const imp = (a.importancia + b.importancia) / 2

  if (exacta) {
    return {
      ...v, estado: 'sostenido',
      fichas: 8 + Math.round(12 * imp) + lentes.fichasPorSostenido,
      mult: rarezaRelacion(c, tipo) + (lentes.multPorTipo[tipo] ?? 0),
      nota: exacta.descripcion, conceptIds: [a.conceptId, b.conceptId],
      aristas: [{ from: a.conceptId, to: b.conceptId, tipo }]
    }
  }
  if (directa.length) {
    return {
      ...v, estado: 'parcial', fichas: 5,
      nota: `El vínculo existe, pero es «${directa[0].tipo}»: ${directa[0].descripcion}`,
      conceptIds: [a.conceptId, b.conceptId]
    }
  }
  if (inversa.length) {
    return {
      ...v, estado: 'invertido', mult: -1,
      nota: `Va al contrario: ${titulo(c, b.conceptId)} ${inversa[0].tipo} ${titulo(c, a.conceptId)}.`,
      conceptIds: [a.conceptId, b.conceptId]
    }
  }
  return { ...v, nota: 'El texto no afirma nada entre esos dos.' }
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
  if (ps.some((p) => !nodoValido(p))) {
    const bad = ps.find((p) => !nodoValido(p))!
    return { ...v, estado: 'error', nota: `${bad.explicacion}` }
  }
  const marco = ps.find((p) => p.clase === 'marco')
  const conceptos = ps.filter((p) => p.conceptId && p.clase !== 'marco')
  if (conceptos.length < 2) return { ...v, nota: 'Un campo necesita al menos dos conceptos.' }

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
          ...v, estado: 'parcial', fichas: 4 * dentro.length,
          nota: `${conceptos.length - dentro.length} de esos conceptos no pertenecen a ${marco.titulo}.`,
          conceptIds: dentro.map((p) => p.conceptId!)
        }
  }
  const clusters = new Set(conceptos.map((p) => c.conceptos[p.conceptId!]?.clusterId ?? '—'))
  if (clusters.size === 1 && !clusters.has('—')) {
    return {
      ...v, estado: 'sostenido', fichas: 7 * conceptos.length + lentes.fichasPorSostenido,
      mult: 0.9 + 0.25 * conceptos.length, nota: 'Comparten zona del texto.',
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
  if (ps.some((p) => !nodoValido(p))) {
    return { ...v, estado: 'error', nota: ps.find((p) => !nodoValido(p))!.explicacion }
  }
  const ids = ps.map((p) => p.conceptId).filter((x): x is string => !!x)
  if (ids.length < 2) return { ...v, nota: 'La jerarquía necesita dos conceptos.' }

  let ok = 0
  const aristas: Diagnostico['aristas'] = []
  for (let i = 0; i + 1 < ids.length; i++) {
    const arriba = ids[i], abajo = ids[i + 1]
    const gen = c.aristas.find((x) => x.from === arriba && x.to === abajo && (x.tipo === 'generaliza' || x.tipo === 'requiere'))
    if (gen) { ok++; aristas.push({ from: arriba, to: abajo, tipo: gen.tipo }) }
  }
  if (ok === ids.length - 1) {
    return {
      ...v, estado: 'sostenido', fichas: 10 * ok + lentes.fichasPorSostenido, mult: 1.1 * ok,
      nota: 'La contención categórica se sostiene de arriba abajo.', conceptIds: ids, aristas
    }
  }
  if (ok > 0) return { ...v, estado: 'parcial', fichas: 5 * ok, nota: 'Parte de la jerarquía se sostiene.', conceptIds: ids, aristas }
  const alReves = c.aristas.some((x) => x.from === ids[1] && x.to === ids[0] && x.tipo === 'generaliza')
  return alReves
    ? { ...v, estado: 'invertido', mult: -1, nota: `«${titulo(c, ids[1])}» es la categoría, no lo contrario.`, conceptIds: ids }
    : { ...v, nota: 'El texto no establece esa contención.' }
}

function validarEje(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'relacion')
  if (!t.param) return { ...v, nota: 'Elige un eje y un extremo.' }
  const [ejeId, valor] = t.param.split('::')
  const eje = c.ejes.find((e) => e.id === ejeId)
  if (!eje) return { ...v, nota: 'Este texto no trae ese eje.' }
  if (ps.some((p) => !nodoValido(p))) {
    return { ...v, estado: 'error', nota: ps.find((p) => !nodoValido(p))!.explicacion }
  }
  const ids = ps.map((p) => p.conceptId).filter((x): x is string => !!x)
  if (ids.length < 2) return { ...v, nota: 'Coloca al menos dos piezas en el eje.' }
  const aciertos = ids.filter((id) => String(eje.valores[id] ?? '') === valor)
  if (aciertos.length === ids.length) {
    return {
      ...v, estado: 'sostenido', fichas: 9 * ids.length + lentes.fichasPorSostenido,
      mult: 1.2 + 0.2 * ids.length,
      nota: `Todos son «${valor}» en el eje ${eje.nombre}.`, conceptIds: ids
    }
  }
  if (aciertos.length) {
    return {
      ...v, estado: 'parcial', fichas: 4 * aciertos.length,
      nota: `${ids.length - aciertos.length} de esas piezas están en el otro extremo de ${eje.nombre}.`,
      conceptIds: aciertos
    }
  }
  return { ...v, estado: 'invertido', mult: -1, nota: `Ninguno es «${valor}» en ${eje.nombre}.`, conceptIds: ids }
}

function validarSecuencia(c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'estructura')
  if (ps.some((p) => !nodoValido(p))) {
    return { ...v, estado: 'error', nota: ps.find((p) => !nodoValido(p))!.explicacion }
  }
  const ids = ps.map((p) => p.conceptId).filter((x): x is string => !!x)
  if (ids.length < 3) return { ...v, nota: 'Una secuencia necesita tres pasos.' }
  const aristas: Diagnostico['aristas'] = []
  let ok = 0
  for (let i = 0; i + 1 < ids.length; i++) {
    const paso = c.aristas.find((x) => x.from === ids[i] && x.to === ids[i + 1] && (x.tipo === 'causa' || x.tipo === 'requiere'))
    if (paso) { ok++; aristas.push({ from: ids[i], to: ids[i + 1], tipo: paso.tipo }) }
  }
  if (ok === ids.length - 1) {
    return {
      ...v, estado: 'sostenido', fichas: 12 * ok + lentes.fichasPorSostenido, mult: 1.4 * ok,
      nota: 'El proceso ocurre en ese orden.', conceptIds: ids, aristas
    }
  }
  if (ok > 0) return { ...v, estado: 'parcial', fichas: 6 * ok, nota: 'Parte del orden se sostiene.', conceptIds: ids, aristas }
  return { ...v, nota: 'El texto no encadena esos pasos así.' }
}

function validarAncla(_c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'transferencia')
  const caso = ps.find((p) => p.clase === 'caso')
  const resto = ps.filter((p) => p !== caso)
  if (!caso) return { ...v, nota: 'El ancla necesita un caso.' }
  if (resto.some((p) => !nodoValido(p))) {
    return { ...v, estado: 'error', nota: resto.find((p) => !nodoValido(p))!.explicacion }
  }
  const ids = resto.map((p) => p.conceptId).filter((x): x is string => !!x)
  if (!ids.length) return { ...v, nota: 'Ancla el caso a los conceptos que operan en él.' }
  const aciertos = ids.filter((id) => caso.conceptIds.includes(id))
  const m = caso.distancia === 'lejana' ? 2.2 : caso.distancia === 'media' ? 1.6 : 1.1
  if (aciertos.length === ids.length) {
    return {
      ...v, estado: 'sostenido', fichas: 10 * ids.length + 8 + lentes.fichasPorSostenido,
      mult: m + 0.2 * ids.length, nota: caso.cierre, conceptIds: ids
    }
  }
  if (aciertos.length) {
    return {
      ...v, estado: 'parcial', fichas: 5 * aciertos.length, mult: m * 0.5,
      nota: `${ids.length - aciertos.length} de esos conceptos no operan en este caso. ${caso.cierre}`,
      conceptIds: aciertos
    }
  }
  return { ...v, estado: 'invertido', mult: -1, nota: `Ninguno opera ahí. ${caso.cierre}`, conceptIds: ids }
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

function validarTachon(_c: Contenido, t: Trazo, ps: Pieza[], lentes: ModificadoresLente): Veredicto {
  const v = vacio(t, 'discriminacion')
  const p = ps[0]
  if (!p) return v
  if (p.clase === 'apocrifa') {
    return {
      ...v, estado: 'sostenido', fichas: 16 + lentes.fichasPorSostenido, mult: 1.5,
      nota: `Bien visto. ${p.explicacion}`,
      conceptIds: p.conceptId ? [p.conceptId] : [], apocrifaDetectada: p.conceptId
    }
  }
  if (p.clase === 'criterio' && p.sentido !== 'refuta') {
    return {
      ...v, estado: 'sostenido', fichas: 14 + lentes.fichasPorSostenido, mult: 1.3,
      nota: `Bien visto. ${p.explicacion}`
    }
  }
  return {
    ...v, estado: 'error', mult: -0.5,
    nota: `«${p.titulo}» era legítima: el texto la sostiene tal como está.`,
    conceptIds: p.conceptId ? [p.conceptId] : []
  }
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
  tachon: validarTachon
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

  const sostenidos = veredictos.filter((v) => v.estado === 'sostenido')
  const errores = veredictos.filter((v) => v.estado === 'error')
  const invertidos = veredictos.filter((v) => v.estado === 'invertido')

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

  if (errores.length) { fichas = Math.round(fichas * 0.35); mult = Math.max(0.3, mult * 0.5) }
  mult = Math.max(0, mult + (errores.length ? 0 : lentes.multGlobal))

  const dano = Math.max(0, Math.round(fichas * mult))
  const dims = [...new Set(sostenidos.map((v) => v.dimension))]

  return {
    veredictos, combos, fichas, mult, dano,
    alcance: Math.min(4, 1 + Math.floor(sostenidos.length / 1.5) + lentes.alcanceExtra),
    sostenidos: sostenidos.length,
    errores: errores.length,
    invertidos: invertidos.length,
    dimensiones: dims,
    conceptIds: [...new Set(veredictos.flatMap((v) => v.conceptIds))],
    aristas: sostenidos.flatMap((v) => v.aristas),
    fusiona: [...new Set(sostenidos.flatMap((v) => v.fusiona))],
    apocrifasDetectadas: sostenidos.map((v) => v.apocrifaDetectada).filter((x): x is string => !!x),
    repertoriosReubicados: sostenidos.map((v) => v.repertorioReubicado).filter((x): x is string => !!x),
    autodano: errores.length * 5 + invertidos.length * 3,
    cierre: sostenidos.length ? sostenidos[sostenidos.length - 1].nota : null
  }
}

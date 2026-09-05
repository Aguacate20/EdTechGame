import type { Contenido } from '../content/types'

/* ==========================================================================
   Semántica del grafo.
   El juego no puede exigir que el estudiante recuerde la etiqueta exacta de
   cada vínculo. Puede exigir que lo que afirma sea VERDAD. Este módulo separa
   las dos cosas: qué tipos son equivalentes, cuáles son de la misma familia,
   y qué se sigue del texto aunque el texto no lo diga con esas palabras.
   ========================================================================== */

/** Tipos cuya dirección no importa: afirmarlos al revés no es un error. */
export const SIMETRICOS = new Set(['contrasta'])

/** Pares duales: si el texto dice A→B con uno, B→A con el otro es igual de cierto. */
export const DUALES: Record<string, string> = {
  generaliza: 'ejemplifica',
  ejemplifica: 'generaliza'
}

/** Familias: dentro de una familia el matiz cambia, la dirección no.
 *  Confundir «apoya» con «extiende» es impreciso, no falso. */
export const FAMILIAS: Record<string, string> = {
  apoya: 'respaldo',
  extiende: 'respaldo',
  matiza: 'respaldo',
  causa: 'dependencia',
  requiere: 'dependencia',
  generaliza: 'taxonomia',
  ejemplifica: 'taxonomia',
  contrasta: 'oposicion'
}

/** Tipos que NO se excluyen entre sí.
 *  Los vínculos no son alternativas: si un texto dice que A extiende B, también
 *  es cierto que A requiere B, porque no se amplía lo que no existe. El
 *  extractor emite un tipo por par, pero el par puede sostener varios a la vez.
 *  Aquí: si el texto dice la clave, lo que el jugador afirme de la lista es
 *  igual de verdadero, no un matiz peor.
 *  La dirección importa: extender presupone, pero requerir no amplía. */
export const IMPLICA: Record<string, string[]> = {
  extiende: ['requiere'],
  ejemplifica: ['apoya'],
  matiza: ['contrasta'],
  generaliza: ['requiere']
}

export const razonDeCompatible: Record<string, string> = {
  requiere: 'no se amplía ni se especializa lo que no está antes: si lo extiende, lo necesita',
  apoya: 'un caso concreto respalda aquello de lo que es caso',
  contrasta: 'precisar los límites de algo es una forma de distinguirlo'
}

/** Tipos donde invertir la dirección SÍ es un error conceptual grave. */
export const ANTISIMETRICOS = new Set(['causa', 'requiere', 'generaliza', 'ejemplifica'])

export const familiaDe = (tipo: string): string => FAMILIAS[tipo] ?? tipo
export const mismaFamilia = (a: string, b: string): boolean => familiaDe(a) === familiaDe(b)

export interface Camino {
  pasos: { from: string; to: string; tipo: string }[]
}

/** ¿Se sigue A→B de dos vínculos que el texto sí afirma?
 *  Solo se admiten cadenas coherentes: causa·causa, requiere·requiere,
 *  generaliza·generaliza y apoya·apoya. Una cadena mixta no transmite nada. */
const TRANSITIVOS: Record<string, string[]> = {
  causa: ['causa'],
  requiere: ['requiere'],
  generaliza: ['generaliza'],
  ejemplifica: ['ejemplifica'],
  apoya: ['apoya', 'extiende']
}

export function derivacion(c: Contenido, from: string, to: string, tipo: string): Camino | null {
  const admitidos = TRANSITIVOS[tipo]
  if (!admitidos) return null
  const primeros = c.aristas.filter((a) => a.from === from && admitidos.includes(a.tipo))
  for (const p1 of primeros) {
    const p2 = c.aristas.find((a) => a.from === p1.to && a.to === to && admitidos.includes(a.tipo))
    if (p2) return { pasos: [p1, p2] }
  }
  // tres pasos: la cadena se debilita, pero sigue siendo una inferencia legítima
  for (const p1 of primeros) {
    for (const p2 of c.aristas.filter((a) => a.from === p1.to && admitidos.includes(a.tipo))) {
      const p3 = c.aristas.find((a) => a.from === p2.to && a.to === to && admitidos.includes(a.tipo))
      if (p3) return { pasos: [p1, p2, p3] }
    }
  }
  return null
}

/** ¿El texto los trata JUNTOS aunque no enuncie el vínculo?
 *  Un caso, un escenario, una tesis o un marco que menciona a los dos es
 *  evidencia real de que el autor los pone en la misma escena. No es lo mismo
 *  que afirmar la relación, pero está muy por encima de la casualidad: aquí es
 *  donde antes se perdían las conexiones legítimas que el grafo no recoge. */
/** ¿La definición de `a` menciona el título (o un sinónimo) de `b`? */
/** Gemelos: dos conceptos que son el mismo con distinto nombre (bilingües o
 *  variantes que la canonicalización no fundió). Uno es gemelo del otro si su
 *  título coincide o aparece entre los sinónimos del otro. */
export function gemelosDe(c: Contenido, id: string): string[] {
  const k = c.conceptos[id]
  if (!k) return []
  const mios = new Set([k.titulo, ...(k.sinonimos ?? [])].map((x) => x.toLowerCase()))
  return c.ordenConceptos.filter((otro) => {
    if (otro === id) return false
    const o = c.conceptos[otro]
    if (!o) return false
    const suyos = [o.titulo, ...(o.sinonimos ?? [])].map((x) => x.toLowerCase())
    return suyos.some((n) => n.length >= 5 && mios.has(n))
  })
}

export function definicionNombra(c: Contenido, a: string, b: string): string | null {
  const ka = c.conceptos[a], kb = c.conceptos[b]
  if (!ka || !kb) return null
  const texto = `${ka.definicion} ${ka.definicionCorta ?? ''}`.toLowerCase()
  const nombres = [kb.titulo, ...(kb.sinonimos ?? [])]
    .filter((n) => n && n.length >= 5)
  const hallado = nombres.find((n) => texto.includes(n.toLowerCase()))
  return hallado
    ? `La definición de «${ka.titulo}» nombra a «${kb.titulo}»: el autor los enlaza al definir, aunque no diga de qué tipo es el vínculo.`
    : null
}

export function convivencia(c: Contenido, a: string, b: string): string | null {
  const caso = c.casos.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b))
  if (caso) return `El texto los pone a operar juntos en el mismo caso: ${caso.descripcion.slice(0, 120)}…`

  const esc = c.escenarios.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b))
  if (esc) return `Los dos operan en la misma situación (${esc.dominio}): ${esc.descripcion.slice(0, 110)}…`

  const t = c.tesis.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b))
  if (t) return `La misma tesis del texto se apoya en los dos: «${t.enunciado.slice(0, 120)}…»`

  const m = c.marcos.find((k) => k.conceptIds.includes(a) && k.conceptIds.includes(b))
  if (m) return `Los dos pertenecen al mismo marco teórico (${m.etiqueta}).`

  return null
}

/** Compartir página es señal débil: en un texto denso casi todo comparte página.
 *  No sube a «convive», pero sí mejora el mensaje de «plausible». */
export function mismaPagina(c: Contenido, a: string, b: string): number[] {
  const pa = c.conceptos[a]?.paginas ?? []
  const pb = c.conceptos[b]?.paginas ?? []
  return pa.filter((x) => pb.includes(x))
}

/** ¿Están cerca en el grafo aunque no haya vínculo directo?
 *  Vecino común o mismo cluster: afirmar algo entre ellos es plausible,
 *  no absurdo, y no debe castigarse. */
export function proximidad(c: Contenido, a: string, b: string): 'vecino_comun' | 'mismo_cluster' | null {
  const vec = (id: string) => new Set(
    c.aristas.filter((x) => x.from === id || x.to === id).map((x) => (x.from === id ? x.to : x.from))
  )
  const va = vec(a), vb = vec(b)
  for (const x of va) if (vb.has(x)) return 'vecino_comun'
  const ca = c.conceptos[a]?.clusterId
  const cb = c.conceptos[b]?.clusterId
  if (ca && cb && ca === cb) return 'mismo_cluster'
  return null
}

export interface Hallazgo {
  estado: 'sostenida' | 'equivalente' | 'compatible' | 'aproximada' | 'derivada' | 'convive' | 'plausible' | 'muda' | 'invertida'
  tipoReal: string | null
  nota: string
  camino: Camino | null
}

/** El corazón del arreglo: una escalera de veredictos en vez de acierto/error.
 *  Mantiene la cientificidad —solo se premia lo que el texto sostiene o lo que
 *  se sigue de él— y deja de exigir memoria de etiquetas. */
/** ¿Merece guardarse como propuesta del lector?
 *  Solo si los dos conceptos están CERCA en el grafo. Una corazonada entre dos
 *  cosas que no tienen nada que ver no es una lectura crítica, es ruido, y si
 *  todo entrara la capa propia acabaría siendo un basurero sin significado. */
export function admisibleComoPropuesta(c: Contenido, a: string, b: string): string | null {
  const cerca = proximidad(c, a, b)
  if (cerca === 'vecino_comun') return 'ambos cuelgan de un mismo concepto'
  if (cerca === 'mismo_cluster') return 'están en la misma zona del texto'
  // compartir página NO basta para guardarla: en un texto denso casi todo
  // comparte página, y la capa propia acabaría siendo un listado sin sentido.
  // Sigue puntuando en combate, pero no se anota.
  return null
}

export function juzgarVinculo(
  c: Contenido, from: string, to: string, tipo: string
): Hallazgo {
  const T = (id: string) => c.conceptos[id]?.titulo ?? id
  const directa = c.aristas.filter((x) => x.from === from && x.to === to)
  const inversa = c.aristas.filter((x) => x.from === to && x.to === from)

  const exacta = directa.find((x) => x.tipo === tipo)
  if (exacta) return { estado: 'sostenida', tipoReal: exacta.tipo, nota: exacta.descripcion, camino: null }

  // simétricos: la dirección no importa
  if (SIMETRICOS.has(tipo)) {
    const sim = inversa.find((x) => x.tipo === tipo)
    if (sim) {
      return {
        estado: 'equivalente', tipoReal: tipo,
        nota: `${sim.descripcion} (Contrastar no tiene dirección: da igual desde cuál lo mires.)`,
        camino: null
      }
    }
  }
  // duales: generaliza ↔ ejemplifica
  const dual = DUALES[tipo]
  if (dual) {
    const d = inversa.find((x) => x.tipo === dual)
    if (d) {
      return {
        estado: 'equivalente', tipoReal: dual,
        nota: `${d.descripcion} (El texto lo dice como «${T(to)} ${dual} ${T(from)}»: es la misma afirmación vista del otro lado.)`,
        camino: null
      }
    }
  }
  // el texto lo dice de otro modo, pero lo tuyo TAMBIÉN es cierto
  const compatible = directa.find((x) => (IMPLICA[x.tipo] ?? []).includes(tipo))
  if (compatible) {
    return {
      estado: 'compatible', tipoReal: compatible.tipo, camino: null,
      nota: `El texto lo enuncia como «${compatible.tipo}», pero lo tuyo también se sostiene: ` +
        `${razonDeCompatible[tipo] ?? 'las dos cosas son ciertas del mismo par'}. ` +
        `${compatible.descripcion}`
    }
  }

  // misma familia en la misma dirección: impreciso, no falso
  const pariente = directa.find((x) => mismaFamilia(x.tipo, tipo))
  if (pariente) {
    return {
      estado: 'aproximada', tipoReal: pariente.tipo,
      nota: `Vas bien: el texto lo dice como «${pariente.tipo}». ${pariente.descripcion}`,
      camino: null
    }
  }
  if (directa.length) {
    return {
      estado: 'aproximada', tipoReal: directa[0].tipo,
      nota: `El vínculo existe, pero es de otra clase: «${directa[0].tipo}». ${directa[0].descripcion}`,
      camino: null
    }
  }
  // se sigue de dos vínculos que sí están: es inferencia, no memoria
  const der = derivacion(c, from, to, tipo)
  if (der) {
    return {
      estado: 'derivada', tipoReal: tipo, camino: der,
      nota: `El texto no lo dice directamente, pero se sigue: ${T(der.pasos[0].from)} ${der.pasos[0].tipo} ${T(der.pasos[0].to)} ${der.pasos[1].tipo} ${T(der.pasos[1].to)}.`
    }
  }
  // invertida: solo es error si el tipo tiene dirección
  const invExacta = inversa.find((x) => x.tipo === tipo)
  if (invExacta && ANTISIMETRICOS.has(tipo)) {
    return {
      estado: 'invertida', tipoReal: tipo, camino: null,
      nota: `Va al contrario: el texto dice «${T(to)} ${tipo} ${T(from)}». ${invExacta.descripcion}`
    }
  }
  if (inversa.length && ANTISIMETRICOS.has(inversa[0].tipo) && ANTISIMETRICOS.has(tipo)) {
    return {
      estado: 'invertida', tipoReal: inversa[0].tipo, camino: null,
      nota: `Hay vínculo, pero en la otra dirección y como «${inversa[0].tipo}».`
    }
  }
  if (inversa.length) {
    return {
      estado: 'aproximada', tipoReal: inversa[0].tipo, camino: null,
      nota: `El texto los relaciona, pero desde el otro lado: «${T(to)} ${inversa[0].tipo} ${T(from)}».`
    }
  }
  // gemelos: si el texto lo afirma del mismo concepto bajo OTRO nombre,
  // el vínculo se sostiene — la traducción no puede costar puntos
  for (const [f2, t2] of [
    ...gemelosDe(c, from).map((g) => [g, to] as const),
    ...gemelosDe(c, to).map((g) => [from, g] as const)
  ]) {
    const ex = c.aristas.find((x) => x.from === f2 && x.to === t2 && x.tipo === tipo)
    const sim = SIMETRICOS.has(tipo) && c.aristas.find((x) => x.from === t2 && x.to === f2 && x.tipo === tipo)
    const du = DUALES[tipo] && c.aristas.find((x) => x.from === t2 && x.to === f2 && x.tipo === DUALES[tipo])
    const hit = ex || sim || du
    if (hit) {
      return {
        estado: 'compatible', tipoReal: hit.tipo, camino: null,
        nota: `El texto lo afirma de «${T(f2)} → ${T(t2)}»: el mismo concepto con otro nombre. ${hit.descripcion}`
      }
    }
    const fam = c.aristas.find((x) => x.from === f2 && x.to === t2 && mismaFamilia(x.tipo, tipo))
    if (fam) {
      return {
        estado: 'aproximada', tipoReal: fam.tipo, camino: null,
        nota: `Bajo su otro nombre, el texto lo dice como «${fam.tipo}». ${fam.descripcion}`
      }
    }
  }

  // el texto los trata juntos aunque no enuncie el vínculo
  const juntos = convivencia(c, from, to)
  if (juntos) {
    return { estado: 'convive', tipoReal: null, camino: null, nota: juntos }
  }
  // la definición de uno NOMBRA al otro: el autor los enlaza al definir,
  // aunque no enuncie el tipo. Eso es evidencia textual, no una corazonada.
  const nombra = definicionNombra(c, from, to) ?? definicionNombra(c, to, from)
  if (nombra) {
    return { estado: 'convive', tipoReal: null, camino: null, nota: nombra }
  }
  // puente latente: el extractor ya juzgó que el texto los deja implícitamente
  // conectados, con su justificación. La creatividad que ES verdadera, paga.
  const puente = c.puentes[from < to ? `${from}|${to}` : `${to}|${from}`]
  if (puente) {
    return {
      estado: 'convive', tipoReal: null, camino: null,
      nota: `El texto los deja conectados sin decirlo: ${puente}`
    }
  }
  // co-ocurrencia medida: el autor los hace aparecer juntos una y otra vez
  if (c.coocurrencias.has(from < to ? `${from}|${to}` : `${to}|${from}`)) {
    return {
      estado: 'convive', tipoReal: null, camino: null,
      nota: 'El autor los hace aparecer juntos una y otra vez a lo largo del texto, aunque nunca enuncie el vínculo.'
    }
  }
  // cerca en el grafo: plausible, sin castigo
  const cerca = proximidad(c, from, to)
  const paginas = mismaPagina(c, from, to)
  if (cerca) {
    return {
      estado: 'plausible', tipoReal: null, camino: null,
      nota: cerca === 'vecino_comun'
        ? 'Esto lo pones tú: el autor no los enlaza, pero los dos cuelgan de lo mismo. Queda anotado en tu lectura.'
        : 'Esto lo pones tú: el autor los deja en la misma zona sin llegar a enlazarlos. Queda anotado en tu lectura.'
    }
  }
  if (paginas.length) {
    return {
      estado: 'plausible', tipoReal: null, camino: null,
      nota: `Esto lo pones tú: el autor los expone juntos en la página ${paginas.join(', ')} pero no da el paso. Queda anotado en tu lectura.`
    }
  }
  return { estado: 'muda', tipoReal: null, camino: null, nota: 'El texto no afirma nada entre esos dos.' }
}

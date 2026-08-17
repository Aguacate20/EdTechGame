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
  return null
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
  estado: 'sostenida' | 'equivalente' | 'aproximada' | 'derivada' | 'plausible' | 'muda' | 'invertida'
  tipoReal: string | null
  nota: string
  camino: Camino | null
}

/** El corazón del arreglo: una escalera de veredictos en vez de acierto/error.
 *  Mantiene la cientificidad —solo se premia lo que el texto sostiene o lo que
 *  se sigue de él— y deja de exigir memoria de etiquetas. */
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
  // cerca en el grafo: plausible, sin castigo
  const cerca = proximidad(c, from, to)
  if (cerca) {
    return {
      estado: 'plausible', tipoReal: null, camino: null,
      nota: cerca === 'vecino_comun'
        ? 'El texto no los conecta entre sí, pero ambos se conectan con lo mismo: la intuición no era descabellada.'
        : 'Son de la misma zona del texto, aunque el autor no los enlaza.'
    }
  }
  return { estado: 'muda', tipoReal: null, camino: null, nota: 'El texto no afirma nada entre esos dos.' }
}

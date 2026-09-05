import type { Atlas } from './atlas'
import type { EstadoBatalla } from './battle'

/* ==========================================================================
   Hazañas. La mitad de las lentes nacen bloqueadas y cada una se desbloquea
   cumpliendo una conducta cognitiva concreta. El grind de colección y la
   señal de aprendizaje son la misma cosa: perseguir la lente ES practicar
   la conducta. La Vitrina del inicio muestra lo que falta.
   ========================================================================== */

export interface Hazana {
  id: string
  nombre: string
  /** qué hay que hacer, dicho como reto */
  reto: string
  /** lente que desbloquea (id de powers.LENTES) */
  lenteId: string
  /** se evalúa al cerrar cada sala, sobre la sala y el Atlas acumulado */
  cumplida: (b: EstadoBatalla, a: Atlas) => boolean
  /** progreso 0..1 para la vitrina y la pantalla de fin */
  progreso: (b: EstadoBatalla | null, a: Atlas) => number
}

export const HAZANAS: Hazana[] = [
  {
    id: 'traductor', nombre: 'Entre dos reinos',
    reto: 'Sostén una Analogía: A es a B lo que C es a D.',
    lenteId: 'traductor',
    cumplida: (b) => b.hallazgos.vinculos.some((v) => v.herramienta === 'analogia') ||
      b.combosVistos.includes('traduccion'),
    progreso: (_b, a) => Object.values(a.conceptos).some((c) => c.mecanicas.includes('analogia')) ? 1 : 0
  },
  {
    id: 'inquisidor', nombre: 'Ojo de fuego',
    reto: 'Quema tres falsificaciones en una misma sala, sin fallar ninguna.',
    lenteId: 'inquisidor',
    cumplida: (b) => b.quemasAcertadas >= 3 && !b.pozo.some((p) => p.accion === 'quemar' && !p.acertado),
    progreso: (b) => Math.min(1, (b?.quemasAcertadas ?? 0) / 3)
  },
  {
    id: 'deductor', nombre: 'Lo que se sigue',
    reto: 'Cierra una sala con tres inferencias (vínculos derivados, no leídos).',
    lenteId: 'deductor',
    cumplida: (b) => b.inferenciasTotales >= 3,
    progreso: (b) => Math.min(1, (b?.inferenciasTotales ?? 0) / 3)
  },
  {
    id: 'arquitecto', nombre: 'El plano completo',
    reto: 'Enciende un Cierre y una Articulación en la misma sala.',
    lenteId: 'arquitecto',
    cumplida: (b) => b.combosVistos.includes('cierre') && b.combosVistos.includes('articulacion'),
    progreso: (b) => ((b?.combosVistos.includes('cierre') ? 1 : 0) +
      (b?.combosVistos.includes('articulacion') ? 1 : 0)) / 2
  },
  {
    id: 'temerario', nombre: 'Palabra empeñada',
    reto: 'Sella tres diagramas en una sala y que los tres se sostengan enteros.',
    lenteId: 'temerario',
    cumplida: (b) => b.sellosHechos >= 3 && b.sellosAcertados === b.sellosHechos,
    progreso: (b) => b && b.sellosHechos === b.sellosAcertados ? Math.min(1, b.sellosHechos / 3) : 0
  },
  {
    id: 'abogado', nombre: 'El caso cerrado',
    reto: 'Cumple un encargo de nivel 3.',
    lenteId: 'abogado',
    cumplida: (b, a) => a.srl.encargosCumplidos > 0 && b.encargo?.nivel === 3,
    progreso: (_b, a) => Math.min(1, a.srl.nivelAcumulado / 6)
  },
  {
    id: 'artillero', nombre: 'Un solo golpe',
    reto: 'Haz 400 o más de daño con un solo diagrama.',
    lenteId: 'artillero',
    cumplida: (b) => b.mejorGolpe.dano >= 400,
    progreso: (b, a) => Math.min(1, Math.max(b?.mejorGolpe.dano ?? 0,
      ...(a.mejoresDiagramas.length ? a.mejoresDiagramas : [0])) / 400)
  },
  {
    id: 'escriba', nombre: 'La pluma propia',
    reto: 'Anota cinco propuestas tuyas: conexiones que el texto no hace y tú sí.',
    lenteId: 'escriba',
    cumplida: (_b, a) => Object.keys(a.propuestas).length >= 5,
    progreso: (_b, a) => Math.min(1, Object.keys(a.propuestas).length / 5)
  }
  ,{
    id: 'catedral', nombre: 'La bóveda entera',
    reto: 'Enciende una Constelación con el diagrama sellado: cuatro sostenidas, cero errores, y tu palabra encima.',
    lenteId: 'catedral',
    cumplida: (b) => b.selladoConstelacion,
    progreso: (b) => b?.selladoConstelacion ? 1 : (b?.combosVistos.includes('constelacion') ? 0.5 : 0)
  },
  {
    id: 'aleph', nombre: 'Todo a la vez',
    reto: 'Haz 2.000 de daño o más con un solo diagrama.',
    lenteId: 'aleph',
    cumplida: (b) => b.mejorGolpe.dano >= 2000,
    progreso: (b, a) => Math.min(1, Math.max(b?.mejorGolpe.dano ?? 0,
      ...(a.mejoresDiagramas.length ? a.mejoresDiagramas : [0])) / 2000)
  }
]

/** Lentes que nacen bloqueadas: no salen en el botín hasta cumplir la hazaña. */
export const LENTES_BLOQUEADAS = HAZANAS.map((h) => h.lenteId)

export const lentesVetadas = (a: Atlas): string[] =>
  LENTES_BLOQUEADAS.filter((id) => !a.hazanas.includes(HAZANAS.find((h) => h.lenteId === id)!.id))

/** Se llama al cerrar cada sala. Devuelve las hazañas recién cumplidas. */
export function evaluarHazanas(b: EstadoBatalla, a: Atlas): Hazana[] {
  return HAZANAS.filter((h) => !a.hazanas.includes(h.id) && h.cumplida(b, a))
}

/** Para la pantalla de fin: la hazaña pendiente con más progreso. */
export function hazanaMasCercana(b: EstadoBatalla | null, a: Atlas): { h: Hazana; p: number } | null {
  const pendientes = HAZANAS.filter((h) => !a.hazanas.includes(h.id))
    .map((h) => ({ h, p: h.progreso(b, a) }))
    .sort((x, y) => y.p - x.p)
  return pendientes[0] ?? null
}

/* ==========================================================================
   Condiciones de sala. El equivalente de los «boss blinds»: las casillas
   duras y el jefe anuncian una regla que cambia cómo RINDE el trabajo, nunca
   qué es verdad (regla 2: modulan la recompensa, no la corrección).
   ========================================================================== */

export interface CondicionSala {
  id: string
  nombre: string
  glosa: string
}

export const CONDICIONES: CondicionSala[] = [
  {
    id: 'cadena', nombre: 'Cadena',
    glosa: 'Una frase suelta no abre camino: los diagramas de un solo trazo rinden el 40 %.'
  },
  {
    id: 'monocultivo', nombre: 'Monocultivo',
    glosa: 'Aquí las identidades no hieren: todo el daño sale de relacionar y estructurar. Emparejar sigue fusionando.'
  },
  {
    id: 'marco_rival', nombre: 'Marco rival',
    glosa: 'La sala premia la oposición: cada contraste sostenido añade +0.5 al multiplicador.'
  }
]

export const condicionPorId = (id: string | null | undefined): CondicionSala | null =>
  CONDICIONES.find((c) => c.id === id) ?? null

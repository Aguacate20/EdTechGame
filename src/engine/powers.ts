import type { HerramientaId, ModificadoresLente } from './tools'
import { SIN_LENTES } from './tools'

/* ==========================================================================
   Los poderes.
   Tres capas que nunca compiten entre sí:
     · LENTES   — pasivas siempre activas, cada una sobre un eje distinto
     · SELLOS   — activos de un uso por combate
     · HERRAMIENTAS — nuevas piezas del cinturón, que amplían lo que puedes afirmar
   El diseño busca que dos runs con lentes distintas se jueguen distinto, no
   que una sea mejor: por eso cada lente da algo y quita algo.
   ========================================================================== */

export type Rareza = 'comun' | 'rara' | 'unica'

export interface Lente {
  id: string
  nombre: string
  regla: string
  costo: string
  rareza: Rareza
  precio: number
  mod: Partial<ModificadoresLente>
}

export const LENTES: Lente[] = [
  /* ---- eje: tipo de relación ---- */
  { id: 'disidente', nombre: 'Lente del disidente', rareza: 'comun', precio: 10,
    regla: 'Los contrastes multiplican mucho más.',
    costo: 'Los apoyos, la relación más común, dejan de rendir.',
    mod: { multPorTipo: { contrasta: 1.6, apoya: -0.3 } } },
  { id: 'causalista', nombre: 'Lente causalista', rareza: 'comun', precio: 10,
    regla: 'Causa, requisito y secuencias rinden más.',
    costo: 'Es fácil confundir causa con correlación y afirmar al revés.',
    mod: { multPorTipo: { causa: 0.9, requiere: 0.9 }, multPorHerramienta: { secuencia: 1 } } },
  { id: 'taxonomo', nombre: 'Lente del taxónomo', rareza: 'comun', precio: 10,
    regla: 'Generalizar y ejemplificar multiplican, y la jerarquía rinde más.',
    costo: 'Son las relaciones más escasas de casi cualquier texto.',
    mod: { multPorTipo: { generaliza: 1.1, ejemplifica: 1.1 }, multPorHerramienta: { jerarquia: 0.9 } } },

  /* ---- eje: herramienta ---- */
  { id: 'topografo', nombre: 'Lente del topógrafo', rareza: 'comun', precio: 10,
    regla: 'Campos semánticos y ejes valen mucho más.',
    costo: 'Exige haber entendido cómo está dividido el texto.',
    mod: { multPorHerramienta: { campo: 1.2, eje: 1.2 } } },
  { id: 'lexicografo', nombre: 'Lente del lexicógrafo', rareza: 'comun', precio: 9,
    regla: 'Emparejar nombre y descripción rinde el triple.',
    costo: 'Reconocer no es relacionar: llena poco Atlas.',
    mod: { multPorHerramienta: { identidad: 1.4 }, fichasPorSostenido: 3 } },
  { id: 'traductor', nombre: 'Lente del traductor', rareza: 'comun', precio: 11,
    regla: 'Las anclas de caso valen mucho más.',
    costo: 'Los casos ocupan sitio y exigen saber qué opera en ellos.',
    mod: { multPorHerramienta: { ancla: 1.4 } } },
  { id: 'abogado', nombre: 'Lente del abogado', rareza: 'rara', precio: 14,
    regla: 'La balanza rinde muchísimo más.',
    costo: 'Solo hay unas pocas tesis en todo el texto.',
    mod: { multPorHerramienta: { balanza: 2 } } },

  /* ---- eje: combos y estructura ---- */
  { id: 'arquitecto', nombre: 'Lente del arquitecto', rareza: 'rara', precio: 14,
    regla: 'Articulación y constelación escalan mucho más.',
    costo: 'Premia diagramas grandes, y un error los penaliza enteros.',
    mod: { multPorCombo: { articulacion: 1, constelacion: 1.5 } } },
  { id: 'umbral', nombre: 'Lente del umbral', rareza: 'comun', precio: 10,
    regla: 'Cada concepto umbral del diagrama suma bastante más.',
    costo: 'Los umbrales son los más difíciles de definir bien.',
    mod: { multPorUmbral: 0.6 } },
  { id: 'artillero', nombre: 'Lente del artillero', rareza: 'rara', precio: 13,
    regla: 'Tu afirmación alcanza a dos enemigos más del carril.',
    costo: 'Reparte el daño en vez de concentrarlo.',
    mod: { alcanceExtra: 2 } },

  /* ---- eje: mano y herramientas ---- */
  { id: 'fichero', nombre: 'Fichero ampliado', rareza: 'comun', precio: 12,
    regla: 'Robas dos cartas más cada turno.',
    costo: 'Ninguno. Externalizar la memoria es legítimo.',
    mod: { manoExtra: 2 } },
  { id: 'cinturon', nombre: 'Cinturón del cartógrafo', rareza: 'rara', precio: 15,
    regla: 'Una flecha y un campo extra por turno.',
    costo: 'Más trazos también significan más formas de equivocarse.',
    mod: { herramientasExtra: ['flecha', 'campo'] as HerramientaId[] } },
  { id: 'mano_rapida', nombre: 'Mano rápida', rareza: 'comun', precio: 8,
    regla: 'Dos cambios más por combate.',
    costo: 'Ninguno. Gestionar la mano es una habilidad, no una trampa.',
    mod: { cambiosExtra: 2 } },
  { id: 'impulso', nombre: 'Impulso', rareza: 'rara', precio: 13,
    regla: 'Cada trazo sostenido te hace robar una carta.',
    costo: 'El mazo se recicla antes y las apócrifas vuelven antes.',
    mod: { robarPorAcierto: 1 } },

  /* ---- eje: discriminación y tinta ---- */
  { id: 'inquisidor', nombre: 'Lente del inquisidor', rareza: 'comun', precio: 10,
    regla: 'Quemar falsificaciones da mucha más tinta y una quema extra por combate.',
    costo: 'No mejora ninguna afirmación: solo tu ojo para las falsas.',
    mod: { tintaPorQuema: 4, quemasExtra: 1 } },
  { id: 'ojo_critico', nombre: 'Ojo crítico', rareza: 'rara', precio: 14,
    regla: 'Al empezar cada combate, dos falsificaciones aparecen marcadas.',
    costo: 'Te acostumbras a que te las señalen.',
    mod: { revelaApocrifas: 2, quemasExtra: 1 } },
  { id: 'imprenta', nombre: 'Imprenta', rareza: 'comun', precio: 9,
    regla: 'Cada combate rinde bastante más tinta.',
    costo: 'No mejora ninguna jugada: solo tu bolsillo.',
    mod: { tintaPorCombate: 8 } },

  /* ---- eje: la escalera de veredictos ---- */
  { id: 'deductor', nombre: 'Lente del deductor', rareza: 'rara', precio: 15,
    regla: 'Lo que deduces sin que el texto lo diga rinde casi como lo literal, y da tinta.',
    costo: 'Ninguno, pero las inferencias no entran al Atlas.',
    mod: { fichasPorInferencia: 14, tintaPorInferencia: 3 } },
  { id: 'aproximador', nombre: 'Buen ojo', rareza: 'comun', precio: 9,
    regla: 'Acertar el vínculo con el matiz equivocado ya multiplica.',
    costo: 'Deja de empujarte a afinar la etiqueta.',
    mod: { multPorAproximado: 0.5 } },
  { id: 'intuitivo', nombre: 'Corazonada', rareza: 'comun', precio: 8,
    regla: 'Las afirmaciones plausibles dejan de valer cero.',
    costo: 'Premia estar cerca, no estar en lo cierto.',
    mod: { plausibleCuenta: true } },
  { id: 'temerario', nombre: 'Temerario', rareza: 'rara', precio: 12,
    regla: 'Invertir una dirección deja de costarte lucidez.',
    costo: 'Sigue sin puntuar: pierdes el aviso, no el error.',
    mod: { sinCastigoInvertido: true } },

  /* ---- únicas ---- */
  { id: 'coleccionista', nombre: 'Lente del coleccionista', rareza: 'unica', precio: 18,
    regla: 'Multiplicador fijo sobre todo el diagrama y un enemigo más de alcance.',
    costo: 'No te empuja a leer de ninguna manera concreta.',
    mod: { multGlobal: 0.8, alcanceExtra: 1 } },
  { id: 'escriba', nombre: 'Escriba mayor', rareza: 'unica', precio: 20,
    regla: 'Mano más grande, una herramienta extra y tinta en cada combate.',
    costo: 'Cara: te comes el presupuesto de dos lentes especializadas.',
    mod: { manoExtra: 1, herramientasExtra: ['identidad'] as HerramientaId[], tintaPorCombate: 5 } }
]

export const lentePorId = (id: string): Lente => LENTES.find((l) => l.id === id) ?? LENTES[0]

export function combinarLentes(ids: string[]): ModificadoresLente {
  const out: ModificadoresLente = {
    ...SIN_LENTES, multPorTipo: {}, multPorHerramienta: {}, multPorCombo: {}, herramientasExtra: []
  }
  for (const id of ids) {
    const l = lentePorId(id)
    const m = l.mod
    for (const [k, v] of Object.entries(m.multPorTipo ?? {})) {
      out.multPorTipo[k] = (out.multPorTipo[k] ?? 0) + v
    }
    for (const [k, v] of Object.entries(m.multPorHerramienta ?? {})) {
      const key = k as HerramientaId
      out.multPorHerramienta[key] = (out.multPorHerramienta[key] ?? 0) + (v as number)
    }
    for (const [k, v] of Object.entries(m.multPorCombo ?? {})) {
      const key = k as keyof typeof out.multPorCombo
      out.multPorCombo[key] = (out.multPorCombo[key] ?? 0) + (v as number)
    }
    out.herramientasExtra = [...out.herramientasExtra, ...(m.herramientasExtra ?? [])]
    out.fichasPorSostenido += m.fichasPorSostenido ?? 0
    out.multPorUmbral += m.multPorUmbral ?? 0
    out.multGlobal += m.multGlobal ?? 0
    out.alcanceExtra += m.alcanceExtra ?? 0
    out.manoExtra += m.manoExtra ?? 0
    out.quemasExtra += m.quemasExtra ?? 0
    out.cambiosExtra += m.cambiosExtra ?? 0
    out.robarPorAcierto += m.robarPorAcierto ?? 0
    out.tintaPorCombate += m.tintaPorCombate ?? 0
    out.tintaPorQuema += m.tintaPorQuema ?? 0
    out.tintaPorInferencia += m.tintaPorInferencia ?? 0
    out.fichasPorInferencia += m.fichasPorInferencia ?? 0
    out.multPorAproximado += m.multPorAproximado ?? 0
    out.plausibleCuenta = out.plausibleCuenta || !!m.plausibleCuenta
    out.sinCastigoInvertido = out.sinCastigoInvertido || !!m.sinCastigoInvertido
    out.revelaApocrifas += m.revelaApocrifas ?? 0
  }
  return out
}

/* ============================== los sellos ================================ */

export type SelloId =
  | 'lupa' | 'pluma' | 'goma' | 'atajo' | 'calco' | 'purga'

export interface Sello {
  id: SelloId
  nombre: string
  glifo: string
  efecto: string
  precio: number
}

/** Activos de un uso por combate. Se gastan y vuelven llenos al siguiente. */
export const SELLOS: Record<SelloId, Sello> = {
  lupa: { id: 'lupa', nombre: 'Lupa', glifo: '🔍', precio: 7,
    efecto: 'Marca todas las falsificaciones de tu mano ahora mismo.' },
  pluma: { id: 'pluma', nombre: 'Pluma', glifo: '✒', precio: 6,
    efecto: 'Robas tres cartas al instante.' },
  goma: { id: 'goma', nombre: 'Goma', glifo: '⌫', precio: 8,
    efecto: 'Este turno el carril no avanza ni te golpea.' },
  atajo: { id: 'atajo', nombre: 'Atajo', glifo: '⇥', precio: 7,
    efecto: 'Una flecha y una identidad extra para este turno.' },
  calco: { id: 'calco', nombre: 'Calco', glifo: '⧉', precio: 9,
    efecto: 'Suma +2 al multiplicador de tu próximo diagrama.' },
  purga: { id: 'purga', nombre: 'Purga', glifo: '♻', precio: 6,
    efecto: 'Descarta toda la mano y roba otra tanto sin gastar cambios.' }
}

export const selloPorId = (id: SelloId): Sello => SELLOS[id]
export const listaSellos = Object.values(SELLOS)

export { SIN_LENTES }

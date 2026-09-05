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
  mod: Partial<ModificadoresLente>
}

export const LENTES: Lente[] = [
  /* ---- eje: tipo de relación ---- */
  { id: 'disidente', nombre: 'Lente del disidente', rareza: 'comun',
    regla: 'Los contrastes multiplican mucho más.',
    costo: 'Los apoyos, la relación más común, dejan de rendir.',
    mod: { multPorTipo: { contrasta: 1.6, apoya: -0.3 } } },
  { id: 'causalista', nombre: 'Lente causalista', rareza: 'comun',
    regla: 'Causa, requisito y secuencias rinden más.',
    costo: 'Es fácil confundir causa con correlación y afirmar al revés.',
    mod: { multPorTipo: { causa: 0.9, requiere: 0.9 }, multPorHerramienta: { secuencia: 1 } } },
  { id: 'taxonomo', nombre: 'Lente del taxónomo', rareza: 'comun',
    regla: 'Generalizar y ejemplificar multiplican, y la jerarquía rinde más.',
    costo: 'Son las relaciones más escasas de casi cualquier texto.',
    mod: { multPorTipo: { generaliza: 1.1, ejemplifica: 1.1 }, multPorHerramienta: { jerarquia: 0.9 } } },

  /* ---- eje: herramienta ---- */
  { id: 'topografo', nombre: 'Lente del topógrafo', rareza: 'comun',
    regla: 'Campos semánticos y ejes valen mucho más.',
    costo: 'Exige haber entendido cómo está dividido el texto.',
    mod: { multPorHerramienta: { campo: 1.2, eje: 1.2 } } },
  { id: 'lexicografo', nombre: 'Lente del lexicógrafo', rareza: 'comun',
    regla: 'Emparejar nombre y descripción rinde el triple.',
    costo: 'Reconocer no es relacionar: llena poco Atlas.',
    mod: { multPorHerramienta: { identidad: 1.4 }, fichasPorSostenido: 3 } },
  { id: 'traductor', nombre: 'Lente del traductor', rareza: 'comun',
    regla: 'Las anclas de caso valen mucho más.',
    costo: 'Los casos ocupan sitio y exigen saber qué opera en ellos.',
    mod: { multPorHerramienta: { ancla: 1.4 } } },
  { id: 'abogado', nombre: 'Lente del abogado', rareza: 'rara',
    regla: 'La balanza rinde muchísimo más.',
    costo: 'Solo hay unas pocas tesis en todo el texto.',
    mod: { multPorHerramienta: { balanza: 2 } } },

  /* ---- eje: combos y estructura ---- */
  { id: 'arquitecto', nombre: 'Lente del arquitecto', rareza: 'rara',
    regla: 'Articulación y constelación escalan mucho más.',
    costo: 'Premia diagramas grandes, y un error los penaliza enteros.',
    mod: { multPorCombo: { articulacion: 1, constelacion: 1.5 } } },
  { id: 'umbral', nombre: 'Lente del umbral', rareza: 'comun',
    regla: 'Cada concepto umbral del diagrama suma bastante más.',
    costo: 'Los umbrales son los más difíciles de definir bien.',
    mod: { multPorUmbral: 0.6 } },
  { id: 'artillero', nombre: 'Lente del artillero', rareza: 'rara',
    regla: 'Tu afirmación alcanza a dos enemigos más del carril.',
    costo: 'Reparte el daño en vez de concentrarlo.',
    mod: { alcanceExtra: 2 } },

  /* ---- eje: mano y herramientas ---- */
  { id: 'fichero', nombre: 'Fichero ampliado', rareza: 'comun',
    regla: 'Robas dos cartas más cada turno.',
    costo: 'Ninguno. Externalizar la memoria es legítimo.',
    mod: { manoExtra: 2 } },
  { id: 'cinturon', nombre: 'Cinturón del cartógrafo', rareza: 'rara',
    regla: 'Una flecha y un campo extra por turno.',
    costo: 'Más trazos también significan más formas de equivocarse.',
    mod: { herramientasExtra: ['flecha', 'campo'] as HerramientaId[] } },
  { id: 'mano_rapida', nombre: 'Mano rápida', rareza: 'comun',
    regla: 'Dos cambios más por combate.',
    costo: 'Ninguno. Gestionar la mano es una habilidad, no una trampa.',
    mod: { cambiosExtra: 2 } },
  { id: 'impulso', nombre: 'Impulso', rareza: 'rara',
    regla: 'Cada trazo sostenido te hace robar una carta.',
    costo: 'El mazo se recicla antes y las apócrifas vuelven antes.',
    mod: { robarPorAcierto: 1 } },

  /* ---- eje: discriminación y tinta ---- */
  { id: 'inquisidor', nombre: 'Lente del inquisidor', rareza: 'comun',
    regla: 'Dos quemas más por combate, y cada acierto al quemar bonifica el doble.',
    costo: 'No mejora ninguna afirmación: solo tu ojo para las falsas.',
    mod: { quemasExtra: 2 } },
  { id: 'ojo_critico', nombre: 'Ojo crítico', rareza: 'rara',
    regla: 'Al empezar cada combate, dos falsificaciones aparecen marcadas.',
    costo: 'Te acostumbras a que te las señalen.',
    mod: { revelaApocrifas: 2, quemasExtra: 1 } },
  { id: 'cuaderno', nombre: 'Cuaderno de campo', rareza: 'comun',
    regla: 'Una carta más en mano y dos cambios más por combate.',
    costo: 'Nada te empuja a afinar: solo a barajar más.',
    mod: { manoExtra: 1, cambiosExtra: 2 } },

  /* ---- eje: la escalera de veredictos ---- */
  { id: 'deductor', nombre: 'Lente del deductor', rareza: 'rara',
    regla: 'Lo que deduces sin que el texto lo diga rinde casi como lo literal.',
    costo: 'Ninguno, pero las inferencias no entran al Atlas.',
    mod: { fichasPorInferencia: 18 } },
  { id: 'aproximador', nombre: 'Buen ojo', rareza: 'comun',
    regla: 'Acertar el vínculo con el matiz equivocado ya multiplica.',
    costo: 'Deja de empujarte a afinar la etiqueta.',
    mod: { multPorAproximado: 0.5 } },
  { id: 'intuitivo', nombre: 'Corazonada', rareza: 'comun',
    regla: 'Las afirmaciones plausibles dejan de valer cero.',
    costo: 'Premia estar cerca, no estar en lo cierto.',
    mod: { plausibleCuenta: true } },
  { id: 'temerario', nombre: 'Temerario', rareza: 'rara',
    regla: 'Invertir una dirección deja de costarte lucidez.',
    costo: 'Sigue sin puntuar: pierdes el aviso, no el error.',
    mod: { sinCastigoInvertido: true } },

  /* ---- únicas ---- */
  { id: 'coleccionista', nombre: 'Lente del coleccionista', rareza: 'unica',
    regla: 'Multiplicador fijo sobre todo el diagrama y un enemigo más de alcance.',
    costo: 'No te empuja a leer de ninguna manera concreta.',
    mod: { multGlobal: 0.8, alcanceExtra: 1 } },
  { id: 'escriba', nombre: 'Escriba mayor', rareza: 'unica',
    regla: 'Mano más grande, una herramienta extra y tinta en cada combate.',
    costo: 'Cara: te comes el presupuesto de dos lentes especializadas.',
    mod: { manoExtra: 1, herramientasExtra: ['identidad'] as HerramientaId[], fichasPorSostenido: 4 } },

  /* ---- las mayores: la capa ×mult. No suman al filo: multiplican TODO. ----
     Sus condiciones son las conductas cognitivas más caras, así que perseguir
     el número gigante es perseguir la jugada difícil. No se regalan: son
     raras o únicas, y las únicas exigen además su hazaña. */
  { id: 'anclista', nombre: 'El Anclista', rareza: 'rara',
    regla: '×1.5 al daño ENTERO si el diagrama sostiene un caso anclado.',
    costo: 'Nada. Pero sin caso en la mesa, no hace nada.',
    mod: { xmults: [{ id: 'anclista', nombre: 'El Anclista', factor: 1.5, cuando: 'ancla' }] } },
  { id: 'polifonia', nombre: 'Polifonía', rareza: 'rara',
    regla: '×1.5 al daño ENTERO si sostienes con tres herramientas distintas o más.',
    costo: 'Repetir la misma jugada deja de ser el camino.',
    mod: { xmults: [{ id: 'polifonia', nombre: 'Polifonía', factor: 1.5, cuando: 'variedad' }] } },
  { id: 'puno_disidente', nombre: 'Puño del disidente', rareza: 'rara',
    regla: '×1.5 al daño ENTERO con dos contrastes sostenidos y ni un solo apoyo trazado.',
    costo: 'La oposición tiene que ser pura: un apoyo en el diagrama lo apaga.',
    mod: { xmults: [{ id: 'puno_disidente', nombre: 'Puño del disidente', factor: 1.5, cuando: 'oposicion' }] } },
  { id: 'reliquia_traductor', nombre: 'Reliquia del traductor', rareza: 'rara',
    regla: '×2 al daño ENTERO si el diagrama sostiene una Analogía.',
    costo: 'La jugada más difícil del juego, o nada.',
    mod: { xmults: [{ id: 'reliquia_traductor', nombre: 'Reliquia del traductor', factor: 2, cuando: 'analogia' }] } },
  { id: 'catedral', nombre: 'La Catedral', rareza: 'unica',
    regla: '×3 al daño ENTERO si enciendes una Constelación: cuatro sostenidas sin un error.',
    costo: 'Solo se gana con su hazaña. Un error en el diagrama la apaga.',
    mod: { xmults: [{ id: 'catedral', nombre: 'La Catedral', factor: 3, cuando: 'constelacion' }] } },
  { id: 'aleph', nombre: 'El Aleph', rareza: 'unica',
    regla: '×2.5 al daño ENTERO con un Mestizaje de cuatro clases de pieza o más.',
    costo: 'Solo se gana con su hazaña. Pide jugar con TODO el material a la vez.',
    mod: { xmults: [{ id: 'aleph', nombre: 'El Aleph', factor: 2.5, cuando: 'mestizaje4' }] } },
  /* ---- las escaladoras: el motor crece por JUGAR bien, no por lootear ---- */
  { id: 'cuaderno_hereje', nombre: 'Cuaderno del hereje', rareza: 'rara',
    regla: '+0.15 al filo, permanente, por cada falsificación quemada en la expedición.',
    costo: 'Empieza sin hacer nada: hay que alimentarlo discriminando.',
    mod: {} },
  { id: 'pluma_que_aprende', nombre: 'La pluma que aprende', rareza: 'rara',
    regla: '+1 ficha por sostenido por cada inferencia hecha en la expedición (hasta 12).',
    costo: 'Solo crece deduciendo lo que el texto no dice en voz alta.',
    mod: {} },
]

export const lentePorId = (id: string): Lente => LENTES.find((l) => l.id === id) ?? LENTES[0]

export function combinarLentes(ids: string[]): ModificadoresLente {
  const out: ModificadoresLente = {
    ...SIN_LENTES, multPorTipo: {}, multPorHerramienta: {}, multPorCombo: {}, herramientasExtra: [], xmults: []
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
    out.fichasPorInferencia += m.fichasPorInferencia ?? 0
    out.multPorAproximado += m.multPorAproximado ?? 0
    out.plausibleCuenta = out.plausibleCuenta || !!m.plausibleCuenta
    out.sinCastigoInvertido = out.sinCastigoInvertido || !!m.sinCastigoInvertido
    out.revelaApocrifas += m.revelaApocrifas ?? 0
    out.xmults = [...out.xmults, ...(m.xmults ?? [])]
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
}

/** Activos de un uso por combate. Se gastan y vuelven llenos al siguiente. */
export const SELLOS: Record<SelloId, Sello> = {
  lupa: { id: 'lupa', nombre: 'Lupa', glifo: '🔍',
    efecto: 'Marca todas las falsificaciones de tu mano ahora mismo.' },
  pluma: { id: 'pluma', nombre: 'Pluma', glifo: '✒',
    efecto: 'Robas tres cartas al instante.' },
  goma: { id: 'goma', nombre: 'Goma', glifo: '⌫',
    efecto: 'Este turno el carril no avanza ni te golpea.' },
  atajo: { id: 'atajo', nombre: 'Atajo', glifo: '⇥',
    efecto: 'Una flecha y una identidad extra para este turno.' },
  calco: { id: 'calco', nombre: 'Calco', glifo: '⧉',
    efecto: 'Suma +2 al multiplicador de tu próximo diagrama.' },
  purga: { id: 'purga', nombre: 'Purga', glifo: '♻',
    efecto: 'Descarta toda la mano y roba otra tanto sin gastar cambios.' }
}

export const selloPorId = (id: SelloId): Sello => SELLOS[id]
export const listaSellos = Object.values(SELLOS)

export { SIN_LENTES }

import { adaptarBundle } from './adapter'
import type { Contenido } from './types'

/* ==========================================================================
   El tutorial.
   Un bundle sintético con conceptos que cualquiera entiende, para que lo que
   se aprenda sea la MECÁNICA y no el tema. Se construye con la misma forma que
   emite el extractor, así que pasa por el mismo adaptador y el mismo motor: no
   hay un camino especial de código que pueda quedar sin probar.
   ========================================================================== */

const C = (
  id: string, titulo: string, definicion: string, tipo: string,
  unidad: string, cluster: string, imp: number, umbral = false, subs: [string, string][] = []
) => ({
  id, titulo, definicion, definicion_corta: definicion, tipo,
  unidad_id: unidad, importancia: imp, dificultad_objetivo: 0.3,
  es_puerta: false, es_umbral: umbral,
  carga_cognitiva: ['memorizar'], familias_recomendadas: ['A', 'C'],
  sinonimos: [], paginas: [1],
  subdimensiones: subs.map(([name, description]) => ({ name, description })),
  tensiones: [], n_fuentes: 1, posicion: 1, andamiaje: 'alto',
  dificultad_declarada: 'basico', n_efectivo: 3, n_opciones: 3, n_distractores: 2,
  _cluster: cluster
})

const CONCEPTOS = [
  C('abeja', 'Abeja', 'Insecto social que recoge néctar y, al hacerlo, traslada polen entre flores.', 'empirico', 'u1', 'c1', 0.9, false,
    [['Obrera', 'Recolecta y cuida la colmena.'], ['Reina', 'Pone los huevos de toda la colonia.']]),
  C('polinizacion', 'Polinización', 'Traslado del polen de una flor a otra, sin el cual la planta no da fruto.', 'teorico', 'u1', 'c1', 1, true),
  C('flor', 'Flor', 'Órgano reproductor de la planta, que ofrece néctar para atraer a quien la poliniza.', 'empirico', 'u1', 'c1', 0.7),
  C('fruto', 'Fruto', 'Lo que la planta produce cuando su flor ha sido fecundada.', 'empirico', 'u1', 'c1', 0.6),
  C('insecto', 'Insecto', 'Animal de seis patas y cuerpo en tres partes, con o sin alas.', 'teorico', 'u1', 'c1', 0.5),
  C('murcielago', 'Murciélago', 'Mamífero volador y nocturno que se orienta por el eco de sus propios chillidos.', 'empirico', 'u2', 'c2', 0.8),
  C('mamifero', 'Mamífero', 'Animal de sangre caliente que amamanta a sus crías.', 'teorico', 'u2', 'c2', 0.7),
  C('ecolocalizacion', 'Ecolocalización', 'Orientarse emitiendo sonidos y escuchando cómo rebotan en los objetos.', 'teorico', 'u2', 'c2', 0.9, true),
  C('ballena', 'Ballena', 'Mamífero marino gigante que filtra kril del agua y también se orienta por sonido.', 'empirico', 'u2', 'c2', 0.7),
  C('ave', 'Ave', 'Animal de plumas y pico que pone huevos; casi todas vuelan.', 'teorico', 'u2', 'c2', 0.6)
]

const ARISTAS: [string, string, string, string][] = [
  ['abeja', 'polinizacion', 'causa', 'La abeja, al buscar néctar, produce la polinización.'],
  ['polinizacion', 'fruto', 'causa', 'Sin polinización la flor no llega a dar fruto.'],
  ['flor', 'abeja', 'apoya', 'La flor ofrece néctar y así atrae a la abeja.'],
  ['insecto', 'abeja', 'generaliza', 'Insecto es la categoría que contiene a la abeja.'],
  ['mamifero', 'murcielago', 'generaliza', 'Mamífero es la categoría que contiene al murciélago.'],
  ['mamifero', 'ballena', 'generaliza', 'Mamífero es la categoría que contiene a la ballena.'],
  ['murcielago', 'ecolocalizacion', 'apoya', 'El murciélago es el caso donde mejor se ve la ecolocalización.'],
  ['ballena', 'ecolocalizacion', 'apoya', 'La ballena también se orienta por el eco del sonido.'],
  ['murcielago', 'ave', 'contrasta', 'Vuela como un ave, pero es un mamífero: se parecen y no son lo mismo.'],
  ['abeja', 'flor', 'requiere', 'La abeja necesita la flor para alimentarse.'],
  ['ecolocalizacion', 'murcielago', 'ejemplifica', 'El murciélago es el ejemplo clásico de ecolocalización.']
]

const CASOS = [
  ['huerto', 'Un huerto cercado deja de dar fruta el año en que desaparecen los insectos de la zona, aunque las plantas florecen igual.',
   ['abeja', 'polinizacion', 'fruto'], 'polinizacion', 'agricultura',
   'Sin quien traslade el polen, la flor se queda en flor: hay floración pero no fructificación.'],
  ['cueva', 'Un animal se mueve a toda velocidad por una cueva sin luz y jamás choca con las paredes.',
   ['ecolocalizacion', 'murcielago'], 'ecolocalizacion', 'zoología',
   'Se orienta por el eco de sus propios sonidos, no por la vista.']
]

function construir() {
  const conceptos: Record<string, unknown> = {}
  const clusters: Record<string, string[]> = {}
  for (const c of CONCEPTOS) {
    const { _cluster, ...resto } = c
    conceptos[c.id] = resto
    clusters[_cluster] = [...(clusters[_cluster] ?? []), c.id]
  }

  const porTipo: Record<string, unknown[]> = {}
  const adyacencia: Record<string, unknown[]> = {}
  for (const [from, to, tipo, descripcion] of ARISTAS) {
    const e = { from, to, tipo, descripcion }
    porTipo[tipo] = [...(porTipo[tipo] ?? []), e]
    adyacencia[from] = [...(adyacencia[from] ?? []), e]
  }

  // distractores creíbles: cada uno lleva la descripción de otro animal
  const pools: Record<string, unknown[]> = {}
  for (const c of CONCEPTOS) {
    const otros = CONCEPTOS.filter((x) => x.id !== c.id)
    pools[c.id] = otros.slice(0, 3).map((o) => ({
      texto: o.definicion, fuente: 'distincion',
      concepto_confundido: o.id,
      explicacion: `Esa descripción es de «${o.titulo}». ${c.titulo} es: ${c.definicion}`
    }))
  }

  const unidades = [
    { id: 'u1', numero: 1, titulo: 'Abejas y flores', concept_ids: CONCEPTOS.filter((c) => c.unidad_id === 'u1').map((c) => c.id) },
    { id: 'u2', numero: 2, titulo: 'Quién vuela y quién no', concept_ids: CONCEPTOS.filter((c) => c.unidad_id === 'u2').map((c) => c.id) }
  ]

  return {
    bundle_version: 'tutorial', compiled_from_schema: '2.1.0',
    source_filename: 'Tutorial · animales',
    concepts: conceptos,
    graph: {
      por_tipo: porTipo, adyacencia,
      clusters: Object.entries(clusters).map(([id, ids], i) => ({
        id, label: i === 0 ? 'El huerto' : 'Quién vuela', concept_ids: ids
      })),
      ejes: []
    },
    items: {},
    distractor_pools: pools,
    content: {
      repertoires: [{
        id: 'rep_murcielago', concept_id: 'mamifero',
        label: 'Si vuela, es un ave',
        example: 'Ver un murciélago al anochecer y darlo por un pájaro raro.',
        contraste_cientifico: 'Volar no define al grupo: el murciélago amamanta, y eso lo hace mamífero.',
        contexto_donde_funciona: 'Para casi todo lo que ves volando de día, la regla acierta: la mayoría sí son aves.',
        concepto_confundido: 'ave'
      }],
      cases: CASOS.map(([id, description, concept_ids, primary, dominio, resolucion]) => ({
        id, description, concept_ids, primary_concept_id: primary,
        dominio, resolucion_esperada: resolucion, variables_clave: [], prediction_enabled: false
      })),
      scenarios: [{
        id: 'sc_ciudad',
        description: 'En una ciudad sin jardines, los árboles frutales de los patios dan cada año menos fruta.',
        concept_ids: ['polinizacion', 'abeja', 'flor'],
        distancia: 'media', dominio: 'urbanismo',
        resolucion_esperada: 'Sin plantas con flor alrededor no hay insectos que trasladen el polen entre los árboles.',
        error_embebido: null
      }],
      theses: [], frameworks: []
    },
    study_plan: {
      orden: CONCEPTOS.map((c) => c.id),
      unidades,
      curva_dificultad: unidades.map((u, i) => ({
        unidad_id: u.id, dificultad_objetivo: 0.3 + i * 0.1,
        n_opciones_sugerido: 3, andamiaje_sugerido: 'alto'
      }))
    },
    capabilities: {},
    readiness: [], mechanics: {}, items_descartados: [], conceptos_con_problemas: [],
    stats: { conceptos: CONCEPTOS.length, aristas: ARISTAS.length }
  }
}

let cache: Contenido | null = null

export function contenidoTutorial(): Contenido {
  if (!cache) cache = adaptarBundle(construir())
  return cache
}

export const ES_TUTORIAL = 'Tutorial · animales'

/** Los avisos que van apareciendo. Se muestran una vez cada uno. */
export const PASOS_TUTORIAL: { clave: string; titulo: string; texto: string }[] = [
  {
    clave: 'arrastrar', titulo: 'Primero, saca las piezas',
    texto: 'Arrastra dos cartas de la derecha al tablero. Una es un nombre («Abeja») y otra una descripción. Todavía no pasa nada: solo las estás poniendo sobre la mesa.'
  },
  {
    clave: 'herramienta', titulo: 'Ahora di algo sobre ellas',
    texto: 'Elige una herramienta de la izquierda y toca las piezas que quieras relacionar. La Identidad (=) empareja un nombre con su descripción; la Flecha (→) dice qué vínculo hay entre dos conceptos.'
  },
  {
    clave: 'afirmar', titulo: 'Afirma y mira el carril',
    texto: 'Cuando pulses Afirmar, el juego comprueba lo que dijiste contra el texto y eso se convierte en tu ataque. Cuanto más verdadero y más articulado, más fuerte pega.'
  },
  {
    clave: 'quemar', titulo: 'Ojo con las falsificaciones',
    texto: 'Algunas cartas llevan el nombre de un concepto con la descripción de otro. Si la detectas, quémala: ganas ventaja. Si te equivocas, destruyes material bueno.'
  }
]

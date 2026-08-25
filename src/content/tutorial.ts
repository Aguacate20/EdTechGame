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

/* ==========================================================================
   El guion.
   Dos combates prefabricados: mano fija, frente fijo y una guía que avanza sola
   cuando el jugador hace lo que toca. La primera sala enseña a poner piezas y
   emparejar; la segunda, a relacionar, a detectar una falsificación y a que el
   carril aprieta si te duermes.
   ========================================================================== */

import type { EstadoBatalla } from '../engine/battle'
import { crearEnemigo, type Enemigo } from '../engine/lane'
import {
  piezaApocrifaDe, piezaCaso, piezaConcepto, piezaDefinicion, piezaEtiqueta, type Pieza
} from '../engine/pieces'
import type { HerramientaId } from '../engine/tools'

/** Qué se ilumina y qué se bloquea durante un paso. El resto de la pantalla se
 *  oscurece: en un tutorial, poder tocarlo todo es poder perderse. */
export interface FocoGuia {
  zona: 'mano' | 'herramientas' | 'lienzo' | 'afirmar' | 'pasivas' | 'pozo'
  /** piezas que se pueden tocar o arrastrar; el resto queda inerte */
  piezas?: (e: EstadoBatalla) => string[]
  /** herramientas pulsables; si falta, todas */
  herramientas?: HerramientaId[]
}

export interface PasoGuia {
  clave: string
  titulo: string
  texto: string
  /** cuando esto se cumple, el paso se da por hecho y aparece el siguiente */
  hecho: (e: EstadoBatalla) => boolean
  foco?: FocoGuia
}

/** uids (en mano y en tablero) de las piezas que apuntan a estos conceptos. */
const de = (ids: string[]) => (e: EstadoBatalla) =>
  e.mano.filter((p) => p.conceptId && ids.includes(p.conceptId)).map((p) => p.uid)

/** uid de la carta falsificada, para poder señalarla sin decir cuál es. */
const laFalsa = (e: EstadoBatalla) =>
  e.mano.filter((p) => p.clase === 'apocrifa').map((p) => p.uid)

export interface SalaTutorial {
  titulo: string
  intro: string
  conceptIds: string[]
  herramientas: HerramientaId[]
  relaciones: string[]
  mazo: (c: Contenido) => Pieza[]
  enemigos: (escala: number) => Enemigo[]
  pasos: PasoGuia[]
  /** lente regalada al empezar la sala, si la hay */
  lente?: string
}

const enTablero = (e: EstadoBatalla, n: number) => e.tablero.length >= n
const trazosDe = (e: EstadoBatalla, tool: HerramientaId) =>
  e.trazos.filter((t) => t.tool === tool).length

export const SALAS_TUTORIAL: SalaTutorial[] = [
  {
    titulo: 'Sala 1 · Poner y emparejar',
    intro: 'Dos criaturas se acercan. Lo único que tienes son fichas de papel: nombres por un lado, descripciones por otro. Juntarlas correctamente es tu primer ataque.',
    conceptIds: ['abeja', 'flor', 'polinizacion'],
    herramientas: ['identidad', 'identidad', 'flecha'],
    relaciones: ['apoya', 'causa'],
    mazo: (c) => [
      piezaEtiqueta(c, 'abeja')!,
      piezaDefinicion(c, 'abeja')!,
      piezaEtiqueta(c, 'flor')!,
      piezaDefinicion(c, 'flor')!,
      piezaConcepto(c, 'polinizacion')!
    ],
    enemigos: (escala) => [
      crearEnemigo('copista', escala * 0.55, 6),
      crearEnemigo('copista', escala * 0.55, 8)
    ],
    pasos: [
      {
        clave: 'arrastrar', titulo: 'Saca dos fichas al tablero',
        texto: 'A la derecha tienes tu mano. Arrastra al centro las dos fichas iluminadas: el nombre «Abeja» y su descripción. Todavía no pasa nada: solo las pones sobre la mesa.',
        hecho: (e) => enTablero(e, 2),
        foco: { zona: 'mano', piezas: de(['abeja']) }
      },
      {
        clave: 'identidad', titulo: 'Ahora di que son lo mismo',
        texto: 'Pulsa la Identidad (=) en la columna izquierda. Verás un recuadro junto al cursor. Toca el nombre y después su descripción: se irán colocando en A y en B. Cuando estén las dos, pulsa Trazar abajo.',
        hecho: (e) => trazosDe(e, 'identidad') >= 1 || e.turno > 1,
        foco: { zona: 'herramientas', herramientas: ['identidad'] }
      },
      {
        clave: 'afirmar', titulo: 'Afirma lo que has dicho',
        texto: 'Pulsa «Afirmar el diagrama». El juego comprueba tu afirmación contra el texto y la convierte en un ataque: cuanto más verdadero y más articulado, más fuerte pega.',
        hecho: (e) => e.turno > 1 || e.fase !== 'jugando',
        foco: { zona: 'afirmar' }
      },
      {
        clave: 'repetir', titulo: 'Despeja el carril',
        texto: 'Ya sabes lo básico: pon, relaciona, afirma. Ahora hazlo hasta que no quede nadie. Prueba lo que se te ocurra: empareja «Flor» con su descripción, o une dos conceptos con la Flecha. El carril avanza una casilla por cada afirmación, así que no te duermas.',
        hecho: (e) => e.enemigos.every((x) => x.hp <= 0)
      }
    ]
  },
  {
    titulo: 'Sala 2 · Relacionar y desconfiar',
    intro: 'Ahora hay tres. Y entre tus fichas se ha colado una falsificación: un nombre con la descripción de otra cosa. Si la usas, tu diagrama pierde fuerza; si la detectas, ganas ventaja.',
    conceptIds: ['abeja', 'polinizacion', 'fruto', 'murcielago', 'mamifero'],
    herramientas: ['flecha', 'flecha', 'identidad', 'campo'],
    relaciones: ['apoya', 'causa', 'generaliza'],
    // la falsificación es siempre la misma y es la confusión clásica: un
    // murciélago con la descripción de un ave. En un tutorial nada al azar.
    mazo: (c) => [
      piezaConcepto(c, 'abeja')!,
      piezaConcepto(c, 'polinizacion')!,
      piezaConcepto(c, 'fruto')!,
      piezaConcepto(c, 'mamifero')!,
      piezaApocrifaDe(c, 'murcielago', 'ave')!,
      piezaCaso(c, 'huerto')!
    ],
    enemigos: (escala) => [
      crearEnemigo('copista', escala * 0.6, 5),
      crearEnemigo('errata', escala * 0.55, 7),
      crearEnemigo('apocrifo', escala * 0.6, 8)
    ],
    pasos: [
      {
        clave: 'cadena', titulo: 'Encadena dos ideas',
        texto: 'Saca las tres fichas iluminadas: Abeja, Polinización y Fruto. Con la Flecha (→) di que la abeja causa la polinización, y luego que la polinización causa el fruto. Dos trazos en el mismo diagrama pegan mucho más que uno.',
        hecho: (e) => trazosDe(e, 'flecha') >= 2 || e.turno > 2,
        foco: { zona: 'mano', piezas: de(['abeja', 'polinizacion', 'fruto']), herramientas: ['flecha'] }
      },
      {
        clave: 'sospecha', titulo: 'Cuidado con la falsificación',
        texto: 'Fíjate en la ficha iluminada: lleva el nombre de «Murciélago» con la descripción de un ave. Selecciónala en la mano y pulsa «Quemar»: si aciertas, robas una carta y tu próximo diagrama multiplica más.',
        hecho: (e) => e.quemasAcertadas >= 1 || e.pozo.length >= 1,
        foco: { zona: 'pozo', piezas: laFalsa }
      },
      {
        clave: 'mejora', titulo: 'Termina con lo que tengas',
        texto: 'Despeja el carril. Cuantas más cosas verdaderas digas en un mismo diagrama, más fuerte pega: dos trazos valen mucho más que dos diagramas de uno.',
        hecho: (e) => e.enemigos.every((x) => x.hp <= 0)
      }
    ]
  }
,
  {
    titulo: 'Sala 3 · El golpe grande',
    intro: 'Llevas una lente puesta y tienes justo las fichas que hacen falta. Enfrente, algo que no cede ante una sola frase.',
    conceptIds: ['abeja', 'flor', 'polinizacion', 'fruto', 'insecto'],
    herramientas: ['flecha', 'flecha', 'identidad', 'campo', 'jerarquia'],
    relaciones: ['causa', 'apoya', 'generaliza'],
    /** una pasiva regalada: que vea qué hace antes de tener que elegirla */
    lente: 'arquitecto',
    mazo: (c) => [
      piezaEtiqueta(c, 'abeja')!,
      piezaDefinicion(c, 'abeja')!,
      piezaConcepto(c, 'polinizacion')!,
      piezaConcepto(c, 'fruto')!,
      piezaConcepto(c, 'flor')!,
      piezaConcepto(c, 'insecto')!
    ],
    enemigos: (escala) => [crearEnemigo('dogma', escala * 0.85, 7)],
    pasos: [
      {
        clave: 'lente', titulo: 'Llevas una lente',
        texto: 'A la izquierda verás «Lente del arquitecto». Es una pasiva: no hace nada por sí sola, pero multiplica cuando un diagrama tiene varias afirmaciones enlazadas. El Dogma que tienes enfrente, además, no cede ante una sola frase.',
        hecho: (e) => e.tablero.length >= 1,
        foco: { zona: 'pasivas' }
      },
      {
        clave: 'cadena3', titulo: 'Encadena tres ideas',
        texto: 'Saca Abeja, Polinización y Fruto. Con la Flecha (→) di que la abeja causa la polinización, y que la polinización causa el fruto. Dos trazos: eso ya es una cadena.',
        hecho: (e) => trazosDe(e, 'flecha') >= 2,
        foco: { zona: 'mano', piezas: de(['abeja', 'polinizacion', 'fruto']), herramientas: ['flecha'] }
      },
      {
        clave: 'combo', titulo: 'Ahora haz que se toquen',
        texto: 'Sin afirmar todavía: empareja Abeja con su descripción usando la Identidad (=), y encierra Abeja, Flor y Polinización con el Campo (◯). Al compartir piezas entre trazos se encienden los combos, y ahí es donde el número se dispara.',
        hecho: (e) => e.trazos.length >= 3,
        foco: { zona: 'herramientas', herramientas: ['identidad', 'campo'] }
      },
      {
        clave: 'estallido', titulo: 'Suéltalo todo de una vez',
        texto: 'Pulsa «Afirmar el diagrama» y mira la cuenta subir eslabón por eslabón. Esto es lo que persigue el juego: no acertar mucho, sino decir muchas cosas verdaderas que se sostengan entre sí.',
        hecho: (e) => e.enemigos.every((x) => x.hp <= 0) || e.turno > 2,
        foco: { zona: 'afirmar' }
      }
    ]
  }
]

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

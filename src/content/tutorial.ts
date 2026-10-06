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
  // v6.47 · el tema del tutorial es la lluvia: algo que todo el mundo ya sabe, para que
  // toda la atención vaya a CÓMO se juega y no a qué significa cada carta
  C('nube', 'Nube', 'Algo blanco o gris que flota en el cielo.', 'empirico', 'u1', 'c1', 0.9),
  C('lluvia', 'Lluvia', 'Agua que cae del cielo.', 'empirico', 'u1', 'c1', 1, true),
  C('charco', 'Charco', 'Agua que queda en el suelo después de llover.', 'empirico', 'u1', 'c1', 0.7),
  C('trueno', 'Trueno', 'Ruido muy fuerte que suena en el cielo.', 'empirico', 'u1', 'c1', 0.6),
  C('tormenta', 'Tormenta', 'Mal tiempo con mucha lluvia, viento y truenos.', 'teorico', 'u1', 'c1', 0.5),
  C('sol', 'Sol', 'La estrella que nos da luz de día.', 'empirico', 'u2', 'c2', 0.8),
  C('calor', 'Calor', 'Lo que sientes cuando la temperatura es alta.', 'teorico', 'u2', 'c2', 0.9, true),
  C('sed', 'Sed', 'Ganas de tomar agua.', 'empirico', 'u2', 'c2', 0.7),
  C('sombra', 'Sombra', 'Lugar oscuro y fresco donde no llega el sol.', 'empirico', 'u2', 'c2', 0.7),
  C('verano', 'Verano', 'La época más calurosa del año.', 'teorico', 'u2', 'c2', 0.6)
]

const ARISTAS: [string, string, string, string][] = [
  ['nube', 'lluvia', 'causa', 'La nube trae la lluvia.'],
  ['lluvia', 'charco', 'causa', 'La lluvia deja charcos en el suelo.'],
  ['trueno', 'tormenta', 'apoya', 'El trueno avisa que hay tormenta.'],
  ['tormenta', 'lluvia', 'causa', 'La tormenta trae mucha lluvia.'],
  ['lluvia', 'nube', 'requiere', 'Para que llueva tiene que haber nubes.'],
  ['sol', 'calor', 'causa', 'El sol da calor.'],
  ['calor', 'sed', 'causa', 'Con calor da sed.'],
  ['sol', 'sombra', 'causa', 'Con sol, las cosas hacen sombra.'],
  ['verano', 'calor', 'apoya', 'En verano hace más calor.'],
  ['sol', 'nube', 'contrasta', 'Con sol el cielo está despejado; con nubes, tapado.'],
  ['calor', 'verano', 'ejemplifica', 'El calor es lo más típico del verano.']
]

const CASOS = [
  ['patio', 'Después de una tarde gris, el patio amanece lleno de agua.',
   ['nube', 'lluvia', 'charco'], 'lluvia', 'la casa',
   'Hubo nubes, llovió y la lluvia dejó charcos.'],
  ['playa', 'En la playa, al mediodía, todos buscan agua para beber.',
   ['sol', 'calor', 'sed'], 'calor', 'vacaciones',
   'El sol da calor y el calor da sed.']
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
    { id: 'u1', numero: 1, titulo: 'La lluvia', concept_ids: CONCEPTOS.filter((c) => c.unidad_id === 'u1').map((c) => c.id) },
    { id: 'u2', numero: 2, titulo: 'El sol', concept_ids: CONCEPTOS.filter((c) => c.unidad_id === 'u2').map((c) => c.id) }
  ]

  return {
    bundle_version: 'tutorial', compiled_from_schema: '2.1.0',
    source_filename: 'Tutorial · el clima',
    concepts: conceptos,
    graph: {
      por_tipo: porTipo, adyacencia,
      clusters: Object.entries(clusters).map(([id, ids], i) => ({
        id, label: i === 0 ? 'La lluvia' : 'El sol', concept_ids: ids
      })),
      ejes: []
    },
    items: {},
    distractor_pools: pools,
    content: {
      repertoires: [{
        id: 'rep_nube', concept_id: 'lluvia',
        label: 'Si hay nubes, seguro llueve',
        example: 'Ver el cielo nublado y dar por hecho que va a llover.',
        contraste_cientifico: 'Hay muchos días nublados en los que no cae ni una gota.',
        contexto_donde_funciona: 'Con nubes muy oscuras y viento, casi siempre acierta.',
        concepto_confundido: 'nube'
      }],
      cases: CASOS.map(([id, description, concept_ids, primary, dominio, resolucion]) => ({
        id, description, concept_ids, primary_concept_id: primary,
        dominio, resolucion_esperada: resolucion, variables_clave: [], prediction_enabled: false
      })),
      scenarios: [{
        id: 'sc_paraguas',
        description: 'El cielo se pone gris y la gente empieza a sacar el paraguas.',
        concept_ids: ['nube', 'lluvia'],
        distancia: 'media', dominio: 'la calle',
        resolucion_esperada: 'Las nubes grises avisan que viene la lluvia.',
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

export const ES_TUTORIAL = 'Tutorial · el clima'

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
  zona: 'mano' | 'herramientas' | 'lienzo' | 'afirmar' | 'pasivas' | 'pozo' | 'carril' | 'trazar' | 'quemar'
  /** piezas que se pueden tocar o arrastrar; el resto queda inerte */
  piezas?: (e: EstadoBatalla) => string[]
  /** herramientas pulsables; si falta, todas */
  herramientas?: HerramientaId[]
  /** v6.14 · tipos de vínculo que el paso pide: se iluminan al abrir la Flecha */
  relaciones?: string[]
  /** v6.29 · qué se recorta de verdad. Lo demás del foco sigue pulsable pero a oscuras:
   *  un paso, una sola cosa encendida */
  ilumina?: ('zona' | 'piezas' | 'herramientas' | 'relaciones' | 'trazar')[]
  /** v6.29 · dibuja una flecha de la carta señalada a la mesa: «arrástrala aquí» */
  arrastrar?: boolean
  /** v6.49 · cuántos huecos tiene la fila completa: así el primero sale a la izquierda y no centrado */
  huecos?: number
  /** v6.50 · sitios exactos (x, y en % de la mesa) para las cartas que faltan por sacar */
  sitios?: [number, number][]
  /** v6.58 · en qué orden tocar las cartas de la mesa: cada una lleva su número mientras hay herramienta */
  orden?: (e: EstadoBatalla) => string[]
}

/** v6.29 · lo que el jugador tiene «en la mano» en la interfaz y el motor no ve */
export interface EstadoUI { herramienta: string | null; pendientes: number; param: string | null; seleccion: string | null }

export interface PasoGuia {
  clave: string
  texto: string
  /** cuando esto se cumple, el paso se da por hecho y aparece el siguiente */
  hecho: (e: EstadoBatalla) => boolean
  /** v6.29 · pasos que se cumplen con un gesto de interfaz (elegir herramienta, tocar cartas) */
  hechoUI?: (ui: EstadoUI, e: EstadoBatalla) => boolean
  foco?: FocoGuia
  /** v6.15 · paso que solo se lee: el botón lo da por hecho y pasa al siguiente */
  soloLeer?: boolean
  /** v6.29 · Andy en grande, en el centro de la pantalla */
  centro?: boolean
  /** v6.39 · expresión de Andy; si falta, se deduce del tipo de paso */
  cara?: 'saludo' | 'explica' | 'senala' | 'anima' | 'celebra' | 'sorpresa' | 'piensa' | 'preocupado'
  /** texto del botón en los pasos de solo leer */
  boton?: string
}

/** uids (en mano y en tablero) de las piezas que apuntan a estos conceptos. */
const de = (ids: string[]) => (e: EstadoBatalla) =>
  e.mano.filter((p) => p.conceptId && ids.includes(p.conceptId)).map((p) => p.uid)

/** solo el nombre o solo la descripción de un concepto */
const deClase = (id: string, clase: string) => (e: EstadoBatalla) =>
  e.mano.filter((p) => p.conceptId === id && p.clase === clase).map((p) => p.uid)

/** uid de la carta falsificada, para poder señalarla sin decir cuál es. */
export const laFalsa = (e: EstadoBatalla) =>
  e.mano.filter((p) => p.clase === 'apocrifa').map((p) => p.uid)

/** uids en orden. 'nube' = la carta de nombre o de idea; 'nube:def' = su descripción */
const enOrden = (...specs: string[]) => (e: EstadoBatalla) => specs.map((sp) => {
  const [id, def] = sp.split(':')
  return e.mano.find((p) => p.conceptId === id && (def ? p.clase === 'definicion' : p.clase !== 'definicion'))?.uid ?? ''
}).filter(Boolean)

const nunca = () => false

void piezaApocrifaDe

export interface SalaTutorial {
  titulo: string
  intro: string
  conceptIds: string[]
  herramientas: HerramientaId[]
  relaciones: string[]
  mazo: (c: Contenido) => Pieza[]
  enemigos: (escala: number) => Enemigo[]
  pasos: PasoGuia[]
  /** v6.31 · solo las cartas del guion: nada de conceptos vecinos */
  sinFrontera?: boolean
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
    conceptIds: ['nube', 'lluvia'],
    sinFrontera: true,
    // v6.52 · en la primera sala solo existe «Es lo mismo»: nada más que tocar
    herramientas: ['identidad', 'identidad'],
    relaciones: ['apoya', 'causa'],
    mazo: (c) => [
      piezaEtiqueta(c, 'nube')!,
      piezaDefinicion(c, 'nube')!,
      piezaEtiqueta(c, 'lluvia')!,
      piezaDefinicion(c, 'lluvia')!
    ],
    enemigos: (escala) => [
      crearEnemigo('copista', escala * 0.55, 6),
      crearEnemigo('copista', escala * 0.55, 8)
    ],
    pasos: [
      { clave: 'hola', centro: true, soloLeer: true, boton: '¡Vamos!', hecho: nunca,
        texto: '¡Hola! Soy Andy. Ayúdame a derrotar a los enemigos con tu conocimiento.' },
      { clave: 'idea', cara: 'explica', centro: true, soloLeer: true, boton: 'Entendido', hecho: nunca,
        texto: 'Aquí se gana con lo que sabes: cada idea que conectas bien es un golpe.' },
      { clave: 'idea2', cara: 'anima', centro: true, soloLeer: true, boton: '¡A jugar!', hecho: nunca,
        texto: 'Hoy practicamos con algo que ya sabes: la lluvia. Después subes tus propias lecturas y juegas con ellas.' },
      { clave: 'enemigos', cara: 'preocupado', soloLeer: true, boton: 'Siguiente', hecho: nunca,
        texto: 'Ellos vienen por mí. Si llegan, me hacen daño.',
        foco: { zona: 'carril' } },
      { clave: 'cartas', soloLeer: true, boton: 'Siguiente', hecho: (e) => enTablero(e, 1),
        texto: 'Estas son tus cartas. Con ellas atacamos.',
        foco: { zona: 'mano' } },
      { clave: 'cartas2', cara: 'explica', soloLeer: true, boton: 'Siguiente', hecho: (e) => enTablero(e, 1),
        texto: 'Las azules son nombres. Las amarillas son descripciones.',
        foco: { zona: 'mano' } },
      { clave: 'cartas3', cara: 'piensa', soloLeer: true, boton: 'Siguiente', hecho: (e) => enTablero(e, 1),
        texto: 'Cada nombre tiene su descripción. Tu trabajo es encontrar cuál va con cuál.',
        foco: { zona: 'mano' } },
      { clave: 'sacar1',
        texto: 'Arrastra la carta «Nube» a la mesa.',
        hecho: (e) => deClase('nube', 'etiqueta')(e).some((u) => e.tablero.some((t) => t.uid === u)) || enTablero(e, 2) || e.turno > 1,
        foco: { zona: 'mano', piezas: deClase('nube', 'etiqueta'), arrastrar: true, huecos: 2 } },
      { clave: 'sacar2',
        texto: 'Ahora arrastra su descripción.',
        hecho: (e) => enTablero(e, 2) || e.turno > 1,
        foco: { zona: 'mano', piezas: de(['nube']), arrastrar: true, huecos: 2 } },
      { clave: 'armas', cara: 'explica', soloLeer: true, boton: 'Siguiente',
        texto: 'Estas son tus armas. Con ellas unes cartas y demuestras lo que sabes.',
        hecho: (e) => trazosDe(e, 'identidad') >= 1 || e.turno > 1,
        foco: { zona: 'herramientas' } },
      { clave: 'igual',
        texto: 'Toca el botón «=». Quiere decir «son lo mismo».',
        hecho: (e) => trazosDe(e, 'identidad') >= 1 || e.turno > 1,
        hechoUI: (ui) => ui.herramienta === 'identidad',
        foco: { zona: 'herramientas', herramientas: ['identidad'], piezas: de(['nube']), ilumina: ['herramientas'] } },
      { clave: 'tocar',
        texto: 'Toca las dos cartas de la mesa.',
        hecho: (e) => trazosDe(e, 'identidad') >= 1 || e.turno > 1,
        hechoUI: (ui) => ui.herramienta === 'identidad' && ui.pendientes >= 2,
        foco: { zona: 'herramientas', herramientas: ['identidad'], piezas: de(['nube']), ilumina: ['piezas', 'herramientas'], orden: enOrden('nube', 'nube:def') } },
      { clave: 'trazar',
        texto: 'Pulsa «Trazar».',
        hecho: (e) => trazosDe(e, 'identidad') >= 1 || e.turno > 1,
        foco: { zona: 'trazar', herramientas: ['identidad'], piezas: de(['nube']), ilumina: ['zona'], orden: enOrden('nube', 'nube:def') } },
      { clave: 'afirmar',
        texto: '¡Bien! Estás diciendo que «Nube» es «algo blanco o gris que flota en el cielo». Pulsa «Afirmar» para atacar.',
        hecho: (e) => e.turno > 1 || e.fase !== 'jugando',
        foco: { zona: 'afirmar' } },
      { clave: 'repetir', cara: 'anima',
        texto: '¡Así se hace! Ahora tú: une «Lluvia» con su descripción.',
        hecho: (e) => e.enemigos.every((x) => x.hp <= 0) }
    ]
  },
  {
    titulo: 'Sala 2 · Relacionar y desconfiar',
    intro: 'Ahora hay tres. Y entre tus fichas se ha colado una falsificación: un nombre con la descripción de otra cosa. Si la usas, tu diagrama pierde fuerza; si la detectas, ganas ventaja.',
    conceptIds: ['nube', 'lluvia', 'charco', 'calor', 'sol'],
    herramientas: ['flecha', 'flecha', 'identidad', 'campo'],
    relaciones: ['apoya', 'causa', 'generaliza'],
    // la falsificación es siempre la misma y es la confusión clásica: un
    // murciélago con la descripción de un ave. En un tutorial nada al azar.
    mazo: (c) => [
      piezaConcepto(c, 'nube')!,
      piezaConcepto(c, 'lluvia')!,
      piezaConcepto(c, 'charco')!,
      piezaConcepto(c, 'sol')!,
      piezaCaso(c, 'patio')!
    ],
    enemigos: (escala) => [
      crearEnemigo('copista', escala * 0.6, 5),
      crearEnemigo('errata', escala * 0.55, 7),
      crearEnemigo('apocrifo', escala * 0.6, 8)
    ],
    pasos: [
      { clave: 'hola2', cara: 'celebra', centro: true, soloLeer: true, boton: 'Siguiente', hecho: nunca,
        texto: '¡Bien hecho! Ahora te enseño la flecha: sirve para unir dos ideas.' },
      { clave: 'sacar3',
        texto: 'Arrastra estas tres cartas a la mesa.',
        hecho: (e) => enTablero(e, 3) || trazosDe(e, 'flecha') >= 1 || e.turno > 1,
        foco: { zona: 'mano', piezas: de(['nube', 'lluvia', 'charco']), arrastrar: true, huecos: 3 } },
      { clave: 'flecha',
        texto: 'Toca el botón «→».',
        hecho: (e) => trazosDe(e, 'flecha') >= 1 || e.turno > 1,
        hechoUI: (ui) => ui.herramienta === 'flecha',
        foco: { zona: 'herramientas', herramientas: ['flecha'], piezas: de(['nube', 'lluvia']), ilumina: ['herramientas'] } },
      { clave: 'tocar2',
        texto: 'Toca «Nube» y después «Lluvia».',
        hecho: (e) => trazosDe(e, 'flecha') >= 1 || e.turno > 1,
        hechoUI: (ui) => ui.herramienta === 'flecha' && ui.pendientes >= 2,
        foco: { zona: 'herramientas', herramientas: ['flecha'], piezas: de(['nube', 'lluvia']), relaciones: ['causa'], ilumina: ['piezas', 'herramientas'], orden: enOrden('nube', 'lluvia') } },
      { clave: 'causa',
        texto: 'Elige «causa»: la nube causa la lluvia.',
        hecho: (e) => trazosDe(e, 'flecha') >= 1 || e.turno > 1,
        hechoUI: (ui) => ui.herramienta === 'flecha' && ui.pendientes >= 2 && ui.param === 'causa',
        foco: { zona: 'herramientas', herramientas: ['flecha'], piezas: de(['nube', 'lluvia']), relaciones: ['causa'], ilumina: ['relaciones'], orden: enOrden('nube', 'lluvia') } },
      { clave: 'trazar2',
        texto: 'Pulsa «Trazar».',
        hecho: (e) => trazosDe(e, 'flecha') >= 1 || e.turno > 1,
        foco: { zona: 'trazar', herramientas: ['flecha'], piezas: de(['nube', 'lluvia']), relaciones: ['causa'], ilumina: ['zona'], orden: enOrden('nube', 'lluvia') } },
      { clave: 'cadena',
        texto: 'Otra flecha igual: «Lluvia» causa «Charco».',
        hecho: (e) => trazosDe(e, 'flecha') >= 2 || e.turno > 1,
        foco: { zona: 'mano', piezas: de(['lluvia', 'charco']), herramientas: ['flecha'], relaciones: ['causa'], orden: enOrden('lluvia', 'charco') } },
      { clave: 'afirmar2',
        texto: '¡Dos flechas pegan más que una! Pulsa «Afirmar».',
        hecho: (e) => e.turno > 1 || e.fase !== 'jugando',
        foco: { zona: 'afirmar' } },
      { clave: 'mejora', cara: 'anima',
        texto: '¡Muy bien! Ahora vence a los que quedan.',
        hecho: (e) => e.enemigos.every((x) => x.hp <= 0) }
    ]
  }
,
  {
    titulo: 'Sala 3 · El golpe grande',
    intro: 'Llevas una lente puesta y tienes justo las fichas que hacen falta. Enfrente, algo que no cede ante una sola frase.',
    conceptIds: ['nube', 'trueno', 'lluvia', 'charco', 'tormenta'],
    herramientas: ['flecha', 'flecha', 'identidad', 'campo', 'jerarquia'],
    relaciones: ['causa', 'apoya', 'generaliza'],
    /** una pasiva regalada: que vea qué hace antes de tener que elegirla */
    lente: 'arquitecto',
    mazo: (c) => [
      piezaEtiqueta(c, 'nube')!,
      piezaDefinicion(c, 'nube')!,
      piezaConcepto(c, 'lluvia')!,
      piezaConcepto(c, 'charco')!,
      piezaConcepto(c, 'trueno')!,
      piezaConcepto(c, 'tormenta')!
    ],
    enemigos: (escala) => [crearEnemigo('dogma', escala * 0.85, 7)],
    pasos: [
      { clave: 'hola3', cara: 'piensa', centro: true, soloLeer: true, boton: 'Siguiente', hecho: nunca,
        texto: 'Último truco: el gran ataque. Entre más cartas unas, más fuerte pego.' },
      { clave: 'jefe', cara: 'sorpresa', soloLeer: true, boton: 'Siguiente', hecho: nunca,
        texto: 'Este enemigo es duro. Necesita un ataque grande.',
        foco: { zona: 'carril' } },
      { clave: 'lente', cara: 'explica', soloLeer: true, boton: 'Siguiente', hecho: (e) => e.tablero.length >= 1,
        texto: 'Llevas una mejora: da más fuerza a los ataques largos.',
        foco: { zona: 'pasivas' } },
      { clave: 'cadena3',
        texto: 'Vuelve a sacar «Nube», «Lluvia» y «Charco». Únelas con «→» y «causa»: puedes tocar las tres seguidas.',
        hecho: (e) => trazosDe(e, 'flecha') >= 2,
        foco: { zona: 'mano', piezas: (e) => [...deClase('nube', 'etiqueta')(e), ...de(['lluvia', 'charco'])(e)], herramientas: ['flecha'], relaciones: ['causa'], arrastrar: true, sitios: [[26, 34], [50, 34], [74, 34]], orden: enOrden('nube', 'lluvia', 'charco') } },
      // v6.57 · igual que con «Trueno»: primero solo sacar la descripción; después, solo la herramienta
      { clave: 'sacar-desc', cara: 'piensa',
        texto: 'No ataques aún. Arrastra la carta «¿Qué soy?» a la mesa.',
        hecho: (e) => deClase('nube', 'definicion')(e).some((u) => e.tablero.some((t) => t.uid === u)) || trazosDe(e, 'identidad') >= 1,
        foco: { zona: 'mano', piezas: deClase('nube', 'definicion'), arrastrar: true, sitios: [[26, 52]] } },
      { clave: 'combo', cara: 'explica',
        texto: 'Toca «= Es lo mismo» y luego «Nube» y su descripción.',
        hecho: (e) => trazosDe(e, 'identidad') >= 1,
        foco: { zona: 'herramientas', herramientas: ['identidad'], piezas: de(['nube']), orden: enOrden('nube', 'nube:def') } },
      // v6.56 · dos pasos: primero solo sacar «Trueno»; después, solo la herramienta
      { clave: 'sacar-trueno',
        texto: 'Ahora arrastra «Trueno» a la mesa.',
        hecho: (e) => de(['trueno'])(e).some((u) => e.tablero.some((t) => t.uid === u)) || trazosDe(e, 'campo') >= 1,
        foco: { zona: 'mano', piezas: de(['trueno']), arrastrar: true, sitios: [[50, 52]] } },
      { clave: 'combo-campo', cara: 'explica',
        texto: 'Toca «◯ Van juntos» y luego Nube, Trueno y Lluvia: las tres son de una tormenta.',
        hecho: (e) => trazosDe(e, 'campo') >= 1,
        foco: { zona: 'herramientas', herramientas: ['campo'], piezas: de(['nube', 'trueno', 'lluvia']), orden: enOrden('nube', 'lluvia', 'trueno') } },
      { clave: 'estallido', cara: 'anima',
        texto: '¡Ahora sí! Pulsa «Afirmar» y mira.',
        hecho: (e) => e.enemigos.every((x) => x.hp <= 0) || e.turno > 2,
        foco: { zona: 'afirmar' } }
    ]
  }
]

/** Los avisos que van apareciendo. Se muestran una vez cada uno. */
export const PASOS_TUTORIAL: { clave: string; titulo: string; texto: string }[] = [
  {
    clave: 'arrastrar', titulo: 'Primero, saca las piezas',
    texto: 'Arrastra dos cartas de la derecha al tablero. Una es un nombre («Nube») y otra una descripción. Todavía no pasa nada: solo las estás poniendo sobre la mesa.'
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

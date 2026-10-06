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
  { id: 'disidente', nombre: 'Llevar la contraria', rareza: 'comun',
    regla: 'Las conexiones «contrasta» valen mucho más.',
    costo: 'Las de «apoya» valen menos.',
    mod: { multPorTipo: { contrasta: 1.6, apoya: -0.3 } } },
  { id: 'causalista', nombre: 'Causa y efecto', rareza: 'comun',
    regla: 'Las conexiones de causa, requisito y orden valen más.',
    costo: 'Cuidado con poner la causa al revés.',
    mod: { multPorTipo: { causa: 0.9, requiere: 0.9 }, multPorHerramienta: { secuencia: 1 } } },
  { id: 'taxonomo', nombre: 'Ordenar por grupos', rareza: 'comun',
    regla: 'Decir «esto incluye a aquello» o «esto es un ejemplo» vale más.',
    costo: 'Estas conexiones aparecen poco en los textos.',
    mod: { multPorTipo: { generaliza: 1.1, ejemplifica: 1.1 }, multPorHerramienta: { jerarquia: 0.9 } } },

  /* ---- eje: herramienta ---- */
  { id: 'topografo', nombre: 'Agrupar', rareza: 'comun',
    regla: '«Van juntos» y «Se parecen en» valen mucho más.',
    costo: 'Tienes que saber qué temas van juntos.',
    mod: { multPorHerramienta: { campo: 1.2, eje: 1.2 } } },
  { id: 'lexicografo', nombre: 'Buena memoria', rareza: 'comun',
    regla: 'Unir un nombre con su descripción vale el triple.',
    costo: 'Llena poco tu Atlas.',
    mod: { multPorHerramienta: { identidad: 1.4 }, fichasPorSostenido: 3 } },
  { id: 'traductor', nombre: 'Casos reales', rareza: 'comun',
    regla: 'Explicar un caso vale mucho más.',
    costo: 'Los casos ocupan espacio en tu mano.',
    mod: { multPorHerramienta: { ancla: 1.4 } } },
  { id: 'abogado', nombre: 'Poner a prueba', rareza: 'rara',
    regla: '«Lo pone a prueba» vale muchísimo más.',
    costo: 'Hay pocas tesis en cada texto.',
    mod: { multPorHerramienta: { balanza: 2 } } },

  /* ---- eje: combos y estructura ---- */
  { id: 'arquitecto', nombre: 'Ataques largos', rareza: 'rara',
    regla: 'Entre más conexiones unidas en un ataque, mucho más daño.',
    costo: 'Un error baja todo el ataque.',
    mod: { multPorCombo: { articulacion: 1, constelacion: 1.5 } } },
  { id: 'umbral', nombre: 'Ideas clave', rareza: 'comun',
    regla: 'Cada idea clave del texto en tu ataque suma más.',
    costo: 'Las ideas clave son las más difíciles.',
    mod: { multPorUmbral: 0.6 } },
  { id: 'artillero', nombre: 'Golpe amplio', rareza: 'rara',
    regla: 'Tu ataque alcanza a dos enemigos más.',
    costo: 'El daño se reparte entre ellos.',
    mod: { alcanceExtra: 2 } },

  /* ---- eje: mano y herramientas ---- */
  { id: 'fichero', nombre: 'Más cartas', rareza: 'comun',
    regla: 'Robas dos cartas más cada turno.',
    costo: 'Sin desventaja.',
    mod: { manoExtra: 2 } },
  { id: 'cinturon', nombre: 'Más herramientas', rareza: 'rara',
    regla: 'Un «Se conecta» y un «Van juntos» extra por turno.',
    costo: 'Más conexiones, más formas de fallar.',
    mod: { herramientasExtra: ['flecha', 'campo'] as HerramientaId[] } },
  { id: 'mano_rapida', nombre: 'Más cambios', rareza: 'comun',
    regla: 'Puedes cambiar dos cartas más por combate.',
    costo: 'Sin desventaja.',
    mod: { cambiosExtra: 2 } },
  { id: 'impulso', nombre: 'Racha de cartas', rareza: 'rara',
    regla: 'Cada conexión correcta te da una carta nueva.',
    costo: 'Las cartas falsas vuelven más rápido.',
    mod: { robarPorAcierto: 1 } },

  /* ---- eje: discriminación y tinta ---- */
  { id: 'inquisidor', nombre: 'Cazador de falsas', rareza: 'comun',
    regla: 'Puedes quemar dos cartas más por combate, y acertar da el doble de premio.',
    costo: 'No mejora tus ataques.',
    mod: { quemasExtra: 2 } },
  { id: 'ojo_critico', nombre: 'Detector de falsas', rareza: 'rara',
    regla: 'Al empezar cada combate, dos cartas falsas salen marcadas.',
    costo: 'Te acostumbras a que te avisen.',
    mod: { revelaApocrifas: 2, quemasExtra: 1 } },
  { id: 'cuaderno', nombre: 'Mano grande', rareza: 'comun',
    regla: 'Una carta más en la mano y dos cambios más por combate.',
    costo: 'Sin desventaja.',
    mod: { manoExtra: 1, cambiosExtra: 2 } },

  /* ---- eje: la escalera de veredictos ---- */
  { id: 'deductor', nombre: 'Deducir', rareza: 'rara',
    regla: 'Lo que deduces, aunque el texto no lo diga directo, vale casi igual.',
    costo: 'Las deducciones no entran a tu Atlas.',
    mod: { fichasPorInferencia: 18 } },
  { id: 'aproximador', nombre: 'Casi acierto', rareza: 'comun',
    regla: 'Si la conexión existe pero el tipo no es exacto, igual suma.',
    costo: 'No te empuja a ser preciso.',
    mod: { multPorAproximado: 0.5 } },
  { id: 'intuitivo', nombre: 'Corazonada', rareza: 'comun',
    regla: 'Las conexiones que «podrían ser» ya valen algo.',
    costo: 'Premia estar cerca, no acertar.',
    mod: { plausibleCuenta: true } },
  { id: 'temerario', nombre: 'Sin miedo', rareza: 'rara',
    regla: 'Poner una conexión al revés ya no te quita vida.',
    costo: 'Igual no suma puntos.',
    mod: { sinCastigoInvertido: true } },

  /* ---- únicas ---- */
  { id: 'coleccionista', nombre: 'Fuerza extra', rareza: 'unica',
    regla: 'Todos tus ataques pegan más y alcanzan a un enemigo más.',
    costo: 'Sin desventaja.',
    mod: { multGlobal: 0.8, alcanceExtra: 1 } },
  { id: 'escriba', nombre: 'Todo en uno', rareza: 'unica',
    regla: 'Más cartas en la mano, una herramienta extra y tinta en cada combate.',
    costo: 'Es cara.',
    mod: { manoExtra: 1, herramientasExtra: ['identidad'] as HerramientaId[], fichasPorSostenido: 4 } },

  /* ---- las mayores: la capa ×mult. No suman al filo: multiplican TODO. ----
     Sus condiciones son las conductas cognitivas más caras, así que perseguir
     el número gigante es perseguir la jugada difícil. No se regalan: son
     raras o únicas, y las únicas exigen además su hazaña. */
  { id: 'anclista', nombre: 'Experto en casos', rareza: 'rara',
    regla: '×1.5 de daño si tu ataque explica bien un caso.',
    costo: 'Sin un caso en la mesa no hace nada.',
    mod: { xmults: [{ id: 'anclista', nombre: 'Experto en casos', factor: 1.5, cuando: 'ancla' }] } },
  { id: 'polifonia', nombre: 'Variedad', rareza: 'rara',
    regla: '×1.5 de daño si usas tres herramientas distintas en un ataque.',
    costo: 'Repetir la misma herramienta no sirve.',
    mod: { xmults: [{ id: 'polifonia', nombre: 'Variedad', factor: 1.5, cuando: 'variedad' }] } },
  { id: 'puno_disidente', nombre: 'Puro contraste', rareza: 'rara',
    regla: '×1.5 de daño con dos «contrasta» correctos y ningún «apoya».',
    costo: 'Un solo «apoya» lo apaga.',
    mod: { xmults: [{ id: 'puno_disidente', nombre: 'Puro contraste', factor: 1.5, cuando: 'oposicion' }] } },
  { id: 'reliquia_traductor', nombre: 'Comparación maestra', rareza: 'rara',
    regla: '×2 de daño si tu ataque tiene un «Es como» correcto.',
    costo: 'Es la jugada más difícil.',
    mod: { xmults: [{ id: 'reliquia_traductor', nombre: 'Comparación maestra', factor: 2, cuando: 'analogia' }] } },
  { id: 'catedral', nombre: 'Ataque perfecto', rareza: 'unica',
    regla: '×3 de daño con cuatro conexiones correctas y ningún error.',
    costo: 'Un error la apaga.',
    mod: { xmults: [{ id: 'catedral', nombre: 'Ataque perfecto', factor: 3, cuando: 'constelacion' }] } },
  { id: 'aleph', nombre: 'De todo un poco', rareza: 'unica',
    regla: '×2.5 de daño si usas cuatro tipos de carta distintos en un ataque.',
    costo: 'Pide usar todo tu material a la vez.',
    mod: { xmults: [{ id: 'aleph', nombre: 'De todo un poco', factor: 2.5, cuando: 'mestizaje4' }] } },
  /* ---- v6.25 · las del mapa: premian construir sobre lo ya sostenido, no repetir ---- */
  { id: 'diapason', nombre: 'Mapa fuerte', rareza: 'comun',
    regla: 'Tu mapa dorado pega un 60 % más fuerte cada turno.',
    costo: 'No hace nada hasta que tengas cartas doradas.',
    mod: { mapaGolpe: 0.6 } },
  { id: 'cartografa', nombre: 'Construir sobre lo hecho', rareza: 'rara',
    regla: 'Cada conexión nueva que toca tu mapa dorado vale casi el doble.',
    costo: 'Las conexiones sueltas valen igual que antes.',
    mod: { mapaEnlace: 0.4 } },
  { id: 'orfebre', nombre: 'Cartas doradas', rareza: 'comun',
    regla: '+2 puntos por cada carta dorada en la mesa al atacar.',
    costo: 'Empieza en cero en cada sala.',
    mod: { doradaFichas: 2 } },
  { id: 'tinta_viva', nombre: 'Recuperar vida', rareza: 'comun',
    regla: 'Cada conexión correcta te devuelve 1 de vida.',
    costo: 'No pega más fuerte.',
    mod: { curaPorSostenido: 1 } },
  { id: 'segunda_lectura', nombre: 'Pista gratis', rareza: 'comun',
    regla: 'La primera pista de cada combate es gratis.',
    costo: 'La conexión con pista vale un poco menos.',
    mod: { pistasGratis: 1 } },
  { id: 'prisma_bolsillo', nombre: 'Ataque final rápido', rareza: 'rara',
    regla: 'El ataque final se activa con tres conexiones unidas en vez de cuatro.',
    costo: 'Mapas más pequeños.',
    mod: { cristalMenos: 1 } },
  /* ---- las escaladoras: el motor crece por JUGAR bien, no por lootear ---- */
  { id: 'cuaderno_hereje', nombre: 'Premio por quemar', rareza: 'rara',
    regla: 'Cada carta falsa que quemas hace más fuertes todos tus ataques.',
    costo: 'Empieza sin hacer nada.',
    mod: {} },
  { id: 'pluma_que_aprende', nombre: 'Premio por deducir', rareza: 'rara',
    regla: 'Cada deducción que haces suma puntos a tus próximos ataques.',
    costo: 'Solo crece deduciendo.',
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
    out.mapaGolpe += m.mapaGolpe ?? 0
    out.mapaEnlace += m.mapaEnlace ?? 0
    out.doradaFichas += m.doradaFichas ?? 0
    out.curaPorSostenido += m.curaPorSostenido ?? 0
    out.pistasGratis += m.pistasGratis ?? 0
    out.cristalMenos = Math.max(out.cristalMenos, m.cristalMenos ?? 0)
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

/** v6.36 · mejoras que dependían de quemar o cambiar cartas: ya no se ofrecen */
export const LENTES_RETIRADAS = ['inquisidor', 'ojo_critico', 'cuaderno_hereje', 'mano_rapida']
export const LENTES_VIVAS = LENTES.filter((l) => !LENTES_RETIRADAS.includes(l.id))

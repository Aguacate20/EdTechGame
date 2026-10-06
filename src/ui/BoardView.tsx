import { useMemo, useRef, useState, useEffect } from 'react'
import { TutorialVelo } from './TutorialVelo'
import { GolpeMayor, PaginaEnBlanco, escalonDeGolpe } from './Estallido'
import { porqueDe } from '../engine/significativo'
import { orientar } from '../engine/feedback'
import { puedeCristalizar, estadoCristalizacion, progresoCristal, componenteCristalizable, guiaCristal } from '../engine/battle'
import type { Contenido } from '../content/types'
import type { Pieza } from '../engine/pieces'
import {
  borrarTrazo, devolverAMano, herramientasLibres, soltar, trazar, trazosQueUsan, vivos,
  type EstadoBatalla
} from '../engine/battle'
import {
  aceptaEnRanura, evaluarDiagrama, HERRAMIENTAS, listaHerramientas, pistaDeRanura,
  type HerramientaId, type ModificadoresLente
} from '../engine/tools'
import { tipoPorId } from '../engine/lane'
import { oleadaActual } from '../engine/battle'
import { lentePorId, selloPorId, type SelloId } from '../engine/powers'
import { LaneView, compasDelGolpe } from './LaneView'
import { usarManifest } from './assets'
import { GLOSA_RELACION as GLOSA } from './glosas'
import { Chip } from './components'
import { BANDA, NOMBRE_CLASE, coloresCompatibles, cedulaDe, estiloDeCedula, estiloRelacion, ondaEntre } from './identity'
import { useCascada } from './cascade'
import { despertarAudio, sfx } from './sfx'
import { consejoDeForma, encargoCumplido, previsualizarForma, type Encargo } from '../engine/srl'
import { condicionPorId } from '../engine/hazanas'

export interface AccionesBatalla {
  /** v5.62 · apuesta metacognitiva al empezar la oleada (modo aprendizaje) */
  apostarOleada?: (valor: 'si' | 'no') => void
  /** v6.24 · el porqué de un vínculo sostenido: qué frase del texto lo respalda */
  porque?: (acierto: boolean, clave: string) => void
  /** v5.67 · el mapa de la sala golpea entero */
  cristalizar?: () => void
  /** v5.82 */
  pedirPista?: () => void
  /** v5.85 */
  ordenar?: () => void
  cambio: (mut: (e: EstadoBatalla) => void) => void
  afirmar: () => void
  continuar: () => void
  quemar: (uid: string) => void
  cambiar: (uid: string) => void
  sello: (id: SelloId) => void
  huir: () => void
  /** sello de confianza sobre el diagrama de este turno */
  sellar: (v: boolean) => void
  /** encargo de la sala: solo antes del primer trazo */
  elegirEncargo: (en: Encargo | null) => void
}

const COLOR_ESTADO: Record<string, string> = {
  sostenido: 'var(--verdigris)', equivalente: 'var(--verdigris)',
  compatible: 'var(--verdigris)', derivado: '#7fa8d6',
  // la capa propia del lector va en violeta: lo insinuado (respaldado por el
  // texto entre líneas) más saturado que la propuesta (cercanía en el grafo)
  insinuado: '#c4a6ee', propuesta: '#a78bd0',
  aproximado: 'var(--laton)', convive: 'var(--laton)', plausible: '#8a7fa6',
  silencio: 'var(--niebla)',
  invertido: 'var(--oxido)', error: 'var(--oxido)'
}
const ETIQUETA_ESTADO: Record<string, string> = {
  sostenido: 'el texto lo dice', equivalente: 'el texto lo dice (al revés)',
  compatible: 'cierto, pero con otro vínculo',
  derivado: 'se sigue del texto', aproximado: 'casi: el vínculo es otro',
  insinuado: 'el texto lo insinúa', propuesta: 'lo propones tú',
  convive: 'el texto los junta, no los enlaza', plausible: 'solo comparten página',
  silencio: 'el mapa no lo registra',
  invertido: 'al revés', error: 'falso'
}
const TONO_NOTA: Record<string, string> = {
  sostenido: 'ok', equivalente: 'ok', compatible: 'ok', derivado: 'ok', aproximado: 'nota',
  insinuado: 'ok', propuesta: 'nota', convive: 'nota',
  plausible: 'nota', silencio: 'nota', invertido: 'mal', error: 'mal'
}
/** v6.31 · en la mano, la etiqueta dice con qué se empareja la carta */
const ETIQUETA_MANO: Partial<Record<Pieza['clase'], string>> = {
  etiqueta: 'Nombre · busca su descripción', definicion: 'Descripción · busca su nombre',
  concepto: 'Idea · se conecta con otras ideas', apocrifa: 'Idea · se conecta con otras ideas',
  caso: 'Ejemplo · va con las ideas que lo explican', tesis: 'Afirmación · va con sus pruebas',
  criterio: 'Prueba · va con su afirmación', marco: 'Tema · agrupa ideas',
  intuicion: 'Creencia común · compárala con una idea', contexto: 'Dónde aplica · va con una idea',
  subdimension: 'Parte · va con su idea'
}
const ETIQUETA: Record<Pieza['clase'], string> = {
  etiqueta: 'Nombre', definicion: 'Descripción', concepto: 'Idea',
  apocrifa: 'Idea', caso: 'Ejemplo', tesis: 'Afirmación', criterio: 'Prueba',
  marco: 'Tema', intuicion: 'Creencia común', subdimension: 'Parte', contexto: 'Dónde aplica'
}


/** Cómo se lee la afirmación que se está montando, según la herramienta. */
const VERBO_RELACION: Record<string, string> = {
  apoya: 'respalda o da evidencia a',
  causa: 'produce',
  requiere: 'necesita antes',
  contrasta: 'se opone o se distingue de',
  generaliza: 'abstrae a',
  ejemplifica: 'es un caso concreto de',
  extiende: 'amplía el alcance de',
  matiza: 'precisa o limita a'
}

function conectorDe(id: string, i: number, param: string | null): string {
  switch (id) {
    case 'flecha': return param ? (VERBO_RELACION[param] ?? param) : 'elige el vínculo abajo'
    case 'identidad': return 'es'
    case 'jerarquia': return 'contiene a'
    case 'secuencia': return 'lleva a'
    case 'ancla': return i === 0 ? 'opera con' : 'y con'
    case 'balanza': return 'se limita con'
    case 'contraejemplo': return i === 0 ? 'NO opera' : 'ni'
    case 'analogia': return i === 1 ? 'es a lo que' : 'es a'
    case 'alcance': return 'vale bajo'
    case 'descomposicion': return i === 0 ? 'se compone de' : 'y de'
    case 'campo': return 'junto a'
    case 'eje': return 'y'
    default: return '·'
  }
}

const recorte = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)

const AYUDA_DORADA =
  '\n\n\u2726 DORADA \u2014 la fusionaste emparejando nombre y descripci\u00f3n. Entra completa, vale m\u00e1s fichas y ocupa un solo hueco de la mano.'
/** v6.1 · qué herramientas admiten cada clase de carta: solo sus símbolos */
const HERRAMIENTAS_DE_CLASE: Partial<Record<string, HerramientaId[]>> = {
  concepto: ['flecha', 'campo', 'jerarquia', 'secuencia', 'eje', 'analogia', 'alcance', 'descomposicion'],
  etiqueta: ['identidad', 'flecha', 'campo', 'jerarquia', 'secuencia', 'eje', 'analogia', 'alcance'],
  definicion: ['identidad'],
  subdimension: ['descomposicion', 'eje'],
  caso: ['ancla', 'contraejemplo'],
  tesis: ['balanza'],
  criterio: ['balanza'],
  marco: ['flecha']
}
const simbolosDe = (p: Pieza): string => {
  if (p.clase === 'intuicion' || p.clase === 'apocrifa') return '🔥'
  return (HERRAMIENTAS_DE_CLASE[p.clase] ?? []).map((h) => HERRAMIENTAS[h].glifo).join('  ')
}
/** v6.43 · los globos negros al pasar el ratón y el recuadro que seguía al cursor se retiraron:
 *  lo que hay que leer está en la carta, y lo largo se abre con «+» */
const SIN_GLOBOS: boolean = true

const ayudaDe = (p: Pieza) =>
  `${ETIQUETA[p.clase].toUpperCase()} · ${p.titulo}${p.cuerpo ? `\n\n${p.cuerpo}` : ''}${simbolosDe(p) ? `\n\n${simbolosDe(p)}` : ''}`

export function BoardView({ e, contenido, lentes, on, lucidez, lucidezMax, lentesIds, guia, fondo, alCerrarCascada, alCaerEnemigo,
  }: {
  e: EstadoBatalla; contenido: Contenido; lentes: ModificadoresLente
  on: AccionesBatalla; lucidez: number; lucidezMax: number; lentesIds: string[]
  /** paso del tutorial que toca ahora, si estamos en él */
  /** v6.20 · avisa una vez por turno cuando la cuenta del diagrama termina de subir */
  alCerrarCascada?: (dano: number, sostenidos: number, xmult: number) => void
  /** v6.41 · avisa en el instante en que el primer enemigo recibe el golpe */
  alCaerEnemigo?: (dano: number, sostenidos: number, xmult: number) => void
  guia?: {
    titulo?: string; texto: string; indice: number; total: number
    clave?: string; alEntender?: () => void
    centro?: boolean; boton?: string; cara?: string
    hechoUI?: (ui: { herramienta: string | null; pendientes: number; param: string | null; seleccion: string | null }) => boolean
    alCumplir?: () => void
    foco?: { zona: string; piezas?: string[]; herramientas?: HerramientaId[]; relaciones?: string[]; ilumina?: string[]; arrastrar?: boolean }
  } | null
  fondo?: { n: number; sala?: string | null }
}) {
  const lienzo = useRef<HTMLDivElement>(null)
  const [herramienta, setHerramienta] = useState<HerramientaId | null>(null)
  const [param, setParam] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<string[]>([])
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [trazoAbierto, setTrazoAbierto] = useState<string | null>(null)
  const [leyenda, setLeyenda] = useState(false)
  const manifiesto = usarManifest()
  /** textura opcional del cuerpo de la carta ("cartas" en manifest.json);
   *  la apócrifa usa SIEMPRE la del concepto: el camuflaje no se negocia */
  const texturaDe = (clase: string): string | undefined => {
    const cartas = (manifiesto as Record<string, unknown> | null)?.cartas as Record<string, string> | undefined
    const src = cartas?.[clase === 'apocrifa' ? 'concepto' : clase]
    return src ? `url(${import.meta.env.BASE_URL}art/${src}) center/cover` : undefined
  }

  const [confirmar, setConfirmar] = useState<{ uid: string; trazos: number } | null>(null)
  const [acuseCerrado, setAcuseCerrado] = useState<string | null>(null)
  const [ayuda, setAyuda] = useState<{ texto: string; x: number; y: number } | null>(null)
  /** v6.0 · globo fijo: la descripción de una carta dorada al tocarla sin herramienta */
  const [resaltarCristal, setResaltarCristal] = useState<Set<string> | null>(null)
  const [ayudaFija, setAyudaFija] = useState<{ texto: string; x: number; y: number; uid: string } | null>(null)
  const [raton, setRaton] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  /** v6.43 · la ficha completa de una carta o mejora, en un cuadro propio (botón «+») */
  const [detalle, setDetalle] = useState<{ tt: string; color: string; titulo: string; cuerpo: string } | null>(null)
  const abrirDetalle = (p: Pieza) => setDetalle({ tt: ETIQUETA[p.clase], color: BANDA[p.clase], titulo: p.titulo, cuerpo: [p.cuerpo, p.explicacion && p.clase !== 'apocrifa' ? p.explicacion : '', p.partes?.length ? `Partes: ${p.partes.join(' · ')}` : ''].filter(Boolean).join('\n\n') })
  /** pieza del tablero bajo el cursor: se previsualiza en la ranura siguiente */
  const [previsualizada, setPrevisualizada] = useState<string | null>(null)
  /** el rastro solo estorba fuera del tablero: allí no hay nada que señalar */
  const [sobreTablero, setSobreTablero] = useState(false)

  // Un solo tooltip en posición fija para toda la pantalla. Antes se pintaba con
  // ::after dentro de cada elemento, y los contenedores con overflow lo cortaban.
  const seguirRaton = (ev: React.MouseEvent) => {
    setRaton({ x: ev.clientX, y: ev.clientY })
    if (SIN_GLOBOS) { if (ayuda) setAyuda(null); return }
    const destino = (ev.target as HTMLElement).closest('[data-ayuda]') as HTMLElement | null
    // con una herramienta en la mano, la descripción se lee en el rastro y no
    // en un globo aparte: dos cuadros a la vez confunden más de lo que ayudan
    if (herramienta && destino?.classList.contains('en-tablero')) {
      if (ayuda) setAyuda(null)
      return
    }
    // v5.96 · una carta dorada no muestra globo (estorba al moverla), y mientras se arrastra, ninguno
    if (arrastrando || destino?.dataset.armada === 'true') { if (ayuda) setAyuda(null); return }
    const texto = destino?.dataset.ayuda
    if (!texto) { if (ayuda) setAyuda(null); return }
    const ancho = 330
    const x = Math.min(Math.max(12, ev.clientX - ancho / 2), window.innerWidth - ancho - 12)
    const y = ev.clientY
    setAyuda({ texto, x, y })
  }

  const previa = useMemo(
    () => evaluarDiagrama(contenido, e.mano, e.trazos, lentes),
    [contenido, e.mano, e.trazos, lentes]
  )
  const resuelto = e.fase !== 'jugando'
  const foto = resuelto ? e.ultima?.foto : null
  const casc = useCascada(resuelto && e.ultima ? e.ultima.diag : null, resuelto)
  /** máquina de gestos del héroe: ataca al resolver, acusa el golpe recibido,
   *  y vuelve al reposo — sin bucles raros */
  const [gestoHeroe, setGestoHeroe] = useState('quieto')
  const manifestArte = usarManifest()
  /** la Página en Blanco es materia de leyenda: UN golpe que derriba a 3+
   *  enemigos que estaban con la vida llena. Limpiar una sala a mordiscos no
   *  la gasta — por eso sigue sintiéndose enorme cuando pasa. */
  // v6.38 · en el tutorial no salta: el golpe grande se guarda para el ataque final
  const aniquilacion = !!(!guia && resuelto && casc.terminada && e.ultima &&
    e.ultima.impactos.filter((i) => i.derribado && i.pleno).length >= 3)
  const borronSonado = useRef(-1)
  const cascadaAvisada = useRef(-1)
  /** v6.28 · el ataque final, listo o a un vínculo: se ilumina lo que toca (no en el tutorial) */
  const gc = useMemo(() => (guia ? null : guiaCristal(e, { contenido, rng: { next: () => 0 } as never, lentes })), [e, contenido, lentes, guia])
  const cristalListo = gc?.estado === 'listo' ? new Set(gc.uids) : null
  const faltaIds = gc?.estado === 'casi' ? [gc.a, gc.b] : []
  const faltaEn = (p: Pieza) => !!p.conceptId && faltaIds.includes(p.conceptId) && (p.clase === 'concepto' || p.clase === 'etiqueta' || p.clase === 'definicion')
  /** v6.24 · un porqué por oleada, sobre el primer vínculo sostenido que tenga frase que citar */
  const [porqueResp, setPorqueResp] = useState<{ clave: string; elegido: string; ok: boolean } | null>(null)
  const porqueOleada = useRef<string | null>(null)
  const porque = useMemo(() => {
    if (!on.porque || guia || !e.apoyo || !resuelto || !e.ultima) return null
    for (const v of e.ultima.diag.veredictos) {
      if (v.estado !== 'sostenido' || v.trazo.tool !== 'flecha' || !v.aristas[0]) continue
      const p = porqueDe(contenido, v.aristas[0])
      if (p) return p
    }
    return null
  }, [e.ultima, resuelto, e.apoyo, contenido, guia, on.porque])
  const marcaOleada = `${e.oleadaIdx}`
  const porqueVisible = !!porque && casc.terminada && (porqueOleada.current === null || porqueOleada.current === `${marcaOleada}:${e.turno}` || porqueOleada.current.split(':')[0] !== marcaOleada)
  useEffect(() => { setPorqueResp(null) }, [e.turno])
  useEffect(() => {
    if (!(resuelto && casc.terminada && e.ultima) || !alCerrarCascada || cascadaAvisada.current === e.turno) return
    cascadaAvisada.current = e.turno
    const buenos = e.ultima.diag.veredictos.filter((v) => v.estado !== 'error' && v.estado !== 'invertido' && v.estado !== 'silencio').length
    alCerrarCascada(e.ultima.danoTotal, buenos, e.ultima.diag.xmult)
  }, [resuelto, casc.terminada, e.ultima, e.turno, alCerrarCascada])
  const titanSonado = useRef(-1)
  useEffect(() => {
    if (!(resuelto && casc.terminada && e.ultima) || aniquilacion) return
    const d = e.ultima.danoTotal
    const tier = d >= 100000 ? 4 : d >= 10000 ? 3 : d >= 1000 ? 2 : 0
    if (tier >= 2 && titanSonado.current !== e.turno) {
      titanSonado.current = e.turno
      sfx.titan(tier)
    }
  }, [resuelto, casc.terminada, e.ultima, e.turno, aniquilacion])
  useEffect(() => {
    if (aniquilacion && borronSonado.current !== e.turno) {
      borronSonado.current = e.turno
      const golpes = e.ultima?.impactos.length ?? 1
      const espera = 340 + 150 * golpes
      const t = setTimeout(() => sfx.borron(), espera)
      return () => clearTimeout(t)
    }
  }, [aniquilacion, e.turno])
  useEffect(() => {
    if (!(resuelto && casc.terminada && e.ultima)) { setGestoHeroe('quieto'); return }
    const r = e.ultima
    setGestoHeroe(r.danoTotal > 0 ? 'afirma' : r.danoRecibido > 0 ? 'herido' : 'quieto')
    const ts: ReturnType<typeof setTimeout>[] = []
    // v6.4 · el compás: Andy termina SU ataque → pausa → responden los enemigos → Andy acusa el golpe
    const c = compasDelGolpe(r.danoTotal > 0 ? r.disparo : null, manifestArte, r.impactos.length)
    const finAndy = Math.max(c.clip, c.finImpactos) + 160
    if (r.danoTotal > 0) ts.push(setTimeout(() => setGestoHeroe('quieto'), finAndy))
    if (r.danoRecibido > 0) {
      const golpe = (r.danoTotal > 0 ? c.inicioEnemigos : 0) + 320
      if (r.danoTotal > 0) ts.push(setTimeout(() => setGestoHeroe('herido'), golpe))
      ts.push(setTimeout(() => setGestoHeroe('quieto'), golpe + 700))
    }
    return () => ts.forEach(clearTimeout)
  }, [resuelto, casc.terminada, e.ultima])

  const enMano = e.mano.filter((p) => !e.tablero.some((t) => t.uid === p.uid))
  const enTablero = foto
    ? foto.tablero.map((t) => ({ t, p: foto.piezas.find((x) => x.uid === t.uid) }))
        .filter((x): x is { t: typeof x.t; p: Pieza } => !!x.p)
    : e.tablero.map((t) => ({ t, p: e.mano.find((x) => x.uid === t.uid) ?? e.descarte.find((x) => x.uid === t.uid) }))
        .filter((x): x is { t: typeof x.t; p: Pieza } => !!x.p)
  // v5.96 · las flechas doradas se ven también en la fase resuelta (la foto solo trae las del turno)
  const trazosVisibles = foto ? [...(e.armados ?? []).filter((a) => !foto.trazos.some((t) => `armado:${t.uid}` === a.uid)), ...foto.trazos] : [...(e.armados ?? []), ...e.trazos]
  const esArmado = (uid: string) => uid.startsWith('armado:')
  const posiciones = foto ? foto.tablero : e.tablero
  const veredictos = resuelto && e.ultima ? e.ultima.diag.veredictos : previa.veredictos

  const libres = herramientasLibres(e)
  const objetivo = vivos(e).sort((a, b) => a.posicion - b.posicion)[0]
  const h = herramienta ? HERRAMIENTAS[herramienta] : null
  const puedeCerrar = !!h && pendientes.length >= h.aridad[0] && (!h.parametro || !!param)
  /** el vínculo ya vive en el Atlas: certeza a la vista ANTES de afirmar */
  const esAsentado = (t: { tool: string; param: string | null; piezas: string[] }): boolean => {
    if (t.tool !== 'flecha' || !t.param) return false
    const ids = t.piezas
      .map((u) => [...e.mano, ...e.descarte].find((p) => p.uid === u))
      .filter((p) => p && p.clase !== 'apocrifa')
      .map((p) => p!.conceptId)
    if (ids.length < 2 || !ids[0] || !ids[1]) return false
    return e.asentadas.includes(`${ids[0]}|${ids[1]}|${t.param}`) ||
      (t.param === 'contrasta' && e.asentadas.includes(`${ids[1]}|${ids[0]}|${t.param}`))
  }
  const piezaSel = enMano.find((p) => p.uid === seleccion) ?? null
  // anticipación sin trampa: forma del diagrama, nunca su verdad
  const forma = useMemo(
    () => previsualizarForma(e.trazos, [...e.mano, ...e.descarte]),
    [e.trazos, e.mano, e.descarte]
  )
  // v6.36 · los retos de sala se retiraron
  void piezaSel; void forma; void consejoDeForma
  const encargoPendiente = false as boolean
  const cumplido = e.encargo ? encargoCumplido(e.encargo, {
    vinculosSostenidos: e.hallazgos.vinculos.length, combosVistos: e.combosVistos,
    conceptosSostenidos: e.conceptosSostenidos, quemasAcertadas: e.quemasAcertadas,
    errores: e.erroresTotales, invertidos: e.invertidosTotales
  }) : false

  /* --- foco del tutorial: se ilumina lo que toca y lo demás queda inerte --- */
  // v6.18 · mientras se resuelve el ataque no hay foco: la pantalla entera se enciende para verlo
  // v6.31 · al terminar la cuenta, el tutorial enciende solo el resultado y el botón de seguir
  // v6.32 · la luz del resultado espera a que Andy termine de atacar
  const [ataqueVisto, setAtaqueVisto] = useState(false)
  useEffect(() => {
    if (!(resuelto && casc.terminada)) { setAtaqueVisto(false); return }
    const t = window.setTimeout(() => setAtaqueVisto(true), 2600)
    return () => window.clearTimeout(t)
  }, [resuelto, casc.terminada, e.turno])
  const foco = resuelto ? (guia && casc.terminada && ataqueVisto && e.ultima ? { zona: 'resultado' } as NonNullable<typeof guia>['foco'] : undefined) : guia?.foco
  const burbujaRef = useRef<HTMLElement>(null)
  const fichaAndy = usarManifest()?.['jugador/copista'] as { escala?: number } | undefined
  void fichaAndy // const escalaAndy = typeof fichaAndy?.escala === 'number' ? fichaAndy.escala : 1
  /** v6.15 · el cuadro de instrucción se puede ocultar; vuelve con el paso siguiente */
  const [guiaOculta, setGuiaOculta] = useState<string | null>(null)
  const guiaVisible = !!guia && guiaOculta !== `${guia.clave ?? guia.indice}`
  /** v5.87 · cámara de la mesa: el mundo es uno; la vista lo escala entero y se desplaza
   *  (arrastrar el fondo, dos dedos en el trackpad, Ctrl+rueda para zoom) */
  const [zoom, setZoom] = useState(0.75)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panRef = useRef<{ x0: number; y0: number; px: number; py: number } | null>(null)
  /** v6.5 · la cámara nunca sale de la mesa: el desplazamiento se acota a lo que el mundo
   *  (200 % de la ventana, escalado) cubre de verdad; así no hay «zona muerta» sin retorno */
  const acotarPan = (p: { x: number; y: number }, z: number) => {
    const v = lienzo.current?.parentElement?.getBoundingClientRect()
    if (!v) return p
    const mx = Math.max(0, ((2 * z - 1) / 2) * v.width), my = Math.max(0, ((2 * z - 1) / 2) * v.height)
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) }
  }
  const zoomRef = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom; setPan((q) => acotarPan(q, zoom)) }, [zoom])
  /** v6.5 · la carta dorada que se está arrastrando: sin transición, pegada al puntero */
  const [moviendoUid, setMoviendoUid] = useState<string | null>(null)
  /** v5.99 · arrastre en vivo de cartas doradas (por puntero, sin HTML5 drag) */
  const moviendoRef = useRef<{ uid: string; raf: number | null } | null>(null)
  /** v6.1 · si el puntero se movió, fue arrastre, no clic */
  const seMovioRef = useRef(false)
  useEffect(() => {
    const el = lienzo.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      if (ev.ctrlKey || ev.metaKey) setZoom((z) => Math.max(0.35, Math.min(2, +(z - ev.deltaY * 0.0025).toFixed(3))))
      else setPan((q) => acotarPan({ x: q.x - ev.deltaX, y: q.y - ev.deltaY }, zoomRef.current))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  // v6.29 · pasos del tutorial que se cumplen con un gesto de interfaz (elegir «=», tocar dos cartas…)
  useEffect(() => {
    if (guia?.hechoUI?.({ herramienta, pendientes: pendientes.length, param, seleccion })) guia.alCumplir?.()
  }, [herramienta, pendientes, param, seleccion, guia?.clave])
  // v6.29 · la columna entera solo se enciende si el paso no señala nada concreto dentro de ella
  const zonaEntera = !!foco && !(foco.piezas?.length || foco.herramientas?.length) && (!foco.ilumina || foco.ilumina.includes('zona'))
  const zona = (z: string) => (foco?.zona === z && zonaEntera ? ' destacada' : '')
  const piezaLibre = (uid: string) => !foco?.piezas || foco.piezas.includes(uid)
  const herrLibre = (id: HerramientaId) => !foco?.herramientas || foco.herramientas.includes(id)

  const reset = () => {
    setHerramienta(null); setParam(null); setPendientes([]); setPrevisualizada(null)
  }

  /** v6.0 · desplazamiento de agarre: dónde tomaste la carta respecto a su centro (px) */
  const agarreRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const posicionEnLienzo = (ev: { clientX: number; clientY: number }, conAgarre = true) => {
    const r = lienzo.current?.getBoundingClientRect()
    if (!r) return { x: 50, y: 50 }
    const cx = ev.clientX - (conAgarre ? agarreRef.current.dx : 0)
    const cy = ev.clientY - (conAgarre ? agarreRef.current.dy : 0)
    // la carta nunca cae fuera de lo que se ve: límites de la ventana de la mesa, en % del mundo
    const z = lienzo.current?.parentElement?.getBoundingClientRect()
    const minX = z ? Math.max(6, ((z.left - r.left) / r.width) * 100 + 5) : 6
    const maxX = z ? Math.min(94, ((z.right - r.left) / r.width) * 100 - 5) : 94
    const minY = z ? Math.max(8, ((z.top - r.top) / r.height) * 100 + 5) : 8
    const maxY = z ? Math.min(90, ((z.bottom - r.top) / r.height) * 100 - 6) : 90
    return {
      x: Math.max(minX, Math.min(maxX, ((cx - r.left) / r.width) * 100)),
      y: Math.max(minY, Math.min(maxY, ((cy - r.top) / r.height) * 100))
    }
  }

  const tocarPieza = (uid: string) => {
    despertarAudio()
    if (resuelto) return
    if (h) {
      if (pendientes.includes(uid)) { setPendientes((x) => x.filter((y) => y !== uid)); return }
      const pieza = enTablero.find((x) => x.p.uid === uid)?.p
      // no se deja gastar la herramienta en una pieza que la ranura no admite
      if (!pieza || !aceptaEnRanura(h.id, pendientes.length, pieza)) return
      sfx.tomar()
      setPendientes((x) => [...x, uid])
      return
    }
    setSeleccion(seleccion === uid ? null : uid)
    setTrazoAbierto(null)
  }

  const pedirDevolver = (uid: string) => {
    if (resuelto) return
    const n = trazosQueUsan(e, uid).length
    if (n === 0) { on.cambio((st) => devolverAMano(st, uid)); sfx.deshacer(); return }
    setConfirmar({ uid, trazos: n })
  }

  const cerrarTrazo = () => {
    if (!herramienta || !puedeCerrar) return
    sfx.trazar()
    on.cambio((st) => { trazar(st, herramienta, pendientes, param) })
    reset()
  }

  return (
    <div
      className={`batalla${foco ? ' con-foco' : ''}`}
      onMouseMove={seguirRaton} onMouseLeave={() => setAyuda(null)}
    >
      {/* v6.22 · la Página en Blanco cubre la pantalla entera, no solo el carril */}
      {/* v6.27 · un golpe de 2000 o más se celebra (fuera del tutorial, que tiene su propio cierre) */}
      {resuelto && casc.terminada && e.ultima && !aniquilacion && !guia && escalonDeGolpe(e.ultima.danoTotal) && (
        <GolpeMayor key={`gm-${e.turno}`} dano={e.ultima.danoTotal} trazos={e.ultima.diag.sostenidos} />
      )}
      {aniquilacion && e.ultima && <PaginaEnBlanco key={e.turno} caidos={e.ultima.impactos.filter((x) => x.derribado).length} retardoMs={340 + 150 * e.ultima.impactos.length} />}
      {!SIN_GLOBOS && h && !resuelto && sobreTablero && (
        <div
          className="rastro"
          style={{
            left: Math.min(raton.x + 18, window.innerWidth - 250),
            top: Math.min(raton.y + 18, window.innerHeight - 150)
          }}
          aria-hidden
        >
          <span className="cabecera">
            <span className="glifo">{h.glifo}</span> {h.nombre}
          </span>
          {h.parametro === 'relacion' && param && (
            <span className="glosa-rastro">{GLOSA[param]}</span>
          )}
          {(() => {
            // ranuras: las fijadas, la que está bajo el cursor y el hueco siguiente
            const enPrevia = previsualizada && !pendientes.includes(previsualizada)
              ? previsualizada
              : null
            const cadena: { uid: string | null; previa: boolean }[] = [
              ...pendientes.map((uid) => ({ uid, previa: false })),
              ...(enPrevia && pendientes.length < h.aridad[1] ? [{ uid: enPrevia, previa: true }] : [])
            ]
            const faltan = Math.max(0, h.aridad[0] - cadena.length)
            const huecos = Array.from({ length: Math.min(faltan, 2) }, () => ({ uid: null, previa: false }))
            const todas = [...cadena, ...huecos]

            if (todas.length === 0) {
              return <span className="vacio">{h.ejemplo}</span>
            }
            return (
              <div className="cadena">
                {todas.map((slot, k) => {
                  const pieza = slot.uid ? enTablero.find((x) => x.p.uid === slot.uid)?.p : null
                  return (
                    <span key={k} className={`eslabon${slot.previa ? ' previa' : ''}${!slot.uid ? ' pendiente' : ''}`}>
                      {k > 0 && (
                        <i className="conector-rastro">{conectorDe(h.id, k - 1, param)}</i>
                      )}
                      <span className="marca-ranura">{String.fromCharCode(65 + k)}</span>
                      {pieza ? (
                        <>
                          <b>{pieza.titulo}</b>
                          {pieza.cuerpo && <em>{pieza.cuerpo}</em>}
                        </>
                      ) : (
                        <b className="hueco-rastro">{pistaDeRanura(h.id, k)}</b>
                      )}
                    </span>
                  )
                })}
              </div>
            )
          })()}
          {h.parametro === 'relacion' && !param && (
            <span className="aviso-rastro">Elige el tipo de vínculo abajo</span>
          )}
        </div>
      )}

      {/* v6.13 · paso libre (sin foco): no hay velo, la pantalla entera queda encendida */}
      {foco && <TutorialVelo burbuja={burbujaRef} foco={foco} />}
      {guia && guiaVisible && guia.centro && <div className="guia-fondo" />}
      {guia && guiaVisible && (
        <aside
          ref={burbujaRef}
          className={`guia${guia.centro ? ' centro' : ''}${
            guia.foco?.zona === 'pasivas' || guia.foco?.zona === 'herramientas' || guia.foco?.zona === 'carril' ? ' apartada' : ''
          }`}
          role="dialog" aria-live="polite" aria-label={`Tutorial, paso ${guia.indice + 1} de ${guia.total}`}
        >
          <div className="guia-andy" aria-hidden="true">
            <img className="guia-cara" key={resuelto && !guia.centro ? (ataqueVisto ? 'celebra' : 'anima') : guia.cara ?? 'explica'}
              src={`${import.meta.env.BASE_URL}art/andy-caras/${resuelto && !guia.centro ? (ataqueVisto ? 'celebra' : 'anima') : guia.cara ?? 'explica'}.png`} alt="" draggable={false} />
          </div>
          <div className="guia-cuerpo">
            <p>{resuelto && !guia.centro && !ataqueVisto ? '¡Allá voy!' : resuelto && !guia.centro ? 'Mira a la derecha cómo te fue. Luego pulsa «Siguiente turno».' : guia.texto}</p>
            <div className="guia-pie">
              <div className="pasos-puntos">
                {Array.from({ length: guia.total }, (_, i) => (
                  <i key={i} className={i < guia.indice ? 'hecho' : i === guia.indice ? 'activo' : ''} />
                ))}
              </div>
              {resuelto && !guia.centro ? null : guia.alEntender
                ? <button className="btn primario guia-entendido" onClick={guia.alEntender}>{guia.boton ?? 'Siguiente'} →</button>
                : guia.foco
                  ? <small className="guia-espera"><b /> Tu turno</small>
                  : <button className="btn chico guia-entendido" onClick={() => setGuiaOculta(`${guia.clave ?? guia.indice}`)}>Entendido</button>}
            </div>
          </div>
        </aside>
      )}

      {detalle && (
        <div className="velo" onClick={() => setDetalle(null)}>
          <div className="ficha-detalle" style={{ ['--color' as string]: detalle.color }} onClick={(ev) => ev.stopPropagation()}>
            <span className="ficha-tt">{detalle.tt}</span>
            <h3>{detalle.titulo}</h3>
            {detalle.cuerpo.split('\n\n').map((t, k) => <p key={k}>{t}</p>)}
            <button className="btn primario" onClick={() => setDetalle(null)}>Cerrar</button>
          </div>
        </div>
      )}
      {ayudaFija && (
        <div className="globo abajo fija" style={{ left: ayudaFija.x, top: ayudaFija.y }} onClick={() => setAyudaFija(null)}>
          {ayudaFija.texto}
          <small className="cerrar">toca para cerrar</small>
        </div>
      )}
      {ayuda && (
        <div
          className={`globo${ayuda.y > window.innerHeight / 2 ? ' arriba' : ' abajo'}`}
          style={{ left: ayuda.x, top: ayuda.y }}
          role="tooltip"
        >{ayuda.texto}</div>
      )}
      {/* ============================ carril ============================ */}
      <div data-tutorial="carril" className="zona-carril">
        <div className="parte-frente">
          <span className="dato silencio">
            El frente aguanta <strong>{vivos(e).reduce((n, x) => n + x.hp, 0)}</strong>
          </span>
          {condicionPorId(e.condicion) && (
            <span className="condicion-sala" data-ayuda={condicionPorId(e.condicion)!.glosa}>
              ⚑ {condicionPorId(e.condicion)!.nombre}
            </span>
          )}
        </div>
        <LaneView
          alImpacto={alCaerEnemigo && e.ultima ? () => { const u = e.ultima!; alCaerEnemigo(u.danoTotal, u.diag.veredictos.filter((v) => v.estado !== 'error' && v.estado !== 'invertido' && v.estado !== 'silencio').length, u.diag.xmult) } : undefined}
          enemigos={e.enemigos} lucidez={lucidez} lucidezMax={lucidezMax}
          alcance={resuelto ? 0 : previa.alcance}
          gesto={gestoHeroe}
          aniquilacion={aniquilacion}
          fondo={fondo}
          golpeTier={(() => {
            if (!(resuelto && casc.terminada && e.ultima)) return 0
            const d = e.ultima.danoTotal
            if (d >= 100000) return 4
            if (d >= 10000) return 3
            if (d >= 1000) return 2
            return (e.ultima.diag.xmult > 1 || e.ultima.patron !== 'puntual' || d >= 400) ? 1 : 0
          })()}
          golpeMayor={resuelto && casc.terminada && !!e.ultima &&
            (e.ultima.diag.xmult > 1 || e.ultima.patron !== 'puntual' || e.ultima.danoTotal >= 400)}
          ultimosImpactos={resuelto && e.ultima ? e.ultima.impactos : []}
          disparoListo={resuelto && casc.terminada}
          disparo={resuelto && casc.terminada && e.ultima ? e.ultima.disparo : null}
        />
      </div>

      {/* ========================= herramientas ========================= */}
      <aside data-tutorial="herramientas" className={`zona-herramientas${zona('herramientas')}`}>
        <span className="eyebrow">Herramientas</span>
        {listaHerramientas.map((t) => {
            e.usadas.filter((x) => x === t.id).length
          const disponible = libres.includes(t.id) && !resuelto && herrLibre(t.id)
          const senalada = !!foco?.herramientas?.includes(t.id)
          return (
            <button
              key={t.id}
              data-herramienta={t.id}
              className={`herr-v${herramienta === t.id ? ' activa' : ''}${senalada ? ' senala' : ''}`}
              disabled={!disponible}
              onClick={() => { if (herramienta === t.id) reset(); else { setHerramienta(t.id); setParam(null); setPendientes([]) } }}
              data-ayuda={`${t.nombre.toUpperCase()}\n${t.afirma}\n\n${t.ejemplo}`}
            >
              <span className="glifo">{t.glifo}</span>
              <span className="nom">{t.nombre}</span>
            </button>
          )
        })}

        <div className={`separador${zona('pasivas')}`} />
        <span data-tutorial="pasivas-titulo" className={`eyebrow${zona('pasivas')}`}>Mejoras</span>
        {lentesIds.length === 0 && <span className="silencio dato">ninguna</span>}
        {lentesIds.map((id) => {
          const l = lentePorId(id)
          return (
            <span key={id} data-tutorial="pasivas" className={`pastilla ancha${zona('pasivas') ? ' senala' : ''}`} role="button" style={{ cursor: 'pointer' }}
              onClick={() => setDetalle({ tt: 'Mejora', color: 'var(--acento)', titulo: l.nombre, cuerpo: `${l.regla}${l.costo && l.costo !== 'Sin desventaja.' ? `\n\nOjo: ${l.costo}` : ''}` })} data-ayuda={`${l.nombre.toUpperCase()}\n${l.regla}\n\n${l.costo}`}>
              {l.nombre}
            </span>
          )
        })}

        {e.sellos.length > 0 && (
          <>
            <div className="separador" />
            <span className="eyebrow">Sellos</span>
            {e.sellos.map((id) => {
              const x = selloPorId(id)
              const gastado = e.sellosUsados.includes(id)
              return (
                <button
                  key={id} className={`sello-btn ancho${gastado ? ' gastado' : ''}`}
                  disabled={gastado || resuelto} onClick={() => on.sello(id)}
                  data-ayuda={`${x.nombre.toUpperCase()}\n${x.efecto}`}
                >
                  <span className="glifo">{x.glifo}</span> {x.nombre}
                </button>
              )
            })}
          </>
        )}
      </aside>

      {/* ============================ lienzo ============================ */}
      <main data-tutorial="mesa" className={`zona-lienzo${zona('lienzo')}${resuelto && e.ultimoGolpeMapa ? ' resonando' : ''}`} style={{ ['--brillo' as string]: e.mapa ? progresoCristal(e, { contenido, rng: { next: () => 0 } as never, lentes }) : 0 }}>
        {resuelto && e.ultimoGolpeMapa && <div className="resonancia-aviso">✦ TU MAPA ATACA · −{e.ultimoGolpeMapa.dano} a {e.ultimoGolpeMapa.objetivo} · {e.ultimoGolpeMapa.trazos} trazos, {e.ultimoGolpeMapa.conexiones} se tocan</div>}
        {e.mapa && (() => {
          const ctx0 = { contenido, rng: { next: () => 0 } as never, lentes }
          const ec = estadoCristalizacion(e, ctx0)
          const listo = !!ec && ec.trazos >= 4 && ec.pendientes === 0
          return (
            <div className="mapa-sala" title="Tu mapa: cuando un grupo de cartas doradas unidas llega a 4 vínculos sin nada pendiente entre ellas, se desbloquea el ataque final.">
              {ec ? (
                <small className={listo ? 'cristal-listo' : 'cristal-falta'}>{listo ? '✦ Ataque final listo' : `Ataque final · ${Math.min(ec.trazos, 4)}/4${ec.pendientes ? ` · ${ec.pendientes} pendiente${ec.pendientes === 1 ? '' : 's'}` : ''}`}</small>
              ) : (
                <small className="cristal-falta">Une cartas: 4 vínculos seguidos desbloquean el ataque final</small>
              )}
              {!resuelto && gc?.estado === 'casi' && (
                <small className="cristal-casi">✦ A un vínculo del ataque final: une «{contenido.conceptos[gc.a]?.titulo}» con «{contenido.conceptos[gc.b]?.titulo}»</small>
              )}
              {!resuelto && gc?.estado === 'listo' && (
                <small className="cristal-ya">✦ Tus cartas doradas están cargadas: pulsa «Ataque final» abajo</small>
              )}
              <div className="mapa-acciones">
                {on.pedirPista && !resuelto && <button className="btn chico fantasma" onClick={on.pedirPista} title="Cuesta un cambio; el trazo rinde al 70 %">Pista</button>}
              </div>
            </div>
          )
        })()}
        <div className="zoom-mesa" role="group" aria-label="Zoom de la mesa">
          <button className="btn chico fantasma" onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.1).toFixed(2)))} aria-label="Alejar">−</button>
          <button className="btn chico fantasma" onClick={() => { setZoom(0.75); setPan({ x: 0, y: 0 }) }} aria-label="Centrar y zoom normal" title="Centrar">{Math.round(zoom * 100)}%</button>
          <button className="btn chico fantasma" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} aria-label="Acercar">+</button>
        </div>
        {(() => {
          const ol = oleadaActual(e)
          if (!ol) return null
          return (
            <div className={`aviso-oleada apoyo-${ol.apoyo}`}>
              <strong>{ol.titulo}</strong>
              <span>{ol.aviso}</span>
              {on.apostarOleada && e.apuestaOleada === null && e.trazos.length === 0 && (
                <span className="apuesta-oleada">
                  <small>Antes de jugar: ¿sostendrás al menos un vínculo en esta oleada?</small>
                  <button className="btn chico primario" onClick={() => on.apostarOleada!('si')}>Sí</button>
                  <button className="btn chico fantasma" onClick={() => on.apostarOleada!('no')}>No</button>
                </span>
              )}
              {e.apuestaOleada && <small className="apuesta-hecha">Apostaste: {e.apuestaOleada === 'si' ? 'sí sostendrás' : 'no sostendrás'} un vínculo. Se resuelve al cerrar la oleada.</small>}
              {ol.previos.length > 0 && (
                <span className="reusar">
                  Apóyate en lo de antes: {ol.previos.slice(0, 4)
                    .map((id) => contenido.conceptos[id]?.titulo).filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          )
        })()}
        <div
          className="lienzo" ref={lienzo}
          data-con-siluetas={foco?.arrastrar ? 'true' : undefined}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          onPointerDown={(ev) => {
            if (ev.target !== lienzo.current || ev.button !== 0) return
            panRef.current = { x0: ev.clientX, y0: ev.clientY, px: pan.x, py: pan.y }
            ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
          }}
          onPointerMove={(ev) => { const s = panRef.current; if (s) setPan(acotarPan({ x: s.px + (ev.clientX - s.x0), y: s.py + (ev.clientY - s.y0) }, zoom)) }}
          onPointerUp={() => { panRef.current = null }}
          onPointerCancel={() => { panRef.current = null }}
          onMouseEnter={() => setSobreTablero(true)}
          onMouseLeave={() => { setSobreTablero(false); setPrevisualizada(null) }}
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={(ev) => {
            ev.preventDefault()
            const uid = arrastrando ?? ev.dataTransfer.getData('text/plain')
            if (!uid || resuelto) return
            const { x, y } = posicionEnLienzo(ev)
            sfx.soltar()
            on.cambio((st) => soltar(st, uid, x, y))
            setArrastrando(null)
          }}
        >
          {resuelto && <span className="marca-corregido">corregido</span>}
          {enTablero.length === 0 && (
            <p className="pista-lienzo">
              Arrastra piezas aquí. Después elige una herramienta de la izquierda y toca
              las piezas que quieras relacionar con ella.
            </p>
          )}

          <svg className="trazos" aria-hidden>
            {trazosVisibles.map((t) => {
              const pts = t.piezas.map((u) => posiciones.find((x) => x.uid === u))
                .filter((x): x is NonNullable<typeof x> => !!x)
              if (pts.length < 1) return null
              const ver = veredictos.find((v) => v.trazo.uid === t.uid)
              const armado = esArmado(t.uid)
              const color = armado ? 'var(--dominar)' : COLOR_ESTADO[ver?.estado ?? 'silencio']
              const tool = HERRAMIENTAS[t.tool]
              if (t.tool === 'campo' || t.tool === 'eje') {
                const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
                const cx = (Math.min(...xs) + Math.max(...xs)) / 2
                const cy = (Math.min(...ys) + Math.max(...ys)) / 2
                const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 11
                const ry = (Math.max(...ys) - Math.min(...ys)) / 2 + 13
                return (
                  <ellipse key={t.uid} cx={`${cx}%`} cy={`${cy}%`} rx={`${rx}%`} ry={`${ry}%`}
                    fill="none" stroke={color} strokeWidth="2"
                    strokeDasharray={t.tool === 'eje' ? '7 5' : undefined} opacity=".85" />
                )
              }
              return (
                <g key={t.uid} data-armado={esArmado(t.uid) ? 'true' : undefined} className={
                  (resuelto && !casc.trazosRevelados.has(t.uid) ? 'oculto' : 'trazo-vivo') +
                  (trazoAbierto === t.uid ? ' resaltado' : trazoAbierto ? ' atenuado' : '')
                }>
                  {pts.slice(0, -1).map((a, i) => {
                    const b = pts[i + 1]
                    const est = t.tool === 'flecha' ? estiloRelacion(t.param) : null
                    if (est?.ondulada && !armado) return null
                    const dash = est?.dash ?? (t.tool === 'identidad' ? '3 3'
                      : ver?.estado === 'derivado' ? '9 4'
                      : ver?.estado === 'insinuado' || ver?.estado === 'propuesta' ? '4 5'
                      : ver?.estado === 'plausible' ? '2 6' : undefined)
                    const ancho = est?.ancho ?? 2.4
                    return (
                      <g key={i}>
                        <line x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`}
                          stroke={color} strokeWidth={ancho} strokeDasharray={dash} fill="none"
                          markerEnd={tool.ordenada ? `url(#punta-${est?.punta ?? 'flecha'})` : undefined} />
                        {est?.doble && (
                          <line x1={`${a.x}%`} y1={`${a.y + 1.6}%`} x2={`${b.x}%`} y2={`${b.y + 1.6}%`}
                            stroke={color} strokeWidth={ancho * 0.7} fill="none" opacity=".75" />
                        )}
                      </g>
                    )
                  })}
                  {t.tool === 'flecha' && t.param && (
                    <text x={`${(pts[0].x + pts[pts.length - 1].x) / 2}%`}
                      y={`${(pts[0].y + pts[pts.length - 1].y) / 2}%`}
                      dy={-7} fill={color} fontSize="11.5" textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)', paintOrder: 'stroke', stroke: 'var(--tinta)', strokeWidth: 4 }}>
                      {VERBO_RELACION[t.param] ?? t.param}
                    </text>
                  )}
                  {resuelto && ver && (
                    <text x={`${(pts[0].x + pts[pts.length - 1].x) / 2}%`}
                      y={`${(pts[0].y + pts[pts.length - 1].y) / 2}%`}
                      dy={14} fill={color} fontSize="11" textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)', paintOrder: 'stroke', stroke: 'var(--tinta)', strokeWidth: 4 }}>
                      {ver.estado === 'sostenido' ? '✓' : ver.estado === 'equivalente' ? '✓ ='
                      : ver.estado === 'compatible' ? '✓ también'
                        : ver.estado === 'derivado' ? '✓ se sigue' : ver.estado === 'aproximado' ? '≈'
                        : ver.estado === 'insinuado' ? '✎ lo viste' : ver.estado === 'propuesta' ? '✎'
                        : ver.estado === 'convive' ? '~' : ver.estado === 'plausible' ? '·'
                        : ver.estado === 'invertido' ? '↺' : '·'}
                    </text>
                  )}
                </g>
              )
            })}
            {h && !resuelto && pendientes.length >= 2 && pendientes.slice(1).map((u, k) => {
              const a = posiciones.find((x) => x.uid === pendientes[h.ordenada ? k : 0]), b = posiciones.find((x) => x.uid === u)
              if (!a || !b) return null
              return <line key={`previo${k}`} className="trazo-previo" x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="var(--acento)" style={{ color: 'var(--acento)' }} vectorEffect="non-scaling-stroke"
                markerEnd={h.ordenada ? 'url(#punta-flecha)' : undefined} />
            })}
            <defs>
              <marker id="punta-flecha" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                <path d="M0 0.5 L9 4.5 L0 8.5 z" fill="currentColor" />
              </marker>
              <marker id="punta-barra" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M6 0.5 L6 8.5" stroke="currentColor" strokeWidth="2.4" />
              </marker>
              <marker id="punta-doble" markerWidth="11" markerHeight="9" refX="9" refY="4.5" orient="auto">
                <path d="M0 0.5 L5 4.5 L0 8.5 z M5 0.5 L10 4.5 L5 8.5 z" fill="currentColor" />
              </marker>
            </defs>
          </svg>

          <svg className="trazos ondas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {trazosVisibles
              .filter((t) => t.tool === 'flecha' && estiloRelacion(t.param).ondulada && !esArmado(t.uid))
              .map((t) => {
                const pts = t.piezas.map((u) => posiciones.find((x) => x.uid === u))
                  .filter((x): x is NonNullable<typeof x> => !!x)
                if (pts.length < 2) return null
                if (resuelto && !casc.trazosRevelados.has(t.uid)) return null
                const ver = veredictos.find((v) => v.trazo.uid === t.uid)
                return (
                  <path key={t.uid} d={ondaEntre(pts[0].x, pts[0].y, pts[1].x, pts[1].y)}
                    fill="none" strokeWidth={1.8}
                    stroke={esArmado(t.uid) ? 'var(--dominar)' : COLOR_ESTADO[ver?.estado ?? 'silencio']} vectorEffect="non-scaling-stroke" />
                )
              })}
          </svg>

          {foco?.arrastrar && !resuelto && (() => {
            // v6.43 · siluetas punteadas: dónde soltar las cartas (arriba, lejos de la barra de la herramienta)
            const ids = foco.piezas ?? []
            const puestas = ids.filter((u) => e.tablero.some((t) => t.uid === u)).length
            return ids.map((_, k) => k < puestas ? null : (
              <div key={`sil${k}`} data-tutorial="silueta" className="silueta-carta"
                style={{ left: `${50 + (k - (ids.length - 1) / 2) * 13}%`, top: '41%' }}>
                <span>{k === puestas ? 'Suéltala aquí' : ''}</span>
              </div>
            ))
          })()}
          <div className="rotulos-capa" aria-hidden>
            {trazosVisibles.filter((t) => esArmado(t.uid)).map((t) => {
              const pts = t.piezas.map((u) => posiciones.find((x) => x.uid === u)).filter((x): x is NonNullable<typeof x> => !!x)
              if (pts.length < 2) return null
              const cx = pts.reduce((n, q) => n + q.x, 0) / pts.length, cy = pts.reduce((n, q) => n + q.y, 0) / pts.length
              const texto = t.tool === 'flecha' ? (t.param ?? '') : HERRAMIENTAS[t.tool].nombre.toLowerCase()
              return texto ? <span key={`r-${t.uid}`} className="rotulo-html" style={{ left: `${cx}%`, top: `${cy}%` }}>{texto}</span> : null
            })}
          </div>
          {enTablero.map(({ t, p }) => {
            const marcada = pendientes.includes(p.uid)
            const orden = pendientes.indexOf(p.uid)
            const enFoco = trazoAbierto && trazosVisibles.find((x) => x.uid === trazoAbierto)?.piezas.includes(p.uid)
            const inservible = (!!h && !pendientes.includes(p.uid) &&
              !aceptaEnRanura(h.id, pendientes.length, p)) || !piezaLibre(p.uid)
            const cd = cedulaDe(contenido, p)
            const dorada = p.clase === 'concepto' && !!p.conceptId && e.fusionados.includes(p.conceptId)
            return (
              <div
                key={p.uid}
                data-uid={p.uid}
                data-armada={(e.armados ?? []).some((a) => a.piezas.includes(p.uid)) ? 'true' : undefined}
                data-moviendo={moviendoUid === p.uid ? 'true' : undefined}
                data-cristal={resaltarCristal ? (resaltarCristal.has(p.uid) ? 'si' : 'no') : undefined}
                data-cristal-listo={!resuelto && cristalListo?.has(p.uid) ? 'true' : undefined}
                data-falta={!resuelto && faltaEn(p) ? 'true' : undefined}
                data-pista={e.pista && p.conceptId && (p.clase === 'concepto' || p.clase === 'etiqueta' || p.clase === 'definicion') && (e.pista.a === p.conceptId || e.pista.b === p.conceptId) ? 'true' : e.pistaSuave && p.conceptId === e.pistaSuave ? 'suave' : undefined}
                className={`naipe en-tablero${p.uid.startsWith('const:') ? ' constelacion' : ''} naipe-${p.clase}${marcada ? ' marcada' : ''}` +
                  `${dorada ? ' dorada' : ''}` +
                  `${e.reveladas.includes(p.uid) ? ' senalada' : ''}` +
                  `${enFoco ? ' en-foco' : trazoAbierto ? ' fuera-de-foco' : ''}` +
                  `${inservible ? ' inservible' : ''}`}
                style={{ left: `${t.x}%`, top: `${t.y}%`, ...estiloDeCedula(cd),
                  ...(texturaDe(p.clase) ? { background: `${texturaDe(p.clase)}, ${cd.tono}` } : {}) }}
                draggable={!resuelto && !(e.armados ?? []).some((a) => a.piezas.includes(p.uid))}
                onPointerDown={(ev) => {
                  if (resuelto || !(e.armados ?? []).some((a) => a.piezas.includes(p.uid)) || ev.button !== 0) return
                  ev.stopPropagation(); ev.preventDefault()
                  moviendoRef.current = { uid: p.uid, raf: null }
                  setMoviendoUid(p.uid)
                  seMovioRef.current = false
                  const rc = (ev.currentTarget as HTMLElement).getBoundingClientRect()
                  agarreRef.current = { dx: ev.clientX - (rc.left + rc.width / 2), dy: ev.clientY - (rc.top + rc.height / 2) }
                  ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
                }}
                onPointerMove={(ev) => {
                  const mv = moviendoRef.current
                  if (!mv || mv.uid !== p.uid) return
                  seMovioRef.current = true
                  const { x, y } = posicionEnLienzo(ev)
                  if (mv.raf !== null) cancelAnimationFrame(mv.raf)
                  mv.raf = requestAnimationFrame(() => { on.cambio((st) => soltar(st, p.uid, x, y)); mv.raf = null })
                }}
                onPointerUp={() => { if (moviendoRef.current?.uid === p.uid) moviendoRef.current = null; setMoviendoUid(null) }}
                onPointerCancel={() => { if (moviendoRef.current?.uid === p.uid) moviendoRef.current = null; setMoviendoUid(null) }}
                onDragStart={(ev) => { const rc = (ev.currentTarget as HTMLElement).getBoundingClientRect(); agarreRef.current = { dx: ev.clientX - (rc.left + rc.width / 2), dy: ev.clientY - (rc.top + rc.height / 2) }; setArrastrando(p.uid) }}
                onDragEnd={() => setArrastrando(null)}
                onClick={(ev) => {
                  const armada = (e.armados ?? []).some((a) => a.piezas.includes(p.uid))
                  if (armada && seMovioRef.current) { seMovioRef.current = false; return }
                  if (armada && !herramienta) {
                    void ev; void setAyudaFija; abrirDetalle(p)
                    return
                  }
                  tocarPieza(p.uid)
                }}
                onDoubleClick={() => { if (!(e.armados ?? []).some((a) => a.piezas.includes(p.uid))) pedirDevolver(p.uid) }}
                onDragOver={(ev) => { if ((e.armados ?? []).some((a) => a.piezas.includes(p.uid))) ev.preventDefault() }}
                onDrop={(ev) => {
                  // v5.85 · soltar una carta sobre un nodo armado: cae al lado y el vínculo queda
                  // abierto con los dos extremos; solo falta elegir el tipo
                  if (!(e.armados ?? []).some((a) => a.piezas.includes(p.uid))) return
                  ev.preventDefault(); ev.stopPropagation()
                  const uid = arrastrando ?? ev.dataTransfer.getData('text/plain')
                  if (!uid || resuelto || uid === p.uid) return
                  const dx = t.x < 50 ? 14 : -14
                  sfx.soltar()
                  on.cambio((st) => soltar(st, uid, Math.max(6, Math.min(94, t.x + dx)), Math.max(8, Math.min(90, t.y + 10))))
                  setArrastrando(null)
                  if (!herramienta && libres.includes('flecha')) setHerramienta('flecha')
                  setPendientes([p.uid, uid])
                }}
                onMouseEnter={() => herramienta && !inservible && setPrevisualizada(p.uid)}
                onMouseLeave={() => setPrevisualizada((x) => (x === p.uid ? null : x))}
                data-ayuda={ayudaDe(p) + (dorada ? AYUDA_DORADA : '')}
              >
                {marcada && <span className="orden">{orden + 1}</span>}
                <span className="tt" style={{ color: cd.banda }}>{ETIQUETA[p.clase]}<span className="orn">{cd.ornamento}</span></span>
                <span className="nom">{recorte(p.titulo, 42)}</span>
                {p.cuerpo && <span className="desc-mesa">{recorte(p.cuerpo, 70)}</span>}
                {(p.cuerpo.length > 70 || p.titulo.length > 42) && (
                  <button className="mas-info" title="Ver completa" onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={(ev) => { ev.stopPropagation(); abrirDetalle(p) }}>+</button>
                )}
                {(() => {
                  const cs = coloresCompatibles(p, e.mano)
                  return cs.length ? <span className="compat" aria-hidden="true">{cs.map((c) => <i key={c} style={{ background: c }} />)}</span> : null
                })()}
                {p.partes?.length ? <span className="partes-insignia" title={`Se compone de: ${p.partes.join(' · ')}`}>⊟ {p.partes.length}</span> : null}
                <i className="borde" style={{ background: cd.banda }} />
                <i className={`grano grano-${cd.textura}`} />
                {cd.canto && <i className="canto" />}
              </div>
            )
          })}
        </div>

        {/* --------------------- barra de construcción --------------------- */}
        {/* Barra compacta dentro del lienzo: lo único que necesita clics.
            El tablero sigue accesible, que es donde hay que tocar. */}
        {h && !resuelto && (
          <div className="barra-trazo">
            <span className="glifo-barra">{h.glifo}</span>
            <div className="pila" style={{ gap: 3, flex: '1 1 auto', minWidth: 0 }}>
              <strong style={{ fontSize: 13.5 }}>{h.nombre}</strong>
              <span className="silencio" style={{ fontSize: 11.5 }}>
                {pendientes.length === 0
                  ? 'Toca en el tablero las piezas que quieras relacionar.'
                  : `${pendientes.length}/${h.aridad[0] === h.aridad[1] ? h.aridad[0] : `${h.aridad[0]}–${h.aridad[1]}`}${h.ordenada ? ' · el orden importa' : ''}`}
              </span>
            </div>

            {h.parametro === 'relacion' && (
              <div className="fila" style={{ gap: 4, flexWrap: 'wrap', maxWidth: 420 }}>
                {[...new Set(e.relacionesDisponibles)].map((tipo) => {
                  const favorecida = (lentes.multPorTipo[tipo] ?? 0) > 0
                  return (
                    <button
                      key={tipo}
                      data-relacion={tipo}
                      className={`apuesta chica${param === tipo ? ' activa' : ''}${favorecida ? ' favorecida' : ''}`}
                      onClick={() => setParam(tipo)}
                      data-ayuda={`${tipo.toUpperCase()}\n${GLOSA[tipo] ?? ''}${favorecida ? '\n\nUna de tus lentes favorece este vínculo.' : ''}`}
                    >{tipo}</button>
                  )
                })}
              </div>
            )}
            {h.parametro === 'eje' && (
              <div className="fila" style={{ gap: 4, flexWrap: 'wrap', maxWidth: 420 }}>
                {contenido.ejes.flatMap((eje) =>
                  [...new Set(Object.values(eje.valores).map(String))].map((valor) => (
                    <button key={`${eje.id}::${valor}`}
                      className={`apuesta chica${param === `${eje.id}::${valor}` ? ' activa' : ''}`}
                      onClick={() => setParam(`${eje.id}::${valor}`)}>
                      {eje.nombre.split(' ')[0]}: {valor}
                    </button>
                  ))
                )}
              </div>
            )}

            <button data-tutorial="trazar" className="btn primario" disabled={!puedeCerrar} onClick={cerrarTrazo}>Trazar</button>
            <button className="btn fantasma" onClick={reset}>✕</button>
          </div>
        )}

        {/* ------------------------- acuse del pozo ------------------------- */}
        {e.ultimoPozo && !resuelto && acuseCerrado !== e.ultimoPozo.titulo && (
          <div className={`acuse ${e.ultimoPozo.acertado ? 'bien' : 'mal'}`}>
            <button
              className="cerrar" aria-label="Cerrar aviso"
              onClick={() => setAcuseCerrado(e.ultimoPozo?.titulo ?? null)}
            >✕</button>
            <strong>
              {e.ultimoPozo.accion === 'quemar' ? 'Quemaste' : 'Cambiaste'} «{e.ultimoPozo.titulo}»
            </strong>
            <span>{e.ultimoPozo.nota}</span>
            {e.ultimoPozo.bonusMult > 0 && (
              <span className="premio">próximo diagrama +{e.ultimoPozo.bonusMult.toFixed(1)}× · robas una carta</span>
            )}
          </div>
        )}

        {/* --------------------------- resolución --------------------------- */}
        {resuelto && e.ultima && (
          <div className="resolucion compacta">
            <div className="cuenta" onClick={casc.saltar} title="Toca para saltar la cuenta">
              <span className="etiqueta-cuenta" title="Puntos: cuánto de lo que dijiste lo sostiene el texto. Cada trazo sostenido suma; uno falso resta.">puntos</span>
              <span className="fichas" key={`f${casc.fichas}`}>{casc.fichas}</span>
              <span className="por">×</span>
              <span className="etiqueta-cuenta" title="Multiplicador: cuánto se articula el diagrama. Varios trazos que se tocan multiplican; trazos sueltos, no.">multiplicador</span>
              <span className="mult" key={`m${casc.mult.toFixed(1)}`}>{casc.mult.toFixed(1)}</span>
              {casc.xmult > 1 && (
                <>
                  <span className="por">×</span>
                  <span className="xmult" key={`x${casc.xmult.toFixed(1)}`}>×{casc.xmult.toFixed(1)}</span>
                </>
              )}
              {casc.total !== null && (
                <><span className="por">=</span>
                <span className={`total${casc.xmult > 1 ? ' mayor' : ''}`}>{casc.total}</span></>
              )}
            </div>
            <div className="fila" style={{ gap: 5, flexWrap: 'wrap' }}>
              {trazosVisibles.filter((t) => casc.trazosRevelados.has(t.uid)).map((t) => {
                const ver = veredictos.find((v) => v.trazo.uid === t.uid)
                const est = ver?.estado ?? 'silencio'
                return (
                  <button key={t.uid}
                    className={`trazo-chip aparece${trazoAbierto === t.uid ? ' abierto' : ''}`}
                    style={{ borderColor: COLOR_ESTADO[est], color: COLOR_ESTADO[est] }}
                    onClick={() => setTrazoAbierto(trazoAbierto === t.uid ? null : t.uid)}>
                    {HERRAMIENTAS[t.tool].glifo} {ETIQUETA_ESTADO[est]}
                  </button>
                )
              })}
              {e.ultima.diag.combos.slice(0, casc.combosRevelados).map((c, i) => (
                <span key={i} className="aparece"><Chip tono="laton">{c.nombre} +{c.mult.toFixed(1)}×</Chip></span>
              ))}
              {e.ultima.diag.ajustes.slice(0, casc.ajustesRevelados).map((a, i) => (
                <span key={`aj${i}`}
                  className={`aparece chip-ajuste${(a.fichas ?? 0) < 0 || (a.factor ?? 1) < 1 ? ' malo' : ''}`}
                  data-ayuda={a.nota}>
                  {a.nombre}
                  {a.fichas ? ` ${a.fichas > 0 ? '+' : ''}${a.fichas}` : ''}
                  {a.mult ? ` +${a.mult.toFixed(1)}×` : ''}
                  {a.factor ? ` ×${a.factor.toFixed(1)}` : ''}
                </span>
              ))}
              {casc.xmultsRevelados.map((x) => (
                <span key={x.nombre} className="aparece chip-mayor">✦ {x.nombre} ×{x.factor}</span>
              ))}
              {casc.terminada && (
                <span className="chip-patron" data-ayuda={
                  e.ultima.patron === 'barrido'
                    ? 'Constelación: cuatro sostenidas sin error. El carril entero recibe el golpe completo.'
                    : e.ultima.patron === 'onda'
                      ? 'Onda: la compra el Cierre o una andanada de tres o más sostenidas. Los primeros del carril reciben el golpe completo.'
                      : 'Golpe a un solo objetivo. Lo que sobra al derribarlo pasa al siguiente.'
                }>
                  {e.ultima.patron === 'barrido' ? '☄ a todos' : e.ultima.patron === 'onda' ? '≋ en cadena' : '→ a uno'}
                </span>
              )}
            </div>
            {casc.terminada && (() => {
              const desbordes = e.ultima!.impactos.filter((i) => i.motivo?.startsWith('El golpe desborda'))
              const bloqueos = e.ultima!.impactos.filter((i) => i.motivo && !i.motivo.startsWith('El golpe desborda'))
              if (!bloqueos.length && !desbordes.length) return null
              return (
                <div className="bloqueos">
                  {bloqueos.map((b, i) => (
                    <p key={`b${i}`} className="nota" style={{ margin: 0 }}>⛨ <strong>{b.nombre}</strong> — {b.motivo} (recibió {b.dano})</p>
                  ))}
                  {desbordes.map((b, i) => (
                    <p key={`d${i}`} className="nota" style={{ margin: 0 }}>↯ <strong>{b.nombre}</strong> — recibe el desborde del anterior: {b.dano}{b.derribado ? ' (cae)' : ''}</p>
                  ))}
                </div>
              )
            })()}
            {trazoAbierto && (() => {
              const ver = veredictos.find((v) => v.trazo.uid === trazoAbierto)
              if (!ver) return null
              return (
                <div className="detalle-trazo">
                  <p className={`nota ${TONO_NOTA[ver.estado]}`} style={{ margin: 0 }}>{ver.nota}</p>
                  {(() => {
                    // v5.65 · orientación precisa: por qué no se sostuvo y qué probar, con el texto
                    const o = orientar(contenido, ver, e.mano)
                    if (!o) return null
                    return (
                      <div className="orientacion">
                        <p className="orientacion-causa">{o.causa}</p>
                        <p className="orientacion-siguiente"><b>Prueba:</b> {o.siguiente}</p>
                        {o.evidencia && <p className="orientacion-evidencia">{o.evidencia}</p>}
                      </div>
                    )
                  })()}
                  {e.apoyo && (() => {
                    // v5.62 · si el trazo tocó una intuición cotidiana, se enseña el contraste y dónde sí funciona
                    const tr = ver.trazo
                    const intu = tr ? e.mano.find((pz) => tr.piezas.includes(pz.uid) && pz.clase === 'intuicion') : null
                    return intu ? (
                      <div className="contraste-intuicion">
                        <small>Intuición cotidiana · qué criterio cambia</small>
                        <p>{intu.explicacion}</p>
                        {intu.cierre && <p className="donde-funciona"><b>Dónde sí funciona:</b> {intu.cierre}</p>}
                      </div>
                    ) : null
                  })()}
                  {ver.reserva && <p className="nota nota" style={{ margin: '6px 0 0' }}>{ver.reserva}</p>}
                </div>
              )
            })()}
            {porqueVisible && porque && (
              <div className="porque">
                <span className="eyebrow">El porqué</span>
                <p style={{ margin: '2px 0 6px' }}>{porque.enunciado}</p>
                <div className="porque-opciones">
                  {porque.opciones.map((o) => (
                    <button key={o.texto} disabled={!!porqueResp}
                      className={`porque-opcion${porqueResp ? (o.ok ? ' ok' : porqueResp.elegido === o.texto ? ' mal' : '') : ''}`}
                      onClick={() => { porqueOleada.current = `${marcaOleada}:${e.turno}`; setPorqueResp({ clave: porque.clave, elegido: o.texto, ok: o.ok }); on.porque!(o.ok, porque.clave) }}>«{o.texto}»</button>
                  ))}
                </div>
                {porqueResp && <p className={porqueResp.ok ? 'nota ok' : 'nota mal'} style={{ margin: '6px 0 0' }}>
                  {porqueResp.ok ? 'Esa es. Saber el vínculo y saber de dónde sale son dos cosas, y tienes las dos. +2 de lucidez.' : 'No era esa: la marcada es la frase que respalda tu vínculo. El trazo sigue valiendo; esto es para que sepas de dónde sale.'}</p>}
              </div>
            )}
            {casc.terminada && e.ultima.descubiertos.length > 0 && (
              <p className="nota ok" style={{ margin: 0 }}>
                <strong>Descubriste «{e.ultima.descubiertos.join('» y «')}»</strong> — un vínculo
                nuevo que ya puedes trazar, aquí y en las próximas expediciones.
              </p>
            )}
            {casc.terminada && e.ultima.parteEnemiga.length > 0 && (
              <ul className="parte">
                {e.ultima.parteEnemiga.map((p, i) => (
                  <li key={i}>{p.texto}{p.dano > 0 && <span className="dato"> −{p.dano}</span>}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      {/* ============================== mano ============================== */}
      <aside data-tutorial="mano" className={`zona-mano${zona('mano') || zona('pozo')}${resuelto && e.ultima ? ' con-resultado' : ''}`}>
        {/* v6.30 · tras el ataque la mano se retira: aquí va lo que pasó con cada conexión,
            para que no parezca que aún se puede jugar antes de «Siguiente turno» */}
        {resuelto && e.ultima && (() => {
          const nombre = (uid: string) => {
            const pz = foto?.piezas.find((x) => x.uid === uid) ?? e.mano.find((x) => x.uid === uid)
            return !pz ? '…' : pz.clase === 'definicion' ? 'su descripción' : `«${recorte(pz.titulo, 28)}»`
          }
          const filas = trazosVisibles.filter((t) => !esArmado(t.uid)).map((t) => ({ t, ver: veredictos.find((v) => v.trazo.uid === t.uid) }))
          const tono = (est?: string) => TONO_NOTA[est ?? 'silencio'] ?? 'nota'
          const bien = filas.filter((f) => tono(f.ver?.estado) === 'ok').length
          const mal = filas.filter((f) => tono(f.ver?.estado) === 'mal').length
          const dudosas = filas.length - bien - mal
          return (
            <div className="resultado-turno" data-tutorial="resultado">
              <span className="eyebrow">Resultado del ataque</span>
              <div className="resultado-resumen">
                {bien > 0 && <span className="r-ok">✓ {bien} bien</span>}
                {dudosas > 0 && <span className="r-nota">~ {dudosas} a medias</span>}
                {mal > 0 && <span className="r-mal">✗ {mal} mal</span>}
              </div>
              <div className="resultado-lista">
                {filas.filter((f) => casc.trazosRevelados.has(f.t.uid)).map(({ t, ver }) => {
                  const tn = tono(ver?.estado)
                  const o = ver && tn !== 'ok' ? orientar(contenido, ver, e.mano) : null
                  return (
                    <div key={t.uid} className={`resultado-fila ${tn} aparece`}>
                      <b className="resultado-marca">{tn === 'ok' ? '✓' : tn === 'mal' ? '✗' : '~'}</b>
                      <div>
                        <strong>
                          {t.tool === 'flecha' && t.piezas.length === 2
                            ? <>{nombre(t.piezas[0])} <i>{VERBO_RELACION[t.param ?? ''] ?? t.param ?? '→'}</i> {nombre(t.piezas[1])}</>
                            : <>{HERRAMIENTAS[t.tool].glifo} {t.piezas.map(nombre).join(' · ')}</>}
                        </strong>
                        <span className="resultado-estado">{ETIQUETA_ESTADO[ver?.estado ?? 'silencio']}</span>
                        {ver?.nota && <p>{ver.nota}</p>}
                        {o && <p className="resultado-prueba"><b>Prueba:</b> {o.siguiente}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
              {casc.terminada && <p className="resultado-sigue">Pulsa <b>«{e.fase === 'ganado' ? 'El carril queda despejado' : e.fase === 'perdido' ? 'Cerrar la expedición' : e.oleadas.length && vivos(e).length === 0 ? 'Entra la siguiente tanda' : 'Siguiente turno'}»</b> para seguir ↓</p>}
            </div>
          )
        })()}
        <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="eyebrow">Mano</span>
          <span className="fila" style={{ gap: 8 }}>
            <button className="btn-desnudo dato silencio" onClick={() => setLeyenda((x) => !x)}
              data-ayuda="Qué significa cada color de carta">{leyenda ? 'cerrar' : 'colores'}</button>
            <span className="dato silencio">mazo {e.mazo.length}</span>
          </span>
        </div>
        {leyenda && (
          <div className="leyenda-clases">
            <small className="leyenda-nota">La franja a la derecha de cada carta muestra los colores de las cartas de tu mano con las que se puede unir.</small>
            {([['etiqueta', 'azul: únelo con su descripción usando «Es lo mismo» (=)'],
              ['definicion', 'amarilla: únela con su nombre usando «Es lo mismo» (=)'],
              ['concepto', 'verde: nombre y descripción ya unidos. Se conecta con otras ideas'],
              ['caso', 'ánclalo (⌖) a los conceptos que operan en él, o enlaza ejemplificando'],
              ['tesis', 'pésala (⚖) con sus criterios, apóyala o contrástala'],
              ['criterio', 'va a la balanza de su tesis'],
              ['marco', 'circunda (◯) los conceptos que le pertenecen'],
              ['intuicion', 'contrástala con el concepto que ocupaba su lugar'],
              ['contexto', 'terreno de una intuición ya reubicada: comodín de campo'],
              ['subdimension', 'descompón (⊟) su concepto madre']] as const).map(([cl, uso]) => (
              <span key={cl} className="leyenda-item" data-ayuda={uso}>
                <i style={{ background: BANDA[cl] }} />{NOMBRE_CLASE[cl]}
              </span>
            ))}
          </div>
        )}
        <div className="lista-mano">
          {enMano.map((p) => {
            const cd = cedulaDe(contenido, p)
            const dorada = p.clase === 'concepto' && !!p.conceptId && e.fusionados.includes(p.conceptId)
            return (
              <div
                key={p.uid}
                data-uid={p.uid}
                data-clase={p.clase}
                data-falta={!resuelto && faltaEn(p) ? 'true' : undefined}
                data-pista={e.pista && p.conceptId && (p.clase === 'concepto' || p.clase === 'etiqueta' || p.clase === 'definicion') && (e.pista.a === p.conceptId || e.pista.b === p.conceptId) ? 'true' : undefined}
                className={`renglon${seleccion === p.uid ? ' activa' : ''}` +
                  `${dorada ? ' dorada' : ''}` +
                  `${e.reveladas.includes(p.uid) ? ' senalada' : ''}` +
                  `${foco?.piezas ? (piezaLibre(p.uid) ? ' senala' : ' bloqueada') : ''}`}
                style={{ borderLeftColor: cd.banda, ['--banda' as string]: cd.banda,
                  background: texturaDe(p.clase) ? `${texturaDe(p.clase)}, ${cd.tono}` : cd.tono }}
                draggable={!resuelto && piezaLibre(p.uid)}
                onDragStart={(ev) => {
                  if (!piezaLibre(p.uid)) { ev.preventDefault(); return }
                  setArrastrando(p.uid); ev.dataTransfer.setData('text/plain', p.uid)
                }}
                onDragEnd={() => setArrastrando(null)}
                onClick={() => {
                  if (!piezaLibre(p.uid)) return
                  setSeleccion(seleccion === p.uid ? null : p.uid); despertarAudio()
                }}
                data-ayuda={ayudaDe(p) + (dorada ? AYUDA_DORADA : '')}
              >
                <span className="tt" style={{ color: cd.banda }}>{ETIQUETA_MANO[p.clase] ?? ETIQUETA[p.clase]}<span className="orn">{cd.ornamento}</span></span>
                <span className="nom">{recorte(p.titulo, 40)}</span>
                {p.cuerpo && <span className="desc">{recorte(p.cuerpo, 170)}</span>}
                {(p.cuerpo.length > 170 || p.titulo.length > 40) && (
                  <button className="mas-info" title="Ver completa" onClick={(ev) => { ev.stopPropagation(); abrirDetalle(p) }}>+</button>
                )}
                {cd.canto && <span className="marca">idea clave</span>}
                {(() => {
                  const cs = coloresCompatibles(p, e.mano)
                  return cs.length ? <span className="compat" aria-hidden="true">{cs.map((c) => <i key={c} style={{ background: c }} />)}</span> : null
                })()}
              </div>
            )
          })}
        </div>
      </aside>

      {/* ============================ encargo ============================= */}
      {encargoPendiente && (
        <div className="encargos">
          <span className="eyebrow">Reto opcional</span>
          <h2 className="encargos-titulo">Elige un reto para esta sala</h2>
          <div className="encargos-fila">
            {e.encargosOfrecidos.map((en) => (
              <button key={en.id} className={`encargo n${en.nivel}`}
                onClick={() => { on.elegirEncargo(en); sfx.trazar() }}
                data-ayuda={en.detalle}>
                <span className="encargo-nivel">{'◆'.repeat(en.nivel)}</span>
                <span className="encargo-titulo">{en.titulo}</span>
                <span className="dato">+{[0, 4, 8, 14][en.nivel]} de vida · mejor premio</span>
              </button>
            ))}
            <button className="btn fantasma" onClick={() => on.elegirEncargo(null)}>
              Sin reto
            </button>
          </div>
          <span className="silencio" style={{ fontSize: 12 }}>
            Si lo cumples, Andy recupera vida y el premio es mejor. Si no, no pasa nada.
          </span>
        </div>
      )}

      {/* ============================ acciones ============================ */}
      <footer data-tutorial="pozo" className={`zona-acciones${zona('afirmar') || zona('pozo')}`}>
        {!resuelto ? (
          <>
            {e.mapa && puedeCristalizar(e, { contenido, rng: { next: () => 0 } as never, lentes }) && (
              <button className="btn primario grande cristalizar listo" disabled={!on.cristalizar} onClick={on.cristalizar}
                onMouseEnter={() => { const c0 = componenteCristalizable(e, { contenido, rng: { next: () => 0 } as never, lentes }); setResaltarCristal(c0 ? new Set(c0.uids) : new Set((e.armados ?? []).flatMap((a) => a.piezas))) }}
                onMouseLeave={() => setResaltarCristal(null)}
                title="Ataque definitivo: un grupo de tu mapa está grande y completo. Cristalízalo y todo lo que queda cae.">✦ ATAQUE FINAL · Cristalizar</button>
            )}
            <button
              data-tutorial="afirmar"
              className={`btn primario grande${zona('afirmar') ? ' senala' : ''}`}
              onClick={on.afirmar} disabled={e.trazos.length === 0}
            >
              Afirmar el diagrama {e.trazos.length > 0 && <span className="dato">· {e.trazos.length} trazos</span>}
            </button>
            {e.encargo && (
              <span className={`encargo-marca${cumplido ? ' cumplido' : ''}`} data-ayuda={e.encargo.detalle}>
                {cumplido ? '✓ ' : ''}{e.encargo.titulo}
              </span>
            )}
            {e.racha >= 2 && (
              <span className="racha" data-ayuda={'RACHA\nTurnos seguidos sosteniendo algo. Cada uno suma +0.1 al multiplicador. Solo un error o una inversión la rompen: el silencio no.'}>
                ⚡ racha ×{e.racha}
              </span>
            )}
            {objetivo && (
              <span className="silencio dato" data-ayuda={tipoPorId(objetivo.tipoId).glosa}>
                al frente: {objetivo.nombre}
              </span>
            )}
            <button className="btn peligro fantasma" onClick={on.huir}>Abandonar</button>
          </>
        ) : (
          <>
          <div className="cuenta cuenta-pie" onClick={casc.saltar} title="Toca para saltar la cuenta">
            <span className="etiqueta-cuenta">puntos</span>
            <span className="fichas">{casc.fichas}</span>
            <span className="por">×</span>
            <span className="etiqueta-cuenta">multiplicador</span>
            <span className="mult">{casc.mult.toFixed(1)}</span>
            {casc.xmult > 1 && <><span className="por">×</span><span className="xmult">×{casc.xmult.toFixed(1)}</span></>}
            {casc.total !== null && <><span className="por">=</span><span className={`total${casc.xmult > 1 ? ' mayor' : ''}`}>{casc.total}</span></>}
          </div>
          <button data-tutorial="resultado" className="btn primario grande sigue-turno" disabled={!casc.terminada}
            onClick={() => { setTrazoAbierto(null); on.continuar() }}>
            {e.fase === 'ganado' ? 'El carril queda despejado'
              : e.oleadas.length && vivos(e).length === 0 ? 'Entra la siguiente tanda'
              : e.fase === 'perdido' ? 'Cerrar la expedición' : 'Siguiente turno'}
          </button>
          </>
        )}
      </footer>

      {/* ---------------------- confirmar devolución ---------------------- */}
      {confirmar && (
        <div className="velo" onClick={() => setConfirmar(null)}>
          <div className="dialogo" onClick={(ev) => ev.stopPropagation()}>
            <span className="eyebrow">Devolver a la mano</span>
            <p style={{ margin: 0 }}>
              Esa pieza sostiene {confirmar.trazos} trazo{confirmar.trazos > 1 ? 's' : ''}.
              Al devolverla se deshace{confirmar.trazos > 1 ? 'n' : ''} y{' '}
              <strong>recuperas la{confirmar.trazos > 1 ? 's' : ''} herramienta{confirmar.trazos > 1 ? 's' : ''}</strong>.
            </p>
            <div className="fila">
              <button className="btn primario" onClick={() => {
                on.cambio((st) => devolverAMano(st, confirmar.uid))
                sfx.deshacer(); setConfirmar(null)
              }}>Devolver</button>
              <button className="btn fantasma" onClick={() => setConfirmar(null)}>Dejarla ahí</button>
            </div>
          </div>
        </div>
      )}

      {/* deshacer un trazo suelto desde su chip */}
      {!resuelto && e.trazos.length > 0 && (
        <div className="trazos-activos">
          {e.trazos.map((t) => (
            <button key={t.uid} className="trazo-chip"
              onClick={() => { sfx.deshacer(); on.cambio((st) => borrarTrazo(st, t.uid)) }}
              data-ayuda={esAsentado(t)
                ? 'ASENTADO: tu Atlas ya sostuvo este vínculo. Paga fichas seguras (una vez por combate).\n\nToca para deshacer el trazo.'
                : 'Toca para deshacer este trazo y recuperar su herramienta'}>
              {HERRAMIENTAS[t.tool].glifo}{t.param ? ` ${t.param.split('::').pop()}` : ''}
              {esAsentado(t) && <span className="asentado"> ✓ asentado</span>} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

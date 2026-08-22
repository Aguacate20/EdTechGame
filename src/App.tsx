import { useCallback, useMemo, useRef, useState } from 'react'
import type { Contenido } from './content/types'
import {
  afirmar as afirmarDiagrama, cambiar as cambiarPieza, iniciarBatalla, quemar as quemarPieza,
  siguienteTurno, turnoDelCarril, usarSello, vivos,
  type Bolsa, type ContextoBatalla, type EstadoBatalla
} from './engine/battle'
import { combinarLentes, type SelloId } from './engine/powers'
import type { HerramientaId } from './engine/tools'
import { generarRuta, ofrecerRecompensas, type Nodo, type Recompensa, type Ruta } from './engine/route'
import { objetivoPorId, unidadesSelladas, type Objetivo, type ObjetivoId } from './engine/objectives'
import { Rng, semillaLegible } from './engine/rng'
import { cargarAtlas, coberturaAtlas, descargarLog, guardarAtlas, registrar, type Atlas } from './engine/atlas'
import { BundleLoader } from './ui/BundleLoader'
import { BoardView } from './ui/BoardView'
import { AtlasView, CampfireView, EndView, MapView, ObjectiveView, RewardView } from './ui/Screens'
import { BattleMap } from './ui/BattleMap'
import { Antesala } from './ui/Antesala'
import { EncargoView } from './ui/EncargoView'
import {
  encargosPosibles, progresoDe, dominiosDeUnidad,
  type DesafioId, type Encargo, type Prediccion
} from './engine/srl'
import { Medidor } from './ui/components'
import { despertarAudio, estaSilenciado, silenciar, sfx } from './ui/sfx'

type Fase =
  | 'cargar' | 'plan' | 'encargo' | 'mapa' | 'antesala' | 'batalla'
  | 'resumen' | 'recompensa' | 'refugio' | 'atlas' | 'fin'

interface Cartera {
  lentes: string[]
  sellos: SelloId[]
  herramientas: HerramientaId[]
  relaciones: string[]
  casos: string[]
  tesis: string[]
  manoExtra: number
}

const LUCIDEZ_MAX = 80

const HERRAMIENTAS_BASE: HerramientaId[] = [
  'identidad', 'identidad', 'flecha', 'flecha', 'flecha', 'campo'
]
const HERRAMIENTAS_POR_PLAN: Record<ObjetivoId, HerramientaId[]> = {
  consolidar: ['identidad', 'identidad'],
  trazar: ['flecha', 'jerarquia'],
  salir: ['ancla', 'flecha']
}


export default function App() {
  const [contenido, setContenido] = useState<Contenido | null>(null)
  const [fase, setFase] = useState<Fase>('cargar')
  const [faseAnterior, setFaseAnterior] = useState<Fase>('mapa')

  const [ruta, setRuta] = useState<Ruta | null>(null)
  const [actoIdx, setActoIdx] = useState(0)
  const [alcanzables, setAlcanzables] = useState<string[]>([])
  const [visitados, setVisitados] = useState<string[]>([])
  const [nodoActual, setNodoActual] = useState<string | null>(null)

  const [lucidez, setLucidez] = useState(LUCIDEZ_MAX)
  const [cartera, setCartera] = useState<Cartera>({
    lentes: [], sellos: [], herramientas: HERRAMIENTAS_BASE,
    relaciones: [], casos: [], tesis: [], manoExtra: 0
  })
  const [fusionados, setFusionados] = useState<string[]>([])
  const [intuiciones, setIntuiciones] = useState<string[]>([])
  const [terrenos, setTerrenos] = useState<string[]>([])
  const [encargo, setEncargo] = useState<Encargo | null>(null)
  const [encargosOfrecidos, setEncargosOfrecidos] = useState<Encargo[]>([])
  const [encargoCobrado, setEncargoCobrado] = useState(false)
  const [contadores, setContadores] = useState({
    vinculos: 0, intuicionesReubicadas: 0, inferencias: 0, anclasLejanas: 0
  })
  const [planElegido, setPlanElegido] = useState<Objetivo | null>(null)
  const [objetivoRun, setObjetivoRun] = useState<ObjetivoId>('trazar')

  const [batalla, setBatalla] = useState<EstadoBatalla | null>(null)
  const [recompensas, setRecompensas] = useState<Recompensa[]>([])
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [victoria, setVictoria] = useState(false)
  const [mudo, setMudo] = useState(estaSilenciado())

  const rngRef = useRef(new Rng('inicio'))
  const runIdRef = useRef('')
  const nodoRef = useRef<Nodo | null>(null)

  const mods = useMemo(() => combinarLentes(cartera.lentes), [cartera.lentes])
  const ctx: ContextoBatalla | null = useMemo(
    () => (contenido ? { contenido, rng: rngRef.current, lentes: mods } : null),
    [contenido, mods]
  )

  /* ------------------------------- arranque ------------------------------- */

  const empezarRun = useCallback((c: Contenido, a: Atlas, obj: Objetivo, enc: Encargo) => {
    const semilla = semillaLegible()
    rngRef.current = new Rng(semilla)
    runIdRef.current = `${semilla}-${Date.now()}`
    let r: Ruta
    try { r = generarRuta(c, semilla) } catch (err) { alert((err as Error).message); return }

    setRuta(r); setActoIdx(0); setAlcanzables(r.actos[0].entradas)
    setVisitados([]); setNodoActual(null); setLucidez(LUCIDEZ_MAX)
    setCartera({
      lentes: [obj.lenteInicial], sellos: [],
      herramientas: [...HERRAMIENTAS_BASE, ...HERRAMIENTAS_POR_PLAN[obj.id]],
      relaciones: obj.relacionesIniciales, casos: [], tesis: [], manoExtra: 0
    })
    setFusionados([]); setIntuiciones([]); setTerrenos([])
    setEncargo(enc); setEncargoCobrado(false)
    setContadores({ vinculos: 0, intuicionesReubicadas: 0, inferencias: 0, anclasLejanas: 0 })
    setObjetivoRun(obj.id); setBatalla(null); setVictoria(false)
    const nuevo = { ...a, runs: a.runs + 1 }
    setAtlas(nuevo); guardarAtlas(nuevo)
    setFase('mapa')
  }, [])

  const alCargar = useCallback((c: Contenido) => {
    setContenido(c); setAtlas(cargarAtlas(c.fuente)); setFase('plan')
  }, [])

  const elegirPlan = useCallback((o: Objetivo) => {
    if (!contenido) return
    setPlanElegido(o)
    setEncargosOfrecidos(encargosPosibles(contenido, rngRef.current))
    setFase('encargo')
  }, [contenido])

  /* -------------------------------- avanzar -------------------------------- */

  const avanzar = useCallback(() => {
    if (!ruta) return
    const nodo = nodoRef.current
    if (!nodo) { setFase('mapa'); return }
    setVisitados((v) => (v.includes(nodo.id) ? v : [...v, nodo.id]))
    setNodoActual(nodo.id)
    if (nodo.salidas.length) { setAlcanzables(nodo.salidas); setFase('mapa'); return }
    if (actoIdx + 1 < ruta.actos.length) {
      setActoIdx(actoIdx + 1)
      setAlcanzables(ruta.actos[actoIdx + 1].entradas)
      setNodoActual(null); setFase('mapa'); return
    }
    if (encargo && !encargoCobrado) {
      const p = progresoDe(encargo, {
        ...contadores, lucidez, unidadesSelladas: unidadesSelladas(atlas!, contenido!).length
      })
      if (p.cumplido) setEncargoCobrado(true)
    }
    setVictoria(true)
    if (atlas) { const a = { ...atlas, victorias: atlas.victorias + 1 }; setAtlas(a); guardarAtlas(a) }
    setFase('fin')
  }, [ruta, actoIdx, atlas])

  /* ------------------------------ entrar a nodo ---------------------------- */

  const entrarNodo = useCallback((nodo: Nodo) => {
    if (!contenido || !ruta || !ctx) return
    nodoRef.current = nodo
    if (nodo.tipo === 'refugio') { setFase('refugio'); return }
    setFase('antesala')
  }, [contenido, ruta, ctx])

  const empezarBatalla = useCallback((prediccion: Prediccion, desafio: DesafioId | null) => {
    const nodo = nodoRef.current
    if (!contenido || !ruta || !ctx || !nodo) return
    const acto = ruta.actos[actoIdx]
    const bolsa: Bolsa = {
      herramientas: cartera.herramientas,
      relaciones: cartera.relaciones,
      casos: [...new Set([...nodo.casos, ...cartera.casos])],
      tesis: [...new Set([...nodo.tesis, ...cartera.tesis])],
      intuiciones, fusionados, terrenos,
      sellos: cartera.sellos,
      desafio, prediccion
    }
    setBatalla(iniciarBatalla(
      ctx, nodo.conceptIds, bolsa, nodo.dificultad, actoIdx,
      acto.manoSugerida + cartera.manoExtra
    ))
    setFase('batalla')
  }, [contenido, ruta, ctx, actoIdx, cartera, intuiciones, fusionados, terrenos])

  /* ------------------------------- acciones -------------------------------- */

  const cambio = (mut: (e: EstadoBatalla) => void) =>
    setBatalla((prev) => { if (!prev) return prev; const e = { ...prev }; mut(e); return e })

  const registrarPozo = (ev: ReturnType<typeof quemarPieza>) => {
    if (!ev) return
    registrar({
      ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
      arquetipo: `pozo:${ev.accion}`, condicion: null, mecanica: ev.dimension,
      itemId: `${ev.accion}:${ev.clase}`, conceptIds: ev.conceptId ? [ev.conceptId] : [],
      operacion: ev.accion, improvisado: false, seleccion: [],
      correcto: ev.acertado, apuesta: '—', calibrado: ev.acertado,
      latenciaMs: 0, ayuda: false, repertorioTocado: null
    })
  }

  const quemar = (uid: string) => setBatalla((prev) => {
    if (!prev || !ctx) return prev
    const e = { ...prev }
    const ev = quemarPieza(e, ctx, uid)
    registrarPozo(ev)
    if (ev) ev.acertado ? sfx.fusion() : sfx.derrumbe()
    return e
  })

  const cambiar = (uid: string) => setBatalla((prev) => {
    if (!prev) return prev
    const e = { ...prev }
    registrarPozo(cambiarPieza(e, uid))
    sfx.deshacer()
    return e
  })

  const sello = (id: SelloId) => setBatalla((prev) => {
    if (!prev) return prev
    const e = { ...prev }
    const msg = usarSello(e, id)
    if (msg) sfx.trazar()
    return e
  })

  const afirmar = () => {
    if (!batalla || !ctx || !contenido || !atlas) return
    const e = { ...batalla }
    const r = afirmarDiagrama(e, ctx)
    turnoDelCarril(e, ctx, r)

    let nueva = lucidez - r.danoRecibido
    if (r.diag.repertoriosReubicados.length) nueva += 6
    nueva = Math.min(LUCIDEZ_MAX, nueva)
    setLucidez(Math.max(0, nueva))
    if (nueva <= 0 && e.fase !== 'ganado') e.fase = 'perdido'

    setFusionados(e.fusionados)
    setTerrenos(e.terrenosGanados)
    setContadores((x) => ({
      vinculos: x.vinculos + r.diag.aristas.length,
      intuicionesReubicadas: x.intuicionesReubicadas + r.diag.repertoriosReubicados.length,
      inferencias: x.inferencias + r.diag.veredictos.filter((v) => v.inferencia).length,
      anclasLejanas: x.anclasLejanas + r.diag.veredictos.filter(
        (v) => v.trazo.tool === 'ancla' && v.estado === 'sostenido'
      ).length
    }))
    if (r.intuicionesNuevas.length) {
      setIntuiciones((x) => [...new Set([...x, ...r.intuicionesNuevas])])
    }

    const a: Atlas = { ...atlas, conceptos: { ...atlas.conceptos }, aristas: { ...atlas.aristas } }
    for (const v of r.diag.veredictos) {
      if (v.estado === 'silencio') continue
      const ok = v.estado === 'sostenido' || v.estado === 'equivalente'
      for (const cid of v.conceptIds) {
        const prev = a.conceptos[cid] ??
          { aciertos: 0, fallos: 0, mecanicas: [], vecinos: [], ultimaApuestaAcertada: null }
        const otros = v.conceptIds.filter((x) => x !== cid)
        a.conceptos[cid] = {
          aciertos: prev.aciertos + (ok ? 1 : 0),
          fallos: prev.fallos + (ok ? 0 : 1),
          mecanicas: ok ? [...new Set([...prev.mecanicas, v.trazo.tool])] : prev.mecanicas,
          vecinos: ok ? [...new Set([...(prev.vecinos ?? []), ...otros])] : (prev.vecinos ?? []),
          ultimaApuestaAcertada: prev.ultimaApuestaAcertada
        }
      }
    }
    for (const ar of r.diag.aristas) {
      const k = `${ar.from}|${ar.to}|${ar.tipo}`
      a.aristas[k] = { ...ar, aciertos: (a.aristas[k]?.aciertos ?? 0) + 1 }
    }
    if (r.diag.repertoriosReubicados.length) {
      a.repertoriosEstabilizados = [...new Set([...a.repertoriosEstabilizados, ...r.diag.repertoriosReubicados])]
    }
    a.apuestasTotales += r.diag.veredictos.length
    a.apuestasCalibradas += r.diag.sostenidos
    setAtlas(a); guardarAtlas(a)

    for (const v of r.diag.veredictos) {
      registrar({
        ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
        arquetipo: e.enemigos.map((x) => x.tipoId).join('+'),
        condicion: e.dificultad, mecanica: `${v.trazo.tool}:${v.dimension}`,
        itemId: v.trazo.param ? `${v.trazo.tool}:${v.trazo.param}` : v.trazo.tool,
        conceptIds: v.conceptIds, operacion: v.trazo.tool, improvisado: false,
        seleccion: v.trazo.piezas, correcto: v.estado === 'sostenido',
        apuesta: v.estado, calibrado: v.estado === 'sostenido',
        latenciaMs: e.latencias[e.latencias.length - 1]?.ms ?? 0,
        ayuda: e.latencias[e.latencias.length - 1]?.conIntuicion ?? false,
        repertorioTocado: v.repertorioReubicado
      })
    }
    setBatalla(e)
  }

  const continuar = () => {
    if (!batalla || !contenido) return
    if (batalla.fase === 'perdido') { setVictoria(false); setFase('fin'); return }
    if (batalla.fase === 'ganado' || vivos(batalla).length === 0) {
      const nodo = nodoRef.current
      const dura = nodo?.dificultad === 'dura' || nodo?.dificultad === 'jefe'
      const extra = batalla.desafio ? 1 : 0
      const ofertas = [
        ...ofrecerRecompensas(contenido, cartera, rngRef.current, dura),
        ...(extra ? ofrecerRecompensas(contenido, cartera, rngRef.current, true).slice(0, 1) : [])
      ]
      setRecompensas(ofertas)
      if (atlas) {
        const a = { ...atlas, mejoresDiagramas: [...(atlas.mejoresDiagramas ?? []), batalla.mejorGolpe.dano] }
        setAtlas(a); guardarAtlas(a)
      }
      setFase('resumen'); return
    }
    const e = { ...batalla }
    siguienteTurno(e)
    setBatalla(e)
  }

  const tomarRecompensa = (r: Recompensa) => {
    setCartera((c) => {
      switch (r.tipo) {
        case 'lente': return { ...c, lentes: [...c.lentes, r.id] }
        case 'sello': return { ...c, sellos: [...c.sellos, r.id] }
        case 'herramienta': return { ...c, herramientas: [...c.herramientas, r.id] }
        case 'relacion': return { ...c, relaciones: [...c.relaciones, r.tipoRelacion] }
        case 'caso': return { ...c, casos: [...c.casos, r.id] }
        case 'tesis': return { ...c, tesis: [...c.tesis, r.id] }
        case 'fichero': return { ...c, manoExtra: c.manoExtra + 1 }
        default: return c
      }
    })
    if (r.tipo === 'lucidez') setLucidez((l) => Math.min(LUCIDEZ_MAX, l + r.cantidad))
    avanzar()
  }

  /* -------------------------------- render -------------------------------- */

  if (fase === 'cargar' || !contenido || !atlas) {
    return <div className="app"><BundleLoader onListo={alCargar} /></div>
  }
  if (fase === 'plan') {
    return (
      <div className="app">
        <ObjectiveView contenido={contenido} onElegir={elegirPlan} />
      </div>
    )
  }
  if (fase === 'encargo') {
    return (
      <div className="app">
        <EncargoView
          encargos={encargosOfrecidos} contenido={contenido}
          onElegir={(e) => planElegido && empezarRun(contenido, atlas, planElegido, e)}
        />
      </div>
    )
  }
  if (!ruta) return <div className="app"><BundleLoader onListo={alCargar} /></div>

  const acto = ruta.actos[actoIdx]
  const cob = coberturaAtlas(atlas, contenido)

  return (
    <div className="app">
      <header className="barra">
        <span className="marca">El Archivo Infinito</span>
        <span className="eyebrow">{objetivoPorId(objetivoRun).nombre}</span>
        <span className="sep" />
        {fase !== 'batalla' && <Medidor valor={lucidez} max={LUCIDEZ_MAX} etiqueta="Lucidez" />}
        {encargo && (() => {
          const p = progresoDe(encargo, {
            ...contadores, lucidez,
            unidadesSelladas: unidadesSelladas(atlas, contenido).length
          })
          return (
            <span
              className={`encargo-marca${p.cumplido ? ' cumplido' : ''}`}
              data-ayuda={`${encargo.nombre.toUpperCase()}\n${encargo.descripcion}\n\n${encargo.premio}`}
            >
              {p.cumplido ? '✓ ' : ''}{encargo.nombre} {Math.min(p.hecho, encargo.meta)}/{encargo.meta}
            </span>
          )
        })()}
        <span className="dato silencio">Atlas {cob.pct}%</span>
        <button className="btn fantasma" onClick={() => { setFaseAnterior(fase); setFase('atlas') }}>Atlas</button>
        <button
          className="btn fantasma" aria-pressed={mudo}
          onClick={() => { const v = !mudo; silenciar(v); setMudo(v); if (!v) despertarAudio() }}
        >{mudo ? 'Sonido off' : 'Sonido on'}</button>
        <button className="btn fantasma" onClick={descargarLog}>Señales</button>
      </header>

      {fase === 'mapa' && (
        <MapView
          ruta={ruta} acto={acto} alcanzables={alcanzables} visitados={visitados}
          actual={nodoActual} onElegir={entrarNodo} contenido={contenido} atlas={atlas}
          lentes={cartera.lentes}
        />
      )}

      {fase === 'antesala' && nodoRef.current && (
        <Antesala
          nodo={nodoRef.current} contenido={contenido} atlas={atlas}
          onEntrar={empezarBatalla}
        />
      )}

      {fase === 'batalla' && batalla && (
        <BoardView
          e={batalla} contenido={contenido} lentes={mods}
          lucidez={lucidez} lucidezMax={LUCIDEZ_MAX} lentesIds={cartera.lentes}
          on={{
            cambio, afirmar, continuar, quemar, cambiar, sello,
            huir: () => { setVictoria(false); setFase('fin') }
          }}
        />
      )}

      {fase === 'resumen' && batalla && (
        <BattleMap
          contenido={contenido} hallazgos={batalla.hallazgos} atlas={atlas}
          mejorGolpe={batalla.mejorGolpe} enemigos={batalla.enemigos}
          prediccion={batalla.prediccion} desafio={batalla.desafio}
          latencias={batalla.latencias}
          onSeguir={() => setFase('recompensa')}
        />
      )}

      {fase === 'recompensa' && (
        <RewardView
          opciones={recompensas} onElegir={tomarRecompensa} contenido={contenido}
          titulo="Elige tu hallazgo"
        />
      )}

      {fase === 'refugio' && (
        <CampfireView
          cartera={cartera} fusionados={fusionados} contenido={contenido}
          dominios={dominiosDeUnidad(contenido, acto.columnas.flat().flatMap((n) => n.conceptIds))}
          onReflexionar={(d) => registrar({
            ts: Date.now(), runId: runIdRef.current, nodoId: `acto${actoIdx}`,
            arquetipo: 'reflexion', condicion: null, mecanica: 'work_reflection',
            itemId: `dominio:${d}`, conceptIds: [], operacion: 'reflexionar',
            improvisado: false, seleccion: [d], correcto: true, apuesta: '—',
            calibrado: true, latenciaMs: 0, ayuda: false, repertorioTocado: null
          })}
          lucidez={lucidez} lucidezMax={LUCIDEZ_MAX}
          onDescansar={() => { setLucidez((l) => Math.min(LUCIDEZ_MAX, l + 26)); avanzar() }}
          onSoltarLente={(id) => {
            setCartera((c) => ({ ...c, lentes: c.lentes.filter((y) => y !== id) }))
            avanzar()
          }}
        />
      )}

      {fase === 'atlas' && (
        <AtlasView atlas={atlas} contenido={contenido} onVolver={() => setFase(faseAnterior)} />
      )}

      {fase === 'fin' && (
        <EndView
          victoria={victoria} atlas={atlas} contenido={contenido}
          onReiniciar={() => setFase('plan')}
          onAtlas={() => { setFaseAnterior('fin'); setFase('atlas') }}
        />
      )}
    </div>
  )
}

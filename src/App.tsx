import { useCallback, useMemo, useRef, useState } from 'react'
import type { Contenido } from './content/types'
import {
  afirmar as afirmarDiagrama, cambiar as cambiarPieza, iniciarBatalla, quemar as quemarPieza,
  siguienteTurno, turnoDelCarril, vivos, type Bolsa, type ContextoBatalla, type EstadoBatalla
} from './engine/battle'
import { combinarLentes } from './engine/lenses'
import type { HerramientaId } from './engine/tools'
import { generarRuta, ofrecerRecompensas, type Nodo, type Recompensa, type Ruta } from './engine/route'
import { objetivoPorId, type Objetivo, type ObjetivoId } from './engine/objectives'
import { Rng, semillaLegible } from './engine/rng'
import { cargarAtlas, coberturaAtlas, descargarLog, guardarAtlas, registrar, type Atlas } from './engine/atlas'
import { BundleLoader } from './ui/BundleLoader'
import { BoardView } from './ui/BoardView'
import { AtlasView, CampfireView, EndView, MapView, ObjectiveView, RewardView } from './ui/Screens'
import { Medidor } from './ui/components'
import { despertarAudio, estaSilenciado, silenciar } from './ui/sfx'

type Fase = 'cargar' | 'plan' | 'mapa' | 'batalla' | 'recompensa' | 'refugio' | 'atlas' | 'fin'

const LUCIDEZ_MAX = 80

/** Las herramientas con las que se empieza: lo mínimo para que cualquier bundle
 *  permita jugar, más las dos del plan elegido. */
const HERRAMIENTAS_BASE: HerramientaId[] = [
  'identidad', 'identidad', 'flecha', 'flecha', 'tachon', 'campo'
]

const HERRAMIENTAS_POR_PLAN: Record<ObjetivoId, HerramientaId[]> = {
  consolidar: ['identidad', 'tachon'],
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
  const [herramientas, setHerramientas] = useState<HerramientaId[]>(HERRAMIENTAS_BASE)
  const [relaciones, setRelaciones] = useState<string[]>([])
  const [lentes, setLentes] = useState<string[]>([])
  const [casos, setCasos] = useState<string[]>([])
  const [tesis, setTesis] = useState<string[]>([])
  const [fusionados, setFusionados] = useState<string[]>([])
  const [intuiciones, setIntuiciones] = useState<string[]>([])
  const [objetivoRun, setObjetivoRun] = useState<ObjetivoId>('trazar')

  const [batalla, setBatalla] = useState<EstadoBatalla | null>(null)
  const [recompensas, setRecompensas] = useState<Recompensa[]>([])
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [victoria, setVictoria] = useState(false)
  const [mudo, setMudo] = useState(estaSilenciado())

  const rngRef = useRef(new Rng('inicio'))
  const runIdRef = useRef('')
  const nodoRef = useRef<Nodo | null>(null)

  const mods = useMemo(() => combinarLentes(lentes), [lentes])
  const ctx: ContextoBatalla | null = useMemo(
    () => (contenido ? { contenido, rng: rngRef.current, lentes: mods } : null),
    [contenido, mods]
  )

  /* ------------------------------- arranque ------------------------------- */

  const empezarRun = useCallback((c: Contenido, a: Atlas, obj: Objetivo) => {
    const semilla = semillaLegible()
    rngRef.current = new Rng(semilla)
    runIdRef.current = `${semilla}-${Date.now()}`
    let r: Ruta
    try { r = generarRuta(c, semilla) } catch (err) { alert((err as Error).message); return }

    setRuta(r); setActoIdx(0); setAlcanzables(r.actos[0].entradas)
    setVisitados([]); setNodoActual(null); setLucidez(LUCIDEZ_MAX)
    setHerramientas([...HERRAMIENTAS_BASE, ...HERRAMIENTAS_POR_PLAN[obj.id]])
    setRelaciones(obj.relacionesIniciales)
    setLentes([obj.lenteInicial])
    setCasos([]); setTesis([]); setFusionados([]); setIntuiciones([])
    setObjetivoRun(obj.id); setBatalla(null); setVictoria(false)
    const nuevo = { ...a, runs: a.runs + 1 }
    setAtlas(nuevo); guardarAtlas(nuevo)
    setFase('mapa')
  }, [])

  const alCargar = useCallback((c: Contenido) => {
    setContenido(c); setAtlas(cargarAtlas(c.fuente)); setFase('plan')
  }, [])

  /* -------------------------------- avanzar -------------------------------- */

  const avanzar = useCallback(() => {
    if (!ruta) return
    const nodo = nodoRef.current
    if (!nodo) { setFase('mapa'); return }
    setVisitados((v) => [...v, nodo.id])
    setNodoActual(nodo.id)
    if (nodo.salidas.length) { setAlcanzables(nodo.salidas); setFase('mapa'); return }
    if (actoIdx + 1 < ruta.actos.length) {
      setActoIdx(actoIdx + 1)
      setAlcanzables(ruta.actos[actoIdx + 1].entradas)
      setNodoActual(null); setFase('mapa'); return
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
    if (nodo.tipo === 'taller') {
      setRecompensas(ofrecerRecompensas(contenido, lentes, relaciones, rngRef.current, false))
      setFase('recompensa'); return
    }
    const acto = ruta.actos[actoIdx]
    const bolsa: Bolsa = {
      herramientas, relaciones,
      casos: [...new Set([...nodo.casos, ...casos])],
      tesis: [...new Set([...nodo.tesis, ...tesis])],
      intuiciones, fusionados
    }
    setBatalla(iniciarBatalla(ctx, nodo.conceptIds, bolsa, nodo.dificultad, actoIdx, acto.manoSugerida))
    setFase('batalla')
  }, [contenido, ruta, ctx, actoIdx, herramientas, relaciones, casos, tesis, intuiciones, fusionados, lentes])

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
    if (!prev) return prev
    const e = { ...prev }
    registrarPozo(quemarPieza(e, uid))
    return e
  })

  const cambiar = (uid: string) => setBatalla((prev) => {
    if (!prev) return prev
    const e = { ...prev }
    registrarPozo(cambiarPieza(e, uid))
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
    if (r.intuicionesNuevas.length) {
      setIntuiciones((x) => [...new Set([...x, ...r.intuicionesNuevas])])
    }

    // Atlas: la progresión permanente es evidencia, no números
    const a: Atlas = { ...atlas, conceptos: { ...atlas.conceptos }, aristas: { ...atlas.aristas } }
    for (const v of r.diag.veredictos) {
      if (v.estado === 'silencio') continue
      const ok = v.estado === 'sostenido'
      for (const cid of v.conceptIds) {
        const prev = a.conceptos[cid] ?? { aciertos: 0, fallos: 0, mecanicas: [], ultimaApuestaAcertada: null }
        a.conceptos[cid] = {
          aciertos: prev.aciertos + (ok ? 1 : 0),
          fallos: prev.fallos + (ok ? 0 : 1),
          mecanicas: ok ? [...new Set([...prev.mecanicas, v.trazo.tool])] : prev.mecanicas,
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
        latenciaMs: 0, ayuda: false, repertorioTocado: v.repertorioReubicado
      })
    }

    setBatalla(e)
  }

  const continuar = () => {
    if (!batalla) return
    if (batalla.fase === 'perdido') { setVictoria(false); setFase('fin'); return }
    if (batalla.fase === 'ganado' || vivos(batalla).length === 0) {
      const nodo = nodoRef.current
      const dura = nodo?.dificultad === 'dura' || nodo?.dificultad === 'jefe'
      if (contenido) {
        setRecompensas(ofrecerRecompensas(contenido, lentes, relaciones, rngRef.current, dura))
      }
      setFase('recompensa'); return
    }
    const e = { ...batalla }
    siguienteTurno(e)
    setBatalla(e)
  }

  const tomarRecompensa = (r: Recompensa) => {
    if (r.tipo === 'lente') setLentes((x) => [...x, r.id])
    if (r.tipo === 'relacion') setRelaciones((x) => [...x, r.tipoRelacion])
    if (r.tipo === 'caso') setCasos((x) => [...x, r.id])
    if (r.tipo === 'tesis') setTesis((x) => [...x, r.id])
    if (r.tipo === 'lucidez') setLucidez((l) => Math.min(LUCIDEZ_MAX, l + r.cantidad))
    if (r.tipo === 'ranura') setHerramientas((x) => [...x, 'flecha'])
    avanzar()
  }

  /* -------------------------------- render -------------------------------- */

  if (fase === 'cargar' || !contenido || !atlas) {
    return <div className="app"><BundleLoader onListo={alCargar} /></div>
  }
  if (fase === 'plan') {
    return (
      <div className="app">
        <ObjectiveView contenido={contenido} onElegir={(o) => empezarRun(contenido, atlas, o)} />
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
        <span className="dato silencio">Atlas {cob.pct}%</span>
        <button className="btn fantasma" onClick={() => { setFaseAnterior(fase); setFase('atlas') }}>Atlas</button>
        <button
          className="btn fantasma"
          aria-pressed={mudo}
          title={mudo ? 'Activar sonido' : 'Silenciar'}
          onClick={() => { const v = !mudo; silenciar(v); setMudo(v); if (!v) despertarAudio() }}
        >
          {mudo ? 'Sonido off' : 'Sonido on'}
        </button>
        <button className="btn fantasma" onClick={descargarLog}>Señales</button>
      </header>

      {fase === 'mapa' && (
        <MapView
          ruta={ruta} acto={acto} alcanzables={alcanzables} visitados={visitados}
          actual={nodoActual} onElegir={entrarNodo} contenido={contenido} atlas={atlas}
          lentes={lentes}
        />
      )}

      {fase === 'batalla' && batalla && (
        <BoardView
          e={batalla} contenido={contenido} lentes={mods}
          lucidez={lucidez} lucidezMax={LUCIDEZ_MAX}
          on={{
            cambio, afirmar, continuar, quemar, cambiar,
            huir: () => { setVictoria(false); setFase('fin') }
          }}
        />
      )}

      {fase === 'recompensa' && (
        <RewardView
          opciones={recompensas} onElegir={tomarRecompensa} contenido={contenido}
          titulo={nodoRef.current?.tipo === 'taller' ? 'Taller' : 'El carril queda despejado'}
        />
      )}

      {fase === 'refugio' && (
        <CampfireView
          lentes={lentes} relaciones={relaciones} herramientas={herramientas}
          fusionados={fusionados} contenido={contenido}
          lucidez={lucidez} lucidezMax={LUCIDEZ_MAX}
          onDescansar={() => { setLucidez((l) => Math.min(LUCIDEZ_MAX, l + 26)); avanzar() }}
          onSoltarLente={(id) => { setLentes((x) => x.filter((y) => y !== id)); avanzar() }}
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

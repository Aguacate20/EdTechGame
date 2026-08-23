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
import { dominiosDeUnidad } from './engine/objectives'
import { Rng, semillaLegible } from './engine/rng'
import {
  cargarAtlas, coberturaAtlas, descargarLog, guardarAtlas, registrar, type Atlas
} from './engine/atlas'
import { BundleLoader } from './ui/BundleLoader'
import { BoardView } from './ui/BoardView'
import { AtlasView, CampfireView, EndView, MapView, RewardView } from './ui/Screens'
import { BattleMap } from './ui/BattleMap'
import { HomeView } from './ui/HomeView'
import { Medidor } from './ui/components'
import { despertarAudio, estaSilenciado, silenciar, sfx } from './ui/sfx'

type Fase =
  | 'cargar' | 'inicio' | 'mapa' | 'batalla'
  | 'resumen' | 'recompensa' | 'refugio' | 'atlas' | 'fin'

const LUCIDEZ_MAX = 80

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
  /** lo que se gana DENTRO de la expedición; al terminar se funde con el progreso */
  const [casos, setCasos] = useState<string[]>([])
  const [tesis, setTesis] = useState<string[]>([])
  const [fusionados, setFusionados] = useState<string[]>([])
  const [intuiciones, setIntuiciones] = useState<string[]>([])
  const [manoExtra, setManoExtra] = useState(0)

  const [batalla, setBatalla] = useState<EstadoBatalla | null>(null)
  const [recompensas, setRecompensas] = useState<Recompensa[]>([])
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [victoria, setVictoria] = useState(false)
  const [mudo, setMudo] = useState(estaSilenciado())

  const rngRef = useRef(new Rng('inicio'))
  const runIdRef = useRef('')
  const nodoRef = useRef<Nodo | null>(null)

  const progreso = atlas?.progreso
  const mods = useMemo(() => combinarLentes(progreso?.lentes ?? []), [progreso?.lentes])
  const ctx: ContextoBatalla | null = useMemo(
    () => (contenido ? { contenido, rng: rngRef.current, lentes: mods } : null),
    [contenido, mods]
  )

  /** Todo lo ganado se guarda en el Atlas: las expediciones no empiezan de cero. */
  const guardarProgreso = useCallback((f: (p: NonNullable<typeof progreso>) => Partial<NonNullable<typeof progreso>>) => {
    setAtlas((prev) => {
      if (!prev) return prev
      const a = { ...prev, progreso: { ...prev.progreso, ...f(prev.progreso) } }
      guardarAtlas(a)
      return a
    })
  }, [])

  /* ------------------------------- arranque ------------------------------- */

  const alCargar = useCallback((c: Contenido) => {
    setContenido(c); setAtlas(cargarAtlas(c.fuente)); setFase('inicio')
  }, [])

  const empezarExpedicion = useCallback(() => {
    if (!contenido || !atlas) return
    const semilla = semillaLegible()
    rngRef.current = new Rng(semilla)
    runIdRef.current = `${semilla}-${Date.now()}`
    let r: Ruta
    try { r = generarRuta(contenido, semilla) } catch (err) { alert((err as Error).message); return }

    setRuta(r); setActoIdx(0); setAlcanzables(r.actos[0].entradas)
    setVisitados([]); setNodoActual(null); setLucidez(LUCIDEZ_MAX)
    setCasos([]); setTesis([]); setFusionados([]); setIntuiciones([]); setManoExtra(0)
    setBatalla(null); setVictoria(false)
    const a = {
      ...atlas, runs: atlas.runs + 1,
      progreso: { ...atlas.progreso, expediciones: atlas.progreso.expediciones + 1 }
    }
    setAtlas(a); guardarAtlas(a)
    setFase('mapa')
  }, [contenido, atlas])

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
    setVictoria(true)
    if (atlas) { const a = { ...atlas, victorias: atlas.victorias + 1 }; setAtlas(a); guardarAtlas(a) }
    setFase('fin')
  }, [ruta, actoIdx, atlas])

  /* ------------------------------ entrar a nodo ---------------------------- */

  const entrarNodo = useCallback((nodo: Nodo) => {
    if (!contenido || !ruta || !ctx || !progreso) return
    nodoRef.current = nodo
    if (nodo.tipo === 'refugio') { setFase('refugio'); return }
    const acto = ruta.actos[actoIdx]
    const bolsa: Bolsa = {
      herramientas: progreso.herramientas as HerramientaId[],
      relaciones: progreso.relaciones,
      casos: [...new Set([...nodo.casos, ...casos])],
      tesis: [...new Set([...nodo.tesis, ...tesis])],
      intuiciones, fusionados,
      terrenos: progreso.terrenos,
      sellos: progreso.sellos as SelloId[]
    }
    // el carril escala con las expediciones ya hechas: vuelves más fuerte, pero
    // también encuentras enemigos más duros
    const actoEfectivo = actoIdx + Math.min(3, Math.floor(progreso.expediciones / 2))
    setBatalla(iniciarBatalla(
      ctx, nodo.conceptIds, bolsa, nodo.dificultad, actoEfectivo,
      acto.manoSugerida + manoExtra
    ))
    setFase('batalla')
  }, [contenido, ruta, ctx, actoIdx, progreso, casos, tesis, intuiciones, fusionados, manoExtra])

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
    if (usarSello(e, id)) sfx.trazar()
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

    const a: Atlas = { ...atlas, conceptos: { ...atlas.conceptos }, aristas: { ...atlas.aristas } }
    // los vínculos descubiertos y los terrenos ganados se conservan entre expediciones
    if (r.descubiertos.length || e.terrenosGanados.length) {
      a.progreso = {
        ...a.progreso,
        relaciones: [...new Set([...a.progreso.relaciones, ...r.descubiertos])],
        terrenos: [...new Set([...a.progreso.terrenos, ...e.terrenosGanados])]
      }
    }
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
    if (!batalla || !contenido || !progreso) return
    if (batalla.fase === 'perdido') { setVictoria(false); setFase('fin'); return }
    if (batalla.fase === 'ganado' || vivos(batalla).length === 0) {
      const nodo = nodoRef.current
      const dura = nodo?.dificultad === 'dura' || nodo?.dificultad === 'jefe'
      setRecompensas(ofrecerRecompensas(contenido, {
        lentes: progreso.lentes, sellos: progreso.sellos as SelloId[],
        herramientas: progreso.herramientas as HerramientaId[], relaciones: progreso.relaciones
      }, rngRef.current, dura))
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
    switch (r.tipo) {
      case 'lente': guardarProgreso((p) => ({ lentes: [...p.lentes, r.id] })); break
      case 'sello': guardarProgreso((p) => ({ sellos: [...p.sellos, r.id] })); break
      case 'herramienta': guardarProgreso((p) => ({ herramientas: [...p.herramientas, r.id] })); break
      case 'relacion': guardarProgreso((p) => ({ relaciones: [...new Set([...p.relaciones, r.tipoRelacion])] })); break
      case 'caso': setCasos((c) => [...c, r.id]); break
      case 'tesis': setTesis((c) => [...c, r.id]); break
      case 'fichero': setManoExtra((m) => m + 1); break
      case 'lucidez': setLucidez((l) => Math.min(LUCIDEZ_MAX, l + r.cantidad)); break
    }
    avanzar()
  }

  /* -------------------------------- render -------------------------------- */

  if (fase === 'cargar' || !contenido || !atlas || !progreso) {
    return <div className="app"><BundleLoader onListo={alCargar} /></div>
  }
  if (fase === 'inicio') {
    return (
      <div className="app">
        <header className="barra">
          <span className="marca">El Archivo Infinito</span>
          <span className="sep" />
          <button
            className="btn fantasma" aria-pressed={mudo}
            onClick={() => { const v = !mudo; silenciar(v); setMudo(v); if (!v) despertarAudio() }}
          >{mudo ? 'Sonido off' : 'Sonido on'}</button>
          <button className="btn fantasma" onClick={descargarLog}>Señales</button>
        </header>
        <HomeView
          atlas={atlas} contenido={contenido}
          onExpedicion={empezarExpedicion}
          onCambiarTexto={() => { setContenido(null); setFase('cargar') }}
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
        <span className="eyebrow">expedición {progreso.expediciones}</span>
        <span className="sep" />
        {fase !== 'batalla' && <Medidor valor={lucidez} max={LUCIDEZ_MAX} etiqueta="Lucidez" />}
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
          lentes={progreso.lentes}
        />
      )}

      {fase === 'batalla' && batalla && (
        <BoardView
          e={batalla} contenido={contenido} lentes={mods}
          lucidez={lucidez} lucidezMax={LUCIDEZ_MAX} lentesIds={progreso.lentes}
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
          latencias={batalla.latencias} descubiertos={batalla.relacionesNuevas}
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
          cartera={{
            lentes: progreso.lentes, sellos: progreso.sellos as SelloId[],
            herramientas: progreso.herramientas as HerramientaId[], relaciones: progreso.relaciones
          }}
          fusionados={fusionados} contenido={contenido}
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
            guardarProgreso((p) => ({ lentes: p.lentes.filter((y) => y !== id) }))
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
          onReiniciar={() => setFase('inicio')}
          onAtlas={() => { setFaseAnterior('fin'); setFase('atlas') }}
        />
      )}
    </div>
  )
}

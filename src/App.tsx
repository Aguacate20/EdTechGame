import { useCallback, useMemo, useRef, useState } from 'react'
import type { Contenido, Item } from './content/types'
import { MAZO_INICIAL, porId, type EfectoInstrumento } from './engine/cards'
import {
  aplicar, armarMazo, robar, resolver as resolverEmbate, siguienteTurno, tamanoMano,
  type ContextoCombate, type EstadoCombate, type Apuesta
} from './engine/combat'
import {
  ARQUETIPOS, construirEmbate, itemsCandidatos, type Embate
} from './engine/encounters'
import { embateDeTesis } from './engine/boss'
import { generarRuta, ofrecerRecompensas, type Nodo, type Recompensa, type Ruta } from './engine/run'
import { Rng, semillaLegible } from './engine/rng'
import {
  cargarAtlas, coberturaAtlas, descargarLog, guardarAtlas, registrar, type Atlas
} from './engine/atlas'
import { BundleLoader } from './ui/BundleLoader'
import { CombatView } from './ui/CombatView'
import { AtlasView, CampfireView, EndView, MapView, RewardView } from './ui/Screens'
import { Medidor } from './ui/components'

type Fase = 'cargar' | 'mapa' | 'combate' | 'recompensa' | 'refugio' | 'atlas' | 'fin'

const LUCIDEZ_MAX = 70

export default function App() {
  const [contenido, setContenido] = useState<Contenido | null>(null)
  const [fase, setFase] = useState<Fase>('cargar')
  const [faseAnterior, setFaseAnterior] = useState<Fase>('mapa')

  const [ruta, setRuta] = useState<Ruta | null>(null)
  const [actoIdx, setActoIdx] = useState(0)
  const [capaIdx, setCapaIdx] = useState(0)
  const [visitados, setVisitados] = useState<string[]>([])

  const [lucidez, setLucidez] = useState(LUCIDEZ_MAX)
  const [mazo, setMazo] = useState<string[]>(MAZO_INICIAL)
  const [instrumentos, setInstrumentos] = useState<EfectoInstrumento[]>([])

  const [combate, setCombate] = useState<EstadoCombate | null>(null)
  const [recompensas, setRecompensas] = useState<Recompensa[]>([])
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [victoria, setVictoria] = useState(false)

  const rngRef = useRef(new Rng('inicio'))
  const runIdRef = useRef('')
  const usadosRef = useRef<Set<string>>(new Set())
  const nodoRef = useRef<Nodo | null>(null)
  const anteriorRef = useRef<string | null>(null)

  const ctx: ContextoCombate | null = useMemo(
    () => (contenido ? { contenido, instrumentos, rng: rngRef.current } : null),
    [contenido, instrumentos]
  )

  /* ------------------------------- arranque ------------------------------- */

  const empezarRun = useCallback((c: Contenido, a: Atlas) => {
    const semilla = semillaLegible()
    rngRef.current = new Rng(semilla)
    runIdRef.current = `${semilla}-${Date.now()}`
    usadosRef.current = new Set()
    anteriorRef.current = null
    try {
      setRuta(generarRuta(c, semilla))
    } catch (err) {
      alert((err as Error).message)
      return
    }
    setActoIdx(0); setCapaIdx(0); setVisitados([])
    setLucidez(LUCIDEZ_MAX); setMazo(MAZO_INICIAL); setInstrumentos([])
    setCombate(null); setVictoria(false)
    const nuevo = { ...a, runs: a.runs + 1 }
    setAtlas(nuevo); guardarAtlas(nuevo)
    setFase('mapa')
  }, [])

  const alCargar = useCallback((c: Contenido) => {
    setContenido(c)
    const a = cargarAtlas(c.fuente)
    setAtlas(a)
    empezarRun(c, a)
  }, [empezarRun])

  /* ---------------------------- elegir un embate --------------------------- */

  const elegirEmbate = useCallback((nodo: Nodo, hpRatio: number): Embate | null => {
    if (!contenido) return null
    const rng = rngRef.current
    const arq = ARQUETIPOS[nodo.arquetipo ?? 'vacio']

    if (arq.id === 'marco' && hpRatio <= 0.45) {
      const jefe = embateDeTesis(contenido, rng)
      if (jefe) return jefe
    }

    const intentos: (() => Item[])[] = [
      () => itemsCandidatos(contenido, {
        mecanicas: arq.mecanicas, conceptIds: nodo.conceptIds, condicion: nodo.condicion,
        conceptoAnterior: anteriorRef.current, soloRepertorio: arq.id === 'eco',
        distancia: nodo.condicion === 'portal_por_distancia' ? 'lejana' : null
      }),
      () => itemsCandidatos(contenido, {
        mecanicas: arq.mecanicas, conceptIds: nodo.conceptIds, condicion: null,
        conceptoAnterior: null, soloRepertorio: arq.id === 'eco'
      }),
      () => itemsCandidatos(contenido, {
        mecanicas: arq.mecanicas, conceptIds: Object.keys(contenido.conceptos),
        condicion: null, conceptoAnterior: null
      })
    ]

    for (const intento of intentos) {
      const todos = intento()
      if (!todos.length) continue
      const frescos = todos.filter((i) => !usadosRef.current.has(i.id))
      const item = rng.pick(frescos.length ? frescos : todos)
      usadosRef.current.add(item.id)
      const emb = construirEmbate(item, {
        rng, contenido, condicion: nodo.condicion, conceptoAnterior: anteriorRef.current
      })
      if (emb) {
        anteriorRef.current = emb.conceptoObjetivo
        return emb
      }
    }
    return null
  }, [contenido])

  /* ------------------------------ entrar a nodo ---------------------------- */

  const entrarNodo = useCallback((nodo: Nodo) => {
    if (!contenido || !ruta) return
    nodoRef.current = nodo

    if (nodo.tipo === 'refugio') { setFase('refugio'); return }
    if (nodo.tipo === 'taller') {
      setRecompensas(ofrecerRecompensas(mazo, instrumentos, rngRef.current, false))
      setFase('recompensa'); return
    }

    const arq = ARQUETIPOS[nodo.arquetipo ?? 'vacio']
    const emb = elegirEmbate(nodo, 1)
    if (!emb) {
      alert('Este texto no sostiene ese encuentro. La expedición toma otra ruta.')
      avanzar(); return
    }
    const acto = ruta.actos[actoIdx]
    const escala = 1 + actoIdx * 0.12
    const hpMax = Math.round(arq.vidaBase * escala)
    const e: EstadoCombate = {
      arquetipo: arq, nombre: arq.nombre, hp: hpMax, hpMax,
      condicion: nodo.condicion, embate: emb,
      mano: [], mazo: armarMazo(mazo, rngRef.current), descarte: [],
      manoBase: acto.manoSugerida, acciones: 2, seleccion: [], cartaJugada: null,
      apuesta: null, fase: 'eligiendo', ultima: null, turno: 1, consultas: 0,
      ayudaEnEmbate: false, tiposRelacionUsados: [], erroresEnCombate: 0,
      inicioEmbate: Date.now(), definicionAbierta: null, embatesResueltos: 0
    }
    if (ctx) robar(e, tamanoMano(e, ctx))
    setCombate(e)
    setFase('combate')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contenido, ruta, mazo, instrumentos, actoIdx, ctx, elegirEmbate])

  /* -------------------------------- avanzar -------------------------------- */

  const avanzar = useCallback(() => {
    if (!ruta) return
    const nodo = nodoRef.current
    if (nodo) setVisitados((v) => [...v, nodo.id])
    const acto = ruta.actos[actoIdx]
    if (capaIdx + 1 < acto.capas.length) { setCapaIdx(capaIdx + 1); setFase('mapa'); return }
    if (actoIdx + 1 < ruta.actos.length) { setActoIdx(actoIdx + 1); setCapaIdx(0); setFase('mapa'); return }
    setVictoria(true)
    if (atlas) { const a = { ...atlas, victorias: atlas.victorias + 1 }; setAtlas(a); guardarAtlas(a) }
    setFase('fin')
  }, [ruta, actoIdx, capaIdx, atlas])

  /* ------------------------------ acciones ------------------------------- */

  const mut = (f: (e: EstadoCombate) => void) =>
    setCombate((prev) => { if (!prev) return prev; const e = { ...prev }; f(e); return e })

  const elegirOpcion = (id: string) => mut((e) => {
    if (e.fase !== 'eligiendo') return
    if (e.embate.multi) {
      e.seleccion = e.seleccion.includes(id) ? e.seleccion.filter((x) => x !== id) : [...e.seleccion, id]
    } else {
      e.seleccion = [id]
    }
  })

  const jugarCarta = (uid: string) => mut((e) => {
    if (e.fase !== 'eligiendo' || e.acciones <= 0) return
    const c = e.mano.find((x) => x.uid === uid)
    if (!c) return
    const carta = porId(c.cardId)
    if (carta.efecto === 'robar_2') {
      e.mano = e.mano.filter((x) => x.uid !== uid)
      e.descarte.push(c)
      robar(e, 2)
      e.acciones -= 1
      return
    }
    e.cartaJugada = uid
    e.acciones -= 1
  })

  const consultar = (uid: string) => mut((e) => {
    if (e.acciones <= 0 || !contenido) return
    const c = e.mano.find((x) => x.uid === uid)
    if (!c) return
    const id = e.embate.conceptoObjetivo
    const con = id ? contenido.conceptos[id] : null
    e.definicionAbierta = con
      ? `${con.titulo} — ${con.definicion}${con.paginas.length ? ` (p. ${con.paginas.join(', ')})` : ''}`
      : 'Este embate no apunta a un concepto único del diccionario.'
    e.ayudaEnEmbate = true
    e.consultas += 1
    e.mano = e.mano.filter((x) => x.uid !== uid)
    e.descarte.push(c)
    e.acciones -= 1
  })

  const descartarMano = () => mut((e) => {
    if (e.acciones <= 0 || !ctx) return
    e.descarte.push(...e.mano)
    e.mano = []
    robar(e, tamanoMano(e, ctx))
    e.acciones -= 1
  })

  const improvisar = () => mut((e) => { e.cartaJugada = null; e.acciones = 0 })

  const apostar = (a: Apuesta) => mut((e) => { if (e.fase === 'eligiendo') e.apuesta = a })

  const resolver = () => {
    if (!combate || !ctx || !contenido || !atlas) return
    const e = { ...combate }
    const cartaUid = e.cartaJugada
    const cartaId = cartaUid ? e.mano.find((c) => c.uid === cartaUid)?.cardId ?? null : null
    const r = resolverEmbate(e, ctx)
    aplicar(e, ctx, r)

    const nuevaLucidez = Math.max(0, lucidez - r.autodano + (r.aristaDescubierta && instrumentos.includes('curiosidad') ? 4 : 0))
    setLucidez(Math.min(LUCIDEZ_MAX, nuevaLucidez))
    if (nuevaLucidez <= 0) e.fase = 'perdido'

    // Atlas: la progresión permanente es evidencia, no números
    const a: Atlas = { ...atlas, conceptos: { ...atlas.conceptos }, aristas: { ...atlas.aristas } }
    for (const cid of r.conceptIds) {
      const prev = a.conceptos[cid] ?? { aciertos: 0, fallos: 0, mecanicas: [], ultimaApuestaAcertada: null }
      a.conceptos[cid] = {
        aciertos: prev.aciertos + (r.correcto ? 1 : 0),
        fallos: prev.fallos + (r.correcto ? 0 : 1),
        mecanicas: r.correcto ? [...new Set([...prev.mecanicas, e.embate.mecanica])] : prev.mecanicas,
        ultimaApuestaAcertada: r.correcto ? r.apuesta : prev.ultimaApuestaAcertada
      }
    }
    if (r.aristaDescubierta) {
      const k = `${r.aristaDescubierta.from}|${r.aristaDescubierta.to}|${r.aristaDescubierta.tipo}`
      const prev = a.aristas[k]
      a.aristas[k] = { ...r.aristaDescubierta, aciertos: (prev?.aciertos ?? 0) + 1 }
    }
    if (r.correcto && r.repertorioTocado) {
      a.repertoriosEstabilizados = [...new Set([...a.repertoriosEstabilizados, r.repertorioTocado])]
    }
    a.apuestasTotales += 1
    a.apuestasCalibradas += r.calibrado ? 1 : 0
    setAtlas(a); guardarAtlas(a)

    registrar({
      ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
      arquetipo: e.arquetipo.id, condicion: e.condicion, mecanica: e.embate.mecanica,
      itemId: e.embate.itemId, conceptIds: r.conceptIds, operacion: cartaId,
      improvisado: r.improvisado, seleccion: e.seleccion, correcto: r.correcto,
      apuesta: r.apuesta, calibrado: r.calibrado, latenciaMs: r.latenciaMs,
      ayuda: r.ayuda, repertorioTocado: r.repertorioTocado
    })

    setCombate(e)
  }

  const continuar = () => {
    if (!combate || !ctx) return
    if (combate.fase === 'perdido') { setFase('fin'); setVictoria(false); return }
    if (combate.fase === 'ganado') {
      const nodo = nodoRef.current
      const elite = nodo?.tipo === 'elite' || nodo?.tipo === 'jefe'
      setRecompensas(ofrecerRecompensas(mazo, instrumentos, rngRef.current, elite))
      setFase('recompensa')
      return
    }
    const nodo = nodoRef.current
    if (!nodo) return
    const emb = elegirEmbate(nodo, combate.hp / combate.hpMax)
    if (!emb) { setFase('recompensa'); setRecompensas(ofrecerRecompensas(mazo, instrumentos, rngRef.current, false)); return }
    const e = { ...combate }
    siguienteTurno(e, ctx, emb)
    setCombate(e)
  }

  const tomarRecompensa = (r: Recompensa) => {
    if (r.tipo === 'verbo') setMazo((m) => [...m, r.cardId])
    if (r.tipo === 'mejora') {
      setMazo((m) => { const i = m.indexOf(r.reemplaza); if (i < 0) return [...m, r.cardId]
        const n = [...m]; n[i] = r.cardId; return n })
    }
    if (r.tipo === 'instrumento') setInstrumentos((x) => [...x, r.id])
    if (r.tipo === 'lucidez') setLucidez((l) => Math.min(LUCIDEZ_MAX, l + r.cantidad))
    avanzar()
  }

  /* -------------------------------- render -------------------------------- */

  if (fase === 'cargar' || !contenido || !atlas || !ruta) {
    return <div className="app"><BundleLoader onListo={alCargar} /></div>
  }

  const acto = ruta.actos[actoIdx]
  const cob = coberturaAtlas(atlas, contenido)

  return (
    <div className="app">
      <header className="barra">
        <span className="marca">El Archivo Infinito</span>
        <span className="eyebrow">{contenido.fuente}</span>
        <span className="sep" />
        {fase !== 'combate' && <Medidor valor={lucidez} max={LUCIDEZ_MAX} etiqueta="Lucidez" />}
        <span className="dato silencio">Atlas {cob.pct}%</span>
        <button className="btn fantasma" onClick={() => { setFaseAnterior(fase); setFase('atlas') }}>Atlas</button>
        <button className="btn fantasma" onClick={descargarLog} title="Exporta las señales cognitivas de esta sesión">
          Señales
        </button>
      </header>

      {fase === 'mapa' && (
        <MapView
          ruta={ruta} acto={acto} capaActual={capaIdx} visitados={visitados}
          onElegir={entrarNodo} contenido={contenido}
        />
      )}

      {fase === 'combate' && combate && (
        <CombatView
          e={combate} contenido={contenido} lucidez={lucidez} lucidezMax={LUCIDEZ_MAX}
          on={{
            elegirOpcion, jugarCarta, apostar, resolver, continuar, descartarMano,
            consultar, improvisar,
            huir: () => { setVictoria(false); setFase('fin') }
          }}
        />
      )}

      {fase === 'recompensa' && (
        <RewardView
          opciones={recompensas} onElegir={tomarRecompensa}
          titulo={nodoRef.current?.tipo === 'taller' ? 'Taller de verbos' : 'El encuentro cede'}
        />
      )}

      {fase === 'refugio' && (
        <CampfireView
          mazo={mazo} instrumentos={instrumentos} lucidez={lucidez} lucidezMax={LUCIDEZ_MAX}
          onDescansar={() => { setLucidez((l) => Math.min(LUCIDEZ_MAX, l + 22)); avanzar() }}
          onRetirar={(id) => {
            setMazo((m) => { if (m.length <= 4) return m; const i = m.indexOf(id)
              if (i < 0) return m; const n = [...m]; n.splice(i, 1); return n })
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
          onReiniciar={() => empezarRun(contenido, atlas)}
          onAtlas={() => { setFaseAnterior('fin'); setFase('atlas') }}
        />
      )}
    </div>
  )
}

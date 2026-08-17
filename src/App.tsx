import { useCallback, useMemo, useRef, useState } from 'react'
import type { Contenido, Item } from './content/types'
import { MAZO_INICIAL, porId, type EfectoInstrumento } from './engine/cards'
import {
  aplicar, armarMazo, robar, resolver as resolverEmbate, siguienteTurno, tamanoMano,
  turnoEnemigo, vivos, type Apuesta, type ContextoCombate, type EstadoCombate
} from './engine/combat'
import { ARQUETIPOS, construirEmbate, itemsCandidatos, type Embate } from './engine/encounters'
import { embateDeTesis } from './engine/boss'
import { cartaIntuicion, embateDeContexto, esIntuicion, repertorioDe } from './engine/intuition'
import { componerFrente } from './engine/threats'
import { generarRuta, ofrecerRecompensas, type Nodo, type Recompensa, type Ruta } from './engine/route'
import { objetivoPorId, type Objetivo, type ObjetivoId } from './engine/objectives'
import { Rng, semillaLegible } from './engine/rng'
import { cargarAtlas, coberturaAtlas, descargarLog, guardarAtlas, registrar, type Atlas } from './engine/atlas'
import { BundleLoader } from './ui/BundleLoader'
import { CombatView } from './ui/CombatView'
import { AtlasView, CampfireView, EndView, MapView, ObjectiveView, RewardView } from './ui/Screens'
import { Medidor } from './ui/components'

type Fase = 'cargar' | 'plan' | 'mapa' | 'combate' | 'recompensa' | 'refugio' | 'atlas' | 'fin'

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
  const [mazo, setMazo] = useState<string[]>(MAZO_INICIAL)
  const [instrumentos, setInstrumentos] = useState<EfectoInstrumento[]>([])
  const [objetivoRun, setObjetivoRun] = useState<ObjetivoId>('trazar')

  const [combate, setCombate] = useState<EstadoCombate | null>(null)
  const [recompensas, setRecompensas] = useState<Recompensa[]>([])
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [victoria, setVictoria] = useState(false)

  const rngRef = useRef(new Rng('inicio'))
  const runIdRef = useRef('')
  const usadosRef = useRef<Set<string>>(new Set())
  const nodoRef = useRef<Nodo | null>(null)
  const anteriorRef = useRef<string | null>(null)
  const mazoRef = useRef<string[]>(MAZO_INICIAL)

  const ctx: ContextoCombate | null = useMemo(
    () => (contenido ? { contenido, instrumentos, rng: rngRef.current } : null),
    [contenido, instrumentos]
  )

  const fijarMazo = (f: (m: string[]) => string[]) => {
    mazoRef.current = f(mazoRef.current)
    setMazo(mazoRef.current)
  }

  /* ------------------------------- arranque ------------------------------- */

  const empezarRun = useCallback((c: Contenido, a: Atlas, obj: Objetivo) => {
    const semilla = semillaLegible()
    rngRef.current = new Rng(semilla)
    runIdRef.current = `${semilla}-${Date.now()}`
    usadosRef.current = new Set()
    anteriorRef.current = null
    let r: Ruta
    try { r = generarRuta(c, semilla) } catch (err) { alert((err as Error).message); return }

    setRuta(r)
    setActoIdx(0)
    setAlcanzables(r.actos[0].entradas)
    setVisitados([])
    setNodoActual(null)
    setLucidez(LUCIDEZ_MAX)
    mazoRef.current = [...MAZO_INICIAL, ...obj.cartasIniciales]
    setMazo(mazoRef.current)
    setInstrumentos([obj.instrumentoInicial])
    setObjetivoRun(obj.id)
    setCombate(null)
    setVictoria(false)
    const nuevo = { ...a, runs: a.runs + 1 }
    setAtlas(nuevo); guardarAtlas(nuevo)
    setFase('mapa')
  }, [])

  const alCargar = useCallback((c: Contenido) => {
    setContenido(c)
    setAtlas(cargarAtlas(c.fuente))
    setFase('plan')
  }, [])

  /* ---------------------------- elegir un embate --------------------------- */

  const elegirEmbate = useCallback((
    nodo: Nodo, arquetipoId: string, hpRatio: number
  ): Embate | null => {
    if (!contenido) return null
    const rng = rngRef.current
    const arq = ARQUETIPOS[(arquetipoId as keyof typeof ARQUETIPOS) ?? 'vacio'] ?? ARQUETIPOS.vacio

    if (arq.id === 'marco' && hpRatio <= 0.5) {
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
      if (emb) { anteriorRef.current = emb.conceptoObjetivo; return emb }
    }
    return null
  }, [contenido])

  /* -------------------------------- avanzar -------------------------------- */

  const avanzar = useCallback(() => {
    if (!ruta) return
    const nodo = nodoRef.current
    const acto = ruta.actos[actoIdx]
    if (!nodo) { setFase('mapa'); return }
    setVisitados((v) => [...v, nodo.id])
    setNodoActual(nodo.id)

    if (nodo.salidas.length > 0) {
      setAlcanzables(nodo.salidas)
      setFase('mapa')
      return
    }
    if (actoIdx + 1 < ruta.actos.length) {
      setActoIdx(actoIdx + 1)
      setAlcanzables(ruta.actos[actoIdx + 1].entradas)
      setNodoActual(null)
      setFase('mapa')
      return
    }
    setVictoria(true)
    if (atlas) { const a = { ...atlas, victorias: atlas.victorias + 1 }; setAtlas(a); guardarAtlas(a) }
    setFase('fin')
    void acto
  }, [ruta, actoIdx, atlas])

  /* ------------------------------ entrar a nodo ---------------------------- */

  const entrarNodo = useCallback((nodo: Nodo) => {
    if (!contenido || !ruta || !ctx) return
    nodoRef.current = nodo

    if (nodo.tipo === 'refugio') { setFase('refugio'); return }
    if (nodo.tipo === 'taller') {
      setRecompensas(ofrecerRecompensas(mazoRef.current, instrumentos, rngRef.current, false))
      setFase('recompensa'); return
    }

    const acto = ruta.actos[actoIdx]
    const escala = 1 + actoIdx * 0.14
    const tipo = nodo.tipo === 'jefe' ? 'jefe' : nodo.tipo === 'elite' ? 'elite' : 'combate'
    const enemigos = componerFrente(nodo.arquetipos, tipo, escala, rngRef.current)

    const e: EstadoCombate = {
      tipo, enemigos, objetivo: null, condicion: nodo.condicion, embate: null,
      mano: [], mazo: armarMazo(mazoRef.current, rngRef.current), descarte: [],
      manoBase: acto.manoSugerida, acciones: 2, seleccion: [], cartaJugada: null,
      apuesta: null, fase: 'objetivo', ultima: null, turno: 1, consultas: 0,
      ayudaEnEmbate: false, tiposRelacionUsados: [], erroresEnCombate: 0,
      inicioEmbate: Date.now(), definicionAbierta: null,
      nieblaPendiente: false, superficiePendiente: false, ruidoPendiente: false,
      intuicionesRecibidas: []
    }
    robar(e, tamanoMano(e, ctx))
    setCombate(e)
    setFase('combate')
  }, [contenido, ruta, actoIdx, instrumentos, ctx])

  /* ------------------------------- acciones -------------------------------- */

  const mut = (f: (e: EstadoCombate) => void) =>
    setCombate((prev) => { if (!prev) return prev; const e = { ...prev }; f(e); return e })

  const apuntar = (uid: string) => {
    if (!combate || combate.fase !== 'objetivo') return
    const enemigo = combate.enemigos.find((x) => x.uid === uid)
    const nodo = nodoRef.current
    if (!enemigo || !nodo) return
    const emb = elegirEmbate(nodo, enemigo.arquetipoId, enemigo.hp / enemigo.hpMax)
    if (!emb) { alert('Ese enemigo no tiene material en este texto. Elige otro objetivo.'); return }
    mut((e) => {
      e.objetivo = uid
      e.embate = emb
      e.fase = 'eligiendo'
      e.inicioEmbate = Date.now()
    })
  }

  const elegirOpcion = (id: string) => mut((e) => {
    if (e.fase !== 'eligiendo' || !e.embate) return
    e.seleccion = e.embate.multi
      ? (e.seleccion.includes(id) ? e.seleccion.filter((x) => x !== id) : [...e.seleccion, id])
      : [id]
  })

  const jugarCarta = (uid: string) => mut((e) => {
    if (e.fase !== 'eligiendo' || e.acciones <= 0 || !contenido) return
    const c = e.mano.find((x) => x.uid === uid)
    if (!c) return
    if (esIntuicion(c.cardId)) {
      const sub = embateDeContexto(contenido, repertorioDe(c.cardId), rngRef.current)
      if (!sub) return
      e.embate = sub
      e.seleccion = []
      e.cartaJugada = uid
      e.acciones -= 1
      return
    }
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
    if (e.acciones <= 0 || !contenido || !e.embate) return
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
    if (!combate || !ctx || !contenido || !atlas || !combate.embate) return
    const e = { ...combate }
    const embateActual = combate.embate
    const cartaUid = e.cartaJugada
    const cartaId = cartaUid ? e.mano.find((c) => c.uid === cartaUid)?.cardId ?? null : null
    const mecanica = embateActual.mecanica
    const r = resolverEmbate(e, ctx)
    aplicar(e, r)
    const { dano, intuiciones } = turnoEnemigo(e, ctx, r)

    let nueva = lucidez - dano
    if (r.aristaDescubierta && instrumentos.includes('curiosidad')) nueva += 4
    if (r.intuicionResuelta) nueva += 6
    nueva = Math.min(LUCIDEZ_MAX, nueva)
    setLucidez(Math.max(0, nueva))
    if (nueva <= 0 && e.fase !== 'ganado') e.fase = 'perdido'

    if (r.intuicionResuelta) {
      const quitar = r.intuicionResuelta
      fijarMazo((m) => { const i = m.indexOf(quitar); if (i < 0) return m; const n = [...m]; n.splice(i, 1); return n })
    }
    for (const rid of intuiciones) {
      const carta = cartaIntuicion(rid)
      fijarMazo((m) => [...m, carta])
      e.descarte.push({ uid: `${carta}#${Math.random().toString(36).slice(2)}`, cardId: carta })
    }

    // Atlas: la progresión permanente es evidencia, no números
    const a: Atlas = { ...atlas, conceptos: { ...atlas.conceptos }, aristas: { ...atlas.aristas } }
    for (const cid of r.conceptIds) {
      const prev = a.conceptos[cid] ?? { aciertos: 0, fallos: 0, mecanicas: [], ultimaApuestaAcertada: null }
      a.conceptos[cid] = {
        aciertos: prev.aciertos + (r.correcto ? 1 : 0),
        fallos: prev.fallos + (r.correcto ? 0 : 1),
        mecanicas: r.correcto ? [...new Set([...prev.mecanicas, mecanica])] : prev.mecanicas,
        ultimaApuestaAcertada: r.correcto ? r.apuesta : prev.ultimaApuestaAcertada
      }
    }
    if (r.aristaDescubierta) {
      const k = `${r.aristaDescubierta.from}|${r.aristaDescubierta.to}|${r.aristaDescubierta.tipo}`
      a.aristas[k] = { ...r.aristaDescubierta, aciertos: (a.aristas[k]?.aciertos ?? 0) + 1 }
    }
    if (r.correcto && r.repertorioTocado) {
      a.repertoriosEstabilizados = [...new Set([...a.repertoriosEstabilizados, r.repertorioTocado])]
    }
    a.apuestasTotales += 1
    a.apuestasCalibradas += r.calibrado ? 1 : 0
    setAtlas(a); guardarAtlas(a)

    registrar({
      ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
      arquetipo: e.enemigos.find((x) => x.uid === r.objetivoUid)?.arquetipoId ?? '—',
      condicion: e.condicion, mecanica, itemId: embateActual.itemId,
      conceptIds: r.conceptIds, operacion: cartaId, improvisado: r.improvisado,
      seleccion: e.seleccion, correcto: r.correcto, apuesta: r.apuesta,
      calibrado: r.calibrado, latenciaMs: r.latenciaMs, ayuda: r.ayuda,
      repertorioTocado: r.repertorioTocado
    })

    setCombate(e)
  }

  const continuar = () => {
    if (!combate || !ctx) return
    if (combate.fase === 'perdido') { setVictoria(false); setFase('fin'); return }
    if (combate.fase === 'ganado' || vivos(combate).length === 0) {
      const nodo = nodoRef.current
      const elite = nodo?.tipo === 'elite' || nodo?.tipo === 'jefe'
      setRecompensas(ofrecerRecompensas(mazoRef.current, instrumentos, rngRef.current, elite))
      setFase('recompensa')
      return
    }
    const e = { ...combate }
    siguienteTurno(e, ctx)
    setCombate(e)
  }

  const tomarRecompensa = (r: Recompensa) => {
    if (r.tipo === 'verbo') fijarMazo((m) => [...m, r.cardId])
    if (r.tipo === 'mejora') {
      fijarMazo((m) => {
        const i = m.indexOf(r.reemplaza)
        if (i < 0) return [...m, r.cardId]
        const n = [...m]; n[i] = r.cardId; return n
      })
    }
    if (r.tipo === 'instrumento') setInstrumentos((x) => [...x, r.id])
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
        {fase !== 'combate' && <Medidor valor={lucidez} max={LUCIDEZ_MAX} etiqueta="Lucidez" />}
        <span className="dato silencio">Atlas {cob.pct}%</span>
        <button className="btn fantasma" onClick={() => { setFaseAnterior(fase); setFase('atlas') }}>Atlas</button>
        <button className="btn fantasma" onClick={descargarLog} title="Exporta las señales cognitivas de esta sesión">
          Señales
        </button>
      </header>

      {fase === 'mapa' && (
        <MapView
          ruta={ruta} acto={acto} alcanzables={alcanzables} visitados={visitados}
          actual={nodoActual} onElegir={entrarNodo} contenido={contenido} atlas={atlas}
        />
      )}

      {fase === 'combate' && combate && (
        <CombatView
          e={combate} contenido={contenido} lucidez={lucidez} lucidezMax={LUCIDEZ_MAX}
          on={{
            apuntar, elegirOpcion, jugarCarta, apostar, resolver, continuar,
            descartarMano, consultar, improvisar,
            huir: () => { setVictoria(false); setFase('fin') }
          }}
        />
      )}

      {fase === 'recompensa' && (
        <RewardView
          opciones={recompensas} onElegir={tomarRecompensa}
          titulo={nodoRef.current?.tipo === 'taller' ? 'Taller de verbos' : 'El frente cede'}
        />
      )}

      {fase === 'refugio' && (
        <CampfireView
          mazo={mazo} instrumentos={instrumentos} contenido={contenido}
          lucidez={lucidez} lucidezMax={LUCIDEZ_MAX}
          onDescansar={() => { setLucidez((l) => Math.min(LUCIDEZ_MAX, l + 26)); avanzar() }}
          onRetirar={(id) => {
            fijarMazo((m) => {
              if (m.filter((x) => !esIntuicion(x)).length <= 4) return m
              const i = m.indexOf(id); if (i < 0) return m
              const n = [...m]; n.splice(i, 1); return n
            })
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

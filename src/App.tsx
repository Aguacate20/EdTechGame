import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Contenido } from './content/types'
import {
  afirmar as afirmarDiagrama, avanzarOleada, cambiar as cambiarPieza, iniciarBatalla,
  quemar as quemarPieza,
  siguienteTurno, turnoDelCarril, usarSello, vivos,
  sellar as sellarDiagrama, elegirEncargo as elegirEncargoBatalla,
  type Bolsa, type ContextoBatalla, type EstadoBatalla
} from './engine/battle'
import { combinarLentes, type SelloId } from './engine/powers'
import type { HerramientaId } from './engine/tools'
import { generarRuta, ofrecerRecompensas, type Nodo, type Recompensa, type Ruta } from './engine/route'
import { Rng, semillaLegible } from './engine/rng'
import {
  anotarPropuesta, cargarAtlas, coberturaAtlas, confirmarPropuestas, descargarLog,
  EQUIPO_INICIAL, guardarAtlas, registrar, type Atlas
} from './engine/atlas'
import {
  borrarExpedicion, guardarExpedicion, leerExpedicion, type ExpedicionGuardada
} from './engine/savegame'
import { contenidoTutorial, SALAS_TUTORIAL } from './content/tutorial'
import { BundleLoader } from './ui/BundleLoader'
import { BoardView } from './ui/BoardView'
import { AtlasView, EndView, MapView, PortadaView, RewardView } from './ui/Screens'
import { RefugioView } from './ui/RefugioView'
import { BattleMap } from './ui/BattleMap'
import { VistazoView } from './ui/VistazoView'
import { HomeView } from './ui/HomeView'
import { Medidor } from './ui/components'
import { FondoActo } from './ui/assets'
import { despertarAudio, estaSilenciado, silenciar, sfx } from './ui/sfx'
import {
  encargoCumplido, juzgarReflexion, lucidezEncargo, primaEncargo, proponerEncargos, type Encargo
} from './engine/srl'
import { portadaPorId, type Portada } from './engine/portadas'
import { evaluarHazanas, lentesVetadas, type Hazana } from './engine/hazanas'

type Fase =
  | 'cargar' | 'inicio' | 'portada' | 'mapa' | 'batalla'
  | 'vistazo' | 'resumen' | 'recompensa' | 'refugio' | 'atlas' | 'fin' | 'tutorial-fin'

const LUCIDEZ_MAX = 80

/** Lo que el encargo necesita saber de la sala, sacado del estado de batalla. */
const cuentaDe = (b: EstadoBatalla) => ({
  vinculosSostenidos: b.hallazgos.vinculos.length, combosVistos: b.combosVistos,
  conceptosSostenidos: b.conceptosSostenidos, quemasAcertadas: b.quemasAcertadas,
  errores: b.erroresTotales, invertidos: b.invertidosTotales
})

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
  const [aprendizaje, setAprendizaje] = useState(false)
  const [lentes, setLentes] = useState<string[]>([])
  const [sellos, setSellos] = useState<SelloId[]>([])
  const [herramientas, setHerramientas] = useState<HerramientaId[]>(
    EQUIPO_INICIAL.herramientas as HerramientaId[]
  )
  const [semilla, setSemilla] = useState('')
  const [guardada, setGuardada] = useState<ExpedicionGuardada | null>(null)
  /** el tutorial se superpone: al salir se recupera el texto que estabas usando */
  const [tutorial, setTutorial] = useState<number | null>(null)
  /** los pasos del tutorial son monótonos: una vez hechos, no vuelven atrás
   *  aunque afirmar limpie el tablero y la condición deje de cumplirse */
  const [pasosHechos, setPasosHechos] = useState<string[]>([])
  const previoRef = useRef<{ contenido: Contenido; atlas: Atlas } | null>(null)

  const [batalla, setBatalla] = useState<EstadoBatalla | null>(null)
  const [recompensas, setRecompensas] = useState<Recompensa[]>([])
  const [veta, setVeta] = useState(false)
  /** conceptos marcados como difíciles al cerrar la sala anterior: vuelven con prima */
  const [marcados, setMarcados] = useState<string[]>([])
  /** conceptos dominados retirados en el refugio: la mano se adelgaza */
  const [archivados, setArchivados] = useState<string[]>([])
  const [portadaId, setPortadaId] = useState('clasica')
  /** modo pedido antes de elegir portada */
  const [pendApoyo, setPendApoyo] = useState(false)
  /** hazañas recién cumplidas, para anunciarlas en el cierre de sala */
  const [hazanasNuevas, setHazanasNuevas] = useState<Hazana[]>([])
  /** alimento de las lentes escaladoras: crecen por jugar bien, no por lootear */
  const [quemasRun, setQuemasRun] = useState(0)
  const [inferenciasRun, setInferenciasRun] = useState(0)
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [victoria, setVictoria] = useState(false)
  const [mudo, setMudo] = useState(estaSilenciado())

  const rngRef = useRef(new Rng('inicio'))
  const runIdRef = useRef('')
  const nodoRef = useRef<Nodo | null>(null)

  const progreso = atlas?.progreso
  const mods = useMemo(() => {
    const m = combinarLentes(lentes)
    // escaladoras: el estado de la run entra a la pasiva
    if (lentes.includes('cuaderno_hereje')) m.multGlobal += 0.15 * quemasRun
    if (lentes.includes('pluma_que_aprende')) m.fichasPorSostenido += Math.min(12, inferenciasRun)
    return m
  }, [lentes, quemasRun, inferenciasRun])
  const ctx: ContextoBatalla | null = useMemo(
    () => (contenido ? { contenido, rng: rngRef.current, lentes: mods } : null),
    [contenido, mods]
  )

  /** Todo lo ganado se guarda en el Atlas: las expediciones no empiezan de cero. */


  /* ------------------------------- arranque ------------------------------- */

  const alCargar = useCallback((c: Contenido) => {
    setContenido(c); setAtlas(cargarAtlas(c.fuente))
    setGuardada(leerExpedicion(c.fuente))
    setFase('inicio')
  }, [])

  const empezarExpedicion = useCallback((conApoyo: boolean) => {
    if (!contenido || !atlas) return
    setPendApoyo(conApoyo)
    setFase('portada')
  }, [contenido, atlas])

  const lanzarExpedicion = useCallback((portada: Portada) => {
    if (!contenido || !atlas) return
    const conApoyo = pendApoyo
    setPortadaId(portada.id)
    setAprendizaje(conApoyo)
    const sem = semillaLegible()
    setSemilla(sem)
    rngRef.current = new Rng(sem)
    runIdRef.current = `${sem}-${Date.now()}`
    let r: Ruta
    try { r = generarRuta(contenido, sem, conApoyo) }
    catch (err) { alert((err as Error).message); return }

    setRuta(r); setActoIdx(0); setAlcanzables(r.actos[0].entradas)
    setVisitados([]); setNodoActual(null); setLucidez(LUCIDEZ_MAX)
    setCasos([]); setTesis([]); setFusionados([]); setIntuiciones([])
    setMarcados([]); setArchivados([]); setHazanasNuevas([])
    setQuemasRun(0); setInferenciasRun(0)
    // el equipo NO se hereda: cada expedición se arma de nuevo, y la portada
    // decide con qué ojos se entra
    setLentes([...portada.lentesIniciales]); setSellos([])
    setHerramientas([...EQUIPO_INICIAL.herramientas, ...portada.herramientasExtra] as HerramientaId[])
    setManoExtra(portada.manoDelta)
    setBatalla(null); setVictoria(false)
    borrarExpedicion(); setGuardada(null)
    const a = {
      ...atlas, runs: atlas.runs + 1,
      progreso: { ...atlas.progreso, expediciones: atlas.progreso.expediciones + 1 }
    }
    setAtlas(a); guardarAtlas(a)
    registrar({
      ts: Date.now(), runId: runIdRef.current, nodoId: '—',
      arquetipo: 'portada', condicion: conApoyo ? 'aprendizaje' : null,
      mecanica: 'srl_planeacion', itemId: `portada:${portada.id}`, conceptIds: [],
      operacion: 'elegir_portada', improvisado: false, seleccion: [],
      correcto: true, apuesta: portada.id, calibrado: true,
      latenciaMs: 0, ayuda: false, repertorioTocado: null
    })
    setFase('mapa')
  }, [contenido, atlas, pendApoyo])

  /* -------------------------------- avanzar -------------------------------- */

  /** Se guarda al pisar el mapa: si te vas a mitad de una sala, vuelves a su inicio. */
  const guardarAqui = useCallback((acto: number, alc: string[], vis: string[], nodo: string | null) => {
    if (!contenido || !ruta) return
    guardarExpedicion({
      fuente: contenido.fuente, semilla, runId: runIdRef.current,
      actoIdx: acto, alcanzables: alc, visitados: vis, nodoActual: nodo,
      lucidez, aprendizaje, lentes, sellos, herramientas, manoExtra,
      casos, tesis, fusionados, intuiciones,
      portadaId, marcados, archivados, quemasRun, inferenciasRun, guardadaEn: Date.now()
    })
  }, [contenido, ruta, semilla, lucidez, aprendizaje, lentes, sellos, herramientas,
      manoExtra, casos, tesis, fusionados, intuiciones, portadaId, marcados, archivados,
      quemasRun, inferenciasRun])

  const retomar = useCallback(() => {
    if (!contenido || !guardada) return
    let r: Ruta
    try { r = generarRuta(contenido, guardada.semilla, guardada.aprendizaje) } catch { return }
    rngRef.current = new Rng(guardada.semilla)
    runIdRef.current = guardada.runId
    setSemilla(guardada.semilla)
    setRuta(r); setActoIdx(guardada.actoIdx)
    setAlcanzables(guardada.alcanzables); setVisitados(guardada.visitados)
    setNodoActual(guardada.nodoActual); setLucidez(guardada.lucidez)
    setAprendizaje(guardada.aprendizaje)
    setLentes(guardada.lentes); setSellos(guardada.sellos)
    setHerramientas(guardada.herramientas); setManoExtra(guardada.manoExtra)
    setCasos(guardada.casos); setTesis(guardada.tesis)
    setFusionados(guardada.fusionados); setIntuiciones(guardada.intuiciones)
    setPortadaId(guardada.portadaId ?? 'clasica')
    setMarcados(guardada.marcados ?? []); setArchivados(guardada.archivados ?? [])
    setQuemasRun(guardada.quemasRun ?? 0); setInferenciasRun(guardada.inferenciasRun ?? 0)
    setBatalla(null); setVictoria(false)
    setFase('mapa')
  }, [contenido, guardada])

  // Un paso cumplido lo está para siempre: afirmar limpia el tablero, así que
  // recalcular la condición cada turno hacía volver la guía al primer paso.
  useEffect(() => {
    if (tutorial === null || !batalla) return
    const sala = SALAS_TUTORIAL[tutorial]
    if (!sala) return
    const nuevos = sala.pasos.filter((x) => x.hecho(batalla)).map((x) => x.clave)
    if (!nuevos.length) return
    setPasosHechos((prev) =>
      nuevos.every((k) => prev.includes(k)) ? prev : [...new Set([...prev, ...nuevos])]
    )
  }, [batalla, tutorial])

  /** El tutorial no usa el generador de rutas: son dos salas escritas a mano,
   *  con mano y frente fijos, para poder guiar paso a paso. */
  const empezarTutorial = useCallback((indice: number) => {
    const c = contenidoTutorial()
    const a = cargarAtlas(c.fuente)
    const sala = SALAS_TUTORIAL[indice]
    if (!sala) { setTutorial(null); setFase('inicio'); return }
    const rng = new Rng(`tutorial-${indice}`)
    rngRef.current = rng
    runIdRef.current = `tutorial-${indice}-${Date.now()}`
    setContenido(c); setAtlas(a); setTutorial(indice); setPasosHechos([])
    setLucidez(LUCIDEZ_MAX); setAprendizaje(true)
    setLentes(sala.lente ? [sala.lente] : []); setSellos([]); setHerramientas(sala.herramientas)
    setManoExtra(0); setCasos([]); setTesis([]); setFusionados([]); setIntuiciones([])
    setVictoria(false)
    const ctxT: ContextoBatalla = {
      contenido: c, rng, lentes: combinarLentes(sala.lente ? [sala.lente] : [])
    }
    setBatalla(iniciarBatalla(ctxT, sala.conceptIds, {
      herramientas: sala.herramientas, relaciones: sala.relaciones,
      casos: [], tesis: [], intuiciones: [], fusionados: [], terrenos: [], sellos: [],
      apoyo: true, sinTocar: [],
      mazoFijo: sala.mazo(c),
      enemigosFijos: sala.enemigos(1)
    }, 'facil', 0, 6))
    setFase('batalla')
  }, [])

  useEffect(() => {
    if (tutorial === null || !batalla) return
    const sala = SALAS_TUTORIAL[tutorial]
    if (!sala) return
    const cumplidos = sala.pasos.filter((x) => x.hecho(batalla)).map((x) => x.clave)
    if (!cumplidos.length) return
    setPasosHechos((prev) =>
      cumplidos.every((c) => prev.includes(c)) ? prev : [...new Set([...prev, ...cumplidos])]
    )
  }, [batalla, tutorial])

  const avanzar = useCallback(() => {
    if (!ruta) return
    const nodo = nodoRef.current
    if (!nodo) { setFase('mapa'); return }
    setVisitados((v) => (v.includes(nodo.id) ? v : [...v, nodo.id]))
    setNodoActual(nodo.id)
    const vistos = visitados.includes(nodo.id) ? visitados : [...visitados, nodo.id]
    if (nodo.salidas.length) {
      setAlcanzables(nodo.salidas); guardarAqui(actoIdx, nodo.salidas, vistos, nodo.id)
      setFase('mapa'); return
    }
    if (actoIdx + 1 < ruta.actos.length) {
      const entradas = ruta.actos[actoIdx + 1].entradas
      setActoIdx(actoIdx + 1); setAlcanzables(entradas)
      setNodoActual(null); guardarAqui(actoIdx + 1, entradas, vistos, null)
      setFase('mapa'); return
    }
    borrarExpedicion(); setGuardada(null)
    setVictoria(true)
    if (atlas) { const a = { ...atlas, victorias: atlas.victorias + 1 }; setAtlas(a); guardarAtlas(a) }
    setFase('fin')
  }, [ruta, actoIdx, atlas, visitados, guardarAqui])

  /* ------------------------------ entrar a nodo ---------------------------- */

  const entrarNodo = useCallback((nodo: Nodo) => {
    if (!contenido || !ruta || !ctx || !progreso) return
    nodoRef.current = nodo
    if (nodo.tipo === 'refugio') { setFase('refugio'); return }
    if (aprendizaje) { setFase('vistazo'); return }
    lanzarSala(nodo, false)
  }, [contenido, ruta, ctx, aprendizaje])

  const lanzarSala = useCallback((nodo: Nodo, leido: boolean) => {
    if (!contenido || !ruta || !ctx || !progreso) return
    const acto = ruta.actos[actoIdx]
    void acto
    const bolsa: Bolsa = {
      herramientas: [...herramientas, ...(leido ? [] : ['flecha' as HerramientaId])],
      relaciones: progreso.relaciones,
      casos: [...new Set([...nodo.casos, ...casos])],
      tesis: [...new Set([...nodo.tesis, ...tesis])],
      intuiciones, fusionados,
      terrenos: progreso.terrenos,
      sellos,
      // la apuesta del vistazo: leerlo señala una falsificación, saltarlo da
      // una herramienta más
      apoyo: aprendizaje,
      sinTocar: nodo.conceptIds.filter((id) => !atlas?.conceptos[id]),
      sinEvidencia: nodo.conceptIds.filter((id) => !atlas?.conceptos[id]),
      marcados, archivados,
      asentadas: atlas ? Object.keys(atlas.aristas) : [],
      quemasDelta: portadaPorId(portadaId).quemasDelta,
      apocrifasDelta: portadaPorId(portadaId).apocrifasDelta,
      condicion: nodo.condicion
    }
    // el carril escala con las expediciones ya hechas: vuelves más fuerte, pero
    // también encuentras enemigos más duros
    const actoEfectivo = actoIdx + Math.min(3, Math.floor(progreso.expediciones / 2))
    const e = iniciarBatalla(
      ctx, nodo.conceptIds, bolsa, nodo.dificultad, actoEfectivo,
      acto.manoSugerida + manoExtra
    )
    // planeación: se elige viendo la mano y el frente, no en una pantalla aparte
    if (atlas) e.encargosOfrecidos = proponerEncargos(contenido, nodo.conceptIds, atlas, e.mano, e.herramientas)
    setBatalla(e)
    setFase('batalla')
  }, [contenido, ruta, ctx, actoIdx, progreso, casos, tesis, intuiciones, fusionados,
      manoExtra, aprendizaje, atlas, herramientas, sellos, marcados, archivados, portadaId])

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
    if (ev) {
      ev.acertado ? sfx.fusion() : sfx.derrumbe()
      if (ev.accion === 'quemar' && ev.acertado) setQuemasRun((n) => n + 1)
    }
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

  const sellar = (v: boolean) => setBatalla((prev) => {
    if (!prev) return prev
    const e = { ...prev }
    sellarDiagrama(e, v)
    return e
  })

  const elegirEncargo = (en: Encargo | null) => {
    setBatalla((prev) => {
      if (!prev) return prev
      const e = { ...prev }
      elegirEncargoBatalla(e, en)
      return e
    })
    registrar({
      ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
      arquetipo: 'encargo', condicion: null, mecanica: 'srl_planeacion',
      itemId: en ? `encargo:${en.tipo}:n${en.nivel}` : 'encargo:ninguno',
      conceptIds: en?.tipo === 'concepto' ? [en.objetivo] : [],
      operacion: 'planear', improvisado: false, seleccion: [],
      correcto: true, apuesta: en ? String(en.nivel) : '0', calibrado: true,
      latenciaMs: batalla ? Date.now() - batalla.inicioTurno : 0,
      ayuda: en?.sobreDebil ?? false, repertorioTocado: null
    })
    if (en && atlas) {
      const a = { ...atlas, srl: { ...atlas.srl,
        encargosElegidos: atlas.srl.encargosElegidos + 1,
        nivelAcumulado: atlas.srl.nivelAcumulado + en.nivel } }
      setAtlas(a); guardarAtlas(a)
    }
  }

  const afirmar = () => {
    if (!batalla || !ctx || !contenido || !atlas) return
    const e = { ...batalla }
    const r = afirmarDiagrama(e, ctx)
    turnoDelCarril(e, ctx, r)

    const inf = r.diag.veredictos.filter((v) => v.inferencia).length
    if (inf) setInferenciasRun((n) => n + inf)
    let nueva = lucidez - r.danoRecibido
    if (r.diag.repertoriosReubicados.length) nueva += 6
    // el golpe que sobra no se desperdicia: el exceso vuelve como claridad
    if (r.sobredano > 0) {
      const cura = Math.min(8, Math.floor(r.sobredano / 40))
      if (cura > 0) {
        nueva += cura
        r.parteEnemiga.push({ texto: `El golpe sobró por ${r.sobredano}: +${cura} de lucidez.`, dano: 0 })
      }
    }
    // saldar una cuenta pendiente (concepto que marcaste) también cura
    if (r.cuentasSaldadas.length) nueva += 3 * r.cuentasSaldadas.length
    nueva = Math.min(LUCIDEZ_MAX, nueva)
    // el suelo de lucidez solo mientras el andamio está puesto: en la última
    // oleada ya se juega sin red
    const suelo = aprendizaje && e.nivelApoyo !== 'ninguno' ? 1 : 0
    setLucidez(Math.max(suelo, nueva))
    if (nueva <= 0 && suelo === 0 && e.fase !== 'ganado') e.fase = 'perdido'

    setFusionados(e.fusionados)
    if (r.intuicionesNuevas.length) {
      setIntuiciones((x) => [...new Set([...x, ...r.intuicionesNuevas])])
    }

    const a: Atlas = {
      ...atlas, conceptos: { ...atlas.conceptos }, aristas: { ...atlas.aristas },
      propuestas: { ...atlas.propuestas }
    }

    // la capa propia: lo que el texto no dice y tú sí. No se mezcla con la
    // evidencia, pero se guarda y se cuenta.
    for (const pr of r.diag.propuestas) anotarPropuesta(a, pr)
    // ¿el texto te acabó dando la razón?
    const confirmadas = confirmarPropuestas(a, r.diag.aristas)
    if (confirmadas.length) {
      r.parteEnemiga.unshift({
        texto: `Lo que propusiste antes estaba en el texto: ${confirmadas
          .map((x) => `${contenido.conceptos[x.from]?.titulo} ${x.tipo} ${contenido.conceptos[x.to]?.titulo}`)
          .join(' · ')}.`,
        dano: 0
      })
    }
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
          { aciertos: 0, fallos: 0, mecanicas: [], vecinos: [], conApoyo: 0, ultimaApuestaAcertada: null }
        const otros = v.conceptIds.filter((x) => x !== cid)
        a.conceptos[cid] = {
          aciertos: prev.aciertos + (ok ? 1 : 0),
          fallos: prev.fallos + (ok ? 0 : 1),
          mecanicas: ok ? [...new Set([...prev.mecanicas, v.trazo.tool])] : prev.mecanicas,
          vecinos: ok ? [...new Set([...(prev.vecinos ?? []), ...otros])] : (prev.vecinos ?? []),
          conApoyo: (prev.conApoyo ?? 0) + (ok && e.apoyo ? 1 : 0),
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
    if (r.sello) {
      a.srl = { ...a.srl, sellosHechos: a.srl.sellosHechos + 1,
        sellosAcertados: a.srl.sellosAcertados + (r.sello.acertado ? 1 : 0) }
      // calibración explícita (G1): la señal más limpia del juego
      registrar({
        ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
        arquetipo: 'sello', condicion: e.dificultad, mecanica: 'calibracion',
        itemId: `sello:${r.diag.veredictos.length}`, conceptIds: r.diag.conceptIds,
        operacion: 'sellar', improvisado: false, seleccion: [],
        correcto: r.sello.acertado, apuesta: 'seguro', calibrado: r.sello.acertado,
        latenciaMs: e.latencias[e.latencias.length - 1]?.ms ?? 0,
        ayuda: false, repertorioTocado: null
      })
    }
    if (r.cuentasSaldadas.length) {
      // la marca de reflexión se saldó: quítala de la lista
      setMarcados((m) => m.filter((id) => !r.cuentasSaldadas.includes(id)))
    }
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
    if (tutorial !== null && (batalla.fase === 'ganado' || vivos(batalla).length === 0)) {
      const siguiente = tutorial + 1
      if (SALAS_TUTORIAL[siguiente]) { empezarTutorial(siguiente); return }
      setFase('tutorial-fin'); return
    }
    if (tutorial !== null && batalla.fase === 'perdido') { setFase('inicio'); return }
    if (batalla.fase === 'perdido') {
      borrarExpedicion(); setGuardada(null)
      setVictoria(false); setFase('fin'); return
    }
    // en aprendizaje la sala tiene varias oleadas: se encadenan sin salir
    if (batalla.fase !== 'ganado' && vivos(batalla).length === 0 && batalla.oleadas.length && ctx && progreso) {
      const e = { ...batalla }
      const nodo = nodoRef.current
      const bolsa: Bolsa = {
        herramientas, relaciones: progreso.relaciones,
        casos: [...new Set([...(nodo?.casos ?? []), ...casos])],
        tesis: [...new Set([...(nodo?.tesis ?? []), ...tesis])],
        intuiciones, fusionados, terrenos: progreso.terrenos, sellos,
        apoyo: true, sinTocar: [],
        sinEvidencia: (nodo?.conceptIds ?? []).filter((id) => !atlas?.conceptos[id]),
        asentadas: atlas ? Object.keys(atlas.aristas) : []
      }
      const siguiente = avanzarOleada(e, ctx, bolsa)
      if (siguiente) { setBatalla(e); return }
      e.fase = 'ganado'
      setBatalla(e)
    }
    if (batalla.fase === 'ganado' || vivos(batalla).length === 0) {
      const nodo = nodoRef.current
      const dura = nodo?.dificultad === 'dura' || nodo?.dificultad === 'jefe'
      // la calidad del mejor diagrama inclina la suerte, sin garantizarla
      const cumplido = batalla.encargo ? encargoCumplido(batalla.encargo, cuentaDe(batalla)) : false
      // el encargo cumplido inclina el botín y cura: lo que te propusiste, logrado
      const calidad = Math.min(1, batalla.mejorGolpe.dano / 420 + primaEncargo(batalla.encargo, cumplido))
      const r = ofrecerRecompensas(contenido, {
        lentes, sellos, herramientas, relaciones: progreso.relaciones
      }, rngRef.current, dura, calidad, atlas ? lentesVetadas(atlas) : [])
      setRecompensas(r.opciones); setVeta(r.veta)
      const cura = lucidezEncargo(batalla.encargo, cumplido)
      if (cura) setLucidez((l) => Math.min(LUCIDEZ_MAX, l + cura))
      if (atlas) {
        let a = {
          ...atlas, mejoresDiagramas: [...(atlas.mejoresDiagramas ?? []), batalla.mejorGolpe.dano],
          srl: { ...atlas.srl, encargosCumplidos: atlas.srl.encargosCumplidos + (cumplido ? 1 : 0) }
        }
        // hazañas: la colección se gana con conducta, no con botín
        const nuevas = evaluarHazanas(batalla, a)
        if (nuevas.length) {
          a = { ...a, hazanas: [...a.hazanas, ...nuevas.map((h) => h.id)] }
          for (const h of nuevas) {
            registrar({
              ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
              arquetipo: 'hazana', condicion: batalla.dificultad, mecanica: 'produccion',
              itemId: `hazana:${h.id}`, conceptIds: [], operacion: 'desbloquear',
              improvisado: false, seleccion: [], correcto: true, apuesta: h.id,
              calibrado: true, latenciaMs: 0, ayuda: false, repertorioTocado: null
            })
          }
        }
        setHazanasNuevas(nuevas)
        setAtlas(a); guardarAtlas(a)
      }
      if (batalla.encargo) {
        registrar({
          ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
          arquetipo: 'encargo', condicion: batalla.dificultad, mecanica: 'srl_planeacion',
          itemId: `encargo:${batalla.encargo.tipo}:n${batalla.encargo.nivel}:resultado`,
          conceptIds: batalla.encargo.tipo === 'concepto' ? [batalla.encargo.objetivo] : [],
          operacion: 'cumplir', improvisado: false, seleccion: [],
          correcto: cumplido, apuesta: String(batalla.encargo.nivel), calibrado: cumplido,
          latenciaMs: 0, ayuda: batalla.encargo.sobreDebil, repertorioTocado: null
        })
      }
      setFase('resumen'); return
    }
    const e = { ...batalla }
    siguienteTurno(e)
    setBatalla(e)
  }

  const tomarRecompensa = (r: Recompensa) => {
    switch (r.tipo) {
      case 'lente': setLentes((x) => [...x, r.id]); break
      case 'sello': setSellos((x) => [...x, r.id]); break
      case 'herramienta': setHerramientas((x) => [...x, r.id]); break
      case 'relacion':
        setAtlas((prev) => {
          if (!prev) return prev
          const a = {
            ...prev,
            progreso: { ...prev.progreso, relaciones: [...new Set([...prev.progreso.relaciones, r.tipoRelacion])] }
          }
          guardarAtlas(a); return a
        })
        break
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
          atlas={atlas} contenido={contenido} guardada={guardada}
          onExpedicion={empezarExpedicion}
          onRetomar={retomar}
          enTutorial={tutorial !== null}
          onTutorial={() => {
            if (tutorial !== null) {
              // salir: se devuelve el texto que estaba cargado
              const prev = previoRef.current
              setTutorial(null)
              if (prev) {
                setContenido(prev.contenido); setAtlas(prev.atlas)
                setGuardada(leerExpedicion(prev.contenido.fuente))
              }
              return
            }
            if (contenido && atlas) previoRef.current = { contenido, atlas }
            const t = contenidoTutorial()
            setContenido(t); setAtlas(cargarAtlas(t.fuente))
            setTutorial(0)
            setGuardada(null)
          }}
          onEmpezarTutorial={() => empezarTutorial(0)}
          onCambiarTexto={() => { setContenido(null); setFase('cargar') }}
        />
      </div>
    )
  }
  if (fase === 'portada') {
    return (
      <div className="app">
        <PortadaView
          aprendizaje={pendApoyo}
          onElegir={lanzarExpedicion}
          onVolver={() => setFase('inicio')}
        />
      </div>
    )
  }
  if (!ruta && tutorial === null) {
    return <div className="app"><BundleLoader onListo={alCargar} /></div>
  }

  const acto = ruta?.actos[actoIdx] ?? null
  const cob = coberturaAtlas(atlas, contenido)

  return (
    <div className="app">
      {['mapa', 'vistazo', 'batalla', 'resumen'].includes(fase) && (
        <FondoActo n={actoIdx + 1}
          sala={['batalla', 'vistazo', 'resumen'].includes(fase) ? (nodoRef.current?.dificultad ?? null) : null} />
      )}
      <header className="barra">
        <span className="marca">El Archivo Infinito</span>
        <span className="eyebrow">
          {tutorial !== null
            ? `Tutorial · ${SALAS_TUTORIAL[tutorial]?.titulo ?? ''}`
            : `expedición ${progreso.expediciones}${aprendizaje ? ' · aprendizaje' : ''}`}
        </span>
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

      {fase === 'mapa' && ruta && acto && (
        <MapView
          ruta={ruta} acto={acto} alcanzables={alcanzables} visitados={visitados}
          actual={nodoActual} onElegir={entrarNodo} contenido={contenido} atlas={atlas}
          lentes={lentes}
        />
      )}

      {fase === 'vistazo' && nodoRef.current && (
        <VistazoView
          nodo={nodoRef.current} contenido={contenido} atlas={atlas}
          onEntrar={(leido) => {
            registrar({
              ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
              arquetipo: 'vistazo', condicion: null, mecanica: 'srl_accion',
              itemId: leido ? 'vistazo:leido' : 'vistazo:saltado', conceptIds: [],
              operacion: 'vistazo', improvisado: false, seleccion: [], correcto: true,
              apuesta: leido ? 'leer' : 'saltar', calibrado: true,
              latenciaMs: 0, ayuda: leido, repertorioTocado: null
            })
            if (nodoRef.current) lanzarSala(nodoRef.current, leido)
          }}
        />
      )}

      {fase === 'batalla' && batalla && (
        <BoardView
          guia={(() => {
            if (tutorial === null) return null
            const sala = SALAS_TUTORIAL[tutorial]
            if (!sala) return null
            const i = sala.pasos.findIndex((x) => !pasosHechos.includes(x.clave))
            const idx = i < 0 ? sala.pasos.length - 1 : i
            const paso = sala.pasos[idx]
            return { titulo: paso.titulo, texto: paso.texto, indice: idx, total: sala.pasos.length }
          })()}
          e={batalla} contenido={contenido} lentes={mods}
          lucidez={lucidez} lucidezMax={LUCIDEZ_MAX} lentesIds={lentes}
          on={{
            cambio, afirmar, continuar, quemar, cambiar, sello, sellar, elegirEncargo,
            huir: () => {
              guardarAqui(actoIdx, alcanzables, visitados, nodoActual)
              setGuardada(leerExpedicion(contenido.fuente))
              setFase('inicio')
            }
          }}
        />
      )}

      {fase === 'resumen' && batalla && (
        <BattleMap
          contenido={contenido} hallazgos={batalla.hallazgos} atlas={atlas}
          mejorGolpe={batalla.mejorGolpe} enemigos={batalla.enemigos}
          latencias={batalla.latencias} descubiertos={batalla.relacionesNuevas}
          hazanas={hazanasNuevas.map((h) => ({ nombre: h.nombre, lente: h.lenteId }))}
          srl={{
            encargo: batalla.encargo,
            cumplido: batalla.encargo ? encargoCumplido(batalla.encargo, cuentaDe(batalla)) : false,
            sellosHechos: batalla.sellosHechos, sellosAcertados: batalla.sellosAcertados,
            candidatos: batalla.conceptIdsCasilla.filter((id) => contenido.conceptos[id]).slice(0, 6)
          }}
          onSeguir={(marcado) => {
            // autorreflexión: una atribución con consecuencia, contrastada con la evidencia
            const ref = juzgarReflexion(marcado, batalla.fallosPorConcepto)
            registrar({
              ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
              arquetipo: 'reflexion', condicion: batalla.dificultad, mecanica: 'srl_reflexion',
              itemId: marcado ? `marca:${marcado}` : 'marca:ninguno',
              conceptIds: [marcado, ref.masFallado].filter((x): x is string => !!x),
              operacion: 'atribuir', improvisado: false, seleccion: ref.masFallado ? [ref.masFallado] : [],
              correcto: ref.acertada, apuesta: marcado ?? 'nada', calibrado: ref.acertada,
              latenciaMs: 0, ayuda: false, repertorioTocado: null
            })
            if (marcado) setMarcados((m) => [...new Set([...m, marcado])].slice(-3))
            if (atlas) {
              const a = { ...atlas, srl: { ...atlas.srl, reflexiones: atlas.srl.reflexiones + 1,
                reflexionesAcertadas: atlas.srl.reflexionesAcertadas + (ref.acertada ? 1 : 0) } }
              setAtlas(a); guardarAtlas(a)
            }
            setFase('recompensa')
          }}
        />
      )}

      {fase === 'recompensa' && (
        <RewardView
          opciones={recompensas} onElegir={tomarRecompensa} contenido={contenido}
          titulo="Elige tu hallazgo" veta={veta}
        />
      )}

      {fase === 'refugio' && (
        <RefugioView
          atlas={atlas} contenido={contenido} semilla={nodoRef.current?.id ?? 'r'}
          lucidez={lucidez} lucidezMax={LUCIDEZ_MAX}
          archivados={archivados}
          onArchivar={(id) => {
            setArchivados((x) => [...new Set([...x, id])])
            registrar({
              ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
              arquetipo: 'refugio', condicion: null, mecanica: 'srl_accion',
              itemId: `archivar:${id}`, conceptIds: [id], operacion: 'archivar',
              improvisado: false, seleccion: [], correcto: true, apuesta: '—',
              calibrado: true, latenciaMs: 0, ayuda: false, repertorioTocado: null
            })
          }}
          onSeguir={(gana, acierto) => {
            setLucidez((l) => Math.min(LUCIDEZ_MAX, l + gana))
            if (acierto !== null) {
              registrar({
                ts: Date.now(), runId: runIdRef.current, nodoId: nodoRef.current?.id ?? '—',
                arquetipo: 'refugio', condicion: null, mecanica: 'autoevaluacion',
                itemId: 'autoconocimiento', conceptIds: [], operacion: 'reflexionar',
                improvisado: false, seleccion: [], correcto: acierto, apuesta: '—',
                calibrado: acierto, latenciaMs: 0, ayuda: false, repertorioTocado: null
              })
            }
            avanzar()
          }}
        />
      )}

      {fase === 'atlas' && (
        <AtlasView atlas={atlas} contenido={contenido} onVolver={() => setFase(faseAnterior)} />
      )}

      {fase === 'tutorial-fin' && (
        <div className="envoltura pila" style={{ maxWidth: 660 }}>
          <span className="eyebrow">Tutorial completado</span>
          <h2 className="display">Ya sabes lo que hace falta</h2>
          <p className="serif-lectura silencio">
            Poner piezas, decir algo verdadero sobre ellas y encadenar varias cosas en el
            mismo diagrama. Eso es todo el juego. Lo demás —las lentes, los sellos, los
            vínculos que se descubren derribando enemigos— va llegando solo.
          </p>
          <p className="serif-lectura">
            Ahora hazlo con un texto de verdad. Sube tu propio PDF procesado y el mismo
            carril se llenará con los conceptos de tu materia: los enemigos serán las
            confusiones de ese texto, y el Atlas que construyas será tuyo.
          </p>
          <div className="fila">
            <button className="btn primario grande" onClick={() => {
              const prev = previoRef.current
              setTutorial(null)
              if (prev) {
                setContenido(prev.contenido); setAtlas(prev.atlas)
                setGuardada(leerExpedicion(prev.contenido.fuente))
                setFase('inicio')
              } else {
                setContenido(null); setFase('cargar')
              }
            }}>
              {previoRef.current ? 'Volver a mi texto' : 'Cargar mi texto'}
            </button>
            <button className="btn fantasma" onClick={() => empezarTutorial(0)}>
              Repetir el tutorial
            </button>
          </div>
        </div>
      )}

      {fase === 'fin' && (
        <EndView
          victoria={victoria} atlas={atlas} contenido={contenido} batalla={batalla}
          onReiniciar={() => setFase('inicio')}
          onOtra={() => { setPendApoyo(aprendizaje); setFase('portada') }}
          onAtlas={() => { setFaseAnterior('fin'); setFase('atlas') }}
        />
      )}
    </div>
  )
}

import type React from 'react'
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
import { esAcierto, esCreacion, esFallo, type HerramientaId } from './engine/tools'
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
import { Entrar } from './ui/Entrar'
import { Shell, type Pestana } from './ui/Shell'
import { Biblioteca } from './ui/Biblioteca'
import { InicioView } from './ui/InicioView'
import { recortar, temasDe } from './engine/temas'
import { CierreView } from './ui/CierreView'
import { ColeccionView } from './ui/ColeccionView'
import { cargarPlan } from './net/sesion'
import { iniciarSubidas, marcarAplicada, useSubidas } from './net/subidas'
import { adaptarBundle } from './content/adapter'
import { bajarAtlas, cerrarSesion, leerSesion, masAvanzado, subirAtlas, type Sesion } from './net/sesion'
import { fijarAmbito, nivelDe, observarAtlas } from './engine/atlas'
import { BoardView } from './ui/BoardView'
import { EndView, MapView, PortadaView, RewardView } from './ui/Screens'
import { RefugioView } from './ui/RefugioView'
import { VistazoView } from './ui/VistazoView'
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
  | 'vistazo' | 'resumen' | 'recompensa' | 'refugio' | 'atlas' | 'fin' | 'tutorial-fin' | 'biblioteca' | 'logros'

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
  // foto del Atlas al empezar la batalla, para enseñar lo ganado en el cierre
  const atlasAlEmpezarRef = useRef<Atlas | null>(null)

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
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())
  /** el plan entero del perfil (la galaxia lo ve todo); la expedición juega un tema */
  const completoRef = useRef<Contenido | null>(null)
  const [temaActivo, setTemaActivo] = useState<string | null>(null)
  const subidas = useSubidas()
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

  const alCargar = useCallback((c: Contenido, s?: Sesion | null) => {
    const ses = s === undefined ? leerSesion() : s
    setSesion(ses)
    fijarAmbito(ses?.studentId ?? null)
    iniciarSubidas(ses)
    const local = cargarAtlas(c.fuente)
    completoRef.current = c
    setContenido(c); setAtlas(local)
    setGuardada(leerExpedicion(c.fuente))
    setFase('inicio')
    // cada guardado del Atlas sube al backend (agrupado, sin bloquear)
    observarAtlas(ses ? (a) => subirAtlas(ses, a) : null)
    if (ses) {
      void bajarAtlas(ses).then((remoto) => {
        const mejor = masAvanzado(local, remoto)
        if (mejor !== local) { setAtlas({ ...mejor, fuente: c.fuente }); guardarAtlas({ ...mejor, fuente: c.fuente }) }
      })
    }
  }, [])

  const empezarExpedicion = useCallback((conApoyo: boolean) => {
    if (!contenido || !atlas) return
    setPendApoyo(conApoyo)
    setFase('portada')
  }, [contenido, atlas])

  /** el contenido sobre el que se juega: el tema elegido, o todo si solo hay uno */
  const contenidoDeExpedicion = useCallback((c: Contenido): Contenido => {
    const temas = temasDe(c)
    if (temas.length <= 1) return c
    const tema = temas.find((t) => t.id === temaActivo) ?? temas[0]
    return recortar(c, tema)
  }, [temaActivo])

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
    const base = contenidoDeExpedicion(completoRef.current ?? contenido)
    setContenido(base)
    try { r = generarRuta(base, sem, conApoyo) }
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
    const base = contenidoDeExpedicion(completoRef.current ?? contenido)
    setContenido(base)
    try { r = generarRuta(base, guardada.semilla, guardada.aprendizaje) } catch { return }
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
    atlasAlEmpezarRef.current = atlas
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
    atlasAlEmpezarRef.current = atlas
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
    registrarPozo(cambiarPieza(e, uid, ctx ?? undefined))
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
    // El Atlas anota EVIDENCIA (lo que el texto sostiene o se sigue de él) y
    // FALLO (solo inversiones y errores: regla 3). Todo lo demás —matices,
    // convivencias, propuestas, lo insinuado— no es ni una cosa ni la otra:
    // hasta v5.35 se contaba como fallo, y explorar bajaba un concepto a
    // «se te resiste». Eso era contar la creatividad como error.
    for (const v of r.diag.veredictos) {
      if (v.estado === 'silencio') continue
      const ok = esAcierto(v.estado)
      const mal = esFallo(v.estado)
      if (!ok && !mal) continue
      for (const cid of v.conceptIds) {
        const prev = a.conceptos[cid] ??
          { aciertos: 0, fallos: 0, mecanicas: [], vecinos: [], conApoyo: 0, ultimaApuestaAcertada: null }
        const otros = v.conceptIds.filter((x) => x !== cid)
        a.conceptos[cid] = {
          aciertos: prev.aciertos + (ok ? 1 : 0),
          fallos: prev.fallos + (mal ? 1 : 0),
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
    // calibración: cuántas afirmaciones se sostuvieron. Las creaciones
    // (insinuado, propuesta) no son apuestas de lectura y no entran al cociente.
    const apuestas = r.diag.veredictos.filter((v) => !esCreacion(v.estado))
    a.apuestasTotales += apuestas.length
    a.apuestasCalibradas += apuestas.filter((v) => esAcierto(v.estado)).length
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
    siguienteTurno(e, ctx ?? undefined)
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

  // una lectura nueva lista → el plan del perfil cambió → se recarga cuando no hay batalla en curso
  const tranquila = ['inicio', 'atlas', 'logros', 'biblioteca', 'portada'].includes(fase)
  useEffect(() => {
    const lista = subidas.find((x) => x.estado === 'lista')
    if (!lista || !sesion || !tranquila) return
    marcarAplicada(lista.jobId)
    void cargarPlan(sesion.api, sesion.studentId).then((plan) => { if (plan) { const c = adaptarBundle(plan); completoRef.current = c; setContenido(c) } })
  }, [subidas, sesion, tranquila])

  /* -------------------------------- render -------------------------------- */

  if (fase === 'cargar' || !contenido || !atlas || !progreso) {
    return <div className="app"><Entrar onListo={alCargar} /></div>
  }
  const irA = (p: Pestana) => {
    const suelta = (f: Fase) => (['atlas', 'logros', 'biblioteca'] as Fase[]).includes(f) ? faseAnterior : f
    if (p === 'coleccion') { setFaseAnterior(suelta(fase)); setFase('atlas') }
    else if (p === 'logros') { setFaseAnterior(suelta(fase)); setFase('logros') }
    else if (p === 'biblioteca') { setFaseAnterior(suelta(fase)); setFase('biblioteca') }
    else if (p === 'expedicion') setFase('inicio')
  }
  const salir = () => { cerrarSesion(); observarAtlas(null); fijarAmbito(null); setSesion(null); setContenido(null); setFase('cargar') }
  const barra = (activa: Pestana, extra?: React.ReactNode) => (
    <Shell sesion={sesion} atlas={atlas} activa={activa} onPestana={irA} onSalir={salir}>{extra}</Shell>
  )
  if (fase === 'biblioteca' && sesion) {
    return (
      <div className="app">
        {barra('biblioteca')}
        <Biblioteca
          sesion={sesion}
          onVolver={() => setFase('inicio')}
        />
      </div>
    )
  }
  if (fase === 'inicio') {
    return (
      <div className="app">
        {barra('expedicion', (
          <>
            <button
              className="btn fantasma" aria-pressed={mudo}
              onClick={() => { const v = !mudo; silenciar(v); setMudo(v); if (!v) despertarAudio() }}
            >{mudo ? 'Sonido off' : 'Sonido on'}</button>
            <button className="btn fantasma" onClick={descargarLog}>Señales</button>
          </>
        ))}
        <InicioView
          contenido={completoRef.current ?? contenido} atlas={atlas} sesion={sesion} guardada={guardada}
          temas={temasDe(completoRef.current ?? contenido)} temaActivo={temaActivo} onTema={setTemaActivo}
          onContinuar={() => (guardada ? retomar() : empezarExpedicion(false))}
          onAtlas={() => { setFaseAnterior('inicio'); setFase('atlas') }}
          onEstrella={() => { setFaseAnterior('inicio'); setFase('atlas') }}
          acciones={(
            <button className="btn fantasma" onClick={() => empezarTutorial(0)} disabled={tutorial !== null}>Tutorial</button>
          )}
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
  if (fase === 'atlas' || fase === 'logros') {
    const volver = () => setFase((['atlas', 'logros', 'biblioteca'] as Fase[]).includes(faseAnterior) ? 'inicio' : faseAnterior)
    return (
      <div className="app">
        {barra(fase === 'logros' ? 'logros' : 'coleccion')}
        <ColeccionView
          key={fase} contenido={completoRef.current ?? contenido} atlas={atlas} inicial={fase === 'logros' ? 'logros' : 'estrellas'}
          onAtlas={(a) => { setAtlas(a); guardarAtlas(a) }} onVolver={volver}
        />
      </div>
    )
  }
  if (!ruta && tutorial === null) {
    // sin expedición empezada, cualquier otra fase vuelve al inicio (antes caía al cargador de bundles)
    return <div className="app"><Entrar onListo={alCargar} /></div>
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
          fondo={{ n: actoIdx + 1, sala: nodoRef.current?.dificultad ?? null }}
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

      {fase === 'resumen' && batalla && (() => {
        const antes = atlasAlEmpezarRef.current
        const nuevos = {
          aristas: Object.entries(atlas.aristas).filter(([k, v]) => (v.aciertos ?? 0) > 0 && (antes?.aristas[k]?.aciertos ?? 0) === 0).map(([k]) => k),
          conceptos: Object.keys(atlas.conceptos).filter((id) => nivelDe(atlas.conceptos[id]) > nivelDe(antes?.conceptos[id]))
        }
        return (
        <CierreView
          contenido={contenido} atlas={atlas} nuevos={nuevos}
          mejorGolpe={batalla.mejorGolpe} enemigos={batalla.enemigos}
          descubiertos={batalla.relacionesNuevas}
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
        )
      })()}

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



      {fase === 'tutorial-fin' && (
        <div className="envoltura pila tutorial-cierre" style={{ maxWidth: 560 }}>
          <div className="marca-lc" aria-label="LudusCog"><span className="orbita" aria-hidden="true" /><span className="nombre"><b>Ludus<span>Cog</span></b><small>aprender · entender · avanzar</small></span></div>
          <span className="eyebrow">Tutorial completado</span>
          <h2 className="display">Ya sabes jugar</h2>
          <ul className="cierre-lista tres-cosas">
            <li><i className="estrella-oro" /><span><b>Sacaste piezas a la mesa</b><small>Un nombre y una descripción, sin que pase nada todavía.</small></span></li>
            <li><i className="estrella-oro" /><span><b>Afirmaste un vínculo</b><small>Y el juego lo comprobó contra el texto: eso fue tu ataque.</small></span></li>
            <li><i className="estrella-oro" /><span><b>Detectaste una falsificación</b><small>Un nombre con la descripción de otro. Quemarla da ventaja.</small></span></li>
          </ul>
          <p className="silencio">
            El daño de cada diagrama son <b>puntos</b> (cuánto lo sostiene el texto) por un
            <b> multiplicador</b> (cuánto se articula). Un montón de trazos sueltos pega poco;
            pocos trazos verdaderos que se tocan, mucho.
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

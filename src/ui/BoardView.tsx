import { useMemo, useRef, useState, useEffect } from 'react'
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
import { LaneView } from './LaneView'
import { usarManifest } from './assets'
import { GLOSA_RELACION as GLOSA } from './glosas'
import { Chip } from './components'
import { BANDA, NOMBRE_CLASE, cedulaDe, estiloDeCedula, estiloRelacion, ondaEntre } from './identity'
import { useCascada } from './cascade'
import { despertarAudio, sfx } from './sfx'
import { consejoDeForma, encargoCumplido, previsualizarForma, type Encargo } from '../engine/srl'
import { condicionPorId } from '../engine/hazanas'

export interface AccionesBatalla {
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
  aproximado: 'var(--laton)', plausible: '#a78bd0', silencio: 'var(--niebla)',
  invertido: 'var(--oxido)', error: 'var(--oxido)'
}
const ETIQUETA_ESTADO: Record<string, string> = {
  sostenido: 'sostenido', equivalente: 'lo mismo dicho al revés',
  compatible: 'también es cierto',
  derivado: 'se sigue del texto', aproximado: 'vas bien, otro matiz',
  plausible: 'propuesta tuya', silencio: 'el texto no lo dice',
  invertido: 'al revés', error: 'falla'
}
const TONO_NOTA: Record<string, string> = {
  sostenido: 'ok', equivalente: 'ok', compatible: 'ok', derivado: 'ok', aproximado: 'nota',
  plausible: 'nota', silencio: 'nota', invertido: 'mal', error: 'mal'
}
const ETIQUETA: Record<Pieza['clase'], string> = {
  etiqueta: 'Nombre', definicion: 'Descripción', concepto: 'Concepto',
  apocrifa: 'Concepto', caso: 'Caso', tesis: 'Tesis', criterio: 'Criterio',
  marco: 'Marco', intuicion: 'Intuición', subdimension: 'Atributo', contexto: 'Terreno'
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
const ayudaDe = (p: Pieza) =>
  `${ETIQUETA[p.clase].toUpperCase()} · ${p.titulo}${p.cuerpo ? `\n\n${p.cuerpo}` : ''}`

export function BoardView({ e, contenido, lentes, on, lucidez, lucidezMax, lentesIds, guia, fondo,
  }: {
  e: EstadoBatalla; contenido: Contenido; lentes: ModificadoresLente
  on: AccionesBatalla; lucidez: number; lucidezMax: number; lentesIds: string[]
  /** paso del tutorial que toca ahora, si estamos en él */
  guia?: {
    titulo: string; texto: string; indice: number; total: number
    foco?: { zona: string; piezas?: string[]; herramientas?: HerramientaId[] }
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
  const [raton, setRaton] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  /** pieza del tablero bajo el cursor: se previsualiza en la ranura siguiente */
  const [previsualizada, setPrevisualizada] = useState<string | null>(null)
  /** el rastro solo estorba fuera del tablero: allí no hay nada que señalar */
  const [sobreTablero, setSobreTablero] = useState(false)

  // Un solo tooltip en posición fija para toda la pantalla. Antes se pintaba con
  // ::after dentro de cada elemento, y los contenedores con overflow lo cortaban.
  const seguirRaton = (ev: React.MouseEvent) => {
    setRaton({ x: ev.clientX, y: ev.clientY })
    const destino = (ev.target as HTMLElement).closest('[data-ayuda]') as HTMLElement | null
    // con una herramienta en la mano, la descripción se lee en el rastro y no
    // en un globo aparte: dos cuadros a la vez confunden más de lo que ayudan
    if (herramienta && destino?.classList.contains('en-tablero')) {
      if (ayuda) setAyuda(null)
      return
    }
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
  /** la Página en Blanco es materia de leyenda: UN golpe que derriba a 3+
   *  enemigos que estaban con la vida llena. Limpiar una sala a mordiscos no
   *  la gasta — por eso sigue sintiéndose enorme cuando pasa. */
  const aniquilacion = !!(resuelto && casc.terminada && e.ultima &&
    e.ultima.impactos.filter((i) => i.derribado && i.pleno).length >= 3)
  const borronSonado = useRef(-1)
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
    // el compás: golpe del héroe → impactos en cadena → respuesta enemiga
    const finImpactos = 420 + 150 * r.impactos.length + 260
    if (r.danoTotal > 0 && r.danoRecibido > 0) {
      ts.push(setTimeout(() => setGestoHeroe('herido'), finImpactos))
      ts.push(setTimeout(() => setGestoHeroe('quieto'), finImpactos + 700))
    } else if (r.danoTotal > 0 || r.danoRecibido > 0) {
      ts.push(setTimeout(() => setGestoHeroe('quieto'), Math.max(1100, finImpactos)))
    }
    return () => ts.forEach(clearTimeout)
  }, [resuelto, casc.terminada, e.ultima])

  const enMano = e.mano.filter((p) => !e.tablero.some((t) => t.uid === p.uid))
  const enTablero = foto
    ? foto.tablero.map((t) => ({ t, p: foto.piezas.find((x) => x.uid === t.uid) }))
        .filter((x): x is { t: typeof x.t; p: Pieza } => !!x.p)
    : e.tablero.map((t) => ({ t, p: e.mano.find((x) => x.uid === t.uid) }))
        .filter((x): x is { t: typeof x.t; p: Pieza } => !!x.p)
  const trazosVisibles = foto ? foto.trazos : e.trazos
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
  const encargoPendiente = !resuelto && e.turno === 1 && e.trazos.length === 0 &&
    !e.encargo && e.encargosOfrecidos.length > 0
  const cumplido = e.encargo ? encargoCumplido(e.encargo, {
    vinculosSostenidos: e.hallazgos.vinculos.length, combosVistos: e.combosVistos,
    conceptosSostenidos: e.conceptosSostenidos, quemasAcertadas: e.quemasAcertadas,
    errores: e.erroresTotales, invertidos: e.invertidosTotales
  }) : false

  /* --- foco del tutorial: se ilumina lo que toca y lo demás queda inerte --- */
  const foco = guia?.foco
  const zona = (z: string) => (foco?.zona === z ? ' destacada' : '')
  const piezaLibre = (uid: string) => !foco?.piezas || foco.piezas.includes(uid)
  const herrLibre = (id: HerramientaId) => !foco?.herramientas || foco.herramientas.includes(id)

  const reset = () => {
    setHerramienta(null); setParam(null); setPendientes([]); setPrevisualizada(null)
  }

  const posicionEnLienzo = (ev: { clientX: number; clientY: number }) => {
    const r = lienzo.current?.getBoundingClientRect()
    if (!r) return { x: 50, y: 50 }
    return {
      x: Math.max(6, Math.min(94, ((ev.clientX - r.left) / r.width) * 100)),
      y: Math.max(8, Math.min(90, ((ev.clientY - r.top) / r.height) * 100))
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
      {h && !resuelto && sobreTablero && (
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

      {guia && (
        <aside className={`guia${
          guia.foco?.zona === 'pasivas' || guia.foco?.zona === 'herramientas' ? ' apartada' : ''
        }`}>
          <span className="eyebrow">
            Tutorial · paso {guia.indice + 1} de {guia.total}
          </span>
          <strong>{guia.titulo}</strong>
          <p>{guia.texto}</p>
          <div className="pasos-puntos">
            {Array.from({ length: guia.total }, (_, i) => (
              <i key={i} className={i <= guia.indice ? 'hecho' : ''} />
            ))}
          </div>
        </aside>
      )}

      {ayuda && (
        <div
          className={`globo${ayuda.y > window.innerHeight / 2 ? ' arriba' : ' abajo'}`}
          style={{ left: ayuda.x, top: ayuda.y }}
          role="tooltip"
        >{ayuda.texto}</div>
      )}
      {/* ============================ carril ============================ */}
      <div className="zona-carril">
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
          ultimosImpactos={resuelto && casc.terminada && e.ultima ? e.ultima.impactos : []}
          disparoListo={resuelto && casc.terminada}
          disparo={resuelto && casc.terminada && e.ultima ? e.ultima.disparo : null}
        />
      </div>

      {/* ========================= herramientas ========================= */}
      <aside className={`zona-herramientas${zona('herramientas')}`}>
        <span className="eyebrow">Herramientas</span>
        {listaHerramientas.map((t) => {
          const quedan = e.herramientas.filter((x) => x === t.id).length -
            e.usadas.filter((x) => x === t.id).length
          const disponible = libres.includes(t.id) && !resuelto && herrLibre(t.id)
          const senalada = !!foco?.herramientas?.includes(t.id)
          return (
            <button
              key={t.id}
              className={`herr-v${herramienta === t.id ? ' activa' : ''}${senalada ? ' senala' : ''}`}
              disabled={!disponible}
              onClick={() => { if (herramienta === t.id) reset(); else { setHerramienta(t.id); setParam(null); setPendientes([]) } }}
              data-ayuda={`${t.nombre.toUpperCase()}\n${t.afirma}\n\n${t.ejemplo}`}
            >
              <span className="glifo">{t.glifo}</span>
              <span className="nom">{t.nombre}</span>
              <span className="cuantas">{quedan}</span>
            </button>
          )
        })}

        <div className={`separador${zona('pasivas')}`} />
        <span className={`eyebrow${zona('pasivas')}`}>Pasivas</span>
        {lentesIds.length === 0 && <span className="silencio dato">ninguna</span>}
        {lentesIds.map((id) => {
          const l = lentePorId(id)
          return (
            <span key={id} className={`pastilla ancha${zona('pasivas') ? ' senala' : ''}`} data-ayuda={`${l.nombre.toUpperCase()}\n${l.regla}\n\n${l.costo}`}>
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
      <main className={`zona-lienzo${zona('lienzo')}`}>
        {(() => {
          const ol = oleadaActual(e)
          if (!ol) return null
          return (
            <div className={`aviso-oleada apoyo-${ol.apoyo}`}>
              <strong>{ol.titulo}</strong>
              <span>{ol.aviso}</span>
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
              const color = COLOR_ESTADO[ver?.estado ?? 'silencio']
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
                <g key={t.uid} className={
                  (resuelto && !casc.trazosRevelados.has(t.uid) ? 'oculto' : 'trazo-vivo') +
                  (trazoAbierto === t.uid ? ' resaltado' : trazoAbierto ? ' atenuado' : '')
                }>
                  {pts.slice(0, -1).map((a, i) => {
                    const b = pts[i + 1]
                    const est = t.tool === 'flecha' ? estiloRelacion(t.param) : null
                    if (est?.ondulada) return null
                    const dash = est?.dash ?? (t.tool === 'identidad' ? '3 3'
                      : ver?.estado === 'derivado' ? '9 4'
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
                        : ver.estado === 'plausible' ? '✎' : ver.estado === 'invertido' ? '↺' : '·'}
                    </text>
                  )}
                </g>
              )
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
              .filter((t) => t.tool === 'flecha' && estiloRelacion(t.param).ondulada)
              .map((t) => {
                const pts = t.piezas.map((u) => posiciones.find((x) => x.uid === u))
                  .filter((x): x is NonNullable<typeof x> => !!x)
                if (pts.length < 2) return null
                if (resuelto && !casc.trazosRevelados.has(t.uid)) return null
                const ver = veredictos.find((v) => v.trazo.uid === t.uid)
                return (
                  <path key={t.uid} d={ondaEntre(pts[0].x, pts[0].y, pts[1].x, pts[1].y)}
                    fill="none" strokeWidth={1.8}
                    stroke={COLOR_ESTADO[ver?.estado ?? 'silencio']} vectorEffect="non-scaling-stroke" />
                )
              })}
          </svg>

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
                className={`naipe en-tablero naipe-${p.clase}${marcada ? ' marcada' : ''}` +
                  `${dorada ? ' dorada' : ''}` +
                  `${e.reveladas.includes(p.uid) ? ' senalada' : ''}` +
                  `${enFoco ? ' en-foco' : trazoAbierto ? ' fuera-de-foco' : ''}` +
                  `${inservible ? ' inservible' : ''}`}
                style={{ left: `${t.x}%`, top: `${t.y}%`, ...estiloDeCedula(cd),
                  ...(texturaDe(p.clase) ? { background: `${texturaDe(p.clase)}, ${cd.tono}` } : {}) }}
                draggable={!resuelto}
                onDragStart={() => setArrastrando(p.uid)}
                onDragEnd={() => setArrastrando(null)}
                onClick={() => tocarPieza(p.uid)}
                onDoubleClick={() => pedirDevolver(p.uid)}
                onMouseEnter={() => herramienta && !inservible && setPrevisualizada(p.uid)}
                onMouseLeave={() => setPrevisualizada((x) => (x === p.uid ? null : x))}
                data-ayuda={ayudaDe(p) + (dorada ? AYUDA_DORADA : '')}
              >
                {marcada && <span className="orden">{orden + 1}</span>}
                <span className="tt" style={{ color: cd.banda }}>{ETIQUETA[p.clase]}<span className="orn">{cd.ornamento}</span></span>
                <span className="nom">{recorte(p.titulo, 42)}</span>
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

            <button className="btn primario" disabled={!puedeCerrar} onClick={cerrarTrazo}>Trazar</button>
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
              <span className="etiqueta-cuenta">cuerpo</span>
              <span className="fichas" key={`f${casc.fichas}`}>{casc.fichas}</span>
              <span className="por">×</span>
              <span className="etiqueta-cuenta">filo</span>
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
                      : 'Golpe puntual: un objetivo. Lo que sobra al derribarlo desborda al siguiente.'
                }>
                  {e.ultima.patron === 'barrido' ? '☄ barrido' : e.ultima.patron === 'onda' ? '≋ onda' : '→ puntual'}
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
                  {ver.reserva && <p className="nota nota" style={{ margin: '6px 0 0' }}>{ver.reserva}</p>}
                </div>
              )
            })()}
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
      <aside className={`zona-mano${zona('mano') || zona('pozo')}`}>
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
            {([['etiqueta', 'empareja con su Descripción (Identidad =) o úsalo como nodo'],
              ['definicion', 'suelta: su dueño existe — emparéjala o úsala como nodo'],
              ['concepto', 'completo: nodo pleno para cualquier herramienta'],
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
                className={`renglon${seleccion === p.uid ? ' activa' : ''}` +
                  `${dorada ? ' dorada' : ''}` +
                  `${e.reveladas.includes(p.uid) ? ' senalada' : ''}` +
                  `${foco?.piezas ? (piezaLibre(p.uid) ? ' senala' : ' bloqueada') : ''}`}
                style={{ borderLeftColor: cd.banda,
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
                <span className="tt" style={{ color: cd.banda }}>{ETIQUETA[p.clase]}<span className="orn">{cd.ornamento}</span></span>
                <span className="nom">{recorte(p.titulo, 40)}</span>
                {cd.canto && <span className="marca">umbral</span>}
              </div>
            )
          })}
        </div>
      </aside>

      {/* ============================ encargo ============================= */}
      {encargoPendiente && (
        <div className="encargos">
          <span className="eyebrow">¿Qué te propones en esta sala?</span>
          <div className="encargos-fila">
            {e.encargosOfrecidos.map((en) => (
              <button key={en.id} className={`encargo n${en.nivel}`}
                onClick={() => { on.elegirEncargo(en); sfx.trazar() }}
                data-ayuda={en.detalle}>
                <span className="encargo-nivel">{'◆'.repeat(en.nivel)}</span>
                <span className="encargo-titulo">{en.titulo}</span>
                <span className="dato">+{[0, 4, 8, 14][en.nivel]} lucidez · botín mejor</span>
              </button>
            ))}
            <button className="btn fantasma" onClick={() => on.elegirEncargo(null)}>
              Sin encargo
            </button>
          </div>
          <span className="silencio" style={{ fontSize: 12 }}>
            Mira tu mano y el frente antes de elegir. Un encargo exigente que se cumple cura más; uno que no, no castiga.
          </span>
        </div>
      )}

      {/* ============================ acciones ============================ */}
      <footer className={`zona-acciones${zona('afirmar') || zona('pozo')}`}>
        {!resuelto ? (
          <>
            <button
              className={`btn primario grande${zona('afirmar') ? ' senala' : ''}`}
              onClick={on.afirmar} disabled={e.trazos.length === 0}
            >
              Afirmar el diagrama {e.trazos.length > 0 && <span className="dato">· {e.trazos.length} trazos</span>}
            </button>
            <button
              className={`btn sello-confianza${e.sellado ? ' activo' : ''}`}
              aria-pressed={e.sellado} disabled={e.trazos.length === 0}
              onClick={() => { on.sellar(!e.sellado); despertarAudio() }}
              data-ayuda={'SELLAR\nDeclaras que TODO lo que hay en el tablero se sostiene. Si es así, el diagrama rinde el doble de multiplicador; si un solo trazo falla, rinde el 60 %. No cambia lo que es verdad: cambia lo que ganas por saber que lo sabes.'}
            >
              {e.sellado ? '⬢ Sellado' : '⬡ Sellar'}
            </button>
            {e.trazos.length > 0 && (
              <span className="forma-previa dato silencio">
                {forma.piezas} piezas · alcance {forma.alcancePotencial}
                {forma.combosPosibles.length > 0 && (
                  <> · podría encender <strong>{forma.combosPosibles.join(', ')}</strong></>
                )}
                {(() => {
                  const c = consejoDeForma(e.trazos, [...e.mano, ...e.descarte], e.sellado)
                  return c ? <em className="consejo-forma"> — {c}</em> : null
                })()}
              </span>
            )}
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
            <button
              className={`btn peligro${zona('pozo') ? ' senala' : ''}`}
              disabled={!piezaSel || e.quemasRestantes <= 0}
              onClick={() => { if (piezaSel) { on.quemar(piezaSel.uid); setSeleccion(null) } }}
              data-ayuda={'QUEMAR\nAfirmas que la carta es una falsificación. Si aciertas: tinta, una carta nueva y bonificación. Si te equivocas, destruyes material bueno.'}
            >
              Quemar {piezaSel ? `«${recorte(piezaSel.titulo, 18)}»` : 'concepto'}
              <span className="dato"> · {e.quemasRestantes}</span>
            </button>
            <button
              className="btn" disabled={!piezaSel || e.cambiosRestantes <= 0}
              onClick={() => { if (piezaSel) { on.cambiar(piezaSel.uid); setSeleccion(null) } }}
              data-ayuda={'CAMBIAR\nEs cierta, pero aquí no te sirve. Vuelve al mazo y robas otra.'}
            >
              Cambiar {piezaSel ? `«${recorte(piezaSel.titulo, 18)}»` : 'concepto'}
              <span className="dato"> · {e.cambiosRestantes}</span>
            </button>
            {objetivo && (
              <span className="silencio dato" data-ayuda={tipoPorId(objetivo.tipoId).glosa}>
                al frente: {objetivo.nombre}
              </span>
            )}
            <button className="btn peligro fantasma" onClick={on.huir}>Abandonar</button>
          </>
        ) : (
          <button className="btn primario grande" disabled={!casc.terminada}
            onClick={() => { setTrazoAbierto(null); on.continuar() }}>
            {e.fase === 'ganado' ? 'El carril queda despejado'
              : e.oleadas.length && vivos(e).length === 0 ? 'Entra la siguiente tanda'
              : e.fase === 'perdido' ? 'Cerrar la expedición' : 'Siguiente turno'}
          </button>
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

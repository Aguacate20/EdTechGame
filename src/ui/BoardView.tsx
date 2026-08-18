import { useMemo, useRef, useState } from 'react'
import type { Contenido } from '../content/types'
import type { Pieza } from '../engine/pieces'
import {
  borrarTrazo, devolverAMano, herramientasLibres, soltar, trazar, vivos, type EstadoBatalla
} from '../engine/battle'
import {
  evaluarDiagrama, HERRAMIENTAS, listaHerramientas, type HerramientaId, type ModificadoresLente
} from '../engine/tools'
import { tipoPorId } from '../engine/lane'
import { lentePorId, selloPorId, type SelloId } from '../engine/powers'
import { LaneView } from './LaneView'
import { Chip } from './components'
import { cedulaDe, estiloDeCedula, estiloRelacion, ondaEntre } from './identity'
import { useCascada } from './cascade'
import { despertarAudio, sfx } from './sfx'

export interface AccionesBatalla {
  cambio: (mut: (e: EstadoBatalla) => void) => void
  afirmar: () => void
  continuar: () => void
  quemar: (uid: string) => void
  cambiar: (uid: string) => void
  sello: (id: SelloId) => void
  huir: () => void
}

const COLOR_ESTADO: Record<string, string> = {
  sostenido: 'var(--verdigris)',
  equivalente: 'var(--verdigris)',
  derivado: '#7fa8d6',
  aproximado: 'var(--laton)',
  plausible: '#7a6fb0',
  silencio: 'var(--niebla)',
  invertido: 'var(--oxido)',
  error: 'var(--oxido)'
}

const ETIQUETA_ESTADO: Record<string, string> = {
  sostenido: 'sostenido',
  equivalente: 'lo mismo dicho al revés',
  derivado: 'se sigue del texto',
  aproximado: 'vas bien, otro matiz',
  plausible: 'razonable, el texto no lo dice',
  silencio: 'el texto no lo dice',
  invertido: 'al revés',
  error: 'falla'
}

const TONO_NOTA: Record<string, string> = {
  sostenido: 'ok', equivalente: 'ok', derivado: 'ok',
  aproximado: 'nota', plausible: 'nota', silencio: 'nota',
  invertido: 'mal', error: 'mal'
}

function recorte(t: string, n: number): string {
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}

function Naipe({ p, contenido, compacto }: { p: Pieza; contenido: Contenido; compacto?: boolean }) {
  const cd = cedulaDe(contenido, p)
  return (
    <>
      <span className="tt">
        {ETIQUETA[p.clase]}
        <span className="orn" aria-hidden>{cd.ornamento}</span>
      </span>
      <span className="nom">{recorte(p.titulo, 46)}</span>
      {!compacto && p.cuerpo && <span className="cuerpo">{recorte(p.cuerpo, 190)}</span>}
      {!compacto && p.cuerpo.length > 190 && <span className="mas">toca para leerlo entero</span>}
      {p.umbral && <span className="marca">umbral</span>}
      <i className="borde" style={{ background: cd.banda }} />
      <i className={`grano grano-${cd.textura}`} aria-hidden />
      {cd.canto && <i className="canto" aria-hidden />}
    </>
  )
}

const ETIQUETA: Record<Pieza['clase'], string> = {
  etiqueta: 'Nombre', definicion: 'Descripción', concepto: 'Concepto',
  apocrifa: 'Concepto', caso: 'Caso', tesis: 'Tesis', criterio: 'Criterio',
  marco: 'Marco', intuicion: 'Intuición', subdimension: 'Atributo'
}

export function BoardView({ e, contenido, lentes, on, lucidez, lucidezMax, tinta, lentesIds }: {
  e: EstadoBatalla; contenido: Contenido; lentes: ModificadoresLente
  on: AccionesBatalla; lucidez: number; lucidezMax: number
  tinta: number; lentesIds: string[]
}) {
  const lienzo = useRef<HTMLDivElement>(null)
  const [herramienta, setHerramienta] = useState<HerramientaId | null>(null)
  const [param, setParam] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<string[]>([])
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [trazoAbierto, setTrazoAbierto] = useState<string | null>(null)

  const previa = useMemo(
    () => evaluarDiagrama(contenido, e.mano, e.trazos, lentes),
    [contenido, e.mano, e.trazos, lentes]
  )
  const resuelto = e.fase !== 'jugando'
  const foto = resuelto ? e.ultima?.foto : null
  const enMano = e.mano.filter((p) => !e.tablero.some((t) => t.uid === p.uid))
  const enTablero = foto
    ? foto.tablero
        .map((t) => ({ t, p: foto.piezas.find((x) => x.uid === t.uid) }))
        .filter((x): x is { t: typeof x.t; p: Pieza } => !!x.p)
    : e.tablero
        .map((t) => ({ t, p: e.mano.find((x) => x.uid === t.uid) }))
        .filter((x): x is { t: typeof x.t; p: Pieza } => !!x.p)
  const trazosVisibles = foto ? foto.trazos : e.trazos
  const posiciones = foto ? foto.tablero : e.tablero
  const veredictos = resuelto && e.ultima ? e.ultima.diag.veredictos : previa.veredictos
  const piezaAbierta = [...e.mano, ...(foto?.piezas ?? [])].find((p) => p.uid === seleccion) ?? null
  const casc = useCascada(resuelto && e.ultima ? e.ultima.diag : null, resuelto)

  const libres = herramientasLibres(e)
  const objetivo = vivos(e).sort((a, b) => a.posicion - b.posicion)[0]
  const h = herramienta ? HERRAMIENTAS[herramienta] : null
  const puedeCerrar = !!h && pendientes.length >= h.aridad[0] && (!h.parametro || !!param)

  const reset = () => { setHerramienta(null); setParam(null); setPendientes([]) }

  const posicionEnLienzo = (ev: { clientX: number; clientY: number }) => {
    const r = lienzo.current?.getBoundingClientRect()
    if (!r) return { x: 50, y: 50 }
    return {
      x: Math.max(3, Math.min(94, ((ev.clientX - r.left) / r.width) * 100)),
      y: Math.max(4, Math.min(88, ((ev.clientY - r.top) / r.height) * 100))
    }
  }

  const tocarPieza = (uid: string) => {
    despertarAudio()
    if (resuelto) return
    sfx.tomar()
    if (h) {
      setPendientes((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid])
      return
    }
    setSeleccion(seleccion === uid ? null : uid)
    setTrazoAbierto(null)
  }

  const cerrarTrazo = () => {
    if (!herramienta || !puedeCerrar) return
    sfx.trazar()
    on.cambio((st) => { trazar(st, herramienta, pendientes, param) })
    reset()
  }

  return (
    <div className="envoltura pila">
      <LaneView
        enemigos={e.enemigos} lucidez={lucidez} lucidezMax={lucidezMax}
        alcance={resuelto ? 0 : previa.alcance}
        gesto={
          resuelto && casc.terminada
            ? (e.ultima && e.ultima.danoTotal > 0 ? 'afirma' : 'herido')
            : 'quieto'
        }
        ultimosImpactos={resuelto && casc.terminada && e.ultima ? e.ultima.impactos : []}
        disparoListo={resuelto && casc.terminada}
      />

      <div className="estante">
        <div className="estante-grupo">
          <span className="eyebrow">Pasivas</span>
          <div className="fila" style={{ gap: 5, flexWrap: 'wrap' }}>
            {lentesIds.length === 0 && <span className="silencio dato">ninguna</span>}
            {lentesIds.map((id) => {
              const l = lentePorId(id)
              return (
                <span key={id} className="pastilla" data-ayuda={`${l.regla} — ${l.costo}`}>
                  {l.nombre}
                </span>
              )
            })}
          </div>
        </div>
        <div className="estante-grupo">
          <span className="eyebrow">Sellos · un uso por combate</span>
          <div className="fila" style={{ gap: 5, flexWrap: 'wrap' }}>
            {e.sellos.length === 0 && <span className="silencio dato">ninguno</span>}
            {e.sellos.map((id) => {
              const x = selloPorId(id)
              const gastado = e.sellosUsados.includes(id)
              return (
                <button
                  key={id} className={`sello-btn${gastado ? ' gastado' : ''}`}
                  disabled={gastado || resuelto} onClick={() => on.sello(id)}
                  data-ayuda={x.efecto}
                >
                  <span className="glifo">{x.glifo}</span> {x.nombre}
                </button>
              )
            })}
          </div>
        </div>
        <div className="estante-grupo derecha">
          <span className="eyebrow">Tinta</span>
          <span className="tinta-marca grande">◈ {tinta}</span>
          {e.bonusMult > 0 && <span className="pastilla brillo">próximo diagrama +{e.bonusMult.toFixed(1)}×</span>}
        </div>
      </div>

      <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="eyebrow">Tu diagrama · turno {e.turno}</span>
        <span className="dato silencio">
          {e.quemasRestantes} quemas · {e.cambiosRestantes} cambios · mazo {e.mazo.length}
        </span>
      </div>

      {/* ------------------------------- el lienzo ------------------------------ */}
      <div
        className="lienzo" ref={lienzo}
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
            Arrastra piezas aquí. Después elige una herramienta y toca las piezas
            que quieras relacionar con ella.
          </p>
        )}

        <svg className="trazos" aria-hidden>
          {trazosVisibles.map((t) => {
            const pts = t.piezas
              .map((u) => posiciones.find((x) => x.uid === u))
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
              <g
                key={t.uid}
                className={
                  (resuelto && !casc.trazosRevelados.has(t.uid) ? 'oculto' : 'trazo-vivo') +
                  (trazoAbierto === t.uid ? ' resaltado' : trazoAbierto ? ' atenuado' : '')
                }
              >
                {pts.slice(0, -1).map((a, i) => {
                  const b = pts[i + 1]
                  const est = t.tool === 'flecha' ? estiloRelacion(t.param) : null
                  const dash = est?.dash
                    ?? (t.tool === 'identidad' ? '3 3'
                      : ver?.estado === 'derivado' ? '9 4'
                      : ver?.estado === 'plausible' ? '2 6' : undefined)
                  const ancho = est?.ancho ?? 2.4
                  const comun = {
                    stroke: color, strokeWidth: ancho, strokeDasharray: dash,
                    fill: 'none' as const,
                    markerEnd: tool.ordenada ? `url(#punta-${est?.punta ?? 'flecha'})` : undefined
                  }
                  if (est?.ondulada) return null // se dibuja en la capa de ondas
                  return (
                    <g key={i}>
                      <line x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} {...comun} />
                      {est?.doble && (
                        <line
                          x1={`${a.x}%`} y1={`${a.y + 1.6}%`} x2={`${b.x}%`} y2={`${b.y + 1.6}%`}
                          stroke={color} strokeWidth={ancho * 0.7} fill="none" opacity=".75"
                        />
                      )}
                    </g>
                  )
                })}
                {resuelto && ver && (
                  <text
                    x={`${(pts[0].x + pts[pts.length - 1].x) / 2}%`}
                    y={`${(pts[0].y + pts[pts.length - 1].y) / 2 - 3}%`}
                    fill={color} fontSize="11" textAnchor="middle"
                    style={{ fontFamily: 'var(--mono)' }}>
                    {ver.estado === 'sostenido' ? '✓'
                      : ver.estado === 'equivalente' ? '✓ ='
                      : ver.estado === 'derivado' ? '✓ se sigue'
                      : ver.estado === 'aproximado' ? '≈'
                      : ver.estado === 'plausible' ? '~'
                      : ver.estado === 'invertido' ? '↺' : '·'}
                  </text>
                )}
                {t.tool === 'tachon' && (
                  <text x={`${pts[0].x}%`} y={`${pts[0].y}%`} fill={color}
                    fontSize="26" textAnchor="middle" dominantBaseline="middle">✗</text>
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
            <marker id="punta-ninguna" markerWidth="1" markerHeight="1" refX="0" refY="0" />
          </defs>
        </svg>

        <svg className="trazos ondas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {trazosVisibles
            .filter((t) => t.tool === 'flecha' && estiloRelacion(t.param).ondulada)
            .map((t) => {
              const pts = t.piezas
                .map((u) => posiciones.find((x) => x.uid === u))
                .filter((x): x is NonNullable<typeof x> => !!x)
              if (pts.length < 2) return null
              const ver = veredictos.find((v) => v.trazo.uid === t.uid)
              if (resuelto && !casc.trazosRevelados.has(t.uid)) return null
              return (
                <path
                  key={t.uid}
                  d={ondaEntre(pts[0].x, pts[0].y, pts[1].x, pts[1].y)}
                  fill="none" strokeWidth={1.8}
                  stroke={COLOR_ESTADO[ver?.estado ?? 'silencio']}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
        </svg>

        {enTablero.map(({ t, p }) => {
          const marcada = pendientes.includes(p.uid)
          const orden = pendientes.indexOf(p.uid)
          return (
            <div
              key={p.uid}
              className={
                `naipe en-tablero naipe-${p.clase}${marcada ? ' marcada' : ''}` +
                `${seleccion === p.uid ? ' activa' : ''}` +
                `${e.reveladas.includes(p.uid) ? ' senalada' : ''}` +
                `${trazoAbierto && trazosVisibles.find((t) => t.uid === trazoAbierto)?.piezas.includes(p.uid) ? ' en-foco' : trazoAbierto ? ' fuera-de-foco' : ''}`
              }
              style={{ left: `${t.x}%`, top: `${t.y}%`, ...estiloDeCedula(cedulaDe(contenido, p)) }}
              draggable={!resuelto}
              onDragStart={() => setArrastrando(p.uid)}
              onDragEnd={() => setArrastrando(null)}
              onClick={() => tocarPieza(p.uid)}
              onDoubleClick={() => !resuelto && on.cambio((st) => devolverAMano(st, p.uid))}
              title="Arrastra para mover · doble clic para devolver a la mano"
            >
              {marcada && <span className="orden">{orden + 1}</span>}
              <Naipe p={p} contenido={contenido} compacto />
            </div>
          )
        })}
      </div>

      {e.ultimoPozo && !resuelto && (
        <div className={`acuse ${e.ultimoPozo.acertado ? 'bien' : 'mal'}`}>
          <strong>
            {e.ultimoPozo.accion === 'quemar' ? 'Quemaste' : 'Cambiaste'} «{e.ultimoPozo.titulo}»
          </strong>
          <span>{e.ultimoPozo.nota}</span>
          {e.ultimoPozo.tinta > 0 && (
            <span className="premio">◈ +{e.ultimoPozo.tinta} · +{e.ultimoPozo.bonusMult.toFixed(1)}× · +1 carta</span>
          )}
        </div>
      )}

      {/* ---------------------------- herramientas ---------------------------- */}
      {!resuelto && (
        <div className="herramientas">
          {listaHerramientas.map((t) => {
            const disponible = libres.includes(t.id)
            return (
              <button
                key={t.id}
                className={`herr${herramienta === t.id ? ' activa' : ''}`}
                disabled={!disponible}
                onClick={() => { if (herramienta === t.id) reset(); else { setHerramienta(t.id); setParam(null); setPendientes([]) } }}
                title={t.afirma}
              >
                <span className="glifo">{t.glifo}</span>
                <span className="nom">{t.nombre}</span>
                <span className="cuantas">
                  {e.herramientas.filter((x) => x === t.id).length - e.usadas.filter((x) => x === t.id).length}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {h && !resuelto && (
        <div className="constructor">
          <span className="eyebrow">{h.nombre} · {h.afirma}</span>
          <p className="ejemplo-herr">{h.ejemplo}</p>
          {h.parametro === 'relacion' && (
            <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
              {[...new Set(e.relacionesDisponibles)].map((tipo) => (
                <button key={tipo} className={`apuesta${param === tipo ? ' activa' : ''}`}
                  onClick={() => setParam(tipo)}>
                  {tipo} <span className="dato">×{(contenido.frecuenciaRelacion[tipo] ?? 0)}</span>
                </button>
              ))}
            </div>
          )}
          {h.parametro === 'eje' && (
            <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
              {contenido.ejes.flatMap((eje) =>
                [...new Set(Object.values(eje.valores).map(String))].map((valor) => (
                  <button key={`${eje.id}::${valor}`}
                    className={`apuesta${param === `${eje.id}::${valor}` ? ' activa' : ''}`}
                    onClick={() => setParam(`${eje.id}::${valor}`)}>
                    {eje.nombre}: {valor}
                  </button>
                ))
              )}
              {contenido.ejes.length === 0 && (
                <span className="silencio" style={{ fontSize: 12.5 }}>
                  Este texto no trae ejes legibles: la herramienta queda fuera de juego.
                </span>
              )}
            </div>
          )}
          <span className="silencio" style={{ fontSize: 12.5 }}>
            Toca {h.aridad[0] === h.aridad[1] ? h.aridad[0] : `${h.aridad[0]}–${h.aridad[1]}`} piezas
            del tablero{h.ordenada ? ', en orden' : ''}. Llevas {pendientes.length}.
          </span>
          <div className="fila">
            <button className="btn primario" disabled={!puedeCerrar} onClick={cerrarTrazo}>
              Trazar
            </button>
            <button className="btn fantasma" onClick={reset}>Cancelar</button>
          </div>
        </div>
      )}

      {/* -------------------------- estado del diagrama ------------------------ */}
      {!resuelto && (
        <div className="previa">
          <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
            {e.trazos.length === 0 && (
              <span className="silencio" style={{ fontSize: 13 }}>
                Sin trazos todavía. Lo más sencillo: suelta un Nombre y una Descripción
                y úneselos con la Identidad.
              </span>
            )}
            {e.trazos.map((t) => {
              const ver = previa.veredictos.find((v) => v.trazo.uid === t.uid)
              return (
                <button key={t.uid} className="trazo-chip"
                  onClick={() => { sfx.deshacer(); on.cambio((st) => borrarTrazo(st, t.uid)) }}
                  title="Toca para deshacer este trazo">
                  <span style={{ color: COLOR_ESTADO[ver?.estado ?? 'silencio'] }}>
                    {HERRAMIENTAS[t.tool].glifo}
                  </span>{' '}
                  {HERRAMIENTAS[t.tool].nombre}{t.param ? ` · ${t.param.split('::').pop()}` : ''}
                </button>
              )
            })}
          </div>
          {previa.combos.length > 0 && (
            <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
              {previa.combos.map((c, i) => <Chip key={i} tono="laton">{c.nombre}</Chip>)}
            </div>
          )}
          <button className="btn primario" onClick={on.afirmar} disabled={e.trazos.length === 0}>
            Afirmar el diagrama
          </button>
        </div>
      )}

      {/* ----------------------------- resolución ----------------------------- */}
      {resuelto && e.ultima && (
        <div className="resolucion">
          <div className="cuenta" onClick={casc.saltar} title="Toca para saltar la cuenta">
            <span className="fichas" key={`f${casc.fichas}`}>{casc.fichas}</span>
            <span className="por">×</span>
            <span className="mult" key={`m${casc.mult.toFixed(1)}`}>{casc.mult.toFixed(1)}</span>
            {casc.total !== null && (
              <>
                <span className="por">=</span>
                <span className="total">{casc.total}</span>
              </>
            )}
          </div>

          <p className="silencio" style={{ margin: 0, fontSize: 13 }}>
            Tu diagrama sigue arriba. Cada trazo lleva ahora su marca; toca uno para leer por qué.
            {!casc.terminada && ' Toca la cuenta para saltarla.'}
          </p>

          <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
            {trazosVisibles.filter((t) => casc.trazosRevelados.has(t.uid)).map((t) => {
              const ver = veredictos.find((v) => v.trazo.uid === t.uid)
              const est = ver?.estado ?? 'silencio'
              return (
                <button
                  key={t.uid}
                  className={`trazo-chip aparece${trazoAbierto === t.uid ? ' abierto' : ''}`}
                  style={{ borderColor: COLOR_ESTADO[est], color: COLOR_ESTADO[est] }}
                  onClick={() => setTrazoAbierto(trazoAbierto === t.uid ? null : t.uid)}
                >
                  {HERRAMIENTAS[t.tool].glifo} {HERRAMIENTAS[t.tool].nombre}
                  {t.param ? ` · ${t.param.split('::').pop()}` : ''} — {ETIQUETA_ESTADO[est]}
                </button>
              )
            })}
          </div>

          {trazoAbierto && (() => {
            const ver = veredictos.find((v) => v.trazo.uid === trazoAbierto)
            if (!ver) return null
            return (
              <div className="detalle-trazo">
                <p className={`nota ${TONO_NOTA[ver.estado]}`} style={{ margin: 0 }}>{ver.nota}</p>
                {ver.reserva && <p className="nota nota" style={{ margin: '6px 0 0' }}>{ver.reserva}</p>}
                {ver.inferencia && (
                  <p className="dato silencio" style={{ margin: '6px 0 0' }}>
                    Esto lo dedujiste tú: no estaba escrito. Cuenta como inferencia.
                  </p>
                )}
              </div>
            )
          })()}

          <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
            {e.ultima.diag.dimensiones.map((d) => <Chip key={d} tono="verde">{d}</Chip>)}
            {e.ultima.diag.inferencias > 0 && (
              <Chip tono="verde">{e.ultima.diag.inferencias} inferencia(s)</Chip>
            )}
            {e.ultima.diag.combos.slice(0, casc.combosRevelados).map((c, i) => (
              <span key={i} className="aparece"><Chip tono="laton">{c.nombre} +{c.mult.toFixed(1)}×</Chip></span>
            ))}
          </div>

          {casc.terminada && e.ultima.impactos.map((im) => (
            <p key={im.uid} className="dato" style={{ margin: 0 }}>
              {im.nombre}: −{im.dano}{im.derribado ? ' · cae' : ''}{im.motivo ? ` · ${im.motivo}` : ''}
            </p>
          ))}
          {casc.terminada && e.ultima.parteEnemiga.length > 0 && (
            <ul className="parte">
              {e.ultima.parteEnemiga.map((p, i) => (
                <li key={i}>{p.texto}{p.dano > 0 && <span className="dato"> −{p.dano}</span>}</li>
              ))}
            </ul>
          )}
          <button
            className="btn primario" disabled={!casc.terminada}
            onClick={() => { setTrazoAbierto(null); on.continuar() }}
            style={{ alignSelf: 'flex-start' }}>
            {e.fase === 'ganado' ? 'El carril queda despejado'
              : e.fase === 'perdido' ? 'Cerrar la expedición' : 'Siguiente turno'}
          </button>
        </div>
      )}

      {/* -------------------------------- la mano ------------------------------ */}
      {!resuelto && (
        <>
          <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="eyebrow">Tu mano</span>
            <span className="silencio" style={{ fontSize: 12.5 }}>
              Arrastra al tablero. Doble clic en una pieza del tablero la devuelve.
            </span>
          </div>
          <div className="mano-naipes">
            {enMano.map((p) => (
              <div
                key={p.uid}
                className={`naipe naipe-${p.clase}${seleccion === p.uid ? ' activa' : ''}${e.reveladas.includes(p.uid) ? ' senalada' : ''}`}
                style={estiloDeCedula(cedulaDe(contenido, p))}
                data-ayuda={p.cuerpo.length > 190 ? p.cuerpo : undefined}
                draggable
                onDragStart={(ev) => { setArrastrando(p.uid); ev.dataTransfer.setData('text/plain', p.uid) }}
                onDragEnd={() => setArrastrando(null)}
                onClick={() => setSeleccion(seleccion === p.uid ? null : p.uid)}
              >
                <Naipe p={p} contenido={contenido} />
              </div>
            ))}
          </div>

          {piezaAbierta && (
            <div className="lupa">
              <span className="eyebrow">{ETIQUETA[piezaAbierta.clase]}</span>
              <strong style={{ fontSize: 16 }}>{piezaAbierta.titulo}</strong>
              {piezaAbierta.cuerpo && (
                <p className="serif-lectura" style={{ margin: 0 }}>{piezaAbierta.cuerpo}</p>
              )}
              {piezaAbierta.clase === 'caso' && piezaAbierta.distancia && (
                <span className="dato silencio">distancia {piezaAbierta.distancia}</span>
              )}
            </div>
          )}

          {seleccion && enMano.some((p) => p.uid === seleccion) && (
            <div className="pozo">
              <span className="eyebrow">
                El pozo · {enMano.find((p) => p.uid === seleccion)?.titulo}
              </span>
              <div className="fila">
                <button className="btn peligro" disabled={e.quemasRestantes <= 0}
                  onClick={() => { on.quemar(seleccion); setSeleccion(null) }}>
                  Quemar — «esto es falso»
                </button>
                <button className="btn fantasma" disabled={e.cambiosRestantes <= 0}
                  onClick={() => { on.cambiar(seleccion); setSeleccion(null) }}>
                  Cambiar — «es cierto, aquí no me sirve»
                </button>
              </div>
              <span className="silencio" style={{ fontSize: 12.5 }}>
                Quemar la retira de la expedición para siempre. Cambiar la devuelve al mazo
                y roba otra. Las dos cosas quedan registradas, y no dicen lo mismo de ti.
              </span>
            </div>
          )}

          <details className="tabla-jugadas">
            <summary>Herramientas y combos</summary>
            <table className="tabla">
              <tbody>
                {listaHerramientas.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontSize: 17 }}>{t.glifo}</td>
                    <td><strong>{t.nombre}</strong></td>
                    <td className="silencio">{t.afirma}</td>
                    <td className="dato">{t.dimension}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="silencio" style={{ fontSize: 12.5, margin: '10px 0 4px' }}>
              Los combos salen de que varios trazos compartan piezas: una pieza que sostiene
              tres afirmaciones da Articulación; un campo tejido por dentro da Cierre; un
              concepto identificado y además enlazado da Doble registro.
            </p>
            <p className="silencio" style={{ fontSize: 12.5, margin: 0 }}>
              Las relaciones escasas en este texto multiplican más:{' '}
              {Object.entries(contenido.frecuenciaRelacion).sort((a, b) => a[1] - b[1])
                .slice(0, 3).map(([t, n]) => `${t} (${n})`).join(' · ')}.
            </p>
          </details>

          <div className="fila">
            <button className="btn peligro fantasma" onClick={on.huir}>Abandonar la expedición</button>
            {objetivo && (
              <span className="silencio" style={{ fontSize: 12.5, alignSelf: 'center' }}>
                Al frente: {objetivo.nombre} — {tipoPorId(objetivo.tipoId).glosa}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

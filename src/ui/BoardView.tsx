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
import { LaneView } from './LaneView'
import { Chip } from './components'

export interface AccionesBatalla {
  cambio: (mut: (e: EstadoBatalla) => void) => void
  afirmar: () => void
  continuar: () => void
  quemar: (uid: string) => void
  cambiar: (uid: string) => void
  huir: () => void
}

const COLOR_ESTADO: Record<string, string> = {
  sostenido: 'var(--verdigris)', parcial: 'var(--laton)',
  silencio: 'var(--niebla)', invertido: 'var(--oxido)', error: 'var(--oxido)'
}

function Naipe({ p, compacto }: { p: Pieza; compacto?: boolean }) {
  const clase = p.clase === 'etiqueta' ? 'et'
    : p.clase === 'definicion' ? 'de'
    : p.clase === 'caso' ? 'ca'
    : p.clase === 'tesis' || p.clase === 'criterio' ? 'te'
    : p.clase === 'marco' ? 'ma'
    : p.clase === 'intuicion' ? 'in'
    : p.clase === 'subdimension' ? 'su' : 'co'
  return (
    <>
      <span className="tt">{ETIQUETA[p.clase]}</span>
      <span className="nom">{p.titulo}</span>
      {!compacto && p.cuerpo && <span className="cuerpo">{p.cuerpo}</span>}
      {p.umbral && <span className="marca">umbral</span>}
      <i className={`borde borde-${clase}`} />
    </>
  )
}

const ETIQUETA: Record<Pieza['clase'], string> = {
  etiqueta: 'Nombre', definicion: 'Descripción', concepto: 'Concepto',
  apocrifa: 'Concepto', caso: 'Caso', tesis: 'Tesis', criterio: 'Criterio',
  marco: 'Marco', intuicion: 'Intuición', subdimension: 'Atributo'
}

export function BoardView({ e, contenido, lentes, on, lucidez, lucidezMax }: {
  e: EstadoBatalla; contenido: Contenido; lentes: ModificadoresLente
  on: AccionesBatalla; lucidez: number; lucidezMax: number
}) {
  const lienzo = useRef<HTMLDivElement>(null)
  const [herramienta, setHerramienta] = useState<HerramientaId | null>(null)
  const [param, setParam] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<string[]>([])
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)

  const resuelto = e.fase !== 'jugando'
  const enMano = e.mano.filter((p) => !e.tablero.some((t) => t.uid === p.uid))
  const enTablero = e.tablero
    .map((t) => ({ t, p: e.mano.find((x) => x.uid === t.uid) }))
    .filter((x): x is { t: typeof x.t; p: Pieza } => !!x.p)

  const previa = useMemo(
    () => evaluarDiagrama(contenido, e.mano, e.trazos, lentes),
    [contenido, e.mano, e.trazos, lentes]
  )
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
    if (resuelto) return
    if (h) {
      setPendientes((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid])
      return
    }
    setSeleccion(seleccion === uid ? null : uid)
  }

  const cerrarTrazo = () => {
    if (!herramienta || !puedeCerrar) return
    on.cambio((st) => { trazar(st, herramienta, pendientes, param) })
    reset()
  }

  return (
    <div className="envoltura pila">
      <LaneView
        enemigos={e.enemigos} lucidez={lucidez} lucidezMax={lucidezMax}
        alcance={resuelto ? 0 : previa.alcance}
        gesto={resuelto ? (e.ultima && e.ultima.danoTotal > 0 ? 'afirma' : 'herido') : 'quieto'}
        ultimosImpactos={resuelto && e.ultima ? e.ultima.impactos : []}
      />

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
          on.cambio((st) => soltar(st, uid, x, y))
          setArrastrando(null)
        }}
      >
        {enTablero.length === 0 && (
          <p className="pista-lienzo">
            Arrastra piezas aquí. Después elige una herramienta y toca las piezas
            que quieras relacionar con ella.
          </p>
        )}

        <svg className="trazos" aria-hidden>
          {e.trazos.map((t) => {
            const pts = t.piezas
              .map((u) => e.tablero.find((x) => x.uid === u))
              .filter((x): x is NonNullable<typeof x> => !!x)
            if (pts.length < 1) return null
            const ver = previa.veredictos.find((v) => v.trazo.uid === t.uid)
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
              <g key={t.uid}>
                {pts.slice(0, -1).map((a, i) => {
                  const b = pts[i + 1]
                  return (
                    <line key={i} x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`}
                      stroke={color} strokeWidth="2.4"
                      strokeDasharray={t.tool === 'identidad' ? '3 3' : undefined}
                      markerEnd={tool.ordenada ? 'url(#punta)' : undefined} />
                  )
                })}
                {t.tool === 'tachon' && (
                  <text x={`${pts[0].x}%`} y={`${pts[0].y}%`} fill={color}
                    fontSize="26" textAnchor="middle" dominantBaseline="middle">✗</text>
                )}
              </g>
            )
          })}
          <defs>
            <marker id="punta" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0 0 L8 4 L0 8 z" fill="var(--verdigris)" />
            </marker>
          </defs>
        </svg>

        {enTablero.map(({ t, p }) => {
          const marcada = pendientes.includes(p.uid)
          const orden = pendientes.indexOf(p.uid)
          return (
            <div
              key={p.uid}
              className={`naipe en-tablero naipe-${p.clase}${marcada ? ' marcada' : ''}${seleccion === p.uid ? ' activa' : ''}`}
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
              draggable={!resuelto}
              onDragStart={() => setArrastrando(p.uid)}
              onDragEnd={() => setArrastrando(null)}
              onClick={() => tocarPieza(p.uid)}
              onDoubleClick={() => !resuelto && on.cambio((st) => devolverAMano(st, p.uid))}
              title="Arrastra para mover · doble clic para devolver a la mano"
            >
              {marcada && <span className="orden">{orden + 1}</span>}
              <Naipe p={p} compacto />
            </div>
          )
        })}
      </div>

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
                  onClick={() => on.cambio((st) => borrarTrazo(st, t.uid))}
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
          <div className="cuenta">
            <span className="fichas">{e.ultima.diag.fichas}</span>
            <span className="por">×</span>
            <span className="mult">{e.ultima.diag.mult.toFixed(1)}</span>
            <span className="por">=</span>
            <span className="total">{e.ultima.diag.dano}</span>
          </div>
          <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
            {e.ultima.diag.dimensiones.map((d) => <Chip key={d} tono="verde">{d}</Chip>)}
            {e.ultima.diag.combos.map((c, i) => (
              <Chip key={i} tono="laton">{c.nombre} +{c.mult.toFixed(1)}×</Chip>
            ))}
          </div>
          {e.ultima.diag.veredictos.map((v, i) => (
            <p key={i} className={`nota ${v.estado === 'sostenido' ? 'ok' : v.estado === 'silencio' ? 'nota' : 'mal'}`}>
              <strong>{HERRAMIENTAS[v.trazo.tool].glifo} {HERRAMIENTAS[v.trazo.tool].nombre}</strong>
              {' · '}{v.estado === 'sostenido' ? 'sostenido'
                : v.estado === 'parcial' ? 'a medias'
                : v.estado === 'silencio' ? 'el texto no lo dice'
                : v.estado === 'invertido' ? 'al revés' : 'derrumbe'}
              <br />{v.nota}
            </p>
          ))}
          {e.ultima.impactos.map((im) => (
            <p key={im.uid} className="dato" style={{ margin: 0 }}>
              {im.nombre}: −{im.dano}{im.derribado ? ' · cae' : ''}{im.motivo ? ` · ${im.motivo}` : ''}
            </p>
          ))}
          {e.ultima.parteEnemiga.length > 0 && (
            <ul className="parte">
              {e.ultima.parteEnemiga.map((p, i) => (
                <li key={i}>{p.texto}{p.dano > 0 && <span className="dato"> −{p.dano}</span>}</li>
              ))}
            </ul>
          )}
          <button className="btn primario" onClick={on.continuar} style={{ alignSelf: 'flex-start' }}>
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
                className={`naipe naipe-${p.clase}${seleccion === p.uid ? ' activa' : ''}`}
                draggable
                onDragStart={(ev) => { setArrastrando(p.uid); ev.dataTransfer.setData('text/plain', p.uid) }}
                onDragEnd={() => setArrastrando(null)}
                onClick={() => setSeleccion(seleccion === p.uid ? null : p.uid)}
              >
                <Naipe p={p} />
              </div>
            ))}
          </div>

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

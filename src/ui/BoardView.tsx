import { useMemo, useRef, useState } from 'react'
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
import { lentePorId, selloPorId, type SelloId } from '../engine/powers'
import { LaneView } from './LaneView'
import { GLOSA_RELACION as GLOSA } from './glosas'
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
  sostenido: 'var(--verdigris)', equivalente: 'var(--verdigris)', derivado: '#7fa8d6',
  aproximado: 'var(--laton)', plausible: '#7a6fb0', silencio: 'var(--niebla)',
  invertido: 'var(--oxido)', error: 'var(--oxido)'
}
const ETIQUETA_ESTADO: Record<string, string> = {
  sostenido: 'sostenido', equivalente: 'lo mismo dicho al revés',
  derivado: 'se sigue del texto', aproximado: 'vas bien, otro matiz',
  plausible: 'razonable, el texto no lo dice', silencio: 'el texto no lo dice',
  invertido: 'al revés', error: 'falla'
}
const TONO_NOTA: Record<string, string> = {
  sostenido: 'ok', equivalente: 'ok', derivado: 'ok', aproximado: 'nota',
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

const ayudaDe = (p: Pieza) =>
  `${ETIQUETA[p.clase].toUpperCase()} · ${p.titulo}${p.cuerpo ? `\n\n${p.cuerpo}` : ''}`

export function BoardView({ e, contenido, lentes, on, lucidez, lucidezMax, lentesIds }: {
  e: EstadoBatalla; contenido: Contenido; lentes: ModificadoresLente
  on: AccionesBatalla; lucidez: number; lucidezMax: number; lentesIds: string[]
}) {
  const lienzo = useRef<HTMLDivElement>(null)
  const [herramienta, setHerramienta] = useState<HerramientaId | null>(null)
  const [param, setParam] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<string[]>([])
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [trazoAbierto, setTrazoAbierto] = useState<string | null>(null)
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
  const piezaSel = enMano.find((p) => p.uid === seleccion) ?? null

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
    <div className="batalla" onMouseMove={seguirRaton} onMouseLeave={() => setAyuda(null)}>
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

      {ayuda && (
        <div
          className={`globo${ayuda.y > window.innerHeight / 2 ? ' arriba' : ' abajo'}`}
          style={{ left: ayuda.x, top: ayuda.y }}
          role="tooltip"
        >{ayuda.texto}</div>
      )}
      {/* ============================ carril ============================ */}
      <div className="zona-carril">
        <LaneView
          enemigos={e.enemigos} lucidez={lucidez} lucidezMax={lucidezMax}
          alcance={resuelto ? 0 : previa.alcance}
          gesto={resuelto && casc.terminada
            ? (e.ultima && e.ultima.danoTotal > 0 ? 'afirma' : 'herido') : 'quieto'}
          ultimosImpactos={resuelto && casc.terminada && e.ultima ? e.ultima.impactos : []}
          disparoListo={resuelto && casc.terminada}
          disparo={resuelto && casc.terminada && e.ultima ? e.ultima.disparo : null}
        />
      </div>

      {/* ========================= herramientas ========================= */}
      <aside className="zona-herramientas">
        <span className="eyebrow">Herramientas</span>
        {listaHerramientas.map((t) => {
          const quedan = e.herramientas.filter((x) => x === t.id).length -
            e.usadas.filter((x) => x === t.id).length
          const disponible = libres.includes(t.id) && !resuelto
          return (
            <button
              key={t.id}
              className={`herr-v${herramienta === t.id ? ' activa' : ''}`}
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

        <div className="separador" />
        <span className="eyebrow">Pasivas</span>
        {lentesIds.length === 0 && <span className="silencio dato">ninguna</span>}
        {lentesIds.map((id) => {
          const l = lentePorId(id)
          return (
            <span key={id} className="pastilla ancha" data-ayuda={`${l.nombre.toUpperCase()}\n${l.regla}\n\n${l.costo}`}>
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
      <main className="zona-lienzo">
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
                  {resuelto && ver && (
                    <text x={`${(pts[0].x + pts[pts.length - 1].x) / 2}%`}
                      y={`${(pts[0].y + pts[pts.length - 1].y) / 2 - 3}%`}
                      fill={color} fontSize="11" textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)' }}>
                      {ver.estado === 'sostenido' ? '✓' : ver.estado === 'equivalente' ? '✓ ='
                        : ver.estado === 'derivado' ? '✓ se sigue' : ver.estado === 'aproximado' ? '≈'
                        : ver.estado === 'plausible' ? '~' : ver.estado === 'invertido' ? '↺' : '·'}
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
            const inservible = !!h && !pendientes.includes(p.uid) &&
              !aceptaEnRanura(h.id, pendientes.length, p)
            const cd = cedulaDe(contenido, p)
            return (
              <div
                key={p.uid}
                className={`naipe en-tablero naipe-${p.clase}${marcada ? ' marcada' : ''}` +
                  `${e.reveladas.includes(p.uid) ? ' senalada' : ''}` +
                  `${enFoco ? ' en-foco' : trazoAbierto ? ' fuera-de-foco' : ''}` +
                  `${inservible ? ' inservible' : ''}`}
                style={{ left: `${t.x}%`, top: `${t.y}%`, ...estiloDeCedula(cd) }}
                draggable={!resuelto}
                onDragStart={() => setArrastrando(p.uid)}
                onDragEnd={() => setArrastrando(null)}
                onClick={() => tocarPieza(p.uid)}
                onDoubleClick={() => pedirDevolver(p.uid)}
                onMouseEnter={() => herramienta && !inservible && setPrevisualizada(p.uid)}
                onMouseLeave={() => setPrevisualizada((x) => (x === p.uid ? null : x))}
                data-ayuda={ayudaDe(p)}
              >
                {marcada && <span className="orden">{orden + 1}</span>}
                <span className="tt">{ETIQUETA[p.clase]}<span className="orn">{cd.ornamento}</span></span>
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
              {casc.total !== null && (<><span className="por">=</span><span className="total">{casc.total}</span></>)}
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
            </div>
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
      <aside className="zona-mano">
        <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="eyebrow">Mano</span>
          <span className="dato silencio">mazo {e.mazo.length}</span>
        </div>
        <div className="lista-mano">
          {enMano.map((p) => {
            const cd = cedulaDe(contenido, p)
            return (
              <div
                key={p.uid}
                className={`renglon${seleccion === p.uid ? ' activa' : ''}${e.reveladas.includes(p.uid) ? ' senalada' : ''}`}
                style={{ borderLeftColor: cd.banda, background: cd.tono }}
                draggable={!resuelto}
                onDragStart={(ev) => { setArrastrando(p.uid); ev.dataTransfer.setData('text/plain', p.uid) }}
                onDragEnd={() => setArrastrando(null)}
                onClick={() => { setSeleccion(seleccion === p.uid ? null : p.uid); despertarAudio() }}
                data-ayuda={ayudaDe(p)}
              >
                <span className="tt">{ETIQUETA[p.clase]}<span className="orn">{cd.ornamento}</span></span>
                <span className="nom">{recorte(p.titulo, 40)}</span>
                {cd.canto && <span className="marca">umbral</span>}
              </div>
            )
          })}
        </div>
      </aside>

      {/* ============================ acciones ============================ */}
      <footer className="zona-acciones">
        {!resuelto ? (
          <>
            <button className="btn primario grande" onClick={on.afirmar} disabled={e.trazos.length === 0}>
              Afirmar el diagrama {e.trazos.length > 0 && <span className="dato">· {e.trazos.length} trazos</span>}
            </button>
            <button
              className="btn peligro" disabled={!piezaSel || e.quemasRestantes <= 0}
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
              data-ayuda="Toca para deshacer este trazo y recuperar su herramienta">
              {HERRAMIENTAS[t.tool].glifo}{t.param ? ` ${t.param.split('::').pop()}` : ''} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

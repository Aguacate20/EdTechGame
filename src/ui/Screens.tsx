import { useLayoutEffect, useRef, useState } from 'react'
import type { Contenido } from '../content/types'
import { lentePorId, selloPorId } from '../engine/powers'
import { HERRAMIENTAS, type HerramientaId } from '../engine/tools'
import type { SelloId } from '../engine/powers'
import { RUTAS, type Acto, type Nodo, type Recompensa, type Ruta } from '../engine/route'
import { coberturaAtlas, nivelDe, type Atlas } from '../engine/atlas'
import { unidadesSelladas, edicionCriticaDisponible } from '../engine/objectives'
import { descargarEdicion } from '../engine/export'
import { Chip, Panel } from './components'

/* --------------------------------- grafo ---------------------------------- */

export function MapView({ ruta, acto, alcanzables, visitados, actual, onElegir, contenido, atlas, lentes }: {
  ruta: Ruta; acto: Acto; alcanzables: string[]; visitados: string[]; actual: string | null
  onElegir: (n: Nodo) => void; contenido: Contenido; atlas: Atlas; lentes: string[]
}) {
  const cont = useRef<HTMLDivElement>(null)
  const [hilos, setHilos] = useState<{ x1: number; y1: number; x2: number; y2: number; activo: boolean }[]>([])
  const selladas = unidadesSelladas(atlas, contenido)

  useLayoutEffect(() => {
    const c = cont.current
    if (!c) return
    const base = c.getBoundingClientRect()
    const nuevos: typeof hilos = []
    for (const col of acto.columnas) {
      for (const n of col) {
        const a = c.querySelector<HTMLElement>(`[data-nodo="${n.id}"]`)
        if (!a) continue
        const ra = a.getBoundingClientRect()
        for (const sid of n.salidas) {
          const b = c.querySelector<HTMLElement>(`[data-nodo="${sid}"]`)
          if (!b) continue
          const rb = b.getBoundingClientRect()
          nuevos.push({
            x1: ra.right - base.left, y1: ra.top + ra.height / 2 - base.top,
            x2: rb.left - base.left, y2: rb.top + rb.height / 2 - base.top,
            activo: visitados.includes(n.id) && alcanzables.includes(sid)
          })
        }
      }
    }
    setHilos(nuevos)
  }, [acto, visitados, alcanzables])

  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">
          Acto {acto.index + 1} de {ruta.actos.length} · semilla {ruta.semilla}
        </span>
        <h2 className="display" style={{ fontSize: 30 }}>{acto.titulo}</h2>
        <p className="silencio" style={{ margin: 0, fontSize: 14 }}>
          Dificultad objetivo {acto.dificultadObjetivo.toFixed(2)} · mano de {acto.manoSugerida}
        </p>
      </div>

      <div className="sellos">
        {contenido.unidades.map((u) => (
          <span key={u.id} className={`sello-unidad${selladas.includes(u.id) ? ' puesto' : ''}`}>
            {selladas.includes(u.id) ? '✓ ' : ''}{u.numero}. {u.titulo.slice(0, 26)}
          </span>
        ))}
      </div>

      <div className="grafo" ref={cont}>
        <svg className="hilos" aria-hidden>
          {hilos.map((h, i) => (
            <path
              key={i}
              d={`M${h.x1} ${h.y1} C ${h.x1 + 22} ${h.y1}, ${h.x2 - 22} ${h.y2}, ${h.x2} ${h.y2}`}
              fill="none"
              stroke={h.activo ? 'var(--verdigris)' : 'var(--tinta-borde)'}
              strokeWidth={h.activo ? 2 : 1.2}
              strokeDasharray={h.activo ? undefined : '4 5'}
            />
          ))}
        </svg>
        <div className="columnas">
          {acto.columnas.map((col, i) => (
            <div className="columna" key={i}>
              {col.map((n) => {
                const puede = alcanzables.includes(n.id) && !visitados.includes(n.id)
                const r = RUTAS[n.etiquetaRuta]
                const dif = n.dificultad
                return (
                  <button
                    key={n.id} data-nodo={n.id}
                    className={`nodo-g ruta-${n.etiquetaRuta}${visitados.includes(n.id) ? ' visitado' : ''}${actual === n.id ? ' actual' : ''}`}
                    disabled={!puede} onClick={() => onElegir(n)}
                  >
                    <span className="tipo">
                      {n.tipo === 'jefe' ? 'Jefe final'
                        : n.tipo === 'refugio' ? 'Refugio' : r.nombre}
                    </span>
                    <span className="nom">
                      {n.tipo === 'refugio' ? 'Alto en el camino'
                        : dif === 'jefe' ? 'El Tratado'
                        : dif === 'dura' ? 'Oleada dura'
                        : dif === 'media' ? 'Oleada media' : 'Oleada ligera'}
                    </span>
                    <span className="det">{n.tipo === 'oleada' || n.tipo === 'jefe' ? r.promesa : r.riesgo}</span>
                    {n.temas.length > 0 && (
                      <span className="temas">{n.temas.join(' · ')}</span>
                    )}
                    {n.dominios.length > 0 && (
                      <span className="dominios-nodo">se usa en {n.dominios.join(' · ')}</span>
                    )}
                    {n.minutos > 0 && <span className="dato silencio">≈ {n.minutos} min</span>}
                    {n.casos.length > 0 && <span style={{ marginTop: 4 }}><Chip tono="laton">trae caso</Chip></span>}
                    {n.tesis.length > 0 && <span style={{ marginTop: 4 }}><Chip tono="laton">trae tesis</Chip></span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="silencio" style={{ fontSize: 13, maxWidth: 700 }}>
        Tus lentes: {lentes.map((l) => lentePorId(l).nombre).join(' · ') || 'ninguna'}.
        La ruta decide qué material enfrentas; tus herramientas deciden qué puedes afirmar con él.
        Una unidad se sella cuando todos sus conceptos tienen evidencia — atravesarla no basta.
      </p>
    </div>
  )
}

/* ------------------------------- recompensa ------------------------------- */

export function RewardView({ opciones, onElegir, titulo, contenido, veta }: {
  opciones: Recompensa[]; onElegir: (r: Recompensa) => void; titulo: string
  contenido: Contenido
  /** apareció una cuarta opción rara: se anuncia, para que se note cuando pasa */
  veta?: boolean
}) {
  const describir = (r: Recompensa): { tt: string; nom: string; cuerpo: string; pie?: string } => {
    switch (r.tipo) {
      case 'lente': {
        const l = lentePorId(r.id)
        return { tt: `Lente · ${l.rareza}`, nom: l.nombre, cuerpo: l.regla, pie: l.costo }
      }
      case 'sello': {
        const x = selloPorId(r.id)
        return { tt: 'Sello · un uso por combate', nom: `${x.glifo} ${x.nombre}`, cuerpo: x.efecto }
      }
      case 'herramienta': {
        const h = HERRAMIENTAS[r.id]
        return {
          tt: 'Herramienta', nom: `${h.glifo} ${h.nombre}`,
          cuerpo: `Una más por turno. ${h.afirma}`, pie: h.ejemplo
        }
      }
      case 'relacion':
        return {
          tt: 'Carta de relación', nom: r.tipoRelacion,
          cuerpo: `Aparece ${contenido.frecuenciaRelacion[r.tipoRelacion] ?? 0} veces en este texto, así que multiplica ${(contenido.frecuenciaRelacion[r.tipoRelacion] ?? 0) <= 3 ? 'mucho' : 'poco'}.`
        }
      case 'caso': {
        const e = contenido.escenarios.find((x) => x.id === r.id) ?? contenido.casos.find((x) => x.id === r.id)
        return {
          tt: 'Caso', nom: (e && 'dominio' in e ? e.dominio : '') || 'Caso nuevo',
          cuerpo: e?.descripcion ?? ''
        }
      }
      case 'tesis': {
        const t = contenido.tesis.find((x) => x.id === r.id)
        return { tt: 'Tesis', nom: 'Tesis y sus criterios', cuerpo: t?.enunciado ?? '' }
      }
      case 'fichero':
        return {
          tt: 'Fichero', nom: 'Ampliar el fichero',
          cuerpo: 'Robas una carta más cada turno durante el resto de la expedición.'
        }
      default:
        return { tt: 'Descanso', nom: `Recuperas ${r.cantidad} de lucidez`, cuerpo: 'Volver entero también es una decisión.' }
    }
  }

  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">Hallazgo</span>
        <h2 className="display" style={{ fontSize: 28 }}>{titulo}</h2>
        {veta && (
          <p className="aviso-veta">
            ✦ Una veta. Aquí había algo que no siempre está.
          </p>
        )}
      </div>

      <div className="mano-naipes" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        {opciones.map((r, i) => {
          const d = describir(r)
          const esVeta = veta && i === opciones.length - 1
          return (
            <button
              key={i} className={`naipe${esVeta ? ' veta' : ''}`}
              onClick={() => onElegir(r)} style={{ minHeight: 160 }}
            >
              <span className="tt">{d.tt}</span>
              <span className="nom">{d.nom}</span>
              <span className="cuerpo">{d.cuerpo}</span>
              {d.pie && <span className="cuerpo" style={{ fontStyle: 'italic', opacity: .8 }}>{d.pie}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* -------------------------------- refugio --------------------------------- */

export function CampfireView({
  cartera, fusionados, contenido, onDescansar, onSoltarLente, lucidez, lucidezMax,
  dominios, onReflexionar
}: {
  dominios: string[]
  onReflexionar: (dominio: string) => void
  cartera: {
    lentes: string[]; sellos: SelloId[]
    herramientas: HerramientaId[]; relaciones: string[]
  }
  fusionados: string[]; contenido: Contenido
  onDescansar: () => void; onSoltarLente: (id: string) => void
  lucidez: number; lucidezMax: number
}) {
  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">Refugio</span>
        <h2 className="display" style={{ fontSize: 28 }}>Un alto para revisar</h2>
        <p className="silencio" style={{ maxWidth: 660, fontSize: 14 }}>
          Recupera lucidez, o suelta una lente que no encaja con lo que te está tocando.
          Una lente mal elegida te empuja a buscar en el texto lo que el texto no tiene.
        </p>
      </div>

      {dominios.length > 0 && (
        <Panel titulo="¿Dónde te serviría lo que acabas de ver?">
          <p className="silencio" style={{ fontSize: 13.5, margin: '0 0 10px' }}>
            Un toque. No hay respuesta correcta: sirve para que el cierre no sea solo
            seguir andando.
          </p>
          <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
            {dominios.map((d) => (
              <button key={d} className="apuesta" onClick={() => onReflexionar(d)}>{d}</button>
            ))}
          </div>
        </Panel>
      )}

      <div className="fila">
        <button className="btn primario" onClick={onDescansar}>
          Descansar · recuperas lucidez ({lucidez}/{lucidezMax})
        </button>
      </div>

      <Panel titulo="Tus lentes">
        <div className="rejilla">
          {cartera.lentes.map((id) => {
            const l = lentePorId(id)
            return (
              <button className="celda" key={id} onClick={() => onSoltarLente(id)}
                style={{ textAlign: 'left', cursor: 'pointer', color: 'inherit', background: 'transparent' }}>
                <strong>{l.nombre}</strong>
                <p className="silencio" style={{ fontSize: 13, margin: '4px 0 0' }}>{l.regla}</p>
                <p className="silencio" style={{ fontSize: 12, margin: '4px 0 0', fontStyle: 'italic' }}>{l.costo}</p>
                <p className="dato" style={{ margin: '6px 0 0' }}>toca para soltarla</p>
              </button>
            )
          })}
          {cartera.lentes.length === 0 && <p className="silencio">Sin lentes: el diagrama puntúa a pelo.</p>}
        </div>
      </Panel>

      <Panel titulo="Tu equipo">
        <p style={{ margin: '0 0 8px' }}>
          <strong>Herramientas:</strong>{' '}
          {[...new Set(cartera.herramientas)].map((h) => `${HERRAMIENTAS[h].glifo} ${HERRAMIENTAS[h].nombre} ×${cartera.herramientas.filter((x) => x === h).length}`).join(' · ')}
        </p>
        <p style={{ margin: '0 0 8px' }}>
          <strong>Sellos:</strong>{' '}
          {cartera.sellos.length
            ? cartera.sellos.map((s) => `${selloPorId(s).glifo} ${selloPorId(s).nombre}`).join(' · ')
            : 'ninguno'}
        </p>
        <p style={{ margin: '0 0 8px' }}>
          <strong>Relaciones:</strong>{' '}
          {[...new Set(cartera.relaciones)].map((r) => `${r} ×${cartera.relaciones.filter((x) => x === r).length}`).join(' · ') || 'ninguna'}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Conceptos fusionados:</strong>{' '}
          {fusionados.length
            ? fusionados.map((id) => contenido.conceptos[id]?.titulo ?? id).join(' · ')
            : 'todavía ninguno. Empareja nombre y descripción con la Identidad y la carta se vuelve una sola.'}
        </p>
      </Panel>
    </div>
  )
}

/* --------------------------------- atlas ---------------------------------- */

export function AtlasView({ atlas, contenido, onVolver }: {
  atlas: Atlas; contenido: Contenido; onVolver: () => void
}) {
  const cob = coberturaAtlas(atlas, contenido)
  const calib = atlas.apuestasTotales
    ? Math.round((atlas.apuestasCalibradas / atlas.apuestasTotales) * 100) : null
  const selladas = unidadesSelladas(atlas, contenido)
  const completo = edicionCriticaDisponible(atlas, contenido)

  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">Atlas · {contenido.fuente}</span>
        <h2 className="display" style={{ fontSize: 30 }}>El mapa que llevas reconstruido</h2>
        <p className="silencio" style={{ fontSize: 14, maxWidth: 660 }}>
          Esto no es un puntaje. Es el mapa del texto tal como lo has sostenido tú: firme
          donde acertaste desde varios ángulos, borroso donde todavía no.
        </p>
      </div>

      <div className="fila">
        {[
          ['Cobertura', `${cob.pct}%`, ''],
          ['Vínculos trazados', `${cob.aristas}`, `/${contenido.aristas.length}`],
          ['Unidades selladas', `${selladas.length}`, `/${contenido.unidades.length}`],
          ['Calibración', calib === null ? '—' : `${calib}%`, ''],
          ['Expediciones', `${atlas.victorias}`, `/${atlas.runs}`]
        ].map(([t, v, s]) => (
          <div className="celda" key={t} style={{ flex: '1 1 150px' }}>
            <span className="eyebrow">{t}</span>
            <div style={{ fontSize: 28, fontFamily: 'var(--mono)' }}>
              {v}<span className="silencio" style={{ fontSize: 15 }}>{s}</span>
            </div>
          </div>
        ))}
      </div>

      <Panel titulo={completo ? 'Edición crítica desbloqueada' : 'Edición crítica'}>
        <p className="silencio" style={{ margin: '0 0 12px', fontSize: 14 }}>
          {completo
            ? 'Sellaste todas las unidades. Puedes exportar el mapa completo con su evidencia y las páginas de origen.'
            : `Sella las ${contenido.unidades.length} unidades para exportar el mapa completo. Llevas ${selladas.length}.`}
        </p>
        <button className="btn primario" disabled={!completo} onClick={() => descargarEdicion(atlas, contenido)}>
          Descargar la edición crítica
        </button>
      </Panel>

      <Panel titulo="Conceptos">
        <div className="rejilla">
          {contenido.ordenConceptos.map((id) => {
            const c = contenido.conceptos[id]
            if (!c) return null
            const n = nivelDe(atlas.conceptos[id])
            return (
              <div className="celda" key={id}>
                <div className="fila" style={{ justifyContent: 'space-between', gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>{c.titulo}</strong>
                  {c.esUmbral && <Chip tono="laton">umbral</Chip>}
                </div>
                <p className="silencio" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
                  {n === 0 ? 'sin evidencia todavía' : n === 1 ? 'reconocido'
                    : n === 2 ? 'sostenido desde dos ángulos'
                    : 'dominado: recuperas, distingues y relacionas'}
                </p>
                <div className="barrita"><span style={{ width: `${(n / 3) * 100}%` }} /></div>
              </div>
            )
          })}
        </div>
      </Panel>

      {atlas.repertoriosEstabilizados.length > 0 && (
        <Panel titulo="Intuiciones estabilizadas">
          <div className="rejilla">
            {atlas.repertoriosEstabilizados.map((rid) => {
              const r = contenido.repertorios.find((x) => x.id === rid)
              if (!r) return null
              return (
                <div className="celda" key={rid}>
                  <strong style={{ fontSize: 14 }}>{r.etiqueta}</strong>
                  <p className="silencio" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
                    Funciona en: {r.contextoDondeFunciona}
                  </p>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {Object.keys(atlas.aristas).length > 0 && (
        <Panel titulo="Vínculos que has sostenido">
          <table className="tabla">
            <thead><tr><th>Desde</th><th>Vínculo</th><th>Hacia</th><th>Veces</th></tr></thead>
            <tbody>
              {Object.values(atlas.aristas).map((a, i) => (
                <tr key={i}>
                  <td>{contenido.conceptos[a.from]?.titulo ?? a.from}</td>
                  <td><Chip tono="verde">{a.tipo}</Chip></td>
                  <td>{contenido.conceptos[a.to]?.titulo ?? a.to}</td>
                  <td className="dato">{a.aciertos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <div className="fila"><button className="btn primario" onClick={onVolver}>Volver</button></div>
    </div>
  )
}

/* --------------------------------- final ---------------------------------- */

export function EndView({ victoria, atlas, contenido, onReiniciar, onAtlas }: {
  victoria: boolean; atlas: Atlas; contenido: Contenido
  onReiniciar: () => void; onAtlas: () => void
}) {
  const cob = coberturaAtlas(atlas, contenido)
  const selladas = unidadesSelladas(atlas, contenido)
  const completo = edicionCriticaDisponible(atlas, contenido)
  return (
    <div className="envoltura pila" style={{ maxWidth: 720 }}>
      <span className="eyebrow">{victoria ? 'Expedición completa' : 'La expedición se interrumpe'}</span>
      <h2 className="display">
        {victoria ? 'El Archivo queda estabilizado' : 'Te quedas sin lucidez'}
      </h2>
      <p className="serif-lectura silencio">
        {victoria
          ? 'Recorriste el grafo entero y sostuviste sus vínculos.'
          : 'La expedición termina, pero el Atlas conserva todo lo que sostuviste. Nada de lo aprendido se pierde al perder.'}
      </p>
      <p className="dato">
        Atlas {cob.pct}% · {cob.aristas} vínculos · {selladas.length}/{contenido.unidades.length} unidades selladas
      </p>
      {completo && (
        <div className="panel">
          <span className="eyebrow">Bonus</span>
          <p style={{ margin: '6px 0 12px' }}>
            Sellaste el texto completo. La edición crítica está disponible: tu mapa conceptual
            con la evidencia y las páginas de origen.
          </p>
          <button className="btn primario" onClick={() => descargarEdicion(atlas, contenido)}>
            Descargar la edición crítica
          </button>
        </div>
      )}
      <div className="fila">
        <button className="btn primario" onClick={onReiniciar}>Nueva expedición</button>
        <button className="btn fantasma" onClick={onAtlas}>Ver el Atlas</button>
      </div>
    </div>
  )
}

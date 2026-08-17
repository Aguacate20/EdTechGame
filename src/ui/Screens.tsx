import { useLayoutEffect, useRef, useState } from 'react'
import type { Contenido } from '../content/types'
import { instrumentoPorId, porId, type EfectoInstrumento } from '../engine/cards'
import { ARQUETIPOS, condicionPorId } from '../engine/encounters'
import { esIntuicion, etiquetaIntuicion } from '../engine/intuition'
import { RUTAS, type Acto, type Nodo, type Recompensa, type Ruta } from '../engine/route'
import { coberturaAtlas, nivelDe, type Atlas } from '../engine/atlas'
import { OBJETIVOS, unidadesSelladas, edicionCriticaDisponible, type Objetivo } from '../engine/objectives'
import { descargarEdicion } from '../engine/export'
import { Chip, Panel } from './components'

/* ------------------------------ plan de ruta ------------------------------ */

export function ObjectiveView({ onElegir, contenido }: {
  onElegir: (o: Objetivo) => void; contenido: Contenido
}) {
  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">Antes de entrar</span>
        <h2 className="display" style={{ fontSize: 30 }}>¿Qué vienes a hacer con este texto?</h2>
        <p className="silencio serif-lectura" style={{ maxWidth: 640 }}>
          Tu mazo decide qué puedes demostrar. Elegir plan y construir mazo terminan siendo
          la misma decisión, así que conviene elegir antes de que el mapa te empuje.
        </p>
      </div>
      <div className="fila">
        {OBJETIVOS.map((o) => (
          <button key={o.id} className="objetivo-card" onClick={() => onElegir(o)}>
            <span className="eyebrow">{o.dimensiones.join(' · ')}</span>
            <span className="nom">{o.nombre}</span>
            <span className="silencio" style={{ fontSize: 13.5 }}>{o.promesa}</span>
            <span className="silencio" style={{ fontSize: 12.5, fontStyle: 'italic' }}>{o.costo}</span>
            <span className="dato silencio" style={{ marginTop: 6 }}>
              empiezas con {o.cartasIniciales.map((c) => porId(c).nombre).join(' + ')} y {instrumentoPorId(o.instrumentoInicial).nombre}
            </span>
          </button>
        ))}
      </div>
      <p className="silencio dato">
        {Object.keys(contenido.conceptos).length} conceptos · {contenido.aristas.length} vínculos · {contenido.unidades.length} unidades
      </p>
    </div>
  )
}

/* --------------------------------- grafo ---------------------------------- */

export function MapView({ ruta, acto, alcanzables, visitados, actual, onElegir, contenido, atlas }: {
  ruta: Ruta; acto: Acto; alcanzables: string[]; visitados: string[]; actual: string | null
  onElegir: (n: Nodo) => void; contenido: Contenido; atlas: Atlas
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
                const cond = n.condicion ? condicionPorId(n.condicion) : null
                const arqs = n.arquetipos.map((a) => ARQUETIPOS[a].nombre)
                return (
                  <button
                    key={n.id} data-nodo={n.id}
                    className={`nodo-g ruta-${n.etiquetaRuta}${visitados.includes(n.id) ? ' visitado' : ''}${actual === n.id ? ' actual' : ''}`}
                    disabled={!puede} onClick={() => onElegir(n)}
                  >
                    <span className="tipo">
                      {n.tipo === 'jefe' ? 'Jefe final' : n.tipo === 'elite' ? 'Élite'
                        : n.tipo === 'refugio' ? 'Refugio' : n.tipo === 'taller' ? 'Taller' : r.nombre}
                    </span>
                    <span className="nom">
                      {n.tipo === 'refugio' ? 'Alto en el camino'
                        : n.tipo === 'taller' ? 'Taller de verbos'
                        : arqs.slice(0, 2).join(' + ') || 'Frente'}
                    </span>
                    <span className="det">{n.tipo === 'combate' || n.tipo === 'elite' || n.tipo === 'jefe' ? r.promesa : r.riesgo}</span>
                    {cond && <span style={{ marginTop: 4 }}><Chip tono="laton">{cond.nombre}</Chip></span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="silencio" style={{ fontSize: 13, maxWidth: 700 }}>
        La ruta decide qué contenido enfrentas; tu mazo decide si estás preparado.
        Una unidad se sella cuando todos sus conceptos tienen evidencia — atravesarla no basta.
      </p>
    </div>
  )
}

/* ------------------------------- recompensa ------------------------------- */

export function RewardView({ opciones, onElegir, titulo }: {
  opciones: Recompensa[]; onElegir: (r: Recompensa) => void; titulo: string
}) {
  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">Hallazgo</span>
        <h2 className="display" style={{ fontSize: 28 }}>{titulo}</h2>
      </div>
      <div className="mano" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {opciones.map((r, i) => {
          const c = r.tipo === 'verbo' || r.tipo === 'mejora' ? porId(r.cardId) : null
          const ins = r.tipo === 'instrumento' ? instrumentoPorId(r.id) : null
          return (
            <button key={i} className="ficha" onClick={() => onElegir(r)} style={{ minHeight: 150 }}>
              <span className="tt">
                {r.tipo === 'verbo' ? 'Verbo nuevo' : r.tipo === 'mejora' ? 'Mejora de verbo'
                  : r.tipo === 'instrumento' ? (ins?.maldito ? 'Instrumento maldito' : 'Instrumento') : 'Descanso'}
              </span>
              <span className="nom">
                {c?.nombre ?? ins?.nombre ?? `Recuperas ${r.tipo === 'lucidez' ? r.cantidad : ''} de lucidez`}
              </span>
              <span className="cuerpo">
                {c?.glosa ?? ins?.regla ?? 'Cerrar los ojos un momento también es una decisión.'}
              </span>
              {ins && <span className="cuerpo silencio" style={{ fontStyle: 'italic' }}>{ins.costo}</span>}
              {r.tipo === 'mejora' && <span className="cuerpo silencio">Sustituye a {porId(r.reemplaza).nombre}.</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* -------------------------------- refugio --------------------------------- */

export function CampfireView({ mazo, instrumentos, onDescansar, onRetirar, lucidez, lucidezMax, contenido }: {
  mazo: string[]; instrumentos: EfectoInstrumento[]; contenido: Contenido
  onDescansar: () => void; onRetirar: (cardId: string) => void
  lucidez: number; lucidezMax: number
}) {
  const intuiciones = mazo.filter(esIntuicion).length
  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">Refugio</span>
        <h2 className="display" style={{ fontSize: 28 }}>Un alto para revisar</h2>
        <p className="silencio" style={{ maxWidth: 640, fontSize: 14 }}>
          Recupera lucidez o retira un verbo. Un mazo más corto llega antes a la jugada
          que quieres: depurar es la mejor decisión que casi nadie toma a tiempo.
          {intuiciones > 0 && ' Las intuiciones no se retiran aquí: solo se van reconociendo dónde funcionaban.'}
        </p>
      </div>

      <div className="fila">
        <button className="btn primario" onClick={onDescansar}>
          Descansar · recuperas lucidez ({lucidez}/{lucidezMax})
        </button>
      </div>

      <Panel titulo="Tu mazo">
        <div className="mano">
          {mazo.map((id, i) => {
            const intu = esIntuicion(id)
            const c = porId(id)
            const et = intu ? etiquetaIntuicion(contenido, id) : null
            return (
              <button
                key={`${id}-${i}`} className={`ficha${intu ? ' intuicion' : ''}`}
                disabled={intu} onClick={() => onRetirar(id)}
              >
                <span className="tt">
                  {intu ? 'Asunto pendiente' : c.familias.length ? `Familia ${c.familias.join('/')}` : 'Utilidad'}
                </span>
                <span className="nom">{et?.nombre ?? c.nombre}</span>
                <span className="cuerpo">{et?.glosa ?? c.glosa}</span>
                {!intu && <span className="cuerpo silencio">Toca para retirarlo del mazo.</span>}
              </button>
            )
          })}
        </div>
      </Panel>

      {instrumentos.length > 0 && (
        <Panel titulo="Instrumentos">
          <div className="rejilla">
            {instrumentos.map((id) => {
              const ins = instrumentoPorId(id)
              return (
                <div className="celda" key={id}>
                  <strong>{ins.nombre}</strong>
                  <p className="silencio" style={{ fontSize: 13, margin: '4px 0 0' }}>{ins.regla}</p>
                </div>
              )
            })}
          </div>
        </Panel>
      )}
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

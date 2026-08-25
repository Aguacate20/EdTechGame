import { useMemo } from 'react'
import type { Contenido } from '../content/types'
import type { Hallazgos } from '../engine/battle'
import { tipoPorId } from '../engine/lane'
import { estiloRelacion } from './identity'
import { nivelDe, type Atlas } from '../engine/atlas'

/* ==========================================================================
   El mapa del combate.
   Los aciertos se acumulan turno a turno: si en el primer turno sostuviste
   «A extiende B» y en el tercero «B ejemplifica C», aquí aparece la cadena
   entera. Lo que no se sostuvo no entra: este mapa es lo que quedó en pie.
   ========================================================================== */

const COLOR: Record<string, string> = {
  sostenido: '#5fa78f', equivalente: '#5fa78f', compatible: '#5fa78f', derivado: '#7fa8d6'
}

interface Nodo { id: string; titulo: string; x: number; y: number }

/** Disposición por fuerzas: los conceptos enlazados se atraen y todos se
 *  repelen, así una cadena se dibuja como cadena y no como anillo. Es
 *  determinista (arranque en círculo, sin azar) y cabe en 5 ms. */
function disponer(
  ids: string[], vinculos: { from: string; to: string }[], grupos: string[][]
): Map<string, { x: number; y: number }> {
  const n = ids.length
  const pos = new Map<string, { x: number; y: number }>()
  ids.forEach((id, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2
    pos.set(id, { x: 50 + Math.cos(a) * 22, y: 50 + Math.sin(a) * 18 })
  })
  if (n <= 1) return pos

  const lazos: [string, string][] = [
    ...vinculos.map((v) => [v.from, v.to] as [string, string]),
    ...grupos.flatMap((g) => g.slice(1).map((x) => [g[0], x] as [string, string]))
  ].filter(([a, b]) => pos.has(a) && pos.has(b))

  for (let paso = 0; paso < 260; paso++) {
    const fuerza = new Map(ids.map((id) => [id, { x: 0, y: 0 }]))
    // repulsión entre todos
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(ids[i])!, b = pos.get(ids[j])!
        let dx = a.x - b.x, dy = a.y - b.y
        let d = Math.hypot(dx, dy)
        if (d < 0.01) { dx = (i - j) * 0.1 + 0.1; dy = 0.1; d = 0.15 }
        const f = 320 / (d * d)
        const fa = fuerza.get(ids[i])!, fb = fuerza.get(ids[j])!
        fa.x += (dx / d) * f; fa.y += (dy / d) * f
        fb.x -= (dx / d) * f; fb.y -= (dy / d) * f
      }
    }
    // atracción por los lazos
    for (const [ia, ib] of lazos) {
      const a = pos.get(ia)!, b = pos.get(ib)!
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.max(0.01, Math.hypot(dx, dy))
      const f = (d - 26) * 0.06
      const fa = fuerza.get(ia)!, fb = fuerza.get(ib)!
      fa.x += (dx / d) * f; fa.y += (dy / d) * f
      fb.x -= (dx / d) * f; fb.y -= (dy / d) * f
    }
    const freno = 0.85 * (1 - paso / 320)
    for (const id of ids) {
      const p = pos.get(id)!, f = fuerza.get(id)!
      p.x += Math.max(-3, Math.min(3, f.x)) * freno
      p.y += Math.max(-3, Math.min(3, f.y)) * freno
    }
  }

  // encajar dentro de los márgenes: nada puede salirse del lienzo
  const xs = ids.map((id) => pos.get(id)!.x)
  const ys = ids.map((id) => pos.get(id)!.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const escala = Math.min(66 / Math.max(1, maxX - minX), 58 / Math.max(1, maxY - minY), 1.7)
  for (const id of ids) {
    const p = pos.get(id)!
    p.x = 50 + (p.x - (minX + maxX) / 2) * escala
    p.y = 50 + (p.y - (minY + maxY) / 2) * escala
  }
  return pos
}

/** Parte un título en dos renglones para que no se salga de su recuadro. */
function renglones(t: string, max = 15): string[] {
  if (t.length <= max) return [t]
  const palabras = t.split(' ')
  const l: string[] = ['']
  for (const w of palabras) {
    if ((l[l.length - 1] + ' ' + w).trim().length <= max) {
      l[l.length - 1] = (l[l.length - 1] + ' ' + w).trim()
    } else l.push(w)
  }
  if (l.length <= 2) return l
  return [l[0], `${l.slice(1).join(' ').slice(0, max - 1)}…`]
}

export function BattleMap({
  contenido, hallazgos, atlas, mejorGolpe, enemigos, latencias, descubiertos, onSeguir
}: {
  contenido: Contenido
  hallazgos: Hallazgos
  atlas: Atlas
  mejorGolpe: { dano: number; fichas: number; mult: number; trazos: number }
  enemigos: { tipoId: string; nombre: string; hpMax: number }[]
  latencias: { ms: number; conIntuicion: boolean; trazos: number }[]
  descubiertos: string[]
  onSeguir: () => void
}) {
  const { vinculos, grupos, reconocidos } = hallazgos
  const ids = useMemo(() => [...new Set([
    ...vinculos.flatMap((v) => [v.from, v.to]),
    ...grupos.flatMap((g) => g.ids),
    ...reconocidos
  ])].filter((id) => contenido.conceptos[id]), [hallazgos, contenido])

  const pos = useMemo(
    () => disponer(ids, vinculos, grupos.map((g) => g.ids)),
    [ids.join('|'), vinculos.length, grupos.length]
  )
  const nodos: Nodo[] = ids.map((id) => ({
    id, titulo: contenido.conceptos[id]?.titulo ?? id,
    x: pos.get(id)?.x ?? 50, y: pos.get(id)?.y ?? 50
  }))

  const yaConocidas = useMemo(
    () => new Set(Object.values(atlas.aristas).map((a) => `${a.from}|${a.to}|${a.tipo}`)),
    [atlas]
  )
  const nuevas = vinculos.filter((v) => !yaConocidas.has(`${v.from}|${v.to}|${v.tipo}`)).length
  const derribaria = enemigos.filter((en) => en.hpMax <= mejorGolpe.dano)
    .sort((a, b) => b.hpMax - a.hpMax)[0]

  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">El carril queda despejado</span>
        <h2 className="display" style={{ fontSize: 30 }}>Lo que dejaste en pie</h2>
        <p className="silencio serif-lectura" style={{ maxWidth: 700, margin: 0 }}>
          Cada acierto de cada turno se fue guardando aquí. Lo que sostuviste por
          separado acaba encadenándose: esto es el mapa que construiste en este combate.
        </p>
      </div>

      <div className="fila" style={{ gap: 14, alignItems: 'stretch' }}>
        <div className="mapa-combate">
          {ids.length === 0 ? (
            <p className="pista-lienzo" style={{ position: 'static', padding: 40 }}>
              No sostuviste ningún vínculo en este combate. Los aciertos se guardan aquí
              turno a turno.
            </p>
          ) : (
            <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden>
              {/* agrupaciones: campo, eje y ancla */}
              {grupos.map((g, i) => {
                const ps = g.ids.map((id) => pos.get(id)).filter(Boolean) as { x: number; y: number }[]
                if (ps.length < 2) return null
                const cx = ps.reduce((n, p) => n + p.x, 0) / ps.length
                const cy = ps.reduce((n, p) => n + p.y, 0) / ps.length
                const r = Math.max(...ps.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 7
                return (
                  <g key={`g${i}`}>
                    <circle cx={cx} cy={cy} r={r} fill="rgba(122,111,176,.07)"
                      stroke="#7a6fb0" strokeWidth="0.35" strokeDasharray="2 1.6" />
                    <text x={cx} y={cy - r + 2.4} fill="#9d93cc" fontSize="2.5"
                      textAnchor="middle" style={{ fontFamily: 'var(--mono)' }}>
                      {g.etiqueta}
                    </text>
                  </g>
                )
              })}

              {/* vínculos con su etiqueta escrita, no solo el color */}
              {vinculos.map((v, i) => {
                const a = pos.get(v.from), b = pos.get(v.to)
                if (!a || !b) return null
                const est = estiloRelacion(v.tipo)
                const color = COLOR[v.estado] ?? '#5fa78f'
                const nueva = !yaConocidas.has(`${v.from}|${v.to}|${v.tipo}`)
                const mx = (a.x + b.x) / 2
                const my = (a.y + b.y) / 2
                const ancho = v.tipo.length * 1.42 + 2.6
                return (
                  <g key={`v${i}`} className={nueva ? 'arista-nueva' : undefined}>
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={color} strokeWidth={v.estado === 'derivado' ? 0.55 : 0.75}
                      strokeDasharray={v.estado === 'derivado' ? '2.2 1.2'
                        : est.dash ? est.dash.split(' ').map((x) => Number(x) / 3.4).join(' ') : undefined}
                      markerEnd="url(#flechita)" vectorEffect="non-scaling-stroke"
                    />
                    <rect
                      x={mx - ancho / 2} y={my - 2} width={ancho} height={4} rx={1}
                      fill="var(--tinta)" opacity=".92"
                    />
                    <text x={mx} y={my + 0.9} fill={color} fontSize="2.6" textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)' }}>
                      {v.tipo}
                    </text>
                  </g>
                )
              })}

              {nodos.map((n) => {
                const nivel = nivelDe(atlas.conceptos[n.id])
                const ls = renglones(n.titulo)
                const w = Math.max(...ls.map((l) => l.length)) * 1.42 + 3
                const h = ls.length * 3.4 + 1.6
                return (
                  <g key={n.id}>
                    <rect
                      x={n.x - w / 2} y={n.y - h / 2} width={w} height={h} rx={1.2}
                      fill={reconocidos.includes(n.id) ? '#ede7da' : 'var(--tinta-alta)'}
                      stroke={nivel >= 2 ? '#5fa78f' : 'var(--tinta-borde)'}
                      strokeWidth={nivel >= 2 ? 0.6 : 0.35}
                    />
                    {ls.map((l, k) => (
                      <text
                        key={k} x={n.x} y={n.y - h / 2 + 3.1 + k * 3.2}
                        fill={reconocidos.includes(n.id) ? '#1b2430' : 'var(--papel)'}
                        fontSize="2.7" textAnchor="middle" style={{ fontFamily: 'var(--serif)' }}
                      >{l}</text>
                    ))}
                  </g>
                )
              })}

              <defs>
                <marker id="flechita" markerWidth="5" markerHeight="5" refX="4.4" refY="2.5" orient="auto">
                  <path d="M0 0.4 L5 2.5 L0 4.6 z" fill="#5fa78f" />
                </marker>
              </defs>
            </svg>
          )}
        </div>

        <div className="resumen-combate">
          <span className="eyebrow">Tu mejor afirmación</span>
          <div className="cuenta" style={{ marginBottom: 2 }}>
            <span className="fichas">{mejorGolpe.fichas}</span>
            <span className="por">×</span>
            <span className="mult">{mejorGolpe.mult.toFixed(1)}</span>
            <span className="por">=</span>
            <span className="total">{mejorGolpe.dano}</span>
          </div>
          <p className="silencio" style={{ margin: 0, fontSize: 13.5 }}>
            {mejorGolpe.trazos} trazo{mejorGolpe.trazos === 1 ? '' : 's'} a la vez.{' '}
            {derribaria
              ? `Ese golpe habría derribado de una sola vez a ${derribaria.nombre} (${derribaria.hpMax} de resistencia).`
              : 'Todavía no alcanza para derribar de un golpe a nadie de este frente: los diagramas grandes salen de encadenar herramientas.'}
          </p>

          {(() => {
            const previos = (atlas.mejoresDiagramas ?? [])
            if (previos.length < 2) return null
            const primero = previos[0]
            if (mejorGolpe.dano <= primero) return null
            return (
              <p className="dato" style={{ margin: 0, color: '#8fb8d6' }}>
                Tu primer diagrama de esta fuente hizo {primero}. Este hizo {mejorGolpe.dano}.
              </p>
            )
          })()}

          {(() => {
            const conI = latencias.filter((l) => l.conIntuicion)
            const sinI = latencias.filter((l) => !l.conIntuicion)
            if (!conI.length || !sinI.length) return null
            const m = (l: typeof conI) => l.reduce((n, x) => n + x.ms, 0) / l.length / 1000
            const dif = m(conI) - m(sinI)
            if (dif < 2) return null
            return (
              <p className="dato silencio" style={{ margin: 0 }}>
                Tardaste {dif.toFixed(0)} s más en los turnos donde una intuición previa
                competía con el concepto.
              </p>
            )
          })()}

          {descubiertos.length > 0 && (
            <>
              <div className="separador" />
              <span className="eyebrow">Vínculos descubiertos</span>
              <p className="nota ok" style={{ margin: 0 }}>
                Al derribar enemigos aprendiste a trazar:{' '}
                <strong>{descubiertos.join(' · ')}</strong>. Se quedan contigo.
              </p>
            </>
          )}

          <div className="separador" />
          <span className="eyebrow">Lo que quedó en pie</span>
          <ul className="lista-estados">
            <li><span className="punto" style={{ background: '#5fa78f' }} />
              {vinculos.filter((v) => v.estado !== 'derivado').length} vínculo(s) que el texto afirma</li>
            <li><span className="punto" style={{ background: '#7fa8d6' }} />
              {vinculos.filter((v) => v.estado === 'derivado').length} deducido(s) por ti</li>
            <li><span className="punto" style={{ background: '#7a6fb0' }} />
              {grupos.length} agrupación(es)</li>
            <li><span className="punto" style={{ background: '#ede7da' }} />
              {reconocidos.length} concepto(s) reconocido(s) por su descripción</li>
          </ul>
          <p className="dato silencio" style={{ margin: 0 }}>
            {nuevas} vínculo(s) nuevo(s) para tu Atlas · frente de{' '}
            {[...new Set(enemigos.map((x) => tipoPorId(x.tipoId).nombre))].join(', ')}
          </p>

          <button className="btn primario" onClick={onSeguir} style={{ marginTop: 'auto' }}>
            Recoger el hallazgo
          </button>
        </div>
      </div>
    </div>
  )
}

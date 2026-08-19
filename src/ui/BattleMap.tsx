import { useMemo } from 'react'
import type { Contenido } from '../content/types'
import type { Hallazgo } from '../engine/battle'
import { tipoPorId } from '../engine/lane'
import { estiloRelacion, ondaEntre } from './identity'
import { nivelDe, type Atlas } from './../engine/atlas'

/* ==========================================================================
   El mapa del combate.
   Al despejar el carril no basta con decir «ganaste»: se le devuelve al jugador
   el mapa de lo que acaba de afirmar, con lo nuevo destacado sobre lo que ya
   tenía. Es el momento en el que el combate se convierte en aprendizaje visible.
   ========================================================================== */

const COLOR: Record<string, string> = {
  sostenido: 'var(--verdigris)', equivalente: 'var(--verdigris)', derivado: '#7fa8d6',
  aproximado: 'var(--laton)', plausible: '#7a6fb0', silencio: 'var(--niebla)',
  invertido: 'var(--oxido)', error: 'var(--oxido)'
}
const ACIERTOS = new Set(['sostenido', 'equivalente', 'derivado'])

interface Nodo { id: string; titulo: string; x: number; y: number; nuevo: boolean }

/** Disposición determinista: los conceptos se reparten en un anillo agrupados
 *  por cluster, para que las zonas del texto queden juntas también aquí. */
function disponer(c: Contenido, ids: string[]): Nodo[] {
  const porCluster = new Map<string, string[]>()
  for (const id of ids) {
    const cl = c.conceptos[id]?.clusterId ?? '—'
    porCluster.set(cl, [...(porCluster.get(cl) ?? []), id])
  }
  const orden = [...porCluster.values()].flat()
  const n = orden.length
  return orden.map((id, i) => {
    const ang = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
    const radio = n <= 4 ? 26 : n <= 8 ? 32 : 37
    return {
      id, titulo: c.conceptos[id]?.titulo ?? id,
      x: 50 + Math.cos(ang) * radio * 1.35,
      y: 50 + Math.sin(ang) * radio,
      nuevo: false
    }
  })
}

export function BattleMap({ contenido, hallazgos, atlas, mejorGolpe, enemigos, onSeguir }: {
  contenido: Contenido
  hallazgos: Hallazgo[]
  atlas: Atlas
  mejorGolpe: { dano: number; fichas: number; mult: number; trazos: number }
  enemigos: { tipoId: string; nombre: string; hpMax: number }[]
  onSeguir: () => void
}) {
  const aciertos = hallazgos.filter((h) => ACIERTOS.has(h.estado))
  const ids = [...new Set(hallazgos.flatMap((h) => [h.from, h.to]))].filter((id) => contenido.conceptos[id])
  const nodos = useMemo(() => disponer(contenido, ids), [contenido, ids.join('|')])
  const pos = new Map(nodos.map((n) => [n.id, n]))

  // ¿qué se afirmó por primera vez? lo que no estaba ya en el Atlas al empezar
  const yaConocidas = new Set(Object.values(atlas.aristas).map((a) => `${a.from}|${a.to}|${a.tipo}`))

  // ¿a quién habría derribado el mejor diagrama?
  const derribaria = enemigos
    .filter((en) => en.hpMax <= mejorGolpe.dano)
    .sort((a, b) => b.hpMax - a.hpMax)[0]

  const porEstado = hallazgos.reduce<Record<string, number>>((acc, h) => {
    acc[h.estado] = (acc[h.estado] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">El carril queda despejado</span>
        <h2 className="display" style={{ fontSize: 30 }}>Lo que afirmaste aquí</h2>
        <p className="silencio serif-lectura" style={{ maxWidth: 680, margin: 0 }}>
          Este es el mapa de lo que sostuviste en este combate. Lo grueso es lo que el
          texto respalda; lo tenue, lo que quedó a medias.
        </p>
      </div>

      <div className="fila" style={{ gap: 14, alignItems: 'stretch' }}>
        <div className="mapa-combate">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden>
            {hallazgos.map((h, i) => {
              const a = pos.get(h.from)
              const b = pos.get(h.to)
              if (!a || !b) return null
              const est = estiloRelacion(h.tipo)
              const color = COLOR[h.estado] ?? 'var(--niebla)'
              const acierto = ACIERTOS.has(h.estado)
              const nueva = acierto && !yaConocidas.has(`${h.from}|${h.to}|${h.tipo}`)
              const props = {
                stroke: color,
                strokeWidth: (acierto ? est.ancho : est.ancho * 0.6) / 2.6,
                strokeDasharray: est.dash
                  ? est.dash.split(' ').map((x) => Number(x) / 2.6).join(' ')
                  : h.estado === 'derivado' ? '3 1.6' : undefined,
                opacity: acierto ? 1 : 0.4,
                fill: 'none' as const,
                vectorEffect: 'non-scaling-stroke' as const
              }
              return (
                <g key={i} className={nueva ? 'arista-nueva' : undefined}>
                  {est.ondulada
                    ? <path d={ondaEntre(a.x, a.y, b.x, b.y)} {...props} />
                    : <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...props} />}
                  {acierto && (
                    <text
                      x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 1}
                      fill={color} fontSize="2.4" textAnchor="middle"
                      style={{ fontFamily: 'var(--mono)' }}
                    >{h.tipo}</text>
                  )}
                </g>
              )
            })}
            {nodos.map((n) => {
              const nivel = nivelDe(atlas.conceptos[n.id])
              return (
                <g key={n.id}>
                  <circle
                    cx={n.x} cy={n.y} r={nivel >= 2 ? 2.4 : 1.7}
                    fill={nivel >= 2 ? 'var(--verdigris)' : 'var(--papel)'}
                    stroke="var(--tinta)" strokeWidth="0.5"
                  />
                  <text
                    x={n.x} y={n.y - 3.4} fill="var(--papel)" fontSize="2.7"
                    textAnchor="middle" style={{ fontFamily: 'var(--serif)' }}
                  >
                    {n.titulo.length > 26 ? `${n.titulo.slice(0, 25)}…` : n.titulo}
                  </text>
                </g>
              )
            })}
          </svg>
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
              : 'Aún no alcanza para derribar de un golpe a nadie de este frente: los diagramas grandes se construyen encadenando herramientas.'}
          </p>

          <div className="separador" />
          <span className="eyebrow">Lo que dijiste</span>
          <ul className="lista-estados">
            {Object.entries(porEstado).sort((a, b) => b[1] - a[1]).map(([est, n]) => (
              <li key={est}>
                <span className="punto" style={{ background: COLOR[est] ?? 'var(--niebla)' }} />
                {n} × {est}
              </li>
            ))}
          </ul>
          <p className="dato silencio" style={{ margin: 0 }}>
            {aciertos.filter((h) => !yaConocidas.has(`${h.from}|${h.to}|${h.tipo}`)).length} vínculo(s)
            nuevo(s) para tu Atlas · frente de {enemigos.map((x) => tipoPorId(x.tipoId).nombre).join(', ')}
          </p>

          <button className="btn primario" onClick={onSeguir} style={{ marginTop: 'auto' }}>
            Recoger el hallazgo
          </button>
        </div>
      </div>
    </div>
  )
}

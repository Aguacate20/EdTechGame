import { useState, type ReactNode } from 'react'
import type { Contenido } from '../content/types'
import { coberturaAtlas, nivelDe, type Atlas } from '../engine/atlas'
import { lucidezDe, type Sesion } from '../net/sesion'
import { Galaxia } from './Galaxia'

/** El Inicio según Inicio.dc.html: tres columnas, la galaxia al centro.
 *  Izquierda: Andy · Misión actual · Próximo desafío · Concepto recomendado.
 *  Derecha: Constelación de la unidad actual · Tu progreso · Lucidez.
 *  Abajo: los cinco escalones y «Continuar expedición». Los botones de
 *  siempre (HomeView) viven en `acciones`. */
interface Props {
  contenido: Contenido
  atlas: Atlas
  sesion: Sesion | null
  guardada: { actoIdx: number } | null
  onContinuar: () => void
  onAtlas: () => void
  onEstrella?: (id: string) => void
  acciones: ReactNode
}

const DIMS: { id: string; nombre: string; color: string; nivel: number }[] = [
  { id: 'descubrir', nombre: 'Descubrir', color: 'var(--sostenido)', nivel: 1 },
  { id: 'practicar', nombre: 'Practicar', color: 'var(--descubierto)', nivel: 1 },
  { id: 'relacionar', nombre: 'Relacionar', color: 'var(--acento)', nivel: 2 },
  { id: 'transferir', nombre: 'Transferir', color: 'var(--transferir)', nivel: 3 },
  { id: 'dominar', nombre: 'Dominar', color: 'var(--dominar)', nivel: 3 }
]

export function InicioView({ contenido, atlas, sesion, guardada, onContinuar, onAtlas, onEstrella, acciones }: Props) {
  const [zonaFoco, setZonaFoco] = useState<string | null>(null)
  const ids = contenido.ordenConceptos
  const total = Math.max(1, ids.length)
  const niveles = ids.map((id) => nivelDe(atlas.conceptos[id]))
  const pct = (f: (n: number, id: string) => boolean) => Math.round((100 * ids.filter((id, i) => f(niveles[i], id)).length) / total)
  const progreso = {
    descubrir: pct((n, id) => n >= 1 || !!atlas.conceptos[id]),
    practicar: pct((n) => n >= 1),
    relacionar: pct((n) => n >= 2),
    transferir: pct((n, id) => n >= 2 && (atlas.conceptos[id]?.mecanicas ?? []).some((m) => /ancla|caso|contraejemplo|analogia/.test(m))),
    dominar: pct((n) => n >= 3)
  } as Record<string, number>
  const cob = coberturaAtlas(atlas, contenido)
  const lucidez = lucidezDe(atlas)
  // recomendado: el concepto importante con menos nivel; se te resiste primero
  const recomendado = [...ids].sort((a, b) => {
    const ea = atlas.conceptos[a], eb = atlas.conceptos[b]
    const ra = (ea?.fallos ?? 0) > 0 ? -1 : 0, rb = (eb?.fallos ?? 0) > 0 ? -1 : 0
    return ra - rb || nivelDe(ea) - nivelDe(eb) || contenido.conceptos[b].importancia - contenido.conceptos[a].importancia
  })[0]
  const unidadActual = contenido.unidades.find((u) => u.conceptIds.some((id) => nivelDe(atlas.conceptos[id]) < 3)) ?? contenido.unidades[0]
  const nombre = sesion?.nombre ?? 'explorador'
  const fuente = contenido.fuente.replace(/\.pdf$/i, '')

  return (
    <div className="inicio">
      <aside className="inicio-col">
        <section className="panel andy">
          <div className="andy-avatar" aria-hidden="true">✦</div>
          <div><b>Andy</b><p>{cob.aristas === 0 ? `Hola, ${nombre}. Cada vínculo que sostengas se queda en tu cielo.` : `Llevas ${cob.aristas} vínculos en tu cielo, ${nombre}. Hoy podemos encender otra zona.`}</p></div>
        </section>
        <section className="panel">
          <h3>Misión actual</h3>
          <b className="panel-titulo">{guardada ? `Expedición en curso · Acto ${guardada.actoIdx + 1}` : 'Expedición del Archivo Infinito'}</b>
          <p>{unidadActual ? `Sostén los vínculos de «${unidadActual.titulo}» y presenta tu diagrama.` : 'Sostén vínculos y presenta tu diagrama.'}</p>
          <div className="barra-prog"><span style={{ width: `${cob.pct}%` }} /></div>
          <small>Progreso {cob.pct}%</small>
        </section>
        <section className="panel">
          <h3>Próximo desafío</h3>
          <b className="panel-titulo">Monocultivo</b>
          <p>Tres conceptos de zonas distintas en un solo diagrama.</p>
          <small>Recompensa · +20 XP</small>
        </section>
        {recomendado && (
          <section className="panel">
            <h3>Concepto recomendado</h3>
            <b className="panel-titulo">{contenido.conceptos[recomendado].titulo}</b>
            <p>Nivel {nivelDe(atlas.conceptos[recomendado])} · {(atlas.conceptos[recomendado]?.fallos ?? 0) > 0 ? 'Se te resiste' : 'Relacionar'}</p>
            <button className="btn fantasma" onClick={() => onEstrella?.(recomendado)}>Explorar concepto</button>
          </section>
        )}
      </aside>

      <main className="inicio-centro">
        <div className="inicio-cab">
          <small>·· · Galaxia del campo · ··</small>
          <b>{fuente}</b>
        </div>
        <div className="leyenda">
          <span><i style={{ background: 'var(--descubierto)' }} />Reconocida</span>
          <span><i style={{ background: 'var(--dominar)' }} />Consolidada</span>
          <span><i style={{ background: 'var(--resiste)' }} />Se te resiste</span>
          <span><i className="punteada" />Propuesta</span>
        </div>
        <Galaxia contenido={contenido} atlas={atlas} modo="vivo" alto={420} onEstrella={onEstrella} zonaFoco={zonaFoco} />
        <small className="inicio-ayuda">Arrastra para girar · toca una estrella</small>
        <div className="escalones">
          {DIMS.map((d) => (
            <div key={d.id} className="escalon">
              <span className="escalon-anillo" style={{ borderColor: d.color, color: d.color }}>{Math.round(progreso[d.id])}%</span>
              <small>{d.nombre}</small>
            </div>
          ))}
        </div>
      </main>

      <aside className="inicio-col">
        <section className="panel">
          <h3>Zonas de tu cielo</h3>
          <ul className="zonas">
            {contenido.clusters.map((z, i) => {
              const encendidas = z.conceptIds.filter((id) => nivelDe(atlas.conceptos[id]) >= 1).length
              const activa = zonaFoco === z.id
              return (
                <li key={z.id}>
                  <button className={`zona${activa ? ' activa' : ''}`} onClick={() => setZonaFoco(activa ? null : z.id)} aria-pressed={activa}>
                    <i style={{ background: `rgb(${['56,182,255', '91,211,111', '155,108,255', '255,194,61', '255,106,26', '224,163,58'][i % 6]})` }} />
                    <span className="zona-texto"><b>{z.label.replace(/^Zona de /, '')}</b><small>{encendidas} de {z.conceptIds.length} encendidas</small></span>
                    <div className="barra-prog"><span style={{ width: `${(100 * encendidas) / Math.max(1, z.conceptIds.length)}%` }} /></div>
                  </button>
                </li>
              )
            })}
          </ul>
          <small>{zonaFoco ? 'Toca la zona otra vez para ver todo el cielo.' : 'Toca una zona para acercarte.'}</small>
          <button className="btn fantasma" onClick={onAtlas}>Ver la colección</button>
        </section>
        <section className="panel">
          <h3>Tu progreso</h3>
          {DIMS.map((d) => (
            <div key={d.id} className="prog-fila">
              <span>{d.nombre}</span>
              <div className="barra-prog"><span style={{ width: `${progreso[d.id]}%`, background: d.color }} /></div>
              <small>{progreso[d.id]}%</small>
            </div>
          ))}
        </section>
        <section className="panel lucidez-panel">
          <h3>Lucidez</h3>
          <div className="lucidez-fila">
            <b className="lucidez-num">{lucidez}%</b>
            <p>Claridad para ver vínculos correctos. {atlas.apuestasTotales === 0 ? 'Apuesta en tus diagramas para medirla.' : ''}</p>
          </div>
        </section>
      </aside>

      <footer className="inicio-pie">
        <div className="inicio-acciones">{acciones}</div>
        <button className="btn primario inicio-continuar" onClick={onContinuar}>{guardada ? 'Continuar expedición' : 'Empezar expedición'}</button>
      </footer>
    </div>
  )
}

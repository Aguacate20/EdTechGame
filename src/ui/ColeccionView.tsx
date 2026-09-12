import { useEffect, useRef, useState } from 'react'
import type { Contenido } from '../content/types'
import { confirmarPropuestas, nivelDe, type Atlas } from '../engine/atlas'
import { HAZANAS } from '../engine/hazanas'
import { AtlasView } from './Screens'

type Pestana = 'estrellas' | 'propuestas' | 'logros' | 'atlas'

/** Colección según Coleccion.dc.html: las estrellas del cielo por zona con
 *  su estado (lo que se te resiste, primero), tus propuestas para confirmar
 *  o descartar, los logros con su progreso, y el Atlas completo de siempre. */
interface Props { contenido: Contenido; atlas: Atlas; inicial?: Pestana; conceptoFoco?: string | null; onAtlas: (a: Atlas) => void; onVolver: () => void }

const ESTADO = ['No tocada', 'Vista', 'Reconocida', 'Relacionada', 'Consolidada', 'Se te resiste']
const COLOR = ['var(--texto-2)', 'var(--texto-2)', 'var(--descubierto)', 'var(--descubierto)', 'var(--dominar)', 'var(--resiste)']

function estadoDe(atlas: Atlas, id: string): number {
  const e = atlas.conceptos[id]
  if (!e) return 0
  if ((e.fallos ?? 0) > 0 && (e.fallos ?? 0) >= (e.aciertos ?? 0)) return 5
  const n = nivelDe(e)
  return n >= 3 ? 4 : n === 2 ? 3 : n === 1 ? 2 : 1
}

export function ColeccionView({ contenido, atlas, inicial = 'estrellas', conceptoFoco = null, onAtlas, onVolver }: Props) {
  const [pestana, setPestana] = useState<Pestana>(inicial)
  const [abierto, setAbierto] = useState<string | null>(conceptoFoco)
  const focoRef = useRef<HTMLLIElement>(null)
  useEffect(() => { if (conceptoFoco) { setAbierto(conceptoFoco); setTimeout(() => focoRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60) } }, [conceptoFoco])
  const t = (id: string) => contenido.conceptos[id]?.titulo ?? id
  const propuestas = Object.entries(atlas.propuestas)
  const resisten = contenido.ordenConceptos.filter((id) => estadoDe(atlas, id) === 5)
  const zonas = contenido.clusters.length ? contenido.clusters : [{ id: 'todo', label: 'Todo el cielo', conceptIds: contenido.ordenConceptos }]

  return (
    <section className="coleccion">
      <div className="coleccion-cab">
        <small>·· · Colección · ··</small>
        <b>{contenido.fuente.replace(/\.pdf$/i, '')} · {contenido.ordenConceptos.length} conceptos</b>
      </div>
      <nav className="coleccion-tabs" aria-label="Colección">
        {([['estrellas', 'Estrellas'], ['propuestas', `Propuestas${propuestas.length ? ` · ${propuestas.length}` : ''}`], ['logros', 'Logros'], ['atlas', 'Atlas completo']] as [Pestana, string][]).map(([id, nombre]) => (
          <button key={id} className={`ludus-tab${pestana === id ? ' activa' : ''}`} aria-current={pestana === id ? 'page' : undefined} onClick={() => setPestana(id)}>{nombre}</button>
        ))}
      </nav>

      {pestana === 'estrellas' && (
        <div className="coleccion-cuerpo">
          {resisten.length > 0 && (
            <section className="panel">
              <h3>Se te resiste</h3>
              <div className="estrellas">
                {resisten.map((id) => <span key={id} className="estrella-chip"><i style={{ background: 'var(--resiste)' }} />{t(id)}</span>)}
              </div>
            </section>
          )}
          {zonas.map((z) => (
            <section key={z.id} className="panel">
              <h3>{z.label}</h3>
              <ul className="estrella-lista">
                {z.conceptIds.map((id) => {
                  const e = estadoDe(atlas, id)
                  const k = contenido.conceptos[id]
                  const open = abierto === id
                  return (
                    <li key={id} ref={conceptoFoco === id ? focoRef : undefined} className={`estrella-fila${open ? ' abierta' : ''}${conceptoFoco === id ? ' foco' : ''}`}>
                      <button className="estrella-cab" onClick={() => setAbierto(open ? null : id)} aria-expanded={open}>
                        <i className="estrella-punto" style={{ background: COLOR[e], boxShadow: e >= 2 ? `0 0 8px ${COLOR[e]}` : 'none', opacity: e === 0 ? 0.45 : 1 }} />
                        <span className="entrar-item-texto"><b>{t(id)}</b><small>{ESTADO[e]}{e > 0 ? ` · nivel ${nivelDe(atlas.conceptos[id])}` : ''}</small></span>
                        <span className="estrella-flecha" aria-hidden="true">{open ? '▾' : '▸'}</span>
                      </button>
                      {open && (
                        <div className="estrella-detalle">
                          <p className="estrella-def">{k.definicion || k.definicionCorta}</p>
                          {k.evidencia && (
                            <blockquote className="estrella-cita">
                              <small>En el texto{k.paginas?.length ? ` · p. ${k.paginas.join(', ')}` : ''}</small>
                              «{k.evidencia}»
                            </blockquote>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {pestana === 'propuestas' && (
        <div className="coleccion-cuerpo">
          <p className="entrar-nota">Vínculos que propusiste y el texto no afirma. Confírmalos con evidencia o descártalos. Los confirmados quedan punteados en violeta en tu galaxia.</p>
          {propuestas.length === 0 ? <p className="entrar-nota">Todavía no has propuesto ningún vínculo. Se proponen trazando entre conceptos que el texto no enlaza.</p> : (
            <ul className="estrella-lista">
              {propuestas.map(([k, p]) => (
                <li key={k}>
                  <i className="estrella-punto" style={{ background: p.confirmada ? 'var(--transferir)' : 'transparent', border: '1.5px dashed var(--transferir)' }} />
                  <span className="entrar-item-texto"><b>{t(p.from)} → {t(p.to)} <small>({p.tipo})</small></b><small>{p.motivo}{p.confirmada ? ' · confirmada' : ''}{p.veces > 1 ? ` · ${p.veces} veces` : ''}</small></span>
                  {!p.confirmada && (
                    <span className="coleccion-acciones">
                      <button className="btn chico primario" onClick={() => { const a = { ...atlas, propuestas: { ...atlas.propuestas } }; confirmarPropuestas(a, [{ from: p.from, to: p.to, tipo: p.tipo }]); onAtlas(a) }}>Confirmar</button>
                      <button className="btn chico fantasma" onClick={() => { const a = { ...atlas, propuestas: { ...atlas.propuestas } }; delete a.propuestas[k]; onAtlas(a) }}>Descartar</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pestana === 'logros' && (
        <div className="coleccion-cuerpo logros">
          {HAZANAS.map((h) => {
            const hecha = atlas.hazanas.includes(h.id)
            const prog = hecha ? 1 : Math.max(0, Math.min(1, h.progreso(null, atlas)))
            return (
              <article key={h.id} className={`panel logro${hecha ? ' hecha' : ''}`}>
                <h3>{hecha ? '✓ Conseguida' : 'Por conseguir'}</h3>
                <b className="panel-titulo">{h.nombre}</b>
                <p>{h.reto}</p>
                <div className="barra-prog"><span style={{ width: `${Math.round(prog * 100)}%`, background: hecha ? 'var(--dominar)' : 'var(--acento)' }} /></div>
                <small>Desbloquea la lente «{h.lenteId}»</small>
              </article>
            )
          })}
        </div>
      )}

      {pestana === 'atlas' && <AtlasView atlas={atlas} contenido={contenido} onVolver={onVolver} />}
    </section>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import type { Contenido } from '../content/types'
import { coberturaAtlas, nivelDe, type Atlas } from '../engine/atlas'
import type { Sesion } from '../net/sesion'
import { Galaxia } from './Galaxia'
import { esDiamante, type Tema } from '../engine/temas'

/** El Inicio según Inicio.dc.html: tres columnas, la galaxia al centro.
 *  Izquierda: Andy · Misión actual · Próximo desafío · Concepto recomendado.
 *  Derecha: Constelación de la unidad actual · Tu progreso · Lucidez.
 *  Abajo: los cinco escalones y «Continuar expedición». Los botones de
 *  siempre (HomeView) viven en `acciones`. */
interface Props {
  contenido: Contenido
  atlas: Atlas
  sesion: Sesion | null
  guardada: { actoIdx: number; aprendizaje?: boolean } | null
  onContinuar: () => void
  aprendizaje: boolean
  onAprendizaje: (v: boolean) => void
  /** descarta la expedición guardada y empieza otra con el modo del interruptor */
  onNueva: () => void
  onAtlas: () => void
  onEstrella?: (id: string) => void
  acciones: ReactNode
  temas?: Tema[]
  temaActivo?: string | null
  onTema?: (id: string) => void
  /** v5.95 · el tema activo ya está cristalizado (≥ 95 %): se repasa, no se empieza */
  diamante?: boolean
}

const DIMS: { id: string; nombre: string; color: string; nivel: number }[] = [
  { id: 'descubrir', nombre: 'Descubrir', color: 'var(--sostenido)', nivel: 1 },
  { id: 'practicar', nombre: 'Practicar', color: 'var(--descubierto)', nivel: 1 },
  { id: 'relacionar', nombre: 'Relacionar', color: 'var(--acento)', nivel: 2 },
  { id: 'transferir', nombre: 'Transferir', color: 'var(--transferir)', nivel: 3 },
  { id: 'dominar', nombre: 'Dominar', color: 'var(--dominar)', nivel: 3 }
]

export function InicioView({ contenido, atlas, sesion, guardada, onContinuar, aprendizaje, onAprendizaje, onNueva, onAtlas, onEstrella, acciones, temas = [], temaActivo = null, onTema, diamante = false }: Props) {
  const zonaFoco: string | null = null
  // v6.35 · todo cabe en la primera pantalla: la galaxia ocupa lo que sobra de alto
  const [altoGalaxia, setAltoGalaxia] = useState(() => Math.max(200, Math.min(520, window.innerHeight - 330)))
  useEffect(() => {
    const f = () => setAltoGalaxia(Math.max(200, Math.min(520, window.innerHeight - 330)))
    window.addEventListener('resize', f); return () => window.removeEventListener('resize', f)
  }, [])
  const [confirmarNueva, setConfirmarNueva] = useState(false)
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
  void onAtlas
  const nombre = sesion?.nombre ?? 'explorador'
  const fuente = contenido.fuente.replace(/\.pdf$/i, '')

  return (
    <div className="inicio">
      <main className="inicio-centro">
        <div className="inicio-cab">
          <b>{cob.aristas === 0 ? `Hola, ${nombre}. Cada conexión correcta enciende una estrella.` : `Hola, ${nombre}. Ya llevas ${cob.aristas} conexiones en tu galaxia.`}</b>
          <small>{fuente}</small>
        </div>
        <Galaxia contenido={contenido} atlas={atlas} modo="vivo" alto={altoGalaxia} onEstrella={onEstrella} zonaFoco={zonaFoco} />
        <div className="escalones">
          {DIMS.map((d) => (
            <div key={d.id} className="escalon">
              <span className="escalon-anillo" style={{ borderColor: d.color, color: d.color }}>{Math.round(progreso[d.id])}%</span>
              <small>{d.nombre}</small>
            </div>
          ))}
        </div>
      </main>

      <footer className="inicio-pie">
        {temas.length > 1 && (
          <div className="temas" role="radiogroup" aria-label="Tema de la expedición">
            <small>Explorar</small>
            {temas.map((t) => {
              const activo = (temaActivo ?? temas[0].id) === t.id
              const encendidas = t.conceptIds.filter((id) => nivelDe(atlas.conceptos[id]) >= 1).length
              return (
                <button key={t.id} role="radio" aria-checked={activo} className={`tema${activo ? ' activo' : ''}${esDiamante(t, atlas.constelaciones) ? ' diamante' : ''}`} onClick={() => onTema?.(t.id)} title={`${t.documentos.length || 1} lectura${t.documentos.length === 1 ? '' : 's'}`}>
                  <b>{esDiamante(t, atlas.constelaciones) ? '◆ ' : ''}{t.nombre}</b><small>{esDiamante(t, atlas.constelaciones) ? 'cristalizado' : `${encendidas}/${t.conceptIds.length}`}</small>
                </button>
              )
            })}
          </div>
        )}
        <div className="inicio-acciones">{acciones}</div>
        <label className={`interruptor${aprendizaje ? ' on' : ''}`} title="Con apoyo: cada sala son tres oleadas cortas, los conceptos llegan enteros al principio, las falsificaciones vienen marcadas y no puedes caer; el andamio se retira en orden y avisando. Sin apoyo: la expedición normal.">
          <input type="checkbox" checked={aprendizaje} onChange={(e) => onAprendizaje(e.target.checked)} />
          <span className="interruptor-pista" aria-hidden="true" />
          <span className="interruptor-texto"><b>Modo aprendizaje</b><small>{guardada ? 'para la próxima expedición' : aprendizaje ? 'con ayudas: más fácil para empezar' : 'sin ayudas'}</small></span>
        </label>
        {guardada ? (
          <div className="inicio-botones">
            {confirmarNueva ? (
              <span className="confirmar-nueva">
                <small>¿Descartar la expedición en curso (acto {guardada.actoIdx + 1})?</small>
                <button className="btn fantasma" onClick={() => setConfirmarNueva(false)}>No</button>
                <button className="btn peligro" onClick={() => { setConfirmarNueva(false); onNueva() }}>Sí, empezar de nuevo{aprendizaje ? ' · aprendizaje' : ''}</button>
              </span>
            ) : (
              <button className="btn fantasma" onClick={() => setConfirmarNueva(true)}>Nueva expedición</button>
            )}
            <button className="btn primario inicio-continuar" onClick={onContinuar}>Continuar expedición{guardada.aprendizaje ? ' · aprendizaje' : ''}</button>
          </div>
        ) : (
          <button className={`btn primario inicio-continuar${diamante ? ' diamante' : ''}`} onClick={onContinuar}>{diamante ? '◆ Repasar el texto' : `Empezar expedición${aprendizaje ? ' · aprendizaje' : ''}`}</button>
        )}
      </footer>
    </div>
  )
}

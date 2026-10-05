import { useState } from 'react'
import type { Contenido } from '../content/types'
import type { Atlas } from '../engine/atlas'
import type { Encargo } from '../engine/srl'
import { tipoPorId } from '../engine/lane'
import { claveArista, prediccionDe } from '../engine/significativo'
import { vistazoDe } from '../engine/objectives'
import { Galaxia } from './Galaxia'

/** El cierre de sala: la galaxia con lo ganado (arriba) y, debajo, una fila
 *  de tarjetas con lo que antes contaba el mapa: el golpe más fuerte, lo
 *  desbloqueado, el encargo y los sellos, y la marca de «qué te costó más»,
 *  que sigue siendo obligatoria porque es la autorreflexión con consecuencia. */
interface Props {
  contenido: Contenido
  atlas: Atlas
  nuevos: { aristas: string[]; conceptos: string[] }
  mejorGolpe: { dano: number; fichas: number; mult: number; trazos: number }
  enemigos: { tipoId: string; nombre: string; hpMax: number }[]
  descubiertos: string[]
  hazanas: { nombre: string; lente: string }[]
  srl: { encargo: Encargo | null; cumplido: boolean; sellosHechos: number; sellosAcertados: number; candidatos: string[] }
  onSeguir: (marcado: string | null) => void
  /** v5.62 · modo aprendizaje: la pregunta del Vistazo se cierra aquí */
  aprendizaje?: boolean
  conceptIdsSala?: string[]
  onRespuesta?: (acierto: boolean, antes: boolean | null | undefined) => void
  /** v6.24 · lo que predijo en el Vistazo, para comparar antes y después */
  prediccion?: { clave: string; elegido: string | null; ok: boolean | null } | null
}

export function CierreView({ contenido, atlas, nuevos, mejorGolpe, enemigos, descubiertos, hazanas, srl, onSeguir, aprendizaje = false, conceptIdsSala = [], onRespuesta, prediccion = null }: Props) {
  const [marcado, setMarcado] = useState<string | null | undefined>(undefined)
  const [respondido, setRespondido] = useState<null | { acierto: boolean }>(null)
  const reciente = (atlas.constelaciones ?? []).some((k) => Date.now() - k.fecha < 10 * 60 * 1000)
  // la pregunta del Vistazo, con tres respuestas: la que usa un vínculo que acabas
  // de sostener, la misma al revés, y la misma con otro tipo de vínculo
  const vz = aprendizaje ? vistazoDe(contenido, conceptIdsSala, atlas) : null
  const pregunta = vz?.pregunta ?? null
  const post = vz ? prediccionDe(contenido, conceptIdsSala, vz.conceptId) : null
  const claveNueva = aprendizaje ? nuevos.aristas.find((k) => { const [f, to, tipo] = k.split('>'); return !!tipo && !!contenido.conceptos[f] && !!contenido.conceptos[to] }) ?? null : null
  const opciones = (() => {
    if (!claveNueva) return null
    const [from, to, tipo] = claveNueva.split('>')
    const tt = (id: string) => contenido.conceptos[id]?.titulo ?? id
    const otro = ['apoya', 'causa', 'requiere', 'ejemplifica', 'contrasta', 'extiende'].find((x) => x !== tipo) ?? 'apoya'
    const base = [
      { texto: `«${tt(from)}» ${tipo} «${tt(to)}»`, ok: true },
      { texto: `«${tt(to)}» ${tipo} «${tt(from)}»`, ok: false },
      { texto: `«${tt(from)}» ${otro} «${tt(to)}»`, ok: false }
    ]
    const semilla = claveNueva.length
    return base.map((o, i) => ({ ...o, orden: (i * 7 + semilla) % 3 })).sort((a, b) => a.orden - b.orden)
  })()
  const t = (id: string) => contenido.conceptos[id]?.titulo ?? id
  const vencidos = [...new Set(enemigos.map((x) => tipoPorId(x.tipoId).nombre))]
  const nAristas = nuevos.aristas.length, nConceptos = nuevos.conceptos.length
  const desbloqueado = [
    ...descubiertos.map((d) => ({ que: `Vínculo «${d}»`, nota: 'ya lo puedes trazar' })),
    ...hazanas.map((h) => ({ que: h.nombre, nota: `lente: ${h.lente}` }))
  ]

  return (
    <section className="cierre">
      {(() => {
        const ultima = (atlas.constelaciones ?? []).slice(-1)[0]
        const reciente = ultima && Date.now() - ultima.fecha < 10 * 60 * 1000
        return reciente ? (
          <div className="cierre-constelacion">
            <small>✦ CONSTELACIÓN CRISTALIZADA ✦</small>
            <b>{ultima.nombre}</b>
            <span>{ultima.conceptIds.length} estrellas · {ultima.aristas.length} vínculos, en oro para siempre en tu galaxia</span>
          </div>
        ) : null
      })()}
      <div className="cierre-cab">
        <small>·· · {reciente ? 'Tu cielo cambió' : 'Nuevo conocimiento'} · ··</small>
        <b>{reciente && !nAristas ? 'Una constelación entera quedó en oro' : (nAristas ? `${nAristas} vínculo${nAristas === 1 ? '' : 's'} nuevo${nAristas === 1 ? '' : 's'} en tu cielo${nConceptos ? ` · ${nConceptos} estrella${nConceptos === 1 ? '' : 's'} más brillante${nConceptos === 1 ? '' : 's'}` : ''}` : 'Tu cielo sigue igual: la próxima sala puede encenderlo')}</b>
      </div>
      <Galaxia contenido={contenido} atlas={atlas} modo="cierre" alto={360} nuevos={nuevos} />

      <div className="cierre-fila">
        <article className="panel cierre-tarjeta">
          <h3>Tu golpe más fuerte</h3>
          <b className="cierre-num">{mejorGolpe.dano}</b>
          <p>{mejorGolpe.trazos ? `${mejorGolpe.fichas} fichas × ${mejorGolpe.mult.toFixed(1)} en un diagrama de ${mejorGolpe.trazos} trazo${mejorGolpe.trazos === 1 ? '' : 's'}.` : 'Ningún diagrama se sostuvo esta vez.'}</p>
          <small>{vencidos.length ? `Derribaste: ${vencidos.join(', ')}` : ''}</small>
        </article>

        <article className="panel cierre-tarjeta">
          <h3>Lo que se desbloqueó</h3>
          {desbloqueado.length === 0 && nAristas === 0 ? <p>Nada nuevo esta vez. Un diagrama sostenido abre camino.</p> : (
            <ul className="cierre-lista">
              {nuevos.conceptos.slice(0, 3).map((id) => <li key={id}><i className="estrella-oro" />{t(id)} <small>sube de nivel</small></li>)}
              {desbloqueado.slice(0, 3).map((d, i) => <li key={i}><i className="estrella-cian" />{d.que} <small>{d.nota}</small></li>)}
            </ul>
          )}
        </article>

        <article className="panel cierre-tarjeta">
          <h3>Tu encargo</h3>
          {srl.encargo ? (
            <>
              <b className="panel-titulo">{srl.cumplido ? '✓ Cumplido' : 'Pendiente'}</b>
              <p>{srl.encargo.titulo}. {srl.cumplido ? 'Cumplir lo que te propusiste cura.' : 'No castiga; solo no cura.'}</p>
            </>
          ) : <p>Sin encargo en esta sala.</p>}
          {srl.sellosHechos > 0 && <small>Sellaste {srl.sellosHechos} y {srl.sellosAcertados} se sostuvieron enteros.</small>}
        </article>

        <article className="panel cierre-tarjeta marca">
          <h3>¿Qué te costó más?</h3>
          <p>Lo que marques vuelve en la próxima sala con prima.</p>
          <div className="cierre-marcas">
            {srl.candidatos.map((id) => (
              <button key={id} className={`btn chico fantasma marcar${marcado === id ? ' activo' : ''}`}
                onClick={() => setMarcado(marcado === id ? undefined : id)}>{t(id)}</button>
            ))}
            <button className={`btn chico fantasma marcar${marcado === null ? ' activo' : ''}`}
              onClick={() => setMarcado(marcado === null ? undefined : null)}>Nada me costó</button>
          </div>
        </article>
      </div>

      {pregunta && (
        <section className="panel cierre-pregunta">
          <h3>La pregunta con la que entraste</h3>
          <p className="cierre-pregunta-texto">{pregunta}</p>
          {post ? (
            <>
              {/* v6.24 · la MISMA pregunta que predijo antes de entrar: lo que importa es qué cambió */}
              <p>{prediccion ? 'Antes de entrar te pregunté esto mismo. Ahora que pasaste por la mesa:' : 'Ahora que pasaste por la mesa:'} <strong>¿qué dice el texto?</strong></p>
              <div className="cierre-opciones">
                {post.opciones.map((o) => (
                  <button key={o.texto} className={`btn ${respondido ? (o.ok ? 'primario' : 'fantasma') : 'fantasma'} opcion-pregunta`}
                    disabled={!!respondido}
                    onClick={() => { setRespondido({ acierto: o.ok }); onRespuesta?.(o.ok, prediccion?.clave === post.clave ? prediccion.ok : undefined) }}>{o.texto}</button>
                ))}
              </div>
              {respondido && (() => {
                const antes = prediccion?.clave === post.clave ? prediccion : null
                const sostuvo = nuevos.aristas.includes(claveArista(post.arista)) || !!atlas.aristas[claveArista(post.arista)]
                const cita = post.arista.evidencia || post.arista.descripcion
                const lectura = !antes ? (respondido.acierto ? 'Eso es lo que dice el texto.' : 'No: la marcada es la que dice el texto.')
                  : antes.ok === null ? (respondido.acierto ? 'Entraste sin saberlo y sales sabiéndolo.' : 'Entraste sin saberlo y todavía no está claro: la marcada es la que dice el texto.')
                  : antes.ok && respondido.acierto ? 'Lo intuías antes de entrar y lo mantuviste: ahora además lo has sostenido tú.'
                  : !antes.ok && respondido.acierto ? 'Cambiaste de idea, y el texto te da la razón. Eso es aprender.'
                  : antes.ok && !respondido.acierto ? 'Antes de entrar lo tenías y ahora dudaste: vuelve a mirar la marcada.'
                  : 'Sigue sin encajar: la marcada es la que dice el texto. Volverá a salir.'
                return (
                  <div className={respondido.acierto ? 'nota ok' : 'nota mal'}>
                    <p style={{ margin: 0 }}>{lectura}</p>
                    {antes && <p style={{ margin: '4px 0 0' }}><small>Antes de entrar dijiste: {antes.elegido ?? '«todavía no lo sé»'}</small></p>}
                    {cita && <p style={{ margin: '4px 0 0' }}><small>El texto: «{cita}»</small></p>}
                    <p style={{ margin: '4px 0 0' }}><small>{sostuvo ? 'Este vínculo ya está en tu galaxia.' : 'Este vínculo todavía no lo has sostenido en la mesa: búscalo en la próxima sala.'}</small></p>
                  </div>
                )
              })()}
            </>
          ) : opciones ? (
            <>
              <p>Con lo que acabas de sostener, ¿cuál de estas la responde?</p>
              <div className="cierre-opciones">
                {opciones.map((o) => (
                  <button key={o.texto} className={`btn ${respondido ? (o.ok ? 'primario' : 'fantasma') : 'fantasma'} opcion-pregunta`}
                    disabled={!!respondido}
                    onClick={() => { setRespondido({ acierto: o.ok }); onRespuesta?.(o.ok, undefined) }}>{o.texto}</button>
                ))}
              </div>
              {respondido && <p className={respondido.acierto ? 'nota ok' : 'nota mal'}>{respondido.acierto ? 'Eso es: lo que sostuviste en la mesa es lo que responde la pregunta.' : 'No: fíjate en la dirección y el tipo del vínculo que sostuviste.'}</p>}
            </>
          ) : (
            <p>Esta vez no sostuviste ningún vínculo nuevo: la pregunta sigue abierta para la próxima sala.</p>
          )}
        </section>
      )}
      <div className="cierre-pie">
        <button className="btn primario inicio-continuar" disabled={marcado === undefined} onClick={() => onSeguir(marcado ?? null)}>
          {marcado === undefined ? 'Marca algo para seguir' : 'Recoger el hallazgo'}
        </button>
      </div>
    </section>
  )
}

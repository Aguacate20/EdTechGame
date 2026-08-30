import type { Contenido } from '../content/types'
import {
  coberturaAtlas, contarPropuestas, estadoDe, ETIQUETA_ESTADO, nivelDe, retratoDe,
  soloConApoyo, type Atlas
} from '../engine/atlas'
import { unidadesSelladas } from '../engine/objectives'
import { GLOSA_RELACION } from '../ui/glosas'
import { descargarEdicion } from '../engine/export'
import { haceCuanto } from '../engine/savegame'
import { Panel } from './components'

/* ==========================================================================
   El Atlas como pantalla de inicio.
   Deja de ser un anexo y pasa a ser el estado del estudiante: qué tiene firme,
   qué se le resiste, qué herramientas ha ganado y qué vínculos ha descubierto.
   De aquí sale lo que se le propone en la siguiente expedición.
   ========================================================================== */

const COLOR_ESTADO: Record<string, string> = {
  dominado: '#5fa78f',
  sostenido: '#7fc0a8',
  reconocido: '#b0a06a',
  cuesta: '#c0705f',
  sin_tocar: '#4a5262'
}

export function HomeView({
  atlas, contenido, guardada, enTutorial,
  onExpedicion, onRetomar, onTutorial, onEmpezarTutorial, onCambiarTexto
}: {
  atlas: Atlas
  contenido: Contenido
  /** expedición dejada a medias, si la hay */
  guardada: { actoIdx: number; lucidez: number; aprendizaje: boolean; guardadaEn: number } | null
  onExpedicion: (conApoyo: boolean) => void
  onRetomar: () => void
  /** el tutorial se activa y se desactiva sin perder el texto que estabas usando */
  enTutorial: boolean
  onTutorial: () => void
  onEmpezarTutorial: () => void
  onCambiarTexto: () => void
}) {
  const ids = contenido.ordenConceptos
  const r = retratoDe(atlas, ids)
  const cob = coberturaAtlas(atlas, contenido)
  const selladas = unidadesSelladas(atlas, contenido)
  const p = atlas.progreso

  const relacionesPorDescubrir = Object.keys(contenido.frecuenciaRelacion)
    .filter((t) => !p.relaciones.includes(t))

  // qué propone el sistema para la siguiente expedición
  const propuesta = r.cuestan.length
    ? { texto: 'Volver sobre lo que se te resiste', detalle: r.cuestan.slice(0, 3).map((id) => contenido.conceptos[id]?.titulo).join(' · ') }
    : r.sinTocar.length
      ? { texto: 'Terreno nuevo', detalle: r.sinTocar.slice(0, 3).map((id) => contenido.conceptos[id]?.titulo).join(' · ') }
      : { texto: 'Consolidar lo que ya sostienes', detalle: 'Todo el texto tiene evidencia. Ahora toca afianzarlo.' }

  return (
    <div className="envoltura pila inicio">
      <header>
        <span className="eyebrow">{contenido.fuente}</span>
        <h1 className="display" style={{ fontSize: 34 }}>Tu Atlas</h1>
        <p className="silencio serif-lectura" style={{ maxWidth: 700, margin: 0 }}>
          Esto no es una nota. Es el mapa de en qué andas firme y en qué te estás
          atascando, construido con lo que has sostenido jugando. De aquí sale lo que
          te va a proponer la próxima expedición.
        </p>
      </header>

      {/* ------------------------------ cifras ------------------------------ */}
      <div className="fila">
        {[
          ['Cobertura', `${cob.pct}%`, ''],
          ['Vínculos trazados', `${cob.aristas}`, `/${contenido.aristas.length}`],
          ['Unidades selladas', `${selladas.length}`, `/${contenido.unidades.length}`],
          ['Expediciones', `${p.expediciones}`, atlas.victorias ? ` · ${atlas.victorias} completas` : ''],
          ['Mejor diagrama', `${Math.max(0, ...(atlas.mejoresDiagramas ?? [0]))}`, '']
        ].map(([t, v, s]) => (
          <div className="celda" key={t} style={{ flex: '1 1 140px' }}>
            <span className="eyebrow">{t}</span>
            <div style={{ fontSize: 26, fontFamily: 'var(--mono)' }}>
              {v}<span className="silencio" style={{ fontSize: 14 }}>{s}</span>
            </div>
          </div>
        ))}
      </div>

      {/* --------------------------- el arranque --------------------------- */}
      {guardada && !enTutorial && (
        <div className="arranque retomar">
          <div>
            <span className="eyebrow">Expedición a medias</span>
            <h2 className="h2" style={{ margin: '2px 0 2px' }}>
              Acto {guardada.actoIdx + 1}{guardada.aprendizaje ? ' · aprendizaje' : ''}
            </h2>
            <p className="silencio" style={{ margin: 0, fontSize: 13.5 }}>
              La dejaste {haceCuanto(guardada.guardadaEn)} con {guardada.lucidez} de lucidez.
              Vuelves con el mismo equipo y en la misma sala.
            </p>
          </div>
          <button className="btn primario grande" onClick={onRetomar}>Retomar</button>
        </div>
      )}

      <div className={`arranque${enTutorial ? ' retomar' : ''}`}>
        <div>
          <span className="eyebrow">{enTutorial ? 'Modo tutorial' : 'Siguiente expedición'}</span>
          <h2 className="h2" style={{ margin: '2px 0 2px' }}>
            {enTutorial ? 'Dos combates guiados' : propuesta.texto}
          </h2>
          <p className="silencio" style={{ margin: 0, fontSize: 13.5 }}>
            {enTutorial
              ? 'Con abejas, flores y murciélagos: aquí se aprende la mecánica, no el tema. Las cartas y los enemigos son siempre los mismos, y una guía te va diciendo qué hacer.'
              : propuesta.detalle}
          </p>
          {!enTutorial && p.expediciones > 0 && (
            <p className="dato silencio" style={{ margin: '6px 0 0' }}>
              El carril viene más duro: llevas {p.expediciones} expedición
              {p.expediciones === 1 ? '' : 'es'} a la espalda. Las lentes y las
              herramientas se arman de nuevo cada vez; lo aprendido se queda.
            </p>
          )}
        </div>
        <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
          {enTutorial ? (
            <button className="btn primario grande" onClick={onEmpezarTutorial}>
              Empezar el tutorial
            </button>
          ) : (<>
          <button className="btn primario grande" onClick={() => onExpedicion(false)}>
            {guardada ? 'Empezar otra desde cero' : 'Salir de expedición'}
          </button>
          <button
            className="btn grande" onClick={() => onExpedicion(true)}
            data-ayuda={'MODO APRENDIZAJE\nLos conceptos que no has tocado llegan enteros, las falsificaciones vienen señaladas al principio, cada sala se abre con la idea que engloba a las demás y la expedición no se pierde por quedarte sin lucidez.\n\nLa evidencia cuenta, pero queda marcada como obtenida con apoyo: para «lo dominas» hace falta al menos una vez sin andamio.'}
          >Modo aprendizaje</button>
          </>)}
        </div>
      </div>

      {/* ------------------------- lo que has ganado ------------------------ */}
      <Panel titulo="Lo que has aprendido">
        <div className="rejilla">
          <div className="celda">
            <span className="eyebrow">Vínculos que sabes trazar</span>
            <div className="fila" style={{ gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
              {p.relaciones.map((t) => (
                <span key={t} className="pastilla" data-ayuda={`${t.toUpperCase()}\n${GLOSA_RELACION[t] ?? ''}`}>
                  {t}
                </span>
              ))}
            </div>
            {relacionesPorDescubrir.length > 0 && (
              <p className="silencio" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
                Quedan {relacionesPorDescubrir.length} por descubrir. Se revelan al derribar
                enemigos: cada uno que cae te enseña un vínculo nuevo del texto.
              </p>
            )}
          </div>

          {p.terrenos.length > 0 && (
            <div className="celda">
              <span className="eyebrow">Intuiciones reubicadas</span>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                {p.terrenos.map((t) =>
                  contenido.repertorios.find((x) => x.id === t)?.etiqueta ?? t
                ).join(' · ')}
              </p>
            </div>
          )}
        </div>
      </Panel>

      {/* ------------------------ el modelo cognitivo ----------------------- */}
      <Panel titulo="Cómo andas con cada concepto">
        <div className="barra-estados">
          {(['dominados', 'sostenidos', 'reconocidos', 'cuestan', 'sinTocar'] as const).map((k) => {
            const n = r[k].length
            if (!n) return null
            const clave = k === 'sinTocar' ? 'sin_tocar' : k.slice(0, -1)
            return (
              <span
                key={k}
                style={{ flex: n, background: COLOR_ESTADO[clave === 'cuesta' ? 'cuesta' : clave] }}
                data-ayuda={`${n} concepto(s): ${ETIQUETA_ESTADO[(clave === 'cuesta' ? 'cuesta' : clave) as never]}`}
              />
            )
          })}
        </div>

        <div className="rejilla" style={{ marginTop: 12 }}>
          {ids.map((id) => {
            const c = contenido.conceptos[id]
            if (!c) return null
            const est = estadoDe(atlas.conceptos[id])
            const ev = atlas.conceptos[id]
            return (
              <div
                className="celda concepto-fila" key={id}
                style={{ borderLeft: `3px solid ${COLOR_ESTADO[est]}` }}
                data-ayuda={`${c.titulo.toUpperCase()}\n${c.definicionCorta}${
                  ev ? `\n\n${ev.aciertos} aciertos · ${ev.fallos} fallos · ${new Set(ev.mecanicas).size} herramientas · ${new Set(ev.vecinos ?? []).size} vecindades` : ''
                }`}
              >
                <div className="fila" style={{ justifyContent: 'space-between', gap: 6 }}>
                  <strong style={{ fontSize: 13.5 }}>{c.titulo}</strong>
                  {c.esUmbral && <span className="pastilla brillo">umbral</span>}
                </div>
                <p className="silencio" style={{ fontSize: 12.5, margin: '3px 0 0' }}>
                  {ETIQUETA_ESTADO[est]}
                  {soloConApoyo(ev) && <span className="con-apoyo"> · siempre con ayuda</span>}
                </p>
                <div className="barrita"><span style={{ width: `${(nivelDe(ev) / 3) * 100}%` }} /></div>
              </div>
            )
          })}
        </div>
      </Panel>

      {(() => {
        const props = Object.values(atlas.propuestas ?? {})
        if (!props.length) return null
        const { confirmadas } = contarPropuestas(atlas)
        return (
          <Panel titulo="Tu lectura">
            <p className="silencio" style={{ fontSize: 13.5, margin: '0 0 10px' }}>
              {props.length} conexión(es) que el texto no hace y tú sí.
              {confirmadas > 0 && ` De ellas, ${confirmadas} resultaron estar en el texto más adelante.`}
              {' '}No cuentan como evidencia —el autor no las afirma— pero son tuyas y van a
              la edición crítica.
            </p>
            <div className="rejilla">
              {props.slice(0, 8).map((x) => (
                <div className="celda propuesta" key={`${x.from}|${x.to}|${x.tipo}`}>
                  <strong style={{ fontSize: 13 }}>
                    {contenido.conceptos[x.from]?.titulo} <em>{x.tipo}</em>{' '}
                    {contenido.conceptos[x.to]?.titulo}
                  </strong>
                  <p className="silencio" style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {x.motivo}
                  </p>
                  {x.confirmada && (
                    <p className="dato" style={{ margin: '5px 0 0', color: '#85c4b1' }}>
                      el texto acabó dándote la razón
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )
      })()}

      {r.cuestan.length > 0 && (
        <Panel titulo="Lo que se te está resistiendo">
          <p className="silencio" style={{ fontSize: 13.5, margin: '0 0 10px' }}>
            Más fallos que aciertos. No es un reproche: es dónde conviene volver, y es lo
            que la próxima expedición te va a poner delante.
          </p>
          <div className="rejilla">
            {r.cuestan.map((id) => {
              const c = contenido.conceptos[id]
              const ev = atlas.conceptos[id]
              const confundido = Object.values(atlas.aristas).find((a) => a.from === id || a.to === id)
              return (
                <div className="celda" key={id} style={{ borderLeft: '3px solid #c0705f' }}>
                  <strong style={{ fontSize: 13.5 }}>{c?.titulo}</strong>
                  <p className="silencio" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
                    {c?.definicionCorta}
                  </p>
                  <p className="dato silencio" style={{ margin: '6px 0 0' }}>
                    {ev?.fallos} fallo(s) frente a {ev?.aciertos} acierto(s)
                    {confundido ? ' · ya lo has enlazado alguna vez' : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      <div className="fila">
        <button
          className="btn" disabled={selladas.length < contenido.unidades.length}
          onClick={() => descargarEdicion(atlas, contenido)}
        >Descargar la edición crítica</button>
        <button className="btn fantasma" onClick={onTutorial}>
          {enTutorial ? 'Salir del tutorial' : 'Tutorial'}
        </button>
        <button className="btn fantasma" onClick={onCambiarTexto}>Cambiar de texto</button>
      </div>
    </div>
  )
}

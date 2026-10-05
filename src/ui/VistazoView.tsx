import type { Contenido } from '../content/types'
import type { Atlas } from '../engine/atlas'
import { useState } from 'react'
import { vistazoDe } from '../engine/objectives'
import { prediccionDe, repasoDe } from '../engine/significativo'
import type { Nodo } from '../engine/route'

/* ==========================================================================
   El Vistazo.
   No es un resumen de lo que viene: es material MÁS GENERAL que orienta hacia
   ello, más una pregunta abierta que la sala responderá. Y se puede saltar,
   porque saltarlo es una apuesta: quien se lo salta empieza con una herramienta
   más; quien lo lee empieza con una falsificación ya señalada. Elegir es en sí
   mismo un acto de regulación, y queda registrado.
   ========================================================================== */

export function VistazoView({ nodo, contenido, atlas, onEntrar, onPrediccion, onRepaso }: {
  nodo: Nodo
  contenido: Contenido
  atlas: Atlas
  onEntrar: (leido: boolean) => void
  /** v6.24 · lo que el estudiante cree ANTES de entrar; se compara en el cierre */
  onPrediccion?: (p: { clave: string; elegido: string | null; ok: boolean | null }) => void
  /** v6.24 · repaso espaciado de una constelación antigua */
  onRepaso?: (constId: string, ok: boolean) => void
}) {
  const v = vistazoDe(contenido, nodo.conceptIds, atlas)
  // el repaso se fija al abrir la pantalla: responderlo cambia el Atlas y no debe saltar a otro
  const [repasoBruto] = useState(() => repasoDe(contenido, atlas))
  const [repasado, setRepasado] = useState<null | boolean>(null)
  const pred = v ? prediccionDe(contenido, nodo.conceptIds, v.conceptId) : null
  // si el repaso cae justo sobre el vínculo de la predicción, se omite: daría la respuesta
  const repaso = repasoBruto && repasoBruto.pregunta.clave !== pred?.clave ? repasoBruto : null
  const [predicho, setPredicho] = useState<string | null | undefined>(undefined)
  if (!v) { onEntrar(false); return null }
  const predecir = (texto: string | null, ok: boolean | null) => {
    if (!pred || predicho !== undefined) return
    setPredicho(texto); onPrediccion?.({ clave: pred.clave, elegido: texto, ok })
  }
  const visto = !pred || predicho !== undefined

  return (
    <div className="envoltura pila antesala">
      <div>
        <span className="eyebrow">
          Antes de entrar · {nodo.minutos ? `unos ${nodo.minutos} min` : 'modo aprendizaje'}
        </span>
        <h2 className="display" style={{ fontSize: 28 }}>Un vistazo, y dentro</h2>
      </div>

      {repaso && (
        <div className="bloque-previo repaso-espaciado">
          <span className="eyebrow">Repaso · «{repaso.nombre}» · hace {repaso.dias} {repaso.dias === 1 ? 'día' : 'días'}</span>
          <p style={{ margin: '2px 0 6px' }}>{repaso.pregunta.enunciado}</p>
          <div className="cierre-opciones">
            {repaso.pregunta.opciones.map((o) => (
              <button key={o.texto} className={`btn ${repasado !== null && o.ok ? 'primario' : 'fantasma'} opcion-pregunta`} disabled={repasado !== null}
                onClick={() => { setRepasado(o.ok); onRepaso?.(repaso.constId, o.ok) }}>{o.texto}</button>
            ))}
          </div>
          {repasado !== null && <p className={repasado ? 'nota ok' : 'nota mal'} style={{ margin: '6px 0 0' }}>
            {repasado ? 'Sigue ahí. Volverá a salir más adelante, cada vez más espaciado.' : 'Se había ido borrando: la correcta es la marcada. Volverá a salir pronto.'}</p>}
        </div>
      )}

      <div className="organizador">
        <div className="fila" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="eyebrow">La idea que engloba a las demás</span>
          {v.esPuerta && <span className="pastilla">concepto puerta</span>}
          {v.esUmbral && <span className="pastilla brillo">umbral</span>}
        </div>
        <h3 className="h2" style={{ margin: '4px 0 2px' }}>{v.titulo}</h3>
        {pred && (
          <div className="prediccion">
            <p style={{ margin: '6px 0' }}><strong>{pred.enunciado}</strong></p>
            <div className="cierre-opciones">
              {pred.opciones.map((o) => (
                <button key={o.texto} className={`btn ${predicho === o.texto ? 'primario' : 'fantasma'} opcion-pregunta`} disabled={predicho !== undefined}
                  onClick={() => predecir(o.texto, o.ok)}>{o.texto}</button>
              ))}
              <button className={`btn ${predicho === null ? 'primario' : 'fantasma'} opcion-pregunta`} disabled={predicho !== undefined}
                onClick={() => predecir(null, null)}>Todavía no lo sé</button>
            </div>
            {predicho !== undefined && <p className="silencio" style={{ margin: '6px 0 0', fontSize: 13 }}>
              Anotado. No te digo si acertaste: lo vas a comprobar tú en la mesa, y al salir te lo vuelvo a preguntar.</p>}
          </div>
        )}
        {/* la definición llega DESPUÉS de predecir: primero lo que tú crees, luego lo que dice el texto */}
        {visto && <p className="serif-lectura" style={{ margin: '8px 0 0' }}>{v.definicion}</p>}

        <p className="pregunta-abierta">{v.pregunta}</p>

        {v.conocidos.length > 0 && (
          <p className="silencio" style={{ margin: '8px 0 0', fontSize: 13 }}>
            Lo que ya tenías de él: {v.conocidos.map((k) => `${k.tipo} → ${k.otro}`).join(' · ')}
          </p>
        )}
        {nodo.dominios.length > 0 && (
          <p className="dominios" style={{ margin: '10px 0 0' }}>
            Esto se usa en: <strong>{nodo.dominios.join(' · ')}</strong>
          </p>
        )}
      </div>

      <div className="bloque-previo">
        <span className="eyebrow">La sala viene en tres tandas</span>
        <p className="silencio" style={{ margin: 0, fontSize: 13.5 }}>
          Primero reconocer, luego relacionar, luego sostener. Cada tanda añade conceptos
          y una herramienta, <strong>y te quita una ayuda</strong>. Y hay una regla: lo
          nuevo tiene que apoyarse en lo que ya viste, o rinde la mitad.
        </p>
      </div>

      <div className="fila" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button className="btn primario grande" onClick={() => onEntrar(true)}>
          Lo he leído · entrar
          <span className="dato"> · empiezas con una falsificación marcada</span>
        </button>
        <button className="btn grande" onClick={() => onEntrar(false)}>
          Saltar
          <span className="dato"> · empiezas con una herramienta extra</span>
        </button>
      </div>
      <span className="silencio" style={{ fontSize: 12.5 }}>
        No hay opción correcta: saltar cuando ya conoces el terreno es buena gestión.
      </span>
    </div>
  )
}

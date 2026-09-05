import type { Contenido } from '../content/types'
import type { Atlas } from '../engine/atlas'
import { vistazoDe } from '../engine/objectives'
import type { Nodo } from '../engine/route'

/* ==========================================================================
   El Vistazo.
   No es un resumen de lo que viene: es material MÁS GENERAL que orienta hacia
   ello, más una pregunta abierta que la sala responderá. Y se puede saltar,
   porque saltarlo es una apuesta: quien se lo salta empieza con una herramienta
   más; quien lo lee empieza con una falsificación ya señalada. Elegir es en sí
   mismo un acto de regulación, y queda registrado.
   ========================================================================== */

export function VistazoView({ nodo, contenido, atlas, onEntrar }: {
  nodo: Nodo
  contenido: Contenido
  atlas: Atlas
  onEntrar: (leido: boolean) => void
}) {
  const v = vistazoDe(contenido, nodo.conceptIds, atlas)
  if (!v) { onEntrar(false); return null }

  return (
    <div className="envoltura pila antesala">
      <div>
        <span className="eyebrow">
          Antes de entrar · {nodo.minutos ? `unos ${nodo.minutos} min` : 'modo aprendizaje'}
        </span>
        <h2 className="display" style={{ fontSize: 28 }}>Un vistazo, y dentro</h2>
      </div>

      <div className="organizador">
        <div className="fila" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="eyebrow">La idea que engloba a las demás</span>
          {v.esPuerta && <span className="pastilla">concepto puerta</span>}
          {v.esUmbral && <span className="pastilla brillo">umbral</span>}
        </div>
        <h3 className="h2" style={{ margin: '4px 0 2px' }}>{v.titulo}</h3>
        <p className="serif-lectura" style={{ margin: 0 }}>{v.definicion}</p>

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

import type { Contenido } from '../content/types'
import type { Encargo } from '../engine/srl'

/* Fijarse una meta comprobable antes de empezar es, junto con verle valor a la
   tarea, el mejor predictor de que alguien termine. Un toque, y queda visible
   en la barra durante toda la expedición. */

export function EncargoView({ encargos, contenido, onElegir }: {
  encargos: Encargo[]
  contenido: Contenido
  onElegir: (e: Encargo) => void
}) {
  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">El encargo</span>
        <h2 className="display" style={{ fontSize: 30 }}>¿A qué te comprometes?</h2>
        <p className="silencio serif-lectura" style={{ maxWidth: 660, margin: 0 }}>
          Una sola meta, comprobable, para toda la expedición. Se queda arriba con su
          progreso. No es obligatoria de cumplir, pero llevarla delante cambia cómo eliges
          las rutas.
        </p>
      </div>

      <div className="mano-naipes" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        {encargos.map((e) => (
          <button key={e.id} className="naipe" onClick={() => onElegir(e)} style={{ minHeight: 155 }}>
            <span className="tt">Encargo</span>
            <span className="nom">{e.nombre}</span>
            <span className="cuerpo">{e.descripcion}</span>
            <span className="cuerpo" style={{ fontStyle: 'italic', opacity: .85 }}>
              Meta: {e.meta}. {e.premio}
            </span>
          </button>
        ))}
      </div>

      {contenido.dominios.length > 0 && (
        <p className="dominios" style={{ maxWidth: 700 }}>
          Este texto se aplica en: <strong>{contenido.dominios.join(' · ')}</strong>
        </p>
      )}
    </div>
  )
}

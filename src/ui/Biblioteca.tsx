import { useEffect, useRef, useState } from 'react'
import { listarBiblioteca, type DocumentoResumen, type Sesion } from '../net/sesion'
import { nombreCapa, quitar, subir, useSubidas } from '../net/subidas'

interface Props { sesion: Sesion; onActualizado?: () => void; onVolver?: () => void }

/** La biblioteca del perfil: lo que ya subió y la caja para subir más. Cada
 *  documento se suma al mismo plan; el backend unifica los conceptos que se
 *  repiten entre lecturas y recalcula las zonas. Nada queda aislado. */
export function Biblioteca({ sesion, onVolver }: Props) {
  const [docs, setDocs] = useState<DocumentoResumen[] | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const subidas = useSubidas()
  const activas = subidas.filter((x) => x.estado === 'subiendo' || x.estado === 'procesando')
  const listas = subidas.filter((x) => x.estado === 'lista')
  const errores = subidas.filter((x) => x.estado === 'error')

  const recargar = () => listarBiblioteca(sesion.api, sesion.studentId).then(setDocs).catch(() => setDocs([]))
  useEffect(() => { void recargar() }, [sesion.studentId, listas.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="biblioteca">
      <div className="biblioteca-cab">
        <h2>Tu biblioteca</h2>
        <p>Cada lectura que subes se une a las anteriores: los conceptos repetidos se funden en uno y las zonas de tu galaxia se reorganizan. Dos textos sobre lo mismo hacen una zona más rica, no dos.</p>
      </div>
      <div className="biblioteca-caja"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void subir(f) }}>
        <p>Arrastra un PDF aquí o</p>
        <button className="btn primario" onClick={() => entrada.current?.click()}>Elegir archivo</button>
        <input ref={entrada} type="file" accept=".pdf,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { void subir(f); e.target.value = '' } }} />
        <small>Puedes cambiar de pantalla o empezar una expedición: la lectura sigue procesándose y la barra te avisa.</small>
      </div>
      {(activas.length > 0 || errores.length > 0) && (
        <ul className="subidas">
          {activas.map((x) => (
            <li key={x.jobId}>
              <span className="entrar-item-texto"><b>{x.nombre}</b><small>{x.estado === 'subiendo' ? 'Subiendo…' : `${nombreCapa(x.capa)} · ${Math.round(x.fraccion * 100)}%`}</small></span>
              <div className="barra-prog"><span style={{ width: `${Math.max(4, x.fraccion * 100)}%` }} /></div>
            </li>
          ))}
          {errores.map((x) => (
            <li key={x.jobId} className="error">
              <span className="entrar-item-texto"><b>{x.nombre}</b><small className="entrar-error">{x.error}</small></span>
              <button className="btn chico fantasma" onClick={() => quitar(x.jobId)}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      {docs === null ? <p className="entrar-nota">Buscando tus documentos…</p> : docs.length === 0 ? (
        <p className="entrar-nota">Todavía no hay documentos. El primero que subas abre tu galaxia.</p>
      ) : (
        <ul className="biblioteca-lista">
          {docs.map((d) => (
            <li key={d.id}>
              <span className="entrar-punto" aria-hidden="true" />
              <span className="entrar-item-texto">
                <b>{d.objeto ? `${d.objeto} — ${d.titulo}` : d.titulo}</b>
                <small>{d.conceptos} conceptos · {d.relaciones} relaciones</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {onVolver && <button className="btn fantasma" onClick={onVolver}>Volver</button>}
    </section>
  )
}

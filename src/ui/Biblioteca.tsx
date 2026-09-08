import { useEffect, useRef, useState } from 'react'
import { estadoJob, listarBiblioteca, subirDocumento, type DocumentoResumen, type Sesion } from '../net/sesion'

interface Props { sesion: Sesion; onActualizado: () => void; onVolver?: () => void }

/** La biblioteca del perfil: lo que ya subió y la caja para subir más. Cada
 *  documento se suma al mismo plan; el backend unifica los conceptos que se
 *  repiten entre lecturas y recalcula las zonas. Nada queda aislado. */
export function Biblioteca({ sesion, onActualizado, onVolver }: Props) {
  const [docs, setDocs] = useState<DocumentoResumen[] | null>(null)
  const [estado, setEstado] = useState<'quieto' | 'subiendo' | 'procesando' | 'error'>('quieto')
  const [detalle, setDetalle] = useState<string>('')
  const entrada = useRef<HTMLInputElement>(null)

  const recargar = () => listarBiblioteca(sesion.api, sesion.studentId).then(setDocs).catch(() => setDocs([]))
  useEffect(() => { void recargar() }, [sesion.studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function subir(archivo: File) {
    setEstado('subiendo'); setDetalle(archivo.name)
    try {
      const job = await subirDocumento(sesion.api, sesion.studentId, archivo)
      setEstado('procesando')
      for (let i = 0; i < 400; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const j = await estadoJob(sesion.api, job)
        if (j.status === 'done' || j.status === 'completed' || j.status === 'ok') break
        if (j.status === 'failed' || j.status === 'error') throw new Error(j.error || 'La extracción falló.')
      }
      setEstado('quieto'); setDetalle('')
      await recargar(); onActualizado()
    } catch (e) {
      setEstado('error'); setDetalle(e instanceof Error ? e.message : 'No se pudo subir.')
    }
  }

  return (
    <section className="biblioteca">
      <div className="biblioteca-cab">
        <h2>Tu biblioteca</h2>
        <p>Cada lectura que subes se une a las anteriores: los conceptos repetidos se funden en uno y las zonas de tu galaxia se reorganizan. Dos textos sobre lo mismo hacen una zona más rica, no dos.</p>
      </div>
      <div className={`biblioteca-caja${estado !== 'quieto' ? ' activa' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void subir(f) }}>
        {estado === 'quieto' && <>
          <p>Arrastra un PDF aquí o</p>
          <button className="btn primario" onClick={() => entrada.current?.click()}>Elegir archivo</button>
          <input ref={entrada} type="file" accept=".pdf,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f) }} />
          <small>PDF por ahora; presentaciones y Word, pronto.</small>
        </>}
        {estado === 'subiendo' && <p>Subiendo {detalle}…</p>}
        {estado === 'procesando' && <p>Leyendo el texto: conceptos, relaciones, intuiciones, argumentos, casos. Suele tardar dos o tres minutos.</p>}
        {estado === 'error' && <><p className="entrar-error" role="alert">{detalle}</p><button className="btn fantasma" onClick={() => setEstado('quieto')}>Intentar de nuevo</button></>}
      </div>
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

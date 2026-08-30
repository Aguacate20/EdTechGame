import { useState } from 'react'
import { adaptarBundle } from '../content/adapter'
import type { Contenido } from '../content/types'
import { Panel } from './components'

const BACKEND_DEF = 'https://aguacate20-edtech-extractor.hf.space'
const CACHE = 'archivo-infinito:bundle:v1'

export function BundleLoader({ onListo }: { onListo: (c: Contenido, raw: unknown) => void }) {
  const [backend, setBackend] = useState(localStorage.getItem('ai:backend') ?? BACKEND_DEF)
  const [student, setStudent] = useState(localStorage.getItem('ai:student') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [preview, setPreview] = useState<Contenido | null>(null)
  const [raw, setRaw] = useState<unknown>(null)

  const aceptar = (json: unknown, guardar: boolean) => {
    try {
      const c = adaptarBundle(json)
      if (Object.keys(c.conceptos).length === 0) {
        setError('El archivo no trae conceptos. ¿Es el bundle del extractor o el plan?')
        return
      }
      if (guardar) { try { localStorage.setItem(CACHE, JSON.stringify(json)) } catch { /* cuota */ } }
      setPreview(c); setRaw(json); setError(null)
    } catch (e) {
      setError(`No se pudo leer el bundle: ${(e as Error).message}`)
    }
  }

  const traer = async () => {
    setCargando(true); setError(null)
    try {
      const base = backend.replace(/\/+$/, '')
      const url = student.trim()
        ? `${base}/students/${student.trim()}/bundle`
        : `${base}/bundle`
      const r = await fetch(url)
      if (!r.ok) throw new Error(`el backend respondió ${r.status}`)
      aceptar(await r.json(), true)
      localStorage.setItem('ai:backend', backend)
      localStorage.setItem('ai:student', student)
    } catch (e) {
      setError(`No se pudo traer el bundle: ${(e as Error).message}. Si el backend bloquea el navegador por CORS, sube el archivo a mano.`)
    } finally {
      setCargando(false)
    }
  }

  const subir = async (f: File | undefined) => {
    if (!f) return
    try { aceptar(JSON.parse(await f.text()), true) }
    catch (e) { setError(`El archivo no es JSON válido: ${(e as Error).message}`) }
  }

  const demo = async () => {
    setCargando(true)
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}bundles/demo.json`)
      aceptar(await r.json(), false)
    } catch (e) {
      setError(`No se encontró el bundle de muestra: ${(e as Error).message}`)
    } finally { setCargando(false) }
  }

  const cache = () => {
    const raw_ = localStorage.getItem(CACHE)
    if (!raw_) { setError('No hay ningún bundle guardado todavía.'); return }
    aceptar(JSON.parse(raw_), false)
  }

  return (
    <div className="envoltura pila">
      <header className="pila" style={{ gap: 6, marginTop: 20 }}>
        <span className="eyebrow">Roguelike deckbuilder cognitivo</span>
        <h1 className="display">El Archivo Infinito</h1>
        <p className="serif-lectura silencio" style={{ maxWidth: 620, margin: 0 }}>
          Un texto académico se convierte en un mapa de ideas. Tú reconstruyes ese mapa
          jugando: eliges los verbos con los que piensas, apuestas cuánto confías en cada
          jugada y ganas terreno cuando el texto sostiene lo que afirmaste.
        </p>
      </header>

      <div className="fila" style={{ alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 340px' }}>
          <Panel titulo="Traer el bundle del extractor">
            <div className="pila" style={{ gap: 10 }}>
              <label className="campo">
                <span className="eyebrow">Backend</span>
                <input type="url" value={backend} onChange={(e) => setBackend(e.target.value)} />
              </label>
              <label className="campo">
                <span className="eyebrow">ID de estudiante</span>
                <input
                  type="text" value={student} placeholder="faca6ea7-…"
                  onChange={(e) => setStudent(e.target.value)}
                />
              </label>
              <div className="fila">
                <button className="btn primario" onClick={traer} disabled={cargando}>
                  {cargando ? 'Trayendo…' : 'Traer bundle'}
                </button>
                <button className="btn fantasma" onClick={cache}>Usar el último guardado</button>
              </div>
            </div>
          </Panel>
        </div>

        <div style={{ flex: '1 1 300px' }}>
          <Panel titulo="O cargarlo a mano">
            <div className="pila" style={{ gap: 10 }}>
              <p className="silencio" style={{ margin: 0, fontSize: 14 }}>
                Arrastra el <code className="dato">bundle.json</code> que genera el extractor.
                Nada sale de tu equipo: el juego lo lee en el navegador.
              </p>
              <input
                type="file" accept="application/json"
                onChange={(e) => subir(e.target.files?.[0])}
                style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
              />
              <button className="btn fantasma" onClick={demo} disabled={cargando}>
                Jugar con el bundle de muestra
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {error && <div className="aviso">{error}</div>}

      {preview && (
        <Panel titulo="Lo que este texto sí sostiene">
          <p className="silencio" style={{ marginTop: 0, fontSize: 14 }}>
            {preview.fuente} · bundle {preview.bundleVersion} · schema {preview.schema}
          </p>
          <table className="tabla">
            <thead>
              <tr><th>Capa</th><th>Estado</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {preview.diagnostico.map((d) => (
                <tr key={d.clave}>
                  <td>{d.clave}</td>
                  <td>
                    <span className={`chip ${d.estado === 'ok' ? 'verde' : d.estado === 'parcial' ? 'laton' : 'rojo'}`}>
                      {d.estado === 'ok' ? 'disponible' : d.estado === 'parcial' ? 'parcial' : 'ausente'}
                    </span>
                  </td>
                  <td className="silencio">{d.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fila" style={{ marginTop: 16 }}>
            <button className="btn primario" onClick={() => onListo(preview, raw)}>
              Entrar al Archivo
            </button>
          </div>
        </Panel>
      )}
    </div>
  )
}

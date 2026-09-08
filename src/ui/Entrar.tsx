import { useEffect, useState } from 'react'
import { adaptarBundle } from '../content/adapter'
import type { Contenido } from '../content/types'
import { BundleLoader } from './BundleLoader'
import { Biblioteca } from './Biblioteca'
import { iniciarSubidas, useSubidas } from '../net/subidas'
import {
  API_POR_DEFECTO, cargarPlan, entrar, guardarSesion, leerSesion, listarPerfiles,
  type PerfilResumen, type Sesion
} from '../net/sesion'

interface Props { onListo: (c: Contenido, sesion: Sesion | null) => void }

/** Entrar, como el menú del extractor: se elige un perfil existente o se crea
 *  uno nuevo, y se elige el campo publicado (o se escribe un código). Sin
 *  contraseña. Sin código de campo, el cargador manual de siempre. */
export function Entrar({ onListo }: Props) {
  const previa = leerSesion()
  const [api, setApi] = useState(previa?.api ?? API_POR_DEFECTO)
  const [perfiles, setPerfiles] = useState<PerfilResumen[] | null>(null)
  const [perfil, setPerfil] = useState<PerfilResumen | 'nuevo' | null>(null)
  const [nombre, setNombre] = useState('')
  const [sinMaterial, setSinMaterial] = useState<Sesion | null>(null)
  const subidas = useSubidas()
  const primeraLista = subidas.some((x) => x.estado === 'lista')
  useEffect(() => {
    if (!sinMaterial || !primeraLista) return
    void cargarPlan(base, sinMaterial.studentId).then((plan) => { if (plan) onListo(adaptarBundle(plan), sinMaterial) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primeraLista])
  const [manual, setManual] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sinRed, setSinRed] = useState(false)

  const base = api.trim().replace(/\/+$/, '')

  useEffect(() => {
    let vivo = true
    setPerfiles(null); setSinRed(false)
    listarPerfiles(base)
      .then((p) => {
        if (!vivo) return
        setPerfiles(p)
        // se preselecciona lo de la última vez
        const mio = previa ? p.find((x) => x.id === previa.studentId) : undefined
        if (mio) setPerfil(mio)
      })
      .catch(() => { if (vivo) { setPerfiles([]); setSinRed(true) } })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base])

  const quienListo = perfil === 'nuevo' ? nombre.trim().length >= 2 : perfil !== null
  const listo = quienListo && !ocupado

  async function ir() {
    setOcupado(true); setError(null)
    try {
      const quien = perfil === 'nuevo'
        ? await entrar(base, nombre.trim())
        : { studentId: perfil!.id, codigoJugador: perfil!.codigoJugador }
      const sesion: Sesion = {
        api: base, nombre: perfil === 'nuevo' ? nombre.trim() : perfil!.nombre,
        studentId: quien.studentId, codigoJugador: quien.codigoJugador,
        campo: 'plan', campoId: 'plan', campoNombre: 'Tu galaxia'
      }
      guardarSesion(sesion)
      const plan = await cargarPlan(base, quien.studentId)
      if (!plan) { iniciarSubidas(sesion); setSinMaterial(sesion); setOcupado(false); return }
      onListo(adaptarBundle(plan), sesion)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar.')
      setOcupado(false)
    }
  }

  if (sinMaterial) {
    return (
      <div className="entrar">
        <div className="entrar-tarjeta ancha">
          <div className="marca-lc" aria-label="LudusCog">
            <span className="orbita" aria-hidden="true" />
            <span className="nombre"><b>Ludus<span>Cog</span></b><small>aprender · entender · avanzar</small></span>
          </div>
          <h1 className="entrar-titulo">Hola, {sinMaterial.nombre}. Tu galaxia está vacía: sube tu primera lectura.</h1>
          <Biblioteca
            sesion={sinMaterial}
            onVolver={() => setSinMaterial(null)}
          />
        </div>
      </div>
    )
  }

  if (manual) {
    return (
      <div className="entrar">
        <button className="btn fantasma" onClick={() => setManual(false)}>Volver a entrar con perfil</button>
        <BundleLoader onListo={(c) => onListo(c, null)} />
      </div>
    )
  }

  return (
    <div className="entrar">
      <div className="entrar-tarjeta">
        <div className="marca-lc" aria-label="LudusCog">
          <span className="orbita" aria-hidden="true" />
          <span className="nombre"><b>Ludus<span>Cog</span></b><small>aprender · entender · avanzar</small></span>
        </div>
        <h1 className="entrar-titulo">Tu galaxia de conocimiento empieza con un nombre.</h1>

        <fieldset className="entrar-grupo">
          <legend>¿Quién juega?</legend>
          {perfiles === null ? <p className="entrar-nota">Buscando perfiles…</p> : (
            <div className="entrar-lista" role="listbox" aria-label="Perfiles">
              {perfiles.map((p) => (
                <button
                  key={p.id} type="button" role="option" aria-selected={perfil !== 'nuevo' && perfil?.id === p.id}
                  className={`entrar-item${perfil !== 'nuevo' && perfil?.id === p.id ? ' elegido' : ''}`}
                  onClick={() => setPerfil(p)}
                >
                  <span className="chip-inicial" aria-hidden="true">{p.nombre[0] ?? '?'}</span>
                  <span className="entrar-item-texto"><b>{p.nombre}</b><small><code>{p.codigoJugador}</code></small></span>
                </button>
              ))}
              <button
                type="button" role="option" aria-selected={perfil === 'nuevo'}
                className={`entrar-item nuevo${perfil === 'nuevo' ? ' elegido' : ''}`}
                onClick={() => setPerfil('nuevo')}
              >
                <span className="chip-inicial" aria-hidden="true">+</span>
                <span className="entrar-item-texto"><b>Crear perfil nuevo</b><small>{sinRed ? 'Sin conexión con el servidor' : 'Solo un nombre, sin contraseña'}</small></span>
              </button>
            </div>
          )}
          {perfil === 'nuevo' && (
            <label className="campo">
              <span>Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cómo quieres que te llame Andy" autoFocus maxLength={40} />
            </label>
          )}
        </fieldset>


        {error && <p className="entrar-error" role="alert">{error}</p>}
        <button className="btn primario entrar-ir" disabled={!listo} onClick={ir}>
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
        <details className="entrar-mas">
          <summary>Opciones</summary>
          <label className="campo">
            <span>Servidor</span>
            <input value={api} onChange={(e) => setApi(e.target.value)} />
          </label>
          <button className="enlace" onClick={() => setManual(true)}>Cargar un bundle a mano o probar la demo</button>
        </details>
      </div>
    </div>
  )
}

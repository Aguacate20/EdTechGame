import { useState } from 'react'
import { adaptarBundle } from '../content/adapter'
import type { Contenido } from '../content/types'
import { BundleLoader } from './BundleLoader'
import {
  API_POR_DEFECTO, cargarCampo, entrar, guardarSesion, leerSesion, type Sesion
} from '../net/sesion'

interface Props { onListo: (c: Contenido, sesion: Sesion | null) => void }

/** Entrar: un nombre y el código del campo. Con un código de jugador se
 *  recupera un perfil de otro dispositivo. Sin código de campo, el cargador
 *  manual de siempre (demo o un bundle propio). */
export function Entrar({ onListo }: Props) {
  const previa = leerSesion()
  const [nombre, setNombre] = useState(previa?.nombre ?? '')
  const [campo, setCampo] = useState(previa?.campo ?? '')
  const [recuperar, setRecuperar] = useState(false)
  const [codigoJugador, setCodigoJugador] = useState('')
  const [api, setApi] = useState(previa?.api ?? API_POR_DEFECTO)
  const [manual, setManual] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listo = nombre.trim().length >= 2 && campo.trim().length >= 4 && !ocupado

  async function ir() {
    setOcupado(true); setError(null)
    try {
      const base = api.trim().replace(/\/+$/, '')
      const perfil = previa && previa.nombre === nombre.trim() && !recuperar
        ? { studentId: previa.studentId, codigoJugador: previa.codigoJugador }
        : await entrar(base, nombre.trim(), recuperar ? codigoJugador.trim() : undefined)
      const c = await cargarCampo(base, campo.trim().toUpperCase())
      const sesion: Sesion = {
        api: base, nombre: nombre.trim(), studentId: perfil.studentId, codigoJugador: perfil.codigoJugador,
        campo: campo.trim().toUpperCase(), campoId: c.campoId, campoNombre: c.nombre
      }
      guardarSesion(sesion)
      onListo(adaptarBundle(c.bundle), sesion)
    } catch (e) {
      setError(e instanceof Error && /campo/i.test(e.message) ? 'No hay un campo con ese código. Pídeselo a tu profesor.' : e instanceof Error ? e.message : 'No se pudo entrar.')
      setOcupado(false)
    }
  }

  if (manual) {
    return (
      <div className="entrar">
        <button className="btn fantasma" onClick={() => setManual(false)}>Volver a entrar con código</button>
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
        <p className="entrar-sub">El código del campo te lo da tu profesor. No hay contraseña.</p>
        <label className="campo">
          <span>Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cómo quieres que te llame Andy" autoFocus maxLength={40} />
        </label>
        <label className="campo">
          <span>Código del campo</span>
          <input value={campo} onChange={(e) => setCampo(e.target.value.toUpperCase())} placeholder="LJH7K2" maxLength={8} className="codigo" aria-invalid={error ? true : undefined} />
        </label>
        {recuperar ? (
          <label className="campo">
            <span>Código de jugador (de tu otro dispositivo)</span>
            <input value={codigoJugador} onChange={(e) => setCodigoJugador(e.target.value.toUpperCase())} placeholder="A1B2C3" maxLength={8} className="codigo" />
          </label>
        ) : (
          <button className="enlace" onClick={() => setRecuperar(true)}>Ya tengo un código de jugador</button>
        )}
        {error && <p className="entrar-error" role="alert">{error}</p>}
        <button className="btn primario entrar-ir" disabled={!listo} onClick={ir}>
          {ocupado ? 'Entrando…' : 'Entrar al campo'}
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

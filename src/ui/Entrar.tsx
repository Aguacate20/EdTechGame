import { useEffect, useState } from 'react'
import { adaptarBundle } from '../content/adapter'
import type { Contenido } from '../content/types'
import { BundleLoader } from './BundleLoader'
import {
  API_POR_DEFECTO, cargarCampo, entrar, guardarSesion, leerSesion, listarCampos, listarPerfiles,
  type CampoResumen, type PerfilResumen, type Sesion
} from '../net/sesion'

interface Props { onListo: (c: Contenido, sesion: Sesion | null) => void }

/** Entrar, como el menú del extractor: se elige un perfil existente o se crea
 *  uno nuevo, y se elige el campo publicado (o se escribe un código). Sin
 *  contraseña. Sin código de campo, el cargador manual de siempre. */
export function Entrar({ onListo }: Props) {
  const previa = leerSesion()
  const [api, setApi] = useState(previa?.api ?? API_POR_DEFECTO)
  const [perfiles, setPerfiles] = useState<PerfilResumen[] | null>(null)
  const [campos, setCampos] = useState<CampoResumen[] | null>(null)
  const [perfil, setPerfil] = useState<PerfilResumen | 'nuevo' | null>(null)
  const [nombre, setNombre] = useState('')
  const [campo, setCampo] = useState<CampoResumen | null>(null)
  const [codigo, setCodigo] = useState('')
  const [manual, setManual] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sinRed, setSinRed] = useState(false)

  const base = api.trim().replace(/\/+$/, '')

  useEffect(() => {
    let vivo = true
    setPerfiles(null); setCampos(null); setSinRed(false)
    Promise.all([listarPerfiles(base), listarCampos(base)])
      .then(([p, c]) => {
        if (!vivo) return
        setPerfiles(p); setCampos(c)
        // se preselecciona lo de la última vez
        const mio = previa ? p.find((x) => x.id === previa.studentId) : undefined
        if (mio) setPerfil(mio)
        const suyo = previa ? c.find((x) => x.campoId === previa.campoId) : undefined
        if (suyo) setCampo(suyo)
      })
      .catch(() => { if (vivo) { setPerfiles([]); setCampos([]); setSinRed(true) } })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base])

  const quienListo = perfil === 'nuevo' ? nombre.trim().length >= 2 : perfil !== null
  const campoCodigo = campo ? campo.codigo : codigo.trim().toUpperCase()
  const listo = quienListo && campoCodigo.length >= 4 && !ocupado

  async function ir() {
    setOcupado(true); setError(null)
    try {
      const quien = perfil === 'nuevo'
        ? await entrar(base, nombre.trim())
        : { studentId: perfil!.id, codigoJugador: perfil!.codigoJugador }
      const c = await cargarCampo(base, campoCodigo)
      const sesion: Sesion = {
        api: base, nombre: perfil === 'nuevo' ? nombre.trim() : perfil!.nombre,
        studentId: quien.studentId, codigoJugador: quien.codigoJugador,
        campo: campoCodigo, campoId: c.campoId, campoNombre: c.nombre
      }
      guardarSesion(sesion)
      onListo(adaptarBundle(c.bundle), sesion)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(/campo/i.test(msg) ? 'No hay un campo con ese código. Pídeselo a tu profesor.' : msg || 'No se pudo entrar.')
      setOcupado(false)
    }
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

        <fieldset className="entrar-grupo">
          <legend>¿En qué campo?</legend>
          {campos === null ? <p className="entrar-nota">Buscando campos publicados…</p> : campos.length === 0 ? (
            <p className="entrar-nota">{sinRed ? 'No se pudo llegar al servidor. Revisa la dirección en Opciones.' : 'Todavía no hay campos publicados. Escribe el código que te dio tu profesor.'}</p>
          ) : (
            <div className="entrar-lista" role="listbox" aria-label="Campos">
              {campos.map((c) => (
                <button
                  key={c.campoId} type="button" role="option" aria-selected={campo?.campoId === c.campoId}
                  className={`entrar-item${campo?.campoId === c.campoId ? ' elegido' : ''}`}
                  onClick={() => { setCampo(c); setCodigo('') }}
                >
                  <span className="entrar-punto" aria-hidden="true" />
                  <span className="entrar-item-texto"><b>{c.nombre}</b><small><code>{c.codigo}</code>{c.conceptos ? ` · ${c.conceptos} conceptos` : ''}</small></span>
                </button>
              ))}
            </div>
          )}
          <label className="campo">
            <span>O un código de campo</span>
            <input
              value={codigo} onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setCampo(null) }}
              placeholder="LJH7K2" maxLength={8} className="codigo" aria-invalid={error ? true : undefined}
            />
          </label>
        </fieldset>

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

import type { ReactNode } from 'react'
import type { Atlas } from '../engine/atlas'
import { hallazgosDe, lucidezDe, nivelDe, xpDe, type Sesion } from '../net/sesion'

export type Pestana = 'expedicion' | 'mision' | 'coleccion' | 'taller' | 'logros'

interface Props {
  sesion: Sesion | null
  atlas: Atlas | null
  activa: Pestana
  onPestana: (p: Pestana) => void
  onSalir?: () => void
  children?: ReactNode
}

const PESTANAS: { id: Pestana; nombre: string; lista: boolean }[] = [
  { id: 'expedicion', nombre: 'Expedición', lista: true },
  { id: 'mision', nombre: 'Misión', lista: false },
  { id: 'coleccion', nombre: 'Colección', lista: true },
  { id: 'taller', nombre: 'Taller', lista: false },
  { id: 'logros', nombre: 'Logros', lista: true }
]

/** La barra de LudusCog: marca, pestañas, quién juega, Lucidez y Hallazgos.
 *  Lucidez = calibración del Atlas (apuestas acertadas / apuestas). Hallazgos
 *  = vínculos ganados + propuestas propias. El nivel sale del XP del Atlas. */
export function Shell({ sesion, atlas, activa, onPestana, onSalir, children }: Props) {
  const lucidez = lucidezDe(atlas)
  const xp = xpDe(atlas)
  const { nivel, enNivel, paraSiguiente } = nivelDe(xp)
  const hallazgos = hallazgosDe(atlas)
  const r = 15, circ = 2 * Math.PI * r
  return (
    <header className="ludus">
      <div className="ludus-marca" aria-label="LudusCog">
        <span className="ludus-glifo" aria-hidden="true">✦</span>
        <span>Ludus<b>Cog</b></span>
        <small>{sesion?.campoNombre ?? 'El Archivo Infinito'}</small>
      </div>
      <nav className="ludus-nav" aria-label="Secciones">
        {PESTANAS.map((p) => (
          <button
            key={p.id} className={`ludus-tab${activa === p.id ? ' activa' : ''}`}
            aria-current={activa === p.id ? 'page' : undefined}
            disabled={!p.lista} title={p.lista ? undefined : 'Pronto'}
            onClick={() => onPestana(p.id)}
          >{p.nombre}</button>
        ))}
      </nav>
      <div className="ludus-chips">
        <div className="chip perfil" title={sesion ? `Código de jugador ${sesion.codigoJugador}` : 'Sin perfil'}>
          <span className="chip-inicial" aria-hidden="true">{(sesion?.nombre ?? 'A')[0]}</span>
          <span className="chip-texto">
            <b>{sesion?.nombre ?? 'Anónimo'}</b>
            <small>Nivel {nivel} · {enNivel}/{paraSiguiente} XP{sesion ? ` · ${sesion.codigoJugador}` : ''}</small>
          </span>
        </div>
        <div className="chip lucidez" title="Lucidez: cuántas veces tu apuesta coincidió con el resultado">
          <svg viewBox="0 0 36 36" width="34" height="34" aria-hidden="true">
            <circle cx="18" cy="18" r={r} className="anillo-fondo" />
            <circle cx="18" cy="18" r={r} className="anillo" strokeDasharray={`${(lucidez / 100) * circ} ${circ}`} transform="rotate(-90 18 18)" />
          </svg>
          <span className="chip-texto"><small>Lucidez</small><b>{lucidez}%</b></span>
        </div>
        <div className="chip hallazgos" title="Vínculos ganados y propuestas propias">
          <span className="chip-texto"><small>Hallazgos</small><b>{hallazgos}</b></span>
        </div>
        {children}
        {onSalir && <button className="btn fantasma" onClick={onSalir} title="Cambiar de campo o de perfil">Salir</button>}
      </div>
    </header>
  )
}

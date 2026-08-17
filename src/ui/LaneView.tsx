import { faseJefe, LARGO_CARRIL, tipoPorId, type Enemigo } from '../engine/lane'
import { Retrato } from './assets'
import { sfx } from './sfx'
import { useEffect, useRef } from 'react'

/* El carril: el jugador a la izquierda, los enemigos entrando por la derecha.
   Cada afirmación es un turno; cada turno se acercan. */

function Silueta({ tipoId }: { tipoId: string }) {
  const p = { viewBox: '0 0 40 40', width: 34, height: 34 }
  switch (tipoId) {
    case 'copista':
      return <svg {...p}><path d="M20 8l5 14-5 4-5-4z" fill="currentColor" /><path d="M20 26v8M13 34h14" stroke="currentColor" strokeWidth="2.4" /></svg>
    case 'errata':
      return <svg {...p}><path d="M10 30l10-20 4 8 6-6-4 18z" fill="currentColor" /></svg>
    case 'rumor':
      return <svg {...p}><circle cx="20" cy="20" r="6" fill="currentColor" /><circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".65" /><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="1" opacity=".35" /></svg>
    case 'apocrifo':
      return <svg {...p}><path d="M12 32V14a8 8 0 0116 0v18z" fill="currentColor" opacity=".45" /><path d="M16 32V14a8 8 0 0116 0v18z" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>
    case 'notaalpie':
      return <svg {...p}><path d="M11 9h14l5 5v18H11z" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M15 24h12M15 28h8" stroke="currentColor" strokeWidth="1.8" opacity=".7" /></svg>
    case 'dogma':
      return <svg {...p}><path d="M20 7l11 5v10c0 7-5 12-11 14-6-2-11-7-11-14V12z" fill="none" stroke="currentColor" strokeWidth="2.6" /><path d="M20 15v10" stroke="currentColor" strokeWidth="2.6" /></svg>
    case 'eco':
      return <svg {...p} opacity=".7"><path d="M20 8l5 14-5 4-5-4z" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M20 26v8M13 34h14" stroke="currentColor" strokeWidth="2.2" /><path d="M20 11l3 9-3 3-3-3z" fill="currentColor" opacity=".3" /></svg>
    case 'cita':
      return <svg {...p}><path d="M8 14q6-6 10 0T28 14" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M14 20h12l-3 12h-6z" fill="currentColor" opacity=".6" /></svg>
    case 'palimpsesto':
      return <svg {...p}><path d="M9 10h22v22H9z" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M9 17h22M9 24h22" stroke="currentColor" strokeWidth="1.2" opacity=".5" /><path d="M13 30L30 12" stroke="currentColor" strokeWidth="2.4" /></svg>
    case 'bibliografia':
      return <svg {...p}><path d="M10 12h7v20h-7zM19 10h6v22h-6zM27 14h5v18h-5z" fill="currentColor" opacity=".75" /></svg>
    case 'ortodoxia':
      return <svg {...p}><path d="M20 6l12 7v14l-12 7-12-7V13z" fill="none" stroke="currentColor" strokeWidth="2.6" /><circle cx="20" cy="20" r="4" fill="currentColor" /></svg>
    case 'tratado':
      return <svg {...p}><path d="M13 5H7v30h6M27 5h6v30h-6" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M20 12v16M14 18l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>
    default:
      return <svg {...p}><circle cx="20" cy="20" r="9" fill="currentColor" /></svg>
  }
}

function Copista({ gesto }: { gesto: 'quieto' | 'afirma' | 'herido' }) {
  return (
    <svg className={`copista copista-${gesto}`} viewBox="0 0 40 44" width={40} height={44} aria-hidden>
      <path d="M20 6l6 16-6 5-6-5z" fill="currentColor" />
      <path d="M20 27v10M12 37h16" stroke="currentColor" strokeWidth="3" />
      <circle cx="20" cy="18" r="2" fill="var(--tinta)" />
    </svg>
  )
}

export function LaneView({ enemigos, lucidez, lucidezMax, alcance, gesto, ultimosImpactos }: {
  enemigos: Enemigo[]
  lucidez: number
  lucidezMax: number
  /** cuántos enemigos alcanzaría la afirmación que estás montando */
  alcance: number
  gesto: 'quieto' | 'afirma' | 'herido'
  ultimosImpactos: { uid: string; dano: number }[]
}) {
  const vivos = enemigos.filter((e) => e.hp > 0).sort((a, b) => a.posicion - b.posicion)
  const gestosPrevios = useRef<Record<string, string>>({})

  useEffect(() => {
    for (const e of enemigos) {
      const antes = gestosPrevios.current[e.uid]
      if (antes !== e.gesto) {
        if (e.gesto === 'golpea') sfx.golpe()
        else if (e.gesto === 'critico') sfx.critico()
        else if (e.gesto === 'herido') sfx.golpe()
        else if (e.gesto === 'cae') sfx.cae()
        else if (e.gesto === 'avanza') sfx.paso()
        gestosPrevios.current[e.uid] = e.gesto
      }
    }
  }, [enemigos])
  const enMira = new Set(vivos.slice(0, Math.max(0, alcance)).map((e) => e.uid))

  return (
    <div className="carril">
      <div className="carril-jugador">
        <Retrato
          familia="jugador" id="copista" alt="El Copista"
          tamano={40} gesto={gesto}
          respaldo={<Copista gesto={gesto} />}
        />
        <div>
          <span className="eyebrow">El Copista</span>
          <div className="vida ancha"><span style={{ width: `${(lucidez / lucidezMax) * 100}%` }} /></div>
          <span className="dato silencio">{lucidez}/{lucidezMax}</span>
        </div>
      </div>

      <div className="carril-pista" role="list">
        {Array.from({ length: LARGO_CARRIL }, (_, i) => i + 1).map((casilla) => {
          const aqui = vivos.filter((e) => e.posicion === casilla)
          return (
            <div className="casilla" key={casilla} role="listitem">
              <span className="numero">{casilla}</span>
              {aqui.map((e) => {
                const t = tipoPorId(e.tipoId)
                const impacto = ultimosImpactos.find((x) => x.uid === e.uid)
                const fase = faseJefe(e)
                return (
                  <div
                    key={e.uid}
                    className={`bicho bicho-${e.gesto}${enMira.has(e.uid) ? ' en-mira' : ''}`}
                    title={`${e.nombre} — ${t.glosa}`}
                  >
                    {impacto && <span className="flotante">−{impacto.dano}</span>}
                    <Retrato
                      familia="enemigos" id={e.tipoId} alt={e.nombre}
                      tamano={34} gesto={e.gesto}
                      respaldo={<Silueta tipoId={e.tipoId} />}
                    />
                    <span className="nom">{e.nombre}</span>
                    <div className="vida"><span style={{ width: `${(e.hp / e.hpMax) * 100}%` }} /></div>
                    <span className="rasgo">
                      {t.alcance >= LARGO_CARRIL ? 'alcance total'
                        : t.velocidad === 0 ? 'no avanza'
                        : `${t.velocidad} casilla${t.velocidad > 1 ? 's' : ''}/turno`}
                    </span>
                    {fase && <span className="fase">exige {fase}</span>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

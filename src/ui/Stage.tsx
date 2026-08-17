import type { Golpe, Resolucion } from '../engine/combat'
import { AMENAZAS, type Enemigo } from '../engine/threats'
import { familiasDeArquetipo, type ArquetipoId } from '../engine/encounters'

/* Los enemigos son marginalia: manchas de tinta y marcas de anotación que crecen
   hasta ser figuras. El Eco es un calco translúcido del propio jugador, porque
   literalmente es tu intuición previa. */

function Figura({ id, gesto }: { id: ArquetipoId; gesto: Enemigo['gesto'] }) {
  const p = { className: `fig fig-${gesto}`, viewBox: '0 0 64 64', width: 64, height: 64 }
  switch (id) {
    case 'vacio':
      return (
        <svg {...p} aria-hidden>
          <circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="4 5" />
          <circle cx="32" cy="32" r="9" fill="var(--tinta)" />
          <path d="M14 46q18 8 36 0" fill="none" stroke="currentColor" strokeWidth="2" opacity=".6" />
        </svg>
      )
    case 'confuso':
      return (
        <svg {...p} aria-hidden>
          <path d="M20 50V30a10 10 0 0120 0v20z" fill="currentColor" opacity=".45" />
          <path d="M26 50V30a10 10 0 0120 0v20z" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="30" cy="22" r="5" fill="currentColor" opacity=".45" />
          <circle cx="36" cy="22" r="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      )
    case 'espejo':
      return (
        <svg {...p} aria-hidden>
          <path d="M30 12v40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M27 18L10 46h17z" fill="currentColor" opacity=".55" />
          <path d="M33 18l17 28H33z" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      )
    case 'eco':
      return (
        <svg {...p} aria-hidden>
          <g opacity=".55">
            <path d="M32 14l7 20-7 6-7-6z" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M32 40v10" stroke="currentColor" strokeWidth="2.5" />
            <path d="M22 52h20" stroke="currentColor" strokeWidth="2.5" />
          </g>
          <path d="M32 18l5 15-5 4-5-4z" fill="currentColor" opacity=".22" />
        </svg>
      )
    case 'enjambre':
      return (
        <svg {...p} aria-hidden>
          {[[20, 22], [32, 16], [44, 24], [16, 36], [30, 32], [46, 38], [24, 48], [38, 48]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 5 : 3.4} fill="currentColor" opacity={i % 2 ? 0.75 : 0.45} />
          ))}
        </svg>
      )
    case 'caso':
      return (
        <svg {...p} aria-hidden>
          <path d="M16 12h24l10 10v30H16z" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M40 12v10h10" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M22 32h20M22 40h14" stroke="currentColor" strokeWidth="2" opacity=".7" />
        </svg>
      )
    case 'arquitecto':
      return (
        <svg {...p} aria-hidden>
          <path d="M12 12h40v40H12z" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M32 12v40M12 32h40" stroke="currentColor" strokeWidth="1.5" opacity=".7" />
          <circle cx="22" cy="22" r="4" fill="currentColor" />
          <circle cx="43" cy="43" r="4" fill="currentColor" opacity=".5" />
        </svg>
      )
    case 'marco':
      return (
        <svg {...p} aria-hidden>
          <path d="M22 8h-8v48h8M42 8h8v48h-8" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <path d="M32 20v24M24 26l8-8 8 8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      )
  }
}

function Copista({ gesto }: { gesto: 'quieto' | 'ataca' | 'herido' | 'lee' | 'cura' }) {
  return (
    <svg className={`fig copista copista-${gesto}`} viewBox="0 0 64 64" width={72} height={72} aria-hidden>
      <path d="M32 10l8 24-8 8-8-8z" fill="currentColor" opacity=".9" />
      <path d="M32 42v12" stroke="currentColor" strokeWidth="3" />
      <path d="M20 56h24" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="26" r="2.4" fill="var(--tinta)" />
    </svg>
  )
}

const TEXTO_GOLPE: Record<Golpe, string> = {
  limpio: 'Golpe limpio',
  critico_rareza: '¡Crítico! Vínculo poco frecuente',
  critico_apuesta: '¡Crítico! Apostaste y acertaste',
  torpe: 'Golpe torpe: improvisaste',
  resistido: 'Resiste: ese trabajo no lo toca',
  estabilizado: 'Intuición estabilizada',
  fallido: 'Mantiene su versión',
  pausa: 'La intuición sigue ahí'
}

export function Stage({ enemigos, objetivo, onApuntar, seleccionable, ultima, lucidez, lucidezMax, gestoCopista }: {
  enemigos: Enemigo[]
  objetivo: string | null
  onApuntar: (uid: string) => void
  seleccionable: boolean
  ultima: Resolucion | null
  lucidez: number
  lucidezMax: number
  gestoCopista: 'quieto' | 'ataca' | 'herido' | 'lee' | 'cura'
}) {
  return (
    <div className="escenario">
      <div className="frente">
        {enemigos.map((en) => {
          const muerto = en.hp <= 0
          const esObjetivo = en.uid === objetivo
          const amenaza = AMENAZAS[en.perfil.amenaza]
          const golpeAqui = ultima && ultima.objetivoUid === en.uid
          return (
            <button
              key={en.uid}
              className={`enemigo${esObjetivo ? ' apuntado' : ''}${muerto ? ' caido' : ''}`}
              disabled={!seleccionable || muerto}
              onClick={() => onApuntar(en.uid)}
              aria-pressed={esObjetivo}
            >
              {golpeAqui && ultima.dano > 0 && (
                <span className={`flotante${ultima.golpe.startsWith('critico') ? ' critico' : ''}`}>
                  −{ultima.dano}
                </span>
              )}
              <Figura id={en.arquetipoId} gesto={en.gesto} />
              <span className="nom">{en.nombre}</span>
              <div className="vida"><span style={{ width: `${(en.hp / en.hpMax) * 100}%` }} /></div>
              {!muerto && (
                <span className="amenaza" title={amenaza.aviso}>
                  {amenaza.nombre}{en.fuerza > 0 ? ' ↑' : ''}
                </span>
              )}
              {!muerto && (
                <span className="debil">
                  pide {familiasDeArquetipo(en.arquetipoId).join('/')}
                  {en.perfil.cede.length > 0 ? ` · cede a ${en.perfil.cede.join('/')}` : ''}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="linea-frente" />

      <div className="jugador">
        <Copista gesto={gestoCopista} />
        <div>
          <span className="eyebrow">El Copista</span>
          <div className="vida ancha"><span style={{ width: `${(lucidez / lucidezMax) * 100}%` }} /></div>
          <span className="dato silencio">{lucidez}/{lucidezMax} lucidez</span>
        </div>
        {ultima && (
          <span className={`veredicto-golpe ${ultima.golpe}`}>{TEXTO_GOLPE[ultima.golpe]}</span>
        )}
      </div>

      {ultima && ultima.turnoEnemigo.length > 0 && (
        <ul className="parte">
          {ultima.turnoEnemigo.map((t, i) => (
            <li key={i}>
              {t.texto}{t.dano > 0 && <span className="dato"> −{t.dano}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

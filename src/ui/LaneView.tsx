import { faseJefe, LARGO_CARRIL, tipoPorId, type Enemigo } from '../engine/lane'
import { FondoImagen, Retrato, SpriteRetrato, usarManifest } from './assets'
import type { Disparo } from '../engine/weapons'
import { sfx } from './sfx'
import { useEffect, useRef, useState } from 'react'

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

function Copista({ gesto }: { gesto?: string }) {
  return (
    <svg className={`copista copista-${gesto}`} viewBox="0 0 40 44" width={40} height={44} aria-hidden>
      <path d="M20 6l6 16-6 5-6-5z" fill="currentColor" />
      <path d="M20 27v10M12 37h16" stroke="currentColor" strokeWidth="3" />
      <circle cx="20" cy="18" r="2" fill="var(--tinta)" />
    </svg>
  )
}

/** armas que golpean en persona: el héroe embiste hasta el objetivo */
const CUERPO_A_CUERPO = new Set(['maza', 'gancho', 'tenaza', 'barrido'])

export function LaneView({
  enemigos, lucidez, lucidezMax, alcance, gesto, ultimosImpactos, disparoListo, disparo, golpeMayor, aniquilacion, fondo, golpeTier = 0
}: {
  enemigos: Enemigo[]
  lucidez: number
  lucidezMax: number
  /** cuántos enemigos alcanzaría la afirmación que estás montando */
  alcance: number
  gesto?: string
  ultimosImpactos: { uid: string; dano: number }[]
  /** el disparo solo se ve cuando la cuenta ha terminado */
  disparoListo?: boolean
  /** con qué arma sale el ataque: cada herramienta dispara distinto */
  disparo?: Disparo | null
  /** golpe con ×mult, onda o barrido: el carril lo acusa con sacudida y destello */
  golpeMayor?: boolean
  /** el golpe borró la sala: página en blanco */
  aniquilacion?: boolean
  /** escenario del carril: acto y tipo de sala */
  fondo?: { n: number; sala?: string | null }
  /** magnitud del golpe: 0 nada · 1 mayor · 2 ≥1k · 3 ≥10k · 4 ≥100k */
  golpeTier?: number
}) {
  const manifest = usarManifest()
  const vivos = enemigos.filter((e) => e.hp > 0).sort((a, b) => a.posicion - b.posicion)
  const esMelee = !!(disparo && CUERPO_A_CUERPO.has(disparo.arma.forma))
  /** los impactos se revelan uno a uno: primero llega el golpe (viaje del
   *  proyectil o embestida), luego cae el primero, y el desborde recorre la
   *  cadena con cadencia — nadie muere antes de recibir su golpe */
  const [revelados, setRevelados] = useState(0)
  useEffect(() => {
    if (!disparoListo || !ultimosImpactos.length) { setRevelados(0); return }
    setRevelados(0)
    const ts: ReturnType<typeof setTimeout>[] = []
    const base = esMelee ? 340 : Math.min(900, disparo?.arma.duracion ?? 600)
    const paso = (i: number) => {
      setRevelados(i)
      if (i < ultimosImpactos.length) ts.push(setTimeout(() => paso(i + 1), 150))
    }
    ts.push(setTimeout(() => paso(1), base))
    return () => ts.forEach(clearTimeout)
  }, [disparoListo, ultimosImpactos, esMelee, disparo])
  const golpeado = (uid: string): boolean => {
    const i = ultimosImpactos.findIndex((x) => x.uid === uid)
    return i >= 0 && i < revelados
  }
  const todoRevelado = revelados >= ultimosImpactos.length
  /** los enemigos responden DESPUÉS del golpe del héroe: sus animaciones de
   *  avance y ataque esperan a que el último impacto aterrice */
  const [faseEnemiga, setFaseEnemiga] = useState(false)
  useEffect(() => {
    if (!disparoListo) { setFaseEnemiga(false); return }
    if (!todoRevelado) { setFaseEnemiga(false); return }
    const t = setTimeout(() => setFaseEnemiga(true), 260)
    return () => clearTimeout(t)
  }, [disparoListo, todoRevelado])
  const embisteUid = disparoListo && disparo && esMelee && gesto === 'afirma'
    ? disparo.objetivos[0] ?? null : null
  const vivosYcaidos = enemigos
  const gestosPrevios = useRef<Record<string, string>>({})

  useEffect(() => {
    if (disparoListo === false) return
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
  }, [enemigos, disparoListo])
  const enMira = new Set(vivos.slice(0, Math.max(0, alcance)).map((e) => e.uid))

  return (
    <div className={`carril${golpeMayor && disparoListo ? ' sacudida' : ''}` +
      `${golpeTier >= 2 && disparoListo ? ` titan-t${Math.min(4, golpeTier)}` : ''}` +
      `${aniquilacion && todoRevelado ? ' borron-activo' : ''}` +
      `${aniquilacion && todoRevelado && golpeTier >= 3 ? ' apoteosis' : ''}`}>
      {fondo && <FondoImagen n={fondo.n} sala={fondo.sala} clase="fondo-carril" />}
      {golpeMayor && disparoListo && !aniquilacion && <div className="destello" aria-hidden />}
      {golpeTier >= 2 && disparoListo && !aniquilacion && (
        <div className="titan" aria-hidden>
          <span className="titan-anillo" />
          {golpeTier >= 3 && <span className="titan-anillo t2" />}
          {golpeTier >= 4 && <span className="titan-anillo t3" />}
        </div>
      )}
      {aniquilacion && todoRevelado && (
        <div className="borron" aria-hidden>
          <span className="borron-onda" />
          {golpeTier >= 3 && [...Array(10)].map((_, i) => <i key={i} className="mota" />)}
        </div>
      )}
      <div className="carril-jugador">
        <div>
          <span className="eyebrow">El Copista</span>
          <div className="vida ancha"><span style={{ width: `${(lucidez / lucidezMax) * 100}%` }} /></div>
          <span className="dato silencio">{lucidez}/{lucidezMax}</span>
        </div>
        <span className={`heroe-casa${embisteUid ? ' fuera' : ''}`}>
          <Retrato
            familia="jugador" id="copista" alt="El Copista"
            tamano={56} gesto={gesto} variante={disparo?.arma.forma}
            respaldo={<Copista gesto={gesto} />}
          />
        </span>
      </div>

      {disparoListo && disparo && !esMelee && disparo.objetivos.length > 0 && (
        <div className={`salva salva-${disparo.arma.forma}`} aria-hidden>
          {Array.from({ length: disparo.arma.proyectiles }, (_, i) => {
            const objetivo = vivosYcaidos.find((e) => e.uid === disparo.objetivos[
              Math.min(i, disparo.objetivos.length - 1)
            ])
            const destino = objetivo ? (objetivo.posicion / LARGO_CARRIL) * 100 : 60
            return (
              <span
                key={i}
                className="proyectil"
                style={{
                  '--destino': `${destino}%`,
                  '--dur': `${disparo.arma.duracion}ms`,
                  '--retardo': `${i * 90}ms`,
                  '--tono': disparo.arma.color,
                  '--escala': 0.6 + disparo.magnitud * 1.6
                } as React.CSSProperties}>
                {manifest?.[`proyectiles/${disparo.arma.forma}`] && (
                  <SpriteRetrato ficha={manifest[`proyectiles/${disparo.arma.forma}`]} gesto="quieto"
                    tamano={Math.round(22 * (0.6 + disparo.magnitud * 1.6))} alt="" />
                )}
              </span>
            )
          })}
          {disparo.combinado && (
            <span className="nombre-arma" style={{ color: disparo.arma.color }}>
              {disparo.combinado}
            </span>
          )}
        </div>
      )}

      <div className="carril-pista" role="list">
        {Array.from({ length: LARGO_CARRIL }, (_, i) => i + 1).map((casilla) => {
          const aqui = enemigos
            .filter((e) => e.hp > 0 || ultimosImpactos.some((i) => i.uid === e.uid))
            .filter((e) => e.posicion === casilla)
          return (
            <div className="casilla" key={casilla} role="listitem">
              <span className="numero">{casilla}</span>
              {embisteUid && aqui.some((e) => e.uid === embisteUid) && (
                <span className="heroe-embiste" aria-hidden>
                  <Retrato
                    familia="jugador" id="copista" alt=""
                    tamano={48} gesto="afirma" variante={disparo?.arma.forma}
                    respaldo={<Copista gesto="afirma" />}
                  />
                </span>
              )}
              {aqui.map((e) => {
                const t = tipoPorId(e.tipoId)
                const impactoReal = ultimosImpactos.find((x) => x.uid === e.uid)
                const impacto = impactoReal && golpeado(e.uid) ? impactoReal : undefined
                const hpVisible = impactoReal && !impacto
                  ? Math.min(e.hpMax, e.hp + impactoReal.dano) : e.hp
                const fase = faseJefe(e)
                return (
                  <div
                    key={e.uid}
                    className={`bicho bicho-${disparoListo === false || (impactoReal && !impacto) ? 'quieto'
                      : !faseEnemiga && (e.gesto === 'golpea' || e.gesto === 'avanza') ? 'quieto'
                      : e.gesto}${enMira.has(e.uid) ? ' en-mira' : ''}`}
                    title={`${e.nombre} — ${t.glosa}`}
                  >
                    {impacto && (
                      <span
                        className={`flotante${impacto.dano >= 250 ? ' magnifico' : impacto.dano >= 90 ? ' fuerte' : ''}`}
                        style={{ '--peso': Math.min(3.2, 1 + impacto.dano / 220) } as React.CSSProperties}
                      >−{impacto.dano}</span>
                    )}
                    <Retrato
                      familia="enemigos" id={e.tipoId} alt={e.nombre}
                      tamano={34} gesto={disparoListo === false || (impactoReal && !impacto) ? 'quieto'
                        : !faseEnemiga && (e.gesto === 'golpea' || e.gesto === 'avanza') ? 'quieto'
                        : e.gesto}
                      respaldo={<Silueta tipoId={e.tipoId} />}
                    />
                    <span className="nom">{e.nombre}</span>
                    <div className="vida"><span style={{ width: `${(hpVisible / e.hpMax) * 100}%` }} /></div>
                    <span className="vida-num">{hpVisible}<i>/{e.hpMax}</i></span>
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

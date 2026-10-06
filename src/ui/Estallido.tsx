import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cunaVitral, ESTALLIDOS, ESTRELLAS, N_FACETAS } from './estallidos'

/** El ataque final a pantalla completa. `children` es el texto central. */
export function Estallido({ variante, children }: { variante: string; children: React.ReactNode }) {
  const def = ESTALLIDOS.find((x) => x.id === variante) ?? ESTALLIDOS[0]
  return (
    <div className={`estallido ${def.id}`} role="status" aria-live="assertive" style={{ ['--dur' as string]: `${def.duracion}ms` }}>
      <div className="est-fondo" />
      {Array.from({ length: N_FACETAS }, (_, i) => (
        <i key={`f${i}`} className="est-faceta" style={{
          ['--i' as string]: i, ['--a' as string]: `${(360 / N_FACETAS) * i}deg`,
          ['--h' as string]: Math.round((360 / N_FACETAS) * i), ['--cuna' as string]: cunaVitral(i)
        }} />
      ))}
      {ESTRELLAS.map((s) => (
        <i key={`s${s.i}`} className="est-estrella" style={{
          ['--i' as string]: s.i, ['--a' as string]: `${s.a}deg`, ['--d' as string]: `${s.d}vmin`,
          ['--s' as string]: s.s, ['--t' as string]: `${s.t}s`
        }} />
      ))}
      <div className="est-gema" />
      <div className="estallido-anillo" /><div className="estallido-anillo t2" /><div className="estallido-anillo t3" /><div className="estallido-anillo t4" />
      <div className="estallido-rayo" /><div className="estallido-rayo r2" /><div className="estallido-rayo r3" />
      <div className="estallido-texto">{children}</div>
    </div>
  )
}

const GLIFOS = 'a e o s n r ¶ § ; , “ ” t l d — i u c m p'.split(' ')

/** La Página en Blanco: un solo golpe borró la sala. La hoja se limpia de izquierda a
 *  derecha, la tinta se levanta en letras sueltas y queda el sello. Se monta en el body
 *  para cubrir la pantalla entera (el carril conserva su propio lavado debajo). */
export function PaginaEnBlanco({ caidos, retardoMs = 0 }: { caidos: number; retardoMs?: number }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="pagina-blanca" role="status" aria-live="assertive" style={{ ['--ret' as string]: `${retardoMs}ms` }}>
      <div className="pb-hoja" />
      <div className="pb-filo" />
      {Array.from({ length: 34 }, (_, i) => (
        <i key={i} className="pb-letra" style={{
          ['--x' as string]: `${(i * 29 + 7) % 100}%`, ['--y' as string]: `${18 + ((i * 47) % 64)}%`,
          ['--g' as string]: `${((i * 53) % 50) - 25}deg`, ['--t' as string]: `${((i * 29 + 7) % 100) * 7}ms`
        }}>{GLIFOS[i % GLIFOS.length]}</i>
      ))}
      <div className="pb-sello">
        <small>UN SOLO TRAZO</small>
        <b>Página en blanco</b>
        <span>{caidos} {caidos === 1 ? 'enemigo borrado' : 'enemigos borrados'} · no queda nada escrito contra ti</span>
      </div>
    </div>,
    document.body
  )
}

/** v6.27 · a partir de cuánto daño un golpe se celebra, y cómo se llama cada escalón */
export const GOLPES_MAYORES = [
  { desde: 10000, id: 'legendario', rotulo: 'GOLPE LEGENDARIO' },
  { desde: 5000, id: 'colosal', rotulo: 'GOLPE COLOSAL' },
  { desde: 2000, id: 'mayor', rotulo: 'GOLPE MAYOR' }
]
export const escalonDeGolpe = (dano: number) => GOLPES_MAYORES.find((g) => dano >= g.desde) ?? null

function Cifra({ hasta, ms = 700 }: { hasta: number; ms?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0; const t0 = performance.now()
    const paso = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(hasta * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(paso) }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [hasta, ms])
  return <>{v.toLocaleString('es')}</>
}

/** El golpe grande de una partida normal: un tajo de luz cruza la pantalla con la cifra
 *  subiendo. Dura poco más de dos segundos y no bloquea nada: es un premio, no una pausa.
 *  El estallido completo sigue reservado para cristalizar. */
export function GolpeMayor({ dano, trazos }: { dano: number; trazos: number }) {
  const g = escalonDeGolpe(dano)
  if (!g || typeof document === 'undefined') return null
  return createPortal(
    <div className={`golpe-mayor gm-${g.id}`} role="status" aria-live="polite">
      <div className="gm-flash" />
      <div className="gm-tajo" />
      {Array.from({ length: g.id === 'mayor' ? 16 : g.id === 'colosal' ? 26 : 38 }, (_, i) => (
        <i key={i} className="gm-chispa" style={{ ['--a' as string]: `${(i * 137) % 360}deg`, ['--d' as string]: `${24 + ((i * 53) % 34)}vmin`, ['--t' as string]: `${(i % 6) * 40}ms` }} />
      ))}
      <div className="gm-texto">
        <small>{g.rotulo}</small>
        <b><Cifra hasta={dano} /> de daño</b>
        <span>{trazos} {trazos === 1 ? 'afirmación sostenida' : 'afirmaciones que se sostienen entre sí'}</span>
      </div>
    </div>,
    document.body
  )
}

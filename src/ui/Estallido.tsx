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

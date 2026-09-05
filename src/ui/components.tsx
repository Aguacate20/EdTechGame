import type { ReactNode } from 'react'

export function Medidor({ valor, max, etiqueta, enemigo }: {
  valor: number; max: number; etiqueta: string; enemigo?: boolean
}) {
  const pct = Math.max(0, Math.min(100, (valor / Math.max(1, max)) * 100))
  return (
    <div className={`medidor${enemigo ? ' enemigo' : ''}`}>
      <span className="eyebrow">{etiqueta}</span>
      <div className="pista"><div className="relleno" style={{ width: `${pct}%` }} /></div>
      <span className="dato">{Math.round(valor)}<span className="silencio">/{max}</span></span>
    </div>
  )
}

export function Chip({ children, tono }: { children: ReactNode; tono?: 'verde' | 'rojo' | 'laton' }) {
  return <span className={`chip${tono ? ` ${tono}` : ''}`}>{children}</span>
}

export function Panel({ titulo, children, pie }: { titulo?: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <section className="panel">
      {titulo && <h2 className="h2">{titulo}</h2>}
      {children}
      {pie}
    </section>
  )
}

export function Sello({ valor, mal }: { valor: number; mal?: boolean }) {
  return (
    <div className={`sello${mal ? ' mal' : ''}`} aria-label={mal ? 'lucidez perdida' : 'daño'}>
      {mal ? '−' : ''}{valor}
    </div>
  )
}

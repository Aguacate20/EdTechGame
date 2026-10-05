import { useEffect, useState } from 'react'
import { Estallido, GolpeMayor, PaginaEnBlanco } from './Estallido'
import { ESTALLIDOS } from './estallidos'

/** v6.22 · vista previa de las animaciones grandes sin tener que jugarlas.
 *  Se abre con ?ver=prisma|geoda|constelacion|vitral|escarcha|pagina|golpe|golpe2|golpe3|todas y se repite en bucle. */
export function VistaAnimaciones({ ver }: { ver: string }) {
  const lista = ver === 'todas' ? [...ESTALLIDOS.map((x) => x.id), 'pagina', 'golpe', 'golpe2', 'golpe3'] : [ver]
  const [paso, setPaso] = useState(0)
  const id = lista[paso % lista.length]
  const est = ESTALLIDOS.find((x) => x.id === id)
  useEffect(() => {
    const t = window.setTimeout(() => setPaso((n) => n + 1), (est?.duracion ?? (id.startsWith('golpe') ? 2600 : 4400)) + 700)
    return () => window.clearTimeout(t)
  }, [paso, est])
  return (
    <div className="app" style={{ minHeight: '100vh' }}>
      <p style={{ padding: 24, color: 'var(--texto-2)' }}>Vista previa · {est ? `ataque final «${est.nombre}»` : id.startsWith('golpe') ? 'golpe mayor' : 'Página en Blanco'} · se repite sola</p>
      {est ? (
        <Estallido key={paso} variante={est.id}>
          <small>ATAQUE FINAL · {est.nombre.toUpperCase()}</small>
          <b>Mapa completo</b>
          <span>7 vínculos · 2 zonas · todo cae</span>
        </Estallido>
      ) : id.startsWith('golpe') ? <GolpeMayor key={paso} dano={id === 'golpe3' ? 12480 : id === 'golpe2' ? 6150 : 2360} trazos={id === 'golpe' ? 4 : 6} />
        : <PaginaEnBlanco key={paso} caidos={4} />}
    </div>
  )
}

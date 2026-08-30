import { useState, type ReactNode } from 'react'

/* ==========================================================================
   Ranuras de asset.
   El código pide una ilustración por ruta; si el fichero no existe, cae al SVG
   de marcador que ya está en el juego. El artista suelta ficheros en
   `public/art/…` y aparecen sin tocar una línea de lógica.

   Rutas esperadas (todas opcionales):
     public/art/enemigos/{tipoId}.svg|png|webp
     public/art/jugador/copista.svg
     public/art/herramientas/{herramientaId}.svg

   Cuando llegue el momento de Rive, esta capa se sustituye por el runtime de
   .riv sin cambiar los llamantes: `Enemigo.gesto` ya es la máquina de estados
   (quieto · avanza · golpea · herido · critico · cae · retrocede).
   ========================================================================== */

const BASE = import.meta.env.BASE_URL

export type Familia = 'enemigos' | 'jugador' | 'herramientas'

/** Un solo intento por ruta: si falla, el marcador se queda para siempre. */
const fallidas = new Set<string>()

export function Retrato({ familia, id, alt, tamano, gesto, respaldo }: {
  familia: Familia
  id: string
  alt: string
  tamano: number
  /** se refleja en un atributo data-* para que el CSS (o Rive) lo lea */
  gesto?: string
  respaldo: ReactNode
}) {
  const ruta = `${BASE}art/${familia}/${id}.svg`
  const [roto, setRoto] = useState(fallidas.has(ruta))

  if (roto) {
    return (
      <span className="retrato" data-gesto={gesto} style={{ width: tamano, height: tamano }}>
        {respaldo}
      </span>
    )
  }
  return (
    <span className="retrato" data-gesto={gesto} style={{ width: tamano, height: tamano }}>
      <img
        src={ruta} alt={alt} width={tamano} height={tamano} draggable={false}
        onError={() => { fallidas.add(ruta); setRoto(true) }}
      />
    </span>
  )
}

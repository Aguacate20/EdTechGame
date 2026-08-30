import { useEffect, useState, type ReactNode } from 'react'

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
  const manifest = usarManifest()
  const ficha = manifest?.[`${familia}/${id}`]
  if (ficha) {
    return <SpriteRetrato ficha={ficha} gesto={gesto} tamano={tamano} alt={alt} />
  }

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


/* ==========================================================================
   Sprites animados (v5.16).
   Para paquetes comunitarios (itch.io / OpenGameArt) que traen la animación
   como TIRAS de frames cuadrados (idle.png, attack.png, death.png…).
   Se declaran en `public/art/manifest.json` y caen en las MISMAS ranuras:
   si un id tiene ficha en el manifest, se anima; si no, se busca su SVG; si
   tampoco, marcador. Nada de esto toca la lógica del juego.

   Formato del manifest (frames cuadrados, una sola fila):
   {
     "enemigos/copista": {
       "quieto": { "src": "sprites/goblin/idle.png",   "frames": 4, "fps": 8 },
       "golpea": { "src": "sprites/goblin/attack.png", "frames": 8, "fps": 12 },
       "herido": { "src": "sprites/goblin/hit.png",    "frames": 4, "fps": 10 },
       "cae":    { "src": "sprites/goblin/death.png",  "frames": 4, "fps": 8, "loop": false },
       "volteado": true
     }
   }
   ========================================================================== */

interface ClipSprite { src: string; frames: number; fps?: number; loop?: boolean }
interface FichaSprite {
  [gesto: string]: ClipSprite | boolean | undefined
  /** true si el pack mira a la derecha y hay que espejarlo */
  volteado?: boolean
}

let MANIFEST: Record<string, FichaSprite> | null | undefined
const oyentes = new Set<() => void>()
fetch(`${BASE}art/manifest.json`)
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null)
  .then((m) => { MANIFEST = m; oyentes.forEach((f) => f()) })

function usarManifest(): Record<string, FichaSprite> | null {
  const [, fuerza] = useState(0)
  useEffect(() => {
    if (MANIFEST !== undefined) return
    const f = () => fuerza((x) => x + 1)
    oyentes.add(f)
    return () => { oyentes.delete(f) }
  }, [])
  return MANIFEST ?? null
}

/** Qué clip usar para cada gesto si el pack no trae ese estado. */
const RESPALDO_GESTO: Record<string, string[]> = {
  quieto: ['quieto'],
  avanza: ['avanza', 'quieto'],
  golpea: ['golpea', 'avanza', 'quieto'],
  herido: ['herido', 'quieto'],
  critico: ['critico', 'herido', 'golpea', 'quieto'],
  cae: ['cae', 'herido', 'quieto'],
  retrocede: ['retrocede', 'herido', 'quieto']
}

function SpriteRetrato({ ficha, gesto = 'quieto', tamano, alt }: {
  ficha: FichaSprite; gesto?: string; tamano: number; alt: string
}) {
  const orden = RESPALDO_GESTO[gesto] ?? ['quieto']
  const clave = orden.find((g) => typeof ficha[g] === 'object')
  const clip = clave ? (ficha[clave] as ClipSprite) : null
  if (!clip) return null
  const fps = clip.fps ?? 8
  const loop = clip.loop !== false
  const pasos = loop ? clip.frames : Math.max(1, clip.frames - 1)
  const fin = loop ? '-100%' : `-${((100 * (clip.frames - 1)) / clip.frames).toFixed(3)}%`
  return (
    <span
      className="retrato retrato-sprite" data-gesto={gesto}
      style={{ width: tamano, height: tamano, transform: ficha.volteado ? 'scaleX(-1)' : undefined }}
    >
      <img
        key={`${clip.src}:${gesto}`}
        src={`${BASE}art/${clip.src}`} alt={alt} draggable={false}
        style={{
          height: '100%', width: `${clip.frames * 100}%`, maxWidth: 'none',
          ['--fin' as string]: fin,
          animation: `barridoSprite ${(clip.frames / fps).toFixed(3)}s steps(${pasos}) ${loop ? 'infinite' : '1 forwards'}`
        }}
      />
    </span>
  )
}


/* --------------------------- escenario por acto --------------------------- */

/** Suelta `public/art/fondos/acto1.png` (y 2, 3…) y el acto gana escenario.
 *  Se pinta atenuado detrás de todo, con un velo para que la mesa siga
 *  siendo legible. Si el archivo no existe, no pasa nada. */
export function FondoActo({ n }: { n: number }) {
  const ruta = `${BASE}art/fondos/acto${n}.png`
  const [roto, setRoto] = useState(fallidas.has(ruta))
  if (roto) return null
  return (
    <div className="fondo-acto" aria-hidden>
      <img src={ruta} alt="" onError={() => { fallidas.add(ruta); setRoto(true) }} />
    </div>
  )
}

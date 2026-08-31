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

export type Familia = 'enemigos' | 'jugador' | 'herramientas' | 'proyectiles'

/** Un solo intento por ruta: si falla, el marcador se queda para siempre. */
const fallidas = new Set<string>()

export function Retrato({ familia, id, alt, tamano, gesto, variante, respaldo }: {
  familia: Familia
  id: string
  alt: string
  tamano: number
  /** se refleja en un atributo data-* para que el CSS (o Rive) lo lea */
  gesto?: string
  /** matiz del gesto (p. ej. la forma del arma): permite clips «golpea_rayo» */
  variante?: string
  respaldo: ReactNode
}) {
  const ruta = `${BASE}art/${familia}/${id}.svg`
  const [roto, setRoto] = useState(fallidas.has(ruta))
  const manifest = usarManifest()
  const ficha = manifest?.[`${familia}/${id}`]
  const [spriteRoto, setSpriteRoto] = useState(false)
  if (ficha && !spriteRoto && fichaTieneClips(ficha)) {
    return <SpriteRetrato ficha={ficha} gesto={gesto} variante={variante} tamano={tamano} alt={alt}
      alFallar={() => setSpriteRoto(true)} />
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
type Clips = ClipSprite | ClipSprite[]
interface FichaSprite {
  [gesto: string]: Clips | boolean | number | undefined
  /** true si el pack mira a la derecha y hay que espejarlo */
  volteado?: boolean
  /** factor de tamaño: compensa el aire transparente del pack (1 = igual) */
  escala?: number
}

let MANIFEST: Record<string, FichaSprite> | null | undefined
const oyentes = new Set<() => void>()
fetch(`${BASE}art/manifest.json`)
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null)
  .then((m) => { MANIFEST = m; oyentes.forEach((f) => f()); precargar(m) })

/** proporciones ya medidas (frameW/frameH) por tira: al remontar un clip no
 *  hay salto de ancho mientras carga */
const RATIOS = new Map<string, number>()

/** precargar todas las tiras del manifest: el cambio de gesto remontaba el
 *  <img> y el hueco de red pintaba un frame vacío — el parpadeo */
function precargar(m: Record<string, FichaSprite> | null) {
  if (!m) return
  for (const ficha of Object.values(m)) {
    if (!ficha || typeof ficha !== 'object') continue
    for (const v of Object.values(ficha)) {
      const clips = Array.isArray(v) ? v : (v && typeof v === 'object' ? [v as ClipSprite] : [])
      for (const clip of clips) {
        if (!clip.src) continue
        const im = new Image()
        im.src = `${BASE}art/${clip.src}`
      }
    }
  }
}

export function usarManifest(): Record<string, FichaSprite> | null {
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

/** Elige el clip de un gesto: primero `gesto_variante` (p. ej. golpea_rayo),
 *  luego el gesto; si hay varios (lista), uno al azar — así los ataques varían. */
function elegirClip(ficha: FichaSprite, gesto: string, variante?: string): ClipSprite | null {
  // el tablero habla en «afirma» (herencia del SVG); los packs hablan en «golpea»
  const g = gesto === 'afirma' ? 'golpea' : gesto
  const claves = [
    ...(variante ? [`${g}_${variante}`] : []),
    ...(RESPALDO_GESTO[g] ?? ['quieto'])
  ]
  for (const k of claves) {
    const v = ficha[k]
    if (Array.isArray(v) && v.length) return v[Math.floor(Math.random() * v.length)]
    if (v && typeof v === 'object') return v as ClipSprite
  }
  return null
}

export const fichaTieneClips = (ficha: FichaSprite): boolean => !!elegirClip(ficha, 'quieto')

export function SpriteRetrato({ ficha, gesto = 'quieto', variante, tamano: tamanoBase, alt, alFallar }: {
  ficha: FichaSprite; gesto?: string; variante?: string; tamano: number; alt: string
  /** si la tira no carga (404, ruta rota), avisar para volver al respaldo */
  alFallar?: () => void
}) {
  const tamano = Math.round(tamanoBase * (typeof ficha.escala === 'number' ? ficha.escala : 1))
  // el clip se elige una vez por cambio de gesto (no en cada render)
  const [clip, setClip] = useState<ClipSprite | null>(() => elegirClip(ficha, gesto, variante))
  useEffect(() => { setClip(elegirClip(ficha, gesto, variante)) }, [ficha, gesto, variante])
  // frames no cuadrados: se mide la tira y el ancho del retrato sigue la
  // proporción; el caché evita el salto de ancho al cambiar de clip
  const [ratio, setRatio] = useState(() => (clip ? RATIOS.get(clip.src) ?? 1 : 1))
  useEffect(() => { if (clip) setRatio(RATIOS.get(clip.src) ?? 1) }, [clip?.src])
  if (!clip) return null
  const fps = clip.fps ?? 8
  // un ataque o un golpe recibido se ejecuta UNA vez y congela su último
  // frame hasta que el gesto cambie; solo idle/avance repiten en bucle
  const transitorio = ['afirma', 'golpea', 'herido', 'critico', 'cae', 'retrocede'].includes(gesto)
  const loop = clip.loop !== false && !transitorio
  const pasos = loop ? clip.frames : Math.max(1, clip.frames - 1)
  const fin = loop ? '-100%' : `-${((100 * (clip.frames - 1)) / clip.frames).toFixed(3)}%`
  return (
    <span
      className="retrato retrato-sprite" data-gesto={gesto}
      style={{ width: Math.round(tamano * ratio), height: tamano, transform: ficha.volteado ? 'scaleX(-1)' : undefined }}
    >
      <img
        key={`${clip.src}:${gesto}`}
        src={`${BASE}art/${clip.src}`} alt={alt} draggable={false}
        data-frames={clip.frames}
        data-src={clip.src}
        onLoad={(ev) => {
          // la proporción se calcula con los datos del PROPIO <img>: usar el
          // closure mezclaba tira y nº de frames de clips distintos en
          // transiciones rápidas, cacheaba una proporción disparatada y el
          // retrato mostraba varios frames desfilando (la «pasarela»)
          const im = ev.currentTarget
          const fr = Number(im.dataset.frames) || 1
          const src = im.dataset.src ?? ''
          if (im.naturalWidth && im.naturalHeight && src) {
            const r = (im.naturalWidth / fr) / im.naturalHeight
            RATIOS.set(src, r)
            if (clip.src === src) setRatio(r)
          }
        }}
        onError={() => { fallidas.add(`${BASE}art/${clip.src}`); alFallar?.() }}
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
/** Escenario del acto, con matiz por tipo de sala. Prueba en orden:
 *  `fondos/<sala>_acto<n>.png` → `fondos/acto<n>.png` → nada.
 *  Suelta `refugio_acto1.png`, `jefe_acto2.png`, `dura_acto1.png`… y cada
 *  clase de sala gana su propio escenario; sin archivo, cae al del acto. */
export function FondoImagen({ n, sala, clase }: { n: number; sala?: string | null; clase: string }) {
  const candidatas = [
    ...(sala ? [`${BASE}art/fondos/${sala}_acto${n}.png`] : []),
    `${BASE}art/fondos/acto${n}.png`
  ].filter((r) => !fallidas.has(r))
  const [i, setI] = useState(0)
  useEffect(() => { setI(0) }, [n, sala])
  if (i >= candidatas.length) return null
  const ruta = candidatas[i]
  return (
    <div className={clase} aria-hidden>
      <img src={ruta} alt="" onError={() => { fallidas.add(ruta); setI((x) => x + 1) }} />
    </div>
  )
}

export function FondoActo({ n, sala }: { n: number; sala?: string | null }) {
  const candidatas = [
    ...(sala ? [`${BASE}art/fondos/${sala}_acto${n}.png`] : []),
    `${BASE}art/fondos/acto${n}.png`
  ].filter((r) => !fallidas.has(r))
  const [i, setI] = useState(0)
  useEffect(() => { setI(0) }, [n, sala])
  if (i >= candidatas.length) return null
  const ruta = candidatas[i]
  return (
    <div className="fondo-acto" aria-hidden>
      <img src={ruta} alt="" onError={() => { fallidas.add(ruta); setI((x) => x + 1) }} />
    </div>
  )
}

/** Icono opcional de una lente: `art/lentes/<id>.png` (o .svg). Sin archivo,
 *  no ocupa espacio. Para que las pasivas tengan cara de reliquia. */
export function IconoLente({ id, tamano = 30 }: { id: string; tamano?: number }) {
  const png = `${BASE}art/lentes/${id}.png`
  const svg = `${BASE}art/lentes/${id}.svg`
  const candidatas = [png, svg].filter((r) => !fallidas.has(r))
  const [i, setI] = useState(0)
  if (i >= candidatas.length) return null
  const ruta = candidatas[i]
  return (
    <img className="icono-lente" src={ruta} alt="" width={tamano} height={tamano}
      onError={() => { fallidas.add(ruta); setI((x) => x + 1) }} />
  )
}

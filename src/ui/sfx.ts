/* ==========================================================================
   Sonido. Es la mitad de la sensación de juego y lo más barato que existe.
   Se sintetiza con WebAudio en vez de cargar ficheros: cero peso, cero
   licencias, y el tono de la cascada puede subir con la escalera de veredictos.
   ========================================================================== */

let ctx: AudioContext | null = null
let habilitado = true
let maestro: GainNode | null = null

function motor(): AudioContext | null {
  if (!habilitado) return null
  if (ctx) return ctx
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
    maestro = ctx.createGain()
    maestro.gain.value = 0.28
    maestro.connect(ctx.destination)
  } catch {
    habilitado = false
  }
  return ctx
}

export function silenciar(v: boolean): void {
  habilitado = !v
  if (maestro) maestro.gain.value = v ? 0 : 0.28
}

export const estaSilenciado = (): boolean => !habilitado

/** Ruido corto filtrado: papel, roce, golpe seco. */
function ruido(dur: number, corte: number, q: number, vol: number, tipo: BiquadFilterType = 'bandpass') {
  const c = motor()
  if (!c || !maestro) return
  const n = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = tipo
  f.frequency.value = corte
  f.Q.value = q
  const g = c.createGain()
  g.gain.value = vol
  src.connect(f); f.connect(g); g.connect(maestro)
  src.start()
}

function tono(hz: number, dur: number, vol: number, forma: OscillatorType = 'triangle', desliz = 0) {
  const c = motor()
  if (!c || !maestro) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = forma
  o.frequency.setValueAtTime(hz, c.currentTime)
  if (desliz) o.frequency.exponentialRampToValueAtTime(Math.max(40, hz + desliz), c.currentTime + dur)
  g.gain.setValueAtTime(0, c.currentTime)
  g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
  o.connect(g); g.connect(maestro)
  o.start()
  o.stop(c.currentTime + dur + 0.02)
}

/** Escala pentatónica: la cascada sube por ella y nunca desafina. */
const ESCALA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31]
const nota = (grado: number, base = 220) =>
  base * Math.pow(2, ESCALA[Math.min(grado, ESCALA.length - 1)] / 12)

export const sfx = {
  /** levantar una carta */
  tomar: () => ruido(0.05, 2600, 1.2, 0.16),
  /** soltarla en el tablero */
  soltar: () => { ruido(0.07, 1200, 1, 0.22); tono(150, 0.05, 0.05, 'sine') },
  /** trazar una herramienta */
  trazar: () => { tono(330, 0.09, 0.07, 'triangle', 120); ruido(0.05, 3200, 2, 0.1) },
  /** deshacer */
  deshacer: () => tono(200, 0.08, 0.05, 'sine', -60),
  /** un eslabón de la cascada: el grado sube con la posición */
  eslabon: (grado: number, bueno: boolean) => {
    if (bueno) { tono(nota(grado), 0.16, 0.11, 'triangle'); tono(nota(grado) * 2, 0.09, 0.04, 'sine') }
    else tono(nota(0) * 0.75, 0.12, 0.06, 'sawtooth', -40)
  },
  /** un combo se enciende */
  combo: (i: number) => {
    tono(nota(6 + i), 0.22, 0.1, 'triangle')
    tono(nota(6 + i) * 1.5, 0.18, 0.05, 'sine')
  },
  /** una lente mayor multiplica: acorde ancho, más grave que los combos */
  mayor: (i: number) => {
    tono(nota(2 + i) / 2, 0.34, 0.14, 'sawtooth', 20)
    tono(nota(2 + i), 0.3, 0.1, 'triangle')
    tono(nota(2 + i) * 1.5, 0.26, 0.06, 'sine')
  },
  /** el total se estampa */
  total: () => { tono(110, 0.3, 0.13, 'sine', 40); ruido(0.16, 700, 0.7, 0.2, 'lowpass') },
  /** impacto en el carril */
  golpe: () => { ruido(0.13, 320, 0.6, 0.3, 'lowpass'); tono(70, 0.13, 0.1, 'square', -30) },
  /** crítico */
  critico: () => { ruido(0.2, 900, 0.5, 0.28, 'lowpass'); tono(nota(9), 0.24, 0.12, 'triangle', 300) },
  /** el jugador recibe daño */
  dano: () => { tono(140, 0.2, 0.1, 'sawtooth', -70); ruido(0.12, 500, 0.8, 0.16, 'lowpass') },
  /** un enemigo cae */
  cae: () => { tono(180, 0.34, 0.1, 'triangle', -120); ruido(0.24, 420, 0.6, 0.18, 'lowpass') },
  /** una falsificación derrumba */
  derrumbe: () => { ruido(0.3, 260, 0.5, 0.26, 'lowpass'); tono(90, 0.3, 0.1, 'sawtooth', -40) },
  /** nombre y descripción se fusionan */
  fusion: () => { tono(nota(4), 0.14, 0.09); setTimeout(() => tono(nota(7), 0.2, 0.1), 90) },
  /** avanzar de casilla en el mapa */
  paso: () => ruido(0.09, 900, 1.4, 0.14),
  /** el golpe titánico: crece con el orden de magnitud del daño */
  titan: (tier: number) => {
    tono(48, 0.55, 0.22, 'sawtooth', -14)
    tono(96, 0.45, 0.12, 'triangle', -22)
    ruido(0.3, 500, 0.7, 0.24, 'lowpass')
    if (tier >= 3) {
      setTimeout(() => { tono(nota(4), 0.4, 0.12, 'square'); tono(nota(8), 0.5, 0.1, 'sine') }, 180)
    }
    if (tier >= 4) {
      setTimeout(() => { tono(nota(11), 0.7, 0.12, 'sine'); tono(nota(14), 0.8, 0.09, 'sine'); tono(36, 0.9, 0.18, 'sawtooth', -10) }, 340)
    }
  },
  /** la página en blanco: el golpe que borra la sala entera */
  borron: () => {
    tono(52, 0.6, 0.24, 'sawtooth', -18)
    tono(104, 0.5, 0.14, 'triangle', -30)
    ruido(0.45, 380, 0.6, 0.3, 'lowpass')
    setTimeout(() => { tono(nota(7), 0.5, 0.12, 'sine'); tono(nota(9), 0.6, 0.1, 'sine') }, 420)
    setTimeout(() => tono(nota(12), 0.8, 0.11, 'sine'), 560)
  }
}

/** WebAudio exige un gesto del usuario antes de sonar. */
export function despertarAudio(): void {
  const c = motor()
  if (c && c.state === 'suspended') void c.resume()
}

/** RNG determinista por semilla: dos runs con la misma semilla son idénticas.
 *  La semilla varía la ruta; el grafo restringe la variación. */
export class Rng {
  private s: number
  constructor(seed: number | string) {
    this.s = typeof seed === 'number' ? seed >>> 0 : hash(seed)
    if (this.s === 0) this.s = 0x9e3779b9
  }
  next(): number {
    // mulberry32
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * Math.max(1, maxExclusive))
  }
  pick<T>(list: T[]): T {
    return list[this.int(list.length)]
  }
  shuffle<T>(list: T[]): T[] {
    const a = [...list]
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  sample<T>(list: T[], n: number): T[] {
    return this.shuffle(list).slice(0, Math.max(0, n))
  }
}

export function hash(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function semillaLegible(): string {
  const silabas = ['ar', 'ka', 'mor', 'tel', 'sen', 'vi', 'lun', 'dro', 'fa', 'nex', 'ori', 'zel']
  const r = new Rng(Date.now() ^ Math.floor(Math.random() * 1e9))
  return Array.from({ length: 3 }, () => r.pick(silabas)).join('-')
}

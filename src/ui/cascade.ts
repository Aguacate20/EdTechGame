import { useEffect, useMemo, useRef, useState } from 'react'
import type { Diagnostico } from '../engine/tools'
import { esAcierto } from '../engine/tools'
import { sfx } from './sfx'

/* ==========================================================================
   La cascada.
   Resolver todo de golpe desperdicia el momento en el que el juego se siente
   bien. Aquí el marcador se descubre eslabón por eslabón: cada trazo suma sus
   fichas, cada combo enciende su multiplicador, y el tono sube por una escala
   pentatónica para que la subida se OIGA además de verse.
   ========================================================================== */

export type PasoCascada =
  | { tipo: 'trazo'; indice: number; uid: string; bueno: boolean; fichas: number; mult: number }
  | { tipo: 'combo'; indice: number; nombre: string; fichas: number; mult: number }
  | { tipo: 'xmult'; indice: number; nombre: string; factor: number }
  | { tipo: 'ajuste'; indice: number; nombre: string; fichas: number; mult: number; factor: number }
  | { tipo: 'total' }

const MS_TRAZO = 260
const MS_COMBO = 300
const MS_XMULT = 460
const MS_ANTES_TOTAL = 420

export interface Cascada {
  fichas: number
  mult: number
  xmult: number
  xmultsRevelados: { tipo: 'xmult'; indice: number; nombre: string; factor: number }[]
  ajustesRevelados: number
  total: number | null
  trazosRevelados: Set<string>
  combosRevelados: number
  terminada: boolean
  saltar: () => void
}

export function useCascada(diag: Diagnostico | null, activa: boolean): Cascada {
  const pasos = useMemo<PasoCascada[]>(() => {
    if (!diag) return []
    const l: PasoCascada[] = diag.veredictos.map((v, i) => ({
      tipo: 'trazo' as const, indice: i, uid: v.trazo.uid,
      bueno: esAcierto(v.estado), fichas: v.fichas, mult: v.mult
    }))
    diag.combos.forEach((c, i) => {
      l.push({ tipo: 'combo', indice: i, nombre: c.nombre, fichas: c.fichas, mult: c.mult })
    })
    // ningún número cambia sin decir por qué: cada ajuste es un paso propio
    diag.ajustes.forEach((a, i) => {
      l.push({ tipo: 'ajuste', indice: i, nombre: a.nombre,
        fichas: a.fichas ?? 0, mult: a.mult ?? 0, factor: a.factor ?? 1 })
    })
    // las mayores se revelan al final, una por una: es el momento del ×
    diag.xmultsActivos.forEach((x, i) => {
      l.push({ tipo: 'xmult', indice: i, nombre: x.nombre, factor: x.factor })
    })
    l.push({ tipo: 'total' })
    return l
  }, [diag])

  const [n, setN] = useState(0)
  const temporizador = useRef<number | null>(null)

  useEffect(() => {
    setN(0)
    if (temporizador.current) window.clearTimeout(temporizador.current)
  }, [diag])

  useEffect(() => {
    if (!activa || !diag || n >= pasos.length) return
    const paso = pasos[n]
    const espera = paso.tipo === 'total' ? MS_ANTES_TOTAL : paso.tipo === 'xmult' || paso.tipo === 'ajuste' ? MS_XMULT : paso.tipo === 'combo' ? MS_COMBO : MS_TRAZO

    temporizador.current = window.setTimeout(() => {
      if (paso.tipo === 'trazo') sfx.eslabon(paso.indice, paso.bueno)
      if (paso.tipo === 'combo') sfx.combo(paso.indice)
      if (paso.tipo === 'xmult') sfx.mayor(paso.indice)
      if (paso.tipo === 'ajuste') {
        (paso.fichas < 0 || paso.factor < 1) ? sfx.derrumbe() : sfx.combo(paso.indice)
      }
      if (paso.tipo === 'total') {
        sfx.total()
        if (diag.errores > 0) sfx.derrumbe()
        if (diag.fusiona.length) setTimeout(() => sfx.fusion(), 220)
      }
      setN((x) => x + 1)
    }, espera)

    return () => { if (temporizador.current) window.clearTimeout(temporizador.current) }
  }, [n, pasos, activa, diag])

  const vistos = pasos.slice(0, n)
  const fichas = vistos.reduce((s, p) => s + (p.tipo === 'total' || p.tipo === 'xmult' ? 0 : p.fichas), 0)
  const mult = 1 + vistos.reduce((s, p) => s + (p.tipo === 'total' || p.tipo === 'xmult' ? 0 : p.mult), 0)
  const xmult = vistos.reduce((s, p) =>
    s * (p.tipo === 'xmult' ? p.factor : p.tipo === 'ajuste' ? p.factor : 1), 1)
  const terminada = n >= pasos.length

  return {
    fichas: Math.round(fichas),
    mult: Math.max(0, mult),
    xmult,
    xmultsRevelados: vistos.filter((p) => p.tipo === 'xmult') as
      { tipo: 'xmult'; indice: number; nombre: string; factor: number }[],
    ajustesRevelados: vistos.filter((p) => p.tipo === 'ajuste').length,
    total: terminada && diag ? diag.dano : null,
    trazosRevelados: new Set(vistos.filter((p) => p.tipo === 'trazo').map((p) => (p as { uid: string }).uid)),
    combosRevelados: vistos.filter((p) => p.tipo === 'combo').length,
    terminada,
    saltar: () => setN(pasos.length)
  }
}

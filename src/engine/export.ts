import type { Contenido } from '../content/types'
import { nivelDe, type Atlas } from './atlas'
import { unidadesSelladas } from './objectives'

/** El premio por completar el grafo entero no es un número: es el artefacto.
 *  El mapa que el jugador reconstruyó, con su evidencia y las páginas de origen. */
export function edicionCritica(atlas: Atlas, contenido: Contenido): string {
  const selladas = new Set(unidadesSelladas(atlas, contenido))
  const l: string[] = []

  l.push(`# Edición crítica — ${contenido.fuente}`)
  l.push('')
  l.push(`Mapa conceptual reconstruido jugando. ${Object.keys(atlas.aristas).length} de ${contenido.aristas.length} vínculos sostenidos · ${atlas.victorias} de ${atlas.runs} expediciones completadas.`)
  l.push('')
  l.push('> Cada afirmación de este documento se sostuvo en juego contra el ítem precompilado')
  l.push('> correspondiente. Las páginas remiten a la fuente original.')
  l.push('')

  for (const u of contenido.unidades) {
    l.push(`## ${u.numero}. ${u.titulo}${selladas.has(u.id) ? ' — sellada' : ''}`)
    l.push('')
    for (const id of u.conceptIds) {
      const c = contenido.conceptos[id]
      if (!c) continue
      const ev = atlas.conceptos[id]
      const n = nivelDe(ev)
      const marca = n === 3 ? 'dominado' : n === 2 ? 'sostenido' : n === 1 ? 'reconocido' : 'sin evidencia'
      l.push(`### ${c.titulo}`)
      l.push('')
      l.push(`*${marca}${ev ? ` · ${ev.aciertos} aciertos en ${new Set(ev.mecanicas).size} tipos de tarea` : ''}${c.paginas.length ? ` · p. ${c.paginas.join(', ')}` : ''}*`)
      l.push('')
      l.push(c.definicion)
      l.push('')
      const salientes = Object.values(atlas.aristas).filter((a) => a.from === id)
      if (salientes.length) {
        for (const a of salientes) {
          l.push(`- **${a.tipo}** → ${contenido.conceptos[a.to]?.titulo ?? a.to}`)
        }
        l.push('')
      }
      if (c.subdimensiones.length && n >= 2) {
        l.push('Subdimensiones:')
        for (const s of c.subdimensiones) l.push(`- *${s.nombre}*: ${s.descripcion}`)
        l.push('')
      }
    }
  }

  if (atlas.repertoriosEstabilizados.length) {
    l.push('## Intuiciones estabilizadas')
    l.push('')
    l.push('Razonamientos que aparecieron fuera de sitio y quedaron reubicados en el terreno donde sí funcionan.')
    l.push('')
    for (const rid of atlas.repertoriosEstabilizados) {
      const r = contenido.repertorios.find((x) => x.id === rid)
      if (!r) continue
      l.push(`### ${r.etiqueta}`)
      l.push('')
      l.push(`${r.contrasteCientifico}`)
      l.push('')
      l.push(`**Donde sí funciona:** ${r.contextoDondeFunciona}`)
      l.push('')
    }
  }

  const calib = atlas.apuestasTotales
    ? Math.round((atlas.apuestasCalibradas / atlas.apuestasTotales) * 100)
    : null
  if (calib !== null) {
    l.push('---')
    l.push('')
    l.push(`Calibración: en el ${calib}% de las jugadas la confianza declarada acompañó al resultado.`)
  }
  return l.join('\n')
}

export function descargarEdicion(atlas: Atlas, contenido: Contenido): void {
  const blob = new Blob([edicionCritica(atlas, contenido)], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `edicion-critica-${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

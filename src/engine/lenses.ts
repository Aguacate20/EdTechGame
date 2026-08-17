import type { ModificadoresLente } from './tools'
import { SIN_LENTES } from './tools'

/** Las lentes son los jokers. Cada una dice QUÉ BUSCAR en el texto: una run con
 *  la Lente del disidente te convierte en alguien que caza oposiciones. La build
 *  es un plan de lectura, y por eso cada partida te hace leer distinto. */
export interface Lente {
  id: string
  nombre: string
  regla: string
  costo: string
  mod: Partial<ModificadoresLente>
  raro?: boolean
}

export const LENTES: Lente[] = [
  { id: 'disidente', nombre: 'Lente del disidente',
    regla: 'Los contrastes multiplican mucho más.',
    costo: 'Los apoyos, la relación más común del texto, dejan de rendir.',
    mod: { multPorTipo: { contrasta: 1.6, apoya: -0.3 } } },
  { id: 'topografo', nombre: 'Lente del topógrafo',
    regla: 'Los campos semánticos y las jerarquías valen mucho más.',
    costo: 'Exige haber entendido cómo está dividido el texto.',
    mod: { multPorHerramienta: { campo: 1.2, jerarquia: 1.2 } } },
  { id: 'umbral', nombre: 'Lente del umbral',
    regla: 'Cada concepto umbral del diagrama suma bastante más.',
    costo: 'Los umbrales son los más difíciles de definir bien.',
    mod: { multPorUmbral: 0.6 } },
  { id: 'causalista', nombre: 'Lente causalista',
    regla: 'Causa, requisito y secuencias rinden más.',
    costo: 'Es fácil confundir causa con correlación y afirmar al revés.',
    mod: { multPorTipo: { causa: 0.9, requiere: 0.9 }, multPorHerramienta: { secuencia: 1 } } },
  { id: 'traductor', nombre: 'Lente del traductor',
    regla: 'Las anclas de caso valen mucho más.',
    costo: 'Los casos ocupan sitio y exigen saber qué opera en ellos.',
    mod: { multPorHerramienta: { ancla: 1.4 } } },
  { id: 'lexicografo', nombre: 'Lente del lexicógrafo',
    regla: 'Emparejar nombre y descripción rinde el triple.',
    costo: 'Reconocer no es relacionar: llena poco Atlas.',
    mod: { multPorHerramienta: { identidad: 1.4 }, fichasPorSostenido: 3 } },
  { id: 'inquisidor', nombre: 'Lente del inquisidor',
    regla: 'Detectar falsificaciones rinde mucho más.',
    costo: 'Tachar una carta legítima duele el doble.',
    mod: { multPorHerramienta: { tachon: 1.6 } } },
  { id: 'arquitecto', nombre: 'Lente del arquitecto',
    regla: 'Los combos de articulación y constelación escalan más.',
    costo: 'Premia diagramas grandes, y un solo error los derrumba enteros.',
    mod: { multPorCombo: { articulacion: 1, constelacion: 1.5 } } },
  { id: 'abogado', nombre: 'Lente del abogado', raro: true,
    regla: 'La balanza rinde muchísimo más.',
    costo: 'Solo hay unas pocas tesis en todo el texto.',
    mod: { multPorHerramienta: { balanza: 2 } } },
  { id: 'terapeuta', nombre: 'Lente del terapeuta', raro: true,
    regla: 'Reubicar una intuición cura y multiplica.',
    costo: 'Requiere que un Eco te haya dejado intuiciones primero.',
    mod: { multGlobal: 0.4 } },
  { id: 'coleccionista', nombre: 'Lente del coleccionista', raro: true,
    regla: 'Multiplicador fijo sobre todo el diagrama y un enemigo más de alcance.',
    costo: 'No te empuja a leer de ninguna manera concreta.',
    mod: { multGlobal: 0.8, alcanceExtra: 1 } }
]

export const lentePorId = (id: string): Lente => LENTES.find((l) => l.id === id) ?? LENTES[0]

export function combinarLentes(ids: string[]): ModificadoresLente {
  const out: ModificadoresLente = {
    multPorTipo: {}, multPorHerramienta: {}, multPorCombo: {},
    fichasPorSostenido: 0, multPorUmbral: 0, multGlobal: 0, alcanceExtra: 0
  }
  for (const id of ids) {
    const l = lentePorId(id)
    for (const [k, v] of Object.entries(l.mod.multPorTipo ?? {})) {
      out.multPorTipo[k] = (out.multPorTipo[k] ?? 0) + v
    }
    Object.assign(out.multPorHerramienta, Object.fromEntries(
      Object.entries(l.mod.multPorHerramienta ?? {}).map(([k, v]) => [
        k, (out.multPorHerramienta as Record<string, number>)[k] ?? 0 + (v as number)
      ])
    ))
    for (const [k, v] of Object.entries(l.mod.multPorCombo ?? {})) {
      (out.multPorCombo as Record<string, number>)[k] =
        ((out.multPorCombo as Record<string, number>)[k] ?? 0) + (v as number)
    }
    out.fichasPorSostenido += l.mod.fichasPorSostenido ?? 0
    out.multPorUmbral += l.mod.multPorUmbral ?? 0
    out.multGlobal += l.mod.multGlobal ?? 0
    out.alcanceExtra += l.mod.alcanceExtra ?? 0
  }
  return out
}

export { SIN_LENTES }

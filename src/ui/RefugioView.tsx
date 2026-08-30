import { useMemo, useState } from 'react'
import type { Contenido } from '../content/types'
import { estadoDe, nivelDe, type Atlas } from '../engine/atlas'
import { Rng } from '../engine/rng'

/* ==========================================================================
   El alto en el camino.
   No es una pantalla de carga con una frase bonita: es una comprobación de
   autoconocimiento. Se te pregunta algo sobre TI —qué se te está resistiendo,
   qué ya sostienes— y el juego compara tu respuesta con lo que el Atlas sabe
   de verdad. Acertar sobre uno mismo paga lucidez; fallar también enseña,
   porque te enseña que te estabas leyendo mal.
   ========================================================================== */

export type TipoPregunta = 'cuesta' | 'domina' | 'vinculo' | 'olvido'

export interface Pregunta {
  tipo: TipoPregunta
  enunciado: string
  pie: string
  opciones: { id: string; texto: string; correcta: boolean }[]
  revelacion: (acertó: boolean) => string
}

function construir(atlas: Atlas, c: Contenido, semilla: string): Pregunta | null {
  const rng = new Rng(semilla)
  const tocados = c.ordenConceptos.filter((id) => atlas.conceptos[id])
  if (tocados.length < 3) return null

  const conFallos = tocados
    .map((id) => ({ id, e: atlas.conceptos[id]! }))
    .filter((x) => x.e.fallos > 0)
    .sort((a, b) => b.e.fallos - a.e.fallos)

  const firmes = tocados
    .map((id) => ({ id, e: atlas.conceptos[id]! }))
    .filter((x) => nivelDe(x.e) >= 2)

  const T = (id: string) => c.conceptos[id]?.titulo ?? id

  // 1. ¿Sabes qué se te está resistiendo?
  if (conFallos.length >= 1 && tocados.length >= 4) {
    const peor = conFallos[0]
    const otros = rng.sample(tocados.filter((id) => id !== peor.id), 3)
    return {
      tipo: 'cuesta',
      enunciado: '¿Cuál de estos dirías que se te está resistiendo más?',
      pie: 'No hay trampa: el Atlas lleva la cuenta. Se trata de ver si tú también.',
      opciones: rng.shuffle([peor.id, ...otros]).map((id) => ({
        id, texto: T(id), correcta: id === peor.id
      })),
      revelacion: (ok) => ok
        ? `Exacto: «${T(peor.id)}» te ha fallado ${peor.e.fallos} vez/veces frente a ${peor.e.aciertos} acierto(s). Verte venir el tropiezo es media corrección.`
        : `El que más se te resiste es «${T(peor.id)}»: ${peor.e.fallos} fallo(s) frente a ${peor.e.aciertos} acierto(s). Conviene tenerlo en el radar.`
    }
  }

  // 2. ¿Sabes qué ya sostienes?
  if (firmes.length >= 1 && tocados.length >= 4) {
    const bueno = rng.pick(firmes)
    const otros = rng.sample(tocados.filter((id) => id !== bueno.id && nivelDe(atlas.conceptos[id]) < 2), 3)
    if (otros.length >= 2) {
      return {
        tipo: 'domina',
        enunciado: '¿Cuál de estos crees que ya tienes firme?',
        pie: 'Reconocer lo que ya está sostenido evita repasar de más lo que no hace falta.',
        opciones: rng.shuffle([bueno.id, ...otros]).map((id) => ({
          id, texto: T(id), correcta: id === bueno.id
        })),
        revelacion: (ok) => ok
          ? `Sí: «${T(bueno.id)}» lo has sostenido desde ${new Set(bueno.e.mecanicas).size} herramientas distintas.`
          : `El que tienes más firme es «${T(bueno.id)}». A los otros aún les falta evidencia.`
      }
    }
  }

  // 3. ¿Recuerdas un vínculo que ya trazaste?
  const aristas = Object.values(atlas.aristas)
  if (aristas.length >= 1) {
    const real = rng.pick(aristas)
    const tipos = Object.keys(c.frecuenciaRelacion).filter((t) => t !== real.tipo)
    return {
      tipo: 'vinculo',
      enunciado: `Ya trazaste un vínculo entre «${T(real.from)}» y «${T(real.to)}». ¿Cuál era?`,
      pie: 'Lo sostuviste antes. Recuperarlo sin tenerlo delante es otra cosa.',
      opciones: rng.shuffle([
        { id: real.tipo, texto: real.tipo, correcta: true },
        ...rng.sample(tipos, 3).map((t) => ({ id: t, texto: t, correcta: false }))
      ]),
      revelacion: (ok) => ok
        ? `Eso es: ${T(real.from)} ${real.tipo} ${T(real.to)}.`
        : `Era «${real.tipo}»: ${T(real.from)} ${real.tipo} ${T(real.to)}. Vuelve a trazarlo cuando lo veas.`
    }
  }
  return null
}

export function RefugioView({
  atlas, contenido, semilla, lucidez, lucidezMax, onSeguir, archivados, onArchivar
}: {
  atlas: Atlas
  contenido: Contenido
  semilla: string
  lucidez: number
  lucidezMax: number
  onSeguir: (lucidezGanada: number, acierto: boolean | null) => void
  /** conceptos dominados que ya salieron de la mesa en esta run */
  archivados: string[]
  /** retirar del resto de la run un concepto dominado: la mano se adelgaza */
  onArchivar: (id: string) => void
}) {
  const pregunta = useMemo(() => construir(atlas, contenido, semilla), [atlas, contenido, semilla])
  const [elegida, setElegida] = useState<string | null>(null)

  const resuelta = elegida !== null
  const acerto = resuelta && !!pregunta?.opciones.find((o) => o.id === elegida)?.correcta
  const ganada = !pregunta ? 24 : acerto ? 32 : 18

  const cuestan = contenido.ordenConceptos.filter((id) => estadoDe(atlas.conceptos[id]) === 'cuesta')
  const [yaArchivado, setYaArchivado] = useState(false)
  // solo sale de la mesa lo que ya está consolidado, y sale PORQUE lo está
  const archivables = contenido.ordenConceptos.filter((id) =>
    !archivados.includes(id) &&
    (estadoDe(atlas.conceptos[id]) === 'dominado' || nivelDe(atlas.conceptos[id]) >= 3))

  return (
    <div className="envoltura pila" style={{ maxWidth: 760 }}>
      <div>
        <span className="eyebrow">Un alto en el camino</span>
        <h2 className="display" style={{ fontSize: 28 }}>
          {pregunta ? 'Antes de seguir, una sobre ti' : 'Recupera el aliento'}
        </h2>
      </div>

      {pregunta ? (
        <div className="panel pila">
          <p className="serif-lectura" style={{ margin: 0, fontSize: 16 }}>{pregunta.enunciado}</p>
          <span className="silencio" style={{ fontSize: 13 }}>{pregunta.pie}</span>

          <div className="opciones" style={{ marginTop: 6 }}>
            {pregunta.opciones.map((o) => (
              <button
                key={o.id}
                className={`ficha opcion${resuelta && o.correcta ? ' elegida' : ''}${resuelta && elegida === o.id && !o.correcta ? ' rechazada' : ''}`}
                disabled={resuelta}
                onClick={() => setElegida(o.id)}
              >
                <span className="cuerpo" style={{ fontSize: 14 }}>{o.texto}</span>
              </button>
            ))}
          </div>

          {resuelta && (
            <>
              <p className={`nota ${acerto ? 'ok' : 'nota'}`} style={{ margin: 0 }}>
                {pregunta.revelacion(acerto)}
              </p>
              <p className="dato" style={{ margin: 0, color: '#85c4b1' }}>
                Recuperas {ganada} de lucidez{acerto ? ' — leerse bien sale a cuenta' : ''}.
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="silencio serif-lectura">
          Todavía no hay bastante historial para preguntarte nada sobre ti. Descansa y
          sigue: eso llega solo.
        </p>
      )}

      {cuestan.length > 0 && resuelta && (
        <div className="panel">
          <span className="eyebrow">En el radar</span>
          <p style={{ margin: '6px 0 0', fontSize: 13.5 }}>
            {cuestan.slice(0, 4).map((id) => contenido.conceptos[id]?.titulo).join(' · ')}
          </p>
        </div>
      )}

      <div className="fila">
        {archivables.length > 0 && (
        <div className="panel">
          <span className="eyebrow">Archivar un concepto dominado</span>
          <p className="silencio" style={{ margin: '4px 0 8px', fontSize: 13.5 }}>
            Lo que ya dominas puede salir de la mesa por el resto de la expedición:
            la mano se adelgaza y lo demás llega más seguido. Uno por refugio.
          </p>
          <div className="fila" style={{ flexWrap: 'wrap', gap: 8 }}>
            {archivables.slice(0, 6).map((id) => (
              <button key={id} className="btn chico" disabled={yaArchivado}
                onClick={() => { onArchivar(id); setYaArchivado(true) }}>
                {yaArchivado ? '✓ ' : '⌸ '}{contenido.conceptos[id]?.titulo ?? id}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
          className="btn primario grande"
          onClick={() => onSeguir(ganada, pregunta ? acerto : null)}
          disabled={!!pregunta && !resuelta}
        >
          Seguir · {lucidez}/{lucidezMax} → {Math.min(lucidezMax, lucidez + ganada)}
        </button>
      </div>
    </div>
  )
}

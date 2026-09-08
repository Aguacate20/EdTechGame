import { useState } from 'react'
import type { Contenido } from '../content/types'
import type { Atlas } from '../engine/atlas'
import type { Encargo } from '../engine/srl'
import { tipoPorId } from '../engine/lane'
import { Galaxia } from './Galaxia'

/** El cierre de sala: la galaxia con lo ganado (arriba) y, debajo, una fila
 *  de tarjetas con lo que antes contaba el mapa: el golpe más fuerte, lo
 *  desbloqueado, el encargo y los sellos, y la marca de «qué te costó más»,
 *  que sigue siendo obligatoria porque es la autorreflexión con consecuencia. */
interface Props {
  contenido: Contenido
  atlas: Atlas
  nuevos: { aristas: string[]; conceptos: string[] }
  mejorGolpe: { dano: number; fichas: number; mult: number; trazos: number }
  enemigos: { tipoId: string; nombre: string; hpMax: number }[]
  descubiertos: string[]
  hazanas: { nombre: string; lente: string }[]
  srl: { encargo: Encargo | null; cumplido: boolean; sellosHechos: number; sellosAcertados: number; candidatos: string[] }
  onSeguir: (marcado: string | null) => void
}

export function CierreView({ contenido, atlas, nuevos, mejorGolpe, enemigos, descubiertos, hazanas, srl, onSeguir }: Props) {
  const [marcado, setMarcado] = useState<string | null | undefined>(undefined)
  const t = (id: string) => contenido.conceptos[id]?.titulo ?? id
  const vencidos = [...new Set(enemigos.map((x) => tipoPorId(x.tipoId).nombre))]
  const nAristas = nuevos.aristas.length, nConceptos = nuevos.conceptos.length
  const desbloqueado = [
    ...descubiertos.map((d) => ({ que: `Vínculo «${d}»`, nota: 'ya lo puedes trazar' })),
    ...hazanas.map((h) => ({ que: h.nombre, nota: `lente: ${h.lente}` }))
  ]

  return (
    <section className="cierre">
      <div className="cierre-cab">
        <small>·· · Nuevo conocimiento · ··</small>
        <b>{nAristas ? `${nAristas} vínculo${nAristas === 1 ? '' : 's'} nuevo${nAristas === 1 ? '' : 's'} en tu cielo${nConceptos ? ` · ${nConceptos} estrella${nConceptos === 1 ? '' : 's'} más brillante${nConceptos === 1 ? '' : 's'}` : ''}` : 'Tu cielo sigue igual: la próxima sala puede encenderlo'}</b>
      </div>
      <Galaxia contenido={contenido} atlas={atlas} modo="cierre" alto={360} nuevos={nuevos} />

      <div className="cierre-fila">
        <article className="panel cierre-tarjeta">
          <h3>Tu golpe más fuerte</h3>
          <b className="cierre-num">{mejorGolpe.dano}</b>
          <p>{mejorGolpe.trazos ? `${mejorGolpe.fichas} fichas × ${mejorGolpe.mult.toFixed(1)} en un diagrama de ${mejorGolpe.trazos} trazo${mejorGolpe.trazos === 1 ? '' : 's'}.` : 'Ningún diagrama se sostuvo esta vez.'}</p>
          <small>{vencidos.length ? `Derribaste: ${vencidos.join(', ')}` : ''}</small>
        </article>

        <article className="panel cierre-tarjeta">
          <h3>Lo que se desbloqueó</h3>
          {desbloqueado.length === 0 && nAristas === 0 ? <p>Nada nuevo esta vez. Un diagrama sostenido abre camino.</p> : (
            <ul className="cierre-lista">
              {nuevos.conceptos.slice(0, 3).map((id) => <li key={id}><i className="estrella-oro" />{t(id)} <small>sube de nivel</small></li>)}
              {desbloqueado.slice(0, 3).map((d, i) => <li key={i}><i className="estrella-cian" />{d.que} <small>{d.nota}</small></li>)}
            </ul>
          )}
        </article>

        <article className="panel cierre-tarjeta">
          <h3>Tu encargo</h3>
          {srl.encargo ? (
            <>
              <b className="panel-titulo">{srl.cumplido ? '✓ Cumplido' : 'Pendiente'}</b>
              <p>{srl.encargo.titulo}. {srl.cumplido ? 'Cumplir lo que te propusiste cura.' : 'No castiga; solo no cura.'}</p>
            </>
          ) : <p>Sin encargo en esta sala.</p>}
          {srl.sellosHechos > 0 && <small>Sellaste {srl.sellosHechos} y {srl.sellosAcertados} se sostuvieron enteros.</small>}
        </article>

        <article className="panel cierre-tarjeta marca">
          <h3>¿Qué te costó más?</h3>
          <p>Lo que marques vuelve en la próxima sala con prima.</p>
          <div className="cierre-marcas">
            {srl.candidatos.map((id) => (
              <button key={id} className={`btn chico fantasma marcar${marcado === id ? ' activo' : ''}`}
                onClick={() => setMarcado(marcado === id ? undefined : id)}>{t(id)}</button>
            ))}
            <button className={`btn chico fantasma marcar${marcado === null ? ' activo' : ''}`}
              onClick={() => setMarcado(marcado === null ? undefined : null)}>Nada me costó</button>
          </div>
        </article>
      </div>

      <div className="cierre-pie">
        <button className="btn primario inicio-continuar" disabled={marcado === undefined} onClick={() => onSeguir(marcado ?? null)}>
          {marcado === undefined ? 'Marca algo para seguir' : 'Recoger el hallazgo'}
        </button>
      </div>
    </section>
  )
}

import { useState } from 'react'
import type { Contenido } from '../content/types'
import type { Atlas } from '../engine/atlas'
import type { Nodo } from '../engine/route'
import {
  desafiosPara, organizadorDe, PREDICCIONES, type Desafio, type DesafioId, type Prediccion
} from '../engine/srl'
import { Rng } from '../engine/rng'

/* ==========================================================================
   La antesala.
   Tres cosas de la fase de previsión en una sola pantalla, porque es la fase
   que mejor predice que alguien termine y la que peor cubríamos:
     · el organizador previo — material más general, presentado ANTES, que
       orienta hacia lo que viene (Ausubel)
     · la predicción — cuánto crees que vas a sostener, para contrastarlo al
       cerrar y saber si te lees bien
     · el desafío opcional — subirse uno mismo la dificultad a cambio de más
   Dos toques y dentro. Nada de esto entra en el combate.
   ========================================================================== */

export function Antesala({ nodo, contenido, atlas, onEntrar }: {
  nodo: Nodo
  contenido: Contenido
  atlas: Atlas
  onEntrar: (prediccion: Prediccion, desafio: DesafioId | null) => void
}) {
  const [prediccion, setPrediccion] = useState<Prediccion | null>(null)
  const [desafio, setDesafio] = useState<DesafioId | null>(null)
  const [leido, setLeido] = useState(false)

  const org = organizadorDe(contenido, nodo.conceptIds, atlas)
  const desafios: Desafio[] = desafiosPara(nodo.dificultad, new Rng(nodo.id))
  const otros = nodo.conceptIds
    .filter((id) => id !== org?.conceptId)
    .map((id) => contenido.conceptos[id]?.titulo)
    .filter(Boolean)

  return (
    <div className="envoltura pila antesala">
      <div>
        <span className="eyebrow">
          Antes de entrar · {nodo.dificultad === 'jefe' ? 'jefe' : `oleada ${nodo.dificultad}`}
          {nodo.minutos ? ` · unos ${nodo.minutos} min` : ''}
        </span>
        <h2 className="display" style={{ fontSize: 28 }}>Lo que vas a encontrar</h2>
      </div>

      {/* ---------------------- el organizador previo ---------------------- */}
      {org && (
        <div className="organizador" onMouseEnter={() => setLeido(true)}>
          <div className="fila" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="eyebrow">La idea que engloba a las demás</span>
            {org.esPuerta && <span className="pastilla">concepto puerta</span>}
            {org.esUmbral && <span className="pastilla brillo">umbral</span>}
            {org.nivel > 0 && (
              <span className="dato silencio">
                {org.nivel === 1 ? 'ya lo reconociste' : org.nivel === 2 ? 'lo has sostenido' : 'lo dominas'}
              </span>
            )}
          </div>
          <h3 className="h2" style={{ margin: '4px 0 2px' }}>{org.titulo}</h3>
          <p className="serif-lectura" style={{ margin: 0 }}>{org.definicion}</p>
          {org.conocidos.length > 0 && (
            <p className="silencio" style={{ margin: '8px 0 0', fontSize: 13 }}>
              De tu Atlas: {org.conocidos.map((k) => `${k.tipo} → ${k.otro}`).join(' · ')}
            </p>
          )}
          {otros.length > 0 && (
            <p className="dato silencio" style={{ margin: '8px 0 0' }}>
              También aparecen: {otros.slice(0, 5).join(' · ')}
              {otros.length > 5 ? ` y ${otros.length - 5} más` : ''}
            </p>
          )}
          {nodo.dominios.length > 0 && (
            <p className="dominios" style={{ margin: '10px 0 0' }}>
              Esto se usa en: <strong>{nodo.dominios.join(' · ')}</strong>
            </p>
          )}
        </div>
      )}

      {/* --------------------------- la predicción -------------------------- */}
      <div className="bloque-previo">
        <span className="eyebrow">¿Cuántos vínculos crees que vas a sostener aquí?</span>
        <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
          {PREDICCIONES.map((p) => (
            <button
              key={p.id}
              className={`apuesta${prediccion === p.id ? ' activa' : ''}`}
              onClick={() => setPrediccion(p.id)}
            >{p.texto}</button>
          ))}
        </div>
        <span className="silencio" style={{ fontSize: 12.5 }}>
          Al terminar la sala se compara con lo que sostuviste. No penaliza: sirve para
          saber si te lees bien.
        </span>
      </div>

      {/* ---------------------------- el desafío ---------------------------- */}
      <div className="bloque-previo">
        <span className="eyebrow">¿Te pones una regla extra? · opcional, da un hallazgo más</span>
        <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`apuesta${desafio === null ? ' activa' : ''}`}
            onClick={() => setDesafio(null)}
          >Sin regla</button>
          {desafios.map((d) => (
            <button
              key={d.id}
              className={`apuesta${desafio === d.id ? ' activa' : ''}`}
              onClick={() => setDesafio(d.id)}
              data-ayuda={`${d.nombre.toUpperCase()}\n${d.regla}`}
            >{d.nombre}</button>
          ))}
        </div>
        {desafio && (
          <span className="silencio" style={{ fontSize: 12.5 }}>
            {desafios.find((d) => d.id === desafio)?.regla}
          </span>
        )}
      </div>

      <div className="fila">
        <button
          className="btn primario grande"
          disabled={!prediccion}
          onClick={() => prediccion && onEntrar(prediccion, desafio)}
        >Entrar</button>
        {!prediccion && (
          <span className="silencio" style={{ fontSize: 12.5, alignSelf: 'center' }}>
            Haz tu apuesta antes de entrar.
          </span>
        )}
        {!leido && org && (
          <span className="dato silencio" style={{ alignSelf: 'center' }}>
            {/* se registra si el organizador se leyó o se saltó */}
          </span>
        )}
      </div>
    </div>
  )
}

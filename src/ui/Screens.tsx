import type { Contenido } from '../content/types'
import { instrumentoPorId, porId, type EfectoInstrumento } from '../engine/cards'
import { ARQUETIPOS, condicionPorId } from '../engine/encounters'
import type { Acto, Nodo, Recompensa, Ruta } from '../engine/run'
import { coberturaAtlas, nivelDe, type Atlas } from '../engine/atlas'
import { Chip, Panel } from './components'

/* ---------------------------------- mapa ---------------------------------- */

export function MapView({ ruta, acto, capaActual, visitados, onElegir, contenido }: {
  ruta: Ruta; acto: Acto; capaActual: number; visitados: string[]
  onElegir: (n: Nodo) => void; contenido: Contenido
}) {
  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">
          Acto {acto.index + 1} de {ruta.actos.length} · semilla {ruta.semilla}
        </span>
        <h2 className="display" style={{ fontSize: 30 }}>{acto.titulo}</h2>
        <p className="silencio" style={{ margin: 0, fontSize: 14 }}>
          Dificultad objetivo {acto.dificultadObjetivo.toFixed(2)} · mano de {acto.manoSugerida} ·{' '}
          {acto.capas.flat()[0]?.conceptIds.length ?? 0} conceptos en juego
        </p>
      </div>

      <div className="mapa">
        {acto.capas.map((fila, i) => (
          <div className="capa" key={i}>
            <div className="guia">{i === capaActual ? '▸ ahora' : i < capaActual ? 'recorrido' : ''}</div>
            {fila.map((n) => {
              const hecho = visitados.includes(n.id)
              const arq = n.arquetipo ? ARQUETIPOS[n.arquetipo] : null
              const cond = n.condicion ? condicionPorId(n.condicion) : null
              return (
                <button
                  key={n.id}
                  className={`nodo${n.tipo === 'jefe' ? ' jefe' : n.tipo === 'elite' ? ' elite' : ''}${hecho ? ' hecho' : ''}`}
                  disabled={i !== capaActual}
                  onClick={() => onElegir(n)}
                >
                  <span className="tipo">
                    {n.tipo === 'jefe' ? 'Jefe' : n.tipo === 'elite' ? 'Élite'
                      : n.tipo === 'refugio' ? 'Refugio' : n.tipo === 'taller' ? 'Taller' : 'Encuentro'}
                  </span>
                  <span className="nom">{n.etiqueta}</span>
                  <span className="pista">{arq?.descripcion ?? n.pista}</span>
                  {cond && <span style={{ marginTop: 4 }}><Chip tono="laton">{cond.nombre}</Chip></span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <p className="silencio" style={{ fontSize: 13, maxWidth: 660 }}>
        El camino que elijas decide qué contenido enfrentas. Tu mazo de verbos decide si estás
        preparado para él. {Object.values(contenido.conceptos).filter((c) => c.esUmbral).length} conceptos
        de este texto reorganizan el mapa cuando los dominas.
      </p>
    </div>
  )
}

/* ------------------------------- recompensa ------------------------------- */

export function RewardView({ opciones, onElegir, titulo }: {
  opciones: Recompensa[]; onElegir: (r: Recompensa) => void; titulo: string
}) {
  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">Hallazgo</span>
        <h2 className="display" style={{ fontSize: 28 }}>{titulo}</h2>
      </div>
      <div className="mano" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {opciones.map((r, i) => {
          const c = r.tipo === 'verbo' || r.tipo === 'mejora' ? porId(r.cardId) : null
          const ins = r.tipo === 'instrumento' ? instrumentoPorId(r.id) : null
          return (
            <button key={i} className="ficha" onClick={() => onElegir(r)} style={{ minHeight: 150 }}>
              <span className="tt">
                {r.tipo === 'verbo' ? 'Verbo nuevo' : r.tipo === 'mejora' ? 'Mejora de verbo'
                  : r.tipo === 'instrumento' ? (ins?.maldito ? 'Instrumento maldito' : 'Instrumento') : 'Descanso'}
              </span>
              <span className="nom">
                {c?.nombre ?? ins?.nombre ?? `Recuperas ${r.tipo === 'lucidez' ? r.cantidad : ''} de lucidez`}
              </span>
              <span className="cuerpo">
                {c?.glosa ?? ins?.regla ?? 'Cerrar los ojos un momento también es una decisión.'}
              </span>
              {ins && <span className="cuerpo silencio" style={{ fontStyle: 'italic' }}>{ins.costo}</span>}
              {r.tipo === 'mejora' && (
                <span className="cuerpo silencio">Sustituye a {porId(r.reemplaza).nombre}.</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* -------------------------------- refugio --------------------------------- */

export function CampfireView({ mazo, instrumentos, onDescansar, onRetirar, lucidez, lucidezMax }: {
  mazo: string[]; instrumentos: EfectoInstrumento[]
  onDescansar: () => void; onRetirar: (cardId: string) => void
  lucidez: number; lucidezMax: number
}) {
  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">Refugio</span>
        <h2 className="display" style={{ fontSize: 28 }}>Un alto para revisar</h2>
        <p className="silencio" style={{ maxWidth: 620, fontSize: 14 }}>
          Puedes recuperar lucidez o retirar un verbo del mazo. Un mazo más corto llega antes a
          la jugada que quieres: depurar es la mejor decisión que casi nadie toma a tiempo.
        </p>
      </div>

      <div className="fila">
        <button className="btn primario" onClick={onDescansar}>
          Descansar · recuperas lucidez ({lucidez}/{lucidezMax})
        </button>
      </div>

      <Panel titulo="Tu mazo de verbos">
        <div className="mano">
          {mazo.map((id, i) => {
            const c = porId(id)
            return (
              <button key={`${id}-${i}`} className="ficha" onClick={() => onRetirar(id)}>
                <span className="tt">{c.familias.length ? `Familia ${c.familias.join('/')}` : 'Utilidad'}</span>
                <span className="nom">{c.nombre}</span>
                <span className="cuerpo">{c.glosa}</span>
                <span className="cuerpo silencio">Toca para retirarlo del mazo.</span>
              </button>
            )
          })}
        </div>
      </Panel>

      {instrumentos.length > 0 && (
        <Panel titulo="Instrumentos">
          <div className="rejilla">
            {instrumentos.map((id) => {
              const ins = instrumentoPorId(id)
              return (
                <div className="celda" key={id}>
                  <strong>{ins.nombre}</strong>
                  <p className="silencio" style={{ fontSize: 13, margin: '4px 0 0' }}>{ins.regla}</p>
                </div>
              )
            })}
          </div>
        </Panel>
      )}
    </div>
  )
}

/* --------------------------------- atlas ---------------------------------- */

export function AtlasView({ atlas, contenido, onVolver }: {
  atlas: Atlas; contenido: Contenido; onVolver: () => void
}) {
  const cob = coberturaAtlas(atlas, contenido)
  const calib = atlas.apuestasTotales
    ? Math.round((atlas.apuestasCalibradas / atlas.apuestasTotales) * 100)
    : null
  const conceptos = contenido.ordenConceptos.map((id) => ({
    c: contenido.conceptos[id], e: atlas.conceptos[id]
  })).filter((x) => x.c)

  return (
    <div className="envoltura pila">
      <div>
        <span className="eyebrow">Atlas · {contenido.fuente}</span>
        <h2 className="display" style={{ fontSize: 30 }}>El mapa que llevas reconstruido</h2>
        <p className="silencio" style={{ fontSize: 14, maxWidth: 660 }}>
          Esto no es un puntaje. Es el mapa de ideas del texto tal como lo has sostenido tú:
          firme donde acertaste desde varios ángulos, borroso donde todavía no.
        </p>
      </div>

      <div className="fila">
        <div className="celda" style={{ flex: '1 1 180px' }}>
          <span className="eyebrow">Cobertura</span>
          <div style={{ fontSize: 30, fontFamily: 'var(--mono)' }}>{cob.pct}%</div>
        </div>
        <div className="celda" style={{ flex: '1 1 180px' }}>
          <span className="eyebrow">Vínculos trazados</span>
          <div style={{ fontSize: 30, fontFamily: 'var(--mono)' }}>
            {cob.aristas}<span className="silencio" style={{ fontSize: 16 }}>/{contenido.aristas.length}</span>
          </div>
        </div>
        <div className="celda" style={{ flex: '1 1 180px' }}>
          <span className="eyebrow">Calibración</span>
          <div style={{ fontSize: 30, fontFamily: 'var(--mono)' }}>
            {calib === null ? '—' : `${calib}%`}
          </div>
          <span className="silencio" style={{ fontSize: 12 }}>apuestas que acompañaron al resultado</span>
        </div>
        <div className="celda" style={{ flex: '1 1 180px' }}>
          <span className="eyebrow">Expediciones</span>
          <div style={{ fontSize: 30, fontFamily: 'var(--mono)' }}>
            {atlas.victorias}<span className="silencio" style={{ fontSize: 16 }}>/{atlas.runs}</span>
          </div>
        </div>
      </div>

      <Panel titulo="Conceptos">
        <div className="rejilla">
          {conceptos.map(({ c, e }) => {
            const n = nivelDe(e)
            return (
              <div className="celda" key={c.id}>
                <div className="fila" style={{ justifyContent: 'space-between', gap: 6 }}>
                  <strong style={{ fontSize: 14 }}>{c.titulo}</strong>
                  {c.esUmbral && <Chip tono="laton">umbral</Chip>}
                </div>
                <p className="silencio" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
                  {n === 0 ? 'sin evidencia todavía'
                    : n === 1 ? 'reconocido'
                    : n === 2 ? 'sostenido desde dos ángulos'
                    : 'dominado: recuperas, distingues y relacionas'}
                </p>
                <div className="barrita"><span style={{ width: `${(n / 3) * 100}%` }} /></div>
              </div>
            )
          })}
        </div>
      </Panel>

      {Object.keys(atlas.aristas).length > 0 && (
        <Panel titulo="Vínculos que has sostenido">
          <table className="tabla">
            <thead><tr><th>Desde</th><th>Vínculo</th><th>Hacia</th><th>Veces</th></tr></thead>
            <tbody>
              {Object.values(atlas.aristas).map((a, i) => (
                <tr key={i}>
                  <td>{contenido.conceptos[a.from]?.titulo ?? a.from}</td>
                  <td><Chip tono="verde">{a.tipo}</Chip></td>
                  <td>{contenido.conceptos[a.to]?.titulo ?? a.to}</td>
                  <td className="dato">{a.aciertos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <div className="fila">
        <button className="btn primario" onClick={onVolver}>Volver</button>
      </div>
    </div>
  )
}

/* --------------------------------- final ---------------------------------- */

export function EndView({ victoria, atlas, contenido, onReiniciar, onAtlas }: {
  victoria: boolean; atlas: Atlas; contenido: Contenido
  onReiniciar: () => void; onAtlas: () => void
}) {
  const cob = coberturaAtlas(atlas, contenido)
  return (
    <div className="envoltura pila" style={{ maxWidth: 700 }}>
      <span className="eyebrow">{victoria ? 'Expedición completa' : 'La expedición se interrumpe'}</span>
      <h2 className="display">
        {victoria ? 'El Archivo queda estabilizado' : 'Te quedas sin lucidez'}
      </h2>
      <p className="serif-lectura silencio">
        {victoria
          ? 'Recorriste el texto entero y sostuviste sus vínculos. El mapa que armaste queda en el Atlas.'
          : 'La expedición termina, pero el Atlas conserva todo lo que sostuviste. Nada de lo aprendido se pierde al perder.'}
      </p>
      <p className="dato">Cobertura del Atlas: {cob.pct}% · {cob.aristas} vínculos trazados</p>
      <div className="fila">
        <button className="btn primario" onClick={onReiniciar}>Nueva expedición</button>
        <button className="btn fantasma" onClick={onAtlas}>Ver el Atlas</button>
      </div>
    </div>
  )
}

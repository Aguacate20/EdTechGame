import { porId } from '../engine/cards'
import { APUESTAS, sirve, type Apuesta, type EstadoCombate } from '../engine/combat'
import { condicionPorId } from '../engine/encounters'
import type { Contenido } from '../content/types'
import { Chip, Medidor, Sello } from './components'

export interface AccionesCombate {
  elegirOpcion: (id: string) => void
  jugarCarta: (uid: string) => void
  apostar: (a: Apuesta) => void
  resolver: () => void
  continuar: () => void
  descartarMano: () => void
  consultar: (uid: string) => void
  improvisar: () => void
  huir: () => void
}

export function CombatView({ e, contenido, on, lucidez, lucidezMax }: {
  e: EstadoCombate; contenido: Contenido; on: AccionesCombate
  lucidez: number; lucidezMax: number
}) {
  const emb = e.embate
  const cond = e.condicion ? condicionPorId(e.condicion) : null
  const cartaJugada = e.cartaJugada ? porId(e.cartaJugada) : null
  const resuelto = e.fase !== 'eligiendo'
  const puedeResolver = !resuelto && e.seleccion.length > 0 && e.apuesta !== null &&
    (cartaJugada !== null || e.acciones <= 0)
  const objetivo = emb.conceptoObjetivo ? contenido.conceptos[emb.conceptoObjetivo] : null

  return (
    <div className="envoltura pila">
      <div className="fila" style={{ alignItems: 'center', gap: 18 }}>
        <div>
          <span className="eyebrow">{e.arquetipo.rango === 'jefe' ? 'Jefe' : e.arquetipo.rango === 'elite' ? 'Élite' : 'Encuentro'}</span>
          <h2 className="h2" style={{ margin: 0 }}>{e.nombre}</h2>
          <p className="silencio" style={{ margin: 0, fontSize: 13 }}>{e.arquetipo.lema}</p>
        </div>
        <div className="sep" style={{ flex: 1 }} />
        <Medidor valor={lucidez} max={lucidezMax} etiqueta="Lucidez" />
        <Medidor valor={e.hp} max={e.hpMax} etiqueta="Resistencia" enemigo />
      </div>

      {cond && (
        <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
          <Chip tono="laton">{cond.nombre}</Chip>
          <span className="silencio" style={{ fontSize: 13 }}>{cond.regla}</span>
        </div>
      )}

      <div className="embate">
        {/* ------------------------------ izquierda ---------------------------- */}
        <div className="pergamino pila">
          <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="eyebrow">{emb.titulo} · turno {e.turno}</span>
            {e.condicion !== 'niebla' && (
              <span className="dato silencio">dificultad {emb.dificultad.toFixed(2)}</span>
            )}
          </div>

          {emb.contexto && <blockquote className="cita">{emb.contexto}</blockquote>}
          <p className="serif-lectura" style={{ margin: '10px 0 0', fontWeight: 600 }}>{emb.enunciado}</p>

          {e.definicionAbierta && (
            <div className="nota nota" style={{ marginTop: 4 }}>{e.definicionAbierta}</div>
          )}

          <div className="opciones" style={{ marginTop: 6 }}>
            {emb.opciones.map((o) => {
              const elegida = e.seleccion.includes(o.id)
              const revelar = resuelto
              const clase = revelar
                ? o.correcta ? 'elegida' : elegida ? 'rechazada' : ''
                : elegida ? 'elegida' : ''
              return (
                <button
                  key={o.id}
                  className={`ficha opcion ${clase}`}
                  disabled={resuelto}
                  onClick={() => on.elegirOpcion(o.id)}
                  aria-pressed={elegida}
                >
                  <span className="cuerpo" style={{ fontSize: 13.5 }}>{o.texto}</span>
                  {revelar && o.repertoireId && (
                    <span className="tt" style={{ color: '#8a6a25' }}>Intuición previa</span>
                  )}
                </button>
              )
            })}
          </div>
          {emb.multi && !resuelto && (
            <p className="silencio dato" style={{ margin: 0 }}>
              Selección múltiple · elegiste {e.seleccion.length}
            </p>
          )}
        </div>

        {/* ------------------------------- derecha ----------------------------- */}
        <div className="pila">
          {!resuelto && (
            <>
              <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="eyebrow">Tu mano · pide familia {emb.familia}</span>
                <span className="dato silencio">{e.acciones} acciones</span>
              </div>

              <div className="mano">
                {e.mano.map((c) => {
                  const carta = porId(c.cardId)
                  const util = sirve(carta, emb)
                  const utilidad = carta.familias.length === 0
                  const elegida = e.cartaJugada === c.uid
                  return (
                    <button
                      key={c.uid}
                      className={`ficha${elegida ? ' elegida' : ''}`}
                      disabled={(!util && !utilidad) || e.acciones <= 0 || (!!e.cartaJugada && !elegida)}
                      onClick={() => (carta.efecto === 'consultar' ? on.consultar(c.uid) : on.jugarCarta(c.uid))}
                    >
                      <span className="tt">
                        {utilidad ? 'Utilidad' : `Familia ${carta.familias.join('/')}`}
                      </span>
                      <span className="nom">{carta.nombre}</span>
                      <span className="cuerpo">{carta.glosa}</span>
                    </button>
                  )
                })}
              </div>

              <div className="fila">
                <button className="btn fantasma" onClick={on.descartarMano} disabled={e.acciones <= 0}>
                  Reajustar la mano
                </button>
                <button className="btn fantasma" onClick={on.improvisar} disabled={!!e.cartaJugada}>
                  Improvisar sin verbo
                </button>
                <span className="silencio" style={{ fontSize: 12.5, alignSelf: 'center' }}>
                  Improvisar siempre está permitido, pero rinde mucho menos.
                </span>
              </div>

              <div className="panel pila" style={{ gap: 10 }}>
                <span className="eyebrow">La apuesta · antes de saber si acertaste</span>
                <div className="apuestas">
                  {(Object.keys(APUESTAS) as Apuesta[]).map((a) => (
                    <button
                      key={a}
                      className={`apuesta${e.apuesta === a ? ' activa' : ''}`}
                      onClick={() => on.apostar(a)}
                    >
                      {APUESTAS[a].etiqueta}
                    </button>
                  ))}
                </div>
                <span className="silencio" style={{ fontSize: 12.5 }}>
                  {e.apuesta ? APUESTAS[e.apuesta].glosa : '¿Lo sabes, o crees que lo sabes?'}
                </span>
                <button className="btn primario" onClick={on.resolver} disabled={!puedeResolver}>
                  Resolver
                </button>
                {!puedeResolver && (
                  <span className="silencio" style={{ fontSize: 12.5 }}>
                    {e.seleccion.length === 0
                      ? 'Elige una respuesta.'
                      : !e.cartaJugada && e.acciones > 0
                      ? 'Juega un verbo o improvisa.'
                      : 'Declara tu apuesta.'}
                  </span>
                )}
              </div>
              <button className="btn peligro fantasma" onClick={on.huir} style={{ alignSelf: 'flex-start' }}>
                Abandonar la expedición
              </button>
            </>
          )}

          {resuelto && e.ultima && (
            <div className="panel pila">
              <div className="veredicto">
                <Sello
                  valor={e.ultima.correcto || e.ultima.parcial ? e.ultima.dano : e.ultima.autodano}
                  mal={!e.ultima.correcto && !e.ultima.parcial}
                />
                <div style={{ flex: 1 }}>
                  <span className="eyebrow">
                    {e.ultima.correcto ? 'Sostenido por el texto'
                      : e.ultima.parcial ? 'Parcial'
                      : 'No es lo que dice el texto'}
                  </span>
                  <div className="fila" style={{ gap: 6, marginTop: 6 }}>
                    <Chip tono={e.ultima.calibrado ? 'verde' : 'laton'}>
                      apuesta {APUESTAS[e.ultima.apuesta].etiqueta.toLowerCase()}
                      {e.ultima.calibrado ? ' · calibrada' : ' · descalibrada'}
                    </Chip>
                    {e.ultima.improvisado && <Chip>improvisado</Chip>}
                    {e.ultima.ayuda && <Chip>consultó la fuente</Chip>}
                    {e.ultima.aristaDescubierta && <Chip tono="verde">arista nueva en el Atlas</Chip>}
                  </div>
                </div>
              </div>

              {e.ultima.mensajes.map((m, i) => (
                <p key={i} className={`nota ${m.tono}`}>{m.texto}</p>
              ))}

              {e.ultima.cierre && (
                <>
                  <span className="eyebrow">Lo que el texto sí permite concluir</span>
                  <p className="serif-lectura" style={{ margin: 0 }}>{e.ultima.cierre}</p>
                </>
              )}

              {objetivo && objetivo.paginas.length > 0 && (
                <p className="dato silencio" style={{ margin: 0 }}>
                  {objetivo.titulo} · p. {objetivo.paginas.join(', ')}
                </p>
              )}

              <button className="btn primario" onClick={on.continuar} style={{ alignSelf: 'flex-start' }}>
                {e.fase === 'ganado' ? 'Recoger el hallazgo' : e.fase === 'perdido' ? 'Cerrar la expedición' : 'Siguiente embate'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

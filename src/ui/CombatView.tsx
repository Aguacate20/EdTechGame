import type { Contenido } from '../content/types'
import { porId } from '../engine/cards'
import { APUESTAS, objetivoActual, sirve, type Apuesta, type EstadoCombate } from '../engine/combat'
import { condicionPorId, ARQUETIPOS } from '../engine/encounters'
import { esIntuicion, etiquetaIntuicion } from '../engine/intuition'
import { Chip, Sello } from './components'
import { Stage } from './Stage'

export interface AccionesCombate {
  apuntar: (uid: string) => void
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
  const objetivo = objetivoActual(e)
  const resuelto = e.fase !== 'eligiendo' && e.fase !== 'objetivo'
  const eligiendoObjetivo = e.fase === 'objetivo'
  const cartaJugada = e.cartaJugada ? e.mano.find((c) => c.uid === e.cartaJugada) : null
  const puedeResolver = e.fase === 'eligiendo' && !!emb && e.seleccion.length > 0 &&
    e.apuesta !== null && (cartaJugada != null || e.acciones <= 0)
  const objetivoConcepto = emb?.conceptoObjetivo ? contenido.conceptos[emb.conceptoObjetivo] : null

  const gestoCopista = !e.ultima ? 'quieto'
    : e.ultima.golpe === 'fallido' || e.ultima.golpe === 'pausa' ? 'herido'
    : e.ultima.golpe === 'estabilizado' ? 'cura' : 'ataca'

  return (
    <div className="envoltura pila">
      <Stage
        enemigos={e.enemigos}
        objetivo={e.objetivo}
        onApuntar={on.apuntar}
        seleccionable={eligiendoObjetivo}
        ultima={e.ultima}
        lucidez={lucidez}
        lucidezMax={lucidezMax}
        gestoCopista={gestoCopista}
      />

      <div className="fila" style={{ gap: 10, alignItems: 'center' }}>
        <span className="eyebrow">
          {e.tipo === 'jefe' ? 'Jefe' : e.tipo === 'elite' ? 'Élite' : 'Frente'} · turno {e.turno}
        </span>
        {cond && <Chip tono="laton">{cond.nombre}</Chip>}
        {cond && <span className="silencio" style={{ fontSize: 12.5 }}>{cond.regla}</span>}
        <span className="sep" style={{ flex: 1 }} />
        <span className="dato silencio">mazo {e.mazo.length} · descarte {e.descarte.length}</span>
      </div>

      {/* ---------------------------- elegir objetivo ---------------------------- */}
      {eligiendoObjetivo && (
        <div className="panel pila">
          <span className="eyebrow">¿A quién atacas?</span>
          <p className="serif-lectura" style={{ margin: 0 }}>
            El embate sale del enemigo que elijas. Atacar a El Espejo es decidir hacer
            trabajo de relación; atacar a El Vacío es decidir recuperar. La elección es tuya
            y queda registrada.
          </p>
          <div className="fila">
            {e.enemigos.filter((x) => x.hp > 0).map((x) => (
              <button key={x.uid} className="btn" onClick={() => on.apuntar(x.uid)}>
                {x.nombre} · {ARQUETIPOS[x.arquetipoId].lema}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------- embate -------------------------------- */}
      {emb && (
        <div className="embate">
          <div className="pergamino pila">
            <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="eyebrow">
                {emb.titulo}{objetivo ? ` · contra ${objetivo.nombre}` : ''}
              </span>
              {!e.nieblaPendiente && e.condicion !== 'niebla' && (
                <span className="dato silencio">dificultad {emb.dificultad.toFixed(2)}</span>
              )}
            </div>

            {emb.contexto && !e.superficiePendiente && <blockquote className="cita">{emb.contexto}</blockquote>}
            {emb.contexto && e.superficiePendiente && (
              <p className="silencio" style={{ fontSize: 13, fontStyle: 'italic' }}>
                El enemigo retiró las definiciones de apoyo. Vas a ciegas sobre el contexto.
              </p>
            )}
            <p className="serif-lectura" style={{ margin: '10px 0 0', fontWeight: 600 }}>{emb.enunciado}</p>

            {e.definicionAbierta && <div className="nota nota" style={{ marginTop: 4 }}>{e.definicionAbierta}</div>}

            <div className="opciones" style={{ marginTop: 6 }}>
              {emb.opciones.map((o) => {
                const elegida = e.seleccion.includes(o.id)
                const clase = resuelto
                  ? o.correcta ? 'elegida' : elegida ? 'rechazada' : ''
                  : elegida ? 'elegida' : ''
                return (
                  <button
                    key={o.id} className={`ficha opcion ${clase}`} disabled={resuelto}
                    onClick={() => on.elegirOpcion(o.id)} aria-pressed={elegida}
                  >
                    <span className="cuerpo" style={{ fontSize: 13.5 }}>{o.texto}</span>
                    {resuelto && o.repertoireId && (
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

          {/* ------------------------------- la mano ------------------------------ */}
          <div className="pila">
            {!resuelto && (
              <>
                <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="eyebrow">Tu mano · este embate pide familia {emb.familia}</span>
                  <span className="dato silencio">{e.acciones} acciones</span>
                </div>

                <div className="mano">
                  {e.mano.map((c) => {
                    const intu = esIntuicion(c.cardId)
                    const carta = porId(c.cardId)
                    const etiqueta = intu ? etiquetaIntuicion(contenido, c.cardId) : null
                    const util = intu || sirve(carta, emb)
                    const utilidad = !intu && carta.familias.length === 0
                    const elegida = e.cartaJugada === c.uid
                    return (
                      <button
                        key={c.uid}
                        className={`ficha${elegida ? ' elegida' : ''}${intu ? ' intuicion' : ''}`}
                        disabled={(!util && !utilidad) || e.acciones <= 0 || (!!e.cartaJugada && !elegida)}
                        onClick={() => (carta.efecto === 'consultar' ? on.consultar(c.uid) : on.jugarCarta(c.uid))}
                      >
                        <span className="tt">
                          {intu ? 'Asunto pendiente' : utilidad ? 'Utilidad' : `Familia ${carta.familias.join('/')}`}
                        </span>
                        <span className="nom">{etiqueta?.nombre ?? carta.nombre}</span>
                        <span className="cuerpo">{etiqueta?.glosa ?? carta.glosa}</span>
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
                </div>

                <div className="panel pila" style={{ gap: 10 }}>
                  <span className="eyebrow">La apuesta · antes de saber si acertaste</span>
                  <div className="apuestas">
                    {(Object.keys(APUESTAS) as Apuesta[]).map((a) => (
                      <button
                        key={a} className={`apuesta${e.apuesta === a ? ' activa' : ''}`}
                        onClick={() => on.apostar(a)}
                      >{APUESTAS[a].etiqueta}</button>
                    ))}
                  </div>
                  <span className="silencio" style={{ fontSize: 12.5 }}>
                    {e.apuesta ? APUESTAS[e.apuesta].glosa : '¿Lo sabes, o crees que lo sabes?'}
                  </span>
                  <button className="btn primario" onClick={on.resolver} disabled={!puedeResolver}>
                    Atacar
                  </button>
                  {!puedeResolver && (
                    <span className="silencio" style={{ fontSize: 12.5 }}>
                      {e.seleccion.length === 0 ? 'Elige una respuesta.'
                        : !e.cartaJugada && e.acciones > 0 ? 'Juega un verbo o improvisa.'
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
                    valor={e.ultima.dano > 0 ? e.ultima.dano : e.ultima.danoRecibido}
                    mal={e.ultima.dano === 0}
                  />
                  <div style={{ flex: 1 }}>
                    <span className="eyebrow">
                      {e.ultima.correcto ? 'Sostenido por el texto'
                        : e.ultima.parcial ? 'Parcial' : 'No es lo que dice el texto'}
                    </span>
                    <div className="fila" style={{ gap: 6, marginTop: 6 }}>
                      <Chip tono={e.ultima.calibrado ? 'verde' : 'laton'}>
                        apuesta {APUESTAS[e.ultima.apuesta].etiqueta.toLowerCase()}
                        {e.ultima.calibrado ? ' · calibrada' : ' · descalibrada'}
                      </Chip>
                      {e.ultima.improvisado && <Chip>improvisado</Chip>}
                      {e.ultima.ayuda && <Chip>consultó la fuente</Chip>}
                      {e.ultima.aristaDescubierta && <Chip tono="verde">arista nueva</Chip>}
                      {e.ultima.intuicionResuelta && <Chip tono="verde">intuición retirada del mazo</Chip>}
                    </div>
                  </div>
                </div>

                {e.ultima.mensajes.map((m, i) => <p key={i} className={`nota ${m.tono}`}>{m.texto}</p>)}

                {e.ultima.cierre && (
                  <>
                    <span className="eyebrow">Lo que el texto sí permite concluir</span>
                    <p className="serif-lectura" style={{ margin: 0 }}>{e.ultima.cierre}</p>
                  </>
                )}

                {objetivoConcepto && objetivoConcepto.paginas.length > 0 && (
                  <p className="dato silencio" style={{ margin: 0 }}>
                    {objetivoConcepto.titulo} · p. {objetivoConcepto.paginas.join(', ')}
                  </p>
                )}

                <button className="btn primario" onClick={on.continuar} style={{ alignSelf: 'flex-start' }}>
                  {e.fase === 'ganado' ? 'El frente cede'
                    : e.fase === 'perdido' ? 'Cerrar la expedición' : 'Siguiente turno'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

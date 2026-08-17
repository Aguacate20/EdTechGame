# Ranuras de arte

El código pide una ilustración por ruta. **Si el fichero no existe, cae al SVG de
marcador que ya trae el juego.** Suelta ficheros aquí y aparecen sin tocar una línea
de lógica.

```
enemigos/copista.svg
enemigos/errata.svg
enemigos/rumor.svg
enemigos/apocrifo.svg
enemigos/notaalpie.svg
enemigos/dogma.svg
enemigos/eco.svg
enemigos/cita.svg
enemigos/palimpsesto.svg
enemigos/bibliografia.svg
enemigos/ortodoxia.svg
enemigos/tratado.svg        (jefe)
jugador/copista.svg
```

## Especificación

- **Formato:** SVG, lienzo cuadrado, `viewBox="0 0 64 64"`.
- **Color:** usa `currentColor` para el trazo principal. El juego colorea desde CSS
  según el estado, así que una figura con colores fijos se verá fuera de sitio.
- **Grosor:** 2,2–3,2 en unidades del viewBox. Nada por debajo de 1,5: a 34 px de
  tamaño real desaparece.
- **Silueta legible a 34 px.** Es el tamaño en el que se juega. Si no se distingue del
  vecino a ese tamaño, no sirve por bonito que sea.
- **Sin texto** dentro de la ilustración: el juego ya pone el nombre debajo.

## Dirección de arte

Marginalia de archivo: manchas de tinta y marcas de anotación que crecen hasta ser
figuras. Grabado antiguo, no cartoon. Cada enemigo es una **patología de la lectura**,
no un monstruo:

| Enemigo | Es |
|---|---|
| El Copista | copia sin entender |
| La Errata | el error que se cuela rápido |
| El Rumor | lo que te alcanza sin acercarse |
| El Apócrifo | la atribución falsa |
| La Nota al Pie | lo que te distrae del cuerpo del texto |
| El Dogma | lo que no cede ante una razón simple |
| El Eco | tu propia intuición, translúcida — un calco del Copista |
| La Cita Descontextualizada | el fragmento arrancado de su sitio |
| El Palimpsesto | lo que se reescribe si no lo fijas |
| La Bibliografía | lo que al cerrarse se multiplica |
| La Ortodoxia | lo que solo cede de lado |
| El Tratado | la obra entera, inmóvil, por fases |

## Estados de animación

`Enemigo.gesto` ya es la máquina de estados y se expone como `data-gesto` en el
contenedor `.retrato`:

```
quieto · avanza · golpea · herido · critico · cae · retrocede
```

Hoy se animan por CSS sobre la silueta. Cuando llegue Rive, esos siete estados son los
de la máquina y el cambio es reemplazar `Retrato` sin tocar el resto.

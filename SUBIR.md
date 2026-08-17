# Subir v3.4 al repositorio

Ruta del zip descomprimido (ajusta si Windows le añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v3.4/patch34/edtech-game`

v3.4 sustituye ficheros de v3.3 y **borra dos que ya no existen**
(`src/engine/run.ts` pasó a `route.ts`), así que conviene limpiar `src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v3.4/patch34/edtech-game"

# 1. comprobar que la fuente existe ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 26
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v3.4: escenario de combate, frentes de enemigos y grafo de rutas

- escenario superior: enemigos como marginalia en tinta, vocabulario de golpes
  (limpio, critico, resistido, torpe, estabilizado) y el dano solo visible al resolver
- frentes de 2 a 4 enemigos con amenazas propias; elegir objetivo decide de que pool
  sale el embate, y esa eleccion queda registrada como senal de autorregulacion
- grafo de rutas ramificado 1-2-3-2-1 con rutas etiquetadas y jefe final
- planes de expedicion (I1 PLANEAR) que reparten mazo inicial e instrumento
- cartas de Intuicion desde repertoires: se retiran reconociendo su contexto
- sellado de unidades y edicion critica exportable al completar el grafo
- npm run smoke ahora mide tambien balance: turnos por frente y lucidez restante"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

Ya está en el repo como `vercel.json`. Si el proyecto sigue teniendo un *Build Command*
manual en el dashboard, bórralo: los overrides del panel pisan al fichero.

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

## Recordatorio

HuggingFace Space y GitHub son remotes distintos y necesitan `push` por separado.
Este repositorio es solo GitHub.

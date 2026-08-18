# Subir v4.4 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v4.4/patch44/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v4.4/patch44/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 35
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v4.4: mapa procedural con temarios distintos y batalla sin scroll

- route.ts: la forma del acto se deriva del grafo (largo por numero de conceptos,
  ancho por material disponible); una unidad pequena no se ramifica
- repartirEntreHermanos: los nodos de una misma columna reciben subconjuntos
  distintos del temario, sesgados por cluster y completados con vecinos
- el mapa anuncia los temas, la dificultad y la tinta de cada nodo
- se retira el Tachon: la discriminacion ya la mide el pozo (quemar)
- devolver una pieza pide confirmacion y recupera las herramientas de sus trazos
- batalla en rejilla de 3 columnas sin scroll: herramientas a la izquierda,
  mano en renglones a la derecha, acciones abajo, todo con texto al pasar el raton
- bundle de muestra ampliado a 18 conceptos y 29 aristas para que ramifique
- npm run smoke anade el criterio de solape entre hermanos (<50%)"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

# Subir v4.0 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v4/patch40/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v4/patch40/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 25
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v4.0: roguelike de diagramas con tablero libre y herramientas cognitivas

Cambia el atomo del juego: ya no hay enunciado con opciones, hay materiales y
herramientas. El jugador compone un diagrama y el sistema lo evalua en cascada.

- 9 herramientas cognitivas (identidad, flecha, campo, jerarquia, eje, secuencia,
  ancla, balanza, tachon), cada una emitiendo una senal distinta
- piezas con roles en vez de tipos rigidos: un criterio puede ser nodo suelto
- titulo y definicion en cartas separadas; al emparejarlas se fusionan
- cartas apocrifas desde la vecindad del grafo: hay que notarlas, nadie pregunta
- combos emergentes por piezas compartidas entre trazos
- lentes como jokers: la build es un plan de lectura
- carril horizontal con 11 enemigos y presupuesto de amenaza por oleada
- el pozo: quemar vs cambiar, dos gestos con senales distintas
- npm run smoke verifica 5 criterios, incluidos combos y cobertura de herramientas"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

# Subir v5.6.1 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.6.1/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.6.1/patch50/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 41
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v5.6.1: arreglos del tutorial

- el tutorial no genera ruta, y un guardia de render devolvia al selector de
  textos al pulsar Empezar. Corregido: ruta pasa a ser opcional
- un solo camino en el menu cuando el tutorial esta activo: el panel de arranque
  ES el tutorial, y el conmutador vive solo en el boton del pie
- la apocrifa del tutorial deja de salir del pool al azar: es siempre Murcielago
  con la descripcion de un ave, que es la confusion clasica"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

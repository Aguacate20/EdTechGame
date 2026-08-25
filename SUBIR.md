# Subir v5.10 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.10/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.10/patch50/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 43
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v5.10: creatividad recompensada y refuerzo variable en el botin

- un caso o una tesis pertenecen al campo semantico del que hablan: antes se
  ignoraban y el campo decia que faltaban conceptos
- combo Veta: sostener vinculos de los que el autor apenas usa
- combo Mestizaje: cruzar tres o mas clases de pieza en la misma afirmacion
- refuerzo variable SOLO en el botin: una cuarta opcion rara tras el combate,
  con probabilidad que sube con la calidad del mejor diagrama (11% a 49%)
- el veredicto de una afirmacion nunca depende del azar"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

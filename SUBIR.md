# Subir v5.9.1 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.9.1/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.9.1/patch50/edtech-game"

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
git commit -m "v5.9.1: los vinculos no son alternativas

- nuevo peldano COMPATIBLE al 90%: si el texto dice extiende, afirmar requiere no
  es un matiz peor sino otra faceta verdadera del mismo par. Implicaciones
  direccionales: extiende->requiere, ejemplifica->apoya, matiza->contrasta,
  generaliza->requiere
- el adaptador avisa cuando la descripcion de una arista no menciona a sus dos
  extremos: en esos casos el feedback sale confuso y la culpa es del extractor"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

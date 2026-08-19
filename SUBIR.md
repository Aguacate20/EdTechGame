# Subir v4.6 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v4.6/patch45/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v4.6/patch45/edtech-game"

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
git commit -m "v4.6: el mapa de cierre acumula cadenas y rotula las relaciones

- solo se guardan los ACIERTOS, y se acumulan turno a turno: A extiende B del
  turno 1 y B ejemplifica C del turno 3 se dibujan como una sola cadena
- cada herramienta deja el rastro que le corresponde: flecha/jerarquia/secuencia
  dejan vinculos dirigidos, campo/eje/ancla dejan agrupaciones, identidad marca
  el concepto como reconocido. Antes se tomaban los dos primeros conceptIds de
  cualquier trazo, lo que fabricaba aristas falsas desde un campo de 4 conceptos
- el tipo de relacion se escribe sobre la linea, no solo se codifica en color
- disposicion por fuerzas determinista: las cadenas se ven como cadenas, y el
  resultado se reescala al final para que ningun rotulo se salga del lienzo
- los titulos largos se parten en dos renglones dentro de su recuadro"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

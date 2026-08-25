# Subir v5.9 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.9/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.9/patch50/edtech-game"

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
git commit -m "v5.9: la capa propia del lector

- razonable, el texto no lo dice pasa a ser propuesta tuya: violeta, glifo de
  pluma y mensaje al derecho. Describe lo que hizo el lector, no lo que falto
  al autor
- las propuestas se guardan en una capa aparte del Atlas, con panel propio y
  seccion propia en la edicion critica. No cuentan como evidencia: subir su
  multiplicador corromperia el modelo cognitivo
- liston de admision para que no sea un basurero: solo entran las cercanas en el
  grafo. Compartir pagina puntua en combate pero no se anota (86 de 112)
- ascenso por caso: anclar los dos conceptos al mismo caso en el mismo diagrama
  sube la propuesta a convive y triplica sus fichas
- confirmacion retroactiva: si mas adelante aparece la arista, la propuesta queda
  marcada y el juego lo anuncia"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

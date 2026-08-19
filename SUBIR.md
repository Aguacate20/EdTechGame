# Subir v4.5 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v4.5/patch45/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v4.5/patch45/edtech-game"

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
git commit -m "v4.5: mapa de cierre, tooltip sin recortes y fuera la economia

- el tooltip pasa a ser una capa unica en posicion fija: los contenedores con
  overflow recortaban el ::after y los textos largos no se veian
- al despejar el carril aparece el mapa de lo afirmado en ese combate, con los
  vinculos nuevos destacados, mas el mejor diagrama y a quien habria derribado
- los multiplicadores de relacion dejan de mostrarse; solo un brillo discreto
  indica que una pasiva favorece ese vinculo
- se retiran la tinta y El Archivo: todas las mejoras salen de ganar el combate
- quemar bien recompensa con carta y bonificacion en vez de moneda"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

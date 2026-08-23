# Subir v5.1 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.1/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.1/patch50/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 38
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v5.1: el Atlas como inicio, progreso persistente y armas por herramienta

- fuera la planeacion previa: sin pantalla de plan, sin encargo y sin antesala.
  Esas ayudas volveran en un modo Aprendizaje aparte
- el Atlas pasa a ser la pantalla de inicio y el modelo cognitivo visible:
  dominado / sostenido / reconocido / se te resiste / sin tocar, con la evidencia
  real detras, y de ahi sale la propuesta de la siguiente expedicion
- lentes, sellos, herramientas, vinculos y terrenos se conservan entre expediciones;
  el carril escala con las expediciones ya hechas
- se empieza con apoya y contrasta: cada enemigo derribado revela un vinculo nuevo
- cada herramienta y cada tipo de vinculo dispara con forma propia (perdigon, rayo,
  onda, lluvia, gancho, tenaza, barrido, maza, sello); combinar herramientas
  transforma el arma y tres o mas disparan una Constelacion
- el numero del dano crece con el golpe y estalla en dorado por encima de 250
- fuera las etiquetas tecnicas de senal cognitiva en la interfaz del estudiante
- el aviso del pozo se puede cerrar con una X"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

# Subir v5.5 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.5/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.5/patch50/edtech-game"

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
git commit -m "v5.5: convivencia, retomar expedicion y restricciones de ranura

- nuevo peldano CONVIVE: si el texto trata dos conceptos juntos en el mismo caso,
  escenario, tesis o marco, eso es evidencia real aunque no enuncie el vinculo.
  Antes esas conexiones legitimas caian en plausible y valian casi nada
- compartir pagina se queda en plausible, con mensaje propio; las derivaciones
  llegan ahora a tres pasos
- el rastro solo aparece con el raton sobre el tablero, muestra el texto completo
  y dice el vinculo en llano (respalda o da evidencia a, se opone o se distingue de)
- cada ranura admite solo la clase de carta que le corresponde: el Ancla exige un
  caso en la primera, la Balanza una tesis, la Descomposicion una parte. Lo que no
  encaja se atenua y no se puede marcar
- se puede retomar una expedicion dejada a medias: se guarda el mapa y el equipo
- lo que se APRENDE persiste (vinculos, terrenos, Atlas); lo que se EQUIPA no
  (lentes, sellos, herramientas): cada expedicion vuelve a ser una partida"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

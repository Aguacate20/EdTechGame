# Subir v5.2 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.2/patch50/edtech-game`

v4 borra varios ficheros de v3.4 (`cards.ts`, `combat.ts`, `encounters.ts`, `threats.ts`,
`boss.ts`, `intuition.ts`, `CombatView.tsx`, `Stage.tsx`), así que hay que limpiar
`src/` antes de copiar.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.2/patch50/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza
rm -rf src scripts docs public

# 3. copiar
cp -r "$SRC/." .

# 4. comprobar: debe decir 40
find src scripts public docs -type f | wc -l

# 5. commit
git add -A
git commit -m "v5.2: cuatro herramientas nuevas, modo aprendizaje, tutorial y refugio con autoevaluacion

- Contraejemplo, Analogia, Alcance y Descomposicion: falsar, analogizar, acotar y
  descomponer, que eran los movimientos que faltaban. Cada una con arma propia
- modo Aprendizaje: conceptos sin tocar llegan enteros, falsificaciones senaladas
  al principio, la expedicion no se pierde. La evidencia con andamio cuenta pero
  queda marcada, y el nivel dominado exige al menos un acierto sin apoyo
- tutorial con diez conceptos de animales, construido con la forma real del
  extractor para que pase por el mismo adaptador y el mismo motor
- el refugio pasa a ser una comprobacion de autoconocimiento: que se te resiste,
  que ya sostienes, que vinculo trazaste. Acertar sobre uno mismo paga lucidez
- al elegir herramienta se abre un panel que lee la afirmacion como frase:
  concepto A, conector escrito, concepto B
- la potencia se muestra como cuerpo y filo en barras, sin anticipar el numero"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

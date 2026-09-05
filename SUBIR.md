# Subir v5.37 al repositorio

Ruta del zip descomprimido (ajusta si Windows añadió un sufijo `_1`):
`C:/Users/sebas/Downloads/edtech_v5.37/edtech-game`

Este parche toca `src/`, `scripts/`, `public/bundles/demo.json`, `README.md`,
`SUBIR.md` y `package.json`. **No toca `public/art/`** (tus sprites, fondos y
manifest): por eso el `rm` de abajo NO incluye `public`.

```bash
cd /c/Proyectos/edtech-game
SRC="/c/Users/sebas/Downloads/edtech_v5.37/edtech-game"

# 1. comprobar la ruta ANTES de tocar nada
ls "$SRC/package.json" || echo "RUTA MAL: no sigas"

# 2. limpiar solo lo que se reemplaza (nunca public)
rm -rf src scripts docs

# 3. copiar por encima (public/bundles/demo.json se sobreescribe; public/art queda intacto)
cp -r "$SRC/." .

# 4. comprobar: debe decir 44
find src scripts docs public/bundles -type f | wc -l

# 5. commit
git add -A
git commit -m "v5.36: integridad de senal y creatividad respaldada

- las aristas INFERIDAS por el extractor (confianza < 0.6) ya no se juzgan
  como 'el texto lo dice': viven aparte y rinden 'insinuado' (capa propia,
  no evidencia). Requiere bundle 1.1.0; los 1.0.0 siguen cargando
- aproximado lejano (otra familia = otra afirmacion, 30%); verbos bloqueados
  no cuestan evidencia; propuesta (se guarda) separada de plausible
- combo Hallazgo: proponer junto a lo que si sostienes, determinista
- el Atlas anota evidencia y fallo, nada mas: explorar ya no baja un
  concepto a 'se te resiste'; misma regla en la Marca de cierre
- apertura con plan en el Repartidor (pareja, veta, chispa, especial) y
  piedad de la regla 5 tras un turno vacio (bug de fase corregido)
- smoke: bot lector parcial (60%/50%), criterios 14-16; el 14 es objetivo
  de balance (PENDIENTE 2/6) y solo bloquea con EXIGIR_PARCIAL=1"

git push origin main
```

Si `npm` no está en el PATH de Git Bash no pasa nada: Vercel corre `tsc -b && vite build`
en cada push, así que un error de tipos detiene el despliegue antes de publicar.

## El extractor va aparte

El zip trae también `edtech-project/backend/…` (compilador, validación y modelo).
Se aplica sobre `EdTechProject` y se sincroniza con el Space como siempre:

```bash
cd /c/Proyectos/EdTechProject
SRC="/c/Users/sebas/Downloads/edtech_v5.37/edtech-project"
ls "$SRC/backend/pipeline/compiler.py" || echo "RUTA MAL: no sigas"
cp -r "$SRC/." .
git add -A
git commit -m "backend: bundle 1.1.0 - confianza, anclaje y status en cada arista; evidencia textual en cada concepto

- compiler: cada arista lleva confianza/anclaje/veces/status (y tipo_original
  si la validacion reparo el tipo); cada concepto lleva evidencia_textual,
  anclaje_textual, confianza y status; stats.aristas_afirmadas/inferidas
- validation: conserva relation_type_original al aproximar a 'apoya'
- models: ConceptRelation declara anclaje_textual, veces_afirmada,
  relation_type_original y status (Pydantic los tiraba: el bundle salia con
  veces=1 para todo)"
git push origin main
git push space main
```

Hasta que el Space no tenga el bundle 1.1.0, el juego trata todo como afirmado
(igual que hasta v5.35): el parche del juego se puede subir antes sin riesgo.

## Vercel

`vercel.json` ya viene en el repo con el preset Vite. Si el panel tiene un
*Build Command* manual, bórralo: los overrides del dashboard pisan al fichero.

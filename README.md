# git-trenes

Una GitHub Action que dibuja un **tren en pixel art** a partir de tu actividad pública y lo guarda como SVG animado para tu README de perfil. Es la versión con trenes de [git-koi](https://github.com/yalongwastaken/git-koi).

![Tren de ejemplo](docs/ejemplo-claro.svg)

## Qué significa cada cosa

| Tu actividad | En el tren |
| --- | --- |
| Contribuciones del último año | **Vagones**, de 1 a 6 (50 / 200 / 500 / 1000 / 2000) |
| Lenguaje principal | **Franja** con el color oficial del lenguaje en GitHub |
| Racha actual | Letrero LED **"RACHA 12"** y ventanas iluminadas (30 días = todas) |
| Lo que hiciste ayer | **0**: parado con las puertas abiertas · **1-3**: lento · **4-9**: normal · **10+**: veloz, con chispas y líneas de velocidad |
| Esa misma actividad | **Semáforo** junto a la vía: rojo (0), ámbar (poca) o verde (normal o mucha) |

La racha no se rompe a primera hora: si hoy todavía no hay actividad, cuenta desde ayer.

## Uso

Crea `.github/workflows/tren.yml` en tu repositorio de perfil (el que se llama como tu usuario):

```yaml
name: Tren de GitHub
on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:
permissions:
  contents: write
jobs:
  tren:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: TU_USUARIO/git-trenes@main
      - run: |
          git config user.name "git-trenes"
          git config user.email "git-trenes@users.noreply.github.com"
          git add dist
          git diff --cached --quiet || (git commit -m "chore: actualizar tren" && git push)
```

Y en tu `README.md`, para que cambie con el tema de GitHub:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="dist/tren-dark.svg">
  <img alt="Mi tren de GitHub" src="dist/tren-light.svg">
</picture>
```

## Opciones

| Entrada | Por defecto | Qué hace |
| --- | --- | --- |
| `tren` | `auto` | `auto` evoluciona con tus vagones; o fija un modelo (ver abajo) |
| `modo` | `single` | `single`: un tren con tu lenguaje principal · `multi`: 3 vías, un tren por lenguaje, en sentidos opuestos |
| `tema` | `both` | `both` escribe `tren-light.svg`, `tren-dark.svg` y `tren.svg` (automático); o `light`, `dark`, `auto` |
| `etiqueta` | `RACHA` | Palabra del letrero LED |
| `escala` | `2` | Tamaño de cada píxel (1 a 6) |
| `usuario` | dueño del repo | Usuario a dibujar |
| `github-token` | `github.token` | Para contar contribuciones privadas usa un PAT |
| `salida` | `dist` | Carpeta de salida |

Salidas: `archivos`, `vagones`, `racha`, `estado`, `modelo`.

![Tres vías](docs/ejemplo-multi.svg)

## Modelos

| id | Inspiración | Corriente |
| --- | --- | --- |
| `tranvia` | TEG-90 de SITEUR, Guadalajara: vino con franjas blancas, dos cuerpos articulados sobre un bogie compartido | Catenaria |
| `metro-naranja` | NC-82 del Metro de la CDMX: frente facetado y rodadura neumática | Barra guía |
| `metro-gris` | Frota L del Metrô de São Paulo (como el L43): acero inoxidable acanalado y máscara negra | Tercer riel |
| `metro-amarillo` | A650 renovado de Los Ángeles: frente amarillo con puerta de emergencia al centro | Tercer riel |
| `metro-blanco` | Alstom Metropolis de la línea 3 de Guadalajara: banda de ventanas oscura y cara negra | Catenaria |
| `bala` | Tren de alta velocidad | Catenaria |

Con `tren: auto` el modelo sube con los vagones: tranvía → metro naranja → metro gris → metro amarillo → metro blanco → tren bala. El nombre anterior `suburbano` sigue funcionando como `metro-blanco`.

Todos los trenes tienen cabina en ambos extremos (faros blancos adelante, luces rojas atrás). La catenaria solo aparece sobre los trenes con pantógrafo; los demás corren sobre un tercer riel.

## Cómo funciona

- Sin dependencias ni compilación: JavaScript puro (Node 24) que corre directo en el runner.
- Cada tren se dibuja **por código sobre una cuadrícula común** (coches de 64 px con 2 o 3 puertas por lado, bogies de dos ruedas de disco de 7 px con bastidor y cajas de grasa, pintados con la paleta de cada modelo), no a partir de imágenes. Las capas (carrocería, puertas, ruedas, letrero, chispas) se animan por separado.
- El resultado es un SVG de ~50 KB (~80 KB en modo `multi`) con CSS: el tren avanza **de 1 px en 1 px** (`steps()`), las marcas del disco de las ruedas alternan dos fotogramas girados 60°, las nubes derivan despacio y en el tema oscuro titilan las estrellas. Respeta `prefers-reduced-motion`.
- La escena trae ciudad, talud con arbustos, catenaria o tercer riel según el tren y, en el modo `multi`, un paisaje distinto detrás de cada vía extra (pueblo, bosque).
- El letrero LED usa una fuente propia de 3×5 píxeles; no hay texto SVG, así que no depende de fuentes.

## Desarrollo

```bash
npm run preview    # playground en http://localhost:4173 (controles en vivo)
npm run muestra    # genera SVG con datos de ejemplo en ./muestra
npm test           # pruebas
node scripts/sheet.js hoja.png 5 3 0   # hoja PNG ampliada de todos los modelos
node scripts/docs.js                   # regenera los SVG de docs/
```

Para añadir un modelo, agrega una entrada en [src/models.js](src/models.js) (paleta, franjas, forma de la trompa) y su id en `MODEL_ORDER`.

Las imágenes de `reference/` son solo referencia de color y forma; no se usan en el SVG y los logotipos que aparecen en ellas no se reproducen.

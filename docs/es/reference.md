# Opciones y modelos

[git-trains](../../README.es.md)

## Opciones

| Input | Por defecto | Qué hace |
| --- | --- | --- |
| `train` | `auto` | `auto` evoluciona con tus vagones; o elige un [modelo](#modelos); o la ruta a [tu propio tren](customization.md#haz-tu-propio-tren-a-mano-o-con-ia) en JSON |
| `skyline` | `city` | `city` (generada y única para ti), `new-york`, `osaka` o la ruta a [tu propio skyline](customization.md#skylines-de-ciudades) en JSON |
| `mode` | `single` | `single`: un tren con tu lenguaje principal · `multi`: 3 vías, un tren por lenguaje, en sentidos opuestos |
| `calendar` | `false` | `true` tambi?n escribe el calendario de contribuciones animado (ver arriba) |
| `year-in-review` | `false` | `true` también escribe `year-in-review.svg`: un póster de un año natural, dibujado como un viaje en tren (ver [Resumen del año](usage.md#resumen-del-año)) |
| `review-year` | año en curso | El año que muestra el póster (de 2008 al actual). Vacío: el año en curso hasta hoy, o el año que acaba de terminar en enero |
| `seasons` | `true` | `true` viste la escena con la estación o la fiesta del día en que corre; `false` la deja sin adornos (ver [Estaciones y fiestas](usage.md#estaciones-y-fiestas)) |
| `hemisphere` | `north` | `north` o `south`: qué hemisferio siguen las estaciones. Las fiestas conservan sus fechas |
| `theme` | `both` | `both` escribe `train-light.svg`, `train-dark.svg` y `train.svg` (automático); o `light`, `dark`, `auto` |
| `language` | `en` | `en` o `es`: la palabra del letrero (`STREAK` / `RACHA`), el título de la imagen y los textos de las tarjetas |
| `label` | según `language` | Palabra del letrero LED (tiene prioridad sobre `language`) |
| `exclude-languages` | | Lenguajes a dejar fuera, separados por comas, por ejemplo `HTML, Jupyter Notebook` |
| `scale` | `2` | Tamaño de cada píxel (1 a 6) |
| `user` | dueño del repo | Usuario a dibujar |
| `repo` | | `owner/name`: dibuja un repositorio en vez de un usuario (ver [En el README de un repositorio](usage.md#en-el-readme-de-un-repositorio)); `user` se ignora |
| `github-token` | `github.token` | Usa un PAT para contar contribuciones privadas |
| `output-dir` | `dist` | Carpeta de salida |
| `cards` | `none` | Tarjetas de perfil: `stats`, `languages`, `departures` o `both` (estadísticas y lenguajes); también una lista, p. ej. `stats, departures` (ver abajo) |
| `unlocks` | `true` | Añade un vagón especial cuando lo consigues (ver [Vagones desbloqueables](usage.md#vagones-desbloqueables)); `false` se ahorra la petición extra a la API |
| `rank` | `letter` | Centro del anillo de la tarjeta de estadísticas: `letter` (S, A+, B...) o `github` (el logo) |
| `border` | `true` | Borde de las tarjetas |
| `max-languages` | `6` | Lenguajes en la tarjeta de lenguajes (1 a 10) |
| `color-background`, `color-title`, `color-icon`, `color-text`, `color-ring` | GitHub oscuro | Colores de las tarjetas, hexadecimal sin `#` |

El `GITHUB_TOKEN` predeterminado con `contents: read` basta para leer el repositorio actual y los datos públicos; publicar los archivos generados requiere `contents: write`. Un PAT opcional puede revelar contribuciones privadas visibles para su propietario. Guárdalo como secreto de Actions, concede solo el acceso necesario y revisa los SVG antes de publicarlos: las imágenes públicas pueden revelar actividad derivada de contribuciones privadas.

Salidas: `files`, `cars`, `streak`, `state`, `model`.

> ¿Vienes de 0.x? Los nombres en español (`tren`, `fondo`, `modo`, `tema`, `idioma`...) y los ids anteriores (`tranvia`, `metro-blanco`, `bala`...) siguen funcionando y dejan un aviso en el log. Los archivos de salida ahora son `train-*.svg` y `card-*.svg`: actualiza las rutas en tu README. Detalles en el [changelog](../../CHANGELOG.md).
## Modelos

| id | Inspirado en | Alimentación |
| --- | --- | --- |
| `tram` | TEG-90 de SITEUR, Guadalajara: vino con franjas blancas, dos cuerpos articulados sobre un bogie compartido | Catenaria |
| `metro-orange` | NC-82 del Metro de la Ciudad de México: frente facetado y rodadura neumática | Barra guía |
| `metro-gray` | Flota L del Metro de São Paulo (como el L43): acero inoxidable acanalado y máscara negra | Tercer riel |
| `metro-yellow` | A650 renovado de Los Ángeles: frente amarillo con puerta de emergencia al centro | Tercer riel |
| `metro-white` | Alstom Metropolis de la Línea 3 de Guadalajara: banda oscura en las ventanas y cara negra | Catenaria |
| `bullet` | Tren de alta velocidad | Catenaria |

Con `train: auto` el modelo sube conforme ganas vagones: tranvía → metro naranja → metro gris → metro amarillo → metro blanco → tren bala.

Cada tren tiene cabina en ambos extremos (faros blancos adelante, luces rojas atrás). La catenaria solo aparece sobre los trenes con pantógrafo; los demás van por tercer riel.

![Tres vías](../example-multi.svg)

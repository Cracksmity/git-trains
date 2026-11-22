# Climas pendientes

La escena de Jalisco dibuja cuatro estados: `clear`, `cloudy`, `rain` y `storm` (ver [Clima](reference.md#clima)). Mientras no tengan arte propio, los demás climas usan el estado más parecido. Esta página reúne los diseños que faltan, con un prompt para cada uno. Pega el prompt en un agente de IA que trabaje en este repositorio.

[English version](../weather-backlog.md)

## Reglas para cada estado nuevo

Un estado nuevo toca los mismos lugares que los cuatro primeros:

1. **Datos:** [src/weather/conditions.js](../../src/weather/conditions.js) agrega el estado a `WEATHER_STATES` y a `WEATHER_NAMES` (inglés y español), y mueve sus códigos WMO en `CODES`. Si el estado depende de la temperatura o del viento, también hace falta un campo en la consulta a Open-Meteo ([src/weather/open-meteo.js](../../src/weather/open-meteo.js)). `readCurrentWeather` debe validar ese campo como los demás.
2. **Tintas:** [src/weather/inks.js](../../src/weather/inks.js) da a cada tinta nueva un valor claro y uno oscuro.
3. **Capas compartidas:** [src/scene/weather.js](../../src/scene/weather.js) se encarga del cielo, las partículas que caen y los destellos. Reutiliza `rainLayers`, las capas `fall` y `blink`, `citySky` y `countrySky` antes de escribir mecanismos nuevos.
4. **Cada lugar:** [src/landscape/jalisco-weather.js](../../src/landscape/jalisco-weather.js) pinta lo propio de Guadalajara, Los Altos o Tequila.
5. **Interfaces:** la descripción de `weather` en [action.yml](../../action.yml), el selector del playground en [assets/preview/app.js](../../assets/preview/app.js) y las secciones de Clima en [docs/reference.md](../reference.md) y [docs/es/reference.md](reference.md).
6. **Pruebas:** [tests/weather/](../../tests/weather/) cubre los códigos, el input, las tintas en los dos temas, los ciclos sin costura y el movimiento reducido.

Restricciones de [AGENTS.md](../../AGENTS.md):
- La salida sigue siendo determinista, con aleatoriedad solo con semilla.
- Los módulos de JavaScript no pasan de 400 líneas.
- No se agregan dependencias.
- Se respetan los temas claro y oscuro y `prefers-reduced-motion`.
- El SVG y el exportador raster pintan los mismos píxeles.
- Los destellos tipo relámpago no pasan de tres por segundo.

Revisa cada diseño con `npm run zoom -- 0 0 448 204 --no-trains --scale 3 --weather <estado>`, en los dos PNG. Luego revisa el cuadro 0 y la escena a tamaño README. Cada pieza se apoya en la de abajo; nada flota.

## Diseños pendientes

| Estado | Cuándo | Hoy usa | Lo que lo distingue |
| --- | --- | --- | --- |
| [Neblina](#neblina) | WMO 45, 48 | `cloudy` | Los valles de Los Altos se llenan de neblina y la torre de la parroquia sobresale |
| [Llovizna](#llovizna) | WMO 51–57 | `rain` | Gotas finas y escasas con brillo mojado, sin velo |
| [Granizo](#granizo) | WMO 96, 99 | `storm` | Una granizada tapatía: bolitas blancas que rebotan y se juntan en la plaza y los techos |
| [Helada](#helada) | `clear` con 2 °C o menos | `clear` | Escarcha blanca en el pasto y los techos de Los Altos |
| [Calor](#calor) | `clear` con 32 °C o más | `clear` | El aire que vibra sobre el agave de Tequila |
| [Nieve](#nieve) | WMO 71–77, 85, 86 | `rain` | La rara nevada sobre Jalisco, como la de diciembre de 1997 |
| [Medio nublado](#medio-nublado) | WMO 1, 2 | `clear` | El sol o la luna entre más nubes |
| [Viento](#viento) | Viento de 40 km/h o más | Nada | Lluvia inclinada, polvo rojo en Los Altos, árboles que se mecen |
| [Calima](#calima) | Mala calidad del aire (PM2.5) | Nada | Una capa café sobre Guadalajara en días de contingencia |
| [Temperatura en las leyendas](#temperatura-en-las-leyendas) | Cualquier lectura en vivo | Nada | "Tequila 20° / Rust 15%" |

### Neblina

```text
En git-trains, agrega el estado de clima "fog" (neblina) a la escena de Jalisco. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

Cuándo: códigos WMO 45 y 48, que hoy cuentan como "cloudy" en src/weather/conditions.js.

Arte:
- Guadalajara: una franja pálida de neblina cubre la parte baja de la ciudad hasta la fila 70, más o menos. Las puntas de las torres de la Catedral, las torres del poniente y La Minerva sobresalen. La loma del fondo desaparece.
- Los Altos: la neblina se queda en lo bajo entre las lomas; la torre de la parroquia y las copas de los mezquites sobresalen. Los techos de los ranchos quedan medio visibles.
- Tequila: un banco de neblina sobre las hileras lejanas de agave. Las hileras cercanas quedan despejadas, y sobre la neblina solo asoma la cumbre del volcán.
Usa bordes tramados (el patrón 25/50/75 % de src/scene/sky.js) en vez de transparencias, para que el pixel art siga nítido. La neblina no se mueve, o se desliza con el ciclo de nubes que ya existe.

Listo cuando: `npm run zoom -- 0 0 448 204 --no-trains --scale 3 --weather fog` se ve bien en los dos temas y `npm run check` pasa.
```

### Llovizna

```text
En git-trains, agrega el estado de clima "drizzle" (llovizna) a la escena de Jalisco. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

Cuándo: códigos WMO 51, 53, 55, 56 y 57, que hoy cuentan como "rain".

Arte: como la lluvia pero más ligera. Usa el cielo y el techo de "cloudy", no el cielo de lluvia, y no agregues el velo que oscurece. Usa más o menos un tercio de las gotas de la lluvia, de un píxel de largo y más lentas, con las capas de caída que ya existen en src/scene/weather.js. Los detalles mojados se quedan: los brillos de la plaza de Guadalajara, las tejas brillantes de Los Altos y algunos charcos en el balasto. Quita el agua de los surcos de Tequila.

Listo cuando: la llovizna se ve claramente más ligera que la lluvia en los dos temas a tamaño README y `npm run check` pasa.
```

### Granizo

```text
En git-trains, agrega el estado de clima "hail" (granizo) a la escena de Jalisco. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

Cuándo: códigos WMO 96 y 99 (tormenta con granizo), que hoy cuentan como "storm".

Arte: el cielo y los relámpagos de la tormenta, con granizo en vez de lluvia:
- Bolitas blancas de 1 a 2 píxeles que caen. Son menos que las gotas de lluvia y caen más rápido. Cada pocas bolitas, una rebota un píxel al llegar a la fila del suelo de su lugar.
- Guadalajara, lo que la distingue: granizo blanco acumulado en la fila de la plaza, en los techos de la Catedral y del Sagrario, en el techo del estadio y al pie de La Minerva. Se lee como la granizada del 30 de junio de 2019. Encuentra las filas de los techos en la cuadrícula del fondo, como lo hace la decoración de invierno en src/scene/decor.js.
- Los Altos y Tequila: puntos blancos juntos en los surcos y en el balasto.
Lo acumulado no se mueve; solo caen las bolitas. Las bolitas se detienen con prefers-reduced-motion.

Listo cuando: el granizo se distingue claramente de la lluvia a tamaño README en los dos temas y `npm run check` pasa.
```

### Helada

```text
En git-trains, agrega el estado de clima "frost" (helada) a la escena de Jalisco. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

Cuándo: un código despejado (0–2) con temperature_2m de 2 °C o menos. La consulta ya pide temperature_2m. Decide el estado en src/weather/conditions.js con el código y la temperatura juntos, y prueba el umbral.

Arte, sobre todo en Los Altos (donde la helada es común en las mañanas de invierno):
- Un tono blanco azulado y pálido en la parte alta de las lomas de pasto y en los techos de los ranchos. Píntalo sobre el píxel de arriba de cada superficie leyendo la cuadrícula del fondo; no cubras toda la superficie.
- Una línea blanca delgada sobre la cerca de piedra.
- Guadalajara: escarcha solo en los árboles de la plaza.
- Tequila: las puntas del agave escarchadas.
El cielo sigue despejado. Nada se mueve.

Listo cuando: la helada se ve, pero discreta, en los dos temas, el umbral tiene pruebas y `npm run check` pasa.
```

### Calor

```text
En git-trains, agrega el estado de clima "heat" (calor) a la escena de Jalisco. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

Cuándo: un código despejado (0–2) con temperature_2m de 32 °C o más.

Arte, sobre todo en Tequila:
- El aire que vibra: una franja de 2 filas justo encima del horizonte del campo de agave. Algunos píxeles del horizonte se mueven un píxel a la izquierda y a la derecha en un ciclo lento step-end (dos cuadrículas que se alternan, como el parpadeo de las estrellas en src/scene/sky.js). Se detiene con prefers-reduced-motion.
- Cielo deslavado: las bandas altas del cielo de los tres lugares se acercan a un tono cálido pálido en el tema claro. En el oscuro, una bruma nocturna más cálida.
- Guadalajara: los rayos del sol crecen un píxel.
Mantén el efecto discreto: el agave debe seguir reconociéndose.

Listo cuando: la vibración hace un ciclo sin costura, la escena se lee a tamaño README y `npm run check` pasa.
```

### Nieve

```text
En git-trains, agrega el estado de clima "snow" (nieve) a la escena de Jalisco. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

Cuándo: códigos WMO 71, 73, 75, 77, 85 y 86, que hoy cuentan como "rain". La nieve es rara en Jalisco; Guadalajara la vio en diciembre de 1997.

Arte: reutiliza lo más posible la decoración de invierno de src/scene/decor.js: los copos que caen y la nieve sobre los techos encontrados en la cuadrícula del fondo. Recorta los copos a la franja de cada lugar con las capas de caída de src/scene/weather.js. Usa el cielo de "cloudy". Agrega nieve en las torres de la Catedral, el techo del estadio, los techos de Los Altos y las laderas altas del volcán. No dupliques decor.js; si los dos necesitan una función, muévela a un módulo pequeño compartido.

Listo cuando: la nieve se lee a tamaño README en los dos temas, la decoración de invierno sigue pasando sus pruebas y `npm run check` pasa.
```

### Medio nublado

```text
En git-trains, agrega el estado de clima "partly" (medio nublado) a la escena de Jalisco. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

Cuándo: códigos WMO 1 y 2, que hoy cuentan como "clear". El 0 sigue siendo despejado.

Arte: el cielo, el sol y la luna de siempre, más una segunda capa de tres o cuatro bancos de nubes más grandes y planos que se deslizan con el ciclo de nubes que ya existe. Usa la función bank() de src/scene/weather.js con las tintas de nube de la propia escena. Un banco puede tapar en parte al sol. Las franjas del campo reciben uno o dos bancos pequeños cada una. Sin velo ni lluvia.

Listo cuando: medio nublado queda claramente entre despejado y nublado en los dos temas y `npm run check` pasa.
```

### Viento

```text
En git-trains, agrega viento al clima de Jalisco. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

El viento es un modificador, no un estado: se combina con cualquier estado. Agrega wind_speed_10m a la consulta de Open-Meteo, valídalo en readCurrentWeather (0–200 km/h) y pasa a buildSpec una marca "windy" por lugar (40 km/h o más) junto al estado.

Arte:
- La lluvia y el granizo caen inclinados. Dibuja las gotas en diagonal y muévelas en diagonal en los keyframes de caída, para que el ciclo siga sin costura.
- Los Altos: unas rayas de polvo rojo se levantan de las parcelas aradas.
- Los árboles de la plaza y los mezquites se mecen un píxel con una animación step-end lenta que se detiene con movimiento reducido.

Listo cuando: las pruebas combinan el viento con cada estado, los ciclos no tienen costura y `npm run check` pasa.
```

### Calima

```text
En git-trains, agrega calima por mala calidad del aire sobre Guadalajara. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

Datos: una segunda consulta a la API de calidad del aire de Open-Meteo (https://air-quality-api.open-meteo.com/v1/air-quality, current=pm2_5), solo para Guadalajara. Ponla en su propia función de adaptador con fetch inyectado, y que sea opcional: si falla, no hay calima. Usa calima cuando el PM2.5 pase de 55 µg/m³.

Arte: una capa café tramada sobre la mitad baja del cielo de Guadalajara. La loma del fondo y las torres del poniente se desvanecen hacia el color del cielo. La Catedral y los monumentos del frente siguen nítidos. La calima se combina con despejado y nublado. La lluvia la limpia, así que no la dibujes con lluvia ni tormenta.

Listo cuando: la segunda consulta tiene pruebas con un fetch falso, su falla no afecta nada y `npm run check` pasa.
```

### Temperatura en las leyendas

```text
En git-trains, muestra la temperatura de cada lugar en las leyendas de Jalisco cuando el clima es en vivo, por ejemplo "Tequila 20° / Rust 15%".

Pasos:
- weatherFor en src/action/weather.js ya lee temperature_2m. Pasa las temperaturas redondeadas a buildSpec junto a los estados.
- Revisa si src/graphics/font.js tiene el símbolo de grado. Si no lo tiene, agrégalo con el estilo de la fuente y pruébalo.
- Los estados fijos no tienen temperatura: sus leyendas quedan igual.
- Revisa que la leyenda más larga siga cabiendo junto al semáforo en los dos sentidos de marcha.
Actualiza las dos referencias.

Listo cuando: las leyendas muestran la temperatura solo con lecturas en vivo, los recursos generados no cambian (ahí el clima está apagado) y `npm run check` pasa.
```

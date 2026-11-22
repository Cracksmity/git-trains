# Climas pendientes

La escena de Jalisco dibuja diez estados (`clear`, `frost`, `heat`, `partly`, `cloudy`, `fog`, `drizzle`, `rain`, `storm` y `hail`). Ver [Clima](reference.md#clima). Mientras no tengan arte propio, los demás climas usan el estado más parecido. Esta página reúne los diseños que faltan, con un prompt para cada uno. Pega el prompt en un agente de IA que trabaje en este repositorio.

[English version](../weather-backlog.md)

## Reglas para cada estado nuevo

Un estado nuevo toca los mismos lugares que los cuatro primeros:

1. **Datos:** [src/weather/conditions.js](../../src/weather/conditions.js) agrega el estado a `WEATHER_STATES` y a `WEATHER_NAMES` (inglés y español), y mueve sus códigos WMO en `CODES`. Si el estado depende de la temperatura o del viento, también hace falta un campo en la consulta a Open-Meteo ([src/weather/open-meteo.js](../../src/weather/open-meteo.js)). `readCurrentWeather` debe validar ese campo como los demás. Lo que una lectura agrega además del estado (la temperatura, el viento) llega a la escena en su entrada `PlaceSky`: ver `placeSky` y `skyOfReading`, y `scene.sky` en `weatherArt`.
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
| [Nieve](#nieve) | WMO 71–77, 85, 86 | `rain` | La rara nevada sobre Jalisco, como la de diciembre de 1997 |
| [Calima](#calima) | Mala calidad del aire (PM2.5) | Nada | Una capa café sobre Guadalajara en días de contingencia |
| [Temperatura en las leyendas](#temperatura-en-las-leyendas) | Cualquier lectura en vivo | Nada | "Tequila 20° / Rust 15%" |

### Nieve

```text
En git-trains, agrega el estado de clima "snow" (nieve) a la escena de Jalisco. Primero lee "Reglas para cada estado nuevo" en docs/es/clima-pendiente.md y síguelas.

Cuándo: códigos WMO 71, 73, 75, 77, 85 y 86, que hoy cuentan como "rain". La nieve es rara en Jalisco; Guadalajara la vio en diciembre de 1997.

Arte: reutiliza lo más posible la decoración de invierno de src/scene/decor.js: los copos que caen y la nieve sobre los techos encontrados en la cuadrícula del fondo. Recorta los copos a la franja de cada lugar con las capas de caída de src/scene/weather.js. Usa el cielo de "cloudy". Agrega nieve en las torres de la Catedral, el techo del estadio, los techos de Los Altos y las laderas altas del volcán. No dupliques decor.js; si los dos necesitan una función, muévela a un módulo pequeño compartido.

Listo cuando: la nieve se lee a tamaño README en los dos temas, la decoración de invierno sigue pasando sus pruebas y `npm run check` pasa.
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

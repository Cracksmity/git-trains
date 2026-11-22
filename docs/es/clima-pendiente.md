# Climas pendientes

La escena de Jalisco dibuja once estados (`clear`, `frost`, `heat`, `partly`, `cloudy`, `fog`, `drizzle`, `rain`, `snow`, `storm` y `hail`). Ver [Clima](reference.md#clima). El viento y la calima se combinan con ellos como modificadores. Esta página fija las reglas que sigue cada diseño nuevo y reúne los que faltan, con un prompt para cada uno. Pega el prompt en un agente de IA que trabaje en este repositorio.

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

Por ahora ninguno: la nieve, el viento, la calima y la temperatura en las leyendas eran los últimos de la lista. Agrega aquí el siguiente diseño con su prompt. `tools/conductor/tasks/weather-brief.md` es el brief que el conductor le da a un agente para cualquier diseño nuevo del clima.

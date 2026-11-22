Read `tools/conductor/tasks/weather-brief.md` first: it is the brief for this task.

Add the state `hail` (English name "hail", Spanish "granizo").

Trigger: WMO codes 96 and 99 (thunderstorm with hail), which map to `storm` today. Code 95 stays `storm`.

Art: the storm's sky and lightning, with hail instead of rain.
- **The hail:** falling white pellets of 1 to 2 pixels.
  - They are fewer than raindrops and fall faster.
  - Every few pellets, one bounces a pixel where it meets the ground row of its strip.
- **Guadalajara (the signature):** white hail piled along the plaza row, on the Cathedral and Sagrario roofs, on the stadium's roof and at the foot of La Minerva.
  - It should read like the Guadalajara hailstorm of 30 June 2019.
  - Find roof rows from the backdrop grid, the way the winter decoration in `src/scene/decor.js` does (read that file; do not edit it).
- **Los Altos and Tequila:** white specks gathered in the furrows and on the ballast.
- **Motion:** the pile is static; only the pellets move, and they stop with reduced motion.
- **Distinctness:** it must be clearly different from `rain` and `storm` at README size in both themes.

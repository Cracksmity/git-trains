Read `tools/conductor/tasks/weather-brief.md` first: it is the brief for this task.

Add the state `snow` (English name "snow", Spanish "nieve").

Trigger: WMO codes 71, 73, 75 and 77 (snowfall and snow grains) and 85 and 86 (snow showers), which map to `rain` today. Codes 61 to 67 and 80 to 82 stay `rain`, whatever the temperature. Snow is rare in Jalisco: Guadalajara saw it on 13 December 1997, and the Volcán de Tequila whitens a few winters.

Art: the cloudy sky, with snow instead of rain.
- **The flakes:** reuse the winter decoration of `src/scene/decor.js`: its falling flakes and the snow resting on roofs found from the backdrop grid.
  - Clip the flakes to each place's strip with the `fall` layers of `src/scene/weather.js`, as rain does.
  - They fall slower than rain and drift a little.
  - Do not duplicate decor.js. If both need a helper, move it into a small module such as `src/scene/snow.js` and import it from both. The winter decoration must still draw byte for byte the same (`tests/activity/seasons.test.js` and the generated docs check it).
- **Guadalajara (the signature):** snow on the Cathedral's spires and roofs, on the stadium's roof and on the plaza row, as on the morning of December 1997.
- **Los Altos:** white on the ranch and church roofs and along the top of the dry-stone wall; the red parcels show through in patches.
- **Tequila:** the upper slopes of the volcano turn white; the agave tips catch a little.
- **Motion:** what rests is static; only the flakes move, and they stop with reduced motion.
- **Distinctness:** it must read as snow, not as hail (white pellets that bounce) or frost (a thin tint, no flakes), at README size in both themes.

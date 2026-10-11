# מאפיונר

משליח לסנדק, או ישר לכלא. משחק החלטות בעברית: כל סיבוב הוא דילמה, כל תשובה היא הימור, וחלק מההימורים נגמרים בגזר דין.

Static site, no build step. Plain HTML + ES modules, deployed with GitHub Pages from `main`.

```bash
python3 -m http.server 8000   # play at http://localhost:8000
node test.mjs                 # content checks + 3000 simulated games
```

- `events.js`: all dilemmas and jail events. Add content here.
- `logic.js`: game rules (ranks, income, heat, jail, endings). No DOM.
- `ui.js`: rendering and flow.

Daily challenge (`#N`) seeds the RNG with the day number, so everyone gets the same events and rolls for the same choices.

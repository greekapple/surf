# Rating backtest: before vs after the onshore rule (T-049)

Hours 2026-09-16 to 2026-10-31, Open-Meteo historical marine and weather for each spot's query points. "Before" = wind factor without the onshore ceiling; "after" = with it (onshore above 3 mph held to 59). Nothing else differs. **This compares two versions of the same rating; it is not an accuracy test.**

## Ocean Beach (spot-2)

- Hours rated: 1104 (0 unrated: missing inputs).
- Overall score differs on **316** hours (28.6%); mean change -3.7 points, largest -9.
- Category changes on **127** hours (11.5%): NOT BAD → SURFABLE ×50, SOLID → NOT BAD ×77.
- Wind tick ✓ → ~ on 157 hours.
- Why: the wind factor changes only for onshore wind above 3 mph; hours whose wind factor changed, by wind speed: 7–12 mph ×105, 3–7 mph ×243. 

## Linda Mar (spot-3)

- Hours rated: 1104 (0 unrated: missing inputs).
- Overall score differs on **0** hours (0.0%); mean change 0.0 points, largest 0.
- Category changes on **0** hours (0.0%): none.
- Wind tick ✓ → ~ on 0 hours.
- Why: the wind factor changes only for onshore wind above 3 mph; hours whose wind factor changed, by wind speed: none. Spots without a reviewed orientation have no onshore/offshore relation, so the rule cannot apply to them (the unknown stays unknown).

## Bolinas (spot-0)

- Hours rated: 1104 (0 unrated: missing inputs).
- Overall score differs on **0** hours (0.0%); mean change 0.0 points, largest 0.
- Category changes on **0** hours (0.0%): none.
- Wind tick ✓ → ~ on 0 hours.
- Why: the wind factor changes only for onshore wind above 3 mph; hours whose wind factor changed, by wind speed: none. Spots without a reviewed orientation have no onshore/offshore relation, so the rule cannot apply to them (the unknown stays unknown).

Honest limits: both versions are provisional offshore-potential ratings. No rideability observation is available to say which is closer to reality; the session log will provide that over time.

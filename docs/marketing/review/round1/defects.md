# STAGE A — Round 1 Visual & Technical Defects (22 Found)

1. `t = 0s` rendered blank (`opacity: 0`) because `globalFade` started at `0`.
2. `t = 15s` faded too aggressively (`opacity: 0.44`), washing out the final frame.
3. Mobile (`390px`) step button `"2. Kitchen"` clipped to `"2. Kitche"` when sharing row with `Pause/Play`.
4. Mobile camera pan (`translateX`) clipped Table T4 on the left at `t = 0..2s` and Cashier on the right at `t = 10..11s`.
5. Serving plate landed directly on top of the Table T4 coffee cups.
6. Serving plate sat faintly (`opacity: 0.2`) on top of the service bell during `t = 0..7s`.
7. Waiter phone `"T4 ready"` replaced `"2 x Filter coffee"` awkwardly instead of showing a clean status badge.
8. Kitchen screen ticket card omitted `"2 x Filter coffee"`.
9. Kitchen screen right half looked empty; needed a secondary queued ticket (`T2 • 1 x Idli`) for visual balance.
10. Flying ticket trajectory started slightly below the `Send` button instead of from the button center.
11. Dosa flip (`rotate(180deg)`) rotated downward into the flames instead of tossing upward.
12. Pan and flames floated in mid-air with no stove counter bar underneath.
13. Service bell lacked ringing sound-wave arcs during `t = 8..9.2s`.
14. Cashier receipt peeked out before `Cash` was tapped (`t = 9.5s`).
15. Cashier green check overlapped the printer top-right corner.
16. Owner phone `"Sample data"` label needed a clean pill badge background.
17. Owner phone bars at `t = 0..11s` looked disconnected from the `₹12,400` readout.
18. Hero H1 wrapped to 5 lines in `lg:col-span-5`; widening left column to `lg:col-span-6` gives 4 balanced lines.
19. Hero vertical height exceeded comfortable `1440x900` fold slightly.
20. Tea shop tab (`venue === "tea"`) still showed Table T4 & dosa pan instead of chai kettle, steel tumblers, and Token 12 display.
21. Tea shop captions & `aria-label` needed zero occurrence of the word `table`.
22. `mobile-390.png` step buttons and `Pause` button needed separate rows on `< 640px` for clean spacing.

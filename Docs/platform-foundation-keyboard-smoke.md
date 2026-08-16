# Platform Foundation keyboard smoke test

This checklist is the manual companion to the automated accessibility and
architecture checks. Run it in a foreground browser session after a production
build; delegated background agents intentionally do not open a browser.

1. Load `/` and press `Tab`. Confirm the first focusable item is **Skip to main content** and activating it focuses the single main landmark.
2. Continue tabbing through Park, Agents, Engineering, Evals, Reviews, and Finance / Progress. Confirm each item has visible focus and Enter updates the URL and active destination.
3. Use browser Back and Forward. Confirm the selected destination and `aria-current="page"` follow history.
4. At tablet width, open **Navigate**, reach every destination, choose one, and confirm the menu closes.
5. Open **Terminology help** and confirm its definitions are keyboard reachable without a modal interruption.
6. Toggle **Reduced motion**, reload, and confirm the preference persists on the current device.
7. With a simulation control provider connected, activate Pause, 1x, 2x, and 4x. Confirm the pending label appears before the provider-confirmed state and no control advances logical time itself.
8. If a dialog or drawer is present, open and close it. Confirm initial focus enters the surface and a visible close control is keyboard reachable.
9. Trigger a route failure in the shell harness. Confirm the frame remains usable and recovery actions can return to Park.

Expected focus order is skip link → product header/navigation → global controls
and preferences → destination main content → notifications/footer. No critical
status may rely on color alone.

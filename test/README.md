# Verification

Run `npm run build` before browser checks so they exercise the current release bundle.

```sh
npm test
PLAYWRIGHT_MODULE=/path/to/playwright/index.js node test/honeycomb-raster-check.mjs --button-card /path/to/button-card.js
PLAYWRIGHT_MODULE=/path/to/playwright/index.js node test/honeycomb-user-flow.mjs --button-card /path/to/button-card.js
PLAYWRIGHT_MODULE=/path/to/playwright/index.js node test/honeycomb-native-opening.mjs --button-card /path/to/button-card.js
PLAYWRIGHT_MODULE=/path/to/playwright/index.js node test/honeycomb-icon-raster.mjs --button-card /path/to/button-card.js
```

The raster suite checks six equal polygon edges and equal perpendicular neighbor gaps across sizes, spacing, empty slots and both rings. It also verifies opening/closing keyframes, hover glyph pixels and deliberately broken geometry/hover controls.

The user-flow suite uses the real `ll-custom` entry point and supplied button-card bundle. It lets animations finish naturally, moves the pointer across cells, closes through the shade, reopens, and taps a real card to emit `hass-action` and close with the selected animation. It runs light/dark themes, 6/18 buttons and device pixel ratios 1, 1.25, 1.5 and 2.

Resting screenshots must exactly match an animation-free control at the same pixel ratio. Ordinary hover and reopening must preserve those pixels. Reintroducing forward-filled opening zoom must fail that comparison. Animations are disabled only while capturing the static control, not during interaction checks.

Evidence defaults to `/tmp/honeycomb-regular-check` and `/tmp/honeycomb-user-flow` (override with `RASTER_OUTPUT` / `USER_FLOW_OUTPUT`). Home Assistant navigation and icon elements are stubs: these checks do not replace verification in an actual HA session or execute a device service.

The native-opening suite additionally loads actual HA icon, SVG, card and ripple classes from the public demo (network required). Its hass provider is isolated test data, not a logged-in HA session. It delays native icon chunk requests, samples every animation frame, and checks that SVG paths are ready before becoming visible, centers remain fixed, and icon zoom never reverses. It exercises clickable cards, ripple enabled/disabled, light/dark themes, 3/6/18 buttons and four pixel ratios. The `0.16.12` Git tag is the negative control: it must expose late SVG rendering. Evidence is saved to `/tmp/honeycomb-native-opening` (`NATIVE_OUTPUT` override).

The icon-raster suite compares the upstream bundle, `0.16.13` (renamed test tags only), and the working bundle in one frontend/browser/button-card environment. It loads actual SVG paths, isolates the final zoom instant and compares glyph pixels against rest, including the optional center card at four pixel ratios. Current glyphs must match exactly; the previous release must expose a pixel discontinuity somewhere in the matrix. Fixed masks record edge anti-aliasing differences when deliberately disabling the icon layer; those screenshots are not claimed to be pixel-identical. Polygon bounds must stay identical, and mathematical geometry remains checked separately. Outputs and the exact upstream bundle hash are saved to `/tmp/honeycomb-icon-raster` (`ICON_OUTPUT` override). These frame-isolation tests intentionally pause animations; the natural user-flow suite does not.

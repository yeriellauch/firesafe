# FireSafe — Web AR fire-safety learning prototype

A mobile-first web AR prototype for teaching where to place fire-safety
equipment in a classroom. Built for HCI FS2026 — Übungsblatt 4.

| | |
|---|---|
| **Target platform** | iOS (Safari) — uses **AR Quick Look** for placement of real 3D scans |
| **Tested on** | iPhone 16 / 17 Pro |
| **3D models** | 4 × 3D scans (3 × `.usdz`, 1 × `.glb` from `.obj`) |
| **Pages / screens** | 6 (splash, category select, item select, detail/AR launch, practice mode, complete) + 2 modals |
| **Tech** | Static HTML / CSS / vanilla JS + `<model-viewer>` + Three.js (USDZLoader, GLTFExporter) |
| **Deploy** | GitHub Pages |

---

## How it works

1. **Splash** — branded entry, "Start lesson"
2. **Category select** — choose a fire-safety device category (extinguisher / water bucket); items already placed get a checkmark, lesson auto-finishes when all are done
3. **Variant select** — pick a specific 3D-scanned model; hint cards explain placement principles; thumbnails show the actual 3D scans
4. **Detail / AR launch** — full 3D viewer (rotate, pinch-zoom) + placement tip + two paths:
   - **View in AR** — launches AR Quick Look on iOS Safari with the actual `.usdz` scan; user places it in their real room
   - **Practice placement** — opens camera feed + tap-to-place + scoring feedback (the educational gameplay)
5. **Practice mode** — uses the device camera (`getUserMedia`) so users place items in their own real environment, not a fake background
6. **Lesson complete** — per-item scorecard

---

## Architecture decisions

### Why both `<model-viewer>` and Three.js?

`<model-viewer>` (Google's AR web component) is excellent at:
- AR Quick Look launch on iOS (handles MIME types and gesture rules correctly)
- Scene Viewer launch on Android
- Rotatable in-browser 3D preview from `.glb`

But it can't render `.usdz` files in the browser — only iOS AR Quick Look can.
We have 3 `.usdz` scans (the team's actual models) but no `.glb` versions
of them.

**Solution:** at runtime in the browser, we load each `.usdz` via Three.js's
`USDZLoader`, then export to `.glb` via `GLTFExporter`, and feed the
resulting blob URL to `<model-viewer>`'s `src` attribute. The original
`.usdz` is still passed via `ios-src` so AR Quick Look gets the
fully-textured original scan.

```js
const { THREE, USDZLoader, GLTFExporter } = await loadThreeStack();
const loader = new USDZLoader();
loader.load(variant.usdz, (group) => {
  const exporter = new GLTFExporter();
  exporter.parse(group, (glb) => {
    const blob = new Blob([glb], { type: "model/gltf-binary" });
    modelViewer.src = URL.createObjectURL(blob);
  }, undefined, { binary: true });
});
```

Both Three.js and the converted blob are cached in memory so each model
is only converted once per session.

### Why camera feed instead of a fake classroom photo?

The previous version used a stylised classroom illustration as the
"AR background", which felt fake. The current version uses
`navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }})`
to show the user's actual environment in practice mode. The placement
hint and feedback are now based on the *vertical position* of the tap
(as a proxy for mounting height) rather than a fixed-room zone map.

For the *real* AR experience (placing the actual 3D model in 3D space),
the user taps "View in AR" which launches AR Quick Look — the proper
ARKit-backed system flow that lets them anchor the scan to a real wall
or floor.

---

## File structure

```
HCI-App/
├── index.html               ← 6 screens + 2 modals
├── styles.css               ← design tokens, mobile-first, safe-area aware
├── app.js                   ← state machine, USDZ→GLB conversion, AR launcher
├── assets/
│   ├── img/                 ← icons, fallback artwork (the favicon SVG, etc.)
│   └── models/
│       ├── extinguisher_classic.glb   ← converted from .obj
│       ├── extinguisher_classic.obj   ← team scan
│       ├── extinguisher_bronze.usdz   ← team scan, also the AR Quick Look source
│       ├── extinguisher_modern.usdz   ← team scan, also the AR Quick Look source
│       └── water_bucket.usdz          ← team scan, also the AR Quick Look source
├── README.md
└── DOCUMENTATION.md         ← submission template (German)
```

---

## Local preview

Open `index.html` in any modern browser. No server, no build step.

For testing on your iPhone over LAN:

```bash
cd HCI-App
python3 -m http.server 8000
# then visit http://<your-mac-ip>:8000 from your iPhone (same wifi)
```

> AR Quick Look only triggers in **Safari on iOS**. Chrome on iOS routes
> through Safari's WebKit too, but the AR-launch gesture handling can be
> finicky — Safari is the reliable target.

---

## Deploying to GitHub Pages

```bash
cd HCI-App
git init
git add .
git commit -m "FireSafe v2"
git branch -M main
git remote add origin git@github.com:<your-user>/firesafe.git
git push -u origin main
```

Then on GitHub:

1. **Settings → Pages**
2. Source: *Deploy from a branch*, branch `main`, folder `/ (root)`
3. Save. Live URL: `https://<your-user>.github.io/firesafe/`

GitHub Pages serves over HTTPS (required for both AR Quick Look and
`getUserMedia`) and ships `.usdz` files with the right MIME type
(`model/vnd.usdz+zip`) automatically.

---

## Customisation

- **Add a new placeable item** — drop the `.usdz` (and optionally a
  `.glb`) into `assets/models/`, then add an entry under
  `CATALOG.categories` in `app.js`.
- **Change placement evaluation** — edit the `evaluatePlacement()` function
  in `app.js`. It currently uses tap height (y-coordinate, 0–1) since
  the camera background is the user's real environment.
- **Re-skin** — design tokens are CSS variables at the top of `styles.css`.

---

## Known limitations

| | |
|---|---|
| Three.js USDZLoader supports geometry but limited material/texture features | Browser preview may show simpler shading than AR Quick Look |
| First load is heavy (~25 MB of 3D scans) | Subsequent navigations are cached |
| AR Quick Look requires iOS Safari | We detect non-Safari and show a clear message |
| Practice mode camera requires HTTPS | Works on GitHub Pages, fails on `file://` |

# FireSafe — Web AR fire-safety learning prototype

A mobile-first web AR prototype for teaching where to place fire-safety
equipment in a classroom. Built for the HCI FS2026 — Übungsblatt 4
exercise.

| | |
|---|---|
| **Target platform** | iOS (Safari) — uses **AR Quick Look** for 3D placement |
| **Tested on** | iPhone 16 / 17 Pro (also responsive on desktop) |
| **3D models** | 4 × `.usdz` / `.obj` (3D-scanned by the team) |
| **Pages / screens** | 6 (splash, lesson intro, category, item select, AR placement, complete) + 2 modals |
| **Tech** | Static HTML / CSS / vanilla JS — no build step |
| **Deploy** | GitHub Pages |

---

## How it works

1. **Splash** — branded entry, "Start lesson"
2. **Lesson intro** — what you'll learn, items previewed
3. **Category select** — choose what to place (extinguisher / water bucket); already-placed items get a checkmark and the lesson auto-finishes once all are done
4. **Item select** — pick a specific 3D model variant; hint cards explain placement principles
5. **AR placement (simulated)** — tap anywhere on the room background to place the item; the app evaluates which "zone" you tapped and gives a score + reason
6. **Feedback overlay** — success / partial / fail with educational explanation
7. **AR Quick Look** — the "View in AR" button opens the actual `.usdz` model in iOS AR Quick Look so you can place the real 3D scan in your own room
8. **Lesson complete** — per-item scorecard

The simulated overlay mode is what the user sees in the browser. The
**real AR** is one tap away via the *View in AR* button (iOS only).

---

## File structure

```
HCI-App/
├── index.html           ← all 6 screens + 2 overlays
├── styles.css           ← design tokens, mobile-first
├── app.js               ← state machine, placement zones, AR Quick Look launcher
├── assets/
│   ├── img/
│   │   ├── room-bg.svg                 ← simulated AR camera background
│   │   ├── icon_extinguisher_classic.svg
│   │   ├── icon_extinguisher_bronze.svg
│   │   ├── icon_extinguisher_modern.svg
│   │   └── icon_water_bucket.svg
│   └── models/
│       ├── extinguisher_classic.obj   ← team scan, OBJ
│       ├── extinguisher_bronze.usdz   ← team scan, USDZ for AR Quick Look
│       ├── extinguisher_modern.usdz   ← team scan, USDZ for AR Quick Look
│       └── water_bucket.usdz          ← team scan, USDZ for AR Quick Look
└── README.md
```

---

## Local preview

Just open `index.html` in any modern browser. No server, no build.
On desktop you'll see the app inside a phone-frame mockup; on mobile
it goes full-screen.

```bash
# Optional: serve via Python so AR Quick Look works on iOS LAN testing
python3 -m http.server 8000
# then visit http://<your-mac-ip>:8000 from your iPhone on the same wifi
```

---

## Deploying to GitHub Pages

```bash
# from inside HCI-App/
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:<your-user>/firesafe.git
git push -u origin main
```

Then on GitHub:

1. **Settings → Pages**
2. Source: *Deploy from a branch*, branch `main`, folder `/ (root)`
3. Save. Your app will be live at
   `https://<your-user>.github.io/firesafe/`

> **Important for AR Quick Look:** GitHub Pages serves over HTTPS, which
> AR Quick Look requires. The `.usdz` files must be served with the
> correct MIME type — GitHub Pages does this automatically. If you self-host
> elsewhere, configure `model/vnd.usdz+zip` for `.usdz`.

---

## How AR Quick Look is wired in

`app.js` constructs an anchor with `rel="ar"` on the fly when the user
taps **View in AR**:

```js
const a = document.createElement("a");
a.setAttribute("rel", "ar");
a.href = variant.modelUSDZ;          // path to .usdz
a.appendChild(document.createElement("img")); // required by Safari
document.body.appendChild(a);
a.click();
```

iOS Safari recognises this and launches AR Quick Look with the model.

---

## Customisation

- **Add a new placeable item:** drop the `.usdz` into `assets/models/`, an
  SVG icon into `assets/img/`, then add an entry under `CATALOG.categories`
  in `app.js`.
- **Change placement evaluation:** edit the `ZONES` object in `app.js`.
  Each zone is `{x1, y1, x2, y2, score, verdict, title, body}` with
  normalised (0–1) coordinates.
- **Re-skin:** all colours and radii live as CSS variables at the top of
  `styles.css`.

---

## What was simulated vs. real

| Feature | Status |
|---|---|
| 6-screen UI flow | ✅ Real |
| 3D scan models (`.usdz`) loaded & launchable | ✅ Real (AR Quick Look) |
| Tap-to-place on simulated room background | ⚠️ Simulated (a real AR session needs ARKit and isn't available in plain web) |
| Placement feedback / scoring | ✅ Real (zone-based logic in JS) |

For the product video (Übungsblatt 5), the simulated tap-to-place
provides a clean, recordable demo without needing on-device AR mid-shot.

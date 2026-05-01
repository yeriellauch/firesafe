# UB4 — FireSafe Web AR Prototyp

**Gruppe:** _Gruppe X_
**Mitglieder:** _Nachname1, Nachname2 (, Nachname3)_
**Übungsblatt:** 4 — HCI FS2026
**Live-URL:** _https://&lt;username&gt;.github.io/firesafe/_

---

## 1.1 Web AR-Prototyp

### Plattform

Der Prototyp ist für **iOS** entwickelt und auf einem **iPhone 16 / 17 Pro**
(Safari) getestet. iOS bietet mit *AR Quick Look* eine systemweite
AR-Anzeige für `.usdz`-Modelle, die direkt aus einer Webseite heraus
gestartet werden kann.

### Aufbau & Seiten

Der Prototyp besteht aus **sechs Seiten** (mehr als die geforderten drei):

1. **Splash** — Branding, Einstieg in die Lektion
2. **Kategorie-Auswahl** — Wahl zwischen Feuerlöscher und Wassereimer; bereits platzierte Items werden mit Häkchen markiert
3. **Modell-Auswahl** — drei Feuerlöscher-Varianten und ein Wassereimer, mit echten 3D-Thumbnails und Hinweis-Karten
4. **Detail / AR-Launch** — voller 3D-Viewer (Rotieren / Zoomen) + Platzierungs-Tipp + Buttons "View in AR" und "Practice placement"
5. **Practice Mode** — echtes Kamera-Feed (`getUserMedia`) + Tap-to-Place + Bewertung der Höhe (statt fiktivem Klassenraum-Hintergrund)
6. **Lesson Complete** — Übersicht der Bewertungen pro Item

Zusätzlich: Feedback-Overlay und Hilfe-Modal.

### AR-Implementierung

Der Prototyp nutzt **AR Quick Look** auf iOS Safari für die echte
AR-Platzierung. Das Originalmodell (`.usdz`) wird via
`<model-viewer>` mit `ios-src` Attribut eingebunden und über die
`activateAR()`-Methode bei Tap auf "View in AR" gestartet:

```html
<model-viewer
  src="model.glb"
  ios-src="model.usdz"
  ar
  ar-modes="quick-look webxr scene-viewer">
</model-viewer>
```

Da nur eines unserer 3D-Modelle als `.glb` vorliegt (das andere
sind 3D-Scans im `.usdz`-Format), konvertieren wir die `.usdz`-Dateien
zur Laufzeit im Browser via Three.js `USDZLoader` + `GLTFExporter`,
sodass `<model-viewer>` sie auch als rotierbare Browser-Vorschau
rendern kann. Das Original `.usdz` bleibt für AR Quick Look erhalten,
damit der vollständige Scan mit allen Texturen platziert wird.

### 3D-Modelle

Es werden **vier 3D-Modelle** eingebunden (die Vorgabe verlangt drei):

| Modell | Datei | Format | Quelle |
|---|---|---|---|
| Klassischer Feuerlöscher | `assets/models/extinguisher_classic.obj` | OBJ | 3D-Scan des Teams |
| Bronze Feuerlöscher | `assets/models/extinguisher_bronze.usdz` | USDZ | 3D-Scan des Teams |
| Modern CO₂ Feuerlöscher | `assets/models/extinguisher_modern.usdz` | USDZ | 3D-Scan des Teams |
| Wassereimer | `assets/models/water_bucket.usdz` | USDZ | 3D-Scan des Teams |

Die `.usdz`-Dateien werden über AR Quick Look in iOS Safari aufgerufen,
ausgelöst über `<model-viewer>`'s `activateAR()`-Methode.
Als zusätzlicher Fallback (falls model-viewer nicht initialisiert ist)
gibt es auch eine direkte `<a rel="ar">`-Variante:

```js
const a = document.createElement("a");
a.setAttribute("rel", "ar");
a.href = variant.usdz;
a.appendChild(document.createElement("img"));
document.body.appendChild(a);
a.click();
```

### Workflow: Vom Scan zum Web-Modell

> Diesen Abschnitt mit euren echten Schritten füllen — die Stichpunkte sind als Gerüst gedacht.

1. **Scan-Aufnahme**
   - App: _Polycam / RealityScan / Scaniverse_ (eintragen, was ihr verwendet habt)
   - Geräte-Lidar / Photogrammetrie-Modus, Belichtung, Anzahl Fotos
2. **Cleanup in Blender**
   - Import als `.obj`/`.glb` _(eintragen)_
   - Mesh-Decimation auf ca. _10-20k_ Tris (Modifier → Decimate)
   - Reorient (Y-Up vs. Z-Up beachten — USDZ erwartet Y-Up)
   - Skala auf reale Maße setzen (Object → Apply → Scale)
   - Texturen säubern, Hintergrundgeometrie löschen
3. **Export**
   - **USDZ (für iOS):** Blender ≥ 4.1 hat einen nativen USD/USDZ-Exporter
     - File → Export → Universal Scene Description (`.usdz`)
     - Forward = `-Z`, Up = `+Y`
     - "Selected Only" angehakt, "Use Settings for: AR" wählen
   - Alternativ: in Reality Composer (macOS) öffnen und "Share → USDZ"
   - **OBJ (Backup für Web Renderer):** File → Export → Wavefront `.obj`
4. **Einbindung**
   - Datei nach `assets/models/` legen
   - Im `CATALOG`-Objekt in `app.js` Pfad eintragen
   - Auf iOS Safari testen → "View in AR" tippen → Modell wird in AR Quick Look geöffnet
5. **Hosting**
   - Repo nach GitHub pushen, GitHub Pages auf `main / root` aktivieren
   - Über HTTPS erreichbar — Voraussetzung für AR Quick Look

### Screenshots

> Hier eure echten Screenshots vom iPhone einfügen.

_Screenshot 1: Splash-Screen (iPhone 17 Pro, Safari)_
_Screenshot 2: Lesson Intro_
_Screenshot 3: Kategorie-Auswahl_
_Screenshot 4: Modell-Auswahl mit Hinweisen_
_Screenshot 5: AR-Platzierung (simuliert)_
_Screenshot 6: Feedback-Overlay nach Platzierung_
_Screenshot 7: AR Quick Look mit Modell in echter Umgebung_
_Screenshot 8: Lesson Complete_

### Bekannte Abweichungen vom Figma

- **Visuelles Refresh:** Die rosa-weisse Marmorierung wurde durch ein
  kühleres, professionelleres Farbschema (warmes Rot + dunkler Slate +
  Cremeweiss) ersetzt, das eher zu einem Lerninstrument für Sicherheit passt.
- **Zwei Hierarchie-Ebenen statt einer:** Kategorie → Variante (statt
  alle Varianten direkt). Das skaliert besser, wenn weitere Geräte
  (Rauchmelder, Notausgangs-Schild …) ergänzt werden.
- **Echte AR statt simuliertem Klassenraum:** Die ursprüngliche Idee
  eines fiktiven Klassenraum-Hintergrunds wurde verworfen. Stattdessen
  startet "View in AR" eine echte AR Quick Look Session, in der das
  3D-Modell im realen Raum platziert werden kann. Für die Lern-/Feedback-
  Funktionalität gibt es einen separaten "Practice mode", der das echte
  Kamerabild des Geräts nutzt (`getUserMedia`).
- **Kombinierter Done-/Feedback-Screen:** Das ursprüngliche separate
  "Done"-Screen-Konzept wurde in das Feedback-Overlay zusammengezogen,
  damit der Nutzer direkt zur nächsten Auswahl springt.

---

## 1.2 Plan für das Produktvideo (UB5)

### Drehbuch (ca. 90 s)

| Zeit | Szene | Asset |
|---|---|---|
| 0:00–0:10 | Titelkarte: "FireSafe — AR fire safety lessons" | Logo + Tagline |
| 0:10–0:25 | Kontext: Lehrperson erklärt einer Klasse, Off-Stimme zur Problemstellung | Stock-Klassenraum-Aufnahme + Voice-over |
| 0:25–0:40 | Walk-through Splash → Lesson Intro → Kategorie | Screen Recording iPhone |
| 0:40–1:00 | AR-Platzierung simuliert: Tap → Feedback "Excellent placement" | Screen Recording iPhone |
| 1:00–1:15 | "View in AR" → Feuerlöscher als 3D-Modell im echten Klassenraum | iPhone-Aufnahme via zweite Kamera |
| 1:15–1:30 | Lesson Complete + Call-to-Action | Screen Recording + Outro-Karte |

### Funktionen, die simuliert werden müssen, und wie

| Funktion | Warum nicht real | Wie im Video lösen |
|---|---|---|
| Echtzeit-AR im Browser (Surface-Detection, Plane-Tracking) | WebXR ist auf iOS Safari noch nicht voll verfügbar; ARKit nur via native App / AR Quick Look | Simulierter Raum-Hintergrund; AR Quick Look für *eine* echte Platzierung im Video als Beweis |
| Live-Feedback "ist gut platziert?" auf Basis echter Geometrie | Erfordert Klassifikator + Raumverständnis | Vordefinierte Zonen reichen für Demo; Voice-over erklärt das Konzept eines ML-Modells als Erweiterung |
| Speichern eines Klassen-Setups | Backend / Authentifizierung bewusst weggelassen | Mock-Screenshot eines "Setup gespeichert" Toasts |
| Kollaborative Sitzung (mehrere Schüler:innen platzieren gleichzeitig) | Erfordert Realtime-Backend | Split-Screen-Animation mit zwei iPhone-Aufnahmen, dazu Voice-over |

### Aufnahme-Setup

- **iPhone Screen Recording** (Kontrollzentrum → Aufnahme) für alle UI-Walkthroughs
- **AR Quick Look** wird mit einer **zweiten Kamera** (zweites Smartphone auf Stativ) gefilmt, weil iOS während AR Quick Look keine Bildschirmaufnahme unterstützt
- Schnitt in iMovie oder DaVinci Resolve, Voice-over separat aufnehmen
- Musikbett: lizenzfrei (z.B. Uppbeat / Pixabay Music)

---

## Anhang: Live-URL

**Web App:** _https://&lt;username&gt;.github.io/firesafe/_
**Repo:** _https://github.com/&lt;username&gt;/firesafe_

Auf einem iPhone (iOS 16+) in Safari öffnen → "Start lesson" → "Begin
placement" → Item wählen → AR-Bildschirm → "View in AR" tippen, um das
3D-Modell in eurem realen Raum zu sehen.

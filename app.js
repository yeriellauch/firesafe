/* ============================================================
   FireSafe — app logic v2
   ------------------------------------------------------------
   Major changes vs v1:
   - Real 3D models rendered in-browser via <model-viewer>.
     For .usdz-only assets we convert to .glb at runtime in the
     browser (Three.js USDZLoader → GLTFExporter) and feed the
     resulting blob URL to model-viewer's src attribute.
   - AR Quick Look is launched via model-viewer's activateAR() —
     reliable, no more "downloads the file" issue.
   - Practice mode now uses the device camera (getUserMedia)
     instead of a fake classroom photo.
   ============================================================ */

const CATALOG = {
  categories: [
    {
      id: "extinguisher",
      name: "Fire extinguisher",
      desc: "Hand-held suppression unit",
      hints: [
        { title: "Hint 1", text: "Mount fire extinguishers where they are highly visible and quickly reachable from any seat in the room." },
        { title: "Hint 2", text: "Keep them clear of obstructions like cabinets, doors, or curtains — every second matters in an emergency." },
        { title: "Hint 3", text: "The recommended mounting height is between 90 cm and 150 cm above the floor." }
      ],
      variants: [
        {
          id: "classic",
          name: "Classic powder",
          glb: "assets/models/extinguisher_classic.glb",
          usdz: null,                                             // no usdz scan for this one yet
          fireClass: "Class A·B·C — dry powder",
          tip: "Mount on a clear wall section near the room exit, at 1.0–1.5 m height. Visible from anywhere in the room."
        },
        {
          id: "modern",
          name: "Modern CO₂",
          glb: null,
          usdz: "assets/models/extinguisher_modern.usdz",
          fireClass: "Class B·C — electrical-safe",
          tip: "CO₂ extinguishers belong near electrical equipment. Don't mount above appliances — the cold gas can damage screens."
        },
        {
          id: "bronze",
          name: "Vintage brass",
          glb: null,
          usdz: "assets/models/extinguisher_bronze.usdz",
          fireClass: "Heritage — display piece",
          tip: "Decorative units must still be functional. Mount where they're protected but accessible."
        }
      ]
    },
    {
      id: "bucket",
      name: "Water bucket",
      desc: "Class-A water station",
      hints: [
        { title: "Hint 1", text: "Water buckets are best placed near workshop areas where Class-A combustibles (paper, wood, fabric) are present." },
        { title: "Hint 2", text: "Never place a water bucket near electrical outlets or live equipment — water conducts electricity." }
      ],
      variants: [
        {
          id: "bucket_red",
          name: "Standard bucket",
          glb: null,
          usdz: "assets/models/water_bucket.usdz",
          fireClass: "Class A — solids only",
          tip: "Place at floor level, near the workshop area, well clear of any electrical sockets."
        }
      ]
    }
  ]
};

/* ============================================================
   App state
   ============================================================ */
const state = {
  currentScreen: "splash",
  selectedCategory: null,
  selectedVariant: null,
  placedAt: null,
  results: {},
  cameraStream: null
};

/* GLB blob URL cache (key = variant id) — converted .usdz files */
const glbCache = {};
/* Convert promise cache so we don't double-convert */
const convertPromises = {};

/* ============================================================
   Three.js dynamic loader (loaded once, on first AR/detail visit)
   ============================================================ */
let threeReady = null;
function loadThreeStack() {
  if (threeReady) return threeReady;
  threeReady = (async () => {
    const THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js");
    const { USDZLoader } = await import("https://unpkg.com/three@0.160.0/examples/jsm/loaders/USDZLoader.js");
    const { GLTFExporter } = await import("https://unpkg.com/three@0.160.0/examples/jsm/exporters/GLTFExporter.js");
    return { THREE, USDZLoader, GLTFExporter };
  })();
  return threeReady;
}

/* Convert a .usdz file at the given URL to a .glb blob URL.
   Result is cached per variant. */
async function getGlbForVariant(variant) {
  if (variant.glb) return variant.glb;          // already .glb
  if (!variant.usdz) return null;
  if (glbCache[variant.id]) return glbCache[variant.id];
  if (convertPromises[variant.id]) return convertPromises[variant.id];

  convertPromises[variant.id] = (async () => {
    const { THREE, USDZLoader, GLTFExporter } = await loadThreeStack();
    return new Promise((resolve, reject) => {
      const loader = new USDZLoader();
      loader.load(
        variant.usdz,
        (group) => {
          // Center & normalise scale so the model fits a 1m bounding box
          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          group.position.sub(center);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          group.scale.setScalar(0.6 / maxDim);

          const exporter = new GLTFExporter();
          exporter.parse(
            group,
            (gltfBinary) => {
              const blob = new Blob([gltfBinary], { type: "model/gltf-binary" });
              const url = URL.createObjectURL(blob);
              glbCache[variant.id] = url;
              resolve(url);
            },
            (err) => reject(err),
            { binary: true }
          );
        },
        undefined,
        (err) => reject(err)
      );
    });
  })();
  return convertPromises[variant.id];
}

/* ============================================================
   Navigation
   ============================================================ */
function go(screenId) {
  const current = document.querySelector(".screen.active");
  const next = document.querySelector(`[data-screen="${screenId}"]`);
  if (!next || current === next) return;

  if (current) {
    current.classList.remove("active");
    current.classList.add("exit-left");
    setTimeout(() => current.classList.remove("exit-left"), 320);
    // Stop camera if leaving practice screen
    if (current.dataset.screen === "practice") stopCamera();
  }
  next.classList.add("active");
  state.currentScreen = screenId;

  if (screenId === "category-select") renderCategoryGrid();
  if (screenId === "item-select") renderItemSelect();
  if (screenId === "detail") renderDetail();
  if (screenId === "practice") renderPractice();
  if (screenId === "complete") renderComplete();
}

document.addEventListener("click", (e) => {
  const tgt = e.target.closest("[data-go]");
  if (tgt) { e.preventDefault(); go(tgt.dataset.go); }
  const modalTrigger = e.target.closest("[data-modal]");
  if (modalTrigger) showOverlay(modalTrigger.dataset.modal === "help" ? "helpOverlay" : null);
});

/* ============================================================
   Category grid (with mini 3D thumbnails)
   ============================================================ */
function renderCategoryGrid() {
  const grid = document.getElementById("categoryGrid");
  grid.innerHTML = CATALOG.categories.map(cat => {
    const placed = state.results[cat.id];
    const heroVariant = cat.variants[0];
    return `
      <button class="cat-card ${placed ? "placed" : ""}" data-cat="${cat.id}">
        <div class="cat-thumb" data-thumb-variant="${heroVariant.id}">
          ${makeThumbViewer(heroVariant, "cat-" + cat.id)}
        </div>
        <p class="cat-name">${cat.name}</p>
        <p class="cat-desc">${cat.desc}</p>
      </button>
    `;
  }).join("");

  grid.querySelectorAll(".cat-card").forEach(card => {
    card.addEventListener("click", () => {
      state.selectedCategory = card.dataset.cat;
      go("item-select");
    });
  });

  // Hydrate thumbnails (load model URLs)
  CATALOG.categories.forEach(cat => hydrateThumb(cat.variants[0], "cat-" + cat.id));

  // Progress text
  const placed = Object.keys(state.results).length;
  const total = CATALOG.categories.length;
  const pt = document.getElementById("progressText");
  if (placed === total) {
    pt.innerHTML = `All ${total} placed · <a href="#" id="finishLink" style="color:#f4a261;font-weight:600">Finish lesson →</a>`;
    setTimeout(() => {
      const fl = document.getElementById("finishLink");
      if (fl) fl.addEventListener("click", (e) => { e.preventDefault(); go("complete"); });
    }, 0);
  } else {
    pt.textContent = `${placed} of ${total} placed`;
  }
}

/* Helper: build a small <model-viewer> that auto-rotates a model thumbnail.
   We start with no src (will be hydrated after .usdz → .glb conversion). */
function makeThumbViewer(variant, idSuffix) {
  return `
    <model-viewer
      id="mv-${idSuffix}"
      auto-rotate
      auto-rotate-delay="500"
      rotation-per-second="30deg"
      disable-zoom
      interaction-prompt="none"
      shadow-intensity="0.8"
      exposure="1.1"
      environment-image="neutral"
      camera-orbit="0deg 75deg 1.6m"
      style="width:100%;height:100%;background:transparent;">
      <div slot="poster" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
        <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
      </div>
    </model-viewer>
  `;
}

async function hydrateThumb(variant, idSuffix) {
  const mv = document.getElementById("mv-" + idSuffix);
  if (!mv) return;
  try {
    const glbUrl = await getGlbForVariant(variant);
    if (glbUrl) mv.src = glbUrl;
  } catch (err) {
    console.warn("thumb hydrate failed", variant.id, err);
  }
}

/* ============================================================
   Item select (with hint cards + 3D thumbnails per variant)
   ============================================================ */
function renderItemSelect() {
  const cat = CATALOG.categories.find(c => c.id === state.selectedCategory);
  if (!cat) return;

  document.getElementById("itemSelectTitle").textContent = `Choose ${cat.name.toLowerCase()}`;

  const hintStack = document.getElementById("hintStack");
  hintStack.innerHTML = cat.hints.map(h =>
    `<div class="hint-card"><h4>${h.title}</h4><p>${h.text}</p></div>`
  ).join("");

  const variantGrid = document.getElementById("variantGrid");
  variantGrid.style.gridTemplateColumns = `repeat(${Math.min(cat.variants.length, 3)}, 1fr)`;
  variantGrid.innerHTML = cat.variants.map(v => {
    const placed = state.results[cat.id] && state.results[cat.id].variantId === v.id;
    return `
      <button class="variant-card ${placed ? "placed" : ""}" data-variant="${v.id}">
        <div class="variant-thumb">${makeThumbViewer(v, "var-" + v.id)}</div>
        <span class="variant-name">${v.name}</span>
      </button>
    `;
  }).join("");

  variantGrid.querySelectorAll(".variant-card").forEach(card => {
    card.addEventListener("click", () => {
      state.selectedVariant = card.dataset.variant;
      go("detail");
    });
  });

  cat.variants.forEach(v => hydrateThumb(v, "var-" + v.id));
}

/* ============================================================
   Detail screen — large rotatable 3D viewer + AR launch
   ============================================================ */
async function renderDetail() {
  const cat = CATALOG.categories.find(c => c.id === state.selectedCategory);
  const variant = cat?.variants.find(v => v.id === state.selectedVariant);
  if (!cat || !variant) return;

  document.getElementById("detailTitle").textContent = cat.name;
  document.getElementById("detailName").textContent = variant.name;
  document.getElementById("detailClass").textContent = variant.fireClass;
  document.getElementById("placementTipText").textContent = variant.tip;

  const mv = document.getElementById("detailViewer");

  // Reset attributes
  mv.removeAttribute("src");
  mv.removeAttribute("ios-src");

  // ios-src: use the original .usdz (preserves full scan for AR Quick Look)
  if (variant.usdz) {
    mv.setAttribute("ios-src", variant.usdz);
  }

  // src: use direct .glb if available, else convert from .usdz at runtime
  try {
    const glbUrl = await getGlbForVariant(variant);
    if (glbUrl) {
      mv.src = glbUrl;
    }
  } catch (err) {
    console.error("Could not load model for", variant.id, err);
  }

  // Wire AR launch button — calls model-viewer's activateAR()
  const launchBtn = document.getElementById("launchArBtn");
  launchBtn.onclick = async () => {
    // model-viewer must have loaded before activateAR works reliably
    if (!mv.canActivateAR) {
      // Fallback for browsers / situations where model-viewer can't activate AR
      if (variant.usdz && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
        // Direct AR Quick Look on iOS Safari
        const a = document.createElement("a");
        a.setAttribute("rel", "ar");
        a.href = variant.usdz;
        const img = document.createElement("img");
        img.style.display = "none";
        a.appendChild(img);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 100);
      } else {
        alert("AR is only available on iOS Safari (AR Quick Look) or Android Chrome (Scene Viewer). On desktop, you can rotate the model with your mouse.");
      }
      return;
    }
    try {
      await mv.activateAR();
    } catch (err) {
      console.warn("activateAR failed", err);
      alert("Couldn't launch AR. On iPhone, please open this page in Safari (not Chrome).");
    }
  };
}

/* ============================================================
   Practice mode — camera feed + tap to place + feedback
   ============================================================ */
async function renderPractice() {
  const cat = CATALOG.categories.find(c => c.id === state.selectedCategory);
  const variant = cat?.variants.find(v => v.id === state.selectedVariant);
  if (!cat || !variant) return;

  document.getElementById("practiceItemName").textContent = variant.name;
  document.getElementById("practiceHintName").textContent = variant.name.toLowerCase();

  // Reset placement
  state.placedAt = null;
  document.getElementById("arTapHint").classList.remove("hidden");
  const placedImg = document.getElementById("arPlaced");
  placedImg.classList.remove("show");
  placedImg.style.display = "none";

  // Use the variant's poster — render the GLB to a 2D image overlay
  const glbUrl = await getGlbForVariant(variant);
  if (glbUrl) {
    const posterUrl = await renderModelToPng(glbUrl);
    placedImg.src = posterUrl;
  }

  // Start camera
  await startCamera();

  // AR launch button (jump straight to real AR)
  document.getElementById("arViewArBtn").onclick = () => {
    go("detail");
    setTimeout(() => document.getElementById("launchArBtn").click(), 400);
  };

  // Reset
  document.getElementById("arResetBtn").onclick = () => {
    placedImg.classList.remove("show");
    placedImg.style.display = "none";
    state.placedAt = null;
    document.getElementById("arTapHint").classList.remove("hidden");
  };
}

async function startCamera() {
  const video = document.getElementById("cameraFeed");
  const fallback = document.getElementById("cameraFallback");
  fallback.classList.remove("show");
  if (state.cameraStream) {
    video.srcObject = state.cameraStream;
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    state.cameraStream = stream;
    video.srcObject = stream;
    video.style.display = "block";
  } catch (err) {
    console.warn("camera denied", err);
    video.style.display = "none";
    fallback.classList.add("show");
    document.getElementById("cameraRetryBtn").onclick = () => startCamera();
  }
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(t => t.stop());
    state.cameraStream = null;
  }
  const video = document.getElementById("cameraFeed");
  if (video) video.srcObject = null;
}

/* Render a .glb model to a transparent PNG using an off-screen model-viewer.
   We use this to get a "sticker" image of the model for the practice overlay. */
const posterCache = {};
async function renderModelToPng(glbUrl) {
  if (posterCache[glbUrl]) return posterCache[glbUrl];

  return new Promise((resolve) => {
    const offscreen = document.createElement("model-viewer");
    offscreen.style.position = "absolute";
    offscreen.style.left = "-9999px";
    offscreen.style.width = "240px";
    offscreen.style.height = "240px";
    offscreen.setAttribute("camera-orbit", "0deg 75deg 1.4m");
    offscreen.setAttribute("environment-image", "neutral");
    offscreen.setAttribute("exposure", "1.1");
    offscreen.setAttribute("shadow-intensity", "0");
    offscreen.style.background = "transparent";
    offscreen.src = glbUrl;
    document.body.appendChild(offscreen);

    offscreen.addEventListener("load", async () => {
      try {
        const blob = await offscreen.toBlob({ idealAspect: true, mimeType: "image/png" });
        const url = URL.createObjectURL(blob);
        posterCache[glbUrl] = url;
        resolve(url);
      } catch (err) {
        console.warn("toBlob failed", err);
        resolve(glbUrl);  // fallback: just use the glb url (won't render as img)
      }
      offscreen.remove();
    }, { once: true });

    // Safety timeout
    setTimeout(() => {
      if (!posterCache[glbUrl]) {
        console.warn("poster render timed out for", glbUrl);
        resolve("");
        offscreen.remove();
      }
    }, 8000);
  });
}

/* Tap to place — attached once on boot */
function attachArSurface() {
  const surface = document.getElementById("arSurface");
  surface.addEventListener("click", (e) => {
    if (state.currentScreen !== "practice") return;
    if (state.placedAt) return;

    const rect = surface.getBoundingClientRect();
    const xRel = (e.clientX - rect.left) / rect.width;
    const yRel = (e.clientY - rect.top) / rect.height;

    state.placedAt = { x: xRel, y: yRel };
    const placedImg = document.getElementById("arPlaced");
    placedImg.style.left = (xRel * 100) + "%";
    placedImg.style.top = (yRel * 100) + "%";
    placedImg.style.display = "block";
    requestAnimationFrame(() => placedImg.classList.add("show"));
    document.getElementById("arTapHint").classList.add("hidden");

    setTimeout(() => evaluatePlacement(xRel, yRel), 700);
  });
}

/* ============================================================
   Placement evaluation — height-based since we use real camera
   ============================================================ */
function evaluatePlacement(x, y) {
  const cat = CATALOG.categories.find(c => c.id === state.selectedCategory);
  const variant = cat.variants.find(v => v.id === state.selectedVariant);
  let result;

  if (cat.id === "extinguisher") {
    if (y < 0.18) {
      result = { score: 25, title: "Mounted too high", body: "Above 1.5 m the handle is hard to reach in a panic. Lower it to chest height." };
    } else if (y > 0.82) {
      result = { score: 35, title: "On the floor", body: "Floor placement gets kicked, hidden under bags, and forgotten. Always wall-mount fire extinguishers." };
    } else if (y >= 0.35 && y <= 0.65) {
      result = { score: 100, title: "Excellent placement", body: "Right at chest height — anyone in the room can grab it in seconds. Textbook." };
    } else if (y < 0.35) {
      result = { score: 70, title: "A bit high", body: "Slightly above ideal. Bringing it down a notch makes it easier to grab in a hurry." };
    } else {
      result = { score: 70, title: "A bit low", body: "Workable, but the handle is below comfortable grab height. Aim higher next time." };
    }
  } else if (cat.id === "bucket") {
    if (y < 0.5) {
      result = { score: 15, title: "Too high to reach quickly", body: "A water bucket above shoulder height risks spills and is slow to deploy. Keep it on the floor." };
    } else if (y > 0.75) {
      result = { score: 95, title: "Floor-level — perfect", body: "Buckets belong on the floor near the workshop area. Quick to grab, no lifting required." };
    } else {
      result = { score: 60, title: "Acceptable", body: "Workable, but a water bucket is best on the floor. Move it lower." };
    }
  } else {
    result = { score: 60, title: "Placed", body: "Have a look at the hints to refine the placement." };
  }

  result.variantId = variant.id;
  result.x = x;
  result.y = y;
  state.results[cat.id] = result;
  showFeedback(result);
}

function showFeedback(result) {
  const overlay = document.getElementById("feedbackOverlay");
  const icon = document.getElementById("feedbackIcon");
  const title = document.getElementById("feedbackTitle");
  const body = document.getElementById("feedbackBody");

  let cls, svg;
  if (result.score >= 70) {
    cls = "success";
    svg = `<svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  } else if (result.score >= 40) {
    cls = "partial";
    svg = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 7v6M12 16v.01" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  } else {
    cls = "fail";
    svg = `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  }
  icon.className = `overlay-icon ${cls}`;
  icon.innerHTML = svg;
  title.textContent = result.title;
  body.textContent = result.body + ` (Score: ${result.score}/100)`;
  showOverlay("feedbackOverlay");
}

/* ============================================================
   Overlays
   ============================================================ */
function showOverlay(id) {
  document.querySelectorAll(".overlay").forEach(o => o.classList.remove("show"));
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
}

document.getElementById("feedbackContinue").addEventListener("click", () => {
  showOverlay(null);
  go("category-select");
});
document.getElementById("feedbackRetry").addEventListener("click", () => {
  showOverlay(null);
  delete state.results[state.selectedCategory];
  document.getElementById("arResetBtn").click();
});
document.getElementById("helpClose").addEventListener("click", () => showOverlay(null));
document.querySelectorAll(".overlay").forEach(o => {
  o.addEventListener("click", (e) => {
    if (e.target === o && o.id === "helpOverlay") showOverlay(null);
  });
});

/* ============================================================
   Complete
   ============================================================ */
function renderComplete() {
  const ids = Object.keys(state.results);
  const count = ids.length;
  const avg = count ? Math.round(ids.reduce((s, id) => s + state.results[id].score, 0) / count) : 0;
  document.getElementById("completeCount").textContent = count;
  document.getElementById("completeScore").textContent = avg + "%";

  const row = document.getElementById("scoreRow");
  row.innerHTML = CATALOG.categories.map(cat => {
    const r = state.results[cat.id];
    if (!r) {
      return `<div class="score-cell" style="opacity:0.4">
        <div style="height:50px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:24px;">·</div>
        <div class="pct">—</div>
      </div>`;
    }
    const variant = cat.variants.find(v => v.id === r.variantId);
    const cls = r.score >= 70 ? "good" : r.score >= 40 ? "warn" : "bad";
    return `<div class="score-cell ${cls}">
      ${makeThumbViewer(variant, "score-" + cat.id)}
      <div class="pct">${r.score}%</div>
    </div>`;
  }).join("");

  CATALOG.categories.forEach(cat => {
    const r = state.results[cat.id];
    if (!r) return;
    const variant = cat.variants.find(v => v.id === r.variantId);
    hydrateThumb(variant, "score-" + cat.id);
  });
}

/* ============================================================
   Boot
   ============================================================ */
attachArSurface();
go("splash");

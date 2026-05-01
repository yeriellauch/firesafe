/* ============================================================
   FireSafe — app logic
   ------------------------------------------------------------
   Single-page state machine. Six screens, one feedback overlay,
   one help modal. Placement evaluation is zone-based: each item
   has a list of normalised rectangles (0–1 coords) with a score
   and reason. The first matching zone wins.
   ============================================================ */

const CATALOG = {
  categories: [
    {
      id: "extinguisher",
      name: "Fire extinguisher",
      desc: "Hand-held suppression unit",
      thumb: "assets/img/icon_extinguisher_modern.svg",
      hints: [
        { title: "Hint 1", text: "Mount fire extinguishers where they are highly visible and quickly reachable from any seat in the room." },
        { title: "Hint 2", text: "Keep them clear of obstructions like cabinets, doors, or curtains — every second matters in an emergency." },
        { title: "Hint 3", text: "The recommended mounting height is between 90 cm and 150 cm above the floor (handle height for an average adult)." }
      ],
      variants: [
        {
          id: "classic",
          name: "Classic powder",
          icon: "assets/img/icon_extinguisher_classic.svg",
          modelUSDZ: "assets/models/extinguisher_classic.obj",
          fireClass: "Class A·B·C — dry powder"
        },
        {
          id: "modern",
          name: "Modern CO₂",
          icon: "assets/img/icon_extinguisher_modern.svg",
          modelUSDZ: "assets/models/extinguisher_modern.usdz",
          fireClass: "Class B·C — electrical-safe"
        },
        {
          id: "bronze",
          name: "Vintage brass",
          icon: "assets/img/icon_extinguisher_bronze.svg",
          modelUSDZ: "assets/models/extinguisher_bronze.usdz",
          fireClass: "Heritage display piece"
        }
      ]
    },
    {
      id: "bucket",
      name: "Water bucket",
      desc: "Traditional fire-water station",
      thumb: "assets/img/icon_water_bucket.svg",
      hints: [
        { title: "Hint 1", text: "Water buckets are best placed near workshop areas where Class-A combustibles (paper, wood, fabric) are present." },
        { title: "Hint 2", text: "Never place a water bucket near electrical outlets or live equipment — water conducts electricity." }
      ],
      variants: [
        {
          id: "bucket_red",
          name: "Standard bucket",
          icon: "assets/img/icon_water_bucket.svg",
          modelUSDZ: "assets/models/water_bucket.usdz",
          fireClass: "Class A — solids only"
        }
      ]
    }
  ]
};

/* Placement zones — coordinates are relative (0–1) of the AR surface.
   Lower x = left, lower y = top. Each item type defines its own zones
   so the same tap can be ideal for one item and bad for another. */
const ZONES = {
  extinguisher: [
    { x1: 0.05, y1: 0.13, x2: 0.36, y2: 0.36, score: 10, verdict: "fail",
      title: "On the window",
      body: "You placed the extinguisher on the window. Windows are emergency exits and shouldn't be blocked. Try a clear wall section instead." },
    { x1: 0.44, y1: 0.16, x2: 0.94, y2: 0.33, score: 15, verdict: "fail",
      title: "Mounted on the blackboard",
      body: "The blackboard is in active use — extinguishers there will be moved or removed. Pick a permanent wall surface." },
    { x1: 0.76, y1: 0.39, x2: 0.95, y2: 0.74, score: 20, verdict: "fail",
      title: "Blocking the door",
      body: "Mounting on a door is a major hazard — the unit moves whenever the door swings, and the door becomes a chokepoint." },
    { x1: 0.10, y1: 0.55, x2: 0.40, y2: 0.78, score: 30, verdict: "warn",
      title: "On the desk",
      body: "Putting it on a desk is convenient now, but it'll be moved within a week. Mount it on the wall so it stays put." },
    { x1: 0.55, y1: 0.40, x2: 0.74, y2: 0.65, score: 100, verdict: "ok",
      title: "Excellent placement",
      body: "Right at chest height, on a clear wall, near the exit and visible from anywhere in the room. Textbook." },
    { x1: 0.40, y1: 0.40, x2: 0.55, y2: 0.55, score: 90, verdict: "ok",
      title: "Good placement",
      body: "Clear wall and accessible. Slightly further from the exit than ideal, but well within standards." },
    { x1: 0.0, y1: 0.0,  x2: 1.0, y2: 0.18, score: 25, verdict: "warn",
      title: "Mounted too high",
      body: "Above 1.5 m, the handle is hard to reach in a panic. Lower it to chest height." },
    { x1: 0.0, y1: 0.85, x2: 1.0, y2: 1.0,  score: 35, verdict: "warn",
      title: "On the floor",
      body: "Floor placement gets kicked, hidden under bags, and forgotten. Always wall-mounted." }
  ],
  bucket: [
    { x1: 0.42, y1: 0.66, x2: 0.50, y2: 0.72, score: 5,  verdict: "fail",
      title: "Right next to the outlet",
      body: "Water and electrical outlets don't mix — this would create a real shock hazard. Move it well clear of any sockets." },
    { x1: 0.10, y1: 0.55, x2: 0.40, y2: 0.78, score: 80, verdict: "ok",
      title: "Solid choice",
      body: "Near a workspace where paper and wood are common — this is exactly what a water bucket is for." },
    { x1: 0.0, y1: 0.85, x2: 1.0, y2: 1.0, score: 90, verdict: "ok",
      title: "Floor-level — perfect",
      body: "Buckets belong on the floor, ideally near the workshop area. Quick to grab, no lifting required." },
    { x1: 0.0, y1: 0.0, x2: 1.0, y2: 0.5, score: 15, verdict: "fail",
      title: "Too high to reach quickly",
      body: "A water bucket above shoulder height risks spills and is slow to deploy. Keep it on the floor." }
  ]
};

const DEFAULT_VERDICT = {
  score: 60, verdict: "warn",
  title: "Acceptable",
  body: "It works, but it's not where a fire-safety officer would put it. Have another look at the hints and try a different spot."
};

/* ============================================================
   App state
   ============================================================ */
const state = {
  currentScreen: "splash",
  selectedCategory: null,
  selectedVariant: null,
  placedAt: null,         // {x, y} normalised
  results: {},            // categoryId -> { score, verdict, title, body, variantId, x, y }
  pendingResult: null     // last evaluation, used by feedback overlay
};

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
  }
  next.classList.add("active");
  state.currentScreen = screenId;

  // Hooks per screen
  if (screenId === "category-select") renderCategoryGrid();
  if (screenId === "item-select") renderItemSelect();
  if (screenId === "ar") renderArScreen();
  if (screenId === "complete") renderComplete();
}

document.addEventListener("click", (e) => {
  const tgt = e.target.closest("[data-go]");
  if (tgt) {
    e.preventDefault();
    go(tgt.dataset.go);
  }
  const modalTrigger = e.target.closest("[data-modal]");
  if (modalTrigger) {
    showOverlay(modalTrigger.dataset.modal === "help" ? "helpOverlay" : null);
  }
});

/* ============================================================
   Category grid
   ============================================================ */
function renderCategoryGrid() {
  const grid = document.getElementById("categoryGrid");
  grid.innerHTML = CATALOG.categories.map(cat => {
    const placed = state.results[cat.id];
    return `
      <button class="cat-card ${placed ? "placed" : ""}" data-cat="${cat.id}">
        <div class="cat-thumb"><img src="${cat.thumb}" alt=""></div>
        <p class="cat-name">${cat.name}</p>
        <p class="cat-desc">${cat.desc}</p>
      </button>
    `;
  }).join("");

  // Wire up category selection
  grid.querySelectorAll(".cat-card").forEach(card => {
    card.addEventListener("click", () => {
      state.selectedCategory = card.dataset.cat;
      go("item-select");
    });
  });

  // Progress text
  const placed = Object.keys(state.results).length;
  const total = CATALOG.categories.length;
  document.getElementById("progressText").textContent =
    placed === total
      ? `All ${total} placed — review or finish`
      : `${placed} of ${total} placed`;

  // If everything placed, show "Finish" pill action
  if (placed === total) {
    document.getElementById("progressText").innerHTML =
      `All ${total} placed · <a href="#" id="finishLink" style="color:#f4a261;font-weight:600">Finish lesson →</a>`;
    setTimeout(() => {
      const fl = document.getElementById("finishLink");
      if (fl) fl.addEventListener("click", (e) => { e.preventDefault(); go("complete"); });
    }, 0);
  }
}

/* ============================================================
   Item select (variants + hints)
   ============================================================ */
function renderItemSelect() {
  const cat = CATALOG.categories.find(c => c.id === state.selectedCategory);
  if (!cat) return;

  document.getElementById("itemSelectTitle").textContent = `Choose a ${cat.name.toLowerCase()}`;

  const hintStack = document.getElementById("hintStack");
  hintStack.innerHTML = cat.hints.map(h =>
    `<div class="hint-card"><h4>${h.title}</h4><p>${h.text}</p></div>`
  ).join("");

  const variantGrid = document.getElementById("variantGrid");
  // Adapt grid columns to count
  variantGrid.style.gridTemplateColumns = `repeat(${Math.min(cat.variants.length, 3)}, 1fr)`;

  variantGrid.innerHTML = cat.variants.map(v =>
    `<button class="variant-card" data-variant="${v.id}">
       <div class="variant-thumb"><img src="${v.icon}" alt=""></div>
       <span class="variant-name">${v.name}</span>
     </button>`
  ).join("");

  variantGrid.querySelectorAll(".variant-card").forEach(card => {
    card.addEventListener("click", () => {
      state.selectedVariant = card.dataset.variant;
      go("ar");
    });
  });
}

/* ============================================================
   AR placement screen
   ============================================================ */
function renderArScreen() {
  const cat = CATALOG.categories.find(c => c.id === state.selectedCategory);
  const variant = cat?.variants.find(v => v.id === state.selectedVariant);
  if (!cat || !variant) return;

  // Reset placement state
  state.placedAt = null;
  document.getElementById("arTapHint").classList.remove("hidden");
  const placedImg = document.getElementById("arPlaced");
  placedImg.classList.remove("show");
  placedImg.style.display = "none";

  // Title pill
  document.getElementById("arItemThumb").src = variant.icon;
  document.getElementById("arItemName").textContent = variant.name;
  document.getElementById("arHintName").textContent = variant.name.toLowerCase();
  placedImg.src = variant.icon;
  placedImg.alt = variant.name;

  // Wire AR Quick Look button (iOS only — opens the .usdz)
  const arBtn = document.getElementById("arViewArBtn");
  arBtn.onclick = () => {
    // Anchor with rel="ar" triggers AR Quick Look on iOS Safari.
    const a = document.createElement("a");
    a.setAttribute("rel", "ar");
    a.href = variant.modelUSDZ;
    const img = document.createElement("img");
    img.src = variant.icon;
    a.appendChild(img);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  };

  // Wire reset button
  document.getElementById("arResetBtn").onclick = () => {
    placedImg.classList.remove("show");
    placedImg.style.display = "none";
    state.placedAt = null;
    document.getElementById("arTapHint").classList.remove("hidden");
  };
}

/* Tap-to-place handler (attached once on load) */
function attachArSurface() {
  const surface = document.getElementById("arSurface");
  surface.addEventListener("click", (e) => {
    if (state.currentScreen !== "ar") return;
    if (state.placedAt) return; // already placed

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

    // Evaluate after small delay so the "drop" animation reads
    setTimeout(() => evaluatePlacement(xRel, yRel), 700);
  });
}

/* ============================================================
   Placement evaluation
   ============================================================ */
function evaluatePlacement(x, y) {
  const cat = CATALOG.categories.find(c => c.id === state.selectedCategory);
  const variant = cat.variants.find(v => v.id === state.selectedVariant);
  const zones = ZONES[cat.id] || [];
  let result = null;

  for (const z of zones) {
    if (x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2) {
      result = { ...z };
      break;
    }
  }
  if (!result) result = { ...DEFAULT_VERDICT };

  result.variantId = variant.id;
  result.x = x;
  result.y = y;

  // Save and show feedback
  state.results[cat.id] = result;
  state.pendingResult = result;
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
   Overlay management
   ============================================================ */
function showOverlay(id) {
  document.querySelectorAll(".overlay").forEach(o => o.classList.remove("show"));
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
}

document.getElementById("feedbackContinue").addEventListener("click", () => {
  showOverlay(null);
  // Return to category select to pick the next item
  go("category-select");
});
document.getElementById("feedbackRetry").addEventListener("click", () => {
  showOverlay(null);
  // Reset placement, stay on AR
  delete state.results[state.selectedCategory];
  document.getElementById("arResetBtn").click();
});
document.getElementById("helpClose").addEventListener("click", () => showOverlay(null));

// Click outside overlay-card to dismiss help
document.querySelectorAll(".overlay").forEach(o => {
  o.addEventListener("click", (e) => {
    if (e.target === o && o.id === "helpOverlay") showOverlay(null);
  });
});

/* ============================================================
   Complete screen
   ============================================================ */
function renderComplete() {
  const ids = Object.keys(state.results);
  const count = ids.length;
  const avg = count
    ? Math.round(ids.reduce((s, id) => s + state.results[id].score, 0) / count)
    : 0;
  document.getElementById("completeCount").textContent = count;
  document.getElementById("completeScore").textContent = avg + "%";

  const row = document.getElementById("scoreRow");
  row.innerHTML = CATALOG.categories.map(cat => {
    const r = state.results[cat.id];
    if (!r) {
      return `<div class="score-cell" style="opacity:0.4">
        <img src="${cat.thumb}" alt=""><div class="pct">—</div>
      </div>`;
    }
    const variant = cat.variants.find(v => v.id === r.variantId);
    const cls = r.score >= 70 ? "good" : r.score >= 40 ? "warn" : "bad";
    return `<div class="score-cell ${cls}">
      <img src="${variant.icon}" alt=""><div class="pct">${r.score}%</div>
    </div>`;
  }).join("");
}

/* ============================================================
   Boot
   ============================================================ */
attachArSurface();
go("splash");

// Live model with measured dimensions.
const mv = document.querySelector("#hero-model");
const svg = document.querySelector("#dim-lines");
const stage = document.querySelector(".stage");
const unitButtons = document.querySelectorAll("[data-unit]");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let size = null;
let unit = "cm";

const LINES = [
  ["hotspot-dot+X-Y+Z", "hotspot-dot+X-Y-Z", "hotspot-dim+X-Y"],
  ["hotspot-dot+X-Y-Z", "hotspot-dot+X+Y-Z", "hotspot-dim+X-Z"],
  ["hotspot-dot+X+Y-Z", "hotspot-dot-X+Y-Z", "hotspot-dim+Y-Z"],
  ["hotspot-dot-X+Y-Z", "hotspot-dot-X-Y-Z", "hotspot-dim-X-Z"],
  ["hotspot-dot-X-Y-Z", "hotspot-dot-X-Y+Z", "hotspot-dim-X-Y"],
];

function fmt(m) {
  return unit === "cm" ? `${(m * 100).toFixed(1)} cm` : `${(m / 0.0254).toFixed(2)} in`;
}

function setLabels() {
  if (!size) return;
  const text = { "hotspot-dim+X-Y": size.z, "hotspot-dim-X-Y": size.z, "hotspot-dim+X-Z": size.y,
    "hotspot-dim-X-Z": size.y, "hotspot-dim+Y-Z": size.x };
  for (const [slot, value] of Object.entries(text)) {
    const el = mv.querySelector(`[slot="${slot}"]`);
    if (el) el.textContent = fmt(value);
  }
}

function draw() {
  const lines = svg.querySelectorAll("line");
  LINES.forEach(([a, b, label], i) => {
    const p = mv.queryHotspot(a);
    const q = mv.queryHotspot(b);
    const l = mv.queryHotspot(label);
    const line = lines[i];
    if (!p || !q) return;
    line.setAttribute("x1", p.canvasPosition.x);
    line.setAttribute("y1", p.canvasPosition.y);
    line.setAttribute("x2", q.canvasPosition.x);
    line.setAttribute("y2", q.canvasPosition.y);
    const hidden = l && !l.facingCamera;
    line.classList.toggle("hide", hidden);
    const tag = mv.querySelector(`[slot="${label}"]`);
    if (tag) tag.classList.toggle("hide", hidden);
  });
}

function place() {
  const c = mv.getBoundingBoxCenter();
  size = mv.getDimensions();
  const x2 = size.x / 2, y2 = size.y / 2, z2 = size.z / 2;
  const at = (name, x, y, z) => mv.updateHotspot({ name, position: `${x} ${y} ${z}` });
  at("hotspot-dot+X-Y+Z", c.x + x2, c.y - y2, c.z + z2);
  at("hotspot-dim+X-Y", c.x + x2 * 1.25, c.y - y2 * 1.06, c.z);
  at("hotspot-dot+X-Y-Z", c.x + x2, c.y - y2, c.z - z2);
  at("hotspot-dim+X-Z", c.x + x2 * 1.4, c.y, c.z - z2 * 1.2);
  at("hotspot-dot+X+Y-Z", c.x + x2, c.y + y2, c.z - z2);
  at("hotspot-dim+Y-Z", c.x, c.y + y2 * 1.07, c.z - z2 * 1.2);
  at("hotspot-dot-X+Y-Z", c.x - x2, c.y + y2, c.z - z2);
  at("hotspot-dim-X-Z", c.x - x2 * 1.4, c.y, c.z - z2 * 1.2);
  at("hotspot-dot-X-Y-Z", c.x - x2, c.y - y2, c.z - z2);
  at("hotspot-dim-X-Y", c.x - x2 * 1.25, c.y - y2 * 1.06, c.z);
  at("hotspot-dot-X-Y+Z", c.x - x2, c.y - y2, c.z + z2);
  setLabels();
}

function measureIn() {
  // One moment on load: the dimension lines draw themselves, then the tags appear.
  requestAnimationFrame(() => {
    draw();
    if (!reduced) {
      svg.querySelectorAll("line").forEach((line) => {
        const len = Math.hypot(line.x2.baseVal.value - line.x1.baseVal.value, line.y2.baseVal.value - line.y1.baseVal.value);
        line.style.setProperty("--len", Math.ceil(len) + 2);
      });
      svg.classList.add("drawing");
      setTimeout(() => svg.classList.remove("drawing"), 1400);
    }
    stage.classList.add("measured");
  });
}

if (mv && svg) {
  mv.addEventListener("load", () => {
    place();
    measureIn();
    mv.addEventListener("camera-change", () => {
      svg.classList.remove("drawing");
      draw();
    });
  });
  window.addEventListener("resize", () => size && draw());
}

unitButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    unit = btn.dataset.unit;
    unitButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    setLabels();
    document.querySelectorAll("[data-m]").forEach((el) => {
      const parts = el.dataset.m.split(" ").map(Number);
      el.textContent = parts.map((m) => fmt(m).replace(/ (cm|in)$/, "")).join(" × ") + (unit === "cm" ? " cm" : " in");
    });
  });
});

// Scene Viewer sends the visitor back here when the phone can't run AR.
const arNote = document.querySelector("#ar-note");
if (mv && arNote) {
  mv.addEventListener("ar-status", (e) => {
    if (e.detail.status === "failed") arNote.hidden = false;
  });
}

// "Check your own file": runs the add-on's checks in the browser.
import { inspect, check, overall, remedy, realSize, texturesLine, PROFILES } from "./checker-core.js";
import { mark } from "./compare.js";

const root = document.querySelector("#checker");
const drop = root.querySelector(".drop");
const input = root.querySelector("#file");
const out = root.querySelector(".result");
const err = root.querySelector(".result-error");
const live = root.querySelector("#checker-live");
const platformButtons = root.querySelectorAll("[data-platform]");

let platform = "amazon";
let current = null; // { name, stats }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const HOW = {
  auto: "Fixed automatically",
  setting: "Fixed with one setting",
  partial: "Fixed on closed meshes",
  manual: "Needs your attention",
};
const HOW_DETAIL = {
  SCALE_PLAUSIBLE: "Set the units the model was built in, or enter its real height.",
  DOUBLE_SIDED: "Open surfaces, like a leaf or a label, stay double-sided.",
  MATERIAL_COUNT: "A recommendation. Merging materials is a modeling decision the add-on leaves to you.",
  ORM_PACKED: "A recommendation. Pack occlusion into the red channel of the metallic-roughness map.",
  TEX_MISSING: "Re-link or re-export the missing textures.",
  EMPTY: "The file has nothing to show.",
  FILE_GLB: "Export the model again from your 3D app.",
};

function fmtMB(bytes) {
  return (bytes / 1e6).toFixed(2) + " MB";
}

function sizeText(stats) {
  const s = realSize(stats);
  if (!s) return ["unknown", ""];
  const cm = [s.w, s.d, s.h].map((m) => (m * 100).toFixed(1)).join(" × ") + " cm";
  const inch = [s.w, s.d, s.h].map((m) => (m / 0.0254).toFixed(2)).join(" × ") + " in";
  return [cm, inch];
}

function verdictText(status, label) {
  if (status === "fail") return `Not ready for ${label}`;
  if (status === "warn") return `Ready for ${label}, with recommendations`;
  return `Ready for ${label}`;
}

function render() {
  if (!current) return;
  const { name, stats } = current;
  const prof = PROFILES[platform];
  const results = check(stats, prof);
  const status = overall(results);
  const open = results.filter((r) => r.status !== "pass");
  const passed = results.filter((r) => r.status === "pass");
  const fails = open.filter((r) => r.status === "fail").length;
  const warns = open.length - fails;
  const counts = { auto: 0, setting: 0, manual: 0 };
  for (const r of open) {
    const how = remedy(r.code, stats);
    counts[how === "partial" ? "manual" : how] += 1;
  }
  const [cm, inch] = sizeText(stats);

  let summary;
  if (!open.length) summary = `All ${results.length} checks pass.`;
  else if (fails && warns) summary = `${plural(fails, "check fails", "checks fail")} and ${plural(warns, "needs", "need")} a look.`;
  else if (fails) summary = `${plural(fails, "check fails", "checks fail")}.`;
  else summary = `${plural(warns, "recommendation", "recommendations")} to look at. The file will be accepted.`;

  const rows = open.map((r) => {
    const how = remedy(r.code, stats);
    const detail = HOW_DETAIL[r.code] && how !== "auto" ? `<span class="sub">${esc(HOW_DETAIL[r.code])}</span>` : "";
    return `<tr><td>${mark(r.status)}</td>` +
      `<td><b>${esc(r.label)}</b>${r.message ? `<span class="sub">${esc(r.message)}</span>` : ""}</td>` +
      `<td class="num">${esc(r.value)}</td><td class="req">${esc(r.limit || "")}</td>` +
      `<td><span class="how ${how}">${HOW[how]}</span>${detail}</td></tr>`;
  }).join("");

  out.innerHTML = `
    <div class="result-head">
      <h3>${esc(name)}</h3>
      <span class="verdict ${status}">${verdictText(status, prof.label)}</span>
    </div>
    <p>${summary}</p>
    <dl class="facts">
      <div><dt>Triangles</dt><dd>${stats.triangles.toLocaleString("en-US")}</dd></div>
      <div><dt>File size</dt><dd>${fmtMB(stats.file_bytes)}</dd></div>
      <div><dt>Textures</dt><dd>${esc(texturesLine(stats))}</dd></div>
      <div><dt>Size (W × D × H)</dt><dd>${cm}<br><span class="muted small">${inch}</span></dd></div>
    </dl>
    ${open.length ? `
    <div class="remedy" aria-label="What Commerce-Ready 3D does about these">
      <div class="auto"><b>${counts.auto}</b><span>fixed automatically by Commerce-Ready 3D</span></div>
      <div class="setting"><b>${counts.setting}</b><span>fixed with one setting in the add-on</span></div>
      <div class="manual"><b>${counts.manual}</b><span>need your attention</span></div>
    </div>
    <table class="rtable">
      <thead><tr><th><span class="visually-hidden">Result</span></th><th>Check</th><th>Found</th><th>Requirement</th><th>In the add-on</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : ""}
    ${passed.length ? `
    <details class="passed"><summary>Show the ${plural(passed.length, "check", "checks")} that pass</summary>
      <ul class="checks">${passed.map((r) => `<li>${mark("pass")}<span>${esc(r.label)}</span><span class="val">${esc(r.value)}</span></li>`).join("")}</ul>
    </details>` : ""}
    <p class="checker-foot">${platform === "amazon"
      ? "Amazon publishes its exact 3D limits in Seller Central, which needs a seller login. These checks use the publicly reported values."
      : "Shopify's values come from its published 3D model standards checklist."}</p>`;
  out.hidden = false;
  err.hidden = true;
  live.textContent = `${name}: ${verdictText(status, prof.label)}. ${summary}`;
}

function showError(message) {
  out.hidden = true;
  err.hidden = false;
  err.innerHTML = message;
  live.textContent = err.textContent;
}

async function run(name, getBuffer) {
  live.textContent = `Reading ${name}…`;
  const lower = name.toLowerCase();
  if (lower.endsWith(".gltf")) {
    return showError(`<b>${esc(name)}</b> is a .gltf file, which keeps geometry and textures in separate files. ` +
      "Export it as glTF Binary (.glb) to check it here. Marketplaces ask for .glb as well.");
  }
  if (/\.(fbx|obj|stl|ply|usd|usda|usdc|usdz|blend|3ds|dae|max|c4d)$/.test(lower)) {
    return showError(`<b>${esc(name)}</b> isn't a GLB file. This page checks .glb files. ` +
      "The add-on itself opens FBX, OBJ, STL, PLY, USD and .blend files in Blender and exports a GLB.");
  }
  let buf;
  try {
    buf = await getBuffer();
  } catch (e) {
    return showError(`The file couldn't be read: ${esc(e.message)}`);
  }
  const stats = inspect(buf, name);
  if (!stats.container) {
    return showError(`<b>${esc(name)}</b> can't be read as a GLB: ${esc(stats.errors.join("; "))}. ` +
      "In Blender, use File &rsaquo; Export &rsaquo; glTF 2.0 and choose the glTF Binary (.glb) format.");
  }
  current = { name, stats };
  render();
  out.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
}

function useFile(file) {
  if (file) run(file.name, () => file.arrayBuffer());
}

root.querySelector("#pick").addEventListener("click", () => input.click());
input.addEventListener("change", () => useFile(input.files[0]));
root.querySelector("#sample").addEventListener("click", () => {
  const url = root.querySelector("#sample").dataset.src;
  run("avocado_from_studio.glb", async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.arrayBuffer();
  });
});

["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => {
  e.preventDefault();
  drop.classList.add("over");
}));
["dragleave", "dragend"].forEach((t) => drop.addEventListener(t, (e) => {
  if (!drop.contains(e.relatedTarget)) drop.classList.remove("over");
}));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  useFile(e.dataTransfer.files[0]);
});

platformButtons.forEach((b) => b.addEventListener("click", () => {
  platform = b.dataset.platform;
  platformButtons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  render();
}));

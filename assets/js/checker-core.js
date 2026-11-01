// SPDX-License-Identifier: GPL-3.0-or-later
// Commerce-Ready 3D checker for the browser.
// A line-by-line port of the add-on's glb_inspect.py and profiles.py, so a
// file checked here gets the same results as in Blender.

export const PROFILE_VERSION = "2026.11.1";

export const PROFILES = {
  amazon: {
    id: "amazon",
    label: "Amazon",
    long_label: "Amazon (View in 3D, View in Your Room)",
    limits: {
      max_triangles: 200000, texture_min: 2048, texture_max: 4096, texture_square: true, texture_pot: true,
      texture_mimes: ["image/png", "image/jpeg"], target_file_mb: 0, max_file_mb: 0,
      allowed_extensions: ["KHR_materials_transmission", "KHR_texture_transform"],
      max_objects: 0, max_materials: 0, min_dimension_m: 0.01, max_dimension_m: 10.0,
      ground_tolerance_m: 0.001, center_tolerance_m: 0.005,
    },
    rules: {
      FILE_GLB: "fail", EMPTY: "fail", TRIANGLES: "fail", TEX_FORMAT: "fail", TEX_MAX: "fail", TEX_MIN: "fail",
      TEX_SQUARE: "fail", TEX_POT: "fail", TEX_MISSING: "fail", BASECOLOR_TEXTURE: "fail", METALROUGH_TEXTURE: "fail",
      ANIMATIONS: "fail", CAMERAS: "fail", LIGHTS: "fail", SKINS: "fail", MORPH_TARGETS: "fail", EXTENSIONS: "fail",
      EXTENSIONS_REQUIRED: "fail", GROUNDED: "fail", CENTERED: "fail", SCALE_PLAUSIBLE: "warn", DOUBLE_SIDED: "warn",
    },
  },
  shopify: {
    id: "shopify",
    label: "Shopify",
    long_label: "Shopify (3D models and AR)",
    limits: {
      max_triangles: 0, texture_min: 0, texture_max: 2048, texture_square: false, texture_pot: false,
      texture_mimes: ["image/png", "image/jpeg"], target_file_mb: 4.0, max_file_mb: 0,
      allowed_extensions: null, max_objects: 1, max_materials: 1, min_dimension_m: 0.01, max_dimension_m: 10.0,
      ground_tolerance_m: 0.001, center_tolerance_m: 0.005,
    },
    rules: {
      FILE_GLB: "fail", EMPTY: "fail", TEX_MISSING: "fail", TEX_FORMAT: "warn", TEX_MAX: "warn",
      FILE_SIZE_TARGET: "warn", ANIMATIONS: "warn", CAMERAS: "warn", LIGHTS: "warn", GROUNDED: "warn",
      CENTERED: "warn", OBJECT_COUNT: "warn", MATERIAL_COUNT: "warn", ORM_PACKED: "warn", SCALE_PLAUSIBLE: "warn",
    },
  },
};

export const LABELS = {
  FILE_GLB: "Binary glTF 2.0 (GLB)", EMPTY: "Contains geometry", TRIANGLES: "Triangle count",
  TEX_MISSING: "All textures readable", TEX_FORMAT: "Texture formats", TEX_MAX: "Texture maximum size",
  TEX_MIN: "Texture minimum size", TEX_SQUARE: "Square textures", TEX_POT: "Power-of-two textures",
  BASECOLOR_TEXTURE: "Base color texture on every material",
  METALROUGH_TEXTURE: "Metallic-roughness texture on every material",
  ANIMATIONS: "No animations", CAMERAS: "No cameras", LIGHTS: "No lights", SKINS: "No rigs (skins)",
  MORPH_TARGETS: "No morph targets", EXTENSIONS: "Allowed glTF extensions only",
  EXTENSIONS_REQUIRED: "No required extensions", FILE_SIZE_TARGET: "File size", FILE_SIZE_MAX: "File size limit",
  GROUNDED: "Rests on the ground (Y = 0)", CENTERED: "Centered on the origin",
  SCALE_PLAUSIBLE: "Plausible real-world size", DOUBLE_SIDED: "Single-sided materials", OBJECT_COUNT: "Objects",
  MATERIAL_COUNT: "Materials", ORM_PACKED: "Occlusion packed into the metallic-roughness map",
};

const ORDER = [
  "FILE_GLB", "EMPTY", "TRIANGLES", "FILE_SIZE_MAX", "FILE_SIZE_TARGET",
  "TEX_MISSING", "TEX_FORMAT", "TEX_MAX", "TEX_MIN", "TEX_SQUARE", "TEX_POT",
  "BASECOLOR_TEXTURE", "METALROUGH_TEXTURE", "ORM_PACKED",
  "ANIMATIONS", "CAMERAS", "LIGHTS", "SKINS", "MORPH_TARGETS",
  "EXTENSIONS", "EXTENSIONS_REQUIRED",
  "GROUNDED", "CENTERED", "SCALE_PLAUSIBLE",
  "OBJECT_COUNT", "MATERIAL_COUNT", "DOUBLE_SIDED",
];

const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const MB = 1000000;

export class GLTFError extends Error {}

// ---------------------------------------------------------------------------
// Number formatting that matches Python's round() and "%" formatting
// ---------------------------------------------------------------------------

function pyRound(x, nd) {
  if (!Number.isFinite(x)) return x;
  const a = Math.abs(x);
  if (a >= 1e21) return x;
  const exact = a.toFixed(Math.min(100, nd + 30));
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + nd);
  const tie = tail[0] === "5" && /^0*$/.test(tail.slice(1));
  if (!tie) return Number(x.toFixed(nd));
  // Exactly halfway: round half to even, like Python.
  const digits = BigInt(exact.slice(0, dot) + exact.slice(dot + 1, dot + 1 + nd));
  const rounded = digits % 2n === 0n ? digits : digits + 1n;
  let s = rounded.toString().padStart(nd + 1, "0");
  s = nd ? s.slice(0, s.length - nd) + "." + s.slice(s.length - nd) : s;
  return x < 0 ? -Number(s) : Number(s);
}

function pyFixed(x, nd) {
  const r = pyRound(x, nd);
  const s = r.toFixed(nd);
  return Object.is(r, -0) || (r === 0 && x < 0) ? "-" + s.replace(/^-/, "") : s;
}

function pyG(x) {
  if (x === 0) return "0";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : x < 0 ? "-inf" : "nan";
  const [mant0, exp0] = x.toExponential(5).split("e");
  const e = Number(exp0);
  if (e < -4 || e >= 6) {
    const mant = mant0.includes(".") ? mant0.replace(/0+$/, "").replace(/\.$/, "") : mant0;
    return mant + "e" + (e < 0 ? "-" : "+") + String(Math.abs(e)).padStart(2, "0");
  }
  const s = x.toFixed(Math.max(0, 5 - e));
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function fmtInt(n) {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtMB(b) {
  return pyFixed(b / MB, 2) + " MB";
}

function z4(v) {
  const r = pyRound(v, 4);
  return r === 0 ? 0 : r;
}

function fmtDims(d) {
  // glTF axes: X width, Y height, Z depth.
  return `${pyFixed(d[0], 3)} x ${pyFixed(d[2], 3)} x ${pyFixed(d[1], 3)} m (W x D x H)`;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const utf8 = new TextDecoder("utf-8", { fatal: true });

export function load(arrayBuffer) {
  const u8 = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  if (u8.length >= 4 && u8[0] === 0x67 && u8[1] === 0x6c && u8[2] === 0x54 && u8[3] === 0x46) {
    if (u8.length < 12) throw new GLTFError("GLB header is truncated");
    const version = dv.getUint32(4, true);
    const length = dv.getUint32(8, true);
    if (version !== 2) throw new GLTFError(`GLB container version ${version}, expected 2`);
    if (length !== u8.length) throw new GLTFError(`GLB header length ${length} does not match file size ${u8.length}`);
    let offset = 12;
    let js = null;
    let bin = null;
    while (offset + 8 <= u8.length) {
      const clen = dv.getUint32(offset, true);
      const ctype = dv.getUint32(offset + 4, true);
      offset += 8;
      const chunk = u8.subarray(offset, Math.min(offset + clen, u8.length));
      offset += clen;
      if (ctype === CHUNK_JSON && js === null) {
        try {
          js = JSON.parse(utf8.decode(chunk));
        } catch (e) {
          throw new GLTFError("The JSON part of the file is damaged: " + e.message);
        }
      } else if (ctype === CHUNK_BIN && bin === null) {
        bin = chunk;
      }
    }
    if (js === null) throw new GLTFError("GLB has no JSON chunk");
    return { gltf: js, bin, container: "glb" };
  }
  try {
    return { gltf: JSON.parse(utf8.decode(u8)), bin: null, container: "gltf" };
  } catch (e) {
    throw new GLTFError("Not a glTF or GLB file");
  }
}

function b64bytes(s) {
  const bin = atob(s.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

class Buffers {
  constructor(gltf, bin, external) {
    this.gltf = gltf;
    this.bin = bin;
    this.external = external || null; // Map of uri -> Uint8Array, for .gltf files with their parts
    this.cache = new Map();
  }
  uriBytes(uri) {
    if (uri.startsWith("data:")) return b64bytes(uri.slice(uri.indexOf(",") + 1));
    const key = decodeURIComponent(uri);
    if (this.external && this.external.has(key)) return this.external.get(key);
    throw new GLTFError(`external file "${key}" is not inside the GLB`);
  }
  buffer(index) {
    if (!this.cache.has(index)) {
      const buf = this.gltf.buffers[index];
      const uri = buf.uri;
      this.cache.set(index, uri === undefined || uri === null ? this.bin || new Uint8Array(0) : this.uriBytes(uri));
    }
    return this.cache.get(index);
  }
  view(index) {
    const bv = this.gltf.bufferViews[index];
    const data = this.buffer(bv.buffer);
    const start = bv.byteOffset || 0;
    return [data.subarray(start, start + bv.byteLength), bv.byteStride];
  }
  image(index) {
    const img = this.gltf.images[index];
    if ("bufferView" in img) return this.view(img.bufferView)[0];
    if (img.uri === undefined || img.uri === null) throw new GLTFError(`image ${index} has neither uri nor bufferView`);
    return this.uriBytes(img.uri);
  }
}

// ---------------------------------------------------------------------------
// Image headers
// ---------------------------------------------------------------------------

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const KTX2_SIG = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function startsWith(d, sig, at = 0) {
  if (d.length < at + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (d[at + i] !== sig[i]) return false;
  return true;
}

function ascii(d, a, b) {
  let s = "";
  for (let i = a; i < b && i < d.length; i++) s += String.fromCharCode(d[i]);
  return s;
}

function hasTRNS(d) {
  const n = Math.min(d.length, 4096) - 3;
  for (let i = 0; i < n; i++) if (d[i] === 0x74 && d[i + 1] === 0x52 && d[i + 2] === 0x4e && d[i + 3] === 0x53) return true;
  return false;
}

export function imageInfo(d) {
  if (startsWith(d, PNG_SIG) && d.length >= 26) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const w = dv.getUint32(16, false);
    const h = dv.getUint32(20, false);
    const ct = d[25];
    return ["image/png", w, h, ct === 4 || ct === 6 || hasTRNS(d)];
  }
  if (d.length >= 2 && d[0] === 0xff && d[1] === 0xd8) {
    let i = 2;
    const n = d.length;
    while (i + 9 < n) {
      if (d[i] !== 0xff) { i += 1; continue; }
      const marker = d[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
        i += marker !== 0xff ? 2 : 1;
        continue;
      }
      const seglen = (d[i + 2] << 8) | d[i + 3];
      if (SOF.has(marker)) {
        const h = (d[i + 5] << 8) | d[i + 6];
        const w = (d[i + 7] << 8) | d[i + 8];
        return ["image/jpeg", w, h, false];
      }
      i += 2 + seglen;
    }
    return ["image/jpeg", 0, 0, false];
  }
  if (ascii(d, 0, 4) === "RIFF" && ascii(d, 8, 12) === "WEBP" && d.length >= 30) {
    const kind = ascii(d, 12, 16);
    if (kind === "VP8 ") {
      return ["image/webp", (d[26] | (d[27] << 8)) & 0x3fff, (d[28] | (d[29] << 8)) & 0x3fff, false];
    }
    if (kind === "VP8L") {
      const b = d.subarray(21, 25);
      const w = 1 + (((b[1] & 0x3f) << 8) | b[0]);
      const h = 1 + (((b[3] & 0x0f) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6));
      return ["image/webp", w, h, Boolean(b[3] & 0x10)];
    }
    if (kind === "VP8X") {
      const w = 1 + (d[24] | (d[25] << 8) | (d[26] << 16));
      const h = 1 + (d[27] | (d[28] << 8) | (d[29] << 16));
      return ["image/webp", w, h, Boolean(d[20] & 0x10)];
    }
    return ["image/webp", 0, 0, false];
  }
  if (startsWith(d, KTX2_SIG) && d.length >= 28) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    return ["image/ktx2", dv.getUint32(20, true), dv.getUint32(24, true), false];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Matrices (row-major 4x4 as nested arrays)
// ---------------------------------------------------------------------------

function identity() {
  return [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
}

function mul(a, b) {
  const r = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[i][k] * b[k][j];
      r[i][j] = s;
    }
  return r;
}

function localMatrix(node) {
  if (node.matrix) {
    const m = node.matrix; // column-major
    return [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => m[c * 4 + r]));
  }
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  const r = [
    [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
    [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
    [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)],
  ];
  return [
    [r[0][0] * sx, r[0][1] * sy, r[0][2] * sz, tx],
    [r[1][0] * sx, r[1][1] * sy, r[1][2] * sz, ty],
    [r[2][0] * sx, r[2][1] * sy, r[2][2] * sz, tz],
    [0, 0, 0, 1],
  ];
}

function xform(m, [x, y, z]) {
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z + m[0][3],
    m[1][0] * x + m[1][1] * y + m[1][2] * z + m[1][3],
    m[2][0] * x + m[2][1] * y + m[2][2] * z + m[2][3],
  ];
}

function accessorMinMax(gltf, bufs, index) {
  const acc = gltf.accessors[index];
  if (acc.min && acc.max && acc.min.length >= 3) return [acc.min.slice(0, 3), acc.max.slice(0, 3)];
  if (acc.type !== "VEC3" || !("bufferView" in acc) || acc.componentType !== 5126) return null;
  const [data, stride0] = bufs.view(acc.bufferView);
  const stride = stride0 || 12;
  const base = acc.byteOffset || 0;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < acc.count; i++) {
    for (let k = 0; k < 3; k++) {
      const v = dv.getFloat32(base + i * stride + 4 * k, true);
      lo[k] = Math.min(lo[k], v);
      hi[k] = Math.max(hi[k], v);
    }
  }
  return [lo, hi];
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

function textureImage(gltf, texIndex) {
  const tex = (gltf.textures || [])[texIndex];
  if (tex === undefined) throw new RangeError("texture index out of range");
  if ("source" in tex) return tex.source;
  for (const ext of Object.values(tex.extensions || {})) {
    if (ext && typeof ext === "object" && !Array.isArray(ext) && "source" in ext) return ext.source;
  }
  return null;
}

function collectTextureRefs(obj, prefix, out) {
  if (Array.isArray(obj)) {
    for (const item of obj) collectTextureRefs(item, prefix, out);
  } else if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      if (key.endsWith("Texture") && value && typeof value === "object" && !Array.isArray(value) && "index" in value) {
        out.push([prefix + key, value.index]);
      } else if (value && typeof value === "object") {
        collectTextureRefs(value, prefix + (key !== "extensions" ? key + "." : ""), out);
      }
    }
  }
}

/**
 * Collect statistics about a GLB (or self-contained .gltf) file.
 * Never throws on content problems; they are listed in stats.errors.
 */
export function inspect(arrayBuffer, name = "model.glb", external = null) {
  const stats = {
    name, file_bytes: arrayBuffer.byteLength, container: null, version: null, generator: null, errors: [],
    triangles: 0, vertices: 0, primitives: 0, mesh_nodes: 0, nodes: 0, materials: [], materials_used: 0,
    primitives_without_material: 0, images: [], animations: 0, cameras: 0, skins: 0, morph_targets: 0, lights: 0,
    extensions_used: [], extensions_required: [], bbox_min: null, bbox_max: null, dimensions: null,
    bbox_complete: true,
  };
  let gltf, bin, container;
  try {
    ({ gltf, bin, container } = load(arrayBuffer));
  } catch (e) {
    stats.errors.push(e.message);
    return stats;
  }
  try {
    inspectInto(stats, gltf, bin, container, external);
  } catch (e) {
    stats.errors.push("The file structure is invalid: " + e.message);
  }
  return stats;
}

function inspectInto(stats, gltf, bin, container, external) {
  stats.container = container;
  const asset = gltf.asset || {};
  stats.version = asset.version ?? null;
  stats.generator = asset.generator ?? null;
  if (stats.version !== "2.0") stats.errors.push(`asset.version is ${JSON.stringify(stats.version)}, expected '2.0'`);
  stats.extensions_used = [...(gltf.extensionsUsed || [])];
  stats.extensions_required = [...(gltf.extensionsRequired || [])];
  stats.animations = (gltf.animations || []).length;
  stats.cameras = (gltf.cameras || []).length;
  stats.skins = (gltf.skins || []).length;
  stats.lights = ((((gltf.extensions || {}).KHR_lights_punctual) || {}).lights || []).length;
  const nodes = gltf.nodes || [];
  const meshes = gltf.meshes || [];
  const accessors = gltf.accessors || [];
  stats.nodes = nodes.length;
  const bufs = new Buffers(gltf, bin, external);

  const scenes = gltf.scenes || [];
  let roots;
  if (scenes.length) {
    roots = (scenes[gltf.scene ?? 0] || {}).nodes || [];
  } else {
    const children = new Set();
    for (const n of nodes) for (const c of n.children || []) children.add(c);
    roots = nodes.map((_, i) => i).filter((i) => !children.has(i));
  }

  const usedMaterials = new Set();
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const stack = roots.map((r) => [r, identity()]);
  let visited = 0;
  while (stack.length) {
    const [idx, parent] = stack.pop();
    visited += 1;
    if (visited > 100000) {
      stats.errors.push("node hierarchy too deep or cyclic");
      break;
    }
    const node = nodes[idx];
    if (!node) throw new RangeError(`node ${idx} does not exist`);
    const world = mul(parent, localMatrix(node));
    let instances = 1;
    const gpu = (node.extensions || {}).EXT_mesh_gpu_instancing;
    if (gpu && Object.keys(gpu).length) {
      const counts = Object.values(gpu.attributes || {}).map((a) => accessors[a].count);
      instances = counts.length ? Math.max(...counts) : 1;
    }
    if ("mesh" in node) {
      stats.mesh_nodes += instances;
      for (const prim of meshes[node.mesh].primitives || []) {
        stats.primitives += instances;
        const mode = prim.mode ?? 4;
        const attrs = prim.attributes || {};
        const pos = attrs.POSITION;
        const hasPos = pos !== undefined && pos !== null;
        const count = "indices" in prim ? accessors[prim.indices].count : hasPos ? accessors[pos].count : 0;
        let tris = 0;
        if (mode === 4) tris = Math.floor(count / 3);
        else if (mode === 5 || mode === 6) tris = Math.max(0, count - 2);
        stats.triangles += tris * instances;
        if (hasPos) {
          stats.vertices += accessors[pos].count * instances;
          let mm = null;
          try {
            mm = accessorMinMax(gltf, bufs, pos);
          } catch (e) {
            mm = null;
          }
          if (mm === null) {
            stats.bbox_complete = false;
          } else {
            const [[x0, y0, z0], [x1, y1, z1]] = mm;
            for (const c of [[x0, y0, z0], [x0, y0, z1], [x0, y1, z0], [x0, y1, z1],
              [x1, y0, z0], [x1, y0, z1], [x1, y1, z0], [x1, y1, z1]]) {
              const p = xform(world, c);
              for (let k = 0; k < 3; k++) {
                lo[k] = Math.min(lo[k], p[k]);
                hi[k] = Math.max(hi[k], p[k]);
              }
            }
          }
        }
        if (prim.targets && prim.targets.length) stats.morph_targets += 1;
        if ("material" in prim) usedMaterials.add(prim.material);
        else stats.primitives_without_material += 1;
      }
    }
    for (const child of node.children || []) stack.push([child, world]);
  }

  if (lo[0] !== Infinity) {
    stats.bbox_min = lo.map((v) => pyRound(v, 6));
    stats.bbox_max = hi.map((v) => pyRound(v, 6));
    stats.dimensions = [0, 1, 2].map((k) => pyRound(hi[k] - lo[k], 6));
  }

  const imageUses = new Map();
  (gltf.materials || []).forEach((mat, mi) => {
    const pbr = mat.pbrMetallicRoughness || {};
    const refs = [];
    collectTextureRefs(mat, "", refs);
    const imgOf = new Map();
    for (const [slot, texIndex] of refs) {
      let img = null;
      try {
        img = textureImage(gltf, texIndex);
      } catch (e) {
        img = null;
      }
      imgOf.set(slot, img);
      if (img !== null && img !== undefined) {
        if (!imageUses.has(img)) imageUses.set(img, new Set());
        imageUses.get(img).add(slot.split(".").pop());
      }
    }
    const occ = imgOf.has("occlusionTexture") ? imgOf.get("occlusionTexture") : null;
    const mr = imgOf.has("pbrMetallicRoughness.metallicRoughnessTexture")
      ? imgOf.get("pbrMetallicRoughness.metallicRoughnessTexture") : null;
    stats.materials.push({
      index: mi,
      name: "name" in mat ? mat.name : `material_${mi}`,
      used: usedMaterials.has(mi),
      base_color_texture: "baseColorTexture" in pbr,
      metal_rough_texture: "metallicRoughnessTexture" in pbr,
      normal_texture: "normalTexture" in mat,
      occlusion_texture: "occlusionTexture" in mat,
      emissive_texture: "emissiveTexture" in mat,
      orm_packed: occ === null || occ === undefined || occ === mr,
      double_sided: Boolean(mat.doubleSided),
      alpha_mode: mat.alphaMode || "OPAQUE",
      extensions: Object.keys(mat.extensions || {}).sort(),
    });
  });
  stats.materials_used = usedMaterials.size + (stats.primitives_without_material ? 1 : 0);

  (gltf.images || []).forEach((img, ii) => {
    const entry = {
      index: ii, name: img.name || img.uri || `image_${ii}`, mime: img.mimeType ?? null, width: 0, height: 0,
      bytes: 0, has_alpha: false, uses: [...(imageUses.get(ii) || [])].sort(), error: null,
    };
    try {
      const data = bufs.image(ii);
      entry.bytes = data.length;
      const info = imageInfo(data);
      if (info === null) entry.error = "unknown image format";
      else [entry.mime, entry.width, entry.height, entry.has_alpha] = info;
    } catch (e) {
      entry.error = e.message;
    }
    stats.images.push(entry);
  });
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const isPot = (n) => n > 0 && (n & (n - 1)) === 0;

function largest(imgs) {
  if (!imgs.length) return "no textures";
  let im = imgs[0];
  for (const i of imgs) if (Math.max(i.width, i.height) > Math.max(im.width, im.height)) im = i;
  return `largest ${im.width}x${im.height}`;
}

function smallest(imgs) {
  if (!imgs.length) return "no textures";
  let im = imgs[0];
  for (const i of imgs) if (Math.min(i.width, i.height) < Math.min(im.width, im.height)) im = i;
  return `smallest ${im.width}x${im.height}`;
}

const sizeList = (list) => list.map((im) => `${im.name} ${im.width}x${im.height}`).join(", ");

export function check(stats, profile) {
  const rules = profile.rules;
  const lim = profile.limits;
  const results = [];
  const add = (code, ok, value = "", limit = "", message = "") => {
    if (!(code in rules)) return;
    results.push({
      code, label: LABELS[code] || code, status: ok ? "pass" : rules[code],
      value, limit, message: ok ? "" : message,
    });
  };

  const usedImgs = stats.images.filter((im) => im.uses.length);
  const usedMats = stats.materials.filter((m) => m.used);

  add("FILE_GLB", stats.container === "glb" && !stats.errors.length, (stats.container || "unreadable").toUpperCase(),
    "GLB", stats.errors.join("; ") || "Export as binary glTF (.glb).");
  add("EMPTY", stats.triangles > 0, fmtInt(stats.triangles) + " triangles", "", "The file has no triangles.");

  const maxTris = lim.max_triangles || 0;
  if (maxTris) {
    add("TRIANGLES", stats.triangles <= maxTris, fmtInt(stats.triangles), "<= " + fmtInt(maxTris),
      `Reduce the triangle count to ${fmtInt(maxTris)} or fewer.`);
  }
  const maxMb = lim.max_file_mb || 0;
  if (maxMb) {
    add("FILE_SIZE_MAX", stats.file_bytes <= maxMb * MB, fmtMB(stats.file_bytes), `<= ${pyG(maxMb)} MB`,
      "The file is larger than the platform limit.");
  }
  const targetMb = lim.target_file_mb || 0;
  if (targetMb) {
    add("FILE_SIZE_TARGET", stats.file_bytes <= targetMb * MB, fmtMB(stats.file_bytes), `about ${pyG(targetMb)} MB`,
      "Larger than the recommended size; it may load slowly on phones.");
  }

  const broken = stats.images.filter((im) => im.error);
  add("TEX_MISSING", !broken.length, `${stats.images.length - broken.length} of ${stats.images.length} readable`, "",
    "Unreadable textures: " + broken.map((im) => `${im.name} (${im.error})`).join(", "));

  const mimes = lim.texture_mimes || [];
  const badFmt = usedImgs.filter((im) => mimes.length && !mimes.includes(im.mime));
  const fmts = [...new Set(usedImgs.map((im) => (im.mime || "?").split("/").pop().toUpperCase()))].sort();
  add("TEX_FORMAT", !badFmt.length, fmts.join(", ") || "none",
    mimes.map((m) => m.split("/").pop().toUpperCase()).join(" or "),
    "Convert to PNG or JPEG: " + badFmt.map((im) => im.name).join(", "));

  const tmax = lim.texture_max || 0;
  if (tmax) {
    const over = usedImgs.filter((im) => Math.max(im.width, im.height) > tmax);
    add("TEX_MAX", !over.length, largest(usedImgs), `<= ${tmax} px`, "Too large: " + sizeList(over));
  }
  const tmin = lim.texture_min || 0;
  if (tmin) {
    const under = usedImgs.filter((im) => Math.min(im.width, im.height) < tmin);
    add("TEX_MIN", !under.length, smallest(usedImgs), `>= ${tmin} px`, "Too small: " + sizeList(under));
  }
  if (lim.texture_square) {
    const rect = usedImgs.filter((im) => im.width !== im.height);
    add("TEX_SQUARE", !rect.length, `${usedImgs.length - rect.length} of ${usedImgs.length} square`, "width = height",
      "Not square: " + sizeList(rect));
  }
  if (lim.texture_pot) {
    const npot = usedImgs.filter((im) => !(isPot(im.width) && isPot(im.height)));
    add("TEX_POT", !npot.length, `${usedImgs.length - npot.length} of ${usedImgs.length} power of two`,
      "512, 1024, 2048, 4096 ...", "Not a power of two: " + sizeList(npot));
  }

  const noMat = stats.primitives_without_material;
  const totalMats = usedMats.length + (noMat ? 1 : 0);
  const missingBc = usedMats.filter((m) => !m.base_color_texture).map((m) => m.name).concat(noMat ? ["(no material)"] : []);
  add("BASECOLOR_TEXTURE", !missingBc.length, `${totalMats - missingBc.length} of ${totalMats} materials`, "",
    "Missing a base color texture: " + missingBc.join(", "));
  const missingMr = usedMats.filter((m) => !m.metal_rough_texture).map((m) => m.name).concat(noMat ? ["(no material)"] : []);
  add("METALROUGH_TEXTURE", !missingMr.length, `${totalMats - missingMr.length} of ${totalMats} materials`, "",
    "Missing a metallic-roughness texture: " + missingMr.join(", "));
  const unpacked = usedMats.filter((m) => !m.orm_packed).map((m) => m.name);
  add("ORM_PACKED", !unpacked.length, !unpacked.length ? "packed" : `${unpacked.length} separate occlusion map(s)`, "",
    "Occlusion is a separate texture in: " + unpacked.join(", "));

  for (const [code, key, what] of [["ANIMATIONS", "animations", "animation"], ["CAMERAS", "cameras", "camera"],
    ["LIGHTS", "lights", "light"], ["SKINS", "skins", "skin"],
    ["MORPH_TARGETS", "morph_targets", "primitive with morph targets"]]) {
    const n = stats[key];
    add(code, n === 0, String(n), "0", `Remove ${n} ${what}(s).`);
  }

  const allowed = lim.allowed_extensions;
  if (allowed !== null && allowed !== undefined) {
    const extra = stats.extensions_used.filter((e) => !allowed.includes(e));
    add("EXTENSIONS", !extra.length, stats.extensions_used.join(", ") || "none", allowed.join(", ") || "none",
      "Not accepted: " + extra.join(", "));
  }
  const req = stats.extensions_required;
  const badReq = req.filter((e) => allowed === null || allowed === undefined || !allowed.includes(e));
  add("EXTENSIONS_REQUIRED", !badReq.length, req.join(", ") || "none",
    allowed && allowed.length ? "none outside: " + allowed.join(", ") : "none",
    "Viewers must support: " + badReq.join(", "));

  const dims = stats.dimensions;
  if (dims === null) {
    for (const code of ["GROUNDED", "CENTERED", "SCALE_PLAUSIBLE"]) {
      add(code, false, "unknown", "", "Could not compute the model's bounds.");
    }
  } else {
    const lo = stats.bbox_min;
    const hi = stats.bbox_max;
    const size = Math.max(...dims);
    const gtol = Math.max(lim.ground_tolerance_m ?? 0.001, size * 0.001);
    const ctol = Math.max(lim.center_tolerance_m ?? 0.005, size * 0.005);
    add("GROUNDED", Math.abs(lo[1]) <= gtol, `lowest point Y = ${pyFixed(z4(lo[1]), 4)} m`, "Y = 0",
      "Move the model so its lowest point sits at Y = 0.");
    const cx = (lo[0] + hi[0]) / 2;
    const cz = (lo[2] + hi[2]) / 2;
    add("CENTERED", Math.abs(cx) <= ctol && Math.abs(cz) <= ctol,
      `center X ${pyFixed(z4(cx), 4)}, Z ${pyFixed(z4(cz), 4)} m`, "X = 0, Z = 0", "Center the model on the origin.");
    const dmin = lim.min_dimension_m ?? 0.01;
    const dmax = lim.max_dimension_m ?? 10.0;
    add("SCALE_PLAUSIBLE", dmin <= size && size <= dmax, fmtDims(dims), `${pyG(dmin)} - ${pyG(dmax)} m`,
      `The model is ${fmtDims(dims)}; check that it was built in meters at real size.`);
  }

  const maxObj = lim.max_objects || 0;
  if (maxObj) {
    add("OBJECT_COUNT", stats.mesh_nodes <= maxObj, String(stats.mesh_nodes), `<= ${maxObj}`,
      `Combine the parts into ${maxObj} object.`);
  }
  const maxMat = lim.max_materials || 0;
  if (maxMat) {
    add("MATERIAL_COUNT", stats.materials_used <= maxMat, String(stats.materials_used), `<= ${maxMat}`,
      `The platform recommends ${maxMat} material per model where possible.`);
  }
  const ds = usedMats.filter((m) => m.double_sided).map((m) => m.name);
  add("DOUBLE_SIDED", !ds.length, `${ds.length} double-sided`, "0", "Double-sided materials: " + ds.join(", "));

  const rank = (c) => (ORDER.includes(c) ? ORDER.indexOf(c) : 999);
  return results.map((r, i) => [r, i]).sort((a, b) => rank(a[0].code) - rank(b[0].code) || a[1] - b[1]).map((x) => x[0]);
}

export function overall(results) {
  const s = new Set(results.map((r) => r.status));
  if (s.has("fail")) return "fail";
  if (s.has("warn")) return "warn";
  return "pass";
}

// ---------------------------------------------------------------------------
// What Commerce-Ready 3D does about each problem (for the web page only)
// ---------------------------------------------------------------------------

const AUTO = new Set([
  "TRIANGLES", "FILE_SIZE_TARGET", "TEX_MAX", "TEX_MIN", "TEX_SQUARE", "TEX_POT", "BASECOLOR_TEXTURE",
  "METALROUGH_TEXTURE", "ANIMATIONS", "CAMERAS", "LIGHTS", "SKINS", "MORPH_TARGETS", "EXTENSIONS", "GROUNDED",
  "CENTERED", "OBJECT_COUNT",
]);
const REMOVABLE_REQUIRED = /^(KHR_lights_punctual|KHR_materials_\w+|KHR_texture_transform|KHR_mesh_quantization|KHR_draco_mesh_compression|EXT_texture_webp)$/;

/** "auto", "setting", "partial" or "manual" for a failed or warned check. */
export function remedy(code, stats) {
  if (AUTO.has(code)) return "auto";
  if (code === "TEX_FORMAT") {
    return stats.images.some((im) => im.uses.length && im.mime === "image/ktx2") ? "manual" : "auto";
  }
  if (code === "EXTENSIONS_REQUIRED") {
    return stats.extensions_required.every((e) => REMOVABLE_REQUIRED.test(e)) ? "auto" : "manual";
  }
  if (code === "SCALE_PLAUSIBLE") return "setting";
  if (code === "DOUBLE_SIDED") return "partial";
  return "manual";
}

/** Width, depth and height in meters (glTF X, Z, Y), or null. */
export function realSize(stats) {
  const d = stats.dimensions;
  return d ? { w: d[0], d: d[2], h: d[1] } : null;
}

/** "4 x 2048x2048 PNG"-style summary, as in the add-on's report. */
export function texturesLine(stats) {
  const imgs = stats.images.filter((im) => im.uses.length);
  if (!imgs.length) return "none";
  const parts = new Map();
  for (const im of imgs) {
    const key = `${im.width}x${im.height} ${(im.mime || "?").split("/").pop().toUpperCase()}`;
    parts.set(key, (parts.get(key) || 0) + 1);
  }
  return [...parts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, n]) => `${n} x ${k}`).join(", ");
}

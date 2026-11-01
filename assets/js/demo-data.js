// Real results from Commerce-Ready 3D 1.0.0 (Amazon profile) for the problem bottle.
export const BOTTLE = {
 "rows": [
  {
   "code": "FILE_GLB",
   "label": "Binary glTF 2.0 (GLB)",
   "before": [
    "pass",
    "GLB",
    ""
   ],
   "after": [
    "pass",
    "GLB",
    ""
   ]
  },
  {
   "code": "EMPTY",
   "label": "Contains geometry",
   "before": [
    "pass",
    "432,960 triangles",
    ""
   ],
   "after": [
    "pass",
    "193,029 triangles",
    ""
   ]
  },
  {
   "code": "TRIANGLES",
   "label": "Triangle count",
   "before": [
    "fail",
    "432,960",
    "Reduce the triangle count to 200,000 or fewer."
   ],
   "after": [
    "pass",
    "193,029",
    ""
   ]
  },
  {
   "code": "TEX_MISSING",
   "label": "All textures readable",
   "before": [
    "pass",
    "4 of 4 readable",
    ""
   ],
   "after": [
    "pass",
    "4 of 4 readable",
    ""
   ]
  },
  {
   "code": "TEX_FORMAT",
   "label": "Texture formats",
   "before": [
    "pass",
    "PNG",
    ""
   ],
   "after": [
    "pass",
    "PNG",
    ""
   ]
  },
  {
   "code": "TEX_MAX",
   "label": "Texture maximum size",
   "before": [
    "pass",
    "largest 2048x2048",
    ""
   ],
   "after": [
    "pass",
    "largest 2048x2048",
    ""
   ]
  },
  {
   "code": "TEX_MIN",
   "label": "Texture minimum size",
   "before": [
    "pass",
    "smallest 2048x2048",
    ""
   ],
   "after": [
    "pass",
    "smallest 2048x2048",
    ""
   ]
  },
  {
   "code": "TEX_SQUARE",
   "label": "Square textures",
   "before": [
    "pass",
    "4 of 4 square",
    ""
   ],
   "after": [
    "pass",
    "4 of 4 square",
    ""
   ]
  },
  {
   "code": "TEX_POT",
   "label": "Power-of-two textures",
   "before": [
    "pass",
    "4 of 4 power of two",
    ""
   ],
   "after": [
    "pass",
    "4 of 4 power of two",
    ""
   ]
  },
  {
   "code": "BASECOLOR_TEXTURE",
   "label": "Base color texture on every material",
   "before": [
    "pass",
    "1 of 1 materials",
    ""
   ],
   "after": [
    "pass",
    "1 of 1 materials",
    ""
   ]
  },
  {
   "code": "METALROUGH_TEXTURE",
   "label": "Metallic-roughness texture on every material",
   "before": [
    "pass",
    "1 of 1 materials",
    ""
   ],
   "after": [
    "pass",
    "1 of 1 materials",
    ""
   ]
  },
  {
   "code": "ANIMATIONS",
   "label": "No animations",
   "before": [
    "fail",
    "1",
    "Remove 1 animation(s)."
   ],
   "after": [
    "pass",
    "0",
    ""
   ]
  },
  {
   "code": "CAMERAS",
   "label": "No cameras",
   "before": [
    "fail",
    "1",
    "Remove 1 camera(s)."
   ],
   "after": [
    "pass",
    "0",
    ""
   ]
  },
  {
   "code": "LIGHTS",
   "label": "No lights",
   "before": [
    "fail",
    "1",
    "Remove 1 light(s)."
   ],
   "after": [
    "pass",
    "0",
    ""
   ]
  },
  {
   "code": "SKINS",
   "label": "No rigs (skins)",
   "before": [
    "pass",
    "0",
    ""
   ],
   "after": [
    "pass",
    "0",
    ""
   ]
  },
  {
   "code": "MORPH_TARGETS",
   "label": "No morph targets",
   "before": [
    "pass",
    "0",
    ""
   ],
   "after": [
    "pass",
    "0",
    ""
   ]
  },
  {
   "code": "EXTENSIONS",
   "label": "Allowed glTF extensions only",
   "before": [
    "fail",
    "KHR_lights_punctual",
    "Not accepted: KHR_lights_punctual"
   ],
   "after": [
    "pass",
    "none",
    ""
   ]
  },
  {
   "code": "EXTENSIONS_REQUIRED",
   "label": "No required extensions",
   "before": [
    "fail",
    "KHR_lights_punctual",
    "Viewers must support: KHR_lights_punctual"
   ],
   "after": [
    "pass",
    "none",
    ""
   ]
  },
  {
   "code": "GROUNDED",
   "label": "Rests on the ground (Y = 0)",
   "before": [
    "fail",
    "lowest point Y = 54.5572 m",
    "Move the model so its lowest point sits at Y = 0."
   ],
   "after": [
    "pass",
    "lowest point Y = 0.0000 m",
    ""
   ]
  },
  {
   "code": "CENTERED",
   "label": "Centered on the origin",
   "before": [
    "fail",
    "center X 35.0000, Z 20.0027 m",
    "Center the model on the origin."
   ],
   "after": [
    "pass",
    "center X 0.0000, Z 0.0000 m",
    ""
   ]
  },
  {
   "code": "SCALE_PLAUSIBLE",
   "label": "Plausible real-world size",
   "before": [
    "warn",
    "10.855 x 26.036 x 10.870 m (W x D x H)",
    "The model is 10.855 x 26.036 x 10.870 m (W x D x H); check that it was built in meters at real size."
   ],
   "after": [
    "pass",
    "0.109 x 0.109 x 0.260 m (W x D x H)",
    ""
   ]
  },
  {
   "code": "DOUBLE_SIDED",
   "label": "Single-sided materials",
   "before": [
    "pass",
    "0 double-sided",
    ""
   ],
   "after": [
    "pass",
    "0 double-sided",
    ""
   ]
  }
 ],
 "fixes": [
  "Removed objects a product file must not contain: 1 camera(s), 1 empty(s), 1 light(s).",
  "Removed animation (kept the current pose).",
  "Applied modifiers and object transforms (all parts in real-world positions).",
  "Rotated +90 degrees around X so the product stands upright.",
  "Converted from centimeters to meters (scale x0.01).",
  "Moved the product onto the ground and centered it on the origin (moved -0.3500, 0.5999, 0.3302 m).",
  "Reduced triangles from 432,960 to 193,029 to stay within the platform limit of 199,000."
 ],
 "before_status": "fail",
 "after_status": "pass",
 "before_dims": null
};

import { SvelteMap } from 'svelte/reactivity';

// Process/technique terminology... https://www.getty.edu/vow/AATHierarchy?find=chalking&logic=AND&note=&page=1&subjectid=300229438
// Condition/effect terminology... https://www.getty.edu/vow/AATHierarchy?find=chalking&logic=AND&note=&page=1&subjectid=300209168
export const PROCESSES_AND_TECHNIQUES_AS_EFFECT = {
  "condition changing (processes)": {
    "surface or structural changes": {
      "crack": "From 'cracking': Fracturing in a material or object, usually along a single or branched path.",
    },
  },
  "Non-Getty Art & Architecture Thesaurus": {
    "Non-Getty Art & Architecture Thesaurus": {
      "lifting crack": "From 'lifting': Partial rising of a topcoat such as a paint, solvent, or varnish layer, due to the break in adhesion to the undercoat or surface layer.",
      "loss": "Missing original material due to damage, aging, or deterioration.",
    },
  },
}
export const TAG_MAP = new SvelteMap([
  [
    "monitor",
    {
      "description": "[Description to be defined with stakeholders.]",
    },
  ],
  [
    "treat",
    {
      "description": "[Description to be defined with stakeholders.]",
    },
  ],
  [
    "stable",
    {
      "description": "[Description to be defined with stakeholders.]",
    },
  ],
])
// export const PROCESSES_AND_TECHNIQUES_AS_EFFECT = {
//   "condition changing (processes)": {
//     "surface or structural changes": {
//       "crack": "Cracking · Fracturing in a material or object, usually along a single or branched path.",
//       "lift": "Lifting · Partial rising of a topcoat such as a paint, solvent, or varnish layer, due to the break in adhesion to the undercoat or surface layer.",
//       "powder": "Powdering · The act or process of reducing to powder, pulverization; in conservation science context refers to granular disintegration of stone and pigments.",
//       "blister": "Blistering · The process that causes blisters, which are areas bulging out from the main mass or surface, such as paint.",
//     },
//     "color changes": {
//       "discolor": "Discoloration · Any change in the color of an object.",
//       "fade": "Fading · A gradual loss of color or intensity.",
//     },
//     "warp": "Warping · Bending or twisting out of shape, such as that caused by drying, dampness, or heat.",
//   },
//   "physicochemical processes": {
//     "soap": "Saponification · A process involving hydrolysis of an organic compound especially by alkali with the formation of salts of the fatty acids together with glycerol resulting in soap or soapy deposits.",
//   },
//   "Non-Getty Art & Architecture Thesaurus": {
//     "Non-Getty Art & Architecture Thesaurus": {
//       "loss": "Missing original material due to damage, aging, or deterioration.",
//     },
//   },
// }
// export const TAG_MAP = new SvelteMap([
//   [
//     "priority",
//     {
//       "description": "Requires immediate attention.",
//     },
//   ],
//   [
//     "follow-up",
//     {
//       "description": "Inspect on later date.",
//     },
//   ],
//   [
//     "unresolved",
//     {
//       "description": "Not yet addressed.",
//     },
//   ],
//   [
//     "resolved",
//     {
//       "description": "Addressed.",
//     },
//   ],
//   [
//     "verified",
//     {
//       "description": "Verified by visual inspection, microscope, or other method.",
//     },
//   ],
// ])

export const TAG_CHROMA_HUE = new SvelteMap([
  [
    "monitor",
    {
      "chroma": undefined,
      "hue": 254,
    }
  ],
  [
    "treat",
    {
      "chroma": undefined,
      "hue": 37,
    }
    ,
  ],
  [
    "stable",
    {
      "chroma": undefined,
      "hue": 180,
    }
  ],
])

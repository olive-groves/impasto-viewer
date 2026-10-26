import type {
  SyncedMapLibreLayerKey,
  OverrideMapLibreLayerKey,
  SyncedMapLibreSurfaceKey,
  OverrideMapLibreSurfaceKey,
} from "$lib/synced-layer.svelte";
import { OrderedSvelteMap } from "$lib/utils.svelte";
import type { WindowState } from "$lib/v0.8/viewer-window";
import type { LngLat } from "maplibre-gl";

// A single view is a set of layers that are "fused".
// They MUST be presented as a single view, not side by side.
// If a set of 3 layers should be presented side by side, then the
// responsibility is on someone else to create 3 single views and arrange them
// side by side.
type SideBySideMode = {
  type: "side-by-side";  // Side-by-side as a type means "next to each other along a single axis, the axis of which closest keeps 1:1 aspect ratio"
  // arrangement: "side-by-side";
}
type LensMode = {
  type: "lens";
  // arrangement: "overlay";
}
type BlinkMode = {
  type: "blink";
  // arrangement: "overlay";
}
type FadeMode = {
  type: "fade";
  // arrangement: "overlay";
}
// TODO: Blink - Radial (raking light simulator, basically)
export type ViewMode = SideBySideMode | LensMode | BlinkMode | FadeMode;

export type ViewKey = `view_${string}-${string}-${string}-${string}-${string}`;

// Preview states for nesting views, adding views, adding layers
export type Preview = {
  nest: number;
  addSibling: number;
  addChild: number;
}
// Minimap states
export type MinimapState = "none" | "hidden" | "visible";
export type CameraState = {
  zoom?: number;
  lng?: LngLat["lng"];
  lat?: LngLat["lat"];
  bearing?: number;
  pitch?: number;
  roll?: number;
  elevation?: number;
}
// Interface:
// Zoom sync: None | 1:1 (1x) | 2:1 (2x) | 4:1 (4x) | X:Y (x pixels of this for each y pixels of shared)
// LngLat sync: None | x-only (lng-only) | y-only (lat-only) | All
type SyncState = {
  type: "sync" | "none" | "receive-only" | "send-only";
  scale?: "number";
  offset?: "number";
}
export type CameraSyncState = {
  zoom: SyncState;
  lng: SyncState;
  lat: SyncState;
  bearing: SyncState;
  pitch: SyncState;
  roll: SyncState;
  elevation: SyncState;
}
// Cumalative layout of interface elements
export type ViewLayout = {
  preview: Preview,
  window: WindowState,
  minimap: MinimapState,
}

export class SingleView {
  name: string | undefined = $state("View Name");
  readonly type = "single";
  layers: OrderedSvelteMap<OverrideMapLibreLayerKey, SyncedMapLibreLayerKey> = new OrderedSvelteMap({ reorderItemInPlace: true, keyGenerator: () => `override-maplibre-layer_${crypto.randomUUID()}` });
  surface: {
    overrideKey: OverrideMapLibreSurfaceKey | undefined;
    syncedSurfaceKey: SyncedMapLibreSurfaceKey | undefined;
  } = $state({ overrideKey: undefined, syncedSurfaceKey: undefined });
  drawKeys: {
    instanceKey: string | undefined;
    syncedDrawKey: string | undefined;
  } = $state({ instanceKey: undefined, syncedDrawKey: undefined });
  layout: ViewLayout = $state({
    preview: {
      nest: 0,
      addSibling: 0,
      addChild: 0,
    },
    window: {
      state: "normal",
      frame: true,
      titlebar: true,
      title: "View Title",
      controls: true,
      clientArea: true,
    },
    minimap: "none",
  });
  camera: CameraState = $state({});
  sync: CameraSyncState = $state({
    zoom: { type: "sync" },
    lng: {type: "sync"},
    lat: {type: "sync"},
    bearing: {type: "sync"},
    pitch: {type: "sync"},
    roll: {type: "sync"},
    elevation: {type: "sync"},
  });
  // Assume all layers/sources of a view have same spatial resolution and show
  // only one scale bar per view.
  // TODO: Is there a better way to manage and enforce this?
  maxZoom: number | undefined = $state();
  metersPerMaxZoomPixel: number | undefined = $state();
  // metersPerPixel = 2**(maxZoom - zoom) * metersPerMaxZoomPixel;
}
export class MultiView {
  name: string | undefined = $state("Multiview Name");
  readonly type = "multi";
  mode: ViewMode = $state({
    type: "side-by-side",
  });
  views: OrderedSvelteMap<ViewKey, SingleView | MultiView> = new OrderedSvelteMap({ reorderItemInPlace: true, keyGenerator: () => `view_${crypto.randomUUID()}` });
  layout: ViewLayout = $state({
    preview: {
      nest: 0,
      addSibling: 0,
      addChild: 0,
    },
    window: {
      state: "normal",
      frame: true,
      titlebar: true,
      title: "Multiview Title",
      controls: true,
      clientArea: true,
    },
    minimap: "none",
  });
  camera: CameraState = $state({});
  sync: CameraSyncState = $state({
    zoom: { type: "sync" },
    lng: {type: "sync"},
    lat: {type: "sync"},
    bearing: {type: "sync"},
    pitch: {type: "sync"},
    roll: {type: "sync"},
    elevation: {type: "sync"},
  });
}

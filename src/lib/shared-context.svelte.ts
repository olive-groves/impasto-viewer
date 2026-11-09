import { createContext } from 'svelte';
import type { SourceManager } from './source-manager.svelte';
import type { SvelteMap } from 'svelte/reactivity';
import type { AnyLayerSpec, MapLibreSyncedLayer, MapLibreSyncedSurface, SyncedMapLibreLayerKey, SyncedMapLibreSurfaceKey } from './synced-layer.svelte';
import type { SyncedTerraDrawModeManager } from './v0.8/synced-terra-draw.svelte';
import type { ViewKey, MultiView, SingleView } from './v0.8/views.svelte';
import type { OrderedSvelteMap } from './utils.svelte';

export const [getSourceManagerContext, setSourceManagerContext] = createContext<SourceManager>();
export const [getSyncedMapLibreLayersContext, setSyncedMapLibreLayersContext] = createContext<SvelteMap<SyncedMapLibreLayerKey, MapLibreSyncedLayer<AnyLayerSpec>>>();
export const [getSyncedMapLibreSurfacesContext, setSyncedMapLibreSurfacesContext] = createContext<SvelteMap<SyncedMapLibreSurfaceKey, MapLibreSyncedSurface>>();
export const [getSyncedTerraDrawModeManagerContext, setSyncedTerraDrawModeManagerContext] = createContext<SyncedTerraDrawModeManager>();
export const [getViewManagerContext, setViewManagerContext] = createContext<OrderedSvelteMap<ViewKey, SingleView | MultiView>>();

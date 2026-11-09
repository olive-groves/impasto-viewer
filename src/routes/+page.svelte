<script lang="ts">
  //////////////////////////////////////////////////////////////////////////////////////
  // Orchestration of sources, synced layers, and multi-view...
  import {
    sourceManager,
    viewManager,
    syncedMapLibreLayers,
    syncedMapLibreSurfaces,
    syncedTerraDrawModeManager,
  } from "$lib/shared.svelte";
  import {
    setSourceManagerContext,
    setViewManagerContext,
    setSyncedMapLibreLayersContext,
    setSyncedMapLibreSurfacesContext,
    setSyncedTerraDrawModeManagerContext,
  } from "$lib/shared-context.svelte";

  // FIXME: Clear for development purposes —————————————————————————————————————————————
  sourceManager.sources.forEach((_, key) => sourceManager.delete(key));
  syncedMapLibreLayers.forEach((_, key) => syncedMapLibreLayers.delete(key));
  syncedMapLibreSurfaces.forEach((_, key) => syncedMapLibreSurfaces.delete(key));
  viewManager.clear();
  // ———————————————————————————————————————————————————————————————————————————————————
  setSourceManagerContext(sourceManager);
  setViewManagerContext(viewManager);
  setSyncedMapLibreLayersContext(syncedMapLibreLayers);
  setSyncedMapLibreSurfacesContext(syncedMapLibreSurfaces);
  setSyncedTerraDrawModeManagerContext(syncedTerraDrawModeManager);

  import ViewerWorkspace from "$lib/v0.8/ViewerWorkspace.svelte";
  import SyncedTerraDrawSetup from "$lib/v0.8/SyncedTerraDrawSetup.svelte";
  import { MultiView } from "$lib/v0.8/views.svelte";

  const rootMultiView = new MultiView();

  // Minimap uses a requested layer or the first raster layer from the list of views
  // It places the minimap at the bottom left of the multi-view window.
  // We only turn the minimap for the rootMultiView on, because otherwise we'd get
  // multiple minimaps across the views which would overlap and be squeezed within their
  // windows, rather than be an interface element above all the views regardless of orientation
  rootMultiView.layout.minimap = "hidden";

</script>

<svelte:window onbeforeunload={(e) => {e.preventDefault(); e.returnValue = true; return "Are you sure you want to leave?"}} />

<SyncedTerraDrawSetup
  id={syncedTerraDrawModeManager.syncedTerraDraw.id}
  bind:map={syncedTerraDrawModeManager.syncedTerraDraw.map}
  bind:draw={syncedTerraDrawModeManager.syncedTerraDraw.draw}
  modeFactory={syncedTerraDrawModeManager.syncedTerraDraw.modeFactory}
/>

<div style:display=flex style:height=100% style:width=100% style:overflow=hidden>
  <ViewerWorkspace
    multiView={rootMultiView}
  />
</div>

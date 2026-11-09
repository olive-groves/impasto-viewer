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
  viewManager.clear();
  syncedMapLibreLayers.forEach((_, key) => syncedMapLibreLayers.delete(key));
  syncedMapLibreSurfaces.forEach((_, key) => syncedMapLibreSurfaces.delete(key));
  // ———————————————————————————————————————————————————————————————————————————————————
  setSourceManagerContext(sourceManager);
  setViewManagerContext(viewManager);
  setSyncedMapLibreLayersContext(syncedMapLibreLayers);
  setSyncedMapLibreSurfacesContext(syncedMapLibreSurfaces);
  setSyncedTerraDrawModeManagerContext(syncedTerraDrawModeManager);

  //////////////////////////////////////////////////////////////////////////////////////
  // Proof
  import { MultiView, SingleView } from "$lib/v0.8/views.svelte";
  import MultiViewer from "$lib/v0.8/MultiViewer.svelte";
  import { PMTilesProtocol } from "@svelte-maplibre-gl/pmtiles";
  import { MapLibreSyncedLayer } from "$lib/synced-layer.svelte";

  const rootMultiView = new MultiView();

  let syncedLayer = new MapLibreSyncedLayer({
    type: "background",
    paint: {
      "background-color": "yellow",
    },
  });
  let syncedKey = `synced-maplibre-layer_${crypto.randomUUID()}`;
  syncedMapLibreLayers.set(syncedKey, syncedLayer);
  let view;
  let overrideKey;

  view = new SingleView();
  overrideKey = syncedLayer.addOverride({spec: {}});
  view.layers.set(overrideKey, syncedKey);
  rootMultiView.views.push(viewManager.add(view));

  view = new SingleView();
  overrideKey = syncedLayer.addOverride({spec: {paint: {"background-color": "blue"}}});
  view.layers.set(overrideKey, syncedKey);
  rootMultiView.views.push(viewManager.add(view));

  let A = new MultiView();
  A.name = "Multi-View A";
  view = new SingleView();
  overrideKey = syncedLayer.addOverride({spec: {paint: {"background-color": "red"}}});
  view.layers.set(overrideKey, syncedKey);
  A.views.push(viewManager.add(view));
  view = new SingleView();
  overrideKey = syncedLayer.addOverride({spec: {paint: {"background-color": "green"}}});
  view.layers.set(overrideKey, syncedKey);
  A.views.push(viewManager.add(view));
  rootMultiView.views.push(viewManager.add(A));

  // let B = new MultiView();
  // B.name = "Multi-View B"
  // view = new SingleView();
  // B.views.add(view);
  // view = new SingleView();
  // B.views.add(view);
  // view = new SingleView();
  // B.views.add(view);

  // let BB = new MultiView()
  // BB.views.add(B);
  // let BBB = new MultiView()
  // BBB.views.add(BB);

  // rootMultiView.views.add(BBB)

  let camera = $state({
    zoom: undefined,
    center: undefined,
  })

</script>

<PMTilesProtocol pmtiles={sourceManager.pmtiles} />

<div style:display=flex style:height=100% style:width=100% style:overflow=hidden>
  <MultiViewer
    {...rootMultiView}
    bind:camera
    bind:mode={rootMultiView.mode}
    bind:layout={rootMultiView.layout}
  />
</div>

<script lang="ts">
  //////////////////////////////////////////////////////////////////////////////////////
  // Orchestration of sources, synced layers, and multi-view...
  // Viewer Manager?
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

  //////////////////////////////////////////////////////////////////////////////////////
  // Proof
  import { MultiView, SingleView } from "$lib/v0.8/views.svelte";
  import ViewerWorkspace from "$lib/v0.8/ViewerWorkspace.svelte";
  import { MapLibreSyncedLayer, MapLibreSyncedSurface, type AnyLayerSpec, type Background, type SurfaceSpec, type SyncedMapLibreLayerKey, type SyncedMapLibreSurfaceKey } from "$lib/synced-layer.svelte";
  import SyncedTerraDrawSetup from "$lib/v0.8/SyncedTerraDrawSetup.svelte";
  import { type SourceKey, SourceManager } from "$lib/source-manager.svelte";
  import { onMount } from "svelte";

  const rootMultiView = new MultiView();

  const layerSpec: AnyLayerSpec = {  // This isn't state(); the MapLibreSyncedLayer.spec is.
    type: "background",
  }
  const syncedLayer = new MapLibreSyncedLayer(layerSpec);
  const syncedLayerKey: SyncedMapLibreLayerKey = `synced-maplibre-layer_${crypto.randomUUID()}`;
  syncedMapLibreLayers.set(syncedLayerKey, syncedLayer);  // TODO: Layers manager? .add() auto generates key

  let view;
  let overrideKey;
  view = new SingleView();
  overrideKey = syncedLayer.addOverride({spec: {}});
  view.layers.set(overrideKey, syncedLayerKey);
  rootMultiView.views.push(viewManager.add(view));

  view = new SingleView();
  overrideKey = syncedLayer.addOverride({spec: {paint: {"background-color": "blue"}}});
  view.layers.set(overrideKey, syncedLayerKey);
  rootMultiView.views.push(viewManager.add(view));

  // Minimap uses a requested layer or the first raster layer from the list of views
  // It places the minimap at the bottom left of the multi-view window.
  // We only turn the minimap for the rootMultiView on, because otherwise we'd get
  // multiple minimaps across the views which would overlap and be squeezed within their
  // windows, rather than be an interface element above all the views regardless of orientation
  rootMultiView.layout.minimap = "visible";

  // let A = new MultiView();
  // A.name = "Multi-View A"
  // view = new SingleView();
  // overrideKey = syncedLayer.addOverride({spec: {paint: {"background-color": "green"}}});
  // view.layers.add(syncedLayerKey, {key: overrideKey});
  // view.drawKeys.instanceKey = syncedTerraDrawModeManager.syncedTerraDraw.addInstance().id;
  // A.views.add(view);
  // view = new SingleView();
  // overrideKey = syncedLayer.addOverride({spec: {paint: {"background-color": "yellow"}}});
  // view.layers.add(syncedLayerKey, {key: overrideKey});
  // view.drawKeys.instanceKey = syncedTerraDrawModeManager.syncedTerraDraw.addInstance().id;
  // A.views.add(view);
  // rootMultiView.views.add(A)

  // let B = new MultiView();
  // B.mode.type = "lens";
  // B.name = "Multi-View B"
  // view = new SingleView();
  // overrideKey = syncedLayer.addOverride({spec: {paint: {"background-color": "cyan"}}});
  // view.layers.add(syncedLayerKey, {key: overrideKey});
  // B.views.add(view);
  // view = new SingleView();
  // overrideKey = syncedLayer.addOverride({spec: {paint: {"background-color": "magenta"}}});
  // view.layers.add(syncedLayerKey, {key: overrideKey});
  // B.views.add(view);
  // A.views.add(B)

  const nViewers = rootMultiView.views.length;

  const localPmtilesUrl = new URL('/local/bagunca-2025-10-21T1629/rgb.pmtiles', import.meta.url);
  const localPmtilesDemUrl = new URL('/local/bagunca-2025-10-21T1629/height.pmtiles', import.meta.url);
  const initialUrls = [
    localPmtilesUrl,
    localPmtilesDemUrl,
  ];

  async function deriveSyncedLayerFromMapLibreSource(
    mapLibreSourceKey: SourceKey,
    nOverrides: number,
  ) {
    const mapLibreSource = sourceManager.mapLibreSources.get(mapLibreSourceKey);
    if (mapLibreSource === undefined) return;
    const sourceSpec = {
      ...await mapLibreSource.source.spec,
      ...mapLibreSource?.override
    }

    if (sourceSpec.type === "raster" || sourceSpec.type === "image") {  // If raster, add a raster layer to each group
      const layerSpecType = "raster";
      const initialPaintSpec = {
        "raster-opacity": 0.8,
      }
      const layerSpec: AnyLayerSpec = {  // This isn't state(); the MapLibreSyncedLayer.spec is.
        source: mapLibreSourceKey,
        type: layerSpecType,
        layout: {visibility: "visible"},
        paint: initialPaintSpec,
      }
      const syncedLayer = new MapLibreSyncedLayer(layerSpec)
      const overrideKeys = [...Array(nOverrides).keys()].map(() => syncedLayer.addOverride({spec: {}}))
      const syncedLayerKey: SyncedMapLibreLayerKey = `synced-maplibre-layer_${crypto.randomUUID()}`;
      syncedMapLibreLayers.set(syncedLayerKey, syncedLayer);  // TODO: Layers manager? .add() auto generates key
      // For each (single)view, add the synced layer with one of the overrides.
      rootMultiView.views.forEach((viewKey, viewIndex) => {
        const view = viewManager.get(viewKey);
        if (view?.type === "single") {
          (view as SingleView).layers.add(syncedLayerKey, {key: overrideKeys.at(viewIndex)})
        }
      })
    } else if (sourceSpec.type === "raster-dem") {  // If raster-dem, add a hillshade AND color-relief layer to each group
      const layerSpecTypes = ["color-relief", "hillshade"];
      layerSpecTypes.forEach((layerSpecType) => {
        const initialPaintSpec =
          layerSpecType === "hillshade" ?
          {
            "hillshade-illumination-direction": 90,
            "hillshade-exaggeration": 0.5,
          } :
          {
            'color-relief-color': [
              'interpolate',
              ['linear'],
              ['elevation'],
              0, 'rgba(0, 0, 0, 0)',
              1, 'rgba(4, 0, 108, 0.5)',
              5000, 'rgba(215, 5, 13, 0.5)'
            ]
          }
        const initialBackgroundSpec: Background | undefined =
          layerSpecType === "hillshade" ?
          {
            color: "#7f7f7f",
            opacity: 0.8,
            visibility: true,
          } :
          undefined
        const layerSpec: AnyLayerSpec = {  // This isn't state() and shouldn't be; the eventual MapLibreSyncedLayer.spec is.
          source: mapLibreSourceKey,
          type: layerSpecType,
          layout: {visibility: "visible"},
          paint: initialPaintSpec,
        }

        const syncedLayer = new MapLibreSyncedLayer(layerSpec, initialBackgroundSpec)
        const overrideKeys = [...Array(nOverrides).keys()].map(() => syncedLayer.addOverride({spec: {}}))
        const syncedLayerKey: SyncedMapLibreLayerKey = `synced-maplibre-layer_${crypto.randomUUID()}`;
        syncedMapLibreLayers.set(syncedLayerKey, syncedLayer);  // TODO: Layers manager? .add() auto generates key
        // For each (single)view, add the synced layer with one of the overrides.
        rootMultiView.views.forEach((viewKey, viewIndex) => {
          const view = viewManager.get(viewKey);
          if (view?.type === "single") {
            (view as SingleView).layers.add(syncedLayerKey, {key: overrideKeys.at(viewIndex)})
          }
        })
      })
    }
  }

  async function derivedSyncedSurfaceFromMapLibreSource(
    mapLibreSourceKey: SourceKey,
    nOverrides: number,
  ) {
    const mapLibreSource = sourceManager.mapLibreSources.get(mapLibreSourceKey);
    if (mapLibreSource === undefined) {
      return
    }
    const sourceSpec = {
      ...await mapLibreSource.source.spec,
      ...mapLibreSource?.override
    }
    if (sourceSpec.type !== "raster-dem") {
      return
    }
    const surfaceSpec: SurfaceSpec = {
      source: mapLibreSourceKey,
      layout: {
        enabled: true,
        exaggeration: 10,
      }
    }
    const syncedSurface = new MapLibreSyncedSurface(surfaceSpec)
    const overrideKeys = [...Array(nOverrides).keys()].map(() => syncedSurface.addOverride({spec: {}}))
    const syncedSurfaceKey: SyncedMapLibreSurfaceKey = `synced-maplibre-surface_${crypto.randomUUID()}`;
    syncedMapLibreSurfaces.set(syncedSurfaceKey, syncedSurface);
    // For each (single)view, set the synced surface with one of the overrides.
    rootMultiView.views.forEach((viewKey, viewIndex) => {
      const view = viewManager.get(viewKey);
      if (view?.type === "single") {
        (view as SingleView).surface.overrideKey = overrideKeys.at(viewIndex);
        (view as SingleView).surface.syncedSurfaceKey = syncedSurfaceKey;
      }
    })
  }

  onMount(() => {

    const initialSourceKeys = initialUrls.map((url) => sourceManager.add(SourceManager.urlToSource(url)));
    // For each source, create a synced layer derived from its spec with as many
    // overrides as nViewers, to simulate side by side with the same source
    initialSourceKeys.forEach((sourceKey) => {
      deriveSyncedLayerFromMapLibreSource(sourceKey, nViewers)
    })

    const sloppySurfaceSourceKeys = initialUrls.map((url) => sourceManager.add(SourceManager.urlToSource(url)));
    // SLOPPY: For each source, (attempt to) create a synced surface dervied from its
    // spec with as many overrides as nViewers.
    sloppySurfaceSourceKeys.forEach((sourceKey) => {
      derivedSyncedSurfaceFromMapLibreSource(sourceKey, nViewers)
    })
  })


</script>

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

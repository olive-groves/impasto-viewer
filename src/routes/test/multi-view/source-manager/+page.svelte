<script lang="ts">
  //////////////////////////////////////////////////////////////////////////////////////
  // Orchestration of sources, synced layers, and multi-view...
  // Viewer Manager?
  import { MapLibreSyncedLayer, MapLibreSyncedSurface, type AnyLayerSpec, type Background, type SurfaceSpec, type SyncedMapLibreLayerKey, type SyncedMapLibreSurfaceKey } from "$lib/synced-layer.svelte";
  import { PMTilesProtocol } from "@svelte-maplibre-gl/pmtiles";

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

  const localPmtilesUrl = new URL('/local/bagunca-2025-10-21T1629/rgb.pmtiles', import.meta.url);
  const localPmtilesDemUrl = new URL('/local/bagunca-2025-10-21T1629/height.pmtiles', import.meta.url);
  const localJpgUrl = new URL('/local/almond-blossom.jpg', import.meta.url);
  const localPngUrl = new URL('/local/impasto.png', import.meta.url);
  const initialUrls = [
    localPmtilesUrl,
    localPmtilesDemUrl,
    localJpgUrl,
    localPngUrl,
  ];

  //////////////////////////////////////////////////////////////////////////////////////
  // Proof
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { MultiView, SingleView } from "$lib/v0.8/views.svelte";
  import { SourceManager, type SourceKey } from "$lib/source-manager.svelte";
  import MultiViewer from "$lib/v0.8/MultiViewer.svelte";
  import ToolButton from "$lib/v0.8/ToolButton.svelte";

  const rootMultiView = new MultiView();

  // >16 in Chromium throws "Too many active WebGL contexts. Oldest context will be lost."
  const nViewers = 3;
  // svelte-ignore state_referenced_locally
  [...Array(nViewers).keys()].map(() => {
    rootMultiView.views.push(viewManager.add(new SingleView()));
  })

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

  function handleFiles(files: FileList | null) {
    if (files) {
      [...files].forEach((file) => {
        deriveSyncedLayerFromMapLibreSource(
          sourceManager.add(SourceManager.fileToSource(file)),
          nViewers
        );
      })
    }
  }

  let camera = $state({
    zoom: undefined,
    center: undefined,
  })

</script>

<svelte:window onbeforeunload={() => "Leave site? Changes you made may not be saved."} />

<!-- We need this component anytime we handle PMTiles. But just once. So not in MultiViewer. -->
 <!-- For now, here, because it's a sibling of MultiViewer. (If we view stuff, we need it.) -->
<PMTilesProtocol pmtiles={sourceManager.pmtiles} />

<div style:display=flex style:overflow=hidden>

  <!-- SingleViews have direct access to shared.svelte.ts (sourceManager et al.) -->
  <MultiViewer {...rootMultiView} bind:camera bind:mode={rootMultiView.mode} bind:layout={rootMultiView.layout} />

  <!-- <SideBar
    {sourceManager}
    {layerManager}
    {multiView}
  /> -->

  <div style:display=flex style:flex-direction=column style:width=min-content>

    <input type=file multiple onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}/>

    <div
      style:display=grid
      style:grid-template-columns="1fr auto 0fr"
      style:overflow-y=scroll
      style:padding-right=4px
      style:-moz-padding-end=16px
    >
      <div style:grid-column="-1 / 1">
        <h1>View–Layer Manager Proof</h1>
        <p>List of views and their respective (override) layers</p>
      </div>
      {#each rootMultiView.views as viewKey, viewIndex (viewKey)}
        {@const view = viewManager.get(viewKey)}
        {@const syncedSurface = syncedMapLibreSurfaces.get(view?.surface?.syncedSurfaceKey)}
        {@const overrideSurface = syncedSurface?.overrides.get(view?.surface?.overrideKey)}
        <div style:display=flex style:grid-template-columns=subgrid style:grid-column="-1 / 1" style:border-top="2px solid white" style:margin-top=14px>
          <label>
            <input type=checkbox checked={view.layout.window.state !== "minimized"} onchange={(e) => view.layout.window.state = e.target.checked ? "normal" : "minimized"}>
            View {viewIndex + 1}
          </label>
          <input class=inline type=text bind:value={view.name} placeholder="Custom name" onblur={(e) => view.name = view.name?.trim()}>
        </div>
        {#each [...view.layers.order].reverse() as overrideKey (overrideKey)}
          {@const syncedLayerKey = view.layers.map.get(overrideKey)}
          {@const syncedLayer = syncedMapLibreLayers.get(syncedLayerKey)}
          {@const override = syncedLayer?.overrides.get(overrideKey)}
          <div animate:flip={{duration: 200}} style:display=grid style:grid-template-columns=subgrid style:grid-column="-1 / 1">
            <div style:display=flex style:grid-column="-1 / 1" style:border-top="1px solid oklch(1 0 0 / 0.2)">
              <div>
                <ToolButton toggle symbol=visibility symbolOff=visibility_off --on-fill=0 toggled={syncedLayer.spec?.layout?.visibility === "visible"} ontoggle={(toggled) => {
                  syncedLayer.spec.layout.visibility = toggled ? "visible" : "none";
                }}/>
              </div>
              <div>
                {syncedLayer?.spec.type}
              </div>
              <div style:display=flex style:margin-left=auto style:justify-content=end>
                <div>
                  <ToolButton symbol=keyboard_arrow_up onclick={() => view.layers.shiftByKey(overrideKey, 1)}/>
                </div>
                <div>
                  <ToolButton symbol=keyboard_arrow_down onclick={() => view.layers.shiftByKey(overrideKey, -1)}/>
                </div>
              </div>
            </div>

            {#each Object.keys(syncedLayer.spec?.paint ?? {}) as property (property)}
              <div style:display=grid style:grid-template-columns=subgrid style:grid-column="-1 / 1" style:padding-left="6px">
                <div>{property}</div>
                <div>
                  {#if typeof override.spec?.paint?.[property] !== "undefined"}
                    <input type=range max=1 step=0.1 bind:value={override.spec.paint[property]} style:user-select=none/>
                  {:else if typeof syncedLayer.spec.paint?.[property] !== "undefined"}
                    <input type=range max=1 step=0.1 bind:value={syncedLayer.spec.paint[property]} style:user-select=none/>
                  {/if}
                </div>
                <div style:align-self=center style:justify-self=center>
                  <ToolButton
                    toggle
                    --font-size=1em
                    symbol=link
                    symbolOff=link_off
                    toggled={override.spec?.paint?.[property] === undefined}
                    ontoggle={(toggled) => {
                      if (toggled) {
                        delete override.spec.paint[property];
                      } else {
                        override.spec.paint = {...override.spec?.paint, [property]: syncedLayer.spec.paint[property]}
                      }
                    }}
                  />
                </div>
              </div>
            {/each}
          </div>
        {/each}

        <div style:display=flex style:grid-column="-1 / 1" style:border-top="4px solid oklch(1 0 0 / 0.2)">
          <div>
            <input type=checkbox checked={syncedSurface?.spec?.layout?.enabled} onchange={(e) => {
              syncedSurface.spec.layout.enabled = e.target.checked;
            }}>
          </div>
          <div>
            surface
          </div>
        </div>

        <div style:display=grid style:grid-template-columns=subgrid style:grid-column="-1 / 1" style:padding-left="6px">
          <div>exaggeration</div>
          <div>
            {#if typeof overrideSurface?.spec?.layout?.exaggeration !== "undefined"}
              <input type=range max=100 step=1 bind:value={overrideSurface.spec.layout.exaggeration} style:user-select=none/>
            {:else if typeof syncedSurface?.spec?.layout?.exaggeration !== "undefined"}
              <input type=range max=100 step=1 bind:value={syncedSurface.spec.layout.exaggeration} style:user-select=none/>
            {/if}
          </div>
          <div style:align-self=center style:justify-self=center>
            <input type=checkbox checked={overrideSurface?.spec?.layout?.exaggeration === undefined} onchange={(e) => {
              if (e.target.checked) {
                delete overrideSurface?.spec?.layout?.exaggeration;
              } else {
                overrideSurface.spec.layout = {...overrideSurface?.spec?.layout, exaggeration: syncedSurface.spec.layout.exaggeration}
              }
            }}>
          </div>
        </div>
      {/each}
    </div>

  </div>
</div>

<!-- MapLibre-knowing?
Svelte-agnostic.
Class LayerManager
  layers  // object of layers, each with their source, type, etc., manager-id (unique)
  addLayer  // add a layer to the list with a source, type, etc., id
  removeLayer  // remove a layer using its id
  reorderLayer  // using 'beforeId'? or index? do we rearrange whole layers object?
  numberOfLayers  // derived n of layers? (convenience for slot-layers?) -->


<style>
  /* color: color-mix(in srgb, currentColor, transparent 30%); */
  input[type=text].inline {
    padding-left: 0.3rem;
    padding-right: 0.3rem;
  }

</style>

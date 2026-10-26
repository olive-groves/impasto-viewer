<script lang="ts">
  import 'svelte-maplibre-gl/vite';
  import * as maplibregl from 'maplibre-gl';
  import { BackgroundLayer, ColorReliefLayer, HillshadeLayer, ImageSource, MapLibre, RasterDEMTileSource, RasterLayer, RasterTileSource, Terrain } from 'svelte-maplibre-gl';
  import type { SingleView, CameraState } from './views.svelte';
  import { TerraDraw as TerraDrawSvelte } from '@svelte-maplibre-gl/terradraw';

  // import { sourceManager, syncedMapLibreLayers, syncedMapLibreSurfaces } from "$lib/shared.svelte";
  import {
    getSourceManagerContext,
    getSyncedMapLibreLayersContext,
    getSyncedMapLibreSurfacesContext,
    getSyncedTerraDrawModeManagerContext,
  } from "$lib/shared-context.svelte";
  const sourceManager = getSourceManagerContext();
  const syncedMapLibreLayers = getSyncedMapLibreLayersContext();
  const syncedMapLibreSurfaces = getSyncedMapLibreSurfacesContext();
  const syncedTerraDrawModeManager = getSyncedTerraDrawModeManagerContext();

  import { mergeDeep } from '$lib/utils';
  import { ColorRelief } from '$lib/ColorRelief.svelte';
  import Colorbar from '$lib/Colorbar.svelte';
  import ScaleBar from '$lib/ScaleBar.svelte';
  import DualRangeInput from '$lib/DualRangeInput.svelte';
  import { untrack } from 'svelte';

  let {
    layers,
    surface,
    drawKeys,
    zoom = $bindable(),
    lng = $bindable(0),
    lat = $bindable(0),
    bearing = $bindable(),
    pitch = $bindable(),
    roll = $bindable(),
    elevation = $bindable(),
    maxZoom = undefined,
    metersPerMaxZoomPixel = undefined,
    onzoomchange,
    onlngchange,
    onlatchange,
    onbearingchange,
    onpitchchange,
    onrollchange,
    onelevationchange,
  }: {
    layers: SingleView["layers"];
    surface?: SingleView["surface"];
    drawKeys?: SingleView["drawKeys"];
    zoom?: SingleView["camera"]["zoom"];
    lng?: SingleView["camera"]["lng"];
    lat?: SingleView["camera"]["lat"];
    bearing?: SingleView["camera"]["bearing"];
    pitch?: SingleView["camera"]["pitch"];
    roll?: SingleView["camera"]["roll"];
    elevation?: SingleView["camera"]["elevation"];
    maxZoom?: SingleView["maxZoom"];
    metersPerMaxZoomPixel?: SingleView["metersPerMaxZoomPixel"];
    onzoomchange?: (zoom: CameraState["zoom"]) => void;
    onlngchange?: (lng: CameraState["lng"]) => void;
    onlatchange?: (lat: CameraState["lat"]) => void;
    onbearingchange?: (bearing: CameraState["bearing"]) => void;
    onpitchchange?: (pitch: CameraState["pitch"]) => void;
    onrollchange?: (roll: CameraState["roll"]) => void;
    onelevationchange?: (elevation: CameraState["elevation"]) => void;
  } = $props();

  let map: maplibregl.Map | undefined = $state.raw();

  const SLOT_PREFIX = "slot-";
  const BACKGROUND_PREFIX = "background-";

  // Layers organized by source key
  let layersBySource = $derived(
    layers.map.entries().reduce(
      (uniqueSources, [overrideKey, syncedLayerKey]) => {
        const syncedLayer = syncedMapLibreLayers.get(syncedLayerKey);
        const sourceKey = syncedLayer?.overrides.get(overrideKey)?.spec?.source ?? syncedLayer?.spec.source;
        if (uniqueSources.get(sourceKey) === undefined) {
          const sourceLayerGroup = new Map([[overrideKey, syncedLayerKey]]);
          uniqueSources.set(sourceKey, sourceLayerGroup);
        } else {
          uniqueSources.get(sourceKey).set(overrideKey, syncedLayerKey)
        }
        return uniqueSources
      },
      new Map()
      )
  )

  // TODO: Force update of map for paint properties that don't play nice with surface.

  const MAPLIBRE_TIMEOUT_MILLISECONDS = 100;
  let refreshing: boolean = false;
  let refreshTimeout: number | undefined;
  function _refreshBeforeIds(target: maplibregl.Map) {
    // TODO: Refresh only if the "should-be" order differs from the current.
    // TODO: Function to generate the "should-be" order.
    console.warn("Aggressively refreshing layer order.")
    refreshing = true;
    // FIXME: This rigmarole with `orderedLayerOverrides` is needed when nesting a
    // multiview that itself has a nested multiview. We can't simply use:
    //    const orderedLayerOverrides = layers?.order ?? [];
    let orderedLayerOverrides;
    try {
      orderedLayerOverrides = layers?.order ?? [];
    } catch (error) {
      console.warn("FIXME:", error);
      orderedLayerOverrides = [];
    }
    const currentOrder = target.getLayersOrder();

    // TerraDraw
    // Set last (top) override slot before the TerraDraw slot, because TerraDraw should
    // be kept on top
    const id = `${SLOT_PREFIX}${orderedLayerOverrides.at(-1)}`;
    const beforeId = `${SLOT_PREFIX}td`;
    if (currentOrder.includes(id) && currentOrder.includes(beforeId)) {
      target.moveLayer(id, beforeId)
    }
    const _terraDrawLayerIds = [  // This order, regardless of mode order
      'td-polygon',
      'td-polygon-outline',
      'td-linestring',
      'td-point',
      'td-point-marker',
    ]
    _terraDrawLayerIds.forEach((id) => {
      if (currentOrder.includes(id) && currentOrder.includes(beforeId)) {
        target.moveLayer(id, beforeId)
      }
    })

    // Layer slots
    // Set slot beforeId backwards, starting from second to last, because we "stack under"
    for (let i = orderedLayerOverrides.length - 2; i > -1; i--) {
      const id = `${SLOT_PREFIX}${orderedLayerOverrides.at(i)}`;
      const beforeId = `${SLOT_PREFIX}${orderedLayerOverrides.at(i + 1)}`;
      if (currentOrder.includes(id) && currentOrder.includes(beforeId)) {
        target.moveLayer(id, beforeId)
      }
    }

    // Layers belonging to those slots
    orderedLayerOverrides.forEach(override => {
      if (currentOrder.includes(override) && currentOrder.includes(SLOT_PREFIX + override)) {
        target.moveLayer(override, SLOT_PREFIX + override);
      }
      if (currentOrder.includes(BACKGROUND_PREFIX + override) && currentOrder.includes(override)) {
        target.moveLayer(BACKGROUND_PREFIX + override, override);
      }
    })
    setTimeout(() => refreshing = false, 100)
  }
  function refreshBeforeIds(target: maplibregl.Map) {
    if (target?.isStyleLoaded() && !refreshing) {
      _refreshBeforeIds(target);
    } else {
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(
        target => refreshBeforeIds(target),
        MAPLIBRE_TIMEOUT_MILLISECONDS
      );
    }
  }

  function handleOnData(e: maplibregl.MapDataEvent) {
    // FIXME: This is called when loading tiles, not just upon initial source load.
    // Thus, we're unnecessarily spamming it.
    // See TODO in _refreshBeforeIds().
    if (e?.isSourceLoaded) {
      refreshBeforeIds(e.target);
    }
  }

  $effect(() => {
    layers.order;
    if (map) {
      setTimeout(
        refreshBeforeIds,
        MAPLIBRE_TIMEOUT_MILLISECONDS,
        map,
      );
    }
  })

  $effect(() => {
    onzoomchange?.(zoom);
  })
  $effect(() => {
    onlngchange?.(lng);
  })
  $effect(() => {
    onlatchange?.(lat);
  })
  $effect(() => {
    onbearingchange?.(bearing);
  })
  $effect(() => {
    onpitchchange?.(pitch);
  })
  $effect(() => {
    onrollchange?.(roll);
  })
  $effect(() => {
    onelevationchange?.(elevation);
  })

  const center = $derived({lng, lat});

  function updateCamera(map: maplibregl.Map): void {
    zoom = map?.getZoom();
    const _center = map?.getCenter();
    lng = _center?.lng;
    lat = _center?.lat;
    bearing = map?.getBearing();
    pitch = map?.getPitch();
    roll = map?.getRoll();
    elevation = map?.getCameraTargetElevation();
  }

  let colorRelief = new ColorRelief();
  colorRelief.colormap = "viridis2";
  colorRelief.setBreakpoints.high = 1000;
  colorRelief.setBreakpoints.max = 1000;

  let showColorbar = $derived.by(() => {
    return layers.order.some((overrideKey) => {
      const syncedLayerKey = layers.get(overrideKey);
      const syncedLayer = syncedMapLibreLayers.get(syncedLayerKey);
      return syncedLayer?.spec.type === "color-relief" && syncedLayer?.spec.layout?.visibility === "visible";
    })
  })

  let metersPerPixel: number | undefined = $derived((maxZoom != null && metersPerMaxZoomPixel != null) ? 2**(maxZoom - zoom) * metersPerMaxZoomPixel : undefined);

  const METERS_PER_KEYENCE_HEIGHT_QUANTIZATION_STEP = 0.000000250000011874363;

  let metersPerInteger = $state(METERS_PER_KEYENCE_HEIGHT_QUANTIZATION_STEP);
</script>

<div class="map-container stack">
  <MapLibre
    bind:map
    inlineStyle="place-self: stretch;"
    onload={(e) => updateCamera(e.target)}
    ondata={handleOnData}
    renderWorldCopies={false}
    attributionControl={false}
    // TODO: Parameterize
    anisotropicFilterPitch={180}
    transformConstrain={(lngLat, zoom) => ({center: lngLat, zoom: zoom ?? 0})}
    bearingSnap={0}
    dragRotate={false}
    touchPitch={false}
    // We can't bind because it causes sync issues in 3D mode. For now update upon onmove.
    {zoom}
    {center}
    {bearing}
    {pitch}
    {roll}
    {elevation}
    onmove={
      (e) => {
        if (e.originalEvent || e?.sync) {
          // e.sync is an event prop that we pass if easing or otherwise causing map move,
          // like the auto-pitch when enabling 3D:
          //    map.easeTo({zoom: 2}, {sync: true})
          updateCamera(e.target);
        }
      }
    }
  >
    {#each layers.order as overrideKey (overrideKey)}
      <BackgroundLayer
        id={SLOT_PREFIX + overrideKey}
        layout={{visibility: "none"}}
      />
    {/each}
    {#each layersBySource as [sourceKey, layersOfSource] (sourceKey)}
      {@const source = sourceManager.mapLibreSources.get(sourceKey)}
      {#await source?.source.spec then sourceSpecOriginal}
        {@const sourceSpec = {...sourceSpecOriginal, ...source?.override, id: sourceKey}}
        {#if sourceSpec.type === "raster"}
          <RasterTileSource {...sourceSpec}>
            {#each layersOfSource.entries() as [overrideKey, syncedLayerKey]}
              {@const layer = syncedMapLibreLayers.get(syncedLayerKey)}
              <!-- This overwrites nested objects: {@const layerSpec = {...layer?.spec, ...layer?.overrides.get(overrideKey)?.spec}} -->
              <!-- We mergeDeep instead... -->
              {@const layerSpec = mergeDeep(layer?.spec, layer?.overrides.get(overrideKey)?.spec)}
              <RasterLayer
                id={overrideKey}
                paint={{...layerSpec.paint}}
                layout={{...layerSpec.layout}}
                // beforeId={SLOT_PREFIX + overrideKey}
              />
            {/each}
          </RasterTileSource>
        {:else if sourceSpec.type === "raster-dem"}
          {@const {scheme, ...maplibreSpec} = sourceSpec}
          <RasterDEMTileSource {...maplibreSpec}>
            {#each layersOfSource.entries() as [overrideKey, syncedLayerKey]}
              {@const layer = syncedMapLibreLayers.get(syncedLayerKey)}
              {@const layerSpec = mergeDeep(layer?.spec, layer?.overrides.get(overrideKey)?.spec)}
              {#if layerSpec.type === "hillshade"}
                <HillshadeLayer
                  id={overrideKey}
                  paint={{...layerSpec.paint}}
                  layout={{...layerSpec.layout}}
                  // beforeId={SLOT_PREFIX + overrideKey}
                />
              {:else if layerSpec.type === "color-relief"}
                <ColorReliefLayer
                  id={overrideKey}
                  paint={{...layerSpec.paint}}
                  layout={{...layerSpec.layout}}
                  // beforeId={SLOT_PREFIX + overrideKey}
                />
              {/if}
            {/each}
          </RasterDEMTileSource>
        {:else if sourceSpec.type === "image"}
          <ImageSource {...sourceSpec}>
            {#each layersOfSource.entries() as [overrideKey, syncedLayerKey]}
              {@const layer = syncedMapLibreLayers.get(syncedLayerKey)}
              {@const layerSpec = mergeDeep(layer?.spec, layer?.overrides.get(overrideKey)?.spec)}
              <RasterLayer
                id={overrideKey}
                paint={{...layerSpec.paint}}
                layout={{...layerSpec.layout}}
                // beforeId={SLOT_PREFIX + overrideKey}
              />
            {/each}
          </ImageSource>
        {:else if typeof sourceKey === "undefined"}
          {#each layersOfSource.entries() as [overrideKey, syncedLayerKey]}
            {@const layer = syncedMapLibreLayers.get(syncedLayerKey)}
            {@const layerSpec = mergeDeep(layer?.spec, layer?.overrides.get(overrideKey)?.spec)}
            {#if layerSpec.type === "background"}
              <BackgroundLayer
                id={overrideKey}
                paint={{...layerSpec.paint}}
                layout={{...layerSpec.layout}}
                // beforeId={SLOT_PREFIX + overrideKey}
              />
            {/if}
          {/each}
        {/if}
      {/await}
    {/each}
    {#each layers.map as [overrideKey, syncedLayerKey] (overrideKey)}
      {@const syncedLayer = syncedMapLibreLayers.get(syncedLayerKey)}
      {@const override = syncedLayer?.overrides.get(overrideKey)}
      {@const background = mergeDeep(syncedLayer?.background ?? {}, override?.background ?? {}) }
      {@const layerVisibility = override?.background?.visibility ?? syncedLayer?.background?.visibility ?? false}
      <!-- TODO: Better default (hidden) background handling -->
      <BackgroundLayer
        id={BACKGROUND_PREFIX + overrideKey}
        // beforeId={overrideKey}
        paint={{"background-color": background?.color ?? "rgb(127, 127, 127)", "background-opacity": background?.opacity ?? 0}}
        layout={{visibility: layerVisibility ? "visible" : "none"}}
      />
    {/each}
    {#if surface?.overrideKey && surface?.syncedSurfaceKey}
      {@const syncedSurface = syncedMapLibreSurfaces.get(surface.syncedSurfaceKey)}
      {@const sourceKey = syncedSurface?.overrides.get(surface.overrideKey)?.spec?.source ?? syncedSurface?.spec.source}
      {@const source = sourceManager.mapLibreSources.get(sourceKey)}
      {#await source?.source.spec then sourceSpecOriginal}
        {@const sourceSpec = {...sourceSpecOriginal, ...source?.override, id: sourceKey}}
        {@const {scheme, ...maplibreSpec} = sourceSpec}
        <RasterDEMTileSource {...maplibreSpec}>
          {@const surfaceSpec = mergeDeep(syncedSurface?.spec, syncedSurface?.overrides.get(surface.overrideKey)?.spec)}
          {#if surfaceSpec.layout.enabled}
            <Terrain exaggeration={surfaceSpec.layout.exaggeration} />
          {/if}
        </RasterDEMTileSource>
      {/await}
    {/if}

    {#if drawKeys?.instanceKey}
      {@const instance = syncedTerraDrawModeManager.syncedTerraDraw.instances.get(drawKeys?.instanceKey)}
      {#if instance}
        <BackgroundLayer
          id={SLOT_PREFIX + "td"}
          layout={{visibility: "none"}}
        />
        <TerraDrawSvelte
          mode={syncedTerraDrawModeManager.actualMode}
          {...instance}
          bind:draw={instance.draw}
          modes={instance.modeFactory()}
        />
      {/if}
    {/if}
  </MapLibre>
  <div class="controls-bottom-left unselectable">
    {#each layers.order as overrideKey (overrideKey)}
      {@const syncedLayerKey = layers.get(overrideKey)}
      {@const syncedLayer = syncedMapLibreLayers.get(syncedLayerKey)}
      {@const paint = syncedLayer?.spec.paint}
      {@const override = syncedLayer?.overrides.get(overrideKey)}
      {@const sourceKey = syncedLayer?.overrides.get(overrideKey)?.spec?.source ?? syncedLayer?.spec.source}
      {@const source = sourceManager.mapLibreSources.get(sourceKey)}
      {#await source?.source then sourceResolve}
        {#if syncedLayer?.spec.type === "hillshade"}
          <label>
            <input type="checkbox" bind:checked={syncedLayer.background.visibility}/>
            Gray Fill
          </label>
        {/if}
        <div style:display="flex" style:gap="var(--gap)" >
          <label>
            <input type="checkbox" checked={syncedLayer?.spec.layout?.visibility === "visible"} onchange={(e) => syncedLayer.spec.layout.visibility = e.target.checked ? "visible" : "none"} />
          </label>
          {#if sourceResolve?.source.metadata.modality === "rgb"}
            RGB
          {:else if sourceResolve?.source.metadata.maskType === "nan-height"}
            NaN (Height)
          {:else if syncedLayer?.spec.type === "color-relief"}
            <details>
              <summary>Pseudocolor</summary>
              <DualRangeInput
                min={0}
                max={sourceResolve?.source.metadata.maximum}
                low={paint["color-relief-color"].at(3)}
                onLowChange={(low) => {
                  const high = untrack(() => paint["color-relief-color"][5])
                  paint["color-relief-color"] = [
                    'interpolate',
                    ['linear'],
                    ['elevation'],
                    low, '#440154',
                    high, "#FDE725"
                  ];
                  colorRelief.setBreakpoints.low = low;
                }}
                high={paint["color-relief-color"].at(5)}
                onHighChange={(high) => {
                  const low = untrack(() => paint["color-relief-color"][3])
                  paint["color-relief-color"] = [
                    'interpolate',
                    ['linear'],
                    ['elevation'],
                    low, '#440154',
                    high, "#FDE725"
                  ];
                  colorRelief.setBreakpoints.high = high;
                }}

                step={colorRelief.setBreakpoints.step}
                --thumb-width=0.2rem
                --padding-top=0.5rem
                --padding-bottom=0.5rem
                --track-height=0.5rem
                --track-filled-color="#440154"
                --track-filled-gradient-mid-color={"color-mix(in oklab, #440154, #fde725 50%)"}
                --track-filled-gradient-end-color={"#fde725"}
              />
              <div style="display: flex; justify-content: space-between;">
                <div style="display: flex; justify-content: space-between; flex: 1 1 0; width: 0;">
                  <span>{(colorRelief.setBreakpoints.min * sourceResolve?.source.metadata?.metersPerInteger * 1000).toFixed(0)} mm</span>
                  <span>{(paint["color-relief-color"][3] * sourceResolve?.source.metadata?.metersPerInteger * 1000).toFixed(2)}</span>
                </div>
                <span> – </span>
                <div style="display: flex; justify-content: space-between; flex: 1 1 0; width: 0;">
                  <span>{(paint["color-relief-color"][5] * sourceResolve?.source.metadata?.metersPerInteger * 1000).toFixed(2)}</span>
                  <span>{(sourceResolve?.source.metadata.maximum * sourceResolve?.source.metadata?.metersPerInteger * 1000).toFixed(0)}</span>
                </div>
              </div>
            </details>
          {:else if syncedLayer?.spec.type === "hillshade"}
            <details>
              <summary>Hillshade</summary>
              <label>
                <input type="range" min=0 max=360 step=5 bind:value={paint["hillshade-illumination-direction"]} ondblclick={() => paint["hillshade-illumination-direction"] = 335}>
                Angle ({paint["hillshade-illumination-direction"].toFixed(0).padStart(3, '0')}°)
              </label>
              <label>
                <input type="range" min=0 max=1 step=0.05 bind:value={paint["hillshade-exaggeration"]} ondblclick={() => paint["hillshade-exaggeration"] = 0.5}>
                Intensity ({paint["hillshade-exaggeration"].toFixed(2)})
              </label>
            </details>
          {/if}
        </div>
      {/await}
    {/each}
  </div>
  {#if showColorbar}
    <div class="controls-center-left">
      <div class="colorbar">
        <Colorbar
          min={colorRelief.setBreakpoints.low * metersPerInteger}
          max={colorRelief.setBreakpoints.high * metersPerInteger}
          --background-color=transparent
          --gradient={`linear-gradient(
            to top,
            ${colorRelief.colormapArray.join(", ")}
          )`}
        />
      </div>
    </div>
  {/if}
  {#if metersPerInteger != null}
    <div class="controls-bottom-right">
      <div class="scalebar">
        <ScaleBar {metersPerPixel} />
      </div>
    </div>
  {/if}
</div>

<style>
  .map-container {
    flex: 1;
    .controls-bottom-left {
      filter: drop-shadow(0px 0px 2px black) drop-shadow(0px 0px 10px black) drop-shadow(0px 0px 100px black);
      color: CanvasText;
      font-size: 1.2rem;
      align-self: end;
      justify-self: start;
      z-index: 1;
      display: flex;
      flex-direction: column-reverse;
      details::details-content {
        display: flex;
        flex-direction: column;
      }
    }
    .controls-center-left {
      pointer-events: none;
      filter: drop-shadow(0px 0px 2px black) drop-shadow(0px 0px 10px black) drop-shadow(0px 0px 100px black);
      color: CanvasText;
      font-size: 1.2rem;
      align-self: center;
      justify-self: start;
      z-index: 1;
      display: flex;
      flex-direction: column;
      max-height: 400px;
      height: 100%;
      .colorbar {
        display: flex;
        height: 100%;
      }
    }
    .controls-bottom-right {
      z-index: 1;
      align-self: end;
      justify-self: end;

      display: flex;
      pointer-events: none;
    }
  }
</style>

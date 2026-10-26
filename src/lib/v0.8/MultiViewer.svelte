<script lang="ts">
  import MultiViewer from '$lib/v0.8/MultiViewer.svelte';
  import SingleViewer from '$lib/v0.8/SingleViewer.svelte';
  import ViewerWindow from '$lib/v0.8/ViewerWindow.svelte';
  import { scale } from 'svelte/transition';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
  import type { ViewMode, ViewLayout, ViewKey } from './views.svelte';
  import { SingleView, MultiView } from './views.svelte';
	import type { Attachment } from 'svelte/attachments';
  import DropZone from "$lib/v0.8/DropZone.svelte";
  import {
    getSourceManagerContext,
    getSyncedMapLibreLayersContext,
    getSyncedMapLibreSurfacesContext,
    getSyncedTerraDrawModeManagerContext,
  } from "$lib/shared-context.svelte";
  import { SourceManager, type SourceKey } from '$lib/source-manager.svelte';
  import { MapLibreSyncedLayer, type AnyLayerSpec, type OverrideMapLibreLayerKey, type SyncedMapLibreLayerKey } from '$lib/synced-layer.svelte';
  import { mergeDeep } from '$lib/utils';
  const sourceManager = getSourceManagerContext();
  const syncedMapLibreLayers = getSyncedMapLibreLayersContext();
  const syncedMapLibreSurfaces = getSyncedMapLibreSurfacesContext();
  const syncedTerraDrawModeManager = getSyncedTerraDrawModeManagerContext();

  let {
    views,
    camera = $bindable({}),
    mode = $bindable({type: "side-by-side"}),
    layout = $bindable(),
  }: {
    views: MultiView["views"],
    camera: any,
    mode: ViewMode,
    layout: ViewLayout,
  } = $props();

  // TODO: Instead of fold, separate taskbar from MultiViewer:
  // MultiViewerWindow(Taskbar(multiView), MultiViewer(multiView))
  // Have floating taskbar even, with nested taskbar elements:
  // Multi(View 1, View 2) Multi(Multi(View 3, View 4), View 5)
  // TODO: Optionally fold multiviews?
  // Example 1:
  // I have a multiview.
  // I pass its views to this.
  // There is only one view.
  // That view is a multiview.
  // That multiview has only one view.
  // Instead of multiview(multiview(view)), do multiview(view).
  //
  // Generic:
  // I have a multiview.
  // I pass its views to this.
  // For each view that is multiview and has just one (multi)view, fold the view:
  //  MULTIVIEW.VIEWS(..., multiview(view), ...) --> MULTIVIEW.VIEWS(..., view, ...).
  let visibleViewsOrder = $derived(views.order.filter((viewKey) => views.map.get(viewKey)?.layout.window.state !== "minimized"))

  // Lens
  // FIXME: Lens (mouse) alignment issue on nested MultiViewers
  let lens = $state(
		{
      x: 0,
      y: 0,
			diameter: new Tween(200, {
				duration: 100,
				easing: cubicInOut
			}),
			scaler: 1.2,
			clientX: 0,
			clientY: 0,
      boundingClientRect: {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      },
			i: new Tween(1, {
				duration: 100,
				easing: cubicInOut
			})
		}
	)
  $effect(() => {
		lens.x = lens.clientX - lens.boundingClientRect.left;
		lens.y = lens.clientY - lens.boundingClientRect.top;
	});
  function observeResizeBoundingClientRect(callback: (rect) => void): Attachment {
    return (element) => {
      const observer = new ResizeObserver(() => callback(element.getBoundingClientRect()))
      observer.observe(element);
      return () => observer.unobserve(element);
    }
  }
  function onKeyUp(event) {
    // FIXME: Instead of stopping propagation, can we check if keyUp came from itself vs
    // child MultiView and ignore is yes? I think stopping propagation is a smell.
    // event.stopPropagation()
    // event.preventDefault();
		switch (event.key) {
			case "'":
        lens.diameter.target = Math.round(lens.diameter.current * lens.scaler);
        break;
			case ";":
        lens.diameter.target = Math.round(lens.diameter.current / lens.scaler);
        break;
			case "]":
        lens.i.target -= 1;
        break;
			case "[":
        lens.i.target += 1;
        break;
			case "l":
        mode.type = mode.type !== "lens" ? "lens" : "side-by-side";
        break;
			case "b":
        mode.type = mode.type !== "blink" ? "blink" : "side-by-side";
        break;
			case "f":
        mode.type = mode.type !== "fade" ? "fade" : "side-by-side";
        break;
		}
	}
  function onKeyDown(event) {
		switch (event.key) {
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
      case "0":
        if (mode.type === "blink" || mode.type === "fade") {
          const i = Math.min(Number(event.key), visibleViewsOrder.length) - 1;
          lens.x = (i + 0.5) * lens.boundingClientRect.width / visibleViewsOrder.length;
        }
        break;
    }
  }

  function handleDropSuperOuter(e: DragEvent) {
    async function handleFiles(files: FileList) {
      // FIXME: Fails with TerraDraw
      const existingNestedMultiView = new MultiView();
      const existingViewKeys = views.order;
      existingViewKeys.forEach((existingViewKey) => {
        const view = views.map.get(existingViewKey);
        if (view) {
          // FIXME: I recursively add draw instances to solve the issue with the view.draw.instanceKey not passing to the nested view.
          // Maybe I'm missing something...?
          recursiveAddDrawInstance(view);
          existingNestedMultiView.views.add(view, {key: existingViewKey});
        }
        function recursiveAddDrawInstance(view: SingleView | MultiView) {
          if (view.type === "single") {
            view.drawKeys.instanceKey = syncedTerraDrawModeManager.syncedTerraDraw.addInstance().id;
          } else {
            view.views.map.forEach((v) => recursiveAddDrawInstance(v));
          }
        }
      })
      views.clear();
      views.add(existingNestedMultiView);
      const newNestedMultiView = new MultiView();
      [...files].forEach(async (file) => {
        const sourceKey = sourceManager.add(SourceManager.fileToSource(file));
        const layers = await deriveSyncedLayersFromMapLibreSource(sourceKey);
        layers.forEach(([syncedLayer, syncedLayerKey, overrideKey]) => {
          syncedMapLibreLayers.set(syncedLayerKey, syncedLayer);  // TODO: Layers manager? .add() auto generates key
          const view = new SingleView();
          view.layers.add(syncedLayerKey, {key: overrideKey});
          view.drawKeys.instanceKey = syncedTerraDrawModeManager.syncedTerraDraw.addInstance().id;
          newNestedMultiView.views.add(view);
        })
      })
      views.add(newNestedMultiView);
    }
    const dataTransfer = e.dataTransfer;
    const files = dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }

  function handleDropOuter(e: DragEvent) {
    async function handleFiles(files: FileList) {
      [...files].forEach(async (file) => {
        const sourceKey = sourceManager.add(SourceManager.fileToSource(file));
        const layers = await deriveSyncedLayersFromMapLibreSource(sourceKey);
        layers.forEach(([syncedLayer, syncedLayerKey, overrideKey]) => {
          syncedMapLibreLayers.set(syncedLayerKey, syncedLayer);  // TODO: Layers manager? .add() auto generates key
          const view = new SingleView();
          view.layers.add(syncedLayerKey, {key: overrideKey});
          view.drawKeys.instanceKey = syncedTerraDrawModeManager.syncedTerraDraw.addInstance().id;
          views.add(view);
        })
      })
    }
    const dataTransfer = e.dataTransfer;
    const files = dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }

  function handleDropSubOuter(e: DragEvent, vK: ViewKey) {
    async function handleFiles(files: FileList, vK: ViewKey) {
      const nestedMultiView = new MultiView();
      const original = views.get(vK);
      // TODO: Tranferring instanceKeys...?
      original.draw.instanceKey = syncedTerraDrawModeManager.syncedTerraDraw.addInstance().id;
      nestedMultiView.views.add(original);
      [...files].forEach(async (file) => {
        const sourceKey = sourceManager.add(SourceManager.fileToSource(file));
        const layers = await deriveSyncedLayersFromMapLibreSource(sourceKey);
        layers.forEach(([syncedLayer, syncedLayerKey, overrideKey]) => {
          syncedMapLibreLayers.set(syncedLayerKey, syncedLayer);  // TODO: Layers manager? .add() auto generates key
          const view = new SingleView();
          view.layers.add(syncedLayerKey, {key: overrideKey});
          view.drawKeys.instanceKey = syncedTerraDrawModeManager.syncedTerraDraw.addInstance().id;
          nestedMultiView.views.add(view);
        })
      })
      views.map.set(vK, nestedMultiView);
    }
    const dataTransfer = e.dataTransfer;
    const files = dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(files, vK);
    }
  }

  function handleDropSubInner(e: DragEvent, vK: ViewKey) {
    async function handleFiles(files: FileList, vk: ViewKey) {
      [...files].forEach(async (file) => {
        const sourceKey = sourceManager.add(SourceManager.fileToSource(file));
        const layers = await deriveSyncedLayersFromMapLibreSource(sourceKey);
        const view = views.map.get(vK);
        layers.forEach(([syncedLayer, syncedLayerKey, overrideKey]) => {
          syncedMapLibreLayers.set(syncedLayerKey, syncedLayer);  // TODO: Layers manager? .add() auto generates key
          view.layers.add(syncedLayerKey, {key: overrideKey});
        })
      })
    }
    const dataTransfer = e.dataTransfer;
    const files = dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(files, vK);
    }
  }

  async function deriveSyncedLayersFromMapLibreSource(mapLibreSourceKey: SourceKey) {
    const mapLibreSource = sourceManager.mapLibreSources.get(mapLibreSourceKey);
    if (mapLibreSource === undefined) return [];
    const sourceSpec = {
      ...await mapLibreSource.source.spec,
      ...mapLibreSource?.override
    }
    const metadata = mapLibreSource.source.source.format === "pmtiles" ? await mapLibreSource.source.source.metadata : undefined;

    if (sourceSpec.type === "raster" || sourceSpec.type === "image") {  // If raster, add a raster layer to each group
      const layerSpecType = "raster";
      const initialPaintSpec = {
        "raster-opacity": 1.0,
      }
      const layerSpec: AnyLayerSpec = {  // This isn't state(); the MapLibreSyncedLayer.spec is.
        source: mapLibreSourceKey,
        type: layerSpecType,
        layout: {visibility: "visible"},
        paint: initialPaintSpec,
      }
      const syncedLayer = new MapLibreSyncedLayer(layerSpec)
      const overrideKey = syncedLayer.addOverride({spec: {}})
      const syncedLayerKey: SyncedMapLibreLayerKey = `synced-maplibre-layer_${crypto.randomUUID()}`;
      return [[syncedLayer, syncedLayerKey, overrideKey]]
    } else if (sourceSpec.type === "raster-dem") {  // If raster-dem, add a hillshade AND color-relief layer to each group
      const layerSpecTypes = ["color-relief", "hillshade"];
      return layerSpecTypes.map((layerSpecType) => {
        const initialPaintSpec =
          layerSpecType === "hillshade" ?
          {
            "hillshade-illumination-direction": 315,
            "hillshade-exaggeration": 0.5,
          } :
          {
            'color-relief-color': [
              'interpolate',
              ['linear'],
              ['elevation'],
              0, 'rgba(0, 0, 0, 1)',
              metadata?.maximum ?? 5000, 'rgba(0, 255, 0, 1)'
            ]
          }
        const initialBackgroundSpec: Background | undefined =
          layerSpecType === "hillshade" ?
          {
            color: "#7f7f7f",
            opacity: 1.0,
            visibility: true,
          } :
          undefined
        const layerSpec: AnyLayerSpec = {  // This isn't state() and shouldn't be; the eventual instantiated MapLibreSyncedLayer.spec is.
          source: mapLibreSourceKey,
          type: layerSpecType,
          layout: {visibility: "visible"},
          paint: initialPaintSpec,
        }

        const syncedLayer = new MapLibreSyncedLayer(layerSpec, initialBackgroundSpec)
        const overrideKey = syncedLayer.addOverride({spec: {}})
        const syncedLayerKey: SyncedMapLibreLayerKey = `synced-maplibre-layer_${crypto.randomUUID()}`;
        return [syncedLayer, syncedLayerKey, overrideKey]
      })
    } else {
      return []
    }
  }
  let allowMultiViewNesting = $derived(views.order.length > 1);
  let allowSubViewNesting = $derived(views.order.length > 1);
  let modeArrangement: "side-by-side" | "overlay" = $derived(mode.type === "side-by-side" ? "side-by-side" : "overlay")

  function findMatchingLayer(views: MultiView["views"], ofSpec: {type: Array<"raster" | "hillshade" | "color-relief" | "background">}) {
    // Find the first override layer of a set of views matching the provided spec
    // This tunnels down and across an array of (nested) views
    let syncedLayerKey: SyncedMapLibreLayerKey | undefined = undefined;
    let overrideKey: OverrideMapLibreLayerKey | undefined = undefined;
    for (const viewKey of views.order) {
      const view = views.get(viewKey);
      if (view?.type === "single") {
        for (const oKey of view.layers.order) {
          const slKey = view.layers.get(oKey);
          if (slKey === undefined) continue;
          const layer = syncedMapLibreLayers.get(slKey);
          if (layer === undefined) continue;
          const spec = mergeDeep(layer?.spec, layer?.overrides.get(oKey)?.spec ?? {});
          // "visible" is default, so we can't trust === "visible"; check if not "none"
          if (ofSpec.type.includes(spec?.type) && spec?.layout?.visibility !== "none" ) {
            syncedLayerKey = slKey;
            overrideKey = oKey;
            break;
          }
        }
      } else if (view?.type === "multi") {
        const keys = findMatchingLayer(view.views, ofSpec);
        syncedLayerKey = keys.syncedLayerKey;
        overrideKey = keys.overrideKey;
      }
      if (syncedLayerKey && overrideKey) break;
    }
    return {syncedLayerKey, overrideKey}
  }
  let minimapView = new SingleView();
  $effect(() => {
    const keys = findMatchingLayer(views, {type: ["background", "raster", "hillshade", "color-relief"]});
    if (keys.overrideKey && keys.syncedLayerKey) {
      if (minimapView.layers.map.get(keys.overrideKey)) {
        minimapView.layers.set(keys.overrideKey, keys.syncedLayerKey);
      } else {
        minimapView.layers.add(keys.syncedLayerKey, {key: keys.overrideKey});
      }
    };
  });
</script>

<DropZone
  enabled={allowMultiViewNesting}
  ondropOuter={(e) => {
    if (allowMultiViewNesting) {
      e.preventDefault();
      handleDropSuperOuter(e);
    }
  }}
  ondragoverOuter={(e) => {
    if (allowMultiViewNesting) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      layout.preview.nest = e.dataTransfer?.items?.length ?? 1;
    }
  }}
  draggingOuterChanged={(dragging) => {
    layout.preview.addSibling = dragging ? 1 : 0;
    layout.preview.nest = dragging ? 1 : 0;
  }}
>
  <div class="multi-viewer-size-container stack">
    <div
      class={[
        "multi-viewer",
        {
          add: layout.preview.addSibling > 0,
        }
      ]}
      role=presentation
      onpointermove={(event) => {lens.clientX = event.clientX; lens.clientY = event.clientY;}}
      onkeyup={onKeyUp}
      onkeydown={onKeyDown}
    >
      <DropZone
        --dragging-margin=initial
        // preferInner={visibleViewsOrder.length !== 1}
        --flex-direction=column
        ondropOuter={(e) => {
          handleDropOuter(e);
          e.preventDefault();
        }}
        ondragoverOuter={(e) => {
          e.preventDefault();
          layout.preview.addChild = e.dataTransfer?.items?.length ?? 1;
          e.dataTransfer.dropEffect = "copy";
        }}
        ondropInner={(e) => {
          if (visibleViewsOrder.length < 1) {
            handleDropOuter(e);
            e.preventDefault();
          }
        }}
        ondragoverInner={(e) => {
          if (visibleViewsOrder.length < 1) {
            e.preventDefault();
            layout.preview.addChild = e.dataTransfer?.items?.length ?? 1;
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        draggingChanged={(dragging, draggingInner) => {
          const draggingOuter = dragging && !draggingInner;
          layout.preview.addChild = (draggingOuter || (dragging && (visibleViewsOrder.length < 1))) ? 1 : 0;
        }}
      >
        <div
          class={[
            "views",
            modeArrangement,
            {
              add: layout.preview.addChild > 0,
            }
          ]}
          {@attach observeResizeBoundingClientRect((r) => {lens.boundingClientRect.left = r.left; lens.boundingClientRect.top = r.top;})}
          bind:clientWidth={lens.boundingClientRect.width}
          bind:clientHeight={lens.boundingClientRect.height}
        >
          {#each visibleViewsOrder as viewKey, i (viewKey)}
            <!-- FIXME: Guard on view type? #if? -->
            {@const view = views?.map.get(viewKey) as SingleView | MultiView}
            <div
              class=view
              style:clip-path={
                mode.type !== "lens" ? "none" :
                i < 1 ? undefined : `circle(${lens.diameter.current}px at ${lens.x + lens.diameter.current*2*(100/100)*(i-lens.i.current)}px ${lens.y}px)`
              }
              style:z-index={
                mode.type !== "blink" ? undefined :
                ((i / visibleViewsOrder.length) <= (lens.x / lens.boundingClientRect.width) && (lens.x / lens.boundingClientRect.width) < ((i + 1) / visibleViewsOrder.length) ? 1 : undefined)
              }
              style:opacity={
                mode.type !== "fade" ? 1 :
                i < 1 ? 1 :
                  Math.max(0, Math.min(1, (
                    lens.x / (lens.boundingClientRect.width / visibleViewsOrder.length) - ( i - 0.5 )
                  )))
              }
            >
              <ViewerWindow onminimize={() => view.layout.window.state = "minimized"} state={{...view.layout.window, ...(((modeArrangement === "overlay" && view.type === "single") || !layout.window.frame) && {titlebar: false, frame: false})}}>
                {#snippet titlebarChildren()}
                  <div style:display=flex style:flex="1 0 auto" style:width="min(100%, 0px)" style:overflow-x=hidden>
                    {#if view.type === "multi"}
                      <div>
                        <select bind:value={view.mode.type}>
                          {#each ["Side-by-Side", "Lens", "Blink", "Fade"] as modeType}
                            <option value={modeType.toLowerCase()}>
                              {modeType}
                            </option>
                          {/each}
                        </select>
                      </div>
                      <div style:display=flex class=unselectable style:overflow-x=auto>
                        {#each view.views.order as childViewKey, i (childViewKey)}
                          {@const childView = view.views.map.get(childViewKey)}
                          <div class="view-tab">
                            <label style:display=flex style:gap=2px>
                              {childView.name || `View ${i + 1}`}
                              <input type=checkbox checked={childView.layout.window.state !== "minimized"} onchange={(e) => childView.layout.window.state = e.target.checked ? "normal" : "minimized"}>
                            </label>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/snippet}
                {#if view.type === "multi"}
                  <MultiViewer
                    {...view}
                    camera={camera}
                    bind:mode={view.mode}
                    layout={{preview: view.layout.preview, minimap: view.layout.minimap, window: {...view.layout.window, ...((!layout.window.frame) && {titlebar: false, frame: false})}}}
                  />
                {:else}
                  <!-- Outer: Dump existing view into multiview, add new view as sibling in that multiview -->
                  <!-- Inner: Add new view as layer -->
                  <DropZone
                    --dragging-margin=initial
                    enabled={allowSubViewNesting}
                    draggingChanged={(dragging, draggingInner) => {
                      const draggingOuter = dragging && !draggingInner;
                      view.layout.preview.nest = draggingOuter ? 1 : 0;
                      view.layout.preview.addSibling = draggingOuter ? 1 : 0;
                      view.layout.preview.addChild = draggingInner ? 1 : 0;
                    }}
                    ondropOuter={(e) => {
                      e.preventDefault();
                      handleDropSubOuter(e, viewKey);
                    }}
                    ondragoverOuter={(e) => {
                      e.preventDefault();
                      view.layout.preview.addSibling = e.dataTransfer?.items?.length ?? 1;
                      e.dataTransfer.dropEffect = "copy";
                    }}
                    ondropInner={(e) => {
                      e.preventDefault();
                      handleDropSubInner(e, viewKey);
                    }}
                    ondragoverInner={(e) => {
                      e.preventDefault();
                      view.layout.preview.addChild = e.dataTransfer?.items?.length ?? 1;
                      e.dataTransfer.dropEffect = "copy";
                    }}
                  >
                    <div class={["sub-view-container", {"add-drag-border": view.layout.preview.addChild > 0, add: view.layout.preview.addSibling > 0}]}>
                      <!-- {#if view.layers.order.length < 1}
                        <div class=views-notice>
                          No layers in this view.
                        </div>
                      {:else} -->
                        <!-- svelte-ignore ownership_invalid_mutation -->
                        <SingleViewer
                          {...view}
                          layers={view.layers}
                          drawKeys={view?.drawKeys}
                          zoom={["sync", "receive-only"].includes(view.sync.zoom.type) ? camera.zoom : view.camera.zoom}
                          lng={["sync", "receive-only"].includes(view.sync.lng.type) ? camera.lng : view.camera.lng}
                          lat={["sync", "receive-only"].includes(view.sync.lat.type) ? camera.lat : view.camera.lat}
                          bearing={["sync", "receive-only"].includes(view.sync.bearing.type) ? camera.bearing : view.camera.bearing}
                          pitch={["sync", "receive-only"].includes(view.sync.pitch.type) ? camera.pitch : view.camera.pitch}
                          roll={["sync", "receive-only"].includes(view.sync.roll.type) ? camera.roll : view.camera.roll}
                          elevation={["sync", "receive-only"].includes(view.sync.elevation.type) ? camera.elevation : view.camera.elevation}
                          onzoomchange={(v) => {view.camera.zoom = v; if (["sync", "send-only"].includes(view.sync.zoom.type)) camera.zoom = v;}}
                          onlngchange={(v) => {view.camera.lng = v; if (["sync", "send-only"].includes(view.sync.lng.type)) camera.lng = v;}}
                          onlatchange={(v) => {view.camera.lat = v; if (["sync", "send-only"].includes(view.sync.lat.type)) camera.lat = v;}}
                          onbearingchange={(v) => {view.camera.bearing = v; if (["sync", "send-only"].includes(view.sync.bearing.type)) camera.bearing = v;}}
                          onpitchchange={(v) => {view.camera.pitch = v; if (["sync", "send-only"].includes(view.sync.pitch.type)) camera.pitch = v;}}
                          onrollchange={(v) => {view.camera.roll = v; if (["sync", "send-only"].includes(view.sync.roll.type)) camera.roll = v;}}
                          onelevationchange={(v) => {view.camera.elevation = v; if (["sync", "send-only"].includes(view.sync.elevation.type)) camera.elevation = v;}}
                        />
                      <!-- {/if} -->
                      <!-- WARNING: Hide, don't {if}, because elements removed from DOM cause issues with ondrag- handlers -->
                      {#each {length: view.layout.preview.addSibling}, i}
                        <div class=add-drag in:scale={{duration: 150, easing: cubicOut, delay: view.layout.preview.addSibling > 1 ? i*(75/(view.layout.preview.addSibling - 1)) : 0}}>
                          + sub-view
                        </div>
                      {/each}
                    </div>
                  </DropZone>
                {/if}
              </ViewerWindow>
            </div>
          {/each}
          {#each {length: layout.preview.addChild}, i}
            <div class=add-drag in:scale={{duration: 150, easing: cubicOut, delay: layout.preview.addChild > 1 ? i*(75/(layout.preview.addChild - 1)) : 0}}>
              + view
            </div>
          {/each}
          {#if !(layout.preview.addChild > 0)}
            {#if views.order.length < 1}
              <div class={["views-notice", "add-drag"]}>
                No views in this multi-view.
              </div>
            {:else if visibleViewsOrder.length < 1}
              <div class=views-notice>
                All views minimized.
              </div>
            {/if}
          {/if}
        </div>
      </DropZone>
      {#each {length: layout.preview.addSibling}, i}
        <div class=add-drag in:scale={{duration: 150, easing: cubicOut, delay: layout.preview.addSibling > 1 ? i*(75/(layout.preview.addSibling - 1)) : 0}}>
        {#if layout.preview.nest > 0}
           <div class=multi-viewer-size-container>
            <div class={["multi-viewer", "add"]} style:margin=1em>
              {#each {length: layout.preview.nest}, ii}
                <div class=add-drag in:scale={{duration: 150, easing: cubicOut, delay: layout.preview.nest > 1 ? ii*(75/(layout.preview.nest - 1)) : 0}}>
                  + view
                </div>
              {/each}
            </div>
           </div>
        {:else}
           + multi-view
        {/if}
        </div>
      {/each}
    </div>
    <div class="controls-bottom-left">
      {#if layout.minimap !== "none"}
        <!-- TODO: Add minimap -->
        <!-- <div class="minimap-control stack">
          {#if layout.minimap === "visible"}
            <div class=minimap-container>
              <SingleViewer
                {...minimapView}
                zoom={-1.5}
              />
            </div>
          {/if}
          <button onclick={() => layout.minimap = layout.minimap === "visible" ? "hidden" : "visible"}>
            <span>
              Minimap
            </span>
          </button>
        </div> -->
        <div class="zoom-control">
          <button onclick={() => camera.zoom += 1}>
            +
          </button>
          <button onclick={() => camera.zoom -= 1}>
            –
          </button>
        </div>
      {/if}
    </div>
  </div>
</DropZone>

<style>
  .controls-bottom-left {
    z-index: 1;
    justify-self: end;
    align-self: end;
    display: flex;
    flex-direction: column;
    align-items: end;
    gap: calc(3 * var(--gap));
    padding: var(--gap);
    padding-right: calc(var(--gap) + 1px + 1px);
    padding-bottom: calc(var(--gap) + 1px + 1rem + 1px);
  }
  .zoom-control {
    display: flex;
    flex-direction: column;
    line-height: 0;
    button {
      font-size: 2rem;
      height: 2.2ch;
      width: 2.2ch;
    }
  }
  .minimap-control {
    pointer-events: none;
    min-width: 0;
    min-height: 0;
    .minimap-container {
      display: grid;
      grid-template-rows: minmax(0, 192px);
      grid-template-columns: minmax(0, 192px);
      border: 1px solid white;
    }
    button {
      z-index: 1;
      pointer-events: auto;
      border-radius: var(--gap);
      padding: calc(var(--gap) / 2);
      justify-self: end;
      align-self: end;
    }
  }
  .add {
    gap: 1em;
  }
  .add-drag-border {
    border: 2px dashed CanvasText;
    padding: 0.5em;
  }
  .add-drag {
    pointer-events: none;
    overflow: hidden;
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 2px dashed color-mix(in srgb, CanvasText, Canvas 50%);
  }
  .views-notice {
    pointer-events: none;
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }
  .multi-viewer-size-container {
    container: multiViewerContainer / size;
    height: 100%;
    width: 100%;
    display: grid;
    grid-template-areas: 1fr;
  }
  .multi-viewer {
    /* DO NOT REMOVE CONTAINER: Necessary for showing nested side-by-side when switching from overlay in Chromium. I warned you. */
    container: multiViewer / size;
    justify-self: stretch;
    align-self: stretch;
    display: flex;
    flex-direction: row;
  }
  .views {
    flex: 1;
  }
  .side-by-side {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    .view {
      flex: 1;
    }
  }
  .overlay {
    display: grid;
    .view {
      grid-area: 1 / 1;
    }
  }
  .view {
    container: ViewContainer / size;
    display: flex;
    overflow: hidden;
  }
  .sub-view-container {
    flex: 1;
    display: flex;
  }
  @container ViewContainer (max-aspect-ratio: 1 / 1) {
    .sub-view-container {
      flex-direction: column;
    }
  }
  /* See note on .multi-viewer. Keep this to show original intention for .side-by-side.
  @container multiViewer (max-aspect-ratio: 1 / 1) {
    .side-by-side {
      flex-direction: column;
    }
  } */
  @container multiViewerContainer (max-aspect-ratio: 1 / 1) {
    .side-by-side {
      flex-direction: column;
    }
    .multi-viewer {
      flex-direction: column;
    }
  }
  .view-tab {
    display: flex;
    border: 1px solid color-mix(in srgb, CanvasText, transparent 85%);
    padding: 0 var(--gap);
    align-items: center;
  }
</style>

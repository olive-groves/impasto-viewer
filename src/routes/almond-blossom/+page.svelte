<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import hillshadeIconEnabled from '$lib/hillshade-enabled.svg'
  import hillshadeIconDisabled from '$lib/hillshade-disabled.svg'
  import rgbIconEnabled from '$lib/rgb-enabled.svg'
  import rgbIconDisabled from '$lib/rgb-disabled.svg'
  import blenderIconEnabled from '$lib/blender-enabled.svg'
  import blenderIconDisabled from '$lib/blender-disabled.svg'
  import {
    MapLibre,
    RasterTileSource,
    RasterLayer,
    RasterDEMTileSource,
    Terrain,
    HillshadeLayer,
    NavigationControl,
    FullScreenControl,
    CustomControl,
    AttributionControl,
    BackgroundLayer
  } from 'svelte-maplibre-gl';
  import { PMTilesProtocol } from '@svelte-maplibre-gl/pmtiles';
  import { PMTiles } from 'pmtiles';
  import { Underzoom } from 'maplibre-xy';
  import 'svelte-maplibre-gl/vite';
  import * as maplibregl from 'maplibre-gl';
  import type { FlyToOptions } from 'maplibre-gl';
  import ScaleBar from '$lib/ScaleBar.svelte';

  let map: maplibregl.Map | undefined = $state()

  let destinations: FlyToOptions[] = [
    {
      zoom: 6.23, center: [-58.175, 45.376], bearing: 48.2, pitch: 56,
      essential: true, speed: 0.7, curve: 0.7
    },
    {
      zoom: 4.5, center: [ 89, 43.85 ], bearing: 0, pitch: 0,
      essential: true, speed: 1.0, curve: 1.0
    },
    {
      zoom: 5, center: [ 131.442, -19.814 ], bearing: 0, pitch: 10,
      essential: true, speed: 0.7, curve: 1.2
    },
    { // 6.17/37.7/124.368/0/71
      zoom: 6.17, center: [ 124.368, 37.7 ], bearing: 0, pitch: 71,
      essential: true, speed: 0.7, curve: 1.2
    },
    {
      zoom: 0, center: [ 0, 0 ], bearing: 0, pitch: 0,
      essential: true, speed: 1, curve: 1
    }
  ]

  let i_destination = $state(destinations.length - 1);

  function setNewDestination() {
    i_destination += 1;
    i_destination = i_destination % destinations.length
  }

  let destination = $derived(destinations[i_destination])

  function flyToRandom(whereTo: FlyToOptions) {
    if (map) {
      map.flyTo(whereTo);
    }
  }

  function ease2D() {
    if (map) {
      map.flyTo({
        pitch: 0,
        essential: true
      });
    }
  }

  function ease3D() {
    if (map) {
      let bearing = map.getBearing();
      bearing += 30;
      map.flyTo({
        pitch: 50,
        bearing: bearing,
        essential: true
      });
    }
  }

  let disclaimerVisible = $state(true)
  let colorVisible = $state(false)
  let terrainVisible = $state(true)
  let hillshadeVisible = $state(false)
  let blenderVisible = $state(true)
  let creditsVisible = $state(false)
  let zoom = $state(destinations.at(-2).zoom)

  // Certain paint props with terrain on are not immediately reflected
  // Reload here to do so
  $effect(() => {
    colorVisible;
    hillshadeVisible;
    setTimeout(() => {
      map?.terrain?.tileManager.freeRtt();
      // map?.terrain?.sourceCache.sourceCache.reload();
    }, 200);
  })

  function toggleBlender() {
    blenderVisible = !blenderVisible;
    if (blenderVisible && hillshadeVisible) hillshadeVisible = false;
    if (blenderVisible && colorVisible) colorVisible = false;
    if (!blenderVisible && (!colorVisible && !hillshadeVisible)) {
      colorVisible = true;
      hillshadeVisible = true;
    }
  }

  function toggleHillshade() {
    hillshadeVisible = !hillshadeVisible;
    if (hillshadeVisible && blenderVisible) blenderVisible = false;
    if (!hillshadeVisible && !colorVisible) colorVisible = true
  }

  function toggleColor() {
    colorVisible = !colorVisible;
    if (colorVisible && blenderVisible) blenderVisible = false;
    if (!colorVisible && !hillshadeVisible) hillshadeVisible = true
  }

  let urls: string[] = [
    "https://tiles.larsmaxfield.com/paintings/almond-blossom/20250107-1604/20250520_153658/rgb.pmtiles",
    "https://tiles.larsmaxfield.com/paintings/almond-blossom/20250107-1604/20250520_153658/height.pmtiles",
    "https://tiles.larsmaxfield.com/paintings/almond-blossom/20250107-1604/20250520_153658/r8.v2.pmtiles"
    // "https://pub-71d989b3685545118a21f845c49db6a3.r2.dev/paintings/almond-blossom/20241023_175809_stitched_rgb.pmtiles",
    // "https://pub-71d989b3685545118a21f845c49db6a3.r2.dev/paintings/almond-blossom/20241023_175809_stitched_height.pmtiles"
  ]
  let pmtiles: PMTiles[] = [];
  let headers: {}[] = [];
  let metadatas: {}[] = [];
  const getHeaderMetadata = async () => {
    pmtiles = urls.map((url) => new PMTiles(url));
    headers = pmtiles.map((p) => p.getHeader())
    metadatas = pmtiles.map((p) => p.getMetadata())
    return {
      headers,
      metadatas
    }
  }
  let maxZoom = 6;

  // Keyence patch side length is 24 mm, 3072 px
  const metersPerMaxZoomPixel = 0.024000000208616257 / 3072;
  let metersPerPixel = $derived(2**(maxZoom - zoom) * metersPerMaxZoomPixel);

  const myUnderzoom = new Underzoom(maplibregl, {extendPan: 1, extendScale: 0.1});
</script>

<svelte:head>
	<title>Impasto Viewer (Almond Blossom)</title>
</svelte:head>

<!-- Add pmtiles:// Protocol globally -->
<PMTilesProtocol />

<!-- Use the pmtiles:// protocol -->
<div class=container id=main style="display: flex; justify-content: center; align-items: center; height: 100%; width: 100%; margin: none;">
{#await getHeaderMetadata()}
    <em>Loading</em>
{:then headers_metadatas}
  <MapLibre
    bind:map={map}
    bind:zoom
    onload={() => {
      setTimeout(() => disclaimerVisible = false, 4500);
      flyToRandom(destination);
    }
    }
    inlineStyle="height: 100%; width: 100%;"
    renderWorldCopies={false}
    maxPitch={87}
    dragRotate={{around: 'center', movement: 'linear'}}
    hash={true}
    attributionControl={false}
    anisotropicFilterPitch={180}
    maxZoom={maxZoom + 2}
    center={destinations.at(-2).center}
    pitch={destinations.at(-2).pitch}
    bearing={destinations.at(-2).bearing}
    transformConstrain={myUnderzoom.transformConstrain}
  >
    <CustomControl position="top-right" class="credits">
      <div>
        <button
          onclick={() => creditsVisible = !creditsVisible}
          style="color: #333; width: fit-content; padding-left: 4px; padding-right: 4px;"
        >
        Powered by
        </button>
      </div>
      {#if creditsVisible}
        <div style:color=black style:background-color=#333 style:padding=4px>
          <p style:margin=0px>
            <a href='https://maplibre.org/'>MapLibre</a>
            <a href='https://libvips.org/'>libvips</a>
            <a href='https://svelte-maplibre-gl.mierune.dev/'>Svelte MapLibre GL</a>
            <a href='https://blender.org/'>Blender</a>
          </p>
          <p style:margin=0px>
            <a href='https://docs.protomaps.com/'>PMTiles</a>
            <a href='https://python.org/'>Python</a>
            <a href='https://opencv.org/'>OpenCV</a>
            <a href='https://developer.mozilla.org/'>MDN</a>
            <a href='https://svgrepo.com/'>SVG Repo</a>
          </p>
        </div>
      {/if}
    </CustomControl>
    <FullScreenControl position="top-right" container={document.getElementById("main")}/>
    <CustomControl position="bottom-right" class="maplibregl-ctrl-transparent maplibregl-ctrl-flex scale">
      <ScaleBar {metersPerPixel} />
    </CustomControl>
    <NavigationControl position="bottom-right" showCompass={true} visualizePitch={true} visualizeRoll={true} />
    <AttributionControl position="bottom-left" compact={true} customAttribution={"<a href='https://harmbelt.nl/'>Harm Belt · <em>Almond Blossom<em></a>"} />
    <CustomControl position="bottom-left">
      <button
      title={terrainVisible ? "Disable 3D" : "Enable 3D"}
      onclick={() => {
          terrainVisible = !terrainVisible;
          if (terrainVisible) {setTimeout(() => ease3D(), 200)}
          else {setTimeout(() => ease2D(), 200)}
        }}
        style:color={terrainVisible ? "#1b9fd0" : "#555"}
        style:font-weight=900>
        3D
      </button>
    </CustomControl>
    <CustomControl position="bottom-left">
      <button
        title={colorVisible ? "Hide RGB" : "Show RGB"}
        onclick={() => {toggleColor()}}>
        <img alt="RGB icon" src={colorVisible ? rgbIconEnabled : rgbIconDisabled} style="position: relative; width: 80%; margin-bottom: -2px;"/>
      </button>
      <button
        title={hillshadeVisible ? "Hide shading" : "Show shading"}
        onclick={() => {toggleHillshade()}}>
        <img alt="Hillshade icon" src={hillshadeVisible ? hillshadeIconEnabled : hillshadeIconDisabled} style="position: relative; width: 80%; margin-bottom: -2px;"/>
      </button>
    </CustomControl>
    <CustomControl position="bottom-left">
      <button
        title={blenderVisible ? "Hide raytracing render" : "Show raytracing render"}
        onclick={() => {toggleBlender()}}>
        <img alt="Blender icon" src={blenderVisible ? blenderIconEnabled : blenderIconDisabled} style="position: relative; width: 80%; margin-bottom: -2px;"/>
      </button>
    </CustomControl>
    <CustomControl position="top-left">
      <div>
        <button
          onclick={() => {
            setNewDestination()
            flyToRandom(destination)
          }}
          style="color: #333; padding-left: 4px; padding-right: 4px;"
        >
        Fly
        </button>
      </div>
    </CustomControl>
    <CustomControl position="bottom-right" class="maplibregl-ctrl maplibregl-ctrl-group">
      <div>
        <button
          title={"Zoom level"}
          onclick={() => {
            map?.easeTo({zoom: Math.round(map.getZoom())})
          }}
          style="font-family: system-ui; color: #333; width: fit-content; padding-left: 4px; padding-right: 4px; font-variant-numeric: tabular-nums;"
          >
          {(100 * 1 / 2 ** (maxZoom - zoom)).toFixed(1)}%
        </button>
      </div>
    </CustomControl>
    <RasterDEMTileSource
      id="terrain"
      url={`pmtiles://${urls[1]}`}
      encoding="custom"
      baseShift={0}
      redFactor={256*256}
      greenFactor={256}
      blueFactor={1}
      tileSize={512}
    >
      <BackgroundLayer
        paint={{
          'background-opacity': 1,
          'background-color': `hsl(0, 0%, ${40}%)`
        }}
      />
      {#if terrainVisible}
        <Terrain exaggeration={12} />
      {/if}
    </RasterDEMTileSource>
    <RasterTileSource
      url={`pmtiles://${urls[0]}`}
      tileSize={512}
    >
      <RasterLayer
        layout={{visibility: colorVisible ? "visible" : "none"}}
        paint={{
          'raster-resampling': 'nearest'
        }}
      />
    </RasterTileSource>
    <RasterTileSource
      url={`pmtiles://${urls[2]}`}
      tileSize={512}
    >
      <RasterLayer
        layout={{visibility: blenderVisible ? "visible" : "none"}}
        paint={{
          'raster-resampling': 'nearest'
        }}
      />
    </RasterTileSource>
    <RasterDEMTileSource
      id="hillshade"
      url={`pmtiles://${urls[1]}`}
      encoding="custom"
      baseShift={0}
      redFactor={256*256}
      greenFactor={256}
      blueFactor={1}
      tileSize={512}
    >
      <HillshadeLayer
        paint={{
          'hillshade-exaggeration': hillshadeVisible ? (colorVisible ? 0.6 : 0.4) : 0.0,
          'hillshade-highlight-color': `${colorVisible ? `#ffffff80` : '#cccccc'}`,
          'hillshade-accent-color': `${colorVisible ? `#000000` : '#000000'}`,
          'hillshade-shadow-color': `${colorVisible ? `#000000` : '#000000'}`,
          'hillshade-method': `${colorVisible ? 'igor' : 'basic'}`,
          'hillshade-illumination-anchor': 'map',
          'hillshade-illumination-direction': 315,
          'hillshade-illumination-altitude': colorVisible ? 40 : 30
          }}
      />
    </RasterDEMTileSource>
  </MapLibre>
  {#if disclaimerVisible}
    <em
      style="position: absolute; pointer-events: none; font-size: 2em; text-shadow: 2px 2px 8px black;" transition:fade>
      In development
    </em>
  {/if}
{/await}
</div>

<style>
.container {
	:global(.maplibregl-ctrl-transparent.maplibregl-ctrl-flex.scale) {
    display: flex;
    flex-direction: column;
		background-color: transparent;
    border-color: transparent;
    box-shadow: none;
    pointer-events: none;
    user-select: none;
	}
	:global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl-transparent.maplibregl-ctrl-flex.scale) {
    align-items: flex-end;
	}
  :global(.scale) {
    pointer-events: none;
  }
	:global(.maplibregl-ctrl-top-right) {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
	}
	:global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group) {
    display: flex;
    flex-direction: row-reverse;
    align-items: flex-end;
	}
	:global(.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button+button) {
    border-top: unset;
    border-right: 1px solid #ddd
	}
	:global(.credits) {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
	}
}
</style>

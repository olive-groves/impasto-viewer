<script lang="ts">
  import { SourceManager } from "$lib/source-manager.svelte";
  import { sample2x2Neighborhood } from "$lib/v0.8/utils-image";
  import { fetchTilesetCoordinatesNeighborhoods } from "$lib/v0.8/utils-tileset";
  import type { TilesetCoordinate } from "$lib/v0.8/utils-tileset";
  import { onMount } from "svelte";

  const sourceManager = new SourceManager();

  // const localPmtilesUrl = new URL('/local/bagunca-2025-10-21T1629/rgb.pmtiles', import.meta.url);
  // const url = new URL('/local/bagunca-2025-10-21T1629/rgb.pmtiles', import.meta.url);
  const url = new URL('/local/bagunca-2025-10-21T1629/height.pmtiles', import.meta.url);
  // const localJpgUrl = new URL('/local/almond-blossom.jpg', import.meta.url);
  // const localPngUrl = new URL('/local/impasto.png', import.meta.url);
  // const initialUrls = [
  //   localPmtilesUrl,
  //   localPmtilesDemUrl,
  //   localJpgUrl,
  //   localPngUrl,
  // ];

  // I have viewer coordinates.
  const lngLats: {lng: number, lat: number}[] = [
    // {lng: -181, lat: 0}, // Should throw
    // {lng: +181, lat: 0}, // Should throw
    // {lng: 0, lat: 86}, // Should throw
    // {lng: 0, lat: -86}, // Should throw
    {lng: -0.001, lat: +0.001},
    {lng: 0, lat: 0.1},
    {lng: 0, lat: 0.2},
    {lng: 0, lat: 0.3},
    {lng: 0, lat: 0.4},
    {lng: 0, lat: 0.5},
    {lng: 0, lat: 0.6},
    {lng: 0, lat: 0.7},
  ];

  // Array of samples images values (by band if not encoded, as decoded value if encoded, null if failed)
  let samples: (number[] | null)[] = $state([]);

  async function test() {
    const sourceKey = sourceManager.add(
      SourceManager.urlToSource(url),
      // {mapLibre: {override: {blueFactor: 1}}}
    );
    const source = sourceManager.sources.get(sourceKey);
    const mapLibreSource = sourceManager.mapLibreSources.get(sourceKey);
    if (source?.format === "pmtiles") {
      // I want to sample the values of a set of viewer coordinate LngLats.

      // I first transform viewer coordinates to quadtree tileset coordinates (normalized [0-1]).
      const xys: TilesetCoordinate[] = lngLats.map((lngLat) => ({
        x: (lngLat.lng + 180) / 360,
        y: (1 - Math.log(Math.tan(lngLat.lat * Math.PI / 180) + 1 / Math.cos(lngLat.lat * Math.PI / 180)) / Math.PI) / 2,
      }));

      // Then fetch the pixel neighbors of the coordinates.
      const kernelSize = 2;
      const maxZoom = await source.getMaxZoom();
      const tileSize = await source?.getTileSize();
      const tileGetter = source.getZxy;
      const {coordinates, neighborhoods} = await fetchTilesetCoordinatesNeighborhoods(tileGetter, maxZoom, tileSize, xys, {kernelSize});

      const sourceSpecOriginal = await mapLibreSource?.source.spec;
      const sourceSpec = {...sourceSpecOriginal, ...mapLibreSource?.override, id: sourceKey}

      // Determine encoding through the MapLibre source.type, as this may be overridden, instead of the PMTiles metadata
      const encoding = sourceSpec?.encoding;
      const baseShift = sourceSpec?.baseShift;
      // WARNING: interval is in vg pmtiles metadata, but NOT in maplibre source (it's baked into the factors instead)
      // const interval = m.interval;
      const redFactor = sourceSpec?.redFactor;
      const greenFactor = sourceSpec?.greenFactor;
      const blueFactor = sourceSpec?.blueFactor;

      const new_samples: (number[] | null)[] = Array.from({length: xys.length});
      for (let i = 0; i < coordinates.length; i++) {
        const c = coordinates[i];
        const n = neighborhoods[i];
        if (n == null || c == null) continue;

        // Interpolate decoded values
        // The trick is to set the neighbor RGBA-banded values to single-band values of their resultant decoded value,
        // then we use bilinear interpolation on it as if was monochannel (B-W)
        // Determine sampling through the MapLibre source.type, as this may be overridden, instead of the PMTiles metadata
        if (sourceSpec?.type === "raster-dem" || encoding === "custom") {
          n.forEach((row, y) => {
            row.forEach((v, x) => {
              const rgba = v.value;
              if (rgba != null) {
                // n[y][x].value = [baseShift + (rgba[0] * redFactor + rgba[1] * greenFactor + rgba[2] * blueFactor) * interval];
                n[y][x].value = [baseShift + (rgba[0] * redFactor + rgba[1] * greenFactor + rgba[2] * blueFactor)];
              }
            })
          })
        } else if (encoding != null) {
          throw new Error(`Encoding '${encoding}' not supported.`)
        }
        new_samples[i] = sample2x2Neighborhood(n, c);
      }

      samples = new_samples;
    }
  }

  onMount(() => {
    test();
  })
</script>

{#each lngLats as lngLat, i (i)}
  <div>{lngLat.lng} {lngLat.lat} - [{samples[i]?.join(", ")}]</div>
{/each}

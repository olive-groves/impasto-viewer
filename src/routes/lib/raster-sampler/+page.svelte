<script lang="ts">
  import { SourceManager } from "$lib/source-manager.svelte";
  import type { TilesetSource } from "$lib/sources";
  import { onMount } from "svelte";

  // const localPmtilesUrl = new URL('/local/bagunca-2025-10-21T1629/rgb.pmtiles', import.meta.url);
  const url = new URL('/local/bagunca-2025-10-21T1629/rgb.pmtiles', import.meta.url);
  // const url = new URL('/local/bagunca-2025-10-21T1629/height.pmtiles', import.meta.url);
  // const localJpgUrl = new URL('/local/almond-blossom.jpg', import.meta.url);
  // const localPngUrl = new URL('/local/impasto.png', import.meta.url);
  // const initialUrls = [
  //   localPmtilesUrl,
  //   localPmtilesDemUrl,
  //   localJpgUrl,
  //   localPngUrl,
  // ];

  // Tileset util?
  type TilesetCoordinate = {x: number, y: number};
  type TileIndex = {z: number, x: number, y: number};
  type TileIndexString = `${string}/${string}/${string}`
  function coordinateToRawTileIndexXY(xy: TilesetCoordinate, zoom: number): Pick<TileIndex, 'x' | 'y'> {
    return {
      x: xy.x * Math.pow(2, zoom),
      y: xy.y * Math.pow(2, zoom),
    };
  }

  // math?
  function linearInterpolate(a: number, b: number, f: number): number {
    return a + (b - a) * f;
  }
  function bilinearInterpolate(
    x1y1: number, x2y1: number,
    x1y2: number, x2y2: number,
    fx: number, fy: number,
  ): number {
    const y1 = linearInterpolate(x1y1, x2y1, fx);
    const y2 = linearInterpolate(x1y2, x2y2, fx);
    return linearInterpolate(y1, y2, fy);
  }

  // Provider //////////////////////////////////////////////////////////////////////////
  // Given an ArrayBuffer
  // Return it as ImageData (.data et al.)
  async function decodeImageDataFromBuffer(data: ArrayBuffer): Promise<ImageData> {
    const blob = new Blob([data], { type: "image/webp" });
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create 2D context.")
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }
  function getUint8ImageDataPixelValue(data: ImageData, x: number, y: number): number[] | null {
    if (x < 0 || x > (data.width - 1)) {
      return null;
    }
    if (y < 0 || y > (data.height - 1)) {
      return null;
    }
    const index = (y * data.width + x) * 4;
    const r = data.data[index];
    const g = data.data[index + 1];
    const b = data.data[index + 2];
    const a = data.data[index + 3];
    return [r, g, b, a];
  }

  function getImageXYNeighborhood(imageData: ImageData, x: number, y: number, kernelSize: number): ImageNeighborhood {
    // x1y1 ______ x2y1
    //  |             |
    //  |     xy      |
    //  |             |
    // x1y2 ______ x2y2

    if (kernelSize !== 2) {
      throw new Error(`Only kernelSize=2 is supported, but ${kernelSize} was specified.`)
    }

    // Closest top-left (1), bottom-right (2)
    let x1 = Math.floor(x);
    let y1 = Math.floor(y);
    let x2 = Math.ceil(x);
    let y2 = Math.ceil(y);

    const v11 = getUint8ImageDataPixelValue(imageData, x1, y1);
    const v21 = getUint8ImageDataPixelValue(imageData, x2, y1);
    const v12 = getUint8ImageDataPixelValue(imageData, x1, y2);
    const v22 = getUint8ImageDataPixelValue(imageData, x2, y2);

    return [
      [{value: v11, x: x1, y: y1}, {value: v21, x: x2, y: y1}],
      [{value: v12, x: x1, y: y2}, {value: v22, x: x2, y: y2}],
    ];
  }
  function sample2x2Neighborhood(neighborhood: ImageNeighborhood, coordinate: ImageCoordinate): ImageValue | null {
    if (neighborhood.length !== 2 || neighborhood?.[0].length !== 2 || neighborhood?.[1].length !== 2) {
      throw new Error(`Image neighborhood not 2x2 shape: ${neighborhood}`)
    }
    const [[n11, n21], [n12, n22]] = neighborhood;

    const dx = coordinate.x - n11.x;
    const dy = coordinate.y - n11.y;

    let v11 = n11.value;
    let v21 = n21.value;
    let v12 = n12.value;
    let v22 = n22.value;

    // Heuristically account for undefined values
    // Assume valid only when all numbers, otherwise invalid (all undefined is the result of sampling outside an image bounds)
    const valid11 = v11 != null;
    const valid21 = v21 != null;
    const valid12 = v12 != null;
    const valid22 = v22 != null;
    if (!valid11) {
      if (valid21) {
        v11 = v21;
      } else if (valid12) {
        v11 = v12;
      } else if (valid22) {
        v11 = v22;
      }
    }
    if (!valid21) {
      if (valid11) {
        v21 = v11;
      } else if (valid22) {
        v21 = v22;
      } else if (valid12) {
        v21 = v12;
      }
    }
    if (!valid12) {
      if (valid22) {
        v12 = v22;
      } else if (valid11) {
        v12 = v11;
      } else if (valid21) {
        v12 = v21;
      }
    }
    if (!valid22) {
      if (valid12) {
        v22 = v12;
      } else if (valid21) {
        v22 = v21;
      } else if (valid11) {
        v22 = v11;
      }
    }

    if (v11 == null || v21 == null || v12 == null || v22 == null) {
      return null
    }

    const v = v11.map((_, i) => bilinearInterpolate(
      v11[i], v21[i],
      v12[i], v22[i],
      dx, dy,
    ));
    return v;
  }

  // function sampleImageXY(imageData: ImageData, x: number, y: number, resampling = "bilinear"): ImageValue {
  //   if (resampling !== "bilinear") {
  //     throw new Error(`Only 'bilinear' resampling supported, but '${resampling}' was specified.`)
  //   }

  //   const [[n11, n21], [n12, n22]] = getImageXYNeighborhood(imageData, x, y, 2);

  //   const dx = x - n11.x;
  //   const dy = y - n11.y;
  //   const v = n11.value.map((_, i) => bilinearInterpolate(
  //     n11.value[i], n21.value[i],
  //     n12.value[i], n22.value[i],
  //     dx, dy,
  //   ));
  //   return v;
  // }

  // 2D array of pixels, indexed [row][col] / [y][x]
  type ImageValue = number[];
  type ImageCoordinate = {x: number, y: number};
  type ImageNeighbor = {value: ImageValue | null} & ImageCoordinate;
  type ImageNeighborhood = ImageNeighbor[][]

  // Given a tileset source, a set of tileset coordinates, and options (kernel size, cache id)
  // Return their (relative tile image) neighborhoods and coordinates.
  //
  // TODO: In a TilesetSampler class, we will use a cache of source image datas (?), id'd with cache id
  async function fetchTilesetCoordinatesNeighborhoods(
    source: TilesetSource,
    xys: TilesetCoordinate[],
    {
      kernelSize = 2,
      cacheId = undefined,
    } = {},
  ): Promise<{coordinates: (ImageCoordinate | undefined)[], neighborhoods: (ImageNeighborhood | undefined)[]}> {
      // Determine tile index for each tileset coordinate.
      const maxZoom = await source.getMaxZoom();
      const tileSize = await source?.getTileSize() ?? 512;
      const tileIndexes: {raw: TileIndex, index: TileIndex}[] = xys.map((xy) => {
        const raw = coordinateToRawTileIndexXY(xy, maxZoom);
        return {
          raw: {z: maxZoom, ...raw},
          index: {z: maxZoom, x: Math.floor(raw.x), y: Math.floor(raw.y)}
        }
      });
      const uniqueTileIndexesAndElements: Map<TileIndexString, {index: TileIndex, elements: number[]}> = new Map(tileIndexes.map((i) => [`${i.index.z}/${i.index.x}/${i.index.y}`, {index: i.index, elements: []}]));
      tileIndexes.forEach((i, e) => uniqueTileIndexesAndElements.get(`${i.index.z}/${i.index.x}/${i.index.y}`)?.elements.push(e))
      const neighborhoods: ImageNeighborhood[] = Array.from({length: xys.length});
      const coordinates: ImageCoordinate[] = Array.from({length: xys.length});

      // Any reason not to sort in ZXY order?
      // TODO: Sort by existing in cache, not existing in cache

      // For each unique tile index, get the tile, and get the coordinates+neighbors of all the coordinates belonging to that tile
      for (let [key, {index, elements}] of uniqueTileIndexesAndElements) {
        // FIXME: Upstream issue where PMTiles.getZxy doesn't fail for negative xy, but does for positive xy outside
        // So we do that here for parity.
        if (index.x < 0 || index.y < 0) {
          throw new Error("tile x/y outside zoom level bounds")
        };
        const data = await source.getZxy(index.z, index.x, index.y);
        if (!data) continue;
        const imageData = await decodeImageDataFromBuffer(data);
        for (let element of elements) {
          const elementIndex = tileIndexes.at(element);
          if (!elementIndex) continue;
          const {raw, index} = elementIndex;

          // Pixel as float
          const pixelX = Math.max(0, (raw.x - index.x) * tileSize - 0.5);
          const pixelY = Math.max(0, (raw.y - index.y) * tileSize - 0.5);

          coordinates[element] = {x: pixelX, y: pixelY};
          neighborhoods[element] = getImageXYNeighborhood(imageData, pixelX, pixelY, kernelSize);
        }
      }

      return {coordinates, neighborhoods};
  }
  // ///////////////////////////////////////////////////////////////////////////////////

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
    const source = SourceManager.urlToSource(url);
    if (source.format === "pmtiles") {
      // I want to sample the values of a set of viewer coordinate LngLats.

      // I first transform viewer coordinates to quadtree tileset coordinates (normalized [0-1]).
      const xys: TilesetCoordinate[] = lngLats.map((lngLat) => ({
        x: (lngLat.lng + 180) / 360,
        y: (1 - Math.log(Math.tan(lngLat.lat * Math.PI / 180) + 1 / Math.cos(lngLat.lat * Math.PI / 180)) / Math.PI) / 2,
      }));

      // Then fetch the pixel neighbors of the coordinates.
      const kernelSize = 2;
      const {coordinates, neighborhoods} = await fetchTilesetCoordinatesNeighborhoods(source, xys, {kernelSize});

      // FIXME: Determine encoding through the MapLibre source.type, as this may be overridden, instead of the PMTiles metadata
      const encoding = (await source.getMetadata()).encoding;

      const new_samples: (number[] | null)[] = Array.from({length: xys.length});
      for (let i = 0; i < coordinates.length; i++) {
        const c = coordinates[i];
        const n = neighborhoods[i];
        if (n == null || c == null) continue;

        // Interpolate decoded values
        // The trick is to set the neighbor RGBA-banded values to single-band values of their resultant decoded value,
        // then we use bilinear interpolation on it as if was monochannel (B-W)
        // FIXME: Determine sampling through the MapLibre source.type, as this may be overridden, instead of the PMTiles metadata
        if (encoding === "custom") {
          const m = await source.getMetadata();
          const baseShift = m.baseShift;
          // WARNING: interval is in vg pmtiles metadata, but NOT in maplibre source (it's baked into the factors instead)
          const interval = m.interval;
          const redFactor = m.redFactor;
          const greenFactor = m.greenFactor;
          const blueFactor = m.blueFactor;
          n.forEach((row, y) => {
            row.forEach((v, x) => {
              const rgba = v.value;
              if (rgba != null) {
                n[y][x].value = [baseShift + (rgba[0] * redFactor + rgba[1] * greenFactor + rgba[2] * blueFactor) * interval];
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

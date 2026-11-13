<script lang="ts">
  import { SourceManager } from "$lib/source-manager.svelte";
  import type { TilesetSource } from "$lib/sources";
  import { onMount } from "svelte";

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
  function getUint8ImageDataPixelValue(data: ImageData, x: number, y: number): number[] {
      const index = (y * data.width + x) * 4;
      const r = data.data[index];
      const g = data.data[index + 1];
      const b = data.data[index + 2];
      const a = data.data[index + 3];
      return [r, g, b, a];
  }
  function sampleImageXY(imageData: ImageData, x: number, y: number, resampling = "bilinear"): number[] {
    // x1y1 ______ x2y1
    //  |             |
    //  |     xy      |
    //  |             |
    // x1y2 ______ x2y2

    if (resampling !== "bilinear") {
      throw new Error("Only 'bilinear' resampling is currently supported.")
    }

    // Closest top-left (1), bottom-right (2)
    let x1 = Math.floor(x);
    let y1 = Math.floor(y);
    let x2 = Math.ceil(x);
    let y2 = Math.ceil(y);

    // Totally out of bounds
    if (x2 < 0 || y2 < 0 || x1 >= imageData.width || y1 >= imageData.height) {
      throw new Error(`Coordinates outside image bounds: x=${x}, y=${y}, width=${imageData.width}, height=${imageData.height}.`)
    }

    // Within half a pixel of bounds
    if (x2 === 0) {
      x1 = x2;
    }
    if (x2 === imageData.width) {
      x2 = x1;
    }
    if (y2 === 0) {
      y1 = y2;
    }
    if (y2 === imageData.height) {
      y2 = y1;
    }

    const v11 = getUint8ImageDataPixelValue(imageData, x1, y1);
    const v21 = getUint8ImageDataPixelValue(imageData, x2, y1);
    const v12 = getUint8ImageDataPixelValue(imageData, x1, y2);
    const v22 = getUint8ImageDataPixelValue(imageData, x2, y2);

    const dx = x - x1;
    const dy = y - y1;
    const v = v11.map((_, i) => bilinearInterpolate(
      v11[i], v21[i],
      v12[i], v22[i],
      dx, dy,
    ));
    return v;
  }

  // Given a tileset source, a set of tileset coordinates, and options (resampling method, cache id)
  // Return their respective sample values [R, G, B], [B-W], etc.
  //
  // Adapted from HarelM's elevation.provider.ts on IsraelHikingMap https://github.com/IsraelHikingMap/Site
  //
  // TODO: In a TilesetSampler class, we will use a cache of source image datas (?), id'd with cache id
  async function sampleTilesetCoordinates(
    source: TilesetSource,
    xys: TilesetCoordinate[],
    {
      resampling = "bilinear",
      cacheId = undefined,
    } = {},
  ): Promise<number[][]> {
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
      const values: number[][] = Array.from({length: xys.length});

      // Any reason not to sort in ZXY order?
      // TODO: Sort by existing in cache, not existing in cache

      // For each unique tile index, get the tile, and sample all the coordinates belonging to that tile
      for (let [key, {index, elements}] of uniqueTileIndexesAndElements) {
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

          values[element] = sampleImageXY(imageData, pixelX, pixelY, resampling);
        }
      }

      return values;
  }
  // ///////////////////////////////////////////////////////////////////////////////////

  async function test() {
    const source = SourceManager.urlToSource(url);
    if (source.format === "pmtiles") {
      // I want to sample the values of a set of viewer coordinate LngLats.

      // I have viewer coordinates.
      const lngLats: Array<{lng: number, lat: number}> = [
        {lng: 0, lat: 0},
        {lng: 1, lat: 1},
        {lng: 2, lat: 2},
        {lng: 2.001, lat: 2},
        {lng: 2.001, lat: 2.001},
        {lng: -180, lat: 85},
      ];

      // I first transform to tileset coordinates [0-1].
      const xys: Array<TilesetCoordinate> = lngLats.map((lngLat) => ({
        x: (lngLat.lng + 180) / 360,
        y: (1 - Math.log(Math.tan(lngLat.lat * Math.PI / 180) + 1 / Math.cos(lngLat.lat * Math.PI / 180)) / Math.PI) / 2,
      }));

      // Then sample
      const sampledValues = await sampleTilesetCoordinates(source, xys);
      console.log(sampledValues);
    }
  }

  onMount(() => {
    test();
  })
</script>


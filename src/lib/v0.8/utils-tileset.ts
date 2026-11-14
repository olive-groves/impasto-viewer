/**
 * Quadtree tileset utilities
 */

import { decodeImageDataFromBuffer, getImageXYNeighborhood } from "./utils-image";
import type { ImageCoordinate, ImageNeighborhood } from "./utils-image";

export type TilesetCoordinate = { x: number, y: number };

export type TileIndex = { z: number, x: number, y: number };

export type TileIndexString = `${string}/${string}/${string}`

export function coordinateToRawTileIndexXY(xy: TilesetCoordinate, zoom: number): Pick<TileIndex, 'x' | 'y'> {
  return {
    x: xy.x * Math.pow(2, zoom),
    y: xy.y * Math.pow(2, zoom),
  };
}

// Given a tileset source, a set of tileset coordinates, and options (kernel size, cache id)
// Return their (relative tile image) neighborhoods and coordinates.
//
// TODO: Cached TilesetSampler class using LRU, we will use a cache of source image datas (?), id'd with cache id
export async function fetchTilesetCoordinatesNeighborhoods(
  zxyTileGetter: (z: number, x: number, y: number) => Promise<ArrayBuffer | undefined>,
  maxZoom: number,
  tileSize: number = 512,
  xys: TilesetCoordinate[],
  {
    kernelSize = 2,
    cacheId = undefined,
  } = {},
): Promise<{coordinates: (ImageCoordinate | undefined)[], neighborhoods: (ImageNeighborhood | undefined)[]}> {
  // Determine tile index for each tileset coordinate.
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
    const data = await zxyTileGetter(index.z, index.x, index.y);
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

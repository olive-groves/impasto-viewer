// SPDX-FileCopyrightText: 2021 and later, Protomaps LLC and contributors, modifications by Lars Maxfield
// SPDX-License-Identifier: BSD-3-Clause
// From https://github.com/protomaps/PMTiles/blob/main/app/src/tileset.ts
//
// A TileJSON or a .pmtiles archive; local, relative, or remote
// Retrieve metadata, tiles, and other information.

import {
  FileSource,
  PMTiles,
  TileType,
} from "pmtiles";
import type { Header as PMTilesHeader } from "pmtiles";
import { type Coordinates as MapLibreCoordinates } from 'maplibre-gl';

type MaybePromise<T> = T | Promise<T>;

type Form = "tiled" | "single";
type SingleFormat = "jpeg" | "jpg" | "png" | "webp";
type TiledFormat = "pmtiles" | "zyx" | "dzi" | "json";

// TODO: MapLibre adapter
// get maplibreSourceUrl(): string;

// TODO: Layer
// layerType: "basemap" | "overlay" | undefined;

// God interface that hold all of it. For now we'll use this, then abstract later if needed.
interface Source {
  url?: string;  // Reactive?
  stateUrl?: string;  // For persistent, remote URLs?

  format: string | undefined;  // jpeg pmtiles json etc.
  type:  MaybePromise<string | undefined>;  // vector raster text etc.

  file?: File;  // Get name from file.name
  archive?: unknown;  // Data-archive based (PMTiles)

  header?: MaybePromise<unknown>;  //  Promise<Header>
  metadata?: MaybePromise<unknown>;  //  Promise<unknown>

  destroy: () => void;
}

interface ImageSource extends Source {
  type: MaybePromise<"raster" | "vector" | undefined>;
  form: Form;
}

interface VectorType {
  getVectorEncoding(): MaybePromise<"mvt" | "mlt" | undefined>;
  getVectorLayers(): MaybePromise<string[] | undefined>;
}

export interface TilesetSource extends Source {
  getZxy(z: number, x: number, y: number): MaybePromise<ArrayBuffer | undefined>;
  getBounds(): MaybePromise<[number, number, number, number]>;
  getMaxZoom(): MaybePromise<number>;
}

// TODO: Consider exactOptionalPropertyTypes
// https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes
type PMTilesMetadata = {
  // Per https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
  name?: string,
  description?: string,
  attribution?: string,
  // type?: "basemap" | "overlay",  // TODO: 'type' is basemap|overlay; Update vg/image_metadata.schema.json
  version: string,
  vector_layers?: { id: string }[],
  // encoding?: string,  // TODO: 'encoding' now spec'd in PMTiles metadata

  // Per vg/image-pmtiles_metadata.schema.json
  type?: string,
  tileSize?: number,
  scheme?: "xyz" | "tms",
  encoding?: string,
  redFactor?: number,
  greenFactor?: number,
  blueFactor?: number,
  baseShift?: number,
  interval?: number,
};


export class SingleImage implements ImageSource {
  form = "single" as const;
  type = "raster" as const;
  format: "jpeg" | "jpg" | "png" | "webp" | undefined;
  url: string;
  constructor(url: string) {
    this.url = url;
  }

  destroy() {}
}

export class RemoteSingleImage extends SingleImage {
  constructor(url: string) {
    super(url);
  }
}

export class LocalSingleImage extends SingleImage {
  file: File;
  constructor(file: File) {
    const url = URL.createObjectURL(file);
    super(url);
    this.file = file;
  }

  destroy() {
    URL.revokeObjectURL(this.url);
  }

  get filename() {
    return this.file.name;
  }
}

export class PMTilesTileset implements ImageSource, TilesetSource, VectorType {
  form = "tiled" as const;
  format = "pmtiles" as const;
  archive: PMTiles;
  type: ImageSource["type"];
  header: MaybePromise<PMTilesHeader>;
  metadata: MaybePromise<PMTilesMetadata>;

  constructor(archive: PMTiles) {
    this.archive = archive;
    this.header = this._initializeHeader();
    this.metadata = this._initializeMetadata();
  }

  destroy() {}

  private async _initializeHeader(): Promise<PMTilesHeader> {
    const header = await this.getHeader();
    this.header = header;
    return header;
  }

  private async _initializeMetadata(): Promise<PMTilesMetadata> {
    const metadata = (await this.getMetadata()) as PMTilesMetadata;
    this.metadata = metadata;
    return metadata;
  }

  // maplibre URL is different my guy
  // get maplibreSourceUrl() {
  //   return `pmtiles://${this.archive.source.getKey()}`;
  // }
  // url: string | undefined = $derived(this.pmtiles?.source ? `pmtiles://${this.pmtiles.source?.getKey()}` : undefined)

  async getZxy(z: number, x: number, y: number) {
    const resp = await this.archive.getZxy(z, x, y);
    return resp?.data;
  }

  async getBounds(): Promise<[number, number, number, number]> {
    const h = await this.header;
    return [h.minLon, h.minLat, h.maxLon, h.maxLat];
  }

  async getMaxZoom(): Promise<number> {
    const h = await this.header;
    return h.maxZoom;
  }

  async isVector() {
    const h = await this.header;
    return h.tileType === TileType.Mvt || h.tileType === TileType.Mlt;
  }

  async getHeader() {
    return await this.archive.getHeader();
  }

  async test() {
    await this.archive.getHeader();
  }

  async getMetadata() {
    return await this.archive.getMetadata() as PMTilesMetadata;
  }

  async getTileSize() {
    const m = await this.metadata;
    return m.tileSize;
  };

  async isOverlay() {
    const m = await this.metadata;
    return m.type === "overlay";
  }

  async getVectorLayers() {
    const m = await this.metadata;
    return m.vector_layers?.map((layer: {id: string}) => layer.id);
  }

  async getVectorEncoding() {
    const h = await this.header;
    switch (h.tileType) {
      case TileType.Mvt:
        return "mvt";
      case TileType.Mlt:
        return "mlt";
      default:
        return undefined;
    }
  }
}

export class RemotePMTilesTileset extends PMTilesTileset {
  url: string;

  constructor(url: string) {
    super(new PMTiles(url));
    this.url = url;
  }

  get stateUrl() {
    return this.url;
  }
}

export class LocalPMTilesTileset extends PMTilesTileset {
  file: File;
  url: string;

  constructor(file: File) {
    super(new PMTiles(new FileSource(file)));
    this.file = file;
    this.url = URL.createObjectURL(file);
  }

  get filename() {
    return this.file.name;
  }

  destroy() {
    URL.revokeObjectURL(this.url);
  }

  // TODO: Add knowledge that this must be added to protocol with protocol.add(<this>.archive)?
  // shouldBeAdded()?
  // x instanceof LocalPMTilesTileset
}

// TODO: Add tiles URL raster, raster-dem, etc.
// {z}/{x}/{y}
// 'raster-tiles': {
//     'type': 'raster',
//     'tiles': ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
//     'tileSize': 256,
//     'minzoom': 0,
//     'maxzoom': 19,
//     'attribution': "© OpenStreetMap contributors",
// }

type MapLibreBaseTileSourceSpec = {
  type?: string,
  url?: string,
  tiles?: string[],
  bounds?: [number, number, number, number],
  minzoom?: number,
  maxzoom?: number,
  tileSize?: number,
  scheme?: "xyz" | "tms",
  attribution?: string,
}

type MapLibreRasterSourceSpec = {
  type: "raster",
} & MapLibreBaseTileSourceSpec

type MapLibreRasterDemSourceSpec = {
  type: "raster-dem",
  encoding?: "terrarium" | "mapbox" | "custom",
  redFactor?: number;
  blueFactor?: number,
  greenFactor?: number,
  baseShift?: number,
} & MapLibreBaseTileSourceSpec

type MapLibreVectorSourceSpec = {
  type: "vector",
  encoding?: "mvt" | "mlt",
} & MapLibreBaseTileSourceSpec

type MapLibreImageSourceSpec = {
  type: "image",
  url: string,
  coordinates: MapLibreCoordinates,
}

export type MapLibreSourceSpec =
  | MapLibreRasterSourceSpec
  | MapLibreRasterDemSourceSpec
  | MapLibreVectorSourceSpec
  | MapLibreImageSourceSpec;

export type OverrideMapLibreSourceSpec =
  | Partial<MapLibreRasterSourceSpec>
  | Partial<MapLibreRasterDemSourceSpec>
  | Partial<MapLibreVectorSourceSpec>
  | Partial<MapLibreImageSourceSpec>;

type PMTilesMapLibreTypes = "vector" | "raster" | "raster-dem";

/*
You have a ImageSource, right?
You want it to work with MapLibre, right?
Then you need to make an adapter.
An adapter for MapLibre means you give it an ImageSource, and it creates a ready-to-go source with all the MapLibre spec goodness.
For example, you pass a SingleImage, that means it will generate a url and specify type = "image" and make coordinates. That's it.
  Maybe we should automatically make those coordinates? Optional 'determine coordinates' arg that yoinks the dimensions and converts to coords?
For example, you pass a PMTilesImage, that means it generates url, tileSize, encoding, type, etc. based on what's inside that Header-Metadata.
  How will that work?
  this.spec will be a MaybePromise<Spec>. (That means in Svelte we can roll an each-await on the .spec, and once it then's, we dump all that spec goodness into the Component.)
  It'll be easy. In the constructor we'll define the .spec as an async function (or somehow async initialize it elsewhere).
    We first await the pmtiles.header and .metadata, because those are also MaybePromise's.
    Then yoink all the relevant header and metadata prop goodness. tileSize. encoding. etc.
    Then make a spec class accordingly — raster, raster-dem, vector — with those props.
    Set this.spec = spec, just like with pmtiles._initializeHeader().
    Then return spec. That return will be a Promise. But as soon it hits this.spec = spec, we'll have our Spec rather than a Promise.
*/

// TODO: Force override of spec?
// Or, rather, a spec-getter should never FAIL, but WARN, falling back on undefined?
// For example, if encoding not provided for DEM, don't fail?
// Or simply spec = {
//   ...spec,
//   ...myOverrides,  // type: "raster" when "raster-dem" to see encoded, for example
// }

export type MapLibreSourceSpecType = maplibregl.SourceSpecification["type"];

export class MapLibreSourceSpecAdapter {
  source: PMTilesTileset | SingleImage;
  spec: MaybePromise<MapLibreSourceSpec>;

  constructor(
    source: PMTilesTileset | SingleImage,
    forceSpecType?: MapLibreSourceSpecType,
  ) {
    this.source = source;
    if (forceSpecType) {
      console.warn("forceSpecType is not reactive and will not update the spec")
    }
    this.spec = this._initializeSpec(forceSpecType);
  }

  static async getSingleImageSpec(
    source: SingleImage,
  ): Promise<MapLibreImageSourceSpec> {
    const coordinates: MapLibreCoordinates = [
      [-90, 70],
      [90, 70],
      [90, -70],
      [-90, -70],
    ]
    const spec = {
      type: "image" as const,
      url: source.url,
      coordinates: coordinates,
    }
    return spec
  }

  // TODO: This is way too big.
  static async getPMTilesMapLibreSpec(
    source: PMTilesTileset,
    forceType?: PMTilesMapLibreTypes,
  ): Promise<MapLibreRasterSourceSpec | MapLibreRasterDemSourceSpec | MapLibreVectorSourceSpec> {
    const isForcedVector = forceType === "vector";
    let isForcedRaster = forceType === "raster";
    const isForcedRasterDem = forceType === "raster-dem";

    const [headerResult, metadataResult] = await Promise.allSettled([
      source.header, source.metadata
    ]);
    if (headerResult.status !== "fulfilled") {
      throw Error(headerResult.reason);
    }
    const header = headerResult.value;
    const metadata =
      metadataResult.status !== "fulfilled"
        ? undefined
        : metadataResult.value;

    const baseSpec = {
      url: `pmtiles://${source.archive.source.getKey()}`,
      bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
      minzoom: header.minZoom,
      maxzoom: header.maxZoom,
      ...(metadata?.scheme ? {scheme: metadata.scheme} : {}),
      ...(metadata?.tileSize ? {tileSize: metadata.tileSize} : {}),
      ...(metadata?.attribution ? {attribution: metadata.attribution} : {}),
    } satisfies MapLibreBaseTileSourceSpec;

    let spec;
    let encoding: MapLibreVectorSourceSpec["encoding"] | MapLibreRasterDemSourceSpec["encoding"];
    const tileType = header.tileType;
    isForcedRaster = tileType === TileType.Unknown && !forceType  // Default unknown to raster
    const isRasterTile =
      tileType === TileType.Jpeg ||
      tileType === TileType.Png ||
      tileType === TileType.Webp
    const isVectorTile =
      tileType === TileType.Mvt ||
      tileType === TileType.Mlt

    if (
      (isForcedRaster || isForcedRasterDem) ||  // Either forced
      (!forceType && isRasterTile)  // Or unforced and proven
    ) {
      // Yeah, I know. But I want to be verbose in translating
      // PMTiles metadata encoding to MapLibre encoding.
      if (metadata?.encoding === "terrarium") {
        encoding = "terrarium";
      } else if (metadata?.encoding === "mapbox") {
        encoding = "mapbox";
      } else if (metadata?.encoding === "custom") {
        encoding = "custom";
      } else {
        encoding = undefined;
      }
      if (encoding || isForcedRasterDem) {
        const interval = metadata?.interval ?? 1;
        spec = {
          ...baseSpec,
          type: "raster-dem",
          ...(encoding ? { encoding } : {}),
          ...(metadata?.redFactor !== undefined ? { redFactor: metadata.redFactor * interval } : {}),
          ...(metadata?.greenFactor !== undefined ? { greenFactor: metadata.greenFactor * interval } : {}),
          ...(metadata?.blueFactor !== undefined ? { blueFactor: metadata.blueFactor * interval } : {}),
          ...(metadata?.baseShift !== undefined ? { baseShift: metadata.baseShift } : {}),
        } satisfies MapLibreRasterDemSourceSpec;
      } else {
        spec = {
          ...baseSpec,
          type: "raster",
        } satisfies MapLibreRasterSourceSpec;
      }
    } else if (
      (isForcedVector) ||  // Either forced
      (!forceType && isVectorTile)  // Or unforced and proven
    ) {
      encoding =
        tileType === TileType.Mlt ? "mlt" :
        tileType === TileType.Mvt ? "mvt" :
        undefined;
      spec = {
        ...baseSpec,
        type: "vector",
        ...(encoding ? { encoding } : {}),
      } satisfies MapLibreVectorSourceSpec;
    } else {
      throw Error(`Unsupported PMTiles tileType: ${header.tileType}`)
    }
    return spec;
  }

  private async _initializeSpec(forceSpecType?: MapLibreSourceSpecType): Promise<MapLibreSourceSpec> {
    const source = this.source;
    const forceType = forceSpecType;
    let asyncSpec: () => Promise<MapLibreSourceSpec>;
    switch (source.form) {
      case "tiled":
        switch (source.format) {
          case "pmtiles":
            if (
              typeof forceType !== 'undefined' &&
              (forceType !== "raster") &&
              (forceType !== "raster-dem") &&
              (forceType !== "vector")
            ) {
              throw Error(`Unsupported type to force: ${forceType}`)
            }
            asyncSpec = () => MapLibreSourceSpecAdapter.getPMTilesMapLibreSpec(source, forceType)
            break
          default:
            throw Error(`Format ${source["format"]} not supported.`)
          }
          break
      // FIXME: Should we check for static image based on format or form or a different property?
      case "single":
        asyncSpec = () => MapLibreSourceSpecAdapter.getSingleImageSpec(source)
        break
      default:
        throw Error(`Form ${source["form"]} not supported.`)
    }
    const spec = await asyncSpec();
    this.spec = spec;
    return spec;
  }

}

// class TileJSONTileset implements Tileset, Remote {
//   url: string;

//   constructor(url: string) {
//     this.url = url;
//   }

//   async test() {
//     await fetch(this.url);
//   }

//   async getBounds() {
//     const resp = await fetch(this.url);
//     const j = await resp.json();
//     return j.bounds as [number, number, number, number];
//   }

//   async getMaxZoom() {
//     const resp = await fetch(this.url);
//     const j = await resp.json();
//     return j.maxzoom;
//   }

//   get maplibreSourceUrl() {
//     return this.url;
//   }

//   async isOverlay() {
//     return true;
//   }

//   async isVector() {
//     const resp = await fetch(this.url);
//     const j = await resp.json();
//     const template = j.tiles[0];
//     const pathname = new URL(template).pathname;
//     return (
//       pathname.endsWith(".pbf") ||
//       pathname.endsWith(".mvt") ||
//       pathname.endsWith(".mlt")
//     );
//   }

//   get stateUrl() {
//     return this.url;
//   }

//   async getZxy(z: number, x: number, y: number) {
//     const resp = await fetch(this.url);
//     const j = await resp.json();
//     const template = j.tiles[0];
//     const tileURL = template
//       .replace("{z}", z)
//       .replace("{x}", x)
//       .replace("{y}", y);
//     const tileResp = await fetch(tileURL);
//     return await tileResp.arrayBuffer();
//   }

//   async getMetadata() {
//     const resp = await fetch(this.url);
//     return await resp.json();
//   }

//   async getVectorLayers() {
//     const metadata = await this.getMetadata();
//     return metadata.vector_layers.map((l: VectorLayer) => l.id);
//   }

//   async getVectorEncoding() {
//     const resp = await fetch(this.url);
//     const j = await resp.json();
//     const template = j.tiles[0];
//     const pathname = new URL(template).pathname;
//     if (pathname.endsWith(".mlt")) return "mlt";
//     return "mvt";
//   }
// }

// // TODO: Implement RelativePMTilesTileset

// // from a input box or a URL param state.
// export const tilesetFromString = (url: string): Tileset => {
//   const parsed = new URL(url);
//   if (parsed.pathname.endsWith(".json")) {
//     return new TileJSONTileset(url);
//   }
//   // TODO: if relative or if remote
//   return new RemotePMTilesTileset(url);
// };

// export const pmtilesTilesetFromFile = (file: File): LocalPMTilesTileset => {
//   return new LocalPMTilesTileset(file);
// };

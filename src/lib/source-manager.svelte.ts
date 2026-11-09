import { SvelteMap } from "svelte/reactivity";
import {
  MapLibreSourceSpecAdapter,
  RemotePMTilesTileset,
  LocalPMTilesTileset,
  LocalSingleImage,
  RemoteSingleImage,
  type MapLibreSourceSpecType,
  type OverrideMapLibreSourceSpec,
  type PMTilesTileset,
  type SingleImage,
} from "./sources";
import { PMTiles } from "pmtiles";

export type MapLibreSource = {
  source: MapLibreSourceSpecAdapter,
  override: OverrideMapLibreSourceSpec
}

export type SourceKey = `source_${string}-${string}-${string}-${string}-${string}`;

export class SourceManager {
  // TODO: Abstract this out with adapters; that is, elect to have mapLibre, openseadragon, etc.?
  sources: SvelteMap<SourceKey, PMTilesTileset | SingleImage> = new SvelteMap();
  mapLibreSources: SvelteMap<SourceKey, MapLibreSource> = new SvelteMap();

  // Maintain a list of PMTiles archives that can be added to PMTilesProtocol:
  // <PMTilesProtocol pmtiles={this.pmtiles} />
  pmtiles: PMTiles[] = $state([]);

  add(
    source: PMTilesTileset | SingleImage,
    adapters?: {
      mapLibre?: {
        forceSpecType?: MapLibreSourceSpecType,
        override?: OverrideMapLibreSourceSpec,
      }
    }): SourceKey {
    const key: SourceKey = `source_${crypto.randomUUID()}`;
    this.sources.set(key, source);

    if (source.format === "pmtiles") {
      this.pmtiles.push(source.archive);
    }

    // Consider whether we should always add an adapter for each added source
    const forceSpecType = $state(adapters?.mapLibre?.forceSpecType);
    const override = $state(adapters?.mapLibre?.override ?? {});
    const mapLibreSource = {
      source: new MapLibreSourceSpecAdapter(source, forceSpecType),
      override,  // TODO: Prove is reactive!
    }
    this.mapLibreSources.set(key, mapLibreSource);
    return key
  }

  delete(key: SourceKey) {
    this.sources.get(key)?.destroy();
    this.sources.delete(key);
    this.mapLibreSources.delete(key);
    // TODO: Remove pmtiles?
  }

  /* Given a URL, like a static or remote image, return a source. **/
  static urlToSource(url: URL): RemotePMTilesTileset | SingleImage {
    const pathname = url.pathname.toLowerCase();
    let source;
    if (pathname.endsWith(".json")) {
      // TODO: return new TileJSONTileset(url);
      throw Error("JSON not yet supported")
    } else if (pathname.endsWith(".pmtiles")) {
      source = new RemotePMTilesTileset(url.toString());
    } else if ([".jpeg", ".jpg", ".png"].some((extension) => pathname.endsWith(extension))) {
      source = new RemoteSingleImage(url.toString());
    } else {
      throw Error(`Source '${pathname}' is not (yet) supported for parsing.`)
    }
    return source;
  }

  /* Given a File, like one from <input type=file/>, return a source. **/
  static fileToSource(file: File): LocalPMTilesTileset | LocalSingleImage {
    let source;
    if (file.name.endsWith("pmtiles")) {
      source = new LocalPMTilesTileset(file);
    } else if ([".jpeg", ".jpg", ".png"].some((extension) => file.name.endsWith(extension))) {
      source = new LocalSingleImage(file);
    } else {
      // TODO: TileJSONTileset(file);
      throw Error(`File not supported: ${file.name}.`)
    }
    return source;
  }
}

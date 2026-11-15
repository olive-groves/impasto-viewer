// I have a known raster (image) source.
// For example, a PNG, or a PMTiles.
// I want to sample a value from that raster using image XY.

// If a simple image, this sampling is just yoinking the nearest pixels of the XY and interpolating.

// If a tileset, that gets a bit more involved:
// Assume the tileset is a standard quadtree ZXY tile scheme (tile pyramid).
// The coordinate system is normalized 1x1.
// The coordinates are XY in that space.
// The sampling must be from the highest zoom tile (the most zoomed-in tile), at the correct
// XY of that tile.
// Since it can be a huge tileset, we cache the tiles we're querying so that later/neighboring
// queries are less expensive.

// The paradigm is:
// - given a source (PMTiles, image)
//
// - given an XY coordinate in that image
//   or
// - given an XY coordinate in the tileset 1x1 space
// - given the tileset's maximum zoom
// - given the tileset's tile size
//
// - given a sampling method (nearest, bilinear)
//
// - return the value of the XY in that image
//   or
// - return the value of the XY at the highest zoom in that tileset
//
//   RGB -> [R, G, B]
//   mono -> [mono]  (not supported for now)

// YES: Global sampler/source manager
// I spin up a sampler with a cache.
// I pass it an image source, an XY, caches the tile, and out pops a value.
// Later I pass it the same image source, nearby XY, pulls the tile from cache, and out pops a value.

// NO: Per source sampler
// For an image source I spin up a sampler, with its own cache
// etc.
// Hard to manage many sources' caches, because then I have to manage across, rather than a single source

// Use case:
// User draws a line from A to B on three synced PMTiles height (raster-dem) tilesets.
// Get A and B coordinates (LngLat?); convert to 0-1 tileset coordinates ab.
// For each tileset:
// - Pass the tileset source and ab coordinates
// - Find the deepset tile(s) containing those ab coordinates
// - Cache and sample the coordinates
// - Return the values (array<RGB>, for now)
// Since the sources are raster-dem, we know (how) to decode the RGB values into a height value.
// For each tileset, we have heights at A and B.

// Prototype
// Spin up a PMTiles source
// Script out the values
// Box it up
// Send it

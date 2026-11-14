import { bilinearInterpolate } from "$lib/Mathematics.svelte";

// 2D array of pixels, indexed [row][col] / [y][x]
export type ImageValue = number[];
export type ImageCoordinate = {x: number, y: number};
export type ImageNeighbor = {value: ImageValue | null} & ImageCoordinate;
export type ImageNeighborhood = ImageNeighbor[][]

export async function decodeImageDataFromBuffer(data: ArrayBuffer): Promise<ImageData> {
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

export function getUint8ImageDataPixelValue(data: ImageData, x: number, y: number): number[] | null {
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

export function getImageXYNeighborhood(imageData: ImageData, x: number, y: number, kernelSize: number): ImageNeighborhood {
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

export function sample2x2Neighborhood(neighborhood: ImageNeighborhood, coordinate: ImageCoordinate): ImageValue | null {
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

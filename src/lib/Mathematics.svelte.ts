export type ScientificNumberLike =
    ScientificNumber
    | {
        significand: number,
        exponent: number,
    }
    | [
        number,
        number,
    ];
export class ScientificNumber {
    significand: number;
    exponent: number;

    constructor(significand: number, exponent: number) {
        this.significand = significand;
        this.exponent = exponent;
    }

    toNumber(): number {
        return this.significand * 10 ** this.exponent;
    }

    static fromNumber(num: number): ScientificNumber {
        let significand;
        let exponent;
        [significand, exponent] = num.toExponential().split('e').map(Number);
        return new ScientificNumber(significand, exponent)
    }
}
export interface MetricUnit {
    symbol: string,
    prefix: string,
    exponent: number,
}

export function getSmallestGreaterThanOrEqualTo(list: number[], num: number): [number, number] {
    // Example:
    //  list = [1, 4, 7], num = 3 -> 4
    //  list = [1, 4, 7], num = 4 -> 4
    //  list = [1, 4, 7], num = 5 -> 7
    //  list = [1, 4, 7], num = -8 -> 1
    //  list = [1, 4, 7], num = 100 -> 7   Does not fail if more than lowest!
    const i = binaryBisector(list, (i) => list[i] < num, (i) => list[i] > num).upper
    return [list[i], i]
}

export function getLargestLessThanOrEqualTo(list: number[], num: number): [number, number] {
    // Example:
    //  list = [1, 4, 7], num = 3 -> 1
    //  list = [1, 4, 7], num = 4 -> 4
    //  list = [1, 4, 7], num = 5 -> 4
    //  list = [1, 4, 7], num = 100 -> 7
    //  list = [1, 4, 7], num = -8 -> 1  Does not fail if less than lowest!
    const i = binaryBisector(list, (i) => list[i] < num, (i) => list[i] > num).lower
    return [list[i], i]
}

type indexGetter = (cursor: number) => boolean

function binaryBisector(list: number[], lessThan: indexGetter, greaterThan: indexGetter): {lower: number, upper: number} {
    // Bisect a sorted, increasing array
    // https://stackoverflow.com/a/12071013/20921535
    let lower: number = 0;
    let upper: number = list.length;
    while ((upper - lower) > 1) {
        const cursor = Math.floor((lower + upper) / 2);
        if (lessThan(cursor)) {  // If less, set left bound
            lower = cursor;
        } else if (greaterThan(cursor)){  // If greater, set right bound
            upper = cursor;
        } else {  // If equal, is found
            lower = upper = cursor;
        }
    }
    return {lower, upper};
}

export function pyrange(n: number): number[] {
    // Return an n-length array from 0 to n-1, just like Python's `range(n)`
    return [...Array(n).keys()]
}

export function linearInterpolate(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

export function bilinearInterpolate(
  x1y1: number, x2y1: number,
  x1y2: number, x2y2: number,
  fx: number, fy: number,
): number {
  const y1 = linearInterpolate(x1y1, x2y1, fx);
  const y2 = linearInterpolate(x1y2, x2y2, fx);
  return linearInterpolate(y1, y2, fy);
}

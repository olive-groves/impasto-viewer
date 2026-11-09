function p(n: number): "s" | "" {
  return n !== 1 ? "s" : "";
}

export function getFriendlyLocalDateTime(datetime: Date["toISOString"]): string | undefined {
  if (typeof datetime !== "string")
    return undefined;
  const now = new Date();
  const date = new Date(datetime);
  let difference_ms = now.getTime() - date.getTime();
  let n: number;
  let f: string;
  if (difference_ms < 3000) {
    f = `A few seconds ago`
  } else if (difference_ms < 60000) {  // < 60 sec
    n = Math.round(difference_ms / 1000);
    f = `${n} second${p(n)} ago`;
  } else if (difference_ms < 3600000) {  // < 60 min
    n = Math.round(difference_ms / 60000);
    f = `${n} minute${p(n)} ago`;
  } else if (difference_ms < 86400000) {  // < 24 hr
    n = Math.round(difference_ms / 3600000);
    f = `${n} hour${p(n)} ago`;
  } else if (difference_ms < 604800000) {  // < 7 d
    n = Math.round(difference_ms / 86400000);
    f = `${n} day${p(n)} ago (${date.getDay()})`;
  } else {
    f = `${date.getDate()} ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()} (${date.getDay()}) at ${date.getHours()}:${date.getMinutes()}`
  }
  return f
}

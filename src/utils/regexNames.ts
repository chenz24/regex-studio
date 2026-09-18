/** Group identifiers use Unicode escapes even without the u/v flag. */
export function decodeGroupName(name: string): string {
  return name.replace(/\\u(?:\{([\da-fA-F]+)\}|([\da-fA-F]{4}))/g, (raw, braced, fixed) => {
    const code = Number.parseInt(braced ?? fixed, 16);
    // Incomplete/invalid editor input still needs to be renderable.
    return code <= 0x10ffff ? String.fromCodePoint(code) : raw;
  });
}

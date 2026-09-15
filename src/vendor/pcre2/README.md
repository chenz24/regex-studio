# PCRE2 browser runtime

PCRE2 **10.47**, compiled from the official release tag with Emscripten **4.0.21**.
Only the 16-bit interpreter is included, with Unicode support and without JIT,
filesystem, POSIX wrappers, or additional regex engines. Matching offsets are
UTF-16 code units, matching JavaScript strings and CodeMirror positions.

`pcre2.js` and `pcre2.wasm` are generated, checked-in assets. They load only in
the PCRE2 Worker after PCRE2 is selected. Normal `pnpm build` needs no C compiler.

Rebuild with `EMCC=/path/to/emsdk/upstream/emscripten/emcc python3 scripts/build-pcre2.py`.
The script pins the upstream archive SHA-256 and compiler version. To use an
already downloaded source tree, set `PCRE2_SOURCE_DIR` as well.

Upstream: https://github.com/PCRE2Project/pcre2/tree/pcre2-10.47

PCRE2's licence is in `LICENSE.md`. Emscripten-generated glue is covered by the
MIT/NCSA licences: https://github.com/emscripten-core/emscripten/blob/4.0.21/LICENSE
Both notices are also shipped in `public/licenses/` with the deployed assets.

This is PCRE2 in 16-bit mode, not a PHP runtime. Without `u`, characters are
UTF-16 code units; PHP's 8-bit PCRE2 instead operates on bytes. `u` enables UTF
and Unicode character properties in RegexStudio. Replacement syntax is PCRE2's
native `$0`, `$1`, `${name}`, `$$` syntax. Visual parsing and step debugging for
PCRE2 are not yet implemented; the UI explicitly identifies that limitation.

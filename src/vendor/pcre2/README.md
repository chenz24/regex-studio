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
native `$0`, `$1`, `${name}`, `$$` syntax. A separate bounded visual parser supports common PCRE2 constructs; unsupported
syntax remains executable and traceable. Visual editing is not yet implemented.

## Native tracing

`trace.c` is a project-owned bridge using the public `pcre2_callout_block` struct.
It forwards checkpoints into the Worker without hard-coded ABI offsets or a
JavaScript function-pointer table. Debug compilation enables `PCRE2_AUTO_CALLOUT`
and preserves normal optimizations. The callback always returns zero: the recording
budget cannot change matching semantics. Normal matching does not enable callouts.

Only the first match is traced. `pcre2_match` returns the authoritative final ovector;
callout checkpoints are not successful-match events. In 10.47, the observed
`start_match` callout field retains the attempt start after `\K`; the final ovector
contains the reset full-match start. Capture offsets are copied before native
matching resumes, and substring values are materialized only for the selected UI step.

See [PCRE2 callout documentation](https://www.pcre.org/current/doc/html/pcre2callout.html).

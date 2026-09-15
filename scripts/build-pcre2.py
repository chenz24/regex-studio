#!/usr/bin/env python3
"""Build the checked-in PCRE2 runtime with Emscripten 4.0.21.

Usage: EMCC=/path/to/emsdk/upstream/emscripten/emcc python3 scripts/build-pcre2.py
PCRE2_SOURCE_DIR may point at an already extracted official 10.47 source tree.
The regular app build uses the checked-in files and needs no C toolchain.
"""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

VERSION = "10.47"
SHA256 = "409c443549b13b216da40049850a32f3e6c57d4224ab11553ab5a786878a158e"
ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "src/vendor/pcre2"
SOURCES = """auto_possess chartables chkdint compile compile_cgroup compile_class
config context convert dfa_match error extuni find_bracket jit_compile maketables
match match_data match_next newline ord2utf pattern_info script_run serialize
string_utils study substitute substring tables ucd valid_utf xclass""".split()
EXPORTS = ["malloc", "free"] + [f"pcre2_{name}_16" for name in """compile code_free
match_data_create_from_pattern match_data_free match_context_create match_context_free
set_match_limit set_depth_limit set_heap_limit match next_match get_ovector_pointer
pattern_info get_error_message substitute config""".split()]


def main():
    emcc = os.environ.get("EMCC", "emcc")
    version = subprocess.check_output([emcc, "--version"], text=True).splitlines()[0]
    if "4.0.21" not in version:
        raise SystemExit(f"Use Emscripten 4.0.21 for reproducible output; found {version}")
    with tempfile.TemporaryDirectory(prefix="regex-studio-pcre2-") as work:
        work = Path(work)
        if os.environ.get("PCRE2_SOURCE_DIR"):
            source = Path(os.environ["PCRE2_SOURCE_DIR"])
        else:
            archive = work / "pcre2.tar.gz"
            urllib.request.urlretrieve(
                f"https://github.com/PCRE2Project/pcre2/archive/refs/tags/pcre2-{VERSION}.tar.gz",
                archive,
            )
            if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
                raise SystemExit("PCRE2 archive checksum mismatch")
            with tarfile.open(archive) as tar:
                tar.extractall(work, filter="data")
            source = work / f"pcre2-pcre2-{VERSION}"
        headers = work / "include"
        headers.mkdir()
        for name in ("config.h", "pcre2.h"):
            shutil.copyfile(source / "src" / f"{name}.generic", headers / name)
        shutil.copyfile(source / "src/pcre2_chartables.c.dist", headers / "pcre2_chartables.c")
        OUTPUT.mkdir(parents=True, exist_ok=True)
        command = [emcc, "-Oz", "-flto", "-DHAVE_CONFIG_H", "-DPCRE2_CODE_UNIT_WIDTH=16",
                   "-DSUPPORT_PCRE2_16", "-DSUPPORT_UNICODE", "-DHAVE_MEMMOVE",
                   "-DHAVE_STDLIB_H", "-DHAVE_STDINT_H", "-DHAVE_INTTYPES_H",
                   "-I" + str(headers), "-I" + str(source / "src")]
        command += [str((headers if name == "chartables" else source / "src") /
                        f"pcre2_{name}.c") for name in SOURCES]
        command += ["--no-entry", "-sMODULARIZE=1", "-sEXPORT_ES6=1",
                    "-sENVIRONMENT=web,worker", "-sFILESYSTEM=0", "-sASSERTIONS=0",
                    "-sALLOW_MEMORY_GROWTH=1", "-sINITIAL_MEMORY=8388608",
                    "-sMAXIMUM_MEMORY=67108864", "-sSTACK_SIZE=65536",
                    "-sEXPORTED_FUNCTIONS=" + str(["_" + name for name in EXPORTS]),
                    "-sEXPORTED_RUNTIME_METHODS=['HEAPU16','HEAPU32']",
                    "-sINCOMING_MODULE_JS_API=['wasmBinary','locateFile']",
                    "-o", str(OUTPUT / "pcre2.js")]
        subprocess.run(command, check=True)
        shutil.copyfile(source / "LICENCE.md", OUTPUT / "LICENSE.md")
        notices = ROOT / "public/licenses"
        notices.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / "LICENCE.md", notices / "pcre2.txt")
        emscripten_license = Path(shutil.which(emcc) or emcc).resolve().parent / "LICENSE"
        shutil.copyfile(emscripten_license, notices / "emscripten.txt")
        print(f"Built PCRE2 {VERSION}: {OUTPUT}")


if __name__ == "__main__":
    main()

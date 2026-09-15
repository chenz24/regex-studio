export interface Pcre2Module {
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _pcre2_compile_16(...args: number[]): number;
  _pcre2_code_free_16(...args: number[]): number;
  _pcre2_match_data_create_from_pattern_16(...args: number[]): number;
  _pcre2_match_data_free_16(...args: number[]): number;
  _pcre2_match_context_create_16(...args: number[]): number;
  _pcre2_match_context_free_16(...args: number[]): number;
  _pcre2_set_match_limit_16(...args: number[]): number;
  _pcre2_set_depth_limit_16(...args: number[]): number;
  _pcre2_set_heap_limit_16(...args: number[]): number;
  _pcre2_match_16(...args: number[]): number;
  _pcre2_next_match_16(...args: number[]): number;
  _pcre2_get_ovector_pointer_16(...args: number[]): number;
  _pcre2_pattern_info_16(...args: number[]): number;
  _pcre2_get_error_message_16(...args: number[]): number;
  _pcre2_substitute_16(...args: number[]): number;
  _pcre2_config_16(...args: number[]): number;
}

export default function createModule(options?: {
  wasmBinary?: Uint8Array;
  locateFile?: (path: string) => string;
}): Promise<Pcre2Module>;

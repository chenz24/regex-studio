/* Project-owned bridge: use PCRE2's public struct instead of hard-coded offsets. */
#include <pcre2.h>
#include <emscripten.h>

EM_JS(void, rs_trace_event, (unsigned pattern, unsigned length, unsigned position,
    unsigned start, unsigned flags, unsigned top, const size_t *vector,
    unsigned number), {
  Module['onTrace'](pattern, length, position, start, flags, top, vector, number);
});

static int trace_callout(pcre2_callout_block *block, void *user_data) {
  (void)user_data;
  rs_trace_event(block->pattern_position, block->next_item_length,
    block->current_position, block->start_match, block->callout_flags,
    block->capture_top, block->offset_vector, block->callout_number);
  /* Recording limits must never change whether a match succeeds. */
  return 0;
}

void rs_set_trace(pcre2_match_context *context) {
  pcre2_set_callout(context, trace_callout, NULL);
}

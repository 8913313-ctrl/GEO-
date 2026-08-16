import assert from 'node:assert/strict';
import { buildSelectorTelemetry, serializePlatformResult } from '../src/platform-result.js';

const successfulInput = {
  adapter: 'GenericEditorAdapter',
  platformId: 'juejin',
  state: 'draft_saved',
  selectors: {
    title: 'input[name="title"]',
    body: '.editor-body',
    draft: '#save-draft',
  },
  selector_details: {
    title: { candidate_index: 0, attempted: 1, candidate_count: 3 },
    body: { candidate_index: 1, attempted: 2, candidate_count: 4 },
    draft: { candidate_index: 0, attempted: 1, candidate_count: 2 },
  },
};

const successfulTelemetry = buildSelectorTelemetry(successfulInput);
assert.deepEqual(successfulTelemetry, {
  schema_version: 1,
  adapter: 'GenericEditorAdapter',
  platform_id: 'juejin',
  state: 'draft_saved',
  steps: {
    title: {
      status: 'hit',
      selector: 'input[name="title"]',
      selectors: undefined,
      candidate_index: 0,
      attempted: 1,
      candidate_count: 3,
    },
    body: {
      status: 'hit',
      selector: '.editor-body',
      selectors: undefined,
      candidate_index: 1,
      attempted: 2,
      candidate_count: 4,
    },
    draft: {
      status: 'hit',
      selector: '#save-draft',
      selectors: undefined,
      candidate_index: 0,
      attempted: 1,
      candidate_count: 2,
    },
  },
}, 'the second selector candidate must be observable as a hit');

const failedTelemetry = buildSelectorTelemetry({
  adapter_name: 'GenericEditorAdapter',
  platform_id: 'juejin',
  state: 'failed',
  failure_category: 'editor_fields_not_recognized',
  selectors: { title: null, body: null, draft: null },
  fill: { title: false, body: false, draft_saved: false },
  selector_details: {
    title: { attempted: 6, candidate_count: 6 },
    body: { attempted: 9, candidate_count: 9 },
    draft: { attempted: 4, candidate_count: 4 },
  },
});

assert.equal(failedTelemetry.steps.title.status, 'miss');
assert.equal(failedTelemetry.steps.title.selector, null);
assert.equal(failedTelemetry.steps.title.candidate_index, null);
assert.equal(failedTelemetry.steps.title.attempted, 6);
assert.equal(failedTelemetry.steps.title.candidate_count, 6);
assert.equal(failedTelemetry.steps.body.status, 'miss');
assert.equal(failedTelemetry.steps.body.attempted, 9);
assert.equal(failedTelemetry.steps.body.candidate_count, 9);
assert.equal(failedTelemetry.steps.draft.status, 'miss');
assert.equal(failedTelemetry.steps.draft.attempted, 4);
assert.equal(failedTelemetry.steps.draft.candidate_count, 4);

const serialized = serializePlatformResult({
  ...successfulInput,
  message: 'Draft saved',
  execution_mode: 'assisted',
  next_action: 'operator_confirm_publish',
});
assert.deepEqual(serialized.selector_telemetry, successfulTelemetry);
const jsonRoundTrip = JSON.parse(JSON.stringify(serialized));
assert.deepEqual(jsonRoundTrip.selector_telemetry.steps.body, {
  status: 'hit',
  selector: '.editor-body',
  candidate_index: 1,
  attempted: 2,
  candidate_count: 4,
}, 'selector telemetry must remain valid and useful after JSON serialization');

const precomputedTelemetry = {
  schema_version: 1,
  adapter: 'DedicatedAdapter',
  platform_id: 'zhihu',
  state: 'published',
  steps: { publish: { status: 'hit', selector: '#publish' } },
};
assert.strictEqual(buildSelectorTelemetry({ selector_telemetry: precomputedTelemetry }), precomputedTelemetry);
assert.strictEqual(serializePlatformResult({ state: 'published', selector_telemetry: precomputedTelemetry }).selector_telemetry, precomputedTelemetry);

console.log('Selector telemetry contract passed.');

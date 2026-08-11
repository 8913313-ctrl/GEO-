import assert from "node:assert/strict";
import {
  applyPublicCitationVisibility,
  publicCitationMarkersVisible,
  stripCitationMarkers
} from "../citation-visibility.mjs";

const content = '<p>First fact <button class="citation-marker" data-citation-id="CIT-1">[K1]</button> and second fact <sup data-evidence-id="EVID-2">[K2]</sup>.</p>';

assert.equal(publicCitationMarkersVisible({}), false, "citation markers must be private by default");
assert.equal(publicCitationMarkersVisible({ showPublicCitationMarkers: false }), false);
assert.equal(publicCitationMarkersVisible({ showPublicCitationMarkers: true }), true);
assert.equal(publicCitationMarkersVisible({ site: { showPublicCitationMarkers: "true" } }), true);

const hidden = stripCitationMarkers(content);
assert.doesNotMatch(hidden, /\[(?:K1|K2)\]/);
assert.doesNotMatch(hidden, /data-(?:citation|evidence)-id/);
assert.match(hidden, /First fact/);
assert.match(hidden, /second fact/);

assert.equal(applyPublicCitationVisibility(content, { showPublicCitationMarkers: true }), content);
assert.equal(applyPublicCitationVisibility(content, { showPublicCitationMarkers: false }), hidden);

console.log("Citation visibility check passed");
import assert from 'node:assert/strict';
import { RuntimeLogBuffer } from '../src/log-buffer.js';

const buffer = new RuntimeLogBuffer(200);

for (let index = 0; index < 250; index += 1) {
  buffer.add('info', 'test.event', `log ${index}`);
}

assert.equal(buffer.list().length, 200);
assert.equal(buffer.list()[0].message, 'log 249');
assert.equal(buffer.list().at(-1).message, 'log 50');

buffer.clear();
assert.equal(buffer.list().length, 1);
assert.equal(buffer.list()[0].event, 'logs.cleared');
console.log('Log buffer behavior passed.');

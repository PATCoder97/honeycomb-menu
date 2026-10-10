const test = require('node:test');
const assert = require('node:assert/strict');

const {
    HoneycombHistory,
    normalizeIdleTimeout
} = require('../src/honeycomb-history.js');

test('nested menus return through the complete history in reverse order', () => {
    const history = new HoneycombHistory(value => structuredClone(value));

    history.open({ id: 'root' });
    history.open({ id: 'child' }, { nested: true });
    history.open({ id: 'grandchild' }, { nested: true });

    assert.equal(history.stack.length, 2);
    assert.deepEqual(history.back(), { id: 'child' });
    assert.deepEqual(history.back(), { id: 'root' });
    assert.equal(history.back(), null);
});

test('history clones configs and clear removes both current and previous menus', () => {
    const history = new HoneycombHistory(value => structuredClone(value));
    const config = { nested: { enabled: true } };

    history.open(config);
    config.nested.enabled = false;
    assert.equal(history.currentConfig.nested.enabled, true);

    history.open({ id: 'child' }, { nested: true });
    history.clear();
    assert.equal(history.currentConfig, null);
    assert.deepEqual(history.stack, []);
});

test('reset discards prior navigation before opening a new root menu', () => {
    const history = new HoneycombHistory(value => structuredClone(value));

    history.open({ id: 'root' });
    history.open({ id: 'child' }, { nested: true });
    history.open({ id: 'replacement' }, { reset: true });

    assert.deepEqual(history.currentConfig, { id: 'replacement' });
    assert.deepEqual(history.stack, []);
});

test('idle timeout accepts only finite positive millisecond values', () => {
    assert.equal(normalizeIdleTimeout(2500), 2500);
    assert.equal(normalizeIdleTimeout('500'), 500);
    assert.equal(normalizeIdleTimeout(0), 0);
    assert.equal(normalizeIdleTimeout(-1), 0);
    assert.equal(normalizeIdleTimeout('invalid'), 0);
    assert.equal(normalizeIdleTimeout(Infinity), 0);
});

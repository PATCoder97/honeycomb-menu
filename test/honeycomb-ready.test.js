const test = require('node:test');
const assert = require('node:assert/strict');
const { contentReady, waitForContent } = require('../src/honeycomb-ready.js');
const root = nodes => ({ querySelectorAll: () => nodes });
const path = { localName: 'path', getAttribute: name => name === 'd' ? 'M0 0L1 1' : null };
const icon = { localName: 'ha-icon', icon: 'mdi:lightbulb', shadowRoot: root([]) };

test('opening waits for nested HA SVG paths and pending card updates', () => {
    icon.shadowRoot = root([]);
    assert.equal(contentReady(root([icon])), false);
    icon.shadowRoot = root([{ localName: 'ha-svg-icon', shadowRoot: root([path]) }]);
    assert.equal(contentReady(root([icon])), true);
    assert.equal(contentReady(root([{localName:'button-card', isUpdatePending:true, shadowRoot:root([icon])}])), false);
    assert.equal(contentReady(root([{localName:'button-card'}])), false);
    assert.equal(contentReady(root([{localName:'ha-state-icon'}])), true);
});

test('delayed icon readiness is awaited without mutating its layout', async () => {
    const delayed = {localName:'ha-icon',icon:'mdi:fan',shadowRoot:root([])};
    const controller = new AbortController();
    setTimeout(() => {delayed.shadowRoot=root([path]);}, 40);
    assert.equal(await waitForContent(root([delayed]), controller.signal), true);
    assert.equal(delayed.icon,'mdi:fan');
});

test('failed icons have a bounded fallback and closing cancels opening', async () => {
    const missing = {localName:'ha-icon',icon:'mdi:missing',shadowRoot:root([])};
    assert.equal(await waitForContent(root([missing]), new AbortController().signal, 30), true);
    const controller = new AbortController();
    const pending = waitForContent(root([missing]),controller.signal);
    controller.abort();
    assert.equal(await pending,false);
});

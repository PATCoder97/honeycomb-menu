const test = require('node:test');
const assert = require('node:assert/strict');

const {
    assignButtons,
    animationStep,
    buttonPosition,
    centerPosition,
    containerMetrics,
    isPastDragDeadzone
} = require('../src/honeycomb-layout.js');

function entries(count)
{
    return Array.from({ length: count }, (_, index) => ({
        button: { id: index + 1 },
        sourceIndex: index
    }));
}

test('classic layouts preserve all six original slots and dimensions', () => {
    const layout = assignButtons(entries(6));

    assert.deepEqual(layout.rings, { inner: true, outer: false });
    assert.deepEqual(layout.buttons.map(button => button.id), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(buttonPosition(0, layout.rings), { x: 0, y: 0.865 });
    assert.deepEqual(buttonPosition(5, layout.rings), { x: 0.5, y: 1.725 });
    assert.deepEqual(centerPosition(layout.rings), { x: 1, y: 0.865 });

    const metrics = containerMetrics(225, layout.rings);
    assert.equal(metrics.containerWidth, metrics.item * 3);
    assert.equal(metrics.containerHeight, metrics.item * 2.9);
});

test('the outer ring activates only after the sixth automatic button', () => {
    const six = assignButtons(entries(6));
    const seven = assignButtons(entries(7));

    assert.equal(six.rings.outer, false);
    assert.equal(seven.rings.outer, true);
    assert.equal(seven.buttons.length, 18);
    assert.deepEqual(seven.buttons.slice(0, 7).map(button => button.id), [1, 2, 3, 4, 5, 6, 7]);
    assert.ok(seven.buttons.slice(7).every(button => Object.keys(button).length === 0));
    assert.deepEqual(buttonPosition(6, seven.rings), { x: 0, y: 1.73 });
    assert.deepEqual(centerPosition(seven.rings), { x: 2, y: 1.73 });
});

test('eighteen buttons fill both rings and extra buttons are rejected', () => {
    const layout = assignButtons(entries(20));

    assert.deepEqual(layout.buttons.map(button => button.id), entries(18).map(entry => entry.button.id));
    assert.match(layout.warnings[0], /at most 18/);
});

test('hard slots are absolute and an outer hard slot activates the second ring', () => {
    const layout = assignButtons([
        { button: { id: 'outer', slot: 18, slot_mode: 'hard' } },
        { button: { id: 'auto' } }
    ], 'hidden');

    assert.equal(layout.rings.outer, true);
    assert.equal(layout.buttons[17].id, 'outer');
    assert.equal(layout.buttons[0].id, 'auto');
    assert.equal(layout.buttons[1], undefined);
});

test('legacy position zero remains a valid hard position', () => {
    const layout = assignButtons([
        { button: { id: 'fixed', position: 0 } },
        { button: { id: 'auto' } }
    ]);

    assert.equal(layout.buttons[0].id, 'fixed');
    assert.equal(layout.buttons[1].id, 'auto');
});

test('soft slots wrap to the inner ring and move clockwise around collisions', () => {
    const layout = assignButtons([
        { button: { id: 'hard', slot: 1, slot_mode: 'hard' } },
        { button: { id: 'soft-collision', slot: 1 } },
        { button: { id: 'soft-wrap', slot: 8 } }
    ], 'hidden');

    assert.equal(layout.rings.outer, false);
    assert.equal(layout.buttons[0].id, 'hard');
    assert.equal(layout.buttons[1].id, 'soft-collision');
    assert.equal(layout.buttons[2].id, 'soft-wrap');
});

test('invalid slots fall back to automatic placement without losing buttons', () => {
    const layout = assignButtons([
        { button: { id: 'invalid', slot: 99 } },
        { button: { id: 'next' } }
    ], 'hidden');

    assert.equal(layout.buttons[0].id, 'invalid');
    assert.equal(layout.buttons[1].id, 'next');
    assert.match(layout.warnings[0], /invalid slot/);
});

test('animation modes retain legacy timing and offer sequential or paired timing', () => {
    assert.deepEqual(Array.from({ length: 6 }, (_, slot) => animationStep(slot)), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(Array.from({ length: 6 }, (_, slot) => animationStep(slot, 'sequential')), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(Array.from({ length: 6 }, (_, slot) => animationStep(slot, 'paired')), [1, 2, 3, 1, 2, 3]);
    assert.deepEqual(Array.from({ length: 12 }, (_, index) => animationStep(index + 6, 'paired')), [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]);
});

test('drag deadzone uses Euclidean distance and rejects invalid coordinates', () => {
    assert.equal(isPastDragDeadzone(0, 0, 3, 4, 5), true);
    assert.equal(isPastDragDeadzone(0, 0, 3, 4, 6), false);
    assert.equal(isPastDragDeadzone(0, 0, 0, 0, 0), true);
    assert.equal(isPastDragDeadzone(null, 0, 3, 4, 5), false);
});

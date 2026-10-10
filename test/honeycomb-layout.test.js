const test = require('node:test');
const assert = require('node:assert/strict');

const {
    HEXAGON_HEIGHT_RATIO,
    HEXAGON_ROW_STEP,
    assignButtons,
    animationStep,
    buttonPosition,
    centerPosition,
    containerMetrics,
    isPastDragDeadzone
} = require('../src/honeycomb-layout.js');

function approximatelyEqual(actual, expected, epsilon = 1e-12)
{
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

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
    approximatelyEqual(buttonPosition(0, layout.rings).y, HEXAGON_ROW_STEP);
    approximatelyEqual(buttonPosition(5, layout.rings).y, HEXAGON_ROW_STEP * 2);
    approximatelyEqual(centerPosition(layout.rings).y, HEXAGON_ROW_STEP);

    const metrics = containerMetrics(225, layout.rings, 2);
    assert.equal(metrics.containerWidth, metrics.item * 3);
    approximatelyEqual(metrics.hexagonWidth, metrics.item - 4);
    approximatelyEqual(metrics.hexagonHeight, metrics.hexagonWidth * HEXAGON_HEIGHT_RATIO);
    approximatelyEqual(
        metrics.containerHeight,
        (metrics.item * HEXAGON_ROW_STEP * 2) + metrics.hexagonHeight + 4
    );
});

test('the outer ring activates only after the sixth automatic button', () => {
    const six = assignButtons(entries(6));
    const seven = assignButtons(entries(7));

    assert.equal(six.rings.outer, false);
    assert.equal(seven.rings.outer, true);
    assert.equal(seven.buttons.length, 18);
    assert.deepEqual(seven.buttons.slice(0, 7).map(button => button.id), [1, 2, 3, 4, 5, 6, 7]);
    assert.ok(seven.buttons.slice(7).every(button => Object.keys(button).length === 0));
    approximatelyEqual(buttonPosition(6, seven.rings).y, HEXAGON_ROW_STEP * 2);
    approximatelyEqual(centerPosition(seven.rings).y, HEXAGON_ROW_STEP * 2);
});

test('regular hexagon rows use one exact step throughout both rings', () => {
    const layout = assignButtons(entries(18));
    const topRows = [8, 7, 6, 13, 16].map(slot => buttonPosition(slot, layout.rings).y);

    for( let index = 1; index < topRows.length; index++ )
        approximatelyEqual(topRows[index] - topRows[index - 1], HEXAGON_ROW_STEP);

    approximatelyEqual(HEXAGON_HEIGHT_RATIO * 0.75, HEXAGON_ROW_STEP);
});

test('hexagon edges and gaps stay regular across menu sizes and spacing values', () => {
    const layout = assignButtons(entries(18));

    for( const size of [160, 225, 320] )
    {
        for( const spacing of [0, 1, 2, 5] )
        {
            const metrics = containerMetrics(size, layout.rings, spacing);
            const slopedEdge = Math.hypot(
                metrics.hexagonWidth / 2,
                metrics.hexagonHeight / 4
            );

            approximatelyEqual(slopedEdge, metrics.hexagonHeight / 2);
            approximatelyEqual(metrics.item - metrics.hexagonWidth, spacing * 2);

            const centers = [
                ...Array.from({ length: 18 }, (_, slot) => buttonPosition(slot, layout.rings)),
                centerPosition(layout.rings)
            ].map(position => ({
                x: position.x * metrics.item + metrics.spacing + metrics.hexagonWidth / 2,
                y: position.y * metrics.item + metrics.spacing + metrics.hexagonHeight / 2
            }));

            for( let first = 0; first < centers.length; first++ )
            {
                for( let second = first + 1; second < centers.length; second++ )
                {
                    const distance = Math.hypot(
                        centers[first].x - centers[second].x,
                        centers[first].y - centers[second].y
                    );

                    if( distance < metrics.item * 1.01 )
                    {
                        approximatelyEqual(distance, metrics.item, 1e-10);
                        approximatelyEqual(distance - metrics.hexagonWidth, spacing * 2, 1e-10);
                    }
                }
            }
        }
    }
});

test('spacing is clamped before it can invert a hexagon', () => {
    const rings = { inner: true, outer: false };
    const negative = containerMetrics(225, rings, -5);
    const excessive = containerMetrics(225, rings, 999);

    assert.equal(negative.spacing, 0);
    approximatelyEqual(negative.hexagonWidth, negative.item);
    approximatelyEqual(excessive.spacing, excessive.item / 2);
    assert.equal(excessive.hexagonWidth, 0);
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

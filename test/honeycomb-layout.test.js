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
    approximatelyEqual(buttonPosition(5, layout.rings).y, Math.sqrt(3));
    approximatelyEqual(centerPosition(layout.rings).y, HEXAGON_ROW_STEP);

    const metrics = containerMetrics(225, layout.rings, 2);
    assert.equal(metrics.containerWidth, metrics.item * 3);
    approximatelyEqual(metrics.hexagonWidth, metrics.item - 4);
    approximatelyEqual(metrics.hexagonHeight, metrics.hexagonWidth * HEXAGON_HEIGHT_RATIO);
    approximatelyEqual(metrics.containerHeight, metrics.item * Math.sqrt(3) + metrics.hexagonHeight + 4);
});

test('the outer ring activates only after the sixth automatic button', () => {
    const six = assignButtons(entries(6));
    const seven = assignButtons(entries(7));

    assert.equal(six.rings.outer, false);
    assert.equal(seven.rings.outer, true);
    assert.equal(seven.buttons.length, 18);
    assert.deepEqual(seven.buttons.slice(0, 7).map(button => button.id), [1, 2, 3, 4, 5, 6, 7]);
    assert.ok(seven.buttons.slice(7).every(button => Object.keys(button).length === 0));
    approximatelyEqual(buttonPosition(6, seven.rings).y, Math.sqrt(3));
    approximatelyEqual(centerPosition(seven.rings).y, Math.sqrt(3));
});

test('both rings use one regular hexagon row step', () => {
    const layout = assignButtons(entries(18));
    const topRows = [8, 7, 6, 13, 16].map(slot => buttonPosition(slot, layout.rings).y);

    topRows.forEach((value, index) => approximatelyEqual(value, index * Math.sqrt(3) / 2));
});

test('all six edges and perpendicular neighbor gaps are equal in both rings including center', () => {
    const layout = assignButtons(entries(18));

    for( const size of [160, 225, 260, 320, 480] )
    {
        for( const spacing of [0, 0.5, 1, 1.25, 2, 5] )
        {
            const metrics = containerMetrics(size, layout.rings, spacing);
            const w = metrics.hexagonWidth, h = metrics.hexagonHeight;
            const vertices = [[w/2,0], [w,h/4], [w,3*h/4], [w/2,h], [0,3*h/4], [0,h/4]];
            const edges = vertices.map((v, i) => {
                const next = vertices[(i + 1) % 6];
                return { start: v, dx: next[0] - v[0], dy: next[1] - v[1] };
            });
            edges.forEach(edge => {
                const length = Math.hypot(edge.dx, edge.dy);
                approximatelyEqual(length, h/2, 1e-10);
                // Distance from center to supporting line: the apothem.
                const apothem = Math.abs(edge.dx * (h/2 - edge.start[1]) - edge.dy * (w/2 - edge.start[0])) / length;
                approximatelyEqual(apothem, w/2, 1e-10);
            });
            for( const rings of [{inner:true,outer:false}, {inner:true,outer:true}] ) {
                const positions = Array.from({length: rings.outer ? 18 : 6}, (_, slot) => buttonPosition(slot, rings));
                positions.push(centerPosition(rings));
                let neighbors = 0;
                for( let a = 0; a < positions.length; a++ ) {
                    for( let b = a + 1; b < positions.length; b++ ) {
                        const dx = (positions[b].x - positions[a].x) * metrics.item;
                        const dy = (positions[b].y - positions[a].y) * metrics.item;
                        if( Math.hypot(dx,dy) > metrics.item * 1.01 ) continue;
                        neighbors++;
                        const facing = edges.find(edge => Math.abs(edge.dx*dx + edge.dy*dy) < 1e-8);
                        assert.ok(facing, 'Neighbor direction must be perpendicular to a hexagon edge');
                        const normalDistance = Math.abs(facing.dx*dy - facing.dy*dx) / Math.hypot(facing.dx,facing.dy);
                        approximatelyEqual(normalDistance - w, spacing*2, 1e-10);
                    }
                }
                assert.equal(neighbors, rings.outer ? 42 : 12);
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

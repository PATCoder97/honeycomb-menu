const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MENU_DEFAULTS,
    computeItemConfig,
    normalizeMenuConfig,
    traverseMenuConfig
} = require('../src/honeycomb-config.js');

test('new features are opt-in and classic six-button behavior remains the default', () => {
    const config = normalizeMenuConfig({ buttons: [] });

    assert.equal(config.size, 225);
    assert.equal(config.spacing, 2);
    assert.equal(config.animation_speed, 100);
    assert.equal(config.animation_mode, 'legacy');
    assert.equal(config.drag_select, false);
    assert.equal(config.center_button, false);
    assert.equal(config.idle_timeout, 0);
    assert.equal(config.style, 'mushroom');
});

test('invalid enum options fall back without mutating the caller config', () => {
    const source = {
        style: 'round',
        animation_mode: 'random',
        empty_slots: 'sometimes'
    };
    const config = normalizeMenuConfig(source);

    assert.equal(config.style, MENU_DEFAULTS.style);
    assert.equal(config.animation_mode, MENU_DEFAULTS.animation_mode);
    assert.equal(config.empty_slots, MENU_DEFAULTS.empty_slots);
    assert.equal(source.style, 'round');
});

test('button defaults merge deeply and individual button values win', () => {
    const menu = normalizeMenuConfig({
        entity: 'light.room',
        button_defaults: {
            color: 'red',
            styles: {
                card: [{ border: 'none' }],
                icon: [{ width: '20px' }]
            }
        },
        buttons: []
    });
    const item = computeItemConfig(menu, {
        color: 'blue',
        slot: 4,
        styles: { icon: [{ width: '30px' }] }
    });

    assert.equal(item.entity, 'light.room');
    assert.equal(item.color, 'blue');
    assert.deepEqual(item.styles.card, [{ border: 'none' }]);
    assert.deepEqual(item.styles.icon, [{ width: '30px' }]);
    assert.equal(item.button_defaults, undefined);
    assert.equal(item.slot, undefined);
    assert.equal(item.drag_select, undefined);
});

test('empty item configs remain empty disabled placeholders', () => {
    assert.deepEqual(computeItemConfig(normalizeMenuConfig({}), {}), {});
});

test('template traversal preserves skip, break, override, and position zero semantics', () => {
    const templates = {
        parent: {
            active: true,
            buttons: [
                { id: 'parent-zero', position: 0 },
                { id: 'parent-one' },
                { id: 'parent-two' }
            ]
        }
    };
    const config = traverseMenuConfig({
        template: 'parent',
        buttons: [
            'skip',
            { id: 'child-one' },
            'break'
        ]
    }, templates);

    assert.equal(config.template, undefined);
    assert.equal(config.active, true);
    assert.deepEqual(config.buttons[0], ['skip', { id: 'parent-zero', position: 0 }]);
    assert.deepEqual(config.buttons[1], [{ id: 'child-one' }, { id: 'parent-one' }]);
    assert.deepEqual(config.buttons[2], ['break', { id: 'parent-two' }]);
});

test('template traversal supports all 18 button indexes and stops template cycles', () => {
    const buttons = Array.from({ length: 18 }, (_, index) => ({ id: index + 1 }));
    const config = traverseMenuConfig({ template: 'loop', buttons }, {
        loop: { template: 'loop', entity: 'light.safe' }
    });

    assert.equal(config.buttons.length, 18);
    assert.equal(config.buttons[17][0].id, 18);
    assert.equal(config.entity, 'light.safe');
});

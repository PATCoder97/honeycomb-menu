const merge = require('lodash/merge');
const omit = require('lodash/omit');
const isEmpty = require('lodash/isEmpty');

const MENU_DEFAULTS = Object.freeze({
    action: 'hold',
    entity: null,
    active: false,
    autoclose: true,
    audio: false,
    variables: {},
    size: 225,
    spacing: 2,
    animation_speed: 100,
    animation_mode: 'legacy',
    drag_select: false,
    drag_deadzone: 12,
    hover_highlight: true,
    nested_center_back: true,
    button_defaults: {},
    empty_slots: 'visible',
    center_button: false,
    center_brightness: 0,
    idle_timeout: 0,
    style: 'mushroom'
});

const ITEM_OMIT_KEYS = [
    'buttons',
    'size',
    'action',
    'xy_pad',
    'spacing',
    'animation_speed',
    'animation_mode',
    'drag_select',
    'drag_deadzone',
    'hover_highlight',
    'nested_center_back',
    'button_defaults',
    'empty_slots',
    'center_button',
    'center_brightness',
    'idle_timeout',
    'slot',
    'slot_mode',
    'position',
    'style'
];

function normalizeMenuConfig(config)
{
    const normalized = merge({}, MENU_DEFAULTS, config || {});

    if( ! ['mushroom', 'classic'].includes(normalized.style) )
        normalized.style = MENU_DEFAULTS.style;
    if( ! ['legacy', 'sequential', 'paired'].includes(normalized.animation_mode) )
        normalized.animation_mode = MENU_DEFAULTS.animation_mode;
    if( ! ['visible', 'hidden'].includes(normalized.empty_slots) )
        normalized.empty_slots = MENU_DEFAULTS.empty_slots;

    return normalized;
}

function computeItemConfig(menuConfig, item)
{
    if( isEmpty(item) )
        return item;

    return omit(
        merge({}, menuConfig, menuConfig.button_defaults || {}, item),
        ITEM_OMIT_KEYS
    );
}

function traverseMenuConfig(config, templates, buttonStacks = [], visited = new Set())
{
    const current = merge({}, config || {});

    function bindButtons(source)
    {
        if( Array.isArray(source.buttons) )
        {
            source.buttons.forEach((button, index) => {
                const position = button && button.position !== undefined
                    ? Number(button.position)
                    : index;

                if( ! Number.isInteger(position) || position < 0 || position > 17 )
                    return;

                if( ! buttonStacks[position] )
                    buttonStacks[position] = [];

                buttonStacks[position].unshift(button);
            });
        }

        return { buttons: buttonStacks };
    }

    const templateName = current.template;

    if( ! templateName || ! templates || ! templates[templateName] || visited.has(templateName) )
        return Object.assign({}, current, bindButtons(current));

    visited.add(templateName);
    const parentConfig = traverseMenuConfig(
        templates[templateName],
        templates,
        buttonStacks,
        visited
    );
    visited.delete(templateName);
    delete current.template;

    return Object.assign({}, parentConfig, current, bindButtons(current));
}

module.exports = {
    MENU_DEFAULTS,
    computeItemConfig,
    normalizeMenuConfig,
    traverseMenuConfig
};

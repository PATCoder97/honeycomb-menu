import { LitElement, html, css } from 'lit';
import "./pat97-honeycomb-menu-item.js";
import "./pat97-xy-pad.js";
import { objectEvalTemplate, getTemplateOrValue, stringToBool, fireEvent, lovelace_view, provideHass, honeycomb_menu_templates } from "./helpers.js";

const merge = require('lodash/merge');
const split = require('lodash/split');
const clamp = require('lodash/clamp');
const _template = require('lodash/template');
const isEmpty = require('lodash/isEmpty');
const isString = require('lodash/isString');
const {
    computeItemConfig,
    normalizeMenuConfig,
    traverseMenuConfig
} = require('./honeycomb-config.js');
const {
    assignButtons,
    animationStep,
    buttonPosition,
    centerPosition,
    containerMetrics,
    isPastDragDeadzone
} = require('./honeycomb-layout.js');
const {
    HoneycombHistory,
    normalizeIdleTimeout
} = require('./honeycomb-history.js');

const manager = new function() {
    this.honeycomb = null;
    this.history = new HoneycombHistory(config => merge({}, config));
    this.pointerDown = false;
    this.pointerId = null;
    this.position = {
        x: 0,
        y: 0
    };
    this.handleXYPosition = function(e) {
        this.position.x = (e.type === "touchstart") ? e.touches[0].clientX : e.clientX;
        this.position.y = (e.type === "touchstart") ? e.touches[0].clientY : e.clientY;
    }.bind(this);

    this.handlePointerDown = function(e) {
        this.pointerDown = true;
        this.pointerId = e.pointerId;
        this.position.x = e.clientX;
        this.position.y = e.clientY;
    }.bind(this);

    this.handlePointerUp = function(e) {
        if( this.pointerId === null || e.pointerId === this.pointerId )
        {
            this.pointerDown = false;
            this.pointerId = null;
        }
    }.bind(this);
};

window.honeycomb_menu = (config) => {
    var honeycombConfig = traverseConfigs( config );

    if( honeycombConfig.entity_id && ! honeycombConfig.entity )
        honeycombConfig.entity = honeycombConfig.entity_id;

    const nested = !! manager.honeycomb && !! manager.history.currentConfig;
    showHoneycombMenu( honeycombConfig, { nested } );
};

document.addEventListener('touchstart', manager.handleXYPosition, false);
document.addEventListener('mousedown', manager.handleXYPosition, false);
document.addEventListener('pointerdown', manager.handlePointerDown, true);
document.addEventListener('pointerup', manager.handlePointerUp, true);
document.addEventListener('pointercancel', manager.handlePointerUp, true);

document.body.addEventListener("ll-custom", e => {
    if(e.detail.honeycomb_menu)
    {
        window.honeycomb_menu( e.detail.honeycomb_menu );
    }
});

function showHoneycombMenu( _config, options = {} )
{
    const previous = manager.honeycomb;

    manager.history.open(_config, options);

    if( previous )
        previous.close();

    const menu = document.createElement('pat97-honeycomb-menu');
    manager.honeycomb = menu;
    menu.setConfig( _config );
    menu.display( lovelace_view(), manager.position.x, manager.position.y );
    menu.addEventListener('closing', () => {
        if( manager.honeycomb === menu )
            manager.honeycomb = null;
    });
}

function honeycombBack()
{
    const previousConfig = manager.history.back();

    if( ! previousConfig )
        return false;

    showHoneycombMenu(previousConfig);
    return true;
}

function honeycombClose()
{
    manager.history.clear();

    if( manager.honeycomb )
        manager.honeycomb.close();
}

window.honeycomb_menu_back = honeycombBack;
window.honeycomb_menu_close = honeycombClose;

function traverseConfigs( _config, _buttons )
{
    return traverseMenuConfig(
        _config,
        honeycomb_menu_templates(),
        _buttons || []
    );
}

class Pat97HoneycombMenu extends LitElement
{
    static get is()
    {
        return 'pat97-honeycomb-menu';
    }

    static get properties()
    {
        return {
            hass: {
                type: Object
            },
            config: {
                type: Object
            },
            sizes: {
                type: Object,
                readonly: true
            },
            variables: {
                type: Object
            },
            closing: {
                type: Boolean,
                attribute: true,
                reflect: true
            },
            view: {},
            buttons: {
                type: Array
            },
            _service: {
                type: Object
            },
            _dragHoverSlot: {
                type: Number
            }
        }
    }

    constructor()
    {
        super();

        this.closing = false;
        this.buttons = [];
        this._rings = {
            inner: true,
            outer: false
        };
        this._service = {
            x: false,
            y: false
        };
        this._dragHoverSlot = -1;
        this._dragPointerActive = false;
        this._dragPointerId = null;
        this._dragStartX = null;
        this._dragStartY = null;
        this._idleTimer = null;
        this._closeFallbackTimer = null;
        this._boundPointerMove = this._handleGlobalPointerMove.bind(this);
        this._boundPointerUp = this._handleGlobalPointerUp.bind(this);
    }

    static get styles()
    {
        return css`
            @keyframes fadeIn { from {opacity: 0; } to { opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
            @keyframes zoomIn {
            from {
                opacity: 0;
                transform: scale3d(0.3, 0.3, 0.3);
            }
            50% {
                opacity: 1;
            }
            }
            @keyframes zoomOut {
            from {
                opacity: 1;
            }

            50% {
                opacity: 0;
                transform: scale3d(0.3, 0.3, 0.3);
            }

            to {
                opacity: 0;
            }
            }

            @keyframes bounceOut {
            20% {
                -webkit-transform: scale3d(0.9, 0.9, 0.9);
                transform: scale3d(0.9, 0.9, 0.9);
            }

            50%,
            55% {
                opacity: 1;
                -webkit-transform: scale3d(1.1, 1.1, 1.1);
                transform: scale3d(1.1, 1.1, 1.1);
            }

            to {
                opacity: 0;
                -webkit-transform: scale3d(0.3, 0.3, 0.3);
                transform: scale3d(0.3, 0.3, 0.3);
            }
            }

            :host {
                position: absolute;
                z-index: 8; /*200;*/
            }
            :host([closing]), :host([closing]) * {
                pointer-events: none !important;
            }
            .shade {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.47);

                animation-duration: 1s;
                animation-fill-mode: both;
                animation-name: fadeIn;
            }
            :host([closing]) .shade {
                animation-name: fadeOut;
                animation-duration: 500ms;
            }
            .honeycombs {
                --filter-color: rgba(0, 0, 0, 0.76);
                filter: drop-shadow(2px 4px 3px var(--filter-color) );
                width: var(--container-width);
                height: var(--container-height);
                pointer-events: none;
            }
            pat97-honeycomb-menu-item {
                position: absolute;
                pointer-events: all;
                box-sizing: border-box;
                width: var(--item-size);
                padding: var(--spacing);
            }
            pat97-honeycomb-menu-item.center-item {
                z-index: 2;
                filter: brightness(var(--pat97-honeycomb-center-brightness, 1));
            }
            pat97-honeycomb-menu-item.drag-hover {
                filter: brightness(1.18);
                transform: scale3d(1.08, 1.08, 1.08);
                z-index: 3;
            }
            pat97-honeycomb-menu-item.center-item.drag-hover {
                filter: brightness(calc(var(--pat97-honeycomb-center-brightness, 1) * 1.18));
            }
            pat97-honeycomb-menu-item, pat97-xy-pad {
                animation-duration: 0.5s;
                animation-fill-mode: both;
                animation-name: zoomIn;
            }
            :host([closing]) pat97-honeycomb-menu-item, :host([closing]) pat97-xy-pad {
                animation-name: zoomOut;
            }
            :host([closing]) pat97-honeycomb-menu-item[selected] {
                animation-duration: 0.75s;
                animation-name: bounceOut;
            }
            pat97-xy-pad {
                width: var(--container-width);
                height: var(--container-height);
            }`;
    }

    render()
    {
        const centerConfig = this._computeCenterConfig();
        const centerPos = centerPosition(this._rings);

        return html`
            <div id="shade" class="shade" @click=${this._handleShadeClick}></div>

            ${(this.config.xy_pad) ? html`
                <pat97-xy-pad
                    style="animation-delay: ${this._computeAnimateDelay(1)};"
                    .hass=${this.hass}
                    .menuStyle=${this.config.style}
                    .config=${this.config.xy_pad}
                    .size=${this._computeXYPadSize()}
                    .clampX=${this._computeXYPadClamp()}
                    .clampY=${this._computeXYPadClamp()}
                    @drag=${this._handleXYPad}
                    @drag-interval=${this._handleXYPad}
                    @drag-end=${this._handleXYPad}>
                </pat97-xy-pad>`:''}

            <div id="honeycombs" class="honeycombs">
                ${centerConfig ? html`
                    <pat97-honeycomb-menu-item
                        class="center-item ${this._dragHoverSlot === 18 ? 'drag-hover' : ''}"
                        data-honeycomb-slot="center"
                        @pointerenter=${() => this._setDragHoverSlot(18)}
                        @pointerleave=${() => this._clearDragHoverSlot(18)}
                        style="
                            animation-delay: ${this._computeAnimateDelay(0)};
                            left: calc(var(--item-size) * ${centerPos.x});
                            top: calc(var(--item-size) * ${centerPos.y});
                        "
                        .hass=${this.hass}
                        .menuStyle=${this.config.style}
                        .config=${centerConfig}
                        @action=${this._handleItemAction}>
                    </pat97-honeycomb-menu-item>
                ` : ''}

                ${this.buttons.map((button, slot) => {
                    if( button === undefined )
                        return '';

                    const position = buttonPosition(slot, this._rings);

                    if( ! position )
                        return '';

                    return html`
                        <pat97-honeycomb-menu-item
                            class="${this._dragHoverSlot === slot ? 'drag-hover' : ''}"
                            data-honeycomb-slot="${slot}"
                            @pointerenter=${() => this._setDragHoverSlot(slot)}
                            @pointerleave=${() => this._clearDragHoverSlot(slot)}
                            style="
                                animation-delay: ${this._computeButtonAnimateDelay(slot)};
                                left: calc(var(--item-size) * ${position.x});
                                top: calc(var(--item-size) * ${position.y});
                            "
                            .hass=${this.hass}
                            .menuStyle=${this.config.style}
                            .config=${this._computeItemConfig(button)}
                            @action=${this._handleItemAction}>
                        </pat97-honeycomb-menu-item>
                    `;
                })}
            </div>`;
    }

    setConfig( config )
    {
        provideHass(this);

        this.config = normalizeMenuConfig(config);
        this.setAttribute('menu-style', this.config.style);

        this._assignButtons();
        this.sizes = containerMetrics(this.config.size, this._rings);

        if( this.config.xy_pad )
        {
            if( this.config.xy_pad["x"] ) {
                this.config.xy_pad["x"].data = this.config.xy_pad["x"].data || this.config.xy_pad["x"].service_data;
            }
            if( this.config.xy_pad["y"] ) {
                this.config.xy_pad["y"].data = this.config.xy_pad["y"].data || this.config.xy_pad["y"].service_data;
            }
        }

    }

    display(_view, _x, _y)
    {
        this.view = _view;
        this.view.style.position = 'relative';

        this.view.append( this );

        this._setPosition( _x, _y );

        if( this.config.drag_select )
        {
            if( manager.pointerDown )
            {
                this._dragPointerId = manager.pointerId;
                this._dragStartX = manager.position.x;
                this._dragStartY = manager.position.y;
            }

            document.addEventListener('pointermove', this._boundPointerMove, true);
            document.addEventListener('pointerup', this._boundPointerUp, true);
            document.addEventListener('pointercancel', this._boundPointerUp, true);
        }

        this._resetIdleTimeout();
    }

    firstUpdated()
    {
        this._setCssVars();
    }

    close( _item = null )
    {
        if( this.closing )
            return;

        this.closing = true;
        this._cleanupRuntime();

        const items = this.shadowRoot
            ? this.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item')
            : [];
        const ele = _item || items[items.length - 1];
        if( _item )
        {
            _item.setAttribute('selected', '');
            _item.style.animationDelay = this._computeAnimateDelay(3);
        }

        fireEvent(this, 'closing', { item: _item });

        let finished = false;
        const finish = () => {
            if( finished )
                return;
            finished = true;
            clearTimeout(this._closeFallbackTimer);
            this._closeFallbackTimer = null;
            this.remove();
            fireEvent(this, 'closed', { item: _item });
        };
        const shade = this.shadowRoot && this.shadowRoot.querySelector('#shade');

        if( shade )
            shade.addEventListener('animationend', () => shade.remove(), { once: true });

        this._closeFallbackTimer = setTimeout(
            finish,
            Math.max(1000, (Number(this.config.animation_speed) || 0) * 18 + 1000)
        );

        if( ele )
            ele.addEventListener('animationend', finish, { once: true });
        else
            finish();
    }

    disconnectedCallback()
    {
        this._cleanupRuntime();
        super.disconnectedCallback();
    }

    _assignButtons()
    {
        const resolved = [];
        const stacks = Array.isArray(this.config.buttons) ? this.config.buttons : [];

        for( let i = 0; i < stacks.length; i++ )
        {
            const stack = stacks[i];

            if( ! Array.isArray(stack) )
                continue;

            let button = {};

            for( const candidate of stack )
            {
                if( candidate === 'break' )
                {
                    button = 'break';
                    break;
                }

                if( candidate === 'skip' )
                    continue;

                const cloned = merge({}, candidate);
                const entityState = this.hass && this.hass.states
                    ? this.hass.states[this.config.entity]
                    : undefined;
                const show = cloned.show === undefined
                    ? true
                    : stringToBool(getTemplateOrValue(
                        this.hass,
                        entityState,
                        this.config.variables,
                        cloned.show
                    ));

                if( ! show )
                    continue;

                button = cloned;
                break;
            }

            if( button == 'break' )
                button = {};

            if( ! isEmpty(button) )
                resolved.push({ button, sourceIndex: i });
        }

        const layout = assignButtons(resolved, this.config.empty_slots);
        this.buttons = layout.buttons;
        this._rings = layout.rings;
        layout.warnings.forEach(message => console.warn(`[PAT97 Honeycomb Menu] ${message}`));
    }

    _setPosition( _x, _y )
    {
        let container = {
            w: ( this.sizes.containerWidth / 2 ),
            h: ( this.sizes.containerHeight / 2 )
        };

        let bounds =  {
            min: {
                x: parseFloat( window.getComputedStyle(this.view, null).getPropertyValue('padding-left') ) + container.w,
                y: parseFloat( window.getComputedStyle(this.view, null).getPropertyValue('padding-top') ) + container.h
            },
            max: {
                x: this.view.clientWidth - container.w,
                y: this.view.clientHeight - container.h
            }
        }

        let rect = this.view.getBoundingClientRect();
        _x = clamp( _x - rect.left, bounds.min.x, bounds.max.x - 5 );
        _y = clamp( _y - rect.top, bounds.min.y, bounds.max.y - 5 );

        this.style.left = `${_x - container.w}px`;
        this.style.top = `${_y - container.h}px`;
    }

    _setCssVarProperty(orig_property, var_property)
    {
        this.shadowRoot.querySelector('#honeycombs').style.setProperty(orig_property, `var(${var_property}, ${this.view.style.getPropertyValue(orig_property)})`, "important");
    }

    _setCssVars()
    {
        this.style.setProperty('--item-size', `${this.sizes.item}px` );
        this.style.setProperty('--container-width', `${this.sizes.containerWidth}px`);
        this.style.setProperty('--container-height', `${this.sizes.containerHeight}px`);

        this.style.setProperty('--spacing', `${this.config.spacing}px`);
        const centerBrightness = Number(this.config.center_brightness);
        const centerBrightnessFactor = Number.isFinite(centerBrightness)
            ? Math.max(0, 1 + (centerBrightness / 100))
            : 1;
        this.style.setProperty('--pat97-honeycomb-center-brightness', `${centerBrightnessFactor}`);

        this._setCssVarProperty('--paper-item-icon-color', '--pat97-honeycomb-menu-icon-color');
        this._setCssVarProperty('--paper-item-icon-active-color', '--pat97-honeycomb-menu-icon-active-color');
        this._setCssVarProperty('--ha-card-background', '--pat97-honeycomb-menu-background-color');
        this._setCssVarProperty('--ha-card-active-background', '--pat97-honeycomb-menu-active-background-color');

        if( this.config.style == 'mushroom' )
        {
            const honeycombs = this.shadowRoot.querySelector('#honeycombs');
            honeycombs.style.setProperty('--paper-item-icon-color', 'var(--pat97-honeycomb-menu-icon-color, var(--secondary-text-color))', 'important');
            honeycombs.style.setProperty('--paper-item-icon-active-color', 'var(--pat97-honeycomb-menu-icon-active-color, var(--primary-color))', 'important');
            honeycombs.style.setProperty('--ha-card-background', 'var(--pat97-honeycomb-menu-control-background, var(--card-background-color, rgba(127, 127, 127, 0.12)))', 'important');
            honeycombs.style.setProperty('--ha-card-active-background', 'var(--pat97-honeycomb-menu-active-background, rgba(var(--rgb-primary-color, 3, 169, 244), 0.22))', 'important');
        }
    }

    _handleShadeClick(e)
    {
        e.stopPropagation();
        manager.history.clear();
        this.close();
    }

    _handleItemAction(e)
    {
        if( ! e.detail || ! e.detail.item )
            return;

        const item = e.detail.item;
        const actionType = e.detail.action || 'tap';
        const actionKey = actionType === 'hold'
            ? 'hold_action'
            : actionType === 'double_tap'
                ? 'double_tap_action'
                : 'tap_action';
        const configuredAction = item.config && item.config[actionKey]
            ? item.config[actionKey].action
            : null;

        if( configuredAction === 'honeycomb-back' )
        {
            e.stopPropagation();
            honeycombBack();
            return;
        }

        if( configuredAction === 'honeycomb-close' )
        {
            e.stopPropagation();
            manager.history.clear();
            this.close(item);
            return;
        }

        this._playButtonSound( item );

        if( e.detail.autoclose )
        {
            manager.history.clear();
            this.close(item);
            return;
        }

        this._resetIdleTimeout();
    }

    _setDragHoverSlot(slot)
    {
        if( ! this.config.drag_select || ! this.config.hover_highlight )
            return;

        this._dragHoverSlot = slot;
    }

    _clearDragHoverSlot(slot)
    {
        if( this._dragHoverSlot === slot )
            this._dragHoverSlot = -1;
    }

    _findMenuItemAtPoint(x, y)
    {
        if( ! this.shadowRoot || ! this.shadowRoot.elementFromPoint )
            return null;

        let element = this.shadowRoot.elementFromPoint(x, y);

        while( element && element !== this.shadowRoot )
        {
            if( element.tagName && element.tagName.toLowerCase() === 'pat97-honeycomb-menu-item' )
                return element;

            element = element.parentElement;
        }

        return null;
    }

    _handleGlobalPointerMove(e)
    {
        if( ! this.config.drag_select )
            return;
        if( e.pointerType === 'mouse' && e.buttons === 0 )
            return;
        if( this._dragPointerId !== null && e.pointerId !== this._dragPointerId )
            return;

        if( ! this._dragPointerActive )
        {
            if( this._dragStartX === null || this._dragStartY === null )
            {
                this._dragStartX = e.clientX;
                this._dragStartY = e.clientY;
            }

            if( ! isPastDragDeadzone(
                this._dragStartX,
                this._dragStartY,
                e.clientX,
                e.clientY,
                this.config.drag_deadzone
            ) )
                return;

            this._dragPointerActive = true;
        }

        this._dragPointerId = e.pointerId;
        this._resetIdleTimeout();

        const item = this._findMenuItemAtPoint(e.clientX, e.clientY);

        if( ! item )
        {
            this._dragHoverSlot = -1;
            return;
        }

        const slot = item.dataset.honeycombSlot === 'center'
            ? 18
            : Number(item.dataset.honeycombSlot);
        this._dragHoverSlot = Number.isFinite(slot) ? slot : -1;
    }

    _handleGlobalPointerUp(e)
    {
        if( ! this.config.drag_select )
            return;
        if( this._dragPointerId !== null && e.pointerId !== this._dragPointerId )
            return;

        if( ! this._dragPointerActive )
        {
            this._resetDragState();
            return;
        }

        const item = this._findMenuItemAtPoint(e.clientX, e.clientY);
        this._resetDragState();

        if( item )
        {
            e.preventDefault();
            e.stopPropagation();
            this._triggerMenuItemTap(item);
        }
    }

    _resetDragState()
    {
        this._dragPointerActive = false;
        this._dragPointerId = null;
        this._dragStartX = null;
        this._dragStartY = null;
        this._dragHoverSlot = -1;
    }

    _triggerMenuItemTap(item)
    {
        const wrappedCard = item.shadowRoot
            ? item.shadowRoot.querySelector('#item > *')
            : null;

        if( ! wrappedCard )
        {
            console.warn('[PAT97 Honeycomb Menu] Unable to find the wrapped card for drag selection.');
            return;
        }

        let actionTarget = wrappedCard;

        if( wrappedCard.shadowRoot )
        {
            const candidate = wrappedCard.shadowRoot.querySelector('ha-card') ||
                wrappedCard.shadowRoot.querySelector('[role="button"]');

            if( candidate )
                actionTarget = candidate;
        }

        actionTarget.dispatchEvent(new CustomEvent('action', {
            bubbles: true,
            composed: true,
            detail: { action: 'tap' }
        }));
    }

    _clearIdleTimeout()
    {
        if( this._idleTimer )
        {
            clearTimeout(this._idleTimer);
            this._idleTimer = null;
        }
    }

    _resetIdleTimeout()
    {
        this._clearIdleTimeout();

        const timeout = normalizeIdleTimeout(this.config && this.config.idle_timeout);

        if( timeout === 0 || this.closing )
            return;

        this._idleTimer = setTimeout(() => {
            this._idleTimer = null;

            if( this.closing )
                return;

            manager.history.clear();
            this.close();
        }, timeout);
    }

    _cleanupRuntime()
    {
        this._clearIdleTimeout();
        document.removeEventListener('pointermove', this._boundPointerMove, true);
        document.removeEventListener('pointerup', this._boundPointerUp, true);
        document.removeEventListener('pointercancel', this._boundPointerUp, true);
        this._resetDragState();

        if( this._closeFallbackTimer )
        {
            clearTimeout(this._closeFallbackTimer);
            this._closeFallbackTimer = null;
        }
    }

    _playButtonSound( _item )
    {
        if( ! isString(_item.config.audio) )
            return;

        let audio_ele = document.querySelector('#honeycomb-audio');
        if( ! audio_ele )
        {
            audio_ele = document.createElement('audio');
            audio_ele.id = 'honeycomb-audio';
            document.querySelector("home-assistant").append(audio_ele);
        }
        audio_ele.src = _item.config.audio;
        audio_ele.play();
    }

    _handleXYPad(e)
    {
        if( (this.config.xy_pad.on_release && e.type != 'drag-end') ||
            (this.config.xy_pad.repeat && e.type != 'drag-interval')
        ) return;

        ['x', 'y'].forEach( axis => {
            let config = this.config.xy_pad[axis];

            if( e.detail[axis] == 0 || ! config || ! config.service || this._service[axis] )
                return;

            this._service[axis] = true;
            let service = split( config.service, '.', 2);
            this.hass
                .callService( service[0], service[1], this.__renderServiceData(e.detail, config.data) )
                .then(e => this._service[axis] = false);

        });
    }

    __renderServiceData( vars, data )
    {
        if( ! data )
            return new Object();

        return objectEvalTemplate( this.hass, this.hass.states[this.config.entity], { ...this.config.variables, ...vars }, data, (val) => {
            if( val == 'entity' )
                return this.config.entity;
            return _template(val, {interpolate: /{{([\s\S]+?)}}/g})(vars);
        });
    }

    _computeXYPadSize()
    {
        return this.config.size / 6;
    }

    _computeXYPadClamp()
    {
        return this.config.size / 3;
    }

    _computeItemSize()
    {
        return this.config.size / 3;
    }

    _computeItemConfig( item )
    {
        if( isEmpty(item) )
            return item;

        return computeItemConfig(this.config, item);
    }

    _computeCenterConfig()
    {
        if( this.config.center_button === false )
            return null;

        const nestedDefault = manager.history.stack.length > 0 && this.config.nested_center_back
            ? {
                entity: this.config.entity,
                active: false,
                autoclose: false,
                icon: 'mdi:arrow-left',
                tap_action: { action: 'honeycomb-back' }
            }
            : {
                entity: this.config.entity,
                active: this.config.active,
                autoclose: true,
                tap_action: { action: 'more-info' }
            };

        return this._computeItemConfig(merge(
            {},
            nestedDefault,
            this.config.center_button || {}
        ));
    }

    _computeButtonAnimateDelay(slot)
    {
        return this._computeAnimateDelay(animationStep(slot, this.config.animation_mode));
    }

    _computeAnimateDelay( i )
    {
        return this.config.animation_speed * i + 'ms';
    }
}
customElements.define(Pat97HoneycombMenu.is, Pat97HoneycombMenu);

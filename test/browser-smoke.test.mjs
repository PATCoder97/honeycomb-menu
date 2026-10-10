import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Window } from 'happy-dom';

const require = createRequire(import.meta.url);
const browser = new Window({ url: 'http://localhost/' });

for( const name of [
    'window',
    'document',
    'customElements',
    'HTMLElement',
    'Element',
    'Event',
    'CustomEvent',
    'Node',
    'ShadowRoot',
    'Document',
    'CSSStyleSheet',
    'MutationObserver',
    'navigator'
] )
    globalThis[name] = name === 'window' ? browser : browser[name];

globalThis.self = browser;
globalThis.getComputedStyle = browser.getComputedStyle.bind(browser);

class HomeAssistantElement extends browser.HTMLElement
{
    constructor()
    {
        super();
        this.hass = {
            states: {
                'light.room': {
                    entity_id: 'light.room',
                    state: 'on',
                    attributes: {}
                }
            },
            user: { id: 'test-user' },
            callService: async () => undefined
        };
    }

    provideHass(element)
    {
        element.hass = this.hass;
    }
}

class ButtonCardElement extends browser.HTMLElement
{
    setConfig(config)
    {
        this.config = config;

        if( ! this.shadowRoot )
        {
            const root = this.attachShadow({ mode: 'open' });
            const card = browser.document.createElement('ha-card');
            card.setAttribute('role', 'button');
            root.append(card);
        }
    }
}

class ErrorCardElement extends browser.HTMLElement
{
    setConfig(config)
    {
        this.config = config;
    }
}

browser.customElements.define('home-assistant', HomeAssistantElement);
browser.customElements.define('button-card', ButtonCardElement);
browser.customElements.define('hui-error-card', ErrorCardElement);
browser.document.body.append(browser.document.createElement('home-assistant'));

require('../pat97-honeycomb-menu.js');

function makeView()
{
    const view = browser.document.createElement('div');
    configureView(view);
    browser.document.body.append(view);
    return view;
}

function configureView(view)
{
    Object.defineProperties(view, {
        clientWidth: { value: 1024 },
        clientHeight: { value: 768 }
    });
    view.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 1024,
        bottom: 768,
        width: 1024,
        height: 768
    });
}

function makeLovelaceView()
{
    const homeAssistant = browser.document.querySelector('home-assistant');
    const homeAssistantRoot = homeAssistant.shadowRoot || homeAssistant.attachShadow({ mode: 'open' });
    const main = browser.document.createElement('home-assistant-main');
    const mainRoot = main.attachShadow({ mode: 'open' });
    const drawer = browser.document.createElement('app-drawer-layout');
    const resolver = browser.document.createElement('partial-panel-resolver');
    const resolverRoot = resolver.attachShadow({ mode: 'open' });
    const panel = browser.document.createElement('ha-panel-lovelace');
    const panelRoot = panel.attachShadow({ mode: 'open' });
    const huiRoot = browser.document.createElement('hui-root');
    const huiShadow = huiRoot.attachShadow({ mode: 'open' });
    const layout = browser.document.createElement('ha-app-layout');
    const viewContainer = browser.document.createElement('div');
    const view = browser.document.createElement('hui-view');

    huiRoot.lovelace = { config: {} };
    viewContainer.id = 'view';
    configureView(view);
    viewContainer.append(view);
    layout.append(viewContainer);
    huiShadow.append(layout);
    panelRoot.append(huiRoot);
    resolverRoot.append(panel);
    drawer.append(resolver);
    mainRoot.append(drawer);
    homeAssistantRoot.append(main);

    return view;
}

function button(index)
{
    return [{
        entity: 'light.room',
        icon: `mdi:numeric-${index + 1}-circle`,
        tap_action: { action: 'more-info' }
    }];
}

async function renderMenu(config)
{
    const menu = browser.document.createElement('pat97-honeycomb-menu');
    menu.setConfig(config);
    menu.display(makeView(), 400, 300);
    await menu.updateComplete;
    await browser.happyDOM.waitUntilComplete();
    await Promise.all(
        [...menu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item')]
            .map(item => item.updateComplete)
    );
    return menu;
}

function finishClose(menu)
{
    const items = menu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item');

    if( ! menu.closing )
        menu.close();

    if( items.length > 0 )
    {
        const animatedItem = menu.shadowRoot.querySelector('[selected]') || items[items.length - 1];
        animatedItem.dispatchEvent(new browser.Event('animationend'));
    }
}

test('bundle registers only PAT97 components and preserves the six-button Mushroom render', async () => {
    assert.ok(browser.customElements.get('pat97-honeycomb-menu'));
    assert.ok(browser.customElements.get('pat97-honeycomb-menu-item'));
    assert.ok(browser.customElements.get('pat97-xy-pad'));
    assert.equal(browser.customElements.get('honeycomb-menu'), undefined);

    const menu = await renderMenu({
        entity: 'light.room',
        buttons: Array.from({ length: 6 }, (_, index) => button(index))
    });
    const items = menu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item');

    assert.equal(menu.getAttribute('menu-style'), 'mushroom');
    assert.equal(menu.config.animation_mode, 'legacy');
    assert.equal(menu.config.drag_select, false);
    assert.equal(menu.config.center_button, false);
    assert.equal(items.length, 6);
    assert.equal(menu.shadowRoot.querySelector('.center-item'), null);
    assert.equal(items[0].dataset.honeycombSlot, '0');
    assert.match(items[0].getAttribute('style'), /left: calc\(var\(--item-size\) \* 0\)/);

    finishClose(menu);
    assert.equal(menu.isConnected, false);
});

test('extended render supports seven visible slots, center button, defaults and drag action', async () => {
    const buttons = Array.from({ length: 7 }, (_, index) => button(index));
    const menu = await renderMenu({
        entity: 'light.room',
        buttons,
        empty_slots: 'hidden',
        center_button: {},
        button_defaults: { color: 'var(--primary-color)' },
        drag_select: true
    });
    const items = [...menu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item')];
    const center = menu.shadowRoot.querySelector('.center-item');
    const ringItems = items.filter(item => ! item.classList.contains('center-item'));

    assert.equal(items.length, 8);
    assert.ok(center);
    assert.equal(center.config.tap_action.action, 'more-info');
    assert.equal(ringItems.length, 7);
    assert.equal(ringItems[6].dataset.honeycombSlot, '6');
    assert.equal(ringItems[0].config.color, 'var(--primary-color)');
    assert.ok(menu.sizes.containerWidth > 300);
    assert.equal(
        menu.style.getPropertyValue('--hexagon-height'),
        `${menu.sizes.hexagonHeight}px`
    );
    assert.equal(menu.style.getPropertyValue('--spacing'), `${menu.sizes.spacing}px`);

    const wrappedCard = ringItems[0].shadowRoot.querySelector('#item > *');
    const actionTarget = wrappedCard.shadowRoot.querySelector('ha-card');
    let action;
    actionTarget.addEventListener('action', event => action = event.detail.action);
    menu._triggerMenuItemTap(ringItems[0]);
    assert.equal(action, 'tap');
    assert.equal(menu.closing, true);

    finishClose(menu);
    assert.equal(menu.isConnected, false);
});

test('center close uses the selected animation and cards keep a regular hexagon mask', async () => {
    const menu = await renderMenu({
        entity: 'light.room',
        buttons: [button(0)],
        center_button: {
            icon: 'mdi:close',
            autoclose: false,
            tap_action: { action: 'honeycomb-close' }
        }
    });
    const center = menu.shadowRoot.querySelector('.center-item');

    menu._triggerMenuItemTap(center);

    assert.equal(menu.closing, true);
    assert.equal(center.hasAttribute('selected'), true);
    assert.match(
        browser.customElements.get('pat97-honeycomb-menu-item').styles.cssText,
        /clip-path:\s*polygon\(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%\)/
    );
    assert.match(
        browser.customElements.get('pat97-honeycomb-menu-item').styles.cssText,
        /width:\s*var\(--hexagon-width\)/
    );
    assert.match(
        browser.customElements.get('pat97-honeycomb-menu-item').styles.cssText,
        /height:\s*var\(--hexagon-height\)/
    );
    assert.doesNotMatch(
        browser.customElements.get('pat97-honeycomb-menu-item').styles.cssText,
        /skewY\(|114\.76%/
    );

    const menuStyles = browser.customElements.get('pat97-honeycomb-menu').styles.cssText;
    assert.match(menuStyles, /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/);
    assert.match(menuStyles, /:not\(\.drag-hover\):not\(\[disabled\]\):hover/);
    assert.match(menuStyles, /filter:\s*brightness\(1\.08\)/);
    assert.match(menuStyles, /transition:\s*filter 160ms ease/);

    center.dispatchEvent(new browser.Event('animationend'));
    assert.equal(menu.isConnected, false);
});

test('idle timeout closes an inactive menu', async () => {
    const menu = await renderMenu({
        entity: 'light.room',
        buttons: [button(0)],
        idle_timeout: 5
    });

    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(menu.closing, true);

    const items = menu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item');
    items[items.length - 1].dispatchEvent(new browser.Event('animationend'));
    assert.equal(menu.isConnected, false);
});

test('public API opens a nested menu, creates an automatic center Back button and restores its parent', async () => {
    const view = makeLovelaceView();
    const rootConfig = {
        entity: 'light.room',
        buttons: [{
            icon: 'mdi:home',
            tap_action: { action: 'more-info' }
        }]
    };
    const childConfig = {
        entity: 'light.room',
        center_button: {},
        buttons: [{
            icon: 'mdi:lamp',
            tap_action: { action: 'more-info' }
        }]
    };

    browser.window.honeycomb_menu(rootConfig);
    let menus = [...view.querySelectorAll('pat97-honeycomb-menu')];
    const rootMenu = menus[menus.length - 1];
    await rootMenu.updateComplete;

    browser.window.honeycomb_menu(childConfig);
    menus = [...view.querySelectorAll('pat97-honeycomb-menu')];
    const childMenu = menus[menus.length - 1];
    await childMenu.updateComplete;
    const center = childMenu.shadowRoot.querySelector('.center-item');

    assert.ok(center);
    assert.equal(center.config.tap_action.action, 'honeycomb-back');
    assert.equal(browser.window.honeycomb_menu_back(), true);

    menus = [...view.querySelectorAll('pat97-honeycomb-menu')];
    const restoredMenu = menus[menus.length - 1];
    await restoredMenu.updateComplete;
    assert.equal(restoredMenu.config.entity, rootConfig.entity);
    assert.equal(restoredMenu.config.center_button, false);
    assert.equal(browser.window.honeycomb_menu_back(), false);

    browser.window.honeycomb_menu_close();
    for( const menu of view.querySelectorAll('pat97-honeycomb-menu') )
        finishClose(menu);
    assert.ok([...view.querySelectorAll('pat97-honeycomb-menu')].every(menu => ! menu.isConnected));
});

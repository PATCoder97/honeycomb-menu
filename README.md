# PAT97 Honeycomb Menu for Home Assistant

Personal fork of [Honeycomb Menu by @Sian-Lee-SA](https://github.com/Sian-Lee-SA/honeycomb-menu), using Mushroom colors while preserving the original six-button honeycomb defaults. Optional extended controls add up to 18 buttons, nested menus, a center button, drag selection, shared button defaults, and idle timeout without changing existing YAML.


<a href="https://www.paypal.com/donate/?business=A82MM255CXF9L&no_recurring=0&item_name=Donating+will+help+justify+my+time+coding+and+doing+projects+that+also+benifits+others.+Any+amount+is+greatly+appreciated%21&currency_code=AUD"><img src="https://github.com/andreostrovsky/donate-with-paypal/raw/master/blue.svg" height="38"></a>
[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/SianLee)

Check out the great guide [Honeycomb Module: Hex PopUp Menu For Home Assistant](https://smarthomescene.com/guides/honeycomb-module-hex-popup-menu-for-home-assistant/)

## About

Honeycomb menu is a [Home Assistant](https://www.home-assistant.io/) module (not a card) that can be applied to any lovelace card. When activated by the defined action on said card, the module will display a 'rounded' list of honeycomb buttons with an optional XY pad to make interfacing with lovelace more fluent. This module was designed with [button-card](https://github.com/custom-cards/button-card) by [@RomRider](https://github.com/RomRider) in mind.

The module uses a hierarchy override for honeycomb options and sub options so you can define a templated version of options then define another set of options that will merge / cascade.

> This is still in alpha stages and has only be used and tested in chrome. Please expect errors and bugs otherwise you will be overly frustrated & disappointed!

![Example of Honeycomb](examples/example-1.gif)
![Example of XYPad](examples/example-xypad.gif)

## Watch YouTube Demonstration

[![Youtube Video](https://img.youtube.com/vi/oJ9Yr2dSqUk/0.jpg)](https://www.youtube.com/watch?v=oJ9Yr2dSqUk)

## Requirements
1. [button-card](https://github.com/custom-cards/button-card)

## How to install

### HACS (recommended)

1. Open HACS, select the three-dot menu, then select **Custom repositories**.
1. Add `https://github.com/PATCoder97/honeycomb-menu` with category **Dashboard**.
1. Install **PAT97 Honeycomb Menu** and restart Home Assistant.

### Manual

1. Download `pat97-honeycomb-menu.js` from the [latest release](https://github.com/PATCoder97/honeycomb-menu/releases/latest).
1. Place the file into the `config/www` path of your home assistant installation
    > you can place into a sub directory if you have OCD like me :grinning: just remember to point the resource url with the sub path

1. Add the resource to the lovelace config. _There are two ways in doing this_
    1. `yaml` - find your lovelace.yaml then place the following into resources eg.
        ```yaml
            resources:
              - url: /local/pat97-honeycomb-menu.js
                type: module
        ```
    1. `Web Interface` - (Home Assistant V0.108+):
        1. Goto the configuration page then open `Lovelace Dashboards`
        1. Select the `Resources` tab
        1. Click on the `+` (add) button in the lower right
        1. In the url field, add the module js file path ( Where your Home Assistant config/www/ path is needs to be replaced with /local/).  So a path to a saved file in `homeassistant_path/config/wwww/module.js` would be `/local/module.js` as the url path
        1. Ensure Resource type is left as Javascript Module

## How to use
fire-dom-event action, you can call the honeycomb menu while passing the config options to the property honeycomb_menu.

```yaml
- type: vertical-stack
  cards:
  - type: button
    entity: light.kitchen
    hold_action:
      action: fire-dom-event
      honeycomb_menu:
        template: light
        autoclose: false
        active: true
        ...
```

## `honeycomb:` Options

Option          | Values        | Default   | Details
--              | -             |-          |-
entity | `any:entity_id` | `card:entity` | This will call actions on the entity (entity_id) defined. If omitted then the card entity will be used.
buttons | `list[0-17]`: [Button](#button-options) `\| skip \| break` | `null \| template_buttons` | Up to 18 buttons. The original inner six slots are unchanged; the outer ring activates only when more than six visible buttons are configured or a hard outer slot is requested. Matching indexes with **template_buttons** are overridden. `skip` uses the template button and `break` disables that position.
active | `true \| false \| template` | `false` | Setting this to true will apply active styles based on the entity it's assigned to. You can also choose to use a template and return a boolean value. See [Templating](#templating)
autoclose | `true \| false` | `true` | Close the menu if a button is pressed
audio | `any:url_path` | `null` | Point to a audio file that will play when a button has been tapped
xy_pad | [XYPad](#xypad-options) | `null` | This will allow the adding of a xy pin in the middle of the honeycombs which can execute a service based on the x or y value
size | `int:px` | `225` | The size in px of the honeycomb menu. Each button item grows with the size
spacing | `number:px` | `2` | Padding per item. The perpendicular gap between neighboring regular hexagon edges is `2 × spacing` in all six directions.
variables | `object` | `null` | Variables can be accessed through parent templates and templating code via `variables.foo` with `foo` being the variable name. See [Example](#example-using-variables)
animation_speed | `int:ms` | `100` | Change the speed of the animation to show the menu, each ms is addition to each button... so 50ms * 5 = 250ms total time (first button is immediate)
animation_mode | `legacy \| sequential \| paired` | `legacy` | `legacy` preserves the original timing. `sequential` opens clockwise and `paired` animates opposite buttons together.
style | `mushroom \| classic` | `mushroom` | Keep the original hexagonal style with Mushroom colors, or use the original classic colors.
button_defaults | `object` | `{}` | Configuration deeply merged into every ring button before the individual button configuration.
empty_slots | `visible \| hidden` | `visible` | Show disabled hexagons for unused positions or render only configured buttons.
center_button | `object \| false` | `false` | Optional center button. An empty object creates a `more-info` button for the menu entity.
center_brightness | `number:%` | `0` | Brightness adjustment for the optional center button.
drag_select | `true \| false` | `false` | Allow one press-and-drag gesture to select a menu item.
drag_deadzone | `number:px` | `12` | Required pointer movement before drag selection activates.
hover_highlight | `true \| false` | `true` | Highlight the item under the pointer while drag selection is active.
nested_center_back | `true \| false` | `true` | Turn the center button into Back while inside a nested menu.
idle_timeout | `number:ms` | `0` | Close an inactive menu after this many milliseconds. `0` disables the timeout.

## `Button` Options

Option          | Values        | Default   | Details
--              | -             | -         | -
type | `any:card` | `custom:button-card` | The base card to use for the button **Be sure to set the underlying card to 100% height or it may not display correctly**
active | `true \| false` | `honeycomb:active` | Override the honeycomb active property for this button item
show | `true \| false` | `true` | Whether to display this button. If a parent template has an active button for this position then it will show instead. [Templating](#templating) can be used to return a boolean value
autoclose | `true \| false` | `honeycomb:autoclose` | Override the honeycomb autoclose property for this button
audio | `any:url_path` | `honeycomb:audio` | Override the honeycomb audio property for this button
entity | `any:entity_id` | `honeycomb:entity` | You can define the entity that this button targets. Omitted will resort to the honeycombs entity. An entity ca be used in templates by accessing its variable `entity`
position | `int:0-17` | `null` | Legacy zero-based absolute position. New configurations should use `slot`.
slot | `int:1-18` | `null` | Preferred one-based slot number.
slot_mode | `soft \| hard` | `soft` | A soft slot moves clockwise when occupied and wraps to the active ring. A hard slot is an absolute physical position and can activate the outer ring.
icon | `any:icon` | `null` | Only adding here for reference to custom:button-card so you can show an icon for the item
color | `any:css_color` | var(--pat97-honeycomb-menu-icon-color) | Color of icon or background (depending on custom:button-card config). Leaving the default value allows the theme to handle the color
show_name | `true \| false` | `false` | Only relevant for cards that support this option
Any other options for `Button:type` | - | - | -

## Extended layout example

All new interaction features are opt-in. The original six slot assignments are preserved. Shapes use regular hexagons with a height/width ratio of `2 / sqrt(3)` and one row step of `sqrt(3) / 2`. Opening, hover, press and drag highlighting preserve item sizes so they do not change the gaps; closing retains its zoom animation. Browser layout rounding and edge anti-aliasing can still affect individual pixels.

```yaml
action: fire-dom-event
honeycomb_menu:
  entity: light.living_room
  idle_timeout: 10000
  empty_slots: hidden
  center_button:
    icon: mdi:lightbulb-group
    tap_action:
      action: more-info
  button_defaults:
    show_name: false
  buttons:
    - icon: mdi:information-outline
      slot: 1
      slot_mode: hard
      tap_action:
        action: more-info
    - icon: mdi:lightbulb
      tap_action:
        action: toggle
    - icon: mdi:ceiling-light
      tap_action:
        action: toggle
    - icon: mdi:lamp
      tap_action:
        action: toggle
    - icon: mdi:floor-lamp
      tap_action:
        action: toggle
    - icon: mdi:led-strip-variant
      tap_action:
        action: toggle
    - icon: mdi:light-recessed
      slot: 13
      tap_action:
        action: toggle
```

The seventh visible button activates the outer ring. Slots `1-6` remain the original inner ring and slots `7-18` belong to the outer ring.

## Nested menu example

A button can open another Honeycomb through the existing `fire-dom-event` action. Set `center_button: {}` on the nested menu to get an automatic Back button, or use `action: honeycomb-back` on any button.

```yaml
buttons:
  - icon: mdi:dots-horizontal
    autoclose: false
    tap_action:
      action: fire-dom-event
      honeycomb_menu:
        entity: light.living_room
        center_button: {}
        buttons:
          - icon: mdi:arrow-left
            autoclose: false
            tap_action:
              action: honeycomb-back
          - icon: mdi:close
            tap_action:
              action: honeycomb-close
```

For optional one-gesture selection, add:

```yaml
drag_select: true
drag_deadzone: 12
hover_highlight: true
```

## `XYPad` Options

The x and y properties have the same options. If one of the x or y properties are omitted then the pad will only go the direction that's defined.

The pad can be useful for things like light brightness, color hue rotation, opening and closing shutters or roller doors etc.

![Example of XYPad](examples/example-xypad.gif)

Option          | Values        | Default   | Details
--              | -             | -         | -
repeat | `int:ms \| false` | `false` | If the xy pin is moved but idle, then repeat will continue calling the service otherwise the service will only be called when the xy pin is moving
on_release | `true \| false` | `false` | Only call the service when the xy pin has been released while providing the x y value that it was on
x | [XYConfig](#xyconfig) | `null` | See below for properties and values. * `null` will disable x movements
y | [XYConfig](#xyconfig) | `null` | See below for properties and values. * `null` will disable y movements

#### XYConfig
Option          | Values        | Default   | Details
--              | -             | -         | -
invert | `true \| false` | `false` | x or y will swap negative and positive values so moving xy pin up will give a positive value whereas down will give a negative value
service | `any:service` | `null` | The service to call eg. light.turn_on. If this value is omitted then the ball pin will have no effect on this axis
data or service_data | `dict` | `null` | Provide any service data as a dictionary / object. This property will be processed through the template system allowing access to variables and javascript. See [Templating](#templating).

## Theme Styles and Defaults

Adding the following style properties to your theme `.yaml` file will override the defaults
```css
/* Styles selector is used as a placeholder for syntax highlighting */
styles {
    --pat97-honeycomb-menu-icon-color: var(--paper-item-icon-color);
    --pat97-honeycomb-menu-icon-active-color: var(--paper-item-icon-active-color);
    --pat97-honeycomb-menu-background-color: var(--paper-card-background-color);
    --pat97-honeycomb-menu-active-background-color: var(--paper-card-active-background-color, var(--paper-card-background-color));
    --pat97-honeycomb-menu-disabled: #9a9a9a6e;
    --pat97-honeycomb-menu-control-background: rgba(var(--rgb-primary-text-color), 0.08);
    --pat97-honeycomb-menu-control-border: rgba(var(--rgb-primary-text-color), 0.08);
    --pat97-honeycomb-menu-active-background: rgba(var(--rgb-primary-color), 0.22);
}
```

## Templating
All templatable properties will be parsed as [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals), if you need full Javascript functionalities then `HCJS:` (aka HoneyComb JavaScript) must be declared at the start to signal that the string is to be run as javascript (remember to return your values!). Configs with variables defined can be accessed by the `variables` object along with the xypad data if using the feature.

Templating is currently available for all `XYConfig:data` properties and some config options. Templating allows flexibility and provide values based on the xy pads positions or config options.

A property only containing the word **entity** will be converted to the `honeycomb:entity` value.

The xypad will pass the following into the variable object `variables`

        x: Pixels from the x center position
        y: Pixels from the y center position
        x_percentage: Percentage of the x position (-10 to 10)
        y_percentage: Percentage of the y position (-10 to 10)

```javascript
HCJS: return variables.x_percentage / 10;
```
or via Template Literals (does not need to be returned)
```javascript
${variables.x_percentage / 10}
```
Keep in mind that some service data requires an int and you maybe sending a float, you will need to convert to an int if required.

#### Examples

> Note: the following service `light.relative_brightnesss` is not a part of Home Assistant but instead is my own custom service that changes a lights brightness relatively. You could achieve the same outcome with the `light.turn_on` service and using the javascript template parser with some calculations

```yaml
...
action: fire-dom-event
honeycomb_menu:
  entity: light.kitchen
  xy_pad:
    x:
      invert: true
      service: light.relative_color
      data:
        # The word entity will become light.kitchen
        entity_id: entity
        hue: '${variables.x / 18 * variables.x_percentage}'
    y:
      service: light.relative_brightnesss
      data:
        # We can define another entity like normal
        entity_id: light.bathroom
        brightness: '${variables.y_percentage}'
        percentage: true
```

An example for templatable config options could be used to determine a fan state and set the button as active if fan is currently in that state eg...
As by default honeycomb menu items uses custom:buton-card for buttons, you can default to their JS syntax or use HCJS:
```yaml
...
action: fire-dom-event
honeycomb_menu:
  entity: fan.master_bedroom
  buttons:
    - icon: 'mdi:information-variant'
      tap_action:
        action: more-info
    - icon: 'mdi:fan-speed-1'
      active: '[[[ return entity.attributes.speed == "low" ]]]'
      tap_action:
        action: call-service
        service: fan.set_speed
        service_data:
          entity_id: entity
          speed: low
    - icon: 'mdi:fan-speed-2'
      active: '[[[ return entity.attributes.speed == "medium" ]]]'
      tap_action:
        action: call-service
        service: fan.set_speed
        service_data:
          entity_id: entity
          speed: medium
    - icon: 'mdi:fan-speed-3'
      active: '[[[ return entity.attributes.speed == "high" ]]]'
      tap_action:
        action: call-service
        service: fan.set_speed
        service_data:
          entity_id: entity
          speed: high
```

#### Example using variables
Say you have defined a honeycomb menu template for lights, you can then allow the light template make logical conditions as to how it should render.

edit the honeycomb menu templates file (*don't confuse templating with honeycomb templates)
```yaml
honeycomb_menu_templates:
  light:
    variables:
      timer: null
      motion: null
    audio: /local/audio/pin-drop.ogg
    xy_pad:
      repeat: 500
      y:
        invert: true
        service: light.turn_on
        data:
          entity_id: entity
          brightness_step_pct: 'HCJS: return variables.y_percentage / 10;' # or '${variables.y_percentage / 10}'
    buttons:
      - icon: 'mdi:information-variant'
        tap_action:
          action: more-info
      - icon: 'mdi:lightbulb'
        active: true
      - show: 'HCJS: return (variables.motion);' # or '${variables.motion}'
        entity: 'HCJS: return variables.motion;' # or '${variables.motion}'
        icon: 'mdi:motion-sensor'
        position: 4
        active: true
        tap_action:
          action: toggle
      - show: 'HCJS: return (variables.timer);' # or '${variables.timer}'
        entity: 'HCJS: return variables.timer;' # or '${variables.timer}'
        icon: 'mdi:timer'
        position: 5
        active: true
        tap_action:
          action: toggle
```

With the example above, if a menu derives the light template then any menu that sets a timer or motion as a variable will show those menu items with the entity being set to the variable property. If the variable is not set then it won't show the menu item and instead will either show the next derived item for that item position or nothing.

Below is an example on how to assign a menu to the above example.
```yaml
- type: 'custom:button-card'
  entity: light.back_yard_garden_leds
  hold_action:
    action: fire-dom-event
    honeycomb_menu:
      template: light
      variables:
        motion: automation.motion_back_yard_garden_leds
```

As shown, this allows us to minimize clutter while keeping things neat and consistent.

##### Result
![Example of variables](examples/example-variables.gif)

Also note that templates can derive from another template which can also access these variables through the hierarchy

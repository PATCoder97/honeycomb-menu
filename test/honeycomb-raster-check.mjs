// Chromium geometry checks use the real menu/button-card bundles and HA element stubs.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.js node test/honeycomb-raster-check.mjs
//   --button-card /path/to/button-card.js
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.ok(process.argv.includes('--button-card'), 'Provide the real button-card bundle');
const card = path.resolve(process.argv[process.argv.indexOf('--button-card')+1]);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.RASTER_OUTPUT || '/tmp/honeycomb-regular-check';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
// Chromium rounds layout coordinates to 1/64 CSS px; allow endpoint rounding.
const tolerance = 0.04;
function checkGeometry(geometry, pairs) {
  if( pairs !== undefined ) assert.equal(geometry.neighborPairs, pairs);
  assert.ok(geometry.edgeSpread <= tolerance, `Unequal edges: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.maxGapError <= tolerance, `Unequal perpendicular gaps: ${JSON.stringify(geometry)}`);
}
try {
  for( const dpr of [1, 2] ) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`file://${root}test/honeycomb-raster-fixture.html`);
    await page.addScriptTag({ path: card, type: 'module' });
    await page.addScriptTag({ path: `${root}pat97-honeycomb-menu.js` });
    await page.mouse.move(900, 700);
    for( const size of [160, 225, 260, 320] ) {
      for( const spacing of [0, 1, 2, 5] ) {
        for( const count of [6, 18] ) {
          const result = await page.evaluate(options => window.renderMenu('pat97-honeycomb-menu', options), { size, spacing, count, center:true });
          assert.equal(result.count, count+1);
          assert.equal(result.errors, 0);
          const geometry = await page.evaluate(() => measureGeometry());
          checkGeometry(geometry, count === 6 ? 12 : 42);
          const file = `${output}/regular-${count}-${size}-${spacing}-dpr${dpr}.png`;
          await page.screenshot({ path:file, clip:{x:10,y:10,width:Math.ceil(result.width+30),height:Math.ceil(result.height+30)} });
          report.push({ size, spacing, count, dpr, geometry, file });
        }
      }
    }
    for( const count of [4, 7, 18] ) {
      for( const emptySlots of ['visible', 'hidden'] ) {
        const result = await page.evaluate(options => window.renderMenu('pat97-honeycomb-menu', options), {size:260,spacing:1,count,emptySlots});
        assert.equal(result.count, emptySlots === 'hidden' ? count : count > 6 ? 18 : 6);
        assert.equal(result.errors, 0);
        const geometry = await page.evaluate(() => measureGeometry());
        checkGeometry(geometry);
        const file = `${output}/regular-${count}-${emptySlots}-dpr${dpr}.png`;
        await page.screenshot({path:file,clip:{x:10,y:10,width:Math.ceil(result.width+30),height:Math.ceil(result.height+30)}});
        report.push({count,emptySlots,dpr,geometry,file});
      }
    }
    // Real opening animation, then upstream-style hover on center/ring cells.
    await page.evaluate(() => renderMenu('pat97-honeycomb-menu', {size:260,spacing:1,count:18,center:true,animations:true,animationMode:'paired'}));
    const center = page.locator('pat97-honeycomb-menu-item.center-item');
    const opening = await page.evaluate(async () => {
      const item = testMenu.shadowRoot.querySelector('.center-item');
      const zoom = item.getAnimations().find(animation => animation.animationName === 'zoomIn');
      if(!zoom) throw new Error('Opening zoom missing');
      zoom.pause(); zoom.currentTime=0;
      const initial = getComputedStyle(item).transform;
      const all = [...new Set([...testMenu.shadowRoot.querySelectorAll('*')].flatMap(element => element.getAnimations()))];
      all.forEach(animation => animation.finish());
      await Promise.all(all.map(animation => animation.finished));
      await new Promise(resolve => requestAnimationFrame(resolve));
      return initial;
    });
    assert.match(opening, /matrix(?:3d)?\(0\.3,/);
    const restGeometry = await page.evaluate(() => measureGeometry());
    checkGeometry(restGeometry,42);
    // Upstream does not transform on hover/press. Inspect the actual glyph
    // pixels, with no allowed centroid drift; HA icons here are still stubs.
    const items = page.locator('pat97-honeycomb-menu-item');
    for(const index of [0,1,3,6,12,18]) {
      await page.mouse.move(900,700);
      const item = items.nth(index);
      const rest = await item.boundingBox();
      const clip = {x:Math.floor(rest.x+rest.width/2-20),y:Math.floor(rest.y+rest.height/2-20),width:40,height:40};
      const glyphReference = await page.screenshot({clip});
      await item.hover();
      for(const delay of [0,17,65,220]) {
        if(delay) await page.waitForTimeout(delay);
        assert.deepEqual(await item.boundingBox(),rest,'Hover changed cell bounds');
        assert.ok(glyphReference.equals(await page.screenshot({clip})), `Hover changed glyph pixels: slot=${index}, delay=${delay}`);
      }
      await page.mouse.down();
      assert.deepEqual(await item.boundingBox(),rest,'Press changed cell bounds');
      await page.mouse.move(900,700); await page.mouse.up();
      assert.ok(glyphReference.equals(await page.screenshot({clip})), 'Hover exit changed glyph pixels');
    }
    assert.deepEqual(await page.evaluate(() => measureGeometry()),restGeometry);
    // Preserve opt-in drag brightness without zooming the cell or glyph.
    const centerRest = await center.boundingBox();
    await center.evaluate(element => element.classList.add('drag-hover'));
    assert.deepEqual(await center.boundingBox(),centerRest);
    await center.evaluate(element => element.classList.remove('drag-hover'));
    const edgeOptions = {clip:{x:10,y:10,width:500,height:500},mask:[page.locator('pat97-honeycomb-menu-item ha-state-icon, pat97-honeycomb-menu-item ha-icon')]};
    const edgeReference = await page.screenshot({...edgeOptions,path:`${output}/upstream-motion-rest-dpr${dpr}.png`});
    await page.evaluate(() => {
      const style=document.createElement('style'); style.id='edge-reference';
      style.textContent='pat97-honeycomb-menu-item {will-change:auto!important;backface-visibility:visible!important}';
      testMenu.shadowRoot.append(style);
    });
    assert.ok(edgeReference.equals(await page.screenshot(edgeOptions)), 'Resting polygon has forced layer rasterization');
    await page.evaluate(() => testMenu.shadowRoot.querySelector('#edge-reference').remove());
    // Negative control: old module hover scale must be rejected.
    await page.evaluate(() => {
      const style=document.createElement('style'); style.id='hover-negative';
      style.textContent='pat97-honeycomb-menu-item:hover {transform:scale(1.04)!important}';
      testMenu.shadowRoot.append(style);
    });
    await center.hover();
    assert.notDeepEqual(await center.boundingBox(),centerRest,'Verifier missed the old hover scale');
    await page.mouse.move(900,700);
    await page.evaluate(() => testMenu.shadowRoot.querySelector('#hover-negative').remove());
    // Injecting the deliberately broken transform can leave Chromium's layer
    // cache rasterized differently. Actual hover pixel parity is checked above;
    // here verify that removing the negative control restores CSS geometry.
    assert.deepEqual(await center.boundingBox(),centerRest);
    assert.deepEqual(await page.evaluate(() => measureGeometry()),restGeometry);
    // Negative controls: the verifier must reject the two previous regressions.
    await page.evaluate(() => {
      for( const item of testMenu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item') ) {
        const shape = item.shadowRoot.querySelector('.honey');
        shape.style.height = `${shape.getBoundingClientRect().width * 1.1476}px`;
      }
    });
    const flattened = await page.evaluate(() => measureGeometry());
    assert.throws(() => checkGeometry(flattened), /Unequal/);
    await page.evaluate(() => {
      for( const item of testMenu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item') )
        item.shadowRoot.querySelector('.honey').style.removeProperty('height');
      const item = testMenu.shadowRoot.querySelector('[data-honeycomb-slot="0"]');
      item.style.top = `${parseFloat(getComputedStyle(item).top) + 0.5}px`;
    });
    const shifted = await page.evaluate(() => measureGeometry());
    assert.throws(() => checkGeometry(shifted), /Unequal/);
    // Verify upstream close animations on real CSS animations, not selectors.
    for(const selected of [false,true]) {
      await page.evaluate(() => renderMenu('pat97-honeycomb-menu', {size:260,spacing:1,count:6,center:true,animations:true}));
      const closing = await page.evaluate(async selected => {
        const all=[...new Set([...testMenu.shadowRoot.querySelectorAll('*')].flatMap(element=>element.getAnimations()))];
        all.forEach(animation=>animation.finish());
        await Promise.all(all.map(animation=>animation.finished));
        const item=testMenu.shadowRoot.querySelector('.center-item');
        testMenu.close(selected ? item : null);
        await testMenu.updateComplete;
        const animations=[...new Set([...testMenu.shadowRoot.querySelectorAll('*')].flatMap(element=>element.getAnimations()))];
        animations.forEach(animation=>animation.pause());
        const name=selected ? 'bounceOut' : 'zoomOut';
        const zoom=item.getAnimations().find(animation=>animation.animationName===name);
        if(!zoom) throw new Error(`Missing closing animation: ${name}`);
        const duration=zoom.effect.getTiming().duration;
        zoom.currentTime=duration/2;
        const style=getComputedStyle(item);
        return {name,duration,scale:new DOMMatrixReadOnly(style.transform).a,opacity:Number(style.opacity),pointerEvents:style.pointerEvents};
      },selected);
      assert.equal(closing.duration,selected ? 750 : 500);
      assert.ok(Math.abs(closing.scale-(selected ? 1.1 : 0.3)) < 0.00001);
      assert.equal(closing.opacity,selected ? 1 : 0);
      assert.equal(closing.pointerEvents,'none');
    }
    assert.deepEqual(errors, [], 'No browser JavaScript errors');
    await context.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report,null,2));
  console.log(`PASS: ${report.length} renders; regular geometry within ${tolerance} CSS px; opening/closing zoom and bounce, unchanged hover glyph pixels and negative controls at DPR 1/2. HA icons remain test stubs. Report: ${output}`);
} finally { await browser.close(); }

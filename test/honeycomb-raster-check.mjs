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
    await page.evaluate(() => window.renderMenu('pat97-honeycomb-menu', {size:260,spacing:1,count:18,center:true}));
    const center = page.locator('pat97-honeycomb-menu-item.center-item');
    await center.hover();
    assert.equal(await center.evaluate(element => getComputedStyle(element).transform), 'none');
    checkGeometry(await page.evaluate(() => measureGeometry()), 42);
    await page.mouse.down();
    checkGeometry(await page.evaluate(() => measureGeometry()), 42);
    await page.mouse.up();
    await center.evaluate(element => element.classList.add('drag-hover'));
    checkGeometry(await page.evaluate(() => measureGeometry()), 42);
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
    assert.deepEqual(errors, [], 'No browser JavaScript errors');
    await context.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report,null,2));
  console.log(`PASS: ${report.length} actual renders; six edges and neighbor gaps within ${tolerance} CSS px; hover/press/drag-hover and negative controls at DPR 1/2. Report: ${output}`);
} finally { await browser.close(); }

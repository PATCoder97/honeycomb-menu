// Real ll-custom/API and button-card bundle, with minimal HA navigation/icon stubs.
// No animation.finish() or time mocking; animations are disabled only for
// the static pixel control, never during user interactions.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.js node test/honeycomb-user-flow.mjs --button-card /path/to/button-card.js
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.ok(process.argv.includes('--button-card'),'Provide the real button-card bundle');
const card=path.resolve(process.argv[process.argv.indexOf('--button-card')+1]);
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.USER_FLOW_OUTPUT || '/tmp/honeycomb-user-flow';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const report=[];
async function waitForRest(page) {
  await page.waitForFunction(() => {
    const menu=document.querySelector('home-assistant').shadowRoot.querySelector('home-assistant-main').shadowRoot.querySelector('partial-panel-resolver').shadowRoot.querySelector('ha-panel-lovelace').shadowRoot.querySelector('hui-root').shadowRoot.querySelector('hui-view').querySelector('pat97-honeycomb-menu');
    if(!menu?.shadowRoot?.querySelector('pat97-honeycomb-menu-item')) return false;
    window.testMenu=menu;
    return [...menu.shadowRoot.querySelectorAll('*')].flatMap(e=>e.getAnimations()).every(a=>a.playState==='finished' || a.playState==='idle');
  });
  await page.evaluate(async () => {
    await Promise.all([...testMenu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item')].map(async item=>{
      await item.updateComplete;
      const card=item.shadowRoot.querySelector('button-card'); if(card) await card.updateComplete;
    }));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  });
}
try {
for(const dpr of [1,1.25,1.5,2]) {
 const context=await browser.newContext({viewport:{width:1000,height:800},deviceScaleFactor:dpr});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`file://${root}test/honeycomb-raster-fixture.html`);
 await page.addScriptTag({path:card,type:'module'});
 await page.addScriptTag({path:`${root}pat97-honeycomb-menu.js`});
 await page.evaluate(()=>setupLovelaceLauncher());
 for(const theme of ['light','dark']) for(const count of [6,18]) {
  const id=`${theme}-${count}-dpr${dpr}`;
  await page.evaluate(({theme,count})=>{
    const bg=theme==='dark'?'#1c1c1c':'white';
    const fg=theme==='dark'?'#e1e1e1':'#171717';
    for(const name of ['--pat97-honeycomb-menu-control-background','--ha-card-background','--card-background-color']) document.documentElement.style.setProperty(name,bg);
    for(const name of ['--primary-text-color','--secondary-text-color','--paper-item-icon-color','--pat97-honeycomb-menu-icon-color']) document.documentElement.style.setProperty(name,fg);
    document.body.style.background=theme==='dark'?'#171717':'#929292';
    window.launchConfig={entity:'light.room',style:'mushroom',size:260,spacing:2,
      animation_mode:count===18?'paired':'legacy',animation_speed:70,
      center_button:count===18?{icon:'mdi:close'}:false,
      button_defaults:{styles:{icon:[{color:fg}]},show_name:false,show_state:false,autoclose:false,tap_action:{action:'none'}},
      buttons:Array.from({length:count},()=>({icon:'mdi:lightbulb'}))};
  },{theme,count});
  await page.locator('#launcher').click();
  await page.mouse.move(900,700);
  await waitForRest(page);
  const items=page.locator('pat97-honeycomb-menu-item');
  assert.equal(await items.count(),count+(count===18?1:0));
  const geometry=await page.evaluate(()=>measureGeometry());
  assert.ok(geometry.edgeSpread<0.04 && geometry.maxGapError<0.04,JSON.stringify(geometry));
  const retained=await page.evaluate(()=>[...testMenu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item')].flatMap(e=>e.getAnimations()).filter(a=>a.animationName==='zoomIn').length);
  assert.equal(retained,0,'Opening retained a forward-filled zoom');
  const bounds=await page.locator('#honeycombs').boundingBox();
  const clip={x:Math.floor(bounds.x)-5,y:Math.floor(bounds.y)-5,width:Math.ceil(bounds.width)+12,height:Math.ceil(bounds.height)+12};
  const rest=await page.screenshot({clip,path:`${output}/${id}-rest.png`});
  // Same rendered menu, with animations explicitly removed, is the control.
  await page.evaluate(()=>{
    const s=document.createElement('style');s.id='no-motion-reference';
    s.textContent='pat97-honeycomb-menu-item, pat97-xy-pad {animation:none!important}';
    testMenu.shadowRoot.append(s);
  });
  const reference=await page.screenshot({clip,path:`${output}/${id}-reference.png`});
  assert.ok(rest.equals(reference),`Resting pixels differ from no-animation control: ${id}`);
  await page.evaluate(()=>testMenu.shadowRoot.querySelector('#no-motion-reference').remove());
  await waitForRest(page);
  assert.ok(reference.equals(await page.screenshot({clip})),`Restoring animation changed pixels: ${id}`);
  // Traverse multiple cells quickly, then return to rest; no synthetic hover.
  for(const index of [0,1,3,count-1]) {
    await items.nth(index).hover();
    assert.ok(reference.equals(await page.screenshot({clip})),`Hover changed pixels: ${id}/${index}`);
  }
  await page.mouse.move(900,700);
  assert.ok(reference.equals(await page.screenshot({clip})),`Hover exit changed pixels: ${id}`);
  // Recreate the exact faulty forward-fill condition, let zoom finish normally,
  // and prove our pixel comparator rejects it (geometry alone still passes).
  await page.evaluate(()=>{
    const s=document.createElement('style');s.id='forward-fill-negative';
    s.textContent=':host(:not([closing])) pat97-honeycomb-menu-item {animation-fill-mode:both!important}';
    testMenu.shadowRoot.append(s);
  });
  await waitForRest(page);
  const negative=await page.screenshot({clip,path:`${output}/${id}-forward-fill-regression.png`});
  assert.ok(!reference.equals(negative),`Pixel test missed forward-fill regression: ${id}`);
  await page.evaluate(()=>testMenu.shadowRoot.querySelector('#forward-fill-negative').remove());
  await waitForRest(page);
  assert.ok(reference.equals(await page.screenshot({clip})),`Removing forward fill did not restore pixels: ${id}`);
  // Close through the shade and wait for actual removal, then reopen publicly.
  await page.mouse.click(900,700);
  await page.waitForFunction(()=>!testMenu.isConnected);
  await page.evaluate(()=>{launchConfig.buttons[0]={icon:'mdi:lightbulb',autoclose:true,tap_action:{action:'toggle'}};});
  await page.locator('#launcher').click();await page.mouse.move(900,700);
  await waitForRest(page);
  assert.ok(reference.equals(await page.screenshot({clip,path:`${output}/${id}-reopened.png`})),`Reopen changed pixels: ${id}`);
  // A real button-card tap and its selected bounce close (no direct .close()).
  await page.evaluate(()=>{window.testHassActions=[];});
  // Slot 0 is the configured button, not the optional center more-info card.
  await page.locator('pat97-honeycomb-menu-item[data-honeycomb-slot="0"]').locator('ha-card').click();
  await page.waitForFunction(()=>testMenu.closing);
  const actions=await page.evaluate(()=>testHassActions);
  assert.ok(actions.some(event=>event.action==='tap' && event.config.entity==='light.room' && event.config.tap_action.action==='toggle'),`Real card tap did not emit the expected HA action: ${JSON.stringify(actions)}`);
  assert.equal(await page.locator('pat97-honeycomb-menu-item[selected]').count(),1);
  await page.waitForFunction(()=>!testMenu.isConnected);
  report.push({id,dpr,theme,count,geometry,pixelParity:true,negativeControlRejected:true,reopened:true,selectedClose:true});
 }
 assert.deepEqual(errors,[],'Browser errors');await context.close();
 console.log(`PASS user flow DPR ${dpr}: light/dark, 6/18, natural open/close/reopen, pixel control and regression rejection`);
}
await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
console.log(`PASS: ${report.length} user-flow cases. Real API/button-card; HA navigation/icons are stubs, not a live HA session. Evidence: ${output}`);
}finally{await browser.close()}

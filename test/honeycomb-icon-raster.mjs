// Isolate the last zoom frame -> resting SVG raster handoff, not just bounds.
// Natural opening/click flows are covered by the other browser suites.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.ok(process.argv.includes('--button-card'),'Supply the real button-card bundle');
const card=process.argv[process.argv.indexOf('--button-card')+1];
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.ICON_OUTPUT || '/tmp/honeycomb-icon-raster';
await mkdir(output,{recursive:true});
const upstream=execFileSync('curl',['-fsSL','https://raw.githubusercontent.com/Sian-Lee-SA/honeycomb-menu/master/honeycomb-menu.js'],{encoding:'utf8'});
const before=execFileSync('git',['show','0.16.13:pat97-honeycomb-menu.js'],{cwd:root,encoding:'utf8'}).replaceAll('pat97-','before-');
const browser=await chromium.launch({headless:true});const report=[];
try {
 for(const dpr of [1,1.25,1.5,2]) {
  const context=await browser.newContext({viewport:{width:1000,height:800},deviceScaleFactor:dpr});const page=await context.newPage();
  await page.goto('https://demo.home-assistant.io',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>['ha-icon','ha-state-icon','ha-svg-icon','ha-card','ha-ripple'].every(n=>customElements.get(n)),{},{timeout:45000});
  await page.evaluate(()=>{
   const hass={states:{'fan.room':{entity_id:'fan.room',state:'on',attributes:{percentage:66}}},user:{id:'test'},config:{unit_system:{length:'km',temperature:'°C'}},locale:{language:'en',number_format:'language',time_format:'language'},themes:{themes:{},darkMode:true},localize:k=>k,callService:async()=>{},formatEntityState:s=>s.state};
   window.provider={hass,provideHass:e=>{e.hass=hass}};
   const query=document.querySelector.bind(document);document.querySelector=s=>s==='home-assistant'?provider:query(s);
   const wrapper=document.createElement('div');wrapper.style.cssText='position:fixed;inset:0;z-index:999999;background:#171717';document.body.append(wrapper);
   const view=document.createElement('div');view.id='icon-view';view.style.cssText='width:1000px;height:800px';wrapper.append(view);
   for(const n of ['--ha-card-background','--card-background-color','--paper-card-background-color'])document.documentElement.style.setProperty(n,'#1c1c1c');
  });
  await page.addScriptTag({path:card,type:'module'});
  await page.addScriptTag({content:upstream});await page.addScriptTag({content:before});await page.addScriptTag({path:`${root}pat97-honeycomb-menu.js`});
  for(const tag of ['honeycomb-menu','before-honeycomb-menu','pat97-honeycomb-menu']) {
   for(const icon of ['mdi:information-outline','mdi:lightbulb-on-outline','mdi:fan-speed-1']) for(const center of tag==='pat97-honeycomb-menu'?[false,true]:[false]) {
    const id=`${tag}-${icon.slice(4)}-center${center}-dpr${dpr}`;
    await page.evaluate(async({tag,icon,center})=>{
     const view=document.querySelector('#icon-view');view.replaceChildren();
     const menu=document.createElement(tag);menu.hass=provider.hass;
     menu.setConfig({entity:'fan.room',style:'mushroom',size:260,spacing:1,animation_speed:0,center_button:center?{icon,show_ripple:false,styles:{icon:[{color:'#e1e1e1'}]}}:false,buttons:Array.from({length:6},()=>[{icon,show_name:false,show_state:false,show_ripple:false,autoclose:false,tap_action:{action:'more-info'},styles:{icon:[{color:'#e1e1e1'}]}}])});
     window.rasterMenu=menu;menu.display(view,500,400);await menu.updateComplete;
    },{tag,icon,center});
    await page.waitForFunction(({tag,center})=>{
     const nodes=root=>[...root.querySelectorAll('*')].flatMap(e=>[e,...(e.shadowRoot?nodes(e.shadowRoot):[])]);
     const items=[...rasterMenu.shadowRoot.querySelectorAll(`${tag}-item`)];
     return items.length===(center?7:6) && items.every(item=>nodes(item.shadowRoot).some(e=>e.localName==='path' && e.getAttribute('d')));
    },{tag,center});
    if(tag!=='honeycomb-menu')await page.waitForFunction(()=>rasterMenu.hasAttribute('opening-ready'));
    await page.waitForTimeout(550);
    // Surface fade must be finished too, otherwise changing shade opacity
    // between screenshots would be mistaken for changed polygon pixels.
    await page.waitForFunction(()=>rasterMenu.shadowRoot.querySelector('#shade').getAnimations().every(a=>a.playState==='finished'));
    const item=page.locator(center?`${tag}-item.center-item`:`${tag}-item`).first();const svg=item.locator('ha-svg-icon svg');const bounds=await svg.boundingBox();
    const clip={x:Math.floor(bounds.x+bounds.width/2)-20,y:Math.floor(bounds.y+bounds.height/2)-20,width:40,height:40};
    // Restart only the cell zoom after native SVG loading; force forward fill
    // at its final instant to sample the compositor's in-animation raster.
    await page.evaluate(tag=>{
     const style=document.createElement('style');style.textContent=`${tag}-item {animation-fill-mode:both!important}`;rasterMenu.shadowRoot.append(style);
     for(const e of rasterMenu.shadowRoot.querySelectorAll(`${tag}-item`))for(const a of e.getAnimations()){a.pause();a.currentTime=499.999;}
    },tag);
    const last=await page.screenshot({clip,path:`${output}/${id}-last.png`});
    await page.evaluate(({tag})=>{
     for(const e of rasterMenu.shadowRoot.querySelectorAll(`${tag}-item`))for(const a of e.getAnimations())tag==='honeycomb-menu'?a.finish():a.cancel();
    },{tag});
    const rest=await page.screenshot({clip,path:`${output}/${id}-rest.png`});
    assert.deepEqual(await svg.boundingBox(),bounds,'Resting icon dimensions changed');
    const equal=last.equals(rest);
    if(tag==='pat97-honeycomb-menu')assert.ok(equal,`Icon raster changed at zoom end: ${id}`);
    if(tag==='pat97-honeycomb-menu') {
     // Use stationary integer masks. Playwright's automatic masks follow the
     // transformed icon bounds and can round differently with/without a layer.
     const rects=await page.locator(`${tag}-item ha-state-icon`).evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {x:Math.floor(r.x)-2,y:Math.floor(r.y)-2,w:Math.ceil(r.width)+4,h:Math.ceil(r.height)+4};}));
     await page.evaluate(rects=>{window.edgeMasks=rects.map(r=>{const e=document.createElement('div');e.style.cssText=`position:fixed;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;background:magenta;z-index:2147483647`;document.body.append(e);return e;});},rects);
     const options={clip:{x:260,y:150,width:480,height:480}};
     const stableEdges=await page.screenshot({...options,path:`${output}/${id}-edges-layer.png`});
     await item.locator('ha-state-icon#icon').evaluate(e=>e.style.transform='none');
     const ordinaryEdges=await page.screenshot({...options,path:`${output}/${id}-edges-no-layer.png` });
     const edgeDelta=await page.evaluate(async urls=>{const data=[];for(const url of urls){const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);data.push(ctx.getImageData(0,0,canvas.width,canvas.height).data);}return data[0].reduce((max,value,i)=>Math.max(max,Math.abs(value-data[1][i])),0);},[stableEdges,ordinaryEdges].map(buffer=>`data:image/png;base64,${buffer.toString('base64')}`));
     // Switching compositing off deliberately can change ancestor edge AA.
     // Record that difference, never call it pixel parity. Geometry must stay
     // identical, and the actual zoom handoff above still needs exact glyphs.
     const polygonBounds=await item.boundingBox();
     await item.locator('ha-state-icon#icon').evaluate(e=>e.style.removeProperty('transform'));
     assert.deepEqual(await item.boundingBox(),polygonBounds,`Icon layer moved the polygon: ${id}`);
     report.push({id:`${id}-layer-control`,edgeDelta,polygonBounds});
     await page.evaluate(()=>edgeMasks.forEach(e=>e.remove()));
    }
    report.push({id,dpr,tag,icon,pixelEqual:equal});
   }
  }
  console.log(`PASS icon raster DPR ${dpr}: original / 0.16.13 / current, three native SVGs, unchanged polygon bounds`);await context.close();
 }
 assert.ok(report.some(r=>r.tag==='before-honeycomb-menu' && !r.pixelEqual),'Verifier missed previous-release raster handoff');
 await writeFile(`${output}/report.json`,JSON.stringify({upstreamSha256:createHash('sha256').update(upstream).digest('hex'),cases:report},null,2));
 console.log(`PASS ${report.filter(r=>r.tag).length} A/B cases. Native HA elements, isolated hass provider; evidence: ${output}`);
}finally{await browser.close();}

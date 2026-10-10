// Native HA icon/card/ripple classes from the public demo; the hass provider
// is isolated test data. No device services are executed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const card=process.argv[process.argv.indexOf('--button-card')+1];
assert.ok(process.argv.includes('--button-card'),'Supply the real button-card bundle');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.NATIVE_OUTPUT || '/tmp/honeycomb-native-opening';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const report=[];
async function setup(dpr,baseline=false) {
 const context=await browser.newContext({viewport:{width:1000,height:800},deviceScaleFactor:dpr});
 const page=await context.newPage();
 // Deliberately delay native SVG chunk requests, not a replacement icon stub.
 await page.route('**/mdi/*.json',async route=>{await new Promise(r=>setTimeout(r,250));await route.continue();});
 await page.goto('https://demo.home-assistant.io',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>['ha-state-icon','ha-icon','ha-svg-icon','ha-card','ha-ripple'].every(n=>customElements.get(n)),{},{timeout:45000});
 await page.evaluate(()=>{
  const hass={states:{'light.room':{entity_id:'light.room',state:'off',attributes:{friendly_name:'Room'}},'fan.room':{entity_id:'fan.room',state:'on',attributes:{percentage:66}}},user:{id:'test'},config:{unit_system:{length:'km',temperature:'°C'}},locale:{language:'en',number_format:'language',time_format:'language'},themes:{themes:{},darkMode:false},localize:k=>k,callService:async()=>{},formatEntityState:s=>s.state};
  const provider={hass,provideHass:e=>{e.hass=hass}};
  const query=document.querySelector.bind(document);
  document.querySelector=selector=>selector==='home-assistant'?provider:query(selector);
  document.addEventListener('hass-action',e=>e.stopImmediatePropagation(),true);
  const wrapper=document.createElement('div');wrapper.style.cssText='position:fixed;inset:0;z-index:999999;background:#929292';document.body.append(wrapper);
  const view=document.createElement('div');view.id='native-view';view.style.cssText='width:1000px;height:800px';wrapper.append(view);
 });
 await page.addScriptTag({path:card,type:'module'});
 await page.addScriptTag(baseline?{content:execFileSync('git',['show','0.16.12:pat97-honeycomb-menu.js'],{cwd:root,encoding:'utf8'})}:{path:`${root}pat97-honeycomb-menu.js`});
 return {context,page};
}
async function record(page,count,theme) {
 return page.evaluate(async({count,theme})=>{
  function nodes(root){return [...root.querySelectorAll('*')].flatMap(e=>[e,...(e.shadowRoot?nodes(e.shadowRoot):[])]);}
  testMenu?.remove();
  const dark=theme==='dark';
  for(const name of ['--ha-card-background','--card-background-color']) document.documentElement.style.setProperty(name,dark?'#1c1c1c':'white');
  const entity=count===3?'light.room':'fan.room';
  const icons=count===3?['mdi:information-outline','mdi:lightbulb-on-outline','mdi:lightbulb-off-outline']:['mdi:information-outline','mdi:power','mdi:fan-speed-1','mdi:fan-speed-2','mdi:fan-speed-3','mdi:fan-off'];
  const menu=document.createElement('pat97-honeycomb-menu');menu.hass=document.querySelector('home-assistant').hass;
  menu.setConfig({entity,style:'mushroom',size:260,spacing:1,animation_speed:70,animation_mode:'paired',center_button:false,empty_slots:'hidden',button_defaults:{autoclose:false,tap_action:{action:'more-info'},show_name:false,show_state:false,styles:{icon:[{color:dark?'#e1e1e1':'#171717'}]}},buttons:Array.from({length:count},(_,i)=>[{icon:icons[i%icons.length]}])});
  window.testMenu=menu;menu.display(document.querySelector('#native-view'),500,400);
  const frames=[];const start=performance.now();
  while(performance.now()-start<2600){
   await new Promise(r=>requestAnimationFrame(r));
   frames.push({time:performance.now()-start,cells:[...menu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item')].map(item=>{
    const descendants=nodes(item.shadowRoot);const svg=descendants.find(e=>e.localName==='svg');const rect=item.getBoundingClientRect();const sr=svg?.getBoundingClientRect();const style=getComputedStyle(item);
    return {slot:item.dataset.honeycombSlot,visibility:style.visibility,opacity:Number(style.opacity),transform:style.transform,center:[rect.x+rect.width/2,rect.y+rect.height/2],svg:sr?[sr.x+sr.width/2,sr.y+sr.height/2,sr.width,sr.height]:null,path:svg?.querySelector('path')?.getAttribute('d')||''};
   })});
   if(performance.now()-start>1200 && menu.hasAttribute('opening-ready') && frames.at(-1).cells.length===count && frames.at(-1).cells.every(c=>c.transform==='none')) break;
  }
  return frames;
 },{count,theme});
}
function verify(frames,count) {
 const last=frames.at(-1);assert.equal(last.cells.length,count);
 for(let i=0;i<count;i++) {
  const end=last.cells[i];assert.equal(end.transform,'none');assert.ok(end.path,'Native SVG failed to load');
  const visible=frames.filter(f=>f.cells[i]?.visibility==='visible' && f.cells[i].opacity>0.001);
  assert.ok(visible.some(f=>f.cells[i].transform!=='none'),'Opening zoom was not exercised');
  let previousWidth=0;
  for(const frame of visible){
   const cell=frame.cells[i];assert.equal(cell.path,end.path,'SVG appeared/changed while cell was visible');
   assert.ok(Math.hypot(cell.center[0]-end.center[0],cell.center[1]-end.center[1])<0.04,'Cell center jumped');
   assert.ok(Math.hypot(cell.svg[0]-end.svg[0],cell.svg[1]-end.svg[1])<0.04,'Native icon center jumped');
   assert.ok(cell.svg[2]+0.04>=previousWidth,'Icon zoom reversed');previousWidth=cell.svg[2];
  }
 }
}
try {
 // Negative control: current release starts zoom before delayed SVGs exist.
 const old=await setup(1,true);
 await old.page.evaluate(()=>{window.testMenu=null;});
 const broken=await record(old.page,6,'dark');
 await writeFile(`${output}/0.16.12-negative-frames.json`,JSON.stringify(broken,null,2));
 assert.throws(()=>verify(broken,6),/SVG appeared\/changed/,'Verifier did not reproduce pre-fix late icon rendering');
 await old.context.close();
 for(const dpr of [1,1.25,1.5,2]) {
  const {context,page}=await setup(dpr);await page.evaluate(()=>{window.testMenu=null;});
  for(const theme of ['dark','light']) for(const count of [3,6,18]) {
   const id=`${theme}-${count}-dpr${dpr}`;
   const frames=await record(page,count,theme);verify(frames,count);
   await writeFile(`${output}/${id}-frames.json`,JSON.stringify(frames,null,2));
   const options={clip:{x:260,y:150,width:480,height:480}};
   await page.screenshot({...options,path:`${output}/${id}-rest.png`});
   const items=page.locator('pat97-honeycomb-menu-item');
   for(const index of [0,count-1]){
    const item=items.nth(index);const bounds=await item.boundingBox();
    const glyph=await item.locator('ha-svg-icon svg').boundingBox();
    await item.hover();await page.waitForTimeout(200);
    assert.deepEqual(await item.boundingBox(),bounds,'Native ripple moved the cell');
    assert.deepEqual(await item.locator('ha-svg-icon svg').boundingBox(),glyph,'Native ripple moved the icon');
    await page.mouse.move(900,700);await page.waitForTimeout(200);
    assert.deepEqual(await item.locator('ha-svg-icon svg').boundingBox(),glyph);
   }
   await page.evaluate(()=>{for(const item of testMenu.shadowRoot.querySelectorAll('pat97-honeycomb-menu-item'))item.shadowRoot.querySelector('button-card').setConfig({...item.config,show_ripple:false});});
   await page.waitForTimeout(250);
   const noRipple=await page.screenshot(options);
   await items.first().hover();await page.waitForTimeout(250);
   assert.ok(noRipple.equals(await page.screenshot(options)),'Native hover moved pixels with ripple disabled');
   await page.mouse.move(900,700);await page.waitForTimeout(250);
   assert.ok(noRipple.equals(await page.screenshot(options)));
   report.push({id,frames:frames.length,stableOpening:true,nativeIcons:true,nativeRipple:true});
  }
  console.log(`PASS native opening/hover DPR ${dpr}: light/dark, 3/6/18 buttons`);await context.close();
 }
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 console.log(`PASS ${report.length} native HA cases; old-release negative control rejected. hass/services are isolated test data. ${output}`);
}finally{await browser.close();}

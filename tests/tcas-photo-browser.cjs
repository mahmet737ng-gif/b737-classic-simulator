// Exercise the installed cockpit entry including Settings, both sockets and panel detents.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || undefined});
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8754/panel-mosaic-lab/cockpit/', {waitUntil:'domcontentloaded'});
    const panel = page.locator('[data-faceplate="transponder-tcas"]');
    await panel.locator('button').first().waitFor({state:'attached'});
    const setEquipment = async value => {
      await page.locator('#aircraftSettingsOpen').evaluate(b => b.click());
      await page.locator('#ivsiEquipment').selectOption(value);
      await page.locator('#aircraftSettingsForm').evaluate(f => f.requestSubmit());
      await page.waitForFunction(n => document.querySelectorAll('[data-tcas-ivsi]').length === n, value === 'traffic' ? 2 : 0);
    };
    await setEquipment('traffic');
    for (const name of ['Squawk digit 1','Squawk digit 2','Squawk digit 3','Squawk digit 4','TEST','15','BELOW','2','FL · absolute altitude','ATC IDENT'])
      await panel.getByRole('button',{name,exact:true,includeHidden:true}).evaluate(b => b.click());
    const c = await page.evaluate(() => B737UnifiedTcasV1.getControls());
    assert.deepEqual([c.code,c.mode,c.rangeNm,c.filter,c.unit],['3111','TEST',15,'BELOW',2]);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-faceplate="transponder-tcas"] img')].every(i => i.naturalWidth > 0));
    for(const seat of ['captain','firstOfficer']){
      const instrument=page.locator('[data-tcas-ivsi="'+seat+'"]');
      await instrument.getByTitle('TA SEL · full-time / popup').evaluate(b => b.click());
      await instrument.getByTitle('IVSI brightness').evaluate(b => b.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown'})));
      await page.waitForFunction(s => Number(document.querySelector('[data-tcas-ivsi="'+s+'"] canvas').style.opacity)===.95,seat);
    }
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.querySelectorAll('[data-tcas-ivsi]').length === 2);
    await setEquipment('analog');
    console.log('Both TCAS VSI sockets, configuration persistence, octal wheels, range/mode detents, TA SEL and BRT passed.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e);process.exitCode=1; });

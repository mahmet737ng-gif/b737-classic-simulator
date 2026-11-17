/* IRS Test Lab scenario catalogue — QRH D6-27370-3/500-SEP 11.5–11.10,
 * FCOM 11.10/11.20; B737 MRG IV.11 298–300.
 * Concise training summaries, NOT operational QRH checklists.
 * INJECTED scenarios are instructor simulations rather than real hardware failures.
 */
(function(root,factory){'use strict';const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.B737IRSTestScenariosV1=a;})
(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const qr={
 dc:'QRH 11.5 — IRS DC FAIL',fault:'QRH 11.6–11.9 — IRS FAULT',
 ondc:'QRH 11.10 — IRS ON DC',align:'MRG IV.11 p.298 — IRS ALIGN',
 mrg:'MRG IV.11 p.299–300; FCOM 11.10/11.20',
 normal:'FCOM 11.20.7–9; SP.11.4–5'
};
function item(id,group,title,subtitle,ref,level,steps,expected){
 return Object.freeze({id,group,title,subtitle,ref,level,steps,expected});
}
const all=Object.freeze([
item('normal-nav','ALIGN','Normal OFF → NAV','Normal latitude · momentary ON DC and ten-minute ALIGN',qr.normal,'CORE',
 ['Move the selector directly from OFF to NAV','Observe the momentary ON DC indication followed by ALIGN','Enter a valid Present Position','Verify NAV READY and extinguished ALIGN after the required interval'],
 ['ON DC initially illuminates then extinguishes','Steady ALIGN with timer','Valid position entered','NAV READY after completion']),
item('normal-align','ALIGN','OFF → ALIGN hold','50°N latitude · manual NAV selection required',qr.normal,'CORE',
 ['Select ALIGN at 50°N','ALIGN should remain steadily illuminated after ten minutes','Select NAV only when alignment is ready'],
 ['Steady ALIGN remains until NAV is selected','Baseline ten-minute alignment','Position invalid until NAV']),
item('no-position','ALIGN','ENTER IRS POSITION — 08','Alignment complete but PPOS not entered',qr.align,'CORE',
 ['Complete alignment without entering a position','Inspect flashing ALIGN and code 08','Re-enter correct position through FMC/ISDU'],
 ['ALIGN FLASH','ISDU 08','CDU ENTER IRS POS','NAV INVALID until position entered']),
item('motion','ALIGN','IRS MOTION — 03','Aircraft motion during alignment',qr.align,'CORE',
 ['Introduce ground speed during alignment','Inspect ALIGN lamp and code 03','Stop motion and repeat full alignment verification'],
 ['ALIGN FLASH','ISDU 03','CDU IRS MOTION','No valid NAV solution']),
item('stored-position','ALIGN','Stored PPOS mismatch — 12','Stored position differs from entered position',qr.align,'CORE',
 ['Fail the internal stored-position comparison','Enter position and observe code 12','Re-enter a verified position'],
 ['ALIGN FLASH','ISDU 12','Second verified PPOS entry resolves initial mismatch']),
item('computed-position','ALIGN','Unreasonable latitude — 04','Internal latitude check fails',qr.align,'CORE',
 ['Fail the internal latitude check','Inspect code 04 after position entry','Correct the comparison and enter a valid position'],
 ['ALIGN FLASH','ISDU 04','FAULT remains OFF']),
item('computed-twice','ALIGN','Position check repeated → FAULT','Internal position check fails twice',qr.fault,'CORE',
 ['Enter invalid position twice during internal checks','Observe FAULT illumination','Verify recovery through OFF and full alignment'],
 ['ISDU 04','FAULT ON','NAV INVALID','Recovery via OFF']),
item('verify-origin','ALIGN','VERIFY POSITION (>4 NM)','FMC alert, not an IRS hardware fault',qr.normal,'CORE',
 ['Choose a position more than 4 NM from ORIGIN','Inspect VERIFY POSITION message','Verify that FAULT and codes 04/12 do not appear'],
 ['CDU VERIFY POSITION','FAULT OFF','No 04/12 error code']),
item('invalid-format','ALIGN','Invalid latitude/longitude','ISDU/CDU keypad input-format check',qr.normal,'CORE',
 ['Enter a position with invalid minutes','Verify rejection of the entry','Position display must not become valid'],
 ['INVALID COORDINATE','No fabricated NAV data']),
item('high-lat-mode','ALIGN','High latitude wrong selector','OFF → NAV at 71°N; ALIGN required',qr.normal,'CORE',
 ['Select NAV directly at 71°N','System must detect incorrect high-latitude mode','Return to OFF then ALIGN to restart correctly'],
 ['HIGH LAT MODE REQUIRED','NAV INVALID']),
item('high-lat-correct','ALIGN','High latitude 17 min','71°N with ALIGN selected',qr.normal,'CORE',
 ['Move from OFF to ALIGN at 71°N','Maintain ALIGN for 17 minutes','Then select NAV'],
 ['ALIGN HOLD','17 MIN','Manual NAV selection after completion']),
item('fast-realign','ALIGN','Fast realignment','NAV → ALIGN, position update and 30-second interval',qr.normal,'CORE',
 ['With valid NAV, select ALIGN','Verify the position again','After 30 seconds select NAV'],
 ['FAST REALIGN 30s','NAV INVALID during test']),
item('off-shutdown','ALIGN','OFF / 30s shutdown','ALIGN lamp during shutdown sequence',qr.normal,'CORE',
 ['Select OFF with IRS powered','ALIGN remains on during SHUTDOWN','Verify fully OFF after approximately 30 seconds'],
 ['SHUTDOWN 30s','NAV INVALID','ALIGN OFF after shutdown']),
item('on-dc-left','POWER','L IRS ON DC','AC STANDBY lost; DC supply valid',qr.ondc,'CORE',
 ['Remove AC STANDBY supply','Verify left ON DC annunciation','Verify continuity while DC remains valid'],
 ['L ON DC ON','L NAV VALID','R normal']),
item('on-dc-right','POWER','R IRS ON DC','AC TRANSFER 2 supply lost',qr.ondc,'CORE',
 ['Remove AC TRANSFER 2','Verify right ON DC annunciation','Observe the five-minute limit'],
 ['R ON DC ON','R DC backup','R cutoff at 300s']),
item('right-300','POWER','R IRS — 5-minute cutoff','End of 300-second right DC backup',qr.ondc,'CORE',
 ['Remove AC TRANSFER 2','Advance 300 seconds in DC operation','Right NAV is lost and alignment invalid'],
 ['R POWER LOST','L UNCHANGED','R NAV INVALID']),
item('dual-on-dc','POWER','Both IRS ON DC','Both AC sources lost, shared DC valid',qr.ondc,'CORE',
 ['Remove both AC supplies','Verify both IRS operating on DC','After five minutes only R reaches its limit'],
 ['L ON DC','R ON DC','R five-minute limit']),
item('dc-fail-left','POWER','Single DC FAIL — L','Left backup DC branch failed; AC valid',qr.dc,'INJECTED',
 ['Inject left DC backup-branch failure','Observe left DC FAIL indication','Left IRS remains valid on AC'],
 ['L DC FAIL','L NAV VALID','QRH 11.5 single case']),
item('dc-fail-right','POWER','Single DC FAIL — R','Right backup DC branch failed; AC valid',qr.dc,'INJECTED',
 ['Inject right DC backup-branch failure','Observe right DC FAIL indication','Right IRS remains valid on AC'],
 ['R DC FAIL','R NAV VALID']),
item('dc-fail-dual','POWER','Dual DC FAIL','Shared switched hot battery disruption',qr.dc,'CORE',
 ['Remove SWITCHED HOT BATTERY BUS','Verify DC FAIL for both IRS','Both NAV outputs remain valid while AC is available'],
 ['L/R DC FAIL','L/R AC VALID','Inspect shared DC supply']),
item('power-loss-left','POWER','Complete L power loss','Both AC and DC supplies required by left IRS lost',qr.mrg,'CORE',
 ['Remove AC STANDBY and associated DC supply','Left IRS loses NAV','Right IRS remains independent'],
 ['L POWER LOST','L NAV INVALID','R NAV VALID']),
item('power-restore','POWER','Restore AC / full alignment','Electrical power restored after losing IRS reference',qr.normal,'CORE',
 ['Cause complete IRS power loss','Restore AC supply','Require self-test and fresh full alignment'],
 ['SELFTEST','NO STALE NAV','NEW POSITION REQUIRED']),
item('fault-ground','QRH','IRS FAULT on ground','QRH 11.6–11.7 · FAULT + ALIGN recovery',qr.fault,'CORE',
 ['Observe FAULT + ALIGN on ground','Hold OFF until shutdown completes','Restart with NAV and position entry','If FAULT persists, do not consider the dispatch training scenario complete'],
 ['FAULT ON','ALIGN FLASH','Recovery or stop dispatch simulation']),
item('fault-flight','QRH','IRS FAULT in flight','QRH 11.8–11.9 · Lost navigation reference and ATT',qr.fault,'INJECTED',
 ['Inject single IRU fault in flight','That NAV output becomes invalid','Review ATT and source-transfer concepts in training'],
 ['FAULT ON','NAV INVALID','ATT only if recovery succeeds']),
item('att-relevel','QRH','ATT relevel 30 sec','Straight-and-level conditions and heading entry',qr.fault,'INJECTED',
 ['Select ATT on faulty IRU','Maintain steady straight-and-level flight for 30 seconds','Enter magnetic heading'],
 ['ATT RECOVERY','30s STRAIGHT/LEVEL','HEADING ENTRY']),
item('fault-both','QRH','Both IRS fault / transfer','Alternative source and navigation unavailability',qr.fault,'INJECTED',
 ['Inject faults in both IRUs','Both NAV sources become invalid','Review source transfer and limitations from QRH'],
 ['DUAL FAULT','NO VALID IRS NAV','IRS TRANSFER TRAINING']),
item('unverified-cb','CB','Candidate IRS CB — unverified','IRS positions in P18-2 / P6-1 lack verified WDM assignments',qr.mrg,'INJECTED',
 ['Select a candidate CB for testing','Verify NOT VERIFIED appears','Do not claim real IRS power cut without circuit evidence'],
 ['CB ROUTE UNVERIFIED','NO FALSE POWER DISCONNECT'])
]);
const groups=Object.freeze([
 {id:'ALIGN',title:'Alignment / Position',subtitle:'11 scenarios + startup'},
 {id:'POWER',title:'Electrical / Backup',subtitle:'9 scenarios'},
 {id:'QRH',title:'Non-normal / QRH',subtitle:'4 scenarios'},
 {id:'CB',title:'Circuit Breakers',subtitle:'Unverified circuits'}
]);
const byId=id=>all.find(x=>x.id===id)||null;
return Object.freeze({all,groups,byId,sourceEdition:'QRH-300500.pdf · D6-27370-3/500-SEP · 2016; MRG IV.11 pp.298-300'});
});
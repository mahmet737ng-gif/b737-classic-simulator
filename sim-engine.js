/**
 * B737 Classic classroom demonstration model.
 * Partial orientation from user-supplied Sepehran Airlines B737CL FCOM,
 * Supplementary Procedures, Electrical, SP.6.1–SP.6.3 (PDF pages 196–198).
 * This is NOT an aircraft-specific, FAA-approved or dispatch-ready simulation.
 * Power source labels indicate SWITCH SELECTION, not verified bus energization.
 * No performance, failures, or safety-critical system logic is modeled.
 */
(function(){
  'use strict';
  const exercises = [
    {id:'battery',title:'Battery selector',desired:'ON',hint:'Switch the battery to its demo ON position.'},
    {id:'stby-power',title:'Standby power selector',desired:'AUTO',hint:'Check the selected standby position.'},
    {id:'hyd-elec1',title:'Electric hydraulic pump 1',desired:'OFF',hint:'Confirm the demo pump switch is not selected ON.'},
    {id:'hyd-elec2',title:'Electric hydraulic pump 2',desired:'OFF',hint:'Confirm the demo pump switch is not selected ON.'},
    {id:'gear-handle',title:'Landing gear selector',desired:'DOWN',hint:'Compare the demo lever with the ground-state configuration.'},
    {id:'external-power',title:'Ground-power selector',desired:'ON',hint:'Select external power only for this simulated ground-power path.'}
  ];
  function status(s){
    const battery=s.battery==='ON';
    const standby=s['stby-power']||'OFF';
    const chosen=[];
    if(s['external-power']==='ON') chosen.push('GROUND POWER');
    if(s['apu-gen']==='ON') chosen.push('APU GEN');
    if(s.gen1==='ON') chosen.push('ENG GEN 1');
    if(s.gen2==='ON') chosen.push('ENG GEN 2');
    const available=chosen.length>0;
    const alerts=[];
    if(!available && battery)alerts.push('BATTERY SELECTED • AC source not selected');
    if(s['apu-gen']==='ON')alerts.push('APU generator selected; APU speed and bus status are NOT modeled');
    if((s.gen1==='ON'||s.gen2==='ON'))alerts.push('Engine generators selected; engine running status is NOT modeled');
    if((s['fuel-center-left']==='ON'||s['fuel-center-right']==='ON'))alerts.push('Center fuel quantity is NOT modeled; pump selection is visual only');
    if(standby==='OFF')alerts.push('Standby power selector in OFF position');
    return {battery: battery?'ON':'OFF',standby,source:chosen.join(' + ')||'NONE',power:available?'AC SOURCE SELECTED':battery?'BATTERY ONLY':'NO SOURCE',alerts};
  }
  function evaluate(s){return exercises.map(t=>({...t,current:s[t.id]??'UNKNOWN',ok:s[t.id]===t.desired}));}
  window.B737SimEngine={status,evaluate,exercises,reference:{document:'Sepehran Airlines 737CL FCOM',part:'SP.6.1–SP.6.3',pdfPages:'196–198',scope:'Partial ground electrical orientation. Not a complete checklist.'}};
})();
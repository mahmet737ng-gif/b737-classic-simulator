/* B737 Classic OH10/OH11 electrical needle MRG QA inspector.
 * Standalone demonstration of physical-value/source auditing only; DO NOT
 * control any instrument's live angle until its native photo scale is certified.
 */
(function(){"use strict";
function mount(){
 const source=window.B737MrgElectricalNeedleAudit;
 const V7=window.B737ElectricalV7;
 const Consumer=window.B737MRGClassicBusConsumerAudit;
 let consumerIndex=null;
 const parent=document.getElementById("unifiedAcDcMeteringNeedles")||document.querySelector(".inspector");
 if(!source||!V7||!parent||document.getElementById("mrgClassicElectricalNeedleQA"))return;
 const section=document.createElement("section");section.id="mrgClassicElectricalNeedleQA";
 section.style.cssText="padding:14px;border:1px solid #7c8d97;border-radius:10px;margin:14px 0;background:#19242a;color:#eff3f7;max-width:580px;direction:ltr";
 const label=document.createElement("h3");label.textContent="MRG Classic · OH10 / OH11 Meter & Needle Logic QA";section.append(label);
 const pre=document.createElement("p");pre.style.fontSize="12px";pre.textContent="Reference: MRG IV.6 printed 142–143, 148, 151, 161–162. Numeric/state QA only — NO physical needle-angle or pivot correction.";
 section.append(pre);
 const meter=document.createElement("select");meter.setAttribute("aria-label","DC meter selector");
 const variant=document.createElement("select");variant.setAttribute("aria-label","Classic CPCS or DCPCS source configuration");
 for(const v of ["DCPCS","CPCS"]){const o=document.createElement("option");o.value=v;o.textContent="Generic "+v;variant.append(o);}
 for(const s of source.SELECTORS){const o=document.createElement("option");o.value=s;o.textContent=s;meter.append(o);}
 const dcVolts=document.createElement("input");dcVolts.type="number";dcVolts.step="0.1";dcVolts.placeholder="Observed DC volts";
 const dcAmps=document.createElement("input");dcAmps.type="number";dcAmps.step="0.1";dcAmps.placeholder="Observed DC amps";
 const oilTemp=document.createElement("input");oilTemp.type="number";oilTemp.step="0.1";oilTemp.placeholder="CSD oil temp °C";
 const oilPsi=document.createElement("input");oilPsi.type="number";oilPsi.step="0.1";oilPsi.placeholder="CSD oil psi";
 const fault=document.createElement("button");fault.type="button";fault.textContent="TEST TR1 FAIL (trainer only)";
 const out=document.createElement("pre");out.style.cssText="white-space:pre-wrap;font-size:12px;line-height:1.55;overflow-wrap:anywhere";
 const layout=document.createElement("div");layout.style.cssText="display:flex;gap:8px;flex-wrap:wrap;align-items:center";
 for(const input of [meter,variant,dcVolts,dcAmps,oilTemp,oilPsi,fault]){input.style.maxWidth="170px";layout.append(input);}
 section.append(layout,out);
 parent.after(section);
 let electrical=V7.initialState();
 function optionalValue(el){return el.value.trim()===""?undefined:Number(el.value);}
 function render(){
  const observed={},drive={};
  if(optionalValue(dcVolts)!==undefined)observed.dcVolts=optionalValue(dcVolts);
  if(optionalValue(dcAmps)!==undefined)observed.dcAmps=optionalValue(dcAmps);
  if(optionalValue(oilTemp)!==undefined)drive.oilTempC=optionalValue(oilTemp);
  if(optionalValue(oilPsi)!==undefined)drive.oilPressurePsi=optionalValue(oilPsi);
  const report=source.evaluate({selector:meter.value,electrical:V7.evaluate(electrical),observed,drive,
   consumerIndex,consumerAudit:Consumer,variant:variant.value});
  const fmt=field=>field.range===null?"NOT INDICATED":field.range.join("–")+" ("+field.status+")";
  const needleRefs=report.needlePowerSourceCandidates;
  const evidence=needleRefs?Object.values(needleRefs):[];
  const sourceLines=evidence.map(x=>x.needleId+": "+x.evidence.map(e=>e.feedBus+" / "+e.feedVoltage).join(", "));
  out.textContent=[
   "Selected "+report.selector+" · "+report.selectedVoltageSource,
   "V: "+fmt(report.dcBusVoltageObserved)+" | A: "+fmt(report.selectedTRAmpsObserved),
   "Bus: "+String(report.upstreamBus)+" | TR source: "+String(report.trSourceAvailable),
   "CSD oil LOW PRESS (<120 psi): "+String(report.drive?.lowOilPressure??"not measured"),
   "CSD HIGH TEMP (>157°C): "+String(report.drive?.highOilTemp??"not measured"),
   "Source flags: "+(report.qa.join("; ")||"none"),
   "GEOMETRY: BLOCKED — OH10 DC AMPS pivot (310,168 vs 310,192); CPS (715,190 vs 780,192).",
   "These readings are an isolated V7 TEST STATE, not live aircraft sensor telemetry.",
   consumerIndex?"MRG CL pp182–188: "+consumerIndex.rows.length+" bus-consumer records, "+evidence.length+" mapped needle families; 0 EP-FSI wires verified":"MRG CL bus-to-item index: loading/unavailable",
   ...sourceLines
  ].join("\n");
 }
 for(const item of [meter,variant,dcVolts,dcAmps,oilTemp,oilPsi])item.addEventListener("input",render);
 fault.addEventListener("click",()=>{
  const old=electrical.faults.TR1_FAILED;
  electrical=V7.apply(electrical,{type:"FAULT",id:"TR1_FAILED",active:!old,instructor:true});
  fault.textContent=old?"TEST TR1 FAIL (trainer only)":"CLEAR TEST TR1 FAIL";
  render();
 });
 render();
 if(Consumer&&typeof fetch==="function"){
  fetch(new URL("../../engine/systems/mrg-classic-340-consumer-bus-index-v1.json",document.baseURI))
   .then(r=>{if(!r.ok)throw Error("MRG index HTTP "+r.status);return r.json();})
   .then(data=>{Consumer.validate(data);consumerIndex=data;render();})
   .catch(e=>{console.warn("MRG generic load-table reference unavailable",e);});
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();
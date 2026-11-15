/* Classic EFIS Reference Engine v1 (training/visual QA; not an approved avionics model).
 * New, independent module. Does not alter protected cockpit or source photographs.
 * Inputs must carry validity; unknown data is never fabricated.
 */
(function(root, factory) {
  const api=factory();
  if (typeof module==="object" && module.exports) module.exports=api;
  if (root) root.ClassicEFISReferenceEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function() {
  "use strict";
  const VERSION="CLASSIC-EFIS-REFERENCE-V1";
  const MODES=Object.freeze(["FULL_VOR_ILS","EXP_VOR_ILS","FULL_NAV","EXP_NAV","MAP","CTR_MAP","PLAN"]);
  const RANGES=Object.freeze([10,20,40,80,160,320]);
  const SOURCES=Object.freeze({
    EADI:"FCOM CL Vol2 10.30.6-10.30.14 and 10.40.2-10.40.4",
    FMA:"FCOM CL Vol2 Ch4 and 10.30.6/10.40.2",
    SPEED:"FCOM CL Vol2 10.30.10-10.30.12",
    FLAGS:"FCOM CL Vol2 10.30.13-10.30.14",
    MAP:"FCOM CL Vol2 10.31.2-10.31.9",
    VOR_ILS:"FCOM CL Vol2 10.31.10-10.31.17",
    PLAN:"FCOM CL Vol2 10.31.18-10.31.19",
    EFIS:"FCOM CL Vol2 10.30.1-10.30.5 and 10.40",
    COMPANION:"Cockpit Companion COMBI: Classic-only pages, EHSI printed pp.165-168 (secondary)"
  });
  const def=(id,gate,source,opts={})=>Object.freeze({
    id,gate,source,modes:opts.modes||"ALL",requires:opts.requires||[],
    category:opts.category||"symbol",visualAudit:"PENDING",logicAudit:"PENDING",
    note:opts.note||"Effectivity and visual geometry require page-by-page validation"
  });
  const EADI=Object.freeze([
    def("attitude-card","attitude","EADI"),def("horizon","attitude","EADI"),
    def("pitch-ladder","attitude","EADI"),def("roll-scale","attitude","EADI"),
    def("roll-pointer","attitude","EADI"),def("aircraft-reference","attitude","EADI"),
    def("flight-director","flightDirector","EADI",{requires:["afds"]}),
    def("fma-at","fma","FMA"),def("fma-pitch","fma","FMA"),def("fma-roll","fma","FMA"),
    def("speed-tape","airspeed","SPEED"),def("speed-readout","airspeed","SPEED"),
    def("speed-limits","speedLimits","SPEED"),def("speed-bugs","speedBugs","SPEED"),
    def("mach","mach","SPEED"),def("groundspeed","groundspeed","EADI"),
    def("pitch-limit","pitchLimit","EADI"),def("localizer","localizer","EADI"),
    def("glideslope","glideslope","EADI"),def("decision-height","decisionHeight","EADI"),
    def("radio-altitude","radioAltitude","EADI"),def("marker","marker","EADI"),
    def("tcas-ra","tcasRA","EADI"),def("windshear","windshear","EADI"),
    def("attitude-failure-flag","flag:ATT","FLAGS",{category:"failure"}),
    def("flight-director-flag","flag:FD","FLAGS",{category:"failure"}),
    def("airspeed-failure-flag","flag:SPD","FLAGS",{category:"failure"}),
    def("localizer-failure-flag","flag:LOC","FLAGS",{category:"failure"}),
    def("glideslope-failure-flag","flag:GS","FLAGS",{category:"failure"}),
    def("pitch-comparator","flag:PITCH_COMP","FLAGS",{category:"failure"}),
    def("roll-comparator","flag:ROLL_COMP","FLAGS",{category:"failure"}),
    def("symbol-generator-failure","flag:SG_FAIL","FLAGS",{category:"failure"})
  ]);
  const NAV=["MAP","CTR_MAP","EXP_NAV","FULL_NAV","PLAN"];
  const VOR=["FULL_VOR_ILS","EXP_VOR_ILS"];
  const EHSI=Object.freeze([
    def("compass-rose","heading","EFIS"),def("mag-true-reference","heading","EFIS"),
    def("track-index","track","MAP",{modes:NAV}),
    def("heading-pointer","heading","EFIS"),def("selected-heading-bug","selectedHeading","EFIS",{modes:MODES.filter(m=>m!=="PLAN")}),
    def("aircraft-symbol","position","EFIS"),
    def("active-route","route","MAP",{modes:NAV}),
    def("active-waypoint","route","MAP",{modes:NAV}),
    def("distance-next-waypoint","route","MAP",{modes:NAV}),
    def("eta-next-waypoint","eta","MAP",{modes:NAV}),
    def("map-range-arcs","heading","MAP",{modes:["MAP","EXP_NAV","CTR_MAP"]}),
    def("airport-waypoint-symbols","navDatabase","MAP",{modes:NAV}),
    def("vor-adf-bearing","bearings","EFIS"),
    def("weather-radar","wxr","MAP",{modes:["MAP","CTR_MAP","EXP_NAV","EXP_VOR_ILS"]}),
    def("traffic","tfc","EFIS"),def("terrain","terrain","EFIS"),
    def("wind-vector","wind","MAP"),
    def("selected-course","course","VOR_ILS",{modes:VOR}),
    def("cdi","cdi","VOR_ILS",{modes:VOR}),
    def("glideslope","glideslope","VOR_ILS",{modes:VOR}),
    def("vor-ils-ident","navReceiver","VOR_ILS",{modes:VOR}),
    def("to-from","toFrom","VOR_ILS",{modes:VOR}),
    def("plan-true-north","heading","PLAN",{modes:["PLAN"]}),
    def("navigation-failure","flag:NAV","EFIS",{category:"failure"}),
    def("heading-failure","flag:HDG","EFIS",{category:"failure"}),
    def("symbol-generator-failure","flag:SG_FAIL","EFIS",{category:"failure"})
  ]);
  const REGISTRY=Object.freeze({EADI,EHSI});
  const ALL=Object.freeze([...EADI.map(s=>({...s,display:"EADI"})),...EHSI.map(s=>({...s,display:"EHSI"}))]);
  function wrap360(value){const n=Number(value);return Number.isFinite(n)?((n%360)+360)%360:null;}
  function orientation(mode){
    if(mode==="PLAN")return "TRUE_NORTH";
    return mode==="FULL_VOR_ILS"||mode==="EXP_VOR_ILS"?"HEADING_UP":"TRACK_UP";
  }
  function signal(s,key){
    const o=s.signals && s.signals[key];
    return o && o.valid===true && o.value!==undefined && o.value!==null ?
      {valid:true,value:o.value}: {valid:false};
  }
  function defaultSeat(){
    return {powered:false,sgValid:false,mode:"MAP",rangeNm:40,
      signals:{},flags:{},options:{wxr:false,tfc:false,terrain:false},effectivity:"UNVERIFIED"};
  }
  function normalizeSeat(s={}){
    const d=defaultSeat();
    return {...d,...s,mode:MODES.includes(s.mode)?s.mode:d.mode,
      rangeNm:RANGES.includes(Number(s.rangeNm))?Number(s.rangeNm):d.rangeNm,
      signals:{...d.signals,...(s.signals||{})},
      flags:{...(s.flags||{})},options:{...d.options,...(s.options||{})}};
  }
  function compileSeat(display, seatState){
    if(!REGISTRY[display]) throw new Error("Unknown display: "+display);
    const s=normalizeSeat(seatState);
    const orient=orientation(s.mode);
    const refKey=orient==="HEADING_UP"?"heading":orient==="TRACK_UP"?"track":null;
    const reference=refKey?wrap360(signal(s,refKey).value):0;
    return {version:VERSION,display,mode:s.mode,rangeNm:s.rangeNm,
      orientation:orient,referenceDegrees:reference,
      segments:REGISTRY[display].map(spec=>{
        let state="READY",reason="";
        if(!s.powered){state="HIDDEN";reason="DISPLAY_UNPOWERED";}
        else if(!s.sgValid){state=spec.id==="symbol-generator-failure"?"PENDING_VALIDATION":"HIDDEN";reason="SYMBOL_GENERATOR_INVALID";}
        else if(spec.modes!=="ALL"&&!spec.modes.includes(s.mode)){state="HIDDEN";reason="MODE_EXCLUDED";}
        else if(spec.gate.startsWith("flag:")){
          const key=spec.gate.slice(5);if(s.flags[key]!==true){state="HIDDEN";reason="FLAG_NOT_ACTIVE";}
        } else if(!signal(s,spec.gate).valid){
          state="HIDDEN";reason="SOURCE_NOT_VALID";
        } else if(spec.gate==="wxr"&&!s.options.wxr){
          state="HIDDEN";reason="OPTION_OFF";
        } else if(spec.gate==="tfc"&&!s.options.tfc){
          state="HIDDEN";reason="OPTION_OFF";
        } else if(spec.gate==="terrain"&&!s.options.terrain){
          state="HIDDEN";reason="OPTION_OFF";
        } else if(spec.gate==="route" && !(signal(s,"route").value||{}).executed){
          state="HIDDEN";reason="ROUTE_NOT_EXECUTED";
        }
        if(state==="READY"&&spec.requires.some(key=>!signal(s,key).valid)){
          state="HIDDEN";reason="REQUIRED_SOURCE_INVALID";
        }
        const v=state==="READY"?signal(s,spec.gate).value:null;
        return {id:spec.id,state,reason,source:SOURCES[spec.source],
          visualAudit:spec.visualAudit,logicAudit:spec.logicAudit,
          data:v,category:spec.category};
      })};
  }
  function compileAircraft(state={}){
    const seats=state.seats||{};
    return {CAPT:{EADI:compileSeat("EADI",seats.CAPT),EHSI:compileSeat("EHSI",seats.CAPT)},
      FO:{EADI:compileSeat("EADI",seats.FO),EHSI:compileSeat("EHSI",seats.FO)}};
  }
  function auditReport(display){
    const specs=display?REGISTRY[display]:ALL;
    if(!specs)throw Error("Unknown display");
    return specs.map(s=>({display:s.display||display,id:s.id,source:SOURCES[s.source],
      logic:s.logicAudit,visual:s.visualAudit,acceptance:"NOT APPROVED"}));
  }
  function compareRGBA(reference,candidate,width,height,mask){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)
      throw new Error("Invalid reference dimensions");
    const count=width*height,expected=count*4;
    if(!reference||!candidate||reference.length!==expected||candidate.length!==expected)
      throw new Error("Reference and candidate RGBA dimensions must match");
    if(mask&&mask.length!==count)throw new Error("Mask dimensions must match");
    let sum=0,channels=0,diffPixels=0,covered=0;
    for(let i=0;i<count;i++){
      if(mask&&mask[i]===0)continue;
      covered++;let large=false;
      for(let c=0;c<3;c++){
        const d=Math.abs(reference[i*4+c]-candidate[i*4+c]);
        sum+=d;channels++;if(d>24)large=true;
      }
      if(large)diffPixels++;
    }
    return {meanAbsoluteError:channels?sum/channels:null,
      mismatchedFraction:covered?diffPixels/covered:null,comparedPixels:covered,
      status:"MEASUREMENT_ONLY_NOT_AIRCRAFT_APPROVAL"};
  }
  return Object.freeze({VERSION,MODES,RANGES,SOURCES,REGISTRY,wrap360,orientation,
    defaultSeat,normalizeSeat,compileSeat,compileAircraft,auditReport,compareRGBA});
});

# IRS computed latitude — separate evidence and entered-position checks

**Backend implementation:** `engine/systems/irs-trainer-web-v1.js`
**QA:** `tests/irs-independent-latitude-v1.test.cjs` (Node, GitHub Actions).

## What the real system measures

On initial alignment an inertial reference unit can infer its **latitude** from earth-rotation / inertial sensor behavior. It cannot derive the aircraft's starting **longitude** independently from the same mechanism; the crew enters present latitude **and** longitude through the FMC or IRS ISDU.

The B737 Classic includes at least two different kinds of checks that must NOT be merged:

1. **FMC ORIGIN check**: entered PPOS latitude/longitude more than 4 nautical miles from the FMC ORIGIN airport → `VERIFY POSITION`. This is a crew advisory and does not itself constitute a failed IRS internal alignment.
2. **IRU internal position check:** the sensed latitude is compared with entered latitude after the alignment period. Technical maintenance material describes *sine* and *cosine* comparison limits of approximately `|sin(entered)-sin(sensed)| <= 0.15` and `|cos(entered)-cos(sensed)| <= 0.01234`; an internal mismatch causes flashing ALIGN and on a repeated identical failing position may generate FAULT. **It is NOT proven that the internal IRU threshold is 4NM.**

## Owner-requested 4NM training variant

The project owner requests a 4-NM difference policy for comparing **latitude only**. The backend now has two selectable acceptance policies, with the owner training variant defaulting when a computed latitude is explicitly provided:

- `OWNER_4NM`: `abs(pilotEnteredLatitudeDeg - sensorLatitudeDeg) * 60 <= 4`. Four arcminutes of latitude correspond approximately to 4 nautical miles. The rule does not compare longitude.
- `CLASSIC_SIN_COS`: use the published technical comparison in sine and cosine. It is **not** mathematically the same as a fixed 4 NM.

The checks require a separate, signed sensor value `latitudeDeg` and explicit source `SIMULATOR_SENSOR` or `INSTRUCTOR_SENSOR`. The IRU engine must **never copy FMC/ISDU-entered latitude into its computed latitude field**; the longitude is never marked internally calculated.

### Backend API

```js
const core=require('./engine/systems/irs-trainer-core-v1.cjs');
let irs=core.initialState({
  requireIndependentLatitude:true,
  latitudeComparisonPolicy:'OWNER_4NM'
});
irs=core.apply(irs,{type:'POWER',side:'L',available:true});
irs=core.apply(irs,{type:'SELECT_MODE',side:'L',mode:'NAV'});
irs=core.apply(irs,{
  type:'SET_COMPUTED_LATITUDE',
  side:'L',
  latitudeDeg:35.0,
  source:'SIMULATOR_SENSOR'
});
// Crew submits independent PPOS latitude and longitude via FMC/ISDU:
// irs=core.apply(irs,{type:'FMC_SET_IRS_POS',sides:['L'],position:'N35040 E051254'});
// After 3.5s startup + normal 600s alignment, 4.0NM latitude error is accepted.
// 5NM error flashes ALIGN, inhibits NAV and requires a corrected crew entry.
// A second identical failing entry sets the internal FAULT.
```

When `requireIndependentLatitude:true` and no sensed latitude exists, the IRS stays in `WAIT_LATITUDE_SENSOR`, with invalid navigation output. Once a qualified sensor value is supplied, alignment may finish without copying the crew PPOS. Power loss erases the old computed-latitude evidence.

**Current live implementation boundary:** the approved Unified IRS frontend receives no independent sensor latitude. To avoid breaking the existing bench demo, `requireIndependentLatitude` is **false by default** in old Unified entrypoints. The independent validation is active whenever a sensor latitude is provided, or whenever a strict-mode backend session is created. A dedicated real simulator/instructor input bridge is still needed before the Unified physical controls can claim they perform this strict check. The complete 93-file owner visual RED ZONE is preserved.

## Sources and effectivity caveat

- Project FCOM context: Boeing 737 Classic 300/400/500 11.20.7–10, and FMC POS INIT / ORIGIN check.
- [737-300/-400/-500 operations manual](https://www.32kb.net/library/Manuals/Boeing/boeing_737_300_400_500_operations_manual.pdf) — position entry and IRS startup.
- [737-3/500 avionics training manual](https://studylib.net/doc/26292929/b737-3-500-avioni-vol-1-continental) — independent latitude comparison and alignment mismatch.
- [B737-3 ATA34 maintenance training reference](https://www.scribd.com/document/676880102/B737-3-34-B1) — sine/cosine thresholds and lack of computed longitude.

Educational simulation only; not usable for real navigation or aircraft servicing.

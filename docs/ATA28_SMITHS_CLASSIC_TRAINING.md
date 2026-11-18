# Classic ATA 28 and Smiths indicator implementation

## Source applicability

| Parameter | Implemented value | Evidence |
| --- | --- | --- |
| Main 1 / Main 2 / Center usable capacity | 4555 / 4555 / 7029 kg; total 16139 kg | [737 Classic FCOM 12.20.4](https://boredaviator.com/wp-content/uploads/2025/03/B737-300-FCOM-.pdf), nominal at 0.8029 kg/L and level attitude |
| Lateral main tank imbalance limit | 453 kg | [Classic FCOM L.10.9](https://p7aviation.com/LMS/wp-content/uploads/2022/11/B-737-CL-FCOM-Rev-47-15-06-2021.pdf) |
| Temperature limits | Maximum 49 °C. Minimum in flight is the greater of −45 °C or freeze point + 3 °C | Classic FCOM L.10.9 |
| Fuel temperature measurement | Main tank 1; AC-powered instrument | Classic FCOM 12.20.3. Specific airframe bus and instrument power failure effect are still open. |
| Quantity indicator power | AC standby | Classic FCOM 12.10.3 |
| Common FUEL QTY CB | Smiths C397, P6. Unified photo position P6-3 A4 | [Smiths 2307 supplement 28-41-04 p. 401](https://www.manualslib.com/manual/2572585/Smiths-Boeing-B737-100.html?page=54) and repository P6-3 photo catalog |
| Tank indication CBs | P6-3 F5 left, F4 center, F3 right | Repository P6-3 photo labels. Individual interruption is a training mapping pending effectivity-specific wiring. |
| QTY TEST | Held presentation: zero/ERR 4. Release: all segments, blank, full-scale and live quantity | Classic FCOM SP.12.4–5. Stored codes are an open implementation item. |

## Model boundaries

The ECU has one fuel ledger. Tank leak rates in kg/h drain the selected tank in simulated time, stop at zero, and are tallied separately from APU or engine burn. The existing feed logic then determines pump inlet pressure, feed transfer and starvation. The instructor temperature input represents the main 1 sensor. Temperature status is a limit comparison for the instructor, with no additional invented cockpit annunciator.

The flight scenario plant applies a bounded roll-rate disturbance toward the heavier wing. The coefficient is an approximation for training, not airframe flight-test data. It does not model spanwise fuel distribution, actual center of gravity, structural loads, trim or certified controllability.

The Smiths glass uses the photographed segments in both panel variants. Normal indication rounds to the nearest whole kg and maps the tank fraction to 20 ring segments. Quantization and ring mapping are presentation choices pending confirmation against the metric instrument part number. Its AC standby evidence and CB states are read from the existing electrical and CB owners.

FUEL FLOW RATE uses the existing ECU fuel-flow observation in kg/h. FUEL USED follows the actual engine-burn ledger in kg and RESET starts a fresh indication without altering tank contents. Dedicated leaks and APU burn are excluded from engine FUEL USED. Existing variant-specific controls and meter power gating remain active.

## Open effectivity and simulation items

EP-FSI S/N 29340 wiring/AMM confirmation, complete QRH/MRG fault inventory and BITE fault memory, feed-line and engine-side leak positions, refueling/defueling valves, fuel filter differential pressure and bypass, fuel thermal transport/icing, exact fuel-flow switch and meter effectivity, verified pump and indication pin-level wiring, aircraft weight/CG and calibrated aerodynamic effects.

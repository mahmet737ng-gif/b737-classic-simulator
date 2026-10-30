# Installed live battery

The battery is now attached to the actual Unified electrical Pack, physical
BATTERY/STANDBY switches and existing OH10 BAT ammeter/voltmeter. Operation does
not require Controls. A small status readout on the cockpit viewport shows SOC,
terminal volts, signed amps, discharge watts, and cumulative Ah/Wh consumed.

## What is live

- Real elapsed time integrates charge in Ah; the clock runs with engines/APU off.
- The battery state's owner is `ECU.start.core.pack.electricalState.battery`.
- BATTERY OFF disconnects switched loads while hot-bus keep-alive remains.
- Actual panel brightness and illuminated lamp count alter the model's current.
- STANDBY BAT adds modeled DC standby and inverter loads; inverter loss removes
  the inverter load. APU inlet-door/start phases add their modeled demands.
- Exhaustion/undervoltage removes the battery as an available source; affected
  buses and the normal overhead/main annunciator power gate follow this state.
- The actual DC selector BAT position supplies dynamic volts and signed current
  to the original needles. Negative amps = discharge; positive amps = charge.
- Existing external AC/ground-service/main-2 charger paths restore charge. Charger
  current tapers near full and cannot create more than the battery's capacity.
- Stored charge survives reload and switch/scenario reset. Closed-browser time
  is paused; an open background tab catches up using elapsed wall time.
- Independent visual lamp tests and explicit per-system bench modes retain their
  diagnostic purpose. This release is not a verified load schedule for every LRU.

## Source versus training parameters

The private Classic FCOM 6.20.9 identifies a 24 V NiCd battery, automatic charging,
22–30 V operating range and a minimum standby endurance statement. It does not
establish the EP-FSI part number/capacity or a per-component current schedule.

For this functioning training battery, **40 Ah**, the voltage curve, 0.012-ohm
internal resistance, 25 A charger ceiling, 20 A charge target, 85% inverter
efficiency and all component current estimates are explicitly training values.
They must not be presented as measurements or certified EP-FSI performance.
The on-panel readout says `40 Ah مدل آموزشی`.

The modeled draw includes 0.05 A hot-bus keep-alive, 1.2 A switched controls,
3 A panel electronics, 0–4 A backlighting, 0.06 A per illuminated annunciator,
8 A DC standby and 160 W inverter output. APU starter profile is 250 A; no AC
fuel/hydraulic-pump battery feeder has been invented. The physical +/-50 A
meter saturates at its calibrated limits during a larger modeled start load;
the viewport readout retains the full numerical current.

## Validation

11 tests cover coulomb conservation, real-time partition equivalence, depletion,
recharge/taper, invalid saved state, shared-Pack bus cutoff and BAT meter data,
actual load inputs, BATTERY OFF, external-power recovery and no reset refill.

Browser checks with Controls closed confirmed a draining SOC, physical BATTERY
OFF reducing current from about 7.57 A to 0.05 A, zero ordinary ON annunciators
without panel power, reload preserving consumed capacity, battery switch ON
moving the DC ammeter, panel brightness increasing draw to about 9.57 A and
physical STANDBY BAT raising draw to about 24.95 A. Values depend on lit lamps.

All overhead images, Owner18 guarded-switch code/geometry/close policies and
the complete IRS frontend remain unchanged. New electrical inputs use additive
ports; no protected hashes are rebased.

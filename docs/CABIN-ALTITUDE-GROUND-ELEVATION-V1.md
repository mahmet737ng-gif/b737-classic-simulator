# Cabin altitude — airport-specific Cold & Dark baseline

## Correct initial ground state

When cabin air has equalized to the local external static pressure, the cabin altitude indication represents the pressure-derived elevation of the ground environment, **not a universal zero**. This training implementation uses an ISA/field-elevation reference in feet. Under nonstandard QNH the physical pressure-altitude distinction must be modeled separately if the selected equipment is sensitive to it.

| ICAO | Airport | User-supplied scenario elevation | Cabin altitude at equalization | Differential pressure |
| --- | --- | ---: | ---: | ---: |
| OIAW | Ahwaz | 66 ft | 66 ft | 0 psi |
| OIII | Mehrabad | 3,963 ft | 3,963 ft | 0 psi |
| OIMM | Mashhad | 3,260 ft | 3,260 ft | 0 psi |

These three figures are **training-scenario values supplied by the project owner**, not an imported certified airport database. An authoritative navigation provider or simulator airport data must override them when available. Other airports are supported by supplying ICAO plus field elevation in feet; no arbitrary elevation is inferred for an unknown ICAO.

## Architecture and implementation

1. `engine/config/ground-airfield-elevation-v1.js` resolves known scenario ICAOs or externally supplied field elevation, distinguishes known from missing, and returns a zero-differential, zero-cabin-rate baseline **only while on ground and equalized**.
2. `engine/config/aircraft-profile-v1.js` constructs either CPCS or DCPCS with the same initial airport **but independent controller and physical plant instances**. Initial aircraft altitude, cabin altitude, differential pressure and cabin rate are set coherently before the first simulated second. Reset retains the selected airport field altitude.
3. The ground-airport rebase operation is explicitly blocked in flight or when cabin differential pressure is nonzero. An aircraft already prepressurized on the ground cannot be silently reinitialized to ambient pressure.
4. `panel-mosaic-lab/cockpit/aircraft-settings.js` has an airport selector, a custom ICAO/field-elevation input, an adapter API and a `b737:airport-ground-context` event. The web trainer defaults to a **clearly labeled Mehrabad training scenario (OIII)**, not an assertion that a user's connected aircraft is actually in Tehran. A connected source should provide actual airport/elevation.
5. `panel-mosaic-lab/cockpit/cold-dark-indicators-unified.js` reads the same selected ground-airfield context; if physical pressure is not equalized, it does not substitute airport height for measured cabin altitude.
6. `panel-mosaic-lab/cockpit/cabin-dual-needles-unified.js` displays the actual numeric `CAB ALT` / `DIFF PRESS` trainer readings in its inspector from the selected pressure system, **without faking an approved physical needle-to-printed-tick calibration**.

### Adapter API

```js
// A source with an active ground airport:
window.B737PressurizationIntegration.setGroundAirport('OIAW');
// An airport not in the preset list, from authoritative simulator/nav data:
window.B737PressurizationIntegration.setGroundAirport('OIFM', 5073);
// Or a ground source event:
window.dispatchEvent(new CustomEvent('b737:airport-ground-context', {
  detail: {icao:'OIMM', fieldElevationFt:3260, onGround:true}
}));
```

`getGroundAirport()` returns the active reference and source. In-flight requests are not treated as location resets. `setGroundAirport` is a **trainer ground reinitialization** action: it resets previously instantiated pressurization controller sessions only if their cabin pressures are equalized. It never chooses a source on the user's behalf beyond its visible standalone-training default.

## Validation

`tests/cabin-field-elevation-v1.test.cjs` tests all three elevations for both CPCS and DCPCS (six starting scenarios), resets, equalized pressure, independent controller state, unsupported airports, external values, flight lockout, ground prepressurization lockout and the displayed readout contract.

Source images and approved pointer sprites were **not changed**. The existing 54-face Cold & Dark policy remains the baseline. CAB ALT remains **numerically and physically correct** in the provisional pressure model, but its pointer sprite/inner tick positions are still not approved for aircraft-value coupling. That visual qualification is a separate gated work item, as are all other uncleared gauge photos.

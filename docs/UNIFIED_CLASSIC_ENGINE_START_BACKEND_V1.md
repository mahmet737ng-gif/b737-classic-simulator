# Unified B737 Classic engine-start backend

This integration is added to the existing ISN03/ISN18 ECU, not a shadow engine.

Prestart: existing APU/crossbleed/isolation/packs/battery; indicated training-duct selection 35 PSI nominal, FCOM pressure guidance 30 PSI sea level less 0.5 PSI per 1,000 ft. Training dial is NOT a measured gauge. Low-pressure scenarios remain possible with caution.

Start: GRD, starter valve feedback and amber annunciation, N2 motoring, FCOM fuel IDLE cue at 25% N2 or max motoring >=20% plus N1 rotation, selected IGN L/BOTH/IGN R with electrical bus eligibility; FLT override both channels; actual ignition remains observation-gated.

Lightoff: fuel flow and EGT, abnormal EGT 725 advisory, 46% N2 starter cutout returns GRD to OFF. Running at cutout is NOT stable idle. New `ecu.get().engineStartBackend.engine1/engine2` and `engines.engineN.start` show stabilized ground-idle training status based on N1, N2, EGT, fuel, oil, released starter.

Starter: 120s maximum use is enforced even without fuel. First retry 20s and later retry 180s are published as guidance only; retry interlocks are not implemented.

GEN OFF BUS is a training projection only; fuel valve closed stays with the dedicated fuel-shutoff indicator. The source-connected oil pressure and bypass lamps are retained.

Reference map: FCOM 7.10.22/7.20.7-9, NP.21.33-35; MRG IV.6/7; LAN ATA74/80. Classroom simulation, NOT for actual flight.

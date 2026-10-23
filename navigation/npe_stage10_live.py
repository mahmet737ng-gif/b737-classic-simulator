#!/usr/bin/env python3
"""Stage10 live simulator source-reference navigation; NO operational AFDS writes."""
from __future__ import annotations
from dataclasses import dataclass
from npe_stage8 import Stage8Error
from npe_stage9_guidance import ReferenceGuidance, MODE_TRACK
from npe_stage10_bus import AircraftStateBus, VERSION as BUS_VERSION

VERSION='STAGE10_LIVE_REFERENCE_NAV_v1'

class AFDSReferencePort:
    """An explicit one-way, non-actuating boundary to future EP-FSI AFDS models.

    Flight director *preview* is drawn on a lab/overlay only. This adapter
    deliberately has no methods for steering real or simulator autopilot axes.
    """
    @staticmethod
    def publish_preview(guidance):
        permitted=(guidance.get('mode')==MODE_TRACK and guidance.get('reference_only') is True
          and guidance.get('command_authority')=='SIMULATED_ADVISORY_ONLY'
          and guidance.get('afds_commands')==[] and guidance.get('aircraft_actuator_commands')==[]
          and guidance.get('lnav_commands')==[] and guidance.get('vnav_commands')==[])
        bank=guidance.get('sim_fd_bank_preview_deg') if permitted else None
        if type(bank) not in (int,float) or not -20<=bank<=20:bank=None
        return {'mode':'SIM_REF_FD_PREVIEW' if bank is not None else 'FD_PREVIEW_OFF',
            'bank_preview_deg':bank,'autopilot_engaged':False,'flight_director_authority':False,
            'afds_commands':[],'servo_commands':[],'lnav_commands':[],'vnav_commands':[]}

    @staticmethod
    def request_afds_engage():
        return {'accepted':False,'status':'BLOCKED_UNVERIFIED_EP_FSI_AFDS_INTERFACE',
           'reasons':['AIRCRAFT_AFDS_INTERFACE_UNVALIDATED','EXPLICIT_PROCEDURE_ARINC_LEGS_MISSING',
                      'SIMULATOR_SENSOR_BRIDGE_NOT_VERIFIED'],
           'afds_commands':[],'servo_commands':[]}


@dataclass
class LiveReferenceSession:
    reference:dict
    initial_leg:int=0
    clock:object=None

    def __post_init__(self):
        self.bus=AircraftStateBus(clock=self.clock)
        self.guidance=ReferenceGuidance(self.reference,self.initial_leg)
        self.disarmed=True;self.terminal_reason='NOT_ARMED'
        self.last_render_seq=0

    def ingest(self,telemetry):
        try:return self.bus.publish(telemetry)
        except (Stage8Error,TypeError,KeyError):
            self.fail('TELEMETRY_REJECTED')
            raise

    def arm(self,explicit_simulation_consent):
        if explicit_simulation_consent is not True:raise Stage8Error('Explicit SIM ONLY consent required')
        self.bus.stage9_sensor()  # Requires healthy, fresh, supported airplane state
        if not self.disarmed:raise Stage8Error('Already armed; disengage before new session')
        if self.guidance.mode not in ('OFF','SUSPENDED','END_OF_CONTIGUOUS_GROUP'):
            raise Stage8Error('Old guidance state requires a reset')
        self.guidance.arm(True);self.disarmed=False;self.terminal_reason=None
        return {'version':VERSION,'status':'SIM_REFERENCE_ARMED','flight_director_authority':False,
                'afds_commands':[],'lnav_commands':[],'vnav_commands':[]}

    def fail(self,reason):
        self.guidance.disengage(reason);self.disarmed=True;self.terminal_reason=reason
        self.bus.invalidate()

    def disengage(self,reason='PILOT_DISENGAGE'):
        self.fail(reason)
        return self._inert(reason)

    def _inert(self,reason):
        return {'version':VERSION,'mode':'OFF','reason':reason,'session_authority':'SIM_REFERENCE_ONLY',
                'source':'AIRAC_2610_PRIVATE','bus_version':BUS_VERSION,
                'reference_only':True,'fmc_executable':False,
                'desired_true_track_deg':None,'distance_to_fix_nm':None,
                'fd':AFDSReferencePort.publish_preview({}),
                'afds_commands':[],'lnav_commands':[],'vnav_commands':[],'servo_commands':[],'aircraft_actuator_commands':[]}

    def frame(self):
        if self.disarmed:return self._inert(self.terminal_reason or 'DISARMED')
        try:
            current=self.bus.snapshot()
            if current['sequence']==self.last_render_seq:raise Stage8Error('No new sensor data')
            g=self.guidance.step(self.bus.stage9_sensor())
            if g['mode']!=MODE_TRACK:
                reason=g.get('reason','GUIDANCE_INTERRUPTED')
                self.fail(reason)
                return self._inert(reason)
            self.last_render_seq=current['sequence']
            # Only expose scalar advisory state; do not mutate cockpit state.
            fd=AFDSReferencePort.publish_preview(g)
            return {'version':VERSION,'mode':'SIM_REFERENCE_TRACK','session_authority':'SIM_REFERENCE_ONLY',
              'source':'AIRAC_2610_PRIVATE','bus_version':BUS_VERSION,
              'reference_only':True,'fmc_executable':False,
              'telemetry_seq':current['sequence'],
              'aircraft':current['aircraft'],
              'leg_index':g['leg_index'],'from':g['from'],'to':g['to'],'group':g['group'],
              'auto_sequenced_within_group':g['auto_sequenced_in_same_group'],
              'desired_true_track_deg':g['desired_true_track_deg'],
              'true_reference_course_deg':g['true_reference_course_deg'],
              'signed_cross_track_nm':g['signed_cross_track_nm'],
              'distance_to_fix_nm':g['distance_to_fix_nm'],'along_track_nm':g['along_track_nm'],
              'fd':fd,'afds_commands':[],'lnav_commands':[],'vnav_commands':[],'servo_commands':[],'aircraft_actuator_commands':[]}
        except (Stage8Error,KeyError,TypeError) as e:
            reason='REFERENCE_SUSPENDED: '+str(e);self.fail(reason);return self._inert(reason)
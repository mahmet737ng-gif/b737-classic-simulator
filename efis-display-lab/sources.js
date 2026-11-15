/* Traceable applicability for the independent, injected-input EFIS lab. */
(function(root){
 const sections = [
  ['FCOM 10.30.2–5','PDF 1322–1325','Panel / selectors','Seven detents and six ranges. FSI uses the VOR/ILS panel and a separate forward weather/terrain selector. The FSA integrated TERR panel has different effectivity.','Modelled'],
  ['FCOM 10.30.7–10; 10.40.3–6','PDF 1327–1330, 1402–1405','EADI / attitude, FD and RA','Bank scale, black outlined datum, command bars only with valid steering, LOC/GS validity, rising runway and RA/DH thresholds. RA below 1000 adds the circular scale.','Modelled; optical calibration open'],
  ['FCOM 10.30.11–12; LAN ATA 34-45','PDF 1331–1332','Windshear / TCAS RA','Red WINDSHEAR and red hatched forbidden-pitch regions; an externally supplied pitch limit drives the zone.','Injected warning / RA'],
  ['FCOM 10.30.13–15; 10.40.6–8','PDF 1333–1335, 1405–1407','EADI speed tape','45–420 kt scale, command bugs and V-speeds. Trend and speed-limit values require valid ADC, FMC and SWC data.','Partial; performance source bridge open'],
  ['FCOM 10.30.16–17; LAN ATA 34-22 p. 52','PDF 1336–1337','EADI flags / comparator','Selected SG failure is distinct from display power loss. Independent samples are compared at greater than 3°; transfer and invalid inputs can inhibit comparison or show COMP.','Modelled; exact comparators dwell open'],
  ['FCOM 10.31.2–19','PDF 1339–1356','EHSI layouts','MAP, CTR MAP, EXP/FULL NAV, EXP/FULL VOR, EXP/FULL ILS, and PLAN. VOR and ILS are presentations of the same pair of selector detents.','Nine presentations'],
  ['FCOM 10.32.2–6; 10.40.9–12','PDF 1359–1363, 1408–1411','Orientation','70° expanded scale, approximately 120° centered MAP arc, 360° full rose. FMC track falls back to IRS. PLAN chart is true north; its upper compass remains track-referenced.','Modelled'],
  ['FCOM 10.32.7–13','PDF 1364–1370','Radio and NAV deviation','MCP course for VOR/ILS, FMC course for NAV. VOR 5° per dot, NAV 2 NM per dot, normal LOC approximately 1° per dot. Radio frequency suppressed with auto-tune.','Modelled; optional bearing indications partial'],
  ['FCOM 10.32.14–23','PDF 1371–1380','Map and flight plan','Active leg, active/inactive fixes, route data, airport, NAVAID and WPT filters. Holding, procedure turns, FIX, profile points, and map capacity require an FMC feed.','Partial; synthetic route'],
  ['FCOM 10.32.24–28, 35–39; 10.40.12','PDF 1381–1385, 1392–1396, 1411','Weather / terrain / range','WXR requires both FSI selectors. WXR and TERR are mutually exclusive. Range disagreement removes the affected layer.','Synthetic return packets; no radar or EGPWS predictor'],
  ['FCOM 10.32.29–34','PDF 1386–1391','Traffic','TA amber filled circle, RA red filled square, proximate white filled diamond, other white outline. ± altitude hundreds placed above or below. 500 fpm trend threshold. Alerts survive TFC OFF.','Modelled with injected targets'],
  ['FCOM 10.32.40–41; 10.40.13; CC Classic pp. 48–49','PDF 1397–1398, 1412','Transfer / brightness','EFI transfer selects common symbol generator; IRS transfer selects common attitude source. Integral and remote light sensors coexist with manual dimming.','Source routing modelled; brightness curves open'],
  ['LAN ATA 34-22 pp. 48–106','EFIS control, operation and test','SG / LRU architecture','Five-detent examples identify different equipment. The invalid mode fallback uses selected radio type; invalid range can use WXR processed range. LAN describes DADC, IRS, VHF NAV, RA, FMC, WXR, SWC and monitor paths.','Cross-check; control-panel fallback and bench BITE open'],
  ['MRG Classic, pp. 158, 284–285','Electrical / EADI–EHSI malfunctions','Abnormal indications','Distinguishes loss of EFIS power, display and SG paths. Standby cockpit display power has serial/equipment applicability.','Reviewed; exact EP-FSI bus assignment open'],
  ['AFM D6-8730 Rev 32, §§1, 2, 3.1','EP-FSI / MSN 29340','Limitations and procedures','Reviewed IRS latitude, ATT, FMCS and EHSI MAP applicability and the equipment-dependent VHF limitation. AFM is not a source of glyph geometry.','Reviewed; no display hardware ID established'],
  ['BEA FSH604; Lufthansa LAN; CC Classic pp. 139–146','737-300 panel illustration and Classic display study','Reference shapes and placement','Reference figures show layout and symbol positions; scanned/OCR study, illustrations and video do not establish EP-FSI’s calibrated phosphor, glyph metrics, or SG software.','Geometry compared with FCOM drawings; hardware calibration open']
 ];
 const external = [
  ['Public Boeing Classic FCOM','https://boredaviator.com/wp-content/uploads/2025/03/B737-300-FCOM-.pdf'],
  ['Classic ATA 34 / Continental','https://studylib.net/doc/26292929/b737-3-500-avioni-vol-1-continental'],
  ['Classic ATA 34 / Alteon','https://www.scribd.com/document/707761574/B-ATA-34'],
  ['BEA 737-300 EFIS illustrations','https://bea.aero/fileadmin/documents/docspa/2004/su-f040103pa/pdf/su-f040103pa_05.pdf'],
  ['Classic cockpit photographs','https://commons.wikimedia.org/wiki/Category:Boeing_737_Classic_cockpits'],
  ['737-400 powered display photo','https://www.ne.jp/asahi/to/yagiya/B737-400story.html'],
  ['737-300 flight deck EFIS video catalog','https://www.itvv.com/products_map.php?symb=I'],
  ['737-300 real flight deck arrival','https://www.youtube.com/watch?v=o1Qh5QRpkaY']
 ];
 const api = {sections, external};
 if(typeof module==='object'&&module.exports) module.exports=api;
 root.EFISLabEvidence=api;
})(globalThis);

# فاز دوم شبکهٔ FMC / Avionics — ADC, GPS, VOR, DME
تاریخ 2026-10-30 | نسخه `AVIONICS_SENSOR_INGRESS_V2` | B737 Classic -300/-400/-500

## چه چیزی روی main اضافه شده است؟
- `engine/integration/avionics-sensor-ingress-v2.js`: پردازش مستقل دادهٔ دو ADC، دو GPS، دو VOR و دو DME با فهرست تجهیزات نصب‌شده، شناسایی صریح منبع شبیه‌ساز، محدودیت مقادیر، شمارهٔ توالی، مهلت تازگی و جلوگیری از انتشار ناقص بسته.
- `panel-mosaic-lab/cockpit/avionics-network-runtime-v1.js`: API فعال‌سازی و دریافت فریم، اتصال به Topicهای شبکهٔ قبلی. پردازشگر FMC در Tick دوره‌ای دوباره محاسبه می‌شود تا خرابی TTL حتماً روی `fmc.computed` ظاهر شود.
- `panel-mosaic-lab/cockpit/index.html`: کتابخانهٔ جدید قبل از Runtime شبکه بارگذاری می‌شود.
- `engine/runtime/tests/avionics-sensor-ingress-v2.test.cjs`: ۸ تست اضافه و `engine/runtime/tests/avionics-unified-adapters-v1.test.cjs` با یک تست End-to-End توسعه یافت؛ همه در workflow موجود قرار گرفته‌اند.

## قرارداد ارتباطی
هیچ‌کدام از هشت سنسور به‌صورت پیش‌فرض فعال **نیستند**. استفاده از GPS در EP-FSI تنها در صورت تأیید نصب تجهیزات و دریافت Telemetry معتبر مجاز است؛ مدل این نسخه نمی‌گوید روی آن هواپیما قطعاً GPS L/R نصب است.

اتصال یک منبع معتبر به‌صورت **اختیاری، صریح و با فهرست Channelهای واقعیِ منبع**:
```js
const av = window.B737UnifiedAvionicsNetworkV1;
av.configureSensorIngress({
  sourceId: 'XPLANE_115',
  equipment: { adc: [1,2], gps: [], vor: [1,2], dme: [1,2] }
});
```
این فقط نمونهٔ قرارداد است و وجود اتصال X-Plane را اثبات نمی‌کند. `gps: []` عمداً نشان می‌دهد نصب GPS را نباید پیش‌فرض گرفت.

مثال فرستادن یک فریم **وقتی آداپتر خارجی دادهٔ واقعی خود را خوانده است**:
```js
const observed = {
  schema:'B737_SENSOR_FRAME_V2',
  sourceId:'XPLANE_115',
  sequence: nextMonotonicSequence,
  sourceTimestampMs: Date.now(),
  sensors:{
    adc1: {valid:true, pressureAltitudeFt: measuredAltitudeFt, casKt: measuredCasKt, mach: measuredMach},
    dme1: {valid:true, stationIdent: tunedStationIdent, distanceNm: measuredDmeSlantRangeNm}
  }
};
av.ingestSensorFrame(observed);
```
متغیرهای `measured...` باید از آداپتر واقعی استخراج شوند. این کد صرفاً قرارداد است؛ خودش داده تولید نمی‌کند.

اگر سنسور Failure گزارش کند:
```js
av.ingestSensorFrame({
  schema:'B737_SENSOR_FRAME_V2',sourceId:'XPLANE_115',
  sequence: nextMonotonicSequence,sourceTimestampMs:Date.now(),
  sensors:{adc1:{valid:false,failureCode:'ADC_NO_DATA'}}
});
```
شبکه مقدار را `INVALID` می‌کند و مصرف‌کنندهٔ FMC نباید از آن عدد بخواند. اگر داده به مدت ۲ ثانیه برای ADC یا ۳ ثانیه برای GPS نفرستد، شبکه آن را `STALE` در نظر می‌گیرد؛ FMC فریم قدیمی را مجدداً معتبر اعلام نمی‌کند.

**قواعد Source Integrity**: تطبیق Source ID، Sequence افزایشی، زمان نه قدیمی‌تر از ۲٫۵ ثانیه و نه بیشتر از ۰٫۵ ثانیه در آینده، Channelهای اعلام‌شده در Manifest، بازهٔ واقعی Latitude/Longitude/Mach/Airspeed/Altitude و اعتبار مستقل سنسور. ابتدا تمام کانال‌های هر فریم بررسی می‌شوند و سپس انتشار آغاز می‌شود؛ ورودی ناقص نباید بخشی از مسیر را آلوده کند.

## نحوهٔ خواندن توسط بخش‌های دیگر
```js
av.getSignal('airdata.adc1');
av.getSignal('navigation.gps1');
av.getSignal('navigation.vor1');
av.getSignal('navigation.dme1');
av.getFmcInputs().position;     // includes source + quality
av.getFmcInputs().airData;      // actual ADC telemetry, NOT ECU training air context
av.getSensorIngressDiagnostics();
const unsubscribe=av.subscribe('fmc.computed',({value,quality})=>{ /* data consumer */ });
```

## مرزهای فنی و ایمنی
- دریافت داده‌های نمایشگر و ECU به معنی داشتن مقادیر ADC دقیق نیست؛ ADC فقط از آداپتر ADC می‌آید.
- DME، مسافت Slant Range ایستگاه است؛ با دو فاصلهٔ خام بدون ارتفاع/هندسه/اعتبار ایستگاه، FMC موقعیت ساختگی نمی‌سازد.
- ورود GPS در این مرحله منبع دادهٔ `SIMULATOR_TELEMETRY` است؛ جایگزین سخت‌افزار گواهی‌شده نمی‌شود.
- `AIRAC 2610` در CDU دارای جریان **Source Reference / Not FMC Executable** است؛ مدل آن را به دیتابیس اجرایی FMC ارتقا نمی‌دهد.
- صفحهٔ IRS، CDU، EFIS، Overhead، MCP و ۱۸ Guard Switch قفل‌شده **دست‌نخورده‌اند**.
- اطلاعات فقط بین مصرف‌کننده‌های همان نشست Unified منتشر می‌شوند؛ اگر «کاربران دیگر» به معنی چند دستگاه/اکانت مختلف است، Server با Authentication/Authorization و Sync مستقل لازم است.

## QA
`node --check engine/integration/avionics-sensor-ingress-v2.js`

`node --test engine/runtime/tests/avionics-sensor-ingress-v2.test.cjs`

`node --test engine/runtime/tests/avionics-unified-adapters-v1.test.cjs`

کد ۱۹ تست شبکه/حسگر/آداپتر از نظر سناریو در محیط JS ایزوله بررسی و پاس شده‌اند؛ اجرای Node Actions، مرورگر Pages و اتصال X-Plane/FSX هنوز تأیید عملی نشده‌اند. فعال‌سازی X-Plane/FSX نیازمند پل خواندن داده از شبیه‌ساز است.

## کارهای باقی‌مانده برای تکمیل این فاز
1. یافتن/پیاده‌سازی آداپتر خواندن واقعی منابع X-Plane 11.5 و FSX و تطبیق واحدهای متریک/Imperial و زمان.
2. شناسایی دقیق Effectivity GPS, ADC و Radio برای S/N 29340 (EP-FSI) از منابع معتبر AMM/IPC/WDM؛ فعلاً نصب فرض نمی‌شود.
3. تأیید Data Base Airac 2610 برای Read-only NAV Reference و عدم فعال‌سازی ناخواستهٔ LNAV/VNAV.
4. اتصال تجهیزات بر اساس WDM واقعی Bus → CB → Equipment و سناریوهای Fault (no fake wiring).

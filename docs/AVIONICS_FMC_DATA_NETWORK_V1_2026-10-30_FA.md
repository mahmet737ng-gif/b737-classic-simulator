# شبکه جامع دادهٔ Avionics و FMC در Unified — نسخهٔ 1
تاریخ: 2026-10-30 · هواپیما: Boeing 737 Classic -300/-400/-500 · هدف: Procedure/QRH Trainer (NOT FOR FLIGHT)

## پیاده‌سازی ثبت‌شده روی main
این شبکه به فایل cockpit/index.html متصل است و **درون یک نشست مرورگر/Unified** کار می‌کند. هیچ داده‌ای برای کاربران دیگر اینترنت ارسال نمی‌شود؛ منظور از Consumer کاربران فنی داده، یعنی ماژول‌های دیگر پروژه، است. اگر همکاری بین چند رایانه یا کاربر حقیقی مدنظر باشد، زیرساخت احراز هویت و ارتباط Real-time مجزا لازم دارد.

### لایه‌ها
1. `engine/runtime/avionics-data-network-v1.js`: گذرگاه داده، مالکیت یکتای Topic، اعتبار و عمر داده، Fan-out، Subscribe و Diagnostic.
2. `panel-mosaic-lab/cockpit/avionics-network-runtime-v1.js`: استخراج مستقل مشاهده‌های موجود از Unified بدون تغییر فایل‌های Front-end قفل‌شده؛ اتصال سنسورهای آینده با `connectExternal(owner)`.
3. `engine/integration/avionics-fmc-computer-v1.js`: مصرف‌کنندهٔ ورودی‌ها و تولید `fmc.computed`؛ **فقط محاسبات شواهد** و بدون فرمان مستقیم به تجهیزات.
4. موتورهای معتبر موجود بدون دست‌کاری: `B737ElectricalV7`، `B737IRSTrainerUnified`، `B737McpAFDSBridgeV1`، `B737ISNCockpitV1`، `B737FmcSystemsBridgeV1`، CDU v6.

### جدول مالکیت و پوشش واقعی
| Publisher | Topic | وضعیت | منبع |
|---|---|---|---|
| ELECTRICAL | electrical.buses | متصل | Electrical V7 bus snapshot (نه سیم‌کشی قطعه) |
| FMC_FEEDS | electrical.fmcFeeds | متصل | شواهد سه‌حالتهٔ FMC1/FMC2/CDUs از پل Chapter 11 |
| IRS | irs.left / irs.right | متصل | هر IRS جداگانه؛ position معتبر فقط در NAV_READY |
| MCP | mcp.state | متصل | Knob و مدها با مشخص بودن منشأ آموزشی |
| AFDS | afds.state | متصل | مدهای AFDS مشاهده‌ای؛ بدون servo |
| AUTOTHROTTLE | autothrottle.state | متصل | ARM و Thrust mode؛ بدون حرکت Lever |
| CDU | crew.flightplan | متصل | دادهٔ مشترک دو CDU از bridge قبلی؛ تایید LEGS جداگانه |
| ENGINE | propulsion.engine1/engine2 | متصل | ISN ECU مدل آموزشی |
| FUEL | fuel.quantity | متصل به مخازن **آموزشی** | جمع دقیق مدل main1+main2+center، نه خروجی Fuel Summation Unit واقعی |
| PNEUMATICS | pneumatics.state | جزئی | وضعیت discrete bleed از Engine Start Chain؛ فشار duct نامعلوم |
| ANTIICE | antiice.state | جزئی | Window Heat و TAT Heater Output؛ Engine/Wing Anti-Ice نامعلوم |
| AIRGROUND | aircraft.airground | متصل به مدل آموزشی | ECU Flight Context؛ سنسور Air/Ground واقعی مدل نشده |
| PROFILE | aircraft.profile | متصل | انتخاب هواپیما در Settings |
| CLOCK | clock.utc | متصل | ساعت UTC نشست |
| ADC | airdata.adc1 / adc2 | منتظر منبع زنده/مستند | بدون ADS/ADC ساختگی |
| GPS | navigation.gps1 / gps2 | منتظر منبع | فقط در صورت نصب / telemetry |
| VHF_NAV | navigation.vor1 / vor2 | منتظر منبع | Bearing و tuned stations |
| DME | navigation.dme1 / dme2 | منتظر منبع | Distance؛ FMC بدون هندسه/فرکانس تصحیح ساختگی نمی‌سازد |
| TAT | environment.tat | منتظر اندازه‌گیری دما | TAT heater به معنی حسگر دمایی نیست |
| NAVDB | navigation.database | منتظر اتصال دیتابیس معتبر به چرخه | فایل وجود دارد اما سیگنال صحت منبع هنوز ایجاد نشده |
| PERFDB | performance.database | منتظر گواهی دادهٔ عملکردی | Reference Performance معتبر لازم |
| ACARS | datalink.acars | Option / disconnected | فقط در صورت نصب |
| CB | cb.observations | منتظر اتصال واقعی | عکس و لیبل CB ادعای مسیر سیم‌کشی نیست |

## قرارداد پیام
هر Topic دارای `owner`, `quality` (`VALID`، `UNKNOWN`، `INVALID`، `STALE`)، `origin`، `revision`، `receivedAtMs` و `value` است. منشأ ممکن است `TRAINING_SCENARIO`، `CREW_ENTRY`، `SIMULATOR_TELEMETRY`، `REFERENCE_DATABASE`، `LIVE_SYSTEM` یا `UNVERIFIED` باشد. `LIVE_SYSTEM` در این کد به معنی سیستم فعال **شبیه‌ساز** است، نه حسگر تأییدشدهٔ هواپیمای واقعی.

- `UNKNOWN`: دیتای منبع متصل نشده؛ مقدار عددی خودسرانه جایگزین نمی‌شود.
- `INVALID`: سامانهٔ منبع خرابی یا نامعتبر بودن داده را گزارش می‌کند.
- `STALE`: از آخرین انتشار منبع بیش از TTL گذشته است.
- `VALID`: پیام فرم معتبر دارد؛ به معنای دقت تأییدشدهٔ AFM/AMM نیست.
- یک Subscriber معیوب سایر مصرف‌کننده‌ها را از کار نمی‌اندازد؛ داده در برگشت Copy می‌شود.

### API در Console خود Unified
```js
const net = window.B737UnifiedAvionicsNetworkV1;
net.getDiagnostics();                    // منبع، وضعیت، خطا، trace
net.getFmcInputs();                       // FMC aggregation, source quality, issues
net.getSignal('irs.left');                // داده و برچسب معتبر بودن
net.getSignal('electrical.fmcFeeds');
const unsubscribe = net.subscribe('fmc.computed', message => {
  console.log(message.value?.position, message.value?.guidance);
});
unsubscribe();
```

### اتصال ماژول ADC مستقل به شبکه
```js
// یک اتصال برای هر Owner؛ نمونهٔ قرارداد، نه دیتای ساختگی.
const adc = window.B737UnifiedAvionicsNetworkV1.connectExternal('ADC');
// هنگام دریافت telemetry معتبر و تازه از ADC، نه با timer دلخواه:
adc.publish('airdata.adc1', {
  pressureAltitudeFt: input.pressureAltitudeFt,
  casKt: input.casKt,
  mach: input.mach,
  tatC: input.tatC
}, {origin:'SIMULATOR_TELEMETRY'});
```
اتصال‌های مشابه برای GPS، VOR، DME، NAVDB، PERFDB، ACARS و CB تعریف‌شده‌اند. اتصال در فراخوانی بعدی با Owner تکراری خطا می‌دهد و هیچ آداپتری نمی‌تواند Topic ماژول دیگر را به جای آن منتشر کند.

### منطق FMC در نسخهٔ حاضر
- GPS Position Valid اولویت دارد؛ در صورت فقدان دادهٔ GPS معتبر، IRS سالم سمت چپ یا راست می‌تواند مرجع موقعیت شود.
- VOR/DME فقط `radioUpdate.availableCandidates` ارائه می‌کنند؛ Radio Fix بدون ایستگاه/هندسه/آنتن/ترتیب معتبر محاسبه نمی‌شود.
- عدم تأیید Feed، Route LEGS یا Position موجب غیرفعال شدن **شواهد آمادگی** می‌شود، نه اجرای فرمان پروازی.
- بازخورد A/T و AFDS فقط وضعیت و مدهاست؛ مسیر Control از FMC قبلی و مجوزهایش جدا و محافظت‌شده باقی مانده.
- Fuel Prediction، N1 Target و Top of Descent در این شبکه `null` می‌مانند تا جدول‌های AFM و دادهٔ معتبر برای عملکرد محاسباتی متصل شوند.
- با وصل منبع خارجی، `fmc.computed` به طور واکنشی در شبکه به‌روزرسانی می‌شود.

## وابستگی برق و CB
شناسه‌های کاندید عکس: P18-2 E8 FMC1، P6-1 C12 FMC2، P18-2 E9 CDU1، P6-1 C13 CDU2. اثر واقعی Trip و مسیر Bus→CB→LRU هنوز **UNVERIFIED** است؛ شبکه هرگز از روشن بودن Bus نتیجه نمی‌گیرد که یک FMC قطعاً برق دارد. رفتار افت تغذیه و ریکاوری 10 ثانیه‌ای در موتور قدیمی Chapter 11 نگهداری می‌شود.

## آزمایش و محدودیت
`node --test engine/runtime/tests/avionics-data-network-v1.test.cjs` (تست قراردادهای مستقل و ایمنی)؛ سناریوهای Node نوشته و به workflow افزوده شده‌اند. اتصال عملی روی Pages و نتیجهٔ CI باید جداگانه مشاهده و تأیید شود. هیچ ادعای تست Pixel/Browser یا wiring رسمی در این سند نیست.

فایل‌های قفل‌شدهٔ IRS Front-end، گاردها، CDU Bitmap/Fonts، MCP Artwork و پنل‌ها تغییری نکرده‌اند.

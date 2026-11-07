# B737 Classic (300/400/500) — رفتار سیستم‌ها هنگام قطع برق

**تاریخ:** 2026-11-07. **منابع:** FlySepehran B737 Classic FCOM §3.10.1, §6.20؛ B737 MRG IV.3/IV.6، ص 104، 110، 146، 162 تا 175 و 182 تا 188؛ Classic MRG 340-consumer index در همین مخزن.

**دامنه و اعتبار:** بررسی عمومی 737 Classic، نه تأیید سیم‌کشی مخصوص EP-FSI / S/N 29340. این سند و کد آموزشی‌اند؛ نباید برای عملیات واقعی پرواز استفاده شوند. 340 ردیف «تغذیه مصرف‌کننده» مساوی 340 backend متصل و تعاملی نیست.

## قواعد پایه
هر عملکرد باید با شش لایه مستقل محاسبه شود: (1) منبع GEN/APU/EXT/BATT؛ (2) باس دقیق همراه با کلاس ولتاژ 115VAC / 28VAC / 28VDC؛ (3) CB؛ (4) برق کنترلر و رله؛ (5) موتور/هیتر/اکچویتور؛ (6) حسگر، چراغ و Master Caution. یک CB کشیده شده برق کل باس را خاموش نمی‌کند. ناپدیدشدن داده یک گیج به‌معنای صفرشدن کمیت فیزیکی نیست. سوئیچ مکانیکی معمولاً در همان detent باقی می‌ماند. رفتار بعد از خرابی می‌تواند OFF، fail-last، spring-close، last valid/flagged، یا backed-up باشد.

## WINDOW HEAT — FCOM 3.10.1
| حالت | هیتر | Green ON | Amber OVERHEAT |
|---|---|---|---|
| ON / تغذیه سالم | طبق ترموستات | مطابق منطق کنترل/تست | خاموش |
| ON / قطع **برق هیتر** با کنترلر و هشدار سالم | قطع | خاموش | **روشن** (POWER INTERRUPTED) |
| ON / CB کنترلر یا برق نمایشگر قطع | قطع | خاموش | خاموش؛ چراغ خودش برق ندارد |
| ON / دمای واقعی بالاتر از limit | قطع توسط WHCU | خاموش طبق وضعیت | روشن، علت THERMAL |
| ON / OVHT TEST با سیستم برق‌دار | آزمون | طبق توالی SP.3.2 | روشن در زمان آزمون |
| OFF / بدون تست | قطع | خاموش | خاموش |
| Cold & Dark کامل | قطع | خاموش | خاموش |

چهار مسیر مستقل شبیه‌ساز: L FWD و R SIDE با heater GEN1 / controller MAIN1+DC1؛ L SIDE و R FWD با heater GEN2 / controller MAIN2+DC2. CB هیتر و کنترلر هر کدام جدا هستند. رنگ و تصویر قفل‌شده پنل هیچ تغییری نمی‌کند؛ فقط logics.
درخواست MASTER CAUTION/ANTI-ICE فقط زمانی که هشدار معتبر و پنل هشدار برق‌دار باشد. «قطع برق هیتر» را با «قطع برق خود هشدار» اشتباه نگیریم.

## جدول منبع برق / خرابی (MRG Classic)
| باس یا منبع | پیامد فیزیکی / عملکردی |
|---|---|
| GEN1/GEN2 output vs GEN BUS1/2 | خروجی ژنراتور و وصل‌شدن کنتاکتور دو مفهوم مجزا؛ ممکن است ولتاژ/فرکانس تولید شود اما GEN روی باس نباشد |
| GEN BUS1 | Electric hydraulic pump B، galley 1/2، بعضی WINDOW HEAT elements |
| GEN BUS2 | Electric hydraulic pump A، galley 3، عناصر پنجره دیگر |
| MAIN BUS1 | Fuel tank1 FWD pump، center RIGHT pump، تجهیزات کابین/تهویه/چراغ و Window Heat control |
| MAIN BUS2 | Fuel tank2 FWD pump، center LEFT pump، تجهیزات کابین/تهویه/چراغ و Window Heat control |
| TRANSFER BUS1 (115VAC, 28VAC) | tank1 AFT fuel pump، ignition1 LEFT، some pilot/alpha heat، air isolation valve، CPCS AUTO، engine1 oil indication، wheel-well/fire detection، trim و hydraulic B pressure indication |
| TRANSFER BUS2 (115VAC, 28VAC) | tank2 AFT pump، ignition2 LEFT، pitot/alpha heat، CPCS standby/manual AC، engine2 oil indication، trim و flap alternate/position، hydraulic A/brake pressure indication |
| DC BUS1 | Engine1 anti-ice/bleed command، left wiper، A/P A/FCC, yaw damper، autobrake-related outboard antiskid، fuel pump relay channels و DCPCS AUTO1 |
| DC BUS2 | Engine2 anti-ice/bleed command، right wiper، A/P B/FCC، autobrake، auto-speedbrake، stabilizer trim control، DCPCS AUTO2 و fuel pump relay channels |
| ELECTRONIC1/2 AC/DC | ADC، AFDS، EFIS/EHSI، FMC/CDU، GPWS، DME، NAV، radios، transponder و display channels بسته به سمت و نوع |
| BATTERY / HOT / SWITCHED HOT | APU ignition/start، fire extinguishing، starter valves، fuel shutoff، audio، indicator/warnings، clocks و برخی تجهیزات حیاتی مستقل از GEN BUS |
| AC STBY / DC STBY | در هوا با standby AUTO، باتری و static inverter می‌توانند حداقل ۳۰ دقیقه تغذیه تجهیزات ضروری را تأمین کنند. روی زمین پس از loss of ALL AC با AUTO، standby busها به‌طور خودکار باتری نمی‌گیرند؛ BAT باید انتخاب شود |
| GROUND SERVICE / EXTERNAL | مصرف‌کننده‌های زمینی و cabin، battery charger و خدمات، مستقل از پرواز |

**شرط مهم:** شکست یک GEN BUS لزوماً شکست TRANSFER BUS همان سمت نیست؛ BUS TRANSFER AUTO ممکن است آن را از منبع مقابل تغذیه کند. به‌همین‌ترتیب 28VAC یک باس مستقل منطقی از 115VAC و 28VDC است.

## ماتریس رفتار در ATAها
| ATA / System | رفتار در فقدان برق |
|---|---|
| 21 Air Conditioning | PACK fan/controls، bleed command و Ram Door مستقل؛ از دست رفتن موتور/اکچویتور با خاموشی صرف نمایشگر تفاوت دارد. 300/500 left mix valve با TRANSFER1، right mix valve با TRANSFER2 مختل می‌شود، دمای کابین تدریجاً تغییر می‌کند |
| 21 CPCS | TRANSFER1 loss ⇒ AUTO FAIL / fallback STANDBY؛ TRANSFER2 loss ⇒ STANDBY/MANUAL AC INOP و مسیر MANUAL DC جدا |
| 21 DCPCS | DC1 loss ⇒ AUTO1 failed؛ DC2 loss ⇒ AUTO2 failed؛ امکان کارکرد سمت سالم با قوانین انتقال معتبر |
| 22 Automatic Flight | FCC A/F/D سمت Captain وابسته به DC1/electronic/transfer1، FCC B/FO به DC2/electronic/transfer2؛ امکان disconnect، loss of mode/flag، نه reset کل MCP به حالت ساختگی |
| 23/34 Avionics & Radios | CDU/FMC، DME، ILS/VOR، IRS1/2، ADC، ATC، COM، GPWS و audio هر یک feed و standby خاص؛ از دست رفتن یک کانال سایر گیرنده‌های سالم را قطع نمی‌کند |
| 24 Electrical | Generator، TR، bus transfer، DC tie، load shed و battery state مجزا؛ آمپرمتر و ولتمتر تولید واقعی را حتی بدون GEN ON BUS می‌توانند نمایش دهند |
| 26 Fire Protection | Detectors، annunciators، control relay، extinguisher bottle مستقل؛ قطعی برق چراغ نشانه نبود آتش نیست، hot-battery/battery ممکن است همچنان حفاظت کند |
| 27 Flight Controls | Autoslat، electric/alternate trim، flap actuator، position indicator، speedbrake auto، asymmetric monitoring با feed مجزا؛ قطع position indicator حرکت مکانیکی/hydraulic را صفر نمی‌کند |
| 28 Fuel | Pump motor AC و pump-control DC مستقل. LOW PRESS بر اساس توان واقعی پمپ/تقاضا و مدار هشدار؛ fuel quantity فیزیکی با قطع برق تغییر ناگهانی ندارد؛ crossfeed valve و fuel SOV از battery/hot battery مستقل |
| 29 Hydraulics | EMDP A/B با GEN BUS مختل می‌شود؛ Engine-driven pump در صورت چرخش موتور فشار می‌سازد. DC1/DC2 برای EDP **depressurize solenoid** لازم است؛ با DC loss و موتور در حال کار، پمپ ممکن است برخلاف OFF سوئیچ فشاردهی کند |
| 30 Engine anti-ice | قطع تغذیه ولو ⇒ **spring-loaded closed**؛ سوئیچ فیزیکی سر جای خود می‌ماند. indication اگر بی‌برق باشد قابل اعتماد نیست |
| 30 Wing anti-ice | قطع تغذیه ⇒ **valve stays in last position** نه spring-closed؛ اگر باز مانده باشد جریان bleed می‌تواند ادامه یابد |
| 30 Window Heat | Heater-only power loss + live control ⇒ OVERHEAT amber؛ کنترلر بی‌برق ⇒ amber نمی‌تواند روشن شود |
| 30 Pitot / alpha / TAT | برق مستقل هر heater و annunciator؛ دیتای speed/AOA ممکن است به‌تدریج unreliable شود، نباید یک عدد ناگهانی غلط تزریق شود |
| 32 Brakes/Gear | Autobrake DC2، outboard anti-skid DC1، inboard anti-skid battery؛ loss of one channel لزوماً ترمز دستی/پایه را از بین نمی‌برد؛ gear position lights independent |
| 33 Lights | Landing / taxi / runway turnoff / nav / cabin / emergency از BUS و voltage مختلف؛ فقط همان branch باید تاریک شود، emergency/standby ممکن است باقی بماند |
| 36 Pneumatics | Engine1/2 bleed valves با DC سمت مربوط **stuck-last**؛ isolation valve با TRANSFER1 INOP؛ duct pressure حقیقی و pressure indicator AC مستقل |
| 74 Start/Ignition | Engine1/2 LEFT ignition وابسته به Transfer1/2، RIGHT ignition از AC Standby؛ starter valve از Battery Bus؛ یک ignition loss ≠ engine stopped |
| 77 Engine indications | Physical N1/N2/EGT/FF/oil physics مستقل از برق گیج؛ بسته به Conventional یا EIS و کلاس feed status INOP/flag/hold؛ هرگز تمام نیدل‌ها را صرفاً به‌علت قطع نمایشگر روی صفر نبر |
| Misc cabin / cooling | Equipment cooling normal/alternate، galley/recirc fan، service outlets و charger روی MAIN/GND SERVICE/GENهای متفاوت؛ فرمان، motor feed و fault lamp جدا |

## فهرست کامل و ردیابی منابع
- `engine/systems/mrg-classic-340-consumer-bus-index-v1.json`: **340 ردیف** با `item, feedBus, feedVoltage, printedPage, applicability`، مربوط به **322 دستگاه منطقی** در 24 کلاس BUS × VOLTAGE.
- `engine/systems/mrg-classic-bus-failure-effects-v1.json`: **35 رفتار خاموشی باس** با ارجاع به MRG ص 162–167، شامل 9 DC1، 8 DC2، 8 Transfer1 و 10 Transfer2. INOP یعنی instrument/feed invalid، لزوماً صفر نیست.
- `engine/systems/electrical-v7.js`: منبع واحد وضعیت AC/DC و standby.
- `engine/systems/unified-bus-failure-injection-v1.js`: injection instructor برای 24 کلاس باس.
- `engine/systems/window-heat-v1.js`: **FIX** هشدار قطع تغذیه هیتر.
- `panel-mosaic-lab/cockpit/window-heat-unified-v1.js`: خواندن وضعیت **evaluated** V7 با fail injection، نه raw pre-injection state.

**Open evidence:** هیچ‌یک از 340 source-rows هنوز به‌عنوان سیم‌کشی خاص EP-FSI با WDM اختصاصی تأیید نشده‌اند؛ لازم است هر circuit / backup / indicator / actuator بر اساس WDM نصب‌شده به backend خودش وصل و در Unified مشاهده/تست شود. وضعیتِ registry نباید با functional live completion اشتباه گرفته شود.

## تست‌های الزامی
- هر چهار heater CB: سبز خاموش + amber روشن در صورت سالم‌بودن کنترلر؛ قطع controller CB: هر دو dark؛ cold-dark: تمام چراغ‌های مرتبط dark؛ restore: power-interruption پاک، overheat واقعی همچنان قابل‌نمایش.
- GEN1 off، GEN2 on، BUS TRANS AUTO: TRANSFER1 backup، GEN BUS1 همچنان off؛ engine generator volts/hertz مستقل از ON BUS.
- DC loss: engine antiice fail-close ولی wing antiice fail-last؛ EDP depressurization failures as documented؛ instrument invalid نه plant zero.
- AIR/GROUND standby AUTO/BAT، CPCS/DCPCS variants، EIS/Conventional cases و CB return بدون بازنویسی detentها.
- Master caution/recall فقط اگر مدار اعلان واقعاً تغذیه و داده معتبر دارد.

**وضعیت:** مستند استخراج‌شده و منطق Window Heat اصلاح شده؛ سایر 340 مصرف‌کننده بدون تأیید WDM نباید با مدل رفتار خودسرانه live فرض شوند.

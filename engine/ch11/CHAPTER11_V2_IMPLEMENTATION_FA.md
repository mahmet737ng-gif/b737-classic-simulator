# Boeing 737 Classic — FCOM Chapter 11 → موتور یکپارچهٔ FMC/Navigation (Baseline v2)

**هواپیما:** EP-FSI، B737 Classic، موتور CFM56-3B-1 با ریتینگ 20K.  
**مرجع:** Sepehran Airlines 737CL FCOM Volume 2, *Flight Management, Navigation*, D6-27370-300/400/500-SHI، صفحات فیزیکی PDF **1414–1822** (۴۰۹ صفحه).  
**دامنه:** شبیه‌ساز مستقل B737؛ X-Plane/MSFS به‌هیچ‌وجه وابستگی موتور نیستند.  
**محدودیت:** کار مهندسی برای شبیه‌سازی آموزشی، نه هدایت ناوبری واقعی یا نرم‌افزار FMC تأییدشده.

## نتیجهٔ بازخوانی منبع و سطح تأیید

- همهٔ **۴۰۹ صفحه** از منبع خصوصی به‌شکل ماشین‌خوان خوانده و برحسب folio/section، SHA-256 متن و موضوع نمایه شدند. ۸ صفحه فهرست، ۴۰۱ صفحه محتوای فصل.
- پروندهٔ `source-page-ledger.v2.json` فقط نمایه و hash و tag و محل PDF را ذخیره می‌کند. متن، جدول یا تصویری از Boeing به GitHub عمومی منتقل نمی‌شود.
- **۳۰ صفحه** با الگوهای خودکار مرتبط با تفاوت نرم‌افزار، اثرگذاری گزینه‌ها یا هواپیماها علامت‌گذاری شده‌اند؛ این عدد برآورد ابزار است، نه فهرست جامع effectivity.
- نقشهٔ قبلی Chapter 11 با ۴۶ الزام منتخب و هستهٔ `engine/ch11/engine.js` **حفظ شده**. کاتالوگ v2 شامل **۳۴ قرارداد مرور و بازنویسی‌شده** است. تعداد قراردادها به‌معنی استخراج همهٔ جملات یا جدول‌های فصل نیست.
- **ممیزی انسانی تک‌تک نمودارها، جداول چندستونی، گزینه‌های نرم‌افزاری و تمام اسکرین‌های نمونهٔ CDU هنوز نهایی نیست.** هیچ بخش تأییدنشده‌ای `VERIFIED` اعلام نمی‌شود.

## بخش‌های واقعی فصل

| FCOM | صفحات PDF | قرارداد زیرسامانهٔ موتور | قید مهم |
|---|---:|---|---|
| 11.10 | 1422–1465 | CDU keys/LSK, پیام چراغ‌ها، انتخاب source، ISDU، VHF/ADF/XPDR/WXR | variant CDU با MENU یا DIR INTC متفاوت است |
| 11.20 | 1466–1485 | NAV source network: IRS/GPS/VOR/DME/ILS/ADF + radio/instrument transfer | Source health و effectivity مستقل |
| 11.30 | 1486–1489 | FMC/CDU data ownership, single/dual FMC | تعداد FMC نصب‌شده نیازمند سند هواپیما |
| 11.31 | 1490–1541 | Flight phases; LNAV/VNAV; position updating; data entry | هیچ LNAV/VNAV بدون Leg معتبر |
| 11.32 | 1542–1549 | Database, thrust/fuel, failure/power handling | AFM EP-FSI و input برق/fuel وصل شود |
| 11.33 | 1550–1552 | ACARS/data link | اختیاری تا اثبات پیکربندی |
| 11.40 | 1553–1624 | Preflight (IDENT/POS INIT/RTE/DEP-ARR/PERF/TAKEOFF) | MOD/ACTIVATE/EXEC اتمی، فیلدهای مشترک |
| 11.41 | 1625–1674 | Takeoff/climb, LEGS, PROGRESS, constraints | خط زمان هواپیما + position reference |
| 11.42 | 1675–1754 | Cruise, LEGS editing, discontinuity, offset | اتصال شکاف صرفاً با اقدام crew معتبر |
| 11.43 | 1755–1800 | Descent, Approach, ARRIVALS, HOLD, go-around | پروسیجرها باید source-coded باشند |
| 11.60 | 1801–1822 | Alerting / entry error / advisory messages | ترتیب اولویت، چراغ‌ها و suppression |

## معماری هدف (بدون دست‌کاری UI قفل‌شده)

```text
Approved photo CDU v6 + LSK/rotary geometry             EP-FSI aircraft switch registry
                |                                        |
                v                                        v
        CDU input/key interpreter                   Technical systems network
                |                                        |
        Scratchpad + page registry                      |
                |                                        |
                +---------- FMS Event Bus --------------+
                                    |
              +---------------------+--------------------+
              |                     |                    |
     Flight plan transactions   Aircraft phase FSM    FMC messages / annunciators
     Draft -> MOD -> ACT -> EXEC  PREFLIGHT..COMPLETE   Alert > Error > Advisory
              |                     |                    |
              +---------------------+--------------------+
                                    |
                       Source verified data ownership
                       |          |           |
                  NAVDB 2610    IRS/GPS    EP-FSI AFM perf/N1
                       |          |           |
               Geometry/legs    Position   Speed/Fuel/Thrust
                       \         |          /
                        Validated flight model
                              |
                    LNAV / VNAV / AFDS gates
                       (currently BLOCKED)
                              |
                  EHSI source presentation (readonly)
```

### قرارداد رویدادها (`fmc-runtime-v2.js`)

- `STAGE_ROUTE_FIELD`: ORIGIN/DEST/RUNWAY و دیگر فیلدهای RTE به DRAFT می‌روند؛ تمام صفحات RTE/DEP-ARR/DEPARTURES/ARRIVALS یک Context واحد می‌خوانند.
- `ACTIVATE_ROUTE`: تنها پس از مبدأ و مقصد معتبر، DRAFT را به PENDING تبدیل کرده و EXEC روشن می‌شود.
- `EXECUTE`: PENDING را اتمی به ACTIVE منتقل می‌کند؛ **هیچ اختیار LNAV/VNAV/AFDS ایجاد نمی‌کند**.
- `ERASE_MOD`: بدون پاک‌کردن ACTIVE، تغییرات اجرا‌نشده را دور می‌اندازد.
- `RAISE_MESSAGE` / `KEY_CLR` / `CLEAR_MESSAGE_CONDITION`: پیام‌ها با اولویت Alert > Entry error > Advisory و رفتار scratchpad مدیریت می‌شوند؛ پیام مرتبط با condition یا نرم‌افزار نصب‌شده باید منبع داشته باشد.
- `AIRCRAFT_PHASE_EVENT`: فقط رویداد تأییدشده از State Bus داخلی، با ترتیب فاز معتبر، باعث انتقال فاز می‌شود. **این یک FSM آزمایشی است** و تمام triggerهای تجهیزات هنوز ثابت نشده‌اند.
- `LOAD_PRIVATE_NAVDB`: فقط provenance خصوصی AIRAC 2610 با هدر دقیق پذیرفته می‌شود.
- `SET_DISCONTINUITIES`: شکاف حفظ می‌شود؛ درخواست هدایت روی شکاف مجوز وصل کردن نقاط را نمی‌دهد.
- `REQUEST_GUIDANCE`: تا اعتبارسنجی Path Terminator، FMC و AFDS، بدون servo output رد می‌شود.

## قواعد عملیاتی مستقیم از نمونه‌های فصل

1. **11.10.6 (PDF 1427):** کلید EXEC فقط برای اصلاحات منتظر اجرا معنا دارد؛ چراغ EXEC با commit خاموش می‌شود.
2. **11.10.7 (PDF 1428):** حروف/اعداد ابتدا در scratchpad قرار می‌گیرند؛ DEL توکن DELETE می‌سازد و CLR کوتاه/بلند رفتار مجزا دارد.
3. **11.31.1–2 (PDF 1490–1491):** ترتیب فازها و required preflight داده‌های مستقلی‌اند؛ مسیر با ACTIVATE سپس EXEC فعال می‌شود.
4. **11.40 و 11.42 (PDF 1584 و 1685–1686):** انتخاب Departure/Arrival به RTE مشترک وابسته است؛ رفع Route Discontinuity نتیجهٔ اقدام صریح crew است، نه اتصال خودکار هندسه.
5. **11.60.1–2 (PDF 1801–1802):** پیام‌های alert اولویت بالاتر دارند؛ Scratchpad، MSG و FMC ALERT باید به وضعیت پیام متصل باشند، نه متن نمایشی ثابت.
6. **Effectivity:** Chapter 11 شامل انتخاب‌های وابسته به نسخه نرم‌افزار (مانند U10.x) و بعضی تجهیزات نصب‌شده است؛ فعال‌سازی بی‌سند ممنوع.

## نتیجهٔ تست و نحوهٔ اتصال

`fmc-runtime-v2.test.cjs`: **۳۲ سناریو موفق** شامل انتقال فیلدهای RTE قبل/بعد EXEC، پیام‌ها، navigation-source rejection، گپ، phase guard، و فقدان اختیارات autopilot.  
این هسته به‌صورت **کنارِ هستهٔ قبلی** ثبت شده و هنوز به کنترل فیزیکی کابین authority نمی‌دهد. برای انتقال تدریجی، می‌توان خوانندهٔ context اصلی `cdu-standalone-v6/engine/cdu-engine.js` را با view layer نسخه v2 هماهنگ و تست تصویری انجام داد؛ بدون جابه‌جایی تصویر، سوئیچ یا hitbox.

## باقی‌مانده تا اعلام «کل Chapter 11 کامل»

- ممیزی line-by-line و figure-by-figure همهٔ صفحات و اختلافات پیکربندی؛ تأیید مستقل ۱۴۲ جدول کاندیدا (از نمایه قبلی).
- تعریف تمام فیلدها و LSKها برای هر variant اسکرین CDU، انتخاب/حذف روی LEGS، امکان ویرایش و حل Discontinuity تحت provenance.
- موقعیت IRS/GPS و رادیوناوبری، AFDS/FD، MCP، electrical power و failure logic با گراف سیستم‌های فنی.
- اتصال Performance/Thrust/Fuel دقیق EP-FSI به محاسبات FMC.
- کدهای حقیقی Path Terminator پروسیجرهای SID/STAR/Approach (روایت متنی PMDG به‌تنهایی کافی نیست).
- تست یکپارچهٔ تجهیزات و CDU روی مرورگر و مدل پرواز داخلی و تکمیل QAِ FCOM effectivity.

**توجه:** فهرست کامل صفحات، «اسکن متن» است؛ نباید آن را با «تأیید معنایی همهٔ ۴۰۹ صفحه» اشتباه گرفت.
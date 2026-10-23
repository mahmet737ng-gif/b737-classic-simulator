# B737-CLASSIC-CDU — DEPARTURES / PERF INIT / PERF LIMITS

## محدوده و وضعیت استخراج

این یادداشت فقط بر اساس **۹ تصویر ارسالی کاربر** و قسمت‌های قابل مشاهده از Boeing 737 Flight Crew Operations Manual، فصل **11.40 FMC Preflight**، شناسهٔ `D6-27370-300/400/500-SHI` تهیه شده است. تصاویر PDF viewer مربوط به صفحات **1586، 1587، 1589 تا 1595** هستند و فهرست دقیق فایل‌ها، نسخهٔ تاریخی منبع و SHA-256 هر تصویر در دو رجیستری JSON ثبت شده است.

**صفحات چاپی:** 11.40.34–35 برای DEPARTURES و 11.40.37–43 برای PERF INIT/PERF LIMITS. **11.40.36 در میان تصاویر ارسالی نیست.** تصاویر FCOM از بازنگری‌های متفاوت **2020، 2022 و 2023** هستند؛ این تفاوت‌ها باید در نمایشگر حفظ شوند، نه ترکیب.

ثبت‌شده: **۳۳ قانون DEPARTURES** و **۷۰ قانون PERF INIT/PERF LIMITS**، مجموع **۱۰۳ قانون مستند**. همه در وضعیت **SOURCE_ONLY_NOT_WIRED**؛ این مرحله رابط زنده یا رفتار اجرایی CDU را تغییر نمی‌دهد.

## A — DEPARTURES (FCOM 11.40.34–35)

صفحهٔ `{ORIGIN ICAO} DEPARTURES 1/n` برای انتخاب باند خروج، SID و Transition فرودگاه مبدأ طراحی شده است. دسترسی از `DEP/ARR INDEX → DEP` مبدأ و از پرامپت `DEPARTURE>` در `TAKEOFF REF` در تصویر نشان داده شده است؛ حالت `NO ROUTE ENTERED` نیز در نمودار موجود است و معنای آن نباید با حدسی دربارهٔ محدودیت‌های دیگر جایگزین شود.

| ناحیه | محتوای مستند | رفتار |
|---|---|---|
| ستون چپ | SIDS | SIDهایی که با فرودگاه و باند فعلی سازگارند |
| ستون چپ | TRANSITIONS | فقط Transitionهای سازگار با SID انتخابی |
| ستون راست | RUNWAYS | باندهای قابل انتخاب فرودگاه |
| پایین چپ | `<ERASE` یا `<INDEX` | ERASE وقتی MOD فعال است؛ در غیر این صورت بازگشت به DEP/ARR INDEX |
| پایین راست | `ROUTE>` | بازگشت به RTE |

بدون انتخاب Runway در RTE، فهرست اولیهٔ باندها و SIDهای فرودگاه دیده می‌شود. هر انتخاب، گزینه‌های ناسازگار را از لیست حذف می‌کند. SID Transition فقط بعد از مشخص‌شدن SID مرتبط نمایش داده می‌شود.

در شکل FCOM، `KBFI`، باند `13R` و `LACRE3` **صرفاً نمونهٔ مستند** هستند؛ نه فرودگاه، باند یا SID پیش‌فرض شبیه‌ساز.

### نشانگرهای وضعیت و اثر بر مسیر

- انتخاب یک گزینه، `<SEL>` را کنار آن نشان می‌دهد و یک **Route Modification** ایجاد می‌کند.
- تا وقتی **EXEC** انجام نشده، این تغییر نباید Active Route را عوض کند.
- پس از EXEC، `<SEL>` به `<ACT>` تبدیل می‌شود.
- با خروج و بازگشت مجدد به صفحه، `<SEL>` یا `<ACT>` متناسب با وضعیت حفظ می‌شود.
- `ERASE` تغییرات اجرا‌نشده را حذف می‌کند و نسخهٔ قبلی مسیر را بازیابی می‌کند؛ `INDEX` صفحهٔ `DEP/ARR INDEX` را باز می‌کند.
- FCOM شاخهٔ **Engine-Out SID** را نیز توصیف کرده است: این SIDها بعد از SID عادی یا در صورت نبود گزینهٔ عادی، از سطر اول نمایش داده می‌شوند. این شاخه باید به نسخهٔ پیکربندی هواپیما وابسته باشد.

## B — PERF INIT (FCOM 11.40.37–42)

صفحهٔ `PERF INIT 1/2` اطلاعات لازم برای محاسبات FMC/VNAV را می‌گیرد. راه ورود طبق نمودار از `INIT/REF INDEX → PERF` یا پرامپت‌های `PERF INIT` در RTE/TAKEOFF REF (در حالت ناقص روی زمین) است. کلید NEXT PAGE به `PERF LIMITS 2/2` می‌رسد.

### سه چیدمانِ مستند و متمایز

| کلید | FUEL + N1 LIMIT | PLAN/FUEL + ACARS | FUEL + TAKEOFF |
|---|---|---|---|
| L1 | GW/CRZ CG | GW/CRZ CG | GW/CRZ CG |
| L2 | FUEL | PLAN/FUEL | FUEL |
| L3 | ZFW | ZFW | ZFW |
| L4 | RESERVES | RESERVES | RESERVES |
| L5 | COST INDEX | COST INDEX | COST INDEX |
| L6 | INDEX | INDEX | INDEX |
| R1 | TRIP/CRZ ALT | TRIP/CRZ ALT | TRIP/CRZ ALT |
| R2 | CRZ WIND | CRZ WIND | CRZ WIND |
| R3 | ISA DEV | T/C OAT | ISA DEV |
| R4 | T/C OAT | TRANS ALT | T/C OAT |
| R5 | TRANS ALT | PERF INIT REQUEST | TRANS ALT |
| R6 | N1 LIMIT | N1 LIMIT | TAKEOFF |

- نمونهٔ ستون اول: تصویر **1589** (FCOM 11.40.37).
- نمونهٔ ستون دوم: تصویر **1590** (FCOM 11.40.38؛ نسخهٔ PLAN/FUEL/ACARS).
- نمونهٔ ستون سوم: تصویر **1591** (FCOM 11.40.39؛ نسخهٔ TAKEOFF).

**نکتهٔ پیاده‌سازی:** این ستون‌ها **پیکربندی‌های متفاوت** هستند. درست نیست که `PLAN/FUEL` و `ISA DEV` و `PERF INIT REQUEST` در یک صفحهٔ تلفیقی ساخته شوند، یا به همهٔ نسخه‌ها دستور یکسان R6 داده شود. پیکربندی نصب‌شده روی EP-FSI باید با مدرک اختصاصی تعیین شود.

### معنی داده‌ها و قواعد ورودی

**L1: GW/CRZ CG.** Gross Weight برای PERF لازم است. قالب عددی وزن `xxx` یا `xxx.x` است. اگر ZFW وارد و Fuel معتبر باشد، FMC می‌تواند GW را محاسبه کند. Cruise CG مقدار پیش‌فرض/دستی را نشان می‌دهد؛ ورود CG واقعی می‌تواند محاسبهٔ سقف ارتفاع مجاز را تغییر دهد.

**L2: FUEL یا PLAN/FUEL.** سوخت فعلی به‌طور معمول از Fuel Summation Unit دریافت می‌شود. اگر داده معتبر نرسد، محل نمایش خالی است؛ در گونهٔ مستند، هنگام پرواز اجازهٔ ورود دستی Fuel داده می‌شود و `MAN` نمایش می‌یابد و خدمه باید وزن سوخت را در ادامهٔ پرواز به‌روز نگه دارند. `PLAN` امکان پیش‌بینی بر اساس سوخت برنامه‌ای قبل از معلوم‌شدن سوخت واقعی را فراهم می‌کند، اما مطابق متن FCOM در وضعیت‌های Flaps Extended، هر دو Pack روشن، یا In Flight جای ورودی PLAN خالی است. این حالت باید از نمایش `FUEL` عادی جدا شود.

**L3: ZFW.** Zero Fuel Weight برای preflight لازم است؛ قالب `xxx` یا `xxx.x` دارد. اگر GW و Fuel معتبر قبلاً موجود باشند، می‌تواند محاسبه شود.

**L4: RESERVES.** ورود سوخت ذخیره برای تکمیل preflight لازم است؛ قالب `xx` یا `xx.x`.

**L5: COST INDEX.** مقدار **۰ تا ۲۰۰**؛ ورود CI برای حالت ECON/VNAV لازم است. `0` به MAX RANGE و `200` به کمینه‌کردن زمان پرواز متناظر است. CO ROUTE ممکن است CI ذخیره‌شده وارد کند، ولی مقدار واردشدهٔ دستی اولویت دارد.

**R1: TRIP/CRZ ALT.** Trip Alt یک پیش‌بینی مشورتی براساس Origin، Destination، Gross Weight و Cost Index است؛ Cruising Altitude باید وارد شود و سپس در `CLB`، `CRZ` و `RTE LEGS` نمایش یابد.

**R2: CRZ WIND.** پیش‌بینی باد کروز به محاسبات FMC و `RTE DATA` منتقل می‌شود. نبود مقدار: پیش‌فرض باد صفر برای پیش‌بینی preflight.

**ISA DEV / T/C OAT.** در نسخه‌هایی که `ISA DEV` وجود دارد، مقدار ثبت‌شده برای محاسبهٔ T/C OAT استفاده می‌شود؛ نبود مقدار به انحراف صفر تعبیر می‌شود. در فیلد `T/C OAT`، نبود ورودی به دمای ISA منجر می‌شود و ورود OAT، ISA Deviation را به‌دست می‌دهد.

**TRANS ALT.** مقدار شروع FMC در این مرجع **۱۸٬۰۰۰ ft** است. انتخاب Departure با Transition Altitude متفاوت، آن را تغییر می‌دهد؛ ورود دستی اولویت دارد. **۱۸٬۰۰۰ ft صرفاً مقدار پیش‌فرض مستند است، نه ارتفاع ترنزیشن ثابت برای همهٔ فرودگاه‌ها.**

**PERF INIT REQUEST.** در یکی از نسخه‌ها ACARS Uplink Request است؛ این قابلیت در CDU مستقل تا زمانی که Backend واقعی یا شبیه‌سازی مشخص نشده باشد نباید ارسال یا دریافت موفق ساختگی نشان دهد.

**R6: N1 LIMIT یا TAKEOFF.** باید دقیقاً مطابق Variant انتخاب شود؛ جابه‌جایی خودسرانهٔ پرامپت ممنوع است.

## C — PERF LIMITS (FCOM 11.40.43)

`PERF LIMITS 2/2` محدوده‌های حداقل و حداکثر سرعت ECON و محاسبات RTA را تعریف می‌کند. مقادیر به تفکیک **CLB / CRZ / DES** و در قالب **IAS/Mach** ثبت می‌شوند. پرامپت `<INDEX` به `INIT/REF INDEX` و پرامپت `RTA>` به صفحهٔ RTA مرتبط می‌رود. برچسب `TIME ERROR TOLERANCE` هم در نمودار FCOM موجود است.

اعداد سرعت نشان‌داده‌شده در شکل، مثلاً `210/.400` و `340/.820`، تنها مثال صفحه‌اند و نباید بدون تطبیق با دیتابیس Performance و پیکربندی واقعی EP-FSI به محدودیت‌های نهایی سیستم تبدیل شوند.

## D — قرارداد اتصال و محافظت از طراحی

**ورودی‌های موردنیاز:** وزن و سوخت از Aircraft Data Bus، اطلاعات ORIGIN/DEST/Runway/SID از Navigation Database، اطلاعات CO ROUTE، وضعیت Route MOD/ACT، وضعیت PERF INIT، و نوع نصب‌شدهٔ FMC.

**خروجی‌های موردنیاز:** صفحهٔ DEPARTURES سازگار با SID/Runway/Transition، ایجاد MOD و نور EXEC، نشانگرهای `<SEL>` و `<ACT>`، شرط کامل بودن PERF INIT، محدودیت‌های اقتصادی و RTA، و مقادیر ورودی Performance Engine.

**محدودیت این مرحله:** فقط ثبت منبع و Test Contract؛ هیچ یک از ظاهر تصویری/CDU Hitboxها، موتور اجرا، یا فایل‌های **BoeingCDU-Large.ttf** و **BoeingCDU-Small.ttf** تغییر نکرده است.

- [Machine-readable DEPARTURES contract](../engine/ch11/fmc-preflight-departures-2020-2022.rules.v1.json)
- [Machine-readable PERF INIT / PERF LIMITS contract](../engine/ch11/fmc-preflight-perfinit-limits-2020-2023.rules.v1.json)

# ممیزی صفحه DEP/ARR INDEX – B737 Classic
تاریخ: 2026-10-30

## نتیجه
نسخهٔ قدیمی صفحه در `cdu-standalone-v6/data/page-definitions.{json,js}` مطابق FCOM نبود. قبلاً عبارت‌های `<DEPARTURES` / `ARRIVALS>`، برچسب‌های `ORIGIN` / `DEST` و منوی پایین `<RTE` / `INDEX>` با یک اسکلت آموزشی ساخته شده بود. این اسکلت به‌اشتباه در Unified به‌عنوان صفحهٔ `DEP/ARR INDEX` استفاده شد.

## مستند اصلی و صفحهٔ دقیق
منبع: SEPEHRAN AIRLINES Boeing 737-300/400/500 Flight Crew Operations Manual, Vol. 2, Flight Management / Navigation – FMC Preflight, PDF physical page 1584, printed folio **11.40.32**, heading **Departure/Arrival Index Page**، با توضیح عملکرد دکمه‌ها در PDF physical page 1585, folio **11.40.33**. متن و نمای توصیفی این فولیوی FCOM نسبت به تصویر مرجع ارائه‌شده به پروژه تطبیق داده شد.

این صفحه **شاخص انتخاب فرودگاه** است، نه صفحهٔ ورود ORIGIN/DEST روی RTE:
- سطر انتخاب اول: `<DEP` چپ، `ORIGIN` وسط (مثلاً OIII)، `ARR>` راست.
- سطر انتخاب دوم: `DEST` وسط (مثلاً OIMM)، `ARR>` راست؛ سمت چپ هیچ DEP مقصد ندارد.
- بخش پایین: `DEP` چپ، `OTHER` وسط، `ARR` راست؛ زیر آن `<----` و `---->` برای مشاهدهٔ مرجع فرودگاه دیگر.
- فرودگاه‌های متن نمونهٔ FCOM، KBFI و KMWH هستند؛ OIII و OIMM دادهٔ مسیر سناریوی کاربر هستند، نه مقادیر ثابت صفحه.
- 1/1 در صفحهٔ عنوان حفظ شده است.

## LSKها مطابق FCOM
| LSK | رفتار |
| --- | --- |
| L1 | Departure برای ORIGIN |
| R1 | Arrival برای ORIGIN (turnback) |
| R2 | Arrival برای DEST |
| L6 | Departure برای فرودگاه OTHER که در scratchpad وارد شده، فقط مشاهده |
| R6 | Arrival برای فرودگاه OTHER که در scratchpad وارد شده، فقط مشاهده |
| L2, L3, R3, L4, R4, L5, R5 | برای انتخاب فرودگاه روی INDEX غیرفعال |

در نسخهٔ جدید CORE، `depArrSelection` منبع فرودگاه و `referenceOnly` را از هم جدا می‌کند. OTHER نیازمند ICAO چهارحرفی است و ویرایش مسیر/انتخاب روی صفحه‌های DEPARTURES/ARRIVALS را مسدود می‌کند. منبع ICAO مبدأ و مقصد از State جاری RTE گرفته می‌شود، نه از متن ثابت یا دیتابیس ساختگی.

## فایل‌های تغییرکرده
- `cdu-standalone-v6/data/page-definitions.json` و `page-definitions.js`: اصلاح ۶ ردیف INDEX، عنوان، مرکز سه‌ستونی و provenance.
- `cdu-standalone-v6/app.js`: رندر مستقل INDEX با سه ستون و مقادیر ORIGIN/DEST جاری، بدون تغییر تصویر اصلی/مختصات LSKها.
- `cdu-standalone-v6/engine/cdu-engine.js`: منطق L1/R1/R2/L6/R6 و محافظت read-only برای OTHER.
- `cdu-standalone-v6/tests/dep-arr-fcom-114032.test.cjs`: هشت تست regression بر اساس FCOM.
- `cdu-standalone-v6/stage5-adapter.js` و `stage6-selector.js`: جلوگیری از جایگزینی صفحهٔ اصلی INDEX توسط Overlayهای آزمایشی AIRAC.
- `.github/workflows/ch11-fmc-systems-network-v1.yml`: افزودن تست‌ها به CI.

## محدوده و موارد باقی‌مانده
- شکل INDEX و انتخاب منبع فرودگاه اکنون با دو صفحهٔ FCOM فوق تطبیق داده شده است؛ **تمام جزئیات صفحه‌های DEPARTURES و ARRIVALS هنوز با AIRAC و FCOM به‌صورت صفحه‌به‌صفحه ممیزی نشده‌اند**.
- روی CDI/CDU تنها لایهٔ متن زنده و منطق صفحهٔ INDEX تغییر کرده است. Bitmap، کلیدها، نقشهٔ ۷۰ نقطه‌ای و فونت‌های تأییدشده هیچ تغییری نکرده‌اند.
- ۸ تست منطق INDEX در محیط ایزولهٔ JavaScript پاس شده‌اند؛ نتایج CI و نمایش نسخهٔ منتشرشده در مرورگر باید جداگانه تأیید شود.

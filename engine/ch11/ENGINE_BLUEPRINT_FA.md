# B737 Classic — Chapter 11 Systems/FMC Engine (Engineering Baseline v1)

## دامنهٔ پروژه
مرجع: FCOM سپهران، Volume 2، Chapter 11 **Flight Management, Navigation**؛ سند `D6-27370-300/400/500-SHI`، صفحات فیزیکی PDF از **۱۴۱۴ تا ۱۸۲۲** (۴۰۹ صفحه، شامل ۸ صفحه فهرست فصل). این منبع فراتر از FMC/CDU است: ناوبری رادیویی، GPS، IRS، Weather Radar، transponder، Flight Management، LNAV/VNAV، ACARS و پیام‌ها را پوشش می‌دهد.

## وضعیت تأیید — تفکیک ضروری

- **COMPLETE SOURCE INDEX:** تمام ۴۰۹ صفحه، ۲۹٬۵۴۶ خط با مختصات در صفحه و ۲۹٬۶۴۳ بخش متن نمایه شده‌اند. ۴۰۹/۴۰۹ فایل PNG و SVG در آرشیو خصوصی Technical Database موجودند. ۱۴۲ جدولِ کاندیدای تشخیص ماشینی موجود است، ولی درستی ساختار همهٔ جدول‌ها تأیید نشده است.
- **RULE CATALOG V1:** تعداد ۴۶ الزام منتخب با مرجع دقیق شمارهٔ چاپی FCOM و PDF تعیین شد؛ ۳۶ مورد دارای رفتار اولیهٔ قابل اجرا یا تست و ۱۰ مورد هنوز فقط طراحی‌اند. این تعداد **به معنی بررسی معنایی و تأیید تمام خطوط فصل نیست**.
- **ENGINE CORE:** انجین حالت مستقل/تمرینی CDU دارای ۱۷ شناسهٔ صفحهٔ پایه، موتور ورود/اعتبارسنجی، پیام، transaction و annunciator ساخته و تست شده است. صفحه‌های غیرنهایی با عنوان `TRAINER PAGE / NO ENGINE DATA` نشان داده می‌شوند تا اطلاعات جعلی نسازیم.
- **NOT DONE:** ممیزی انسانی تک‌تک خطوط و ستون‌های FCOM، تمام اسکچ‌های LSK/field، تمام variant/effectivity notes، همهٔ صفحات واقعی FMS، پایگاه ناوبری چرخه‌ای، محاسبات thrust/performance، گراف ناوبری، lateral/vertical predictions، IRS alignment واقعی و شبیه‌سازی رادار.

## مرزبندی ۱۱ بخش فصل ۱۱

| بخش FCOM | PDF صفحات | مسئولیت فنی | وضعیت اجرای v1 |
|---|---:|---|---|
| 11.10 | 1422–1465 | کنترل‌ها/indicatorها، ISDU، transponder، weather radar | CDU keys + چراغ‌ها؛ باقی قرارداد باز |
| 11.20 | 1466–1485 | سنسورهای ناوبری/IRS/GPS/VOR/DME/ILS/ADF | interface planned؛ ناوبری واقعی پیاده نشده |
| 11.30 | 1486–1489 | معماری FMC/CDU، گزینه single/dual | model ثبت‌شده؛ ارتباط دو FMC هنوز باقی |
| 11.31 | 1490–1541 | operation، page navigation، LNAV/VNAV، data entry | input validators؛ مسیر/پیش‌بینی باز |
| 11.32 | 1542–1549 | FMC databasing، fuel، thrust، loss/failure | interface planned؛ محاسبه واقعی باز |
| 11.33 | 1550–1552 | ACARS | متصل نشده؛ اختیاری و configuration-gated |
| 11.40 | 1553–1624 | preflight pages/fields | نمونهٔ RTE/POS/IDENT/PERF/TAKEOFF با دادهٔ آموزشی |
| 11.41 | 1625–1674 | takeoff and climb، progress/legs | نمونهٔ LEGS/CLB/PROG؛ مدل حرکت واقعی باز |
| 11.42 | 1675–1754 | cruise، route editing، offset، nav data | pending/EXEC + offset validator؛ LNAV geometry باز |
| 11.43 | 1755–1800 | descent، approach، arrivals، holding | placeholder و برخی فرم‌ها؛ حساب واقعی باز |
| 11.60 | 1801–1822 | FMC/CDU alerting/entry-error/advisory messages | اولویت‌بندی پایه و MSG؛ catalog کامل خطا باز |

همچنین ۸ صفحهٔ فهرست فصل PDF 1414–1421 ثبت شده‌اند.

## مرجع هر interaction و تصمیم

هر rule باید در DB دارای این فیلدها باشد:

- `rule_id`: شناسهٔ ثابت و معنادار.
- `fcom.printed_folio`, `fcom.pdf_page`: ارجاع مستقیم و بدون حدس.
- `condition`: پیش‌شرط رویداد.
- `event`: فشردن کلید، تغییر وضعیت سیستم، اطلاعات سنسور.
- `effect`: تغییر `state`, `route`, `display`, `annunciators`, `messages`.
- `aircraft_variant`, `installed_option`: فیلتر برحسب واریانت/تجهیزات.
- `qa`: دو تأیید مجزا — اصالت دستور از FCOM، نتیجهٔ تست اجرایی.

در صورت وجود `U10.x`/`on some airplanes` یا جدول نسخه‌ها، باید condition جداگانه ساخته شود؛ اضافه‌کردن امکانات NG از MRG به Classic ممنوع است، مگر FCOM/تجهیزات هواپیما تأیید کند.

## اجزای پیشنهادی هسته (interface contracts)

```text
CDU physically clickable input (70 controls, unchanged approved photo)
             |
             v
CDU Input Interpreter -> Scratchpad Editor -> Field Validator
      |                                   |
      v                                   v
Page/LSK Router ------------------> Pending Transaction Store -> EXEC commit
      |                                   |                         |
      v                                   v                         v
Source-bound Page Descriptor <-- Navigation/FMC Shared Data <---- Active model
      |
      v
FMC Message Arbiter [Alert > Entry Error > Advisory]
      |
      +--- CDU MSG / FAIL / CALL / OFST / EXEC (true state, backlit text)
      |
      v
24-column x 14-row CDU framebuffer (full opaque redraw)

Hidden sources to build as distinct modules:
  navigationSources: IRS/GPS/VOR/DME/ILS/ADF
  flightPlan: legs, route segments, discontinuities, holds, offsets
  predictions: speeds, altitudes, ETA/fuel, VNAV/LNAV, RNP/ANP
  performance: ZFW/GW/CI/N1/thrust/takeoff V-speeds
  peripherals: ACARS, transponder, weather radar
  failureManager: FMC / CDU / nav-data / sensors / source transfer
```

### Standalone Mode

همیشه می‌توان بدون aircraft power CDUs را روشن/استفاده کرد؛ `powerProvider=VIRTUAL_STANDALONE` است و با `REAL_AIRCRAFT` دو mode متفاوت خواهد بود. هنگام تست standalone، GPS/IRS sensor outputs باید «mock / not available» باشند؛ نباید دادهٔ زندهٔ دروغین ارائه شود.

### منطق پیام‌های فصل 11.60

- `alert` اولویت اول: چراغ `MSG` روی CDUهای مرتبط و `FMC_ALERT` در پنل جلو در صورت قابلیت/هواپیما؛ متن مهم‌ترین پیام نمایش داده می‌شود.
- `entry_error` اولویت دوم و CDU-local: هنگام حذف خطا توسط CLR، scratchpad قبلی برمی‌گردد.
- `advisory` سوم: پیام در صورت نبود متن ورودی دیده می‌شود؛ درج متن می‌تواند پیام را موقتاً مخفی کند.
- چراغ `EXEC` به transaction منتظر تأیید وابسته است؛ فشردن EXEC فقط زمانی که transaction معتبر موجود است عمل commit انجام می‌دهد.
- `OFST` فقط در زمان هدایت LNAV برای lateral offset روشن می‌شود؛ درخواست offset بدون فعال‌شدن هدایت، OFST را روشن نمی‌کند.

**مرجع:** FCOM 11.10.4، 11.10.6، 11.60.1، 11.60.2، 11.60.15 و 11.60.17. پیاده‌سازی v1 یک تقریب تمرینی است؛ موارد «could return» یا ارتباط دو FMC به بازبینی نسخه نرم‌افزاری نیاز دارند.

## روش ممیزی صفحه‌به‌صفحه و ستون‌به‌ستونِ باقی‌مانده

1. هر صفحهٔ FCOM با `pdf_page` و `folio` در `ch11-page-metadata.json` ثبت شده؛ آرشیو خصوصی دارای متن کامل و `bbox_pt` خط، span و zone چپ/وسط/راست است. همین داده برای بررسی ترتیب ستون‌های جداول/اسکرین استفاده می‌شود.
2. متن صفحه در مقابل تصویر SVG/PNG اصلی تطبیق داده شود؛ اگر جدول ساختار نامطمئن دارد، جدول از تصویر به‌صورت بصری تأیید شود، نه فرض صحت استخراج CSV.
3. برای هر **فیلد** و هر **LSK** در تصویر نمونهٔ CDU از FCOM، یک schema جداگانه با title، data، required/optional، format، value source، select action، error and effects ایجاد شود.
4. شرط‌های phase، version option، software update و circuit inputs از هر متن استخراج و تست مستقل ساخته شوند.
5. قبل از علامت‌گذاری `VERIFIED` دو ارزیابی مستقل لازم است: تطابق معنایی با صفحه FCOM و تست state transition/viewport snapshot.
6. اسناد تمام‌متنی و تصاویر مربوط به Boeing باید فقط در Technical Database خصوصی نگه‌داری شوند؛ GitHub عمومی فقط schema/rule identifiers/engine code/status را بگیرد.

## نقشهٔ قبول نهایی

برای هر ۴۰۹ صفحه: `source_indexed=true`, `manual_source_review=true`, `all_fields_modeled=true` (یا صریحاً N/A), `all_conditional_logic_tested=true`, `variant_notes_accounted=true`, `layout/image_compared=true`. اکنون فقط `source_indexed=true` است و بقیه «باز» می‌ماند.

در هیچ مرحله‌ای فقط به دلیل وجود page index یا passing smoke tests نباید ادعا کنیم انجین واقعی تمام فصل اجرا شده است.
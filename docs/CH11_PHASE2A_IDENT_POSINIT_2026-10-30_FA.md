# فاز 2A بازسازی CDU: تثبیت IDENT و POS INIT
تاریخ: 2026-10-30 | 737 Classic -300/-400/-500 | Procedure/QRH training only

## منابع بررسی‌شده
**SEPEHRAN AIRLINES B737 Classic FCOM Vol.2**:
- `11.40.8` / physical PDF 1560: IDENT diagram؛ MODEL 1L، ENG RATING 1R، NAV DATA 2L، ACTIVE 2R، OP PROGRAM 4L، SUPP DATA 5R.
- `11.40.9` / PDF 1561: inactive database 3R، navigation date change on ground only، software part number و INIT/REF links.
- `11.40.11` / PDF 1563: POS INIT 1/3، **combined LAST POS at 1R**، REF AIRPORT 2L، GATE 3L، SET IRS POS 4R، GMT 5L، SET IRS HDG 5R.
- `11.40.12` / PDF 1564: REF AIRPORT پاک‌کنندهٔ GATE قبلی؛ تاریخ/زمان از ساعت خلبان؛ LAST POS آخرین موقعیت محاسبه‌شدهٔ FMC است، نه IRS ساختگی.
- `11.40.13` / PDF 1565: SET IRS POS و هشدارها، نمایش باکس فقط هنگام alignment بی‌موقعیت، SET IRS HDG فقط در ATT.
**Text source audit, not photographic/pixel certification**: image extraction of original FCOM pages is still pending.

## تغییرات ثبت‌شده روی main
1. `engine/ch11/cdu-preflight-evidence-v1.js`: Source-gated read-only projector.
   - `IDENT`: MODEL، ENG RATING، NAV DATA، ACTIVE/INACTIVE، OP PROGRAM، SUPP DATA فقط با منبع معتبر و مشخص نمایش داده می‌شوند. هیچ نمونهٔ `TRAINER`، `DEMO ONLY`، `SIM` به‌عنوان دادهٔ FMC استفاده نمی‌شود.
   - `POS INIT`: `LAST POS` فقط با دادهٔ `FMC_COMPUTED` معتبر و به صورت `NDD°MM.m EDDD°MM.m` نمایش داده می‌شود.
   - UTC تنها با ساعت CAPTAIN/FO واجد اعتبار؛ ساعت سیستم مرورگر خودکار به ساعت هواپیما تبدیل نمی‌شود.
   - `SET IRS POS` و `SET IRS HDG` با وضعیت واقعی IRS در Interface آموزشی گیت می‌شوند.
2. `cdu-standalone-v6/data/page-definitions.json` و `.js`: محل فیلدها به متن اصلی FCOM بازگردانده شد، مقادیر نمایشی کاذب حذف شدند.
3. `cdu-standalone-v6/app.js`: رندر Source-backed IDENT، سطر full-width در LAST POS و رفتار دینامیک IRS POS / IRS HDG؛ بدون تغییر عکس یا موقعیت فیزیکی کلیدها.
4. `cdu-standalone-v6/engine/cdu-engine.js`: REF AIRPORT و GATE اکنون به عنوان ورودی مستقیم آموزشی کار می‌کنند؛ در تغییر REF AIRPORT، GATE پاک می‌شود؛ بدون فرودگاه وارد نمی‌شود؛ R4 وقتی IRS واقعی متصل نیست، موفقیت تقلبی اعلام نمی‌کند؛ R5 وقتی ATT هست ولی نوشتن در IRS متصل نیست، پیام `IRS HDG NOT LINKED` می‌دهد.
5. `panel-mosaic-lab/cockpit/cdu-irs-adapter-v1.js`: دریافت read-only mode / power / enteredPosition از IRS core و تأثیر بر وضعیت Promptهای POS INIT. **هیچ فایل قفل‌شدهٔ IRS UI تغییر نکرده است.**
6. هر دو CDU کپتن/فرست‌آفیسر: از طریق `cdu-stage.html` و `assembly.json` به نسخهٔ تازهٔ منابع و رندر متصل شده و cache version جدید دارند.
7. `engine/ch11/master-screen-registry-v1.json`: Register 37 صفحه refresh؛ هنوز **هیچ** صفحه‌ای `FULLY_VERIFIED` نیست.

## چه چیزی واقعاً کار می‌کند و چه چیزی هنوز مستند/متصل نیست؟
- Verified HTML/LSK source mapping and standalone source validation tests.
- `REF AIRPORT`: پذیرش ICAO چهارحرفی، اما resolve مختصات فرودگاه و Gate فقط بعد از اتصال NAVDB معتبر امکان دارد. صرف پذیرش ICAO به معنی معتبر بودن فرودگاه در دیتابیس نیست.
- `LAST POS`: تا وقتی خروجی آخرین موقعیت محاسبه‌شدهٔ FMC متصل نشده، خالی می‌ماند؛ موقعیت IRS جایگزین آن نمی‌شود.
- `IDENT`: تا وقتی مدل نصب‌شده، rating و دو چرخه NAVDB به‌صورت معتبر وصل نشوند، مقدار نامعتبر حدس زده نمی‌شود.
- `SET IRS POS 4R`: در Unified همچنان از آداپتر متصل IRS `setFmcPosition` استفاده می‌کند؛ در standalone غیرمتصل، عملیات جعلی انجام نمی‌دهد.
- `SET IRS HDG 5R`: نمایش ATT مستند است، اما عمل نوشتن به IRS ATT هنوز اتصال ندارد؛ این محدودیت صریح اعلام شده.
- روی `INIT/REF`، `RTE/LEGS` و دیگر صفحات بک‌اند، ممیزی کامل source و effectivity همچنان باقی است.
- تست Render/CSS با Chromium و Pixel Diff اصلی و نتیجهٔ GitHub Actions هنوز از این محیط تأیید نشده است.

## QA / CI
```sh
node --check engine/ch11/cdu-preflight-evidence-v1.js
node --check cdu-standalone-v6/engine/cdu-engine.js
node --check cdu-standalone-v6/app.js
node --check panel-mosaic-lab/cockpit/cdu-irs-adapter-v1.js
node --test engine/ch11/tests/cdu-preflight-evidence-v1.test.cjs
node --test cdu-standalone-v6/tests/ch11-ident-posinit-source-v1.test.cjs
node --test cdu-standalone-v6/tests/ch11-position-pages-v1.test.cjs
node --test cdu-standalone-v6/tests/dep-arr-fcom-114032.test.cjs
```
CI file: `.github/workflows/ch11-fmc-systems-network-v1.yml`.
Tests exercise no-fake-source, combined position format, UTC evidence, ATT/ALIGN gates, REF AIRPORT → GATE clearing, blocked IRS fake heading writes and both CDU seats.

## قدم بعدی
Source-backed NAVDB selection / active-inactive date logic on IDENT، Airport/Gate coordinate resolver و ground/air visibility rules، وصل LAST POS به snapshot واقعی FMC و اجرای visual golden tests on real Chromium. اختیارات FMC نسخهٔ نصب‌شدهٔ S/N 29340 هنوز باید از AFM/AMM/WDM یا evidence معتبر مشخص شود.

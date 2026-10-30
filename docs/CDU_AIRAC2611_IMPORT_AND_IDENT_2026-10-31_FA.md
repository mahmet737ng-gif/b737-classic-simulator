# چرخهٔ 2611 و IDENT / NAV DATA — گزارش فاز اتصال
**تاریخ:** 2026-10-31 · **B737 Classic Procedure/QRH Trainer** · NOT FOR FLIGHT

## نتیجه واقعی (از ادعای واردسازی دادهٔ ناوبری خودداری شود)
- تقویم رسمی: AIRAC 2610 = 01OCT–28OCT 2026؛ 2611 = 29OCT–25NOV 2026؛ 2612 = 26NOV–23DEC 2026.
  منبع dates: https://www.public.nm.eurocontrol.int/RAD/ (effective date)؛ end-exclusive از شروع چرخهٔ بعدی به دست می‌آید.
- منبع خصوصی 2610 از پروژهٔ قبل **حفظ شده**: شناسه `PMDG_WORLD_2610_WITH_PROCEDURES_R1`، source marker با start 01/OCT/2026 و end-exclusive 29/OCT/2026، reference-only و **FMC-not-executable**.
- فایل NAVDATA و SID/STARS واقعی 2611 در منابع متصل و مخزن فعلی **پیدا نشد**. بنابراین `2611 SOURCE_ARCHIVE_NOT_AVAILABLE` است و در حال حاضر **هیچ بانک ACTIVE یا INACTIVE در IDENT با NAVDB کامل تأییدشده نصب نشده**.
- نشان‌دادن `AIRAC 2611` در Settings به معنی **سایکل معتبر تقویمی** است، نه اینکه فایل‌های فرودگاه‌ها، نقاط، SID/STAR، LEGS و دیتا واقعاً بارگذاری شده‌اند.

## کارهای اعمال‌شده روی main
- `engine/ch11/cdu-airac-banks-v1.js`: مدل AIRAC calendar + ACTUAL installed FMC banks؛ قوانین strict source fingerprint (SHA256)، شمار رکوردهای فرودگاه/نقاط/پروسیجرها، signed QA، فعال‌بودن داده و تاریخ دقیق.
- `engine/ch11/airac-cycle-installation-status-v1.json`: manifest وضعیت واقعی؛ 2610 private reference، 2611 unavailable، ACT/INACT null.
- `panel-mosaic-lab/cockpit/index.html` و `cdu-airac-status-bridge-v1.js`: نمایش وضعیت در Settings و بانک فعلی/بعدی با اعلام «دیتابیس نصب نشده».
- `panel-mosaic-lab/cockpit/cdu-stage.html` و `cdu-airac-bank-receiver-v1.js`: پیام معتبر parent → Captain/FO و اعتبارسنجی **مجدّد** منبع هر بانک داخل CDU، اتصال به `state.preflightEvidence.NAV_DATA/ACTIVE/INACTIVE`.
- `panel-mosaic-lab/cockpit/assembly.json`: bump نسخهٔ iframeهای CPT/FO و حفظ موقعیت قفل‌شدهٔ پنل.
- نمایش واقعی IDENT وقتی منبع کامل/معتبر دریافت شود: `NAV DATA = AIRAC2611`، `ACTIVE = 29OCT-25NOV`، `INACTIVE = 01OCT-28OCT` فقط اگر بانک 2610 **جداگانه** نیز وارد و تأیید شده باشد. فقط تقویم در غیاب دیتا این فیلدها را پر نمی‌کند.
- `navigation/stage_airac2611_private_v1.py`: **Staging نه Import/Activation** ZIP واقعی در مسیر خصوصی: بررسی ZIP، SHA256، marker سایکل، جلوگیری از relabel کردن 2610 به 2611، خروجی فقط metadata خارج از repo.
- `engine/ch11/tests/cdu-airac-banks-v1.test.cjs`: ده تست در حالت ایزوله، 10/10 پاس؛ `navigation/tests/test_stage_airac2611_private_v1.py` تست‌های synthetic برای staging در CI.
- `.github/workflows/ch11-fmc-systems-network-v1.yml`: آزمون‌های JavaScript و Python به CI اضافه شدند.

## ورود واقعی 2611 (نیازمند فایل کاربر)
1. نسخهٔ **دارای مجوز** `NAVDATA.zip` و `SidStars.zip` **AIRAC 2611** را به محیط خصوصی پروژه (نه فولدر public GitHub) بدهید.
2. فقط با یک مسیر خروجی خصوصی:
```powershell
python navigation/stage_airac2611_private_v1.py --navdata "D:\PrivateNav\2611\NAVDATA.zip" --sidstars "D:\PrivateNav\2611\SidStars.zip" --output "D:\PrivateNav\2611\source_stage_manifest.json"
```
3. پس از stage، واردکنندهٔ خصوصی باید فایل‌ها را با منطق 2610 قبلی در دیتابیس جدید 2611 parse کند؛ سپس schema integrity، source tokens، runways، SID/STAR/APP، magnetic reference، leg semantics و backward compatibility هر دو بانک را تأیید کند.
4. قبل از PASS همهٔ آزمون‌های محتوایی و اثرگذاری نسخهٔ FMC، هیچ بانک 2611 نباید ACTIVE یا FMC-executable اعلام شود. ZIP خصوصی، فایل SQLite و داده‌های دارای مجوز نباید روی GitHub Pages آپلود شوند.

## محدودهٔ این پاسخ
- **انجام‌شده:** ثبت زمان‌بندی، حفظ نسخهٔ قبلی، پیاده‌سازی رجیستری بانک‌ها/نمایشگر، استیجینگ امن و ۱۰ تست JavaScript.
- **انجام‌نشده:** ورود رکوردهای واقعی 2611، فعال‌کردن NAVDB در FMC، اجرای SID/STAR و محاسبات مسیر؛ چون آرشیو 2611 ارائه نشده است.
- تست واقعی صفحهٔ DEPARR/IDENT با browser screenshot و وضعیت نهایی GitHub Pages از این محیط تأیید نشده است؛ commit در `main` ثبت شده است.

## موارد قفل
بدنهٔ 1199x1312، ۷۰ Hotspot، فونت‌های BoeingCDU، فرانت‌اند IRS و منابع خصوصی 2610 دست‌نخورده‌اند.

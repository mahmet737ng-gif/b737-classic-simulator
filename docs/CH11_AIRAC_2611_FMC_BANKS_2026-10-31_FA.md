# فاز NAV DATA — AIRAC 2611 در 737 Classic Unified
تاریخ 2026-10-31 | Procedure/QRH Trainer | not for flight

## نتیجهٔ واقعی (و محدودیت مهم)
- تقویم AIRAC (منبع: AIS Greece / EUROCONTROL): **2610** از 2026-10-01 تا 2026-10-28، **2611** از 2026-10-29 تا 2026-11-25، **2612** از 2026-11-26 تا 2026-12-23.
- در فایل‌های خصوصی کاربر، NAVDATA 2610 و گزارش استخراج آن موجود است؛ 2610 در پروژه فقط **PRIVATE REFERENCE** است و هنوز به‌عنوان NAVDB عملیاتی FMC نصب یا فعال نشده است.
- **هیچ منبع واقعی NAVDATA 2611 در فایل‌های قابل‌دسترسی پیدا نشد.** تاریخ و هویت AIRAC 2611 ثبت شده، اما Procedure، Waypoint، SID/STAR و ARINC leg جعلی تولید نشده‌اند.
- بنابراین در CDU هر دو صندلی **ACTIVE/INACTIVE** و NAV DATA تا هنگام نصب و اعتبارسنجی یک Dataset واقعی، خالی می‌مانند. این **رفتار درست و غیرگمراه‌کننده** است؛ سایکل جاری تقویم با دیتابیس واقعی فعال FMC یکسان نیست.
- برای فعال‌سازی کامل 2611 به NAVDATA.zip و SidStars.zip متعلق به همان 2611 و بررسی خصوصی SHA-256، header، parser، coverage و تشخیص conflict نیاز است. در مخزن عمومی فایل دارای لایسنس منتشر نشود.

## داده و معماری اضافه‌شده
- `engine/ch11/fmc-airac-banks-v1.js`: قرارداد دو بانک؛ calendar، register/import verification gate، active/inactive، dateRange، ground-only switch، پاک‌کردن دادهٔ route و انتقال previous active به inactive.
- `panel-mosaic-lab/cockpit/cdu-airac-ident-adapter-v1.js`: نمایش واقعی IDENT از `state.fmcNavDataBanks`، نه از calendar. هماهنگی هر دو CDU از `cdu-session.js`، LSK R2/R3 date copy و درخواست change. هر درخواست تغییر در صورت *UNKNOWN* بودن `fmcOnGroundVerified` رد می‌شود.
- `panel-mosaic-lab/cockpit/cdu-airac-status-v1.js`: نمایش وضعیت AIRAC جاری و فقدان بستهٔ 2611 در Settings.
- `panel-mosaic-lab/cockpit/assembly.json` و `cdu-stage.html`: بارگذاری نسخه‌بندی‌شده در هر دو صندلی.
- `engine/ch11/tests/fmc-airac-banks-v1.test.cjs` و `fmc-airac-unified-ident-v1.test.cjs`: ۱۲ تست واحد/شبیه‌سازی مرتبط با بانک‌های FMC و IDENT.
- `engine/ch11/airac-cycle-installation-status-v1.json` و `navigation/stage_airac2611_private_v1.py` نیز مرحلهٔ **SOURCE HASHED AND MARKER CHECKED ONLY** را برای فایل خصوصی 2611 پوشش می‌دهند؛ staging به معنی تبدیل NAVDATA به مسیر قابل اجرای FMC نیست.

## تطابق با FCOM
مرجع: Boeing 737 Classic FCOM Volume 2، 11.40.8-9، صفحهٔ IDENT:
- `NAV DATA` 2L = شناسهٔ دیتابیس نصب‌شده (شناسهٔ مصنوعیِ صرفاً تقویمی نمایش داده نمی‌شود).
- `ACTIVE` 2R = محدودهٔ اعتبار دیتابیس واقعاً فعال.
- 3R = محدودهٔ اعتبار بانک غیرفعال **بدون عنوان INACTIVE در خود تصویر**.
- انتخاب تاریخ غیرفعال به Scratchpad و انتقال آن به ACTIVE؛ تغییر مجاز **فقط روی زمین** و موجب پاک‌شدن داده‌های مسیر قبلی. دیتابیس منقضی‌شده در طول پرواز تا پس از فرود فعال می‌ماند.
- پیش از ورود دادهٔ واقعی 2611 هیچ کدام از این محدوده‌ها به‌عنوان دیتابیس FMC فعال نمایش داده نمی‌شوند.

## وضعیت کنونی
| کار | وضعیت |
|---|---|
| تقویم دقیق AIRAC 2611 | ثبت شده |
| حفظ 2610 در مرجع خصوصی | بدون حذف/overwrite |
| مدیریت بانک و قوانین تعویض | پیاده‌سازی و تست شده |
| اتصال NAV DATA / ACTIVE / INACTIVE به IDENT کپتن و FO | پیاده‌سازی شده، fail-closed |
| منبع PRIVATE 2611 و نصب عملیاتی آن | **موجود نیست / انجام نشده** |
| اتصال وضعیت On Ground معتبر به CDU | **هنوز انجام نشده**؛ تغییر بانک fail-closed |
| اجرای GitHub Actions و تست تصویری مرورگر | **هنوز از این نشست تأیید نشده** |

## API و تست
```bash
node --test engine/ch11/tests/fmc-airac-banks-v1.test.cjs
node --test engine/ch11/tests/fmc-airac-unified-ident-v1.test.cjs
python3 -m unittest navigation/tests/test_stage_airac2611_private_v1.py
```
اسکریپت staging از `--navdata`, `--sidstars`, `--output` برای **مسیر خصوصی خارج از مخزن** استفاده می‌کند؛ این دستور بدون فایل‌های اصلی 2611 قابل اجرا نیست.

تغییرات مرتبط با NAV DATA نباید ظاهر قفل‌شدهٔ CDU، فونت‌های Boeing، Hotspotهای ۷۰تایی یا فرانت‌اند IRS را تغییر دهند.

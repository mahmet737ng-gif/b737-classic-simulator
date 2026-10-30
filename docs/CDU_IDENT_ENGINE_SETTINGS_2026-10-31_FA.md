# تنظیم مدل هواپیما و موتور در CDU IDENT — Unified
تاریخ 2026-10-31 · B737 Classic Procedure/QRH Trainer

## درخواست و نتیجه
در **Settings / Aircraft Configuration** دو انتخاب مستندِ کاربر قرار گرفت:
- Exact Aircraft Model: 737-300 / 737-400 / 737-500؛ همزمان با گزینش خانوادهٔ 300/500 یا 400، ناسازگاری میان مدل و خانواده کنترل می‌شود.
- Engine Type & FMC Rating:
  - CFM56-3 B1 → 18.5K (18,500 lbf)
  - CFM56-3 B3 → 20K (20,000 lbf)
  - CFM56-3 C1 → 23.5K (23,500 lbf)

در **FMC IDENT** فیلدهای `MODEL` در 1L و `ENG RATING` در 1R از پروفایل انتخاب‌شده پر می‌شوند. بنا بر FCOM Vol.2 صفحات `11.40.8–9`، فیلد `MODEL` مدل 737 را نشان می‌دهد و `ENG RATING` ریتینگ عددی موتور را؛ نام دقیق B1/B3/C1 از خود Settings و API قابل مشاهده است، نه با افزودن یک فیلد خلاف FCOM به نمایشگر.

## دیتافلو
`B737AircraftProfileV1` (default B737-300 + CFM56-3B1، انتخاب *آموزشی*) → `B737AircraftProfileStore` (LocalStorage + change notifications) → `B737CDUIdentInstallationV1.select/verify` → `cdu-ident-profile-bridge-v1.js` → validated same-origin `postMessage` → `cdu-ident-profile-receiver-v1.js` روی CDU CAPT/FO → `state.preflightEvidence.MODEL/ENG_RATING` → `B737CDUPreflightEvidenceV1.identValue` → نمایشگر IDENT.

- همزمانی: هر دو CDU از یک `AircraftProfileStore` تغذیه می‌شوند و بعد از Save تغییر می‌کنند.
- حفظ بعد از Refresh: یک Storage Key نسخهٔ v1 استفاده می‌شود؛ Profileهای قدیمی فاقد `aircraftModel` و `engineVariant` به‌صورت سازگار نرمال‌سازی می‌شوند.
- حفظ بعد از CDU Reset: گیرنده آخرین installation معتبر را مجدداً در view-state اعمال می‌کند.
- امنیت داده: پیام فقط از parent همان origin و seat معتبر پذیرفته می‌شود و سه نوع موتور/ریتینگ مجاز به‌صورت exact whitelist اعتبارسنجی می‌شوند.
- شمارهٔ Part Number / OP PROGRAM، NAVDB، serial effectivity و اطلاعات واقعی EP-FSI از روی این انتخاب «تأیید» نمی‌شوند. مصدر داده‌ها `SELECTED_TRAINER_*` است.

## فایل‌های تغییر یافته
- `engine/config/aircraft-profile-v1.js`: فیلدها، Catalogue، Migration، validation، persisted selected configuration.
- `panel-mosaic-lab/cockpit/index.html`: گزینه‌های Settings و بارگذاری Bridge.
- `panel-mosaic-lab/cockpit/aircraft-settings.js`: هماهنگ‌سازی انتخاب دقیق مدل/خانواده و نمایش بالای پنل.
- `engine/config/cdu-ident-installation-v1.js`: موتور نگاشت authoritative برای **انتخاب آموزشی کاربر**.
- `engine/ch11/cdu-preflight-evidence-v1.js`: منبع دادهٔ explicit trainer برای MODEL/ENG RATING پذیرفته می‌شود.
- `panel-mosaic-lab/cockpit/cdu-ident-profile-bridge-v1.js` و `cdu-ident-profile-receiver-v1.js`: ارتباط زنده Parent به CPT/FO.
- `panel-mosaic-lab/cockpit/cdu-stage.html`، `assembly.json`: بارگذاری و cache bust هر دو seat.
- `cdu-standalone-v6/app.js`: مدل آزمایشی N1 V19 برای نصب‌های B1/18.5K، B3/20K، C1/23.5K **کالیبره نیست**؛ برای جلوگیری از نمایش محاسبهٔ اشتباه، انتخاب‌های جدید نمی‌توانند این منحنیِ 3B1/20K را به‌عنوان N1 معتبر استفاده کنند.
- `engine/config/tests/cdu-ident-installation-v1.test.cjs`: ۷ تست بایندینگ، ذخیره، مهاجرت، ضدجعل پیام، هماهنگی هر دو CDU و ماندگاری بعد از reset.
- `.github/workflows/ch11-fmc-systems-network-v1.yml`: تست‌ها در CI.

## محدوده QA
- تست‌های جاوااسکریپت ایزوله برای این ویژگی ۷/۷ پاس شده‌اند.
- نتیجهٔ واقعی GitHub Actions و گرفتن اسکرین‌شات مرورگر از دو CDU هنوز تأیید نشده.
- این انتخاب **Training Configuration** است. تا زمان بررسی Effectivity واقعی، نباید به‌عنوان نصب قطعی موتور روی S/N 29340 گزارش شود.
- دارایی‌های عکس اصلی، ۷۰ Hotspot CDU، فونت‌های Boeing و Frontend قفل‌شدهٔ IRS تغییر نکرده‌اند.

## تست دستی
Settings → Exact Aircraft Model و Engine Type → Save → صفحه IDENT در CDU CAPT و FO:
`MODEL = 737-300/400/500` مطابق انتخاب و `ENG RATING = 18.5K/20K/23.5K`. صفحه را عوض کن، برگرد IDENT، یکی از CDUها را Reset کن و صفحه را Refresh کن؛ انتخاب هر دو باید حفظ شود.

```bash
node --test engine/config/tests/cdu-ident-installation-v1.test.cjs
```

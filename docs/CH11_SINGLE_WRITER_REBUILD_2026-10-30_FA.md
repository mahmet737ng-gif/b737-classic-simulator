# بازسازی ساختاری CDU / FMC برای Unified — گزارش فاز یک
تاریخ: 2026-10-30 · Boeing 737 Classic 300/400/500 · EP-FSI S/N 29340 · **PROCEDURE/QRH TRAINER ONLY**

## چرا بازسازی ضروری بود؟
در CDU v6، `app.js` یک صفحه را رسم می‌کرد ولی `CDU_NAV_API`، `CDU_STAGE5_API`، `CDU_STAGE6_API`، `CDU_REFERENCE_PROGRESS_API` و `CDU_STAGE10_ADVISORY` نیز به‌طور متوالی به همان DOM دسترسی داشتند. بعضی `paint(box)`ها با `replaceChildren` کل متن را پاک می‌کردند. در نتیجه پایگاه متن یک صفحه حتی پس از اصلاح می‌توانست دوباره توسط لایهٔ دیگر جایگزین شود.

## ساختار جدید که در main ثبت شد
1. **Single-writer:** `cdu-standalone-v6/engine/screen-compositor-v1.js` برای هر صفحه یک Owner تعیین می‌کند: صفحهٔ اصلی FCOM، نمایش مرجع Stage5/Stage6 یا NAVDB. Overlay فقط یک `div` جدا از نمایشگر اصلی را می‌بیند و در پایان خروجی یک‌باره روی نمایشگر کپی می‌شود.
2. **Scratchpad:** ردیف Scratchpad از موتور اصلی `CDU_ENGINE` استخراج و حتی پس از `replaceChildren()` یک Overlay نگهداری می‌شود. اگر Overlay خطا بدهد، به صفحهٔ پایه بازمی‌گردیم. چراغ‌ها و صفحه‌کلید اصلی دست‌نخورده‌اند.
3. **Page source contract:** `engine/ch11/fcom-screen-contract-v1.js` قرارداد ۲۴ ستون و ۱۴ سطر، ۱۲ LSK، Folio، وضعیت تأیید و خطاهای خانه‌بندی را از `page-definitions` می‌سازد. `app.js` آن را در `window.CDU_SCREEN_QA_V1` در دسترس می‌گذارد.
4. **Master registry:** `engine/ch11/master-screen-registry-v1.json` گزارش تولیدشده از ۳۷ صفحهٔ کنونی است؛ تنها منبع تعریف فعال صفحات همان `page-definitions.json` / JS سینک‌شده است. Golden screenshot و امضای ممیزی برای تمامی صفحه‌ها **خالی** باقی مانده‌اند.
5. **Backend procedure evidence:** `engine/ch11/cdu-transition-ledger-v1.js` تغییرات کلید، صفحه، Scratchpad length، pending/ACT-MOD را برای هر صندلی ثبت می‌کند. در `window.CDU_PROCEDURE_AUDIT_V1` قابل مطالعه است؛ **صرفاً مشاهده‌کننده** است، نه موتور فرمان‌دهندهٔ FMC.
6. **Visual gate:** `engine/ch11/golden-screen-diff-v1.js` تصویر واقعی Unified را با مرجع خصوصی FCOM بر اساس Pixel Mask متن مقایسه می‌کند. بدون هر دو تصویر جواب **BLOCKED** می‌دهد و حتی Visual Pass به‌تنهایی تأیید کامل محسوب نمی‌شود.
7. **حفظ دارایی‌های قفل‌شده:** تصویر تأییدشده 1199×1312، نقشهٔ ۷۰ Hotspot، فونت‌های BoeingCDU-Large/Small و Front-end IRS تغییر نکرده‌اند.

## وضعیت واقعی منابع — بدون ادعای تکمیل
| آیتم | مقدار فعلی |
|---|---|
| صفحات فصل ۱۱ PDF فهرست‌شده | 409 |
| نامزدهای عنوان CDU در TOC | 45 |
| صفحات/حالت‌های تعریف‌شده در CDU v6 | 37 |
| صفحه‌هایی با ممیزی اولیهٔ Layout | 1 (DEP/ARR INDEX، folio 11.40.32) |
| صفحه‌هایی با تأیید کامل Layout + Effectivity + Behavior + Pixel Diff | **0** |
| خطای Static Cell Overflow پیدا شده | 9 (در ۶ صفحهٔ باقی‌مانده، قابل تعیین از registry) |
| تصویر Golden Reference خصوصی قابل استفادهٔ خودکار | **فعلاً موجود نیست** |
| آزمایش مرورگر زنده روی GitHub Pages | **تأیید نشده** |

## اولین نمونهٔ استخراج مستقیم از منبع
- FCOM Vol.2 **11.40.5** / PDF 1557: `INIT/REF INDEX` در تعریف فعال اصلاح شده؛ L1 IDENT، L2 POS، L3 PERF، L4 TAKEOFF، L5 APPROACH، L6 OFFSET، R1 NAV DATA و R6 MAINT. گزینهٔ MAINT تا زمان داشتن مدل مستند **غیرفعال** است. وجود برچسب به معنی عملکرد تأییدشده نیست.
- **11.40.8** / PDF 1560: `IDENT` متن مرجع بررسی شده ولی Software/Effectivity و OP PROGRAM نصب‌شده هنوز معلوم نیست.
- **11.40.11** / PDF 1563: صفحهٔ POS INIT در متن FCOM دارای یک سطر combined LAST POS و سه صفحهٔ Position است؛ تفاوت با قالب فعلی برای ممیزی ثبت شده، هنوز به‌صورت خودکار اصلاح نشده.
- **11.40.32–33** / PDF 1584–85: DEP/ARR INDEX، موقعیت مبدأ/مقصد/OTHER و انتخاب‌های صفحه.
- **11.40.37** / PDF 1589: در متن نمونه، PERF INIT به صورت **1/2** و دارای ادامهٔ PERF LIMITS است. قالب فعلی برحسب نسخهٔ آموزشی **1/1** نشان می‌دهد؛ به‌علت نامشخص بودن نرم‌افزار نصب‌شده، بدون ممیزی Variant تغییر قطعی اعمال نشده.

**توجه:** استخراج Text/Coordinates برابری با ممیزی تصویری ندارد. تصاویر اصلی PDF ۸۳MB در کتابخانهٔ خصوصی‌اند و مجوز/مسیر materialization فایل برای پردازش بصری خودکار در این نشست فراهم نبود. بنابراین ادعای Pixel-perfect همهٔ صفحات مجاز نیست.

## چک‌های قابل اجرای توسعه‌دهنده
```bash
node --test engine/ch11/tests/fcom-screen-compositor-v1.test.cjs
node --test engine/ch11/tests/golden-screen-diff-v1.test.cjs
node --test engine/ch11/tests/cdu-transition-ledger-v1.test.cjs
node --test cdu-standalone-v6/tests/dep-arr-fcom-114032.test.cjs
node --test engine/ch11/tests/cdu-24-column-grid-v1.test.cjs
node tests/cdu-font-lock.test.cjs
```
GitHub Actions در `.github/workflows/ch11-fmc-systems-network-v1.yml` این مرحله را تست می‌کند؛ این گزارش به‌معنی اجرای موفق CI و تست زندهٔ مرورگر نیست.

## API تشخیص در Console داخلی CDU
```js
CDU_SCREEN_QA_V1.getCurrent();       // 14 lines, 24 columns, issue list
CDU_SCREEN_QA_V1.getMasterAudit();  // source coverage and static issues
CDU_SCREEN_QA_V1.getVisualOwner();  // which page renderer won
CDU_PROCEDURE_AUDIT_V1.getTrace();  // key/page/route history
CDU_PROCEDURE_AUDIT_V1.audit();     // overflow and invalid page transitions
```

## برنامهٔ باقی‌مانده برای سطح واقع‌گرایی موردنظر
1. استخراج همهٔ صفحات تصویری FCOM و تبدیل هر Screen/Software Option به ۲۴×۱۴ Spec با Folio و مرجع خصوصی Golden؛ بررسی KBFI/KMWH و داده‌های نمونه به‌عنوان نمونه، نه دیتای واقعی EP-FSI.
2. جایگزینی خروجی‌های موقت Stage 5/6 با Presenterهای مبتنی بر Specification، حذف تدریجی منطق پراکنده، یکپارچه‌سازی شرایط RTE/LEGS/EXEC.
3. تکمیل Engine های FMC Navigation/Performance/Flight Phase با منابع واقعی AVIONICS و جدول‌های AFM/FCOM؛ جدا نگه‌داشتن «شبیه‌سازی آموزشی» از «مدرک فنی تأییدشده».
4. اعتبارسنجی FMC software update/effectivity مربوط به S/N 29340 برای نرم‌افزار مناسب و تفاوت آپشن‌ها.
5. گرفتن تصاویر زندهٔ هر صفحه از هر دو CDU با Browser E2E، Diff در Crop صحیح و امضای تأیید به شرط قبولی رفتار و عکس.
6. تنها وقتی تمام سند، رفتار و تصویر یک Variant قبول شد وضعیت `FULLY_VERIFIED` داده می‌شود. تا آن زمان هیچ `FULLY_VERIFIED` تولید نمی‌کنیم.

# CDU v5.1 — اصلاح دو ایراد تصویر

- متن‌ها: جای برچسب‌های هر ردیف بر اساس مرکز واقعی LSK همان ردیف، نه grid مساوی، محاسبه می‌شود. مقادیر هر ردیف پایین آن و Scratchpad در پایین صفحه رندر می‌شود.
- EXEC: عکس اصلی بدون تغییر باقی مانده است. برای خاموشی، یک تصویر کوچک بازسازی‌شده از پس‌زمینه دقیقاً نوار روشن پیش‌فرض را می‌پوشاند؛ هنگام فعال‌شدن شرط EXEC، همان روشنایی اصلی عکس آشکار می‌شود.
- منطق RTE/ACTIVATE/EXEC نسخه v5 و نمایش EHSI دست‌نخورده باقی مانده‌اند.
- وضعیت: تست منطقی و هندسی اجرا شده؛ اعتبارسنجی بصری سرتاسری در مرورگر کاربر هنوز نیازمند تست است.

## Automated checks
- Node: v5.1 geometry + route state PASS.
- Node: seven EHSI mode tests PASS.
- Node: 409-page/36-template field test PASS.
- Chromium DOM browser check via in-memory page: 14 framebuffer lines, 70 clickable keys, 0 JS errors. Six label centers differ from corresponding LSK button center by 0.62–0.65 CSS px.
- Chromium pointer sequence: RTE origin/dest staged: EXEC OFF; ACTIVATE: ON; EXEC: OFF.
- Original approved PNG: unchanged SHA-256.
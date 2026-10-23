# پنل تعاملی Flight Controls — بوئینگ 737 کلاسیک

نسخهٔ مستقیم روبه‌رو و تعاملی شامل پنل اصلی Flight Controls و پنل پایینی Navigation Transfer است.

## اجزای تعاملی

- FLT CONTROL A/B: سه وضعیت `STBY RUD / OFF / ON`
- SPOILER A/B: دو وضعیت `OFF / ON`
- ALTERNATE FLAPS: گارد قرمز بازشو، کلید `OFF / ARM` و کلید فنردار `UP / OFF / DOWN`
- YAW DAMPER: `OFF / ON`
- VHF NAV: `BOTH ON 1 / NORMAL / BOTH ON 2`
- IRS: `BOTH ON L / NORMAL / BOTH ON R`
- EFI: `BOTH ON 1 / NORMAL / BOTH ON 2`
- ۹ annunciator با محدودهٔ جداگانه و نور محدود به داخل لنز

## استاندارد بصری

- تمام Toggleهای سفید از استاندارد سراسری و قفل‌شدهٔ `b737-cockpit-toggle-v1` استفاده می‌کنند.
- برای Selectorهای سه‌حالته، فریم مستقل CENTER/NEUTRAL به همان استاندارد افزوده شده است.
- هیچ کادر یا حلقهٔ آبی روی کنترل‌ها نمایش داده نمی‌شود.
- Hitbox هر کنترل فقط روی شکل فیزیکی آن قرار دارد؛ نوشته‌ها و پس‌زمینه انتخاب نمی‌شوند.
- حرکت Toggle با فریم‌های مستقل و تغییر زاویهٔ سه‌بعدی انجام می‌شود، نه جابه‌جایی سادهٔ یک تصویر.

## منطق نمایشی

- خارج‌کردن FLT CONTROL A/B از ON، چراغ LOW PRESSURE متناظر را روشن می‌کند.
- خاموش‌کردن YAW DAMPER، چراغ YAW DAMPER را روشن می‌کند.
- ALTERNATE FLAPS بدون بازکردن گارد و ARM شدن حرکت نمی‌کند؛ کلید UP/DOWN بعد از رهاشدن به OFF برمی‌گردد.
- با لمس هر چراغ می‌توان Fault همان چراغ را برای تست روشن/خاموش کرد.
- HOLD LAMP TEST فقط هنگام نگه‌داشتن، هر ۹ چراغ را روشن می‌کند.
- STBY HYD FAIL چراغ‌های LOW QUANTITY و LOW PRESSURE را هم‌زمان برای تست فعال می‌کند.

این نسخه یک نمونهٔ آموزشی رابط و انیمیشن است و برای عملیات واقعی هواپیما نیست.

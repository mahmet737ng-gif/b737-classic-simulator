> **نصب مستقیم روی پنل (۲۶ اکتبر ۲۰۲۶):** ۱۲ گارد دارای نقطهٔ مستند در `rotary-guards.json` و `lights-controls.json` اکنون از طریق `guarded-inplace-v1.js` روی لایهٔ Overhead نصب شده‌اند؛ چرخش و کلیک آنها به موتور کنترل قبلی وصل است. **پنج کنترل باقی‌مانده** (BUS TRANSFER، ANTISKID، GPWS FLAP/GEAR/TERRAIN) هنوز فاقد جای نصب پیکسلی قابل‌قبول هستند؛ در پنجرهٔ ۱۷تایی فقط پیش‌نمایش دارند. بنابراین «۱۷ نصب نهایی تأییدشده» ادعا نمی‌شود. موزاییک اصلی دست‌نخورده است.

# فهرست یکپارچهٔ ۱۷ Guarded Switch در Unified — نسخهٔ Preview

**B737 Classic 300/400/500 — ثبت بر اساس پاسخ‌های مالک — ۲۶ اکتبر ۲۰۲۶**

## دسترسی و وضعیت

[بازکردن بازبینی ۱۷ سوئیچ مستقیم داخل Unified](https://mahmet737ng-gif.github.io/b737-classic-simulator/panel-mosaic-lab/cockpit/?guarded17=1)

نمای اصلی **Unified** دکمهٔ «۱۷ گارد · باز / بسته» دارد. همهٔ قطعات در **یک پنجرهٔ تعاملی** با نماهای CLOSED / OPEN، درپوش، لولا، پایه و خود سوئیچ، و وضعیت‌های تعریف‌شدهٔ کنترل نمایش داده می‌شوند. این بخش از یک رجیستری مشترک `GuardedSwitchBlueprints.json` استفاده می‌کند، نه ۱۷ مدل متناقض جدا.

> *پیش‌نمایش فنی:* این نسخه به معنی نصب پیکسلی روی هر ۱۷ محل پنل نیست. ابعاد واقعی میلی‌متری، محل پنج سوئیچ اضافه‌شده و کالیبراسیون‌های نهایی هنوز تأیید نشده‌اند. تصاویر قفل‌شدهٔ OH01–OH25، registry موجود و عملکرد موتور سیستم‌ها دست‌نخورده‌اند.

## جدول ۱۷ کنترل

| ردیف | نام | پنل | لولا | رنگ پایه | فرم اختصاصی | وضعیت‌های نمایشی | کادر مرجع |
|---:|---|---|---|---|---|---|---|
| 1 | FLT CONTROL A | OH07 | **Up** | مشکی | black-shouldered-cap | STBY RUD / OFF / ON | نامشخص |
| 2 | FLT CONTROL B | OH07 | **Up** | مشکی | black-shouldered-cap | STBY RUD / OFF / ON | نامشخص |
| 3 | FLIGHT SPOILER A | OH07 | **Up** | مشکی | black-shouldered-cap | OFF / ON | نامشخص |
| 4 | FLIGHT SPOILER B | OH07 | **Up** | مشکی | black-shouldered-cap | OFF / ON | نامشخص |
| 5 | ALTERNATE FLAPS MASTER | OH07 | **Down** | قرمز | red-tapered-long-cap | OFF / ARM | نامشخص |
| 6 | BATTERY | OH10 | **Up** | مشکی | black-electrical-guard | OFF / ON | نامشخص |
| 7 | GEN 1 DRIVE DISCONNECT | OH11 | **Up** | قرمز | red-tapered-long-cap | REST / ACTUATE | فقط کادر اولیه |
| 8 | GEN 2 DRIVE DISCONNECT | OH11 | **Up** | قرمز | red-tapered-long-cap | REST / ACTUATE | فقط کادر اولیه |
| 9 | STANDBY POWER | OH11 | **Left** | مشکی | wide-low-profile | BAT / OFF / AUTO | فقط کادر اولیه |
| 10 | EMER EXIT LIGHTS | OH14 | **Up** | مشکی | black-vertical-exit | OFF / ARMED / ON | نامشخص |
| 11 | PASSENGER OXYGEN | UPPER | **Down** | مشکی | black-vertical-oxygen | NORMAL / ON | نامشخص |
| 12 | FLIGHT RECORDER — TEST/NORMAL | UPPER | **Left** | مشکی | low-profile-recorder | TEST / NORMAL | فقط کادر اولیه |
| 13 | BUS TRANSFER | OH12 | **Left** | مشکی | black-horizontal-oxygen-rotated-90 | OFF / AUTO | نامشخص |
| 14 | ANTISKID | CENTER_INSTRUMENT | **Down** | مشکی | black-antiskid-inset | OFF / ON | نامشخص |
| 15 | GPWS FLAP INHIBIT | GROUND_PROXIMITY_PANEL | **Up** | مشکی | gpws-three-identical | FLAP INHIBIT / NORMAL | نامشخص |
| 16 | GPWS GEAR INHIBIT | GROUND_PROXIMITY_PANEL | **Up** | مشکی | gpws-three-identical | GEAR INHIBIT / NORMAL | نامشخص |
| 17 | GPWS TERRAIN INHIBIT | GROUND_PROXIMITY_PANEL | **Up** | مشکی | gpws-three-identical | TERR INHIBIT / NORMAL | نامشخص |

## اصلاح‌های قفل‌شده

- **BUS TRANSFER:** رنگ مشکی، **هم‌فرم PASSENGER OXYGEN که ۹۰ درجه در صفحه چرخیده**؛ طول افقی از ارتفاع بزرگ‌تر و لولا Left. فرم باز/بسته ثابت است و فقط زاویه حول لولا تغییر می‌کند.
- **ANTISKID:** جنس/رنگ پایه **مشکی**؛ روشن‌شدن ظاهری به‌دلیل انعکاس نور است و تغییر رنگ ماده یا Sprite نیست.
- **GPWS FLAP / GEAR / TERRAIN:** **سه گارد مستقل**، هم‌اندازه، هم‌شکل، هم‌رنگ و با لولا Up. شکل پوشش و قطعات زیرین بین سه نمونه از یک خانواده است، اما کنترل و محور حرکت هر کدام مستقل‌اند.
- **FLIGHT RECORDER:** Left به معنی لولای چپ و کشیدن لبهٔ راست به طرف چپ، نه بازشدن رو به بالا.
- **GEN DRIVE DISCONNECT:** `REST / ACTUATE` فقط نمایش عمل لحظه‌ای است، نه دو وضعیت پایدار مکانیکی اثبات‌شده در FCOM.

## قرارداد یکپارچگی شکل و رنگ

۱. هر شناسه یک طراحی پایهٔ اختصاصی دارد؛ CLOSED و OPEN **هیچ‌وقت مش، ضخامت، رنگ، متریال، UV و Scale جدا ندارند**. ۲. فقط `HingePivot` می‌چرخد و سایه/نور پرسپکتیو تغییر می‌کنند. ۳. لولا، صفحهٔ نصب و سوئیچ زیر گارد از درپوش مستقل‌اند. ۴. وضعیت‌های سوئیچ زیر گارد از FCOM استخراج شده‌اند اما فعلاً صرفاً برای مشاهده‌اند؛ فرمان واقعی برق/هیدرولیک/اکسیژن ارسال نمی‌کنند. ۵. موقعیت‌های پنل فقط پس از اندازه‌گیری واقعی و بازبینی تصویر به atlas متصل می‌شوند.

## منبع و آزمون

- [بلوپرینت‌ها (JSON)](../unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json)
- [پاسخ‌های لولا](../engine/maps/guarded-switch-owner-hinge-quiz-v1.json)
- [آزمایشگاه HTML](../panel-mosaic-lab/cockpit/guarded-17-review.html)
- [تست‌های ۱۷ سوئیچ](../panel-mosaic-lab/cockpit/guarded-17-review.test.cjs)
- [مسیر اصلی Unified](../panel-mosaic-lab/cockpit/index.html)

آزمون‌ها ساختار ۱۷ مورد، جهات لولا، ثبات رنگ/فرم، BUS TRANSFER، سه GPWS و عدم تغییر تصاویر قفل‌شده را می‌سنجند. خروجی Unity Editor و دقت تصویری سخت‌افزار واقعی هنوز نیاز به آزمون مستقل دارد.

# B737 Classic — مرحلهٔ ۱: ثبت زاویهٔ صفر و نقاط مرجع اسکیل

تاریخ: 2026-10-25 | مدل تصویر: B737-33V EP-FSI | مخزن: `mahmet737ng-gif/b737-classic-simulator`

## خروجی انجام‌شده

`engine/instruments/needle-zero-reference-stage1-v1.json` شامل **54 نشانگر**، مسیر و SHA256 فایل مرجعِ دست‌نخورده، ابعاد پیکسل بومی، مکان مرکز چرخش (در صورت وجود)، برچسب‌های عددی مقیاس، نقاط زاویه‌دار دارای سابقهٔ اندازه‌گیری و پرچم عدم‌تأیید است.

- مراکز چرخش موجود/پیشنهادی: 20/54
- صورت‌های دارای حداقل یک زاویهٔ استخراج‌شده از ثبت تصویری یا اسکن منبع: 6/54
- صورت‌های دارای زاویهٔ صفرِ **پیشنهادی**: 6/54
- مجموع ثبت‌های زاویه‌دار کاندیدا (شامل درجات مشترک و چنداسکیله): 52
- ثبت‌های نهایی و تأییدشده برای کل اسکیل: **0/54**

## مثال‌های هندسهٔ تصویری فعلی

زاویه‌ها در تصویر، از ساعت ۱۲ در جهت ساعت‌گرد سنجیده می‌شوند:

- Fuel temperature / OH09: صفر **+0.5°** (کاندیدا)، از −۴۰ تا +۴۰ درجه سانتی‌گراد ۹ لنگر زاویه‌ای
- DC AMPS / OH10: صفر **+1.05°** (کاندیدا، با مرکز تصویری x310,y192)
- CPS / OH10: صفر **−71.08°** (کاندیدا، مرکز تصویری x780,y192)
- Differential pressure / OH19: صفر **+0.64°** (لنگر کاندیدا)
- Cabin altitude / OH19: صفر **+2.71°** و لنگرهای ۵۰۰، ۱۰۰۰، ۱۵۰۰، ۲۰۰۰، ۲۵۰۰، ۳۰۰۰ فیت به‌علاوهٔ چند لنگر ارتفاع بالاتر (همه کاندیدا)
- Duct pressure / OH21: صفر بدون برچسب **−152.06°** (تفسیر کاندیدا)
- Cabin temperature / OH20: صفر **−137.27°** (کاندیدا)

**تعارض منبع:** oh.elec.dc_amps: مرکز قبلی (310,168) و مرکز اسکن (310,192)؛ oh.elec.cps: مرکز قبلی (715,190) و مرکز اسکن (780,192). انتخاب خودکار یک مرکز ممنوع است.

## سیاست تأیید و باقی‌مانده

این ثبت داده‌های موجود را واقعی و بدون جعل نقص‌ها یکپارچه می‌کند؛ **به معنی پایان اندازه‌گیری پیکسل تمامی ۵۴ گیج نیست**. برای بستن مرحلهٔ یک باید تصاویر مرجع در اندازهٔ اصلی تک‌تک بازبینی و تمام خطوط ماژور و مینور با x/y نوک خطوط و مرکز چرخش معتبر ثبت شوند. بدون این کار زاویه‌ها نباید به موتور حرکت واقعی نیدل اعمال شوند. اسکریپت‌های منبعِ قبلی `tools/gauge-source-visual-review.py` و `tools/gauge-zero-tip-radial-scan.py` برای همین بازبینی استفاده می‌شوند.

یادآوری: ارتفاع کابین روی زمین تابع ارتفاع/فشار فرودگاه است و عدد صفر سراسری ندارد؛ بنابراین وجود علامت صفر بر روی گیج، مقدار Cold & Dark را تعیین نمی‌کند.

اجرای اعتبارسنجی:

```bash
node --test engine/instruments/needle-zero-reference-stage1-v1.test.cjs
```


## 2026-10-26 — MRG Classic Electrical 142–161 cross-audit

See [`MRG_CLASSIC_ELECTRICAL_NEEDLE_AUDIT_2026-10-26.md`](MRG_CLASSIC_ELECTRICAL_NEEDLE_AUDIT_2026-10-26.md) and `engine/instruments/mrg-electrical-needle-audit-v1.js`. New source-confirmed **numeric** reference windows are TR1/TR2 24–30 V and 20–25 A, TR3 24–30 V and 10–15 A, BATTERY 22–30 V and normally 0 A; DC voltage on the selector is the respective DC BUS reading, not necessarily output of the selected TR. TR failure with bus backup must not move DC VOLTS and DC AMPS identically. MRG Classic CSD thresholds: oil pressure <120 psi; oil temperature >157 °C. NG IDG thresholds are excluded. New values are independent of native-pixel pointer geometry. The OH10 pivot conflicts and all 54-face full-scale certifications stay **UNRESOLVED**. The default angle calibration is not promoted or altered by this source audit.


## 2026-10-26 — MRG Bus/Consumer 340-row source QA

New `engine/systems/mrg-classic-340-consumer-bus-index-v1.json` contains **340 Classic MRG generic feeder rows** from printed pp.182-188; `engine/systems/mrg-classic-bus-failure-effects-v1.json` contains **35 symptom rows** from printed pp.162-167; `engine/systems/mrg-classic-consumer-bus-qa-v1.js` maps **17 gauge IDs** into candidate electrical source classes (115 VAC, 28 VAC, 28 VDC distinct). The OH11 CSD oil-temp indicators use DC BUS 1/2, engine oil pressure/temperature and other 28VAC instruments use the respective transfer-bus transformer class; EGT/N2 standby DC and N1 battery feeds are explicitly separated. MRG INOP does not imply needle value 0, and the 54-gauge full native tick/zero/center certification remains UNRESOLVED. See `docs/MRG_CLASSIC_ELECTRICAL_BUS_CONSUMERS_2026-10-26.md`. Generic CL evidence cannot be promoted to EP-FSI installed WDM automatically.

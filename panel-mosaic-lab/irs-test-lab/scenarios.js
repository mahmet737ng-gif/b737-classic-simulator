/* IRS Test Lab scenario catalogue — QRH D6-27370-3/500-SEP 11.5–11.10,
 * FCOM 11.10/11.20; B737 MRG IV.11 298–300.
 * Concise educational paraphrases, NOT operational QRH checklists.
 * 'SIM' explicitly indicates an instructor-injected stand-in where hardware
 * damage/ATT/transfer effects are not yet simulated by the main IRS core.
 */
(function(root,factory){'use strict';const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.B737IRSTestScenariosV1=a;})
(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const qr={
 dc:'QRH 11.5 — IRS DC FAIL',fault:'QRH 11.6–11.9 — IRS FAULT',
 ondc:'QRH 11.10 — IRS ON DC',align:'MRG IV.11 p.298 — IRS ALIGN',
 mrg:'MRG IV.11 p.299–300; FCOM 11.10/11.20',
 normal:'FCOM 11.20.7–9; SP.11.4–5'
};
function item(id,group,title,subtitle,ref,level,steps,expected){
 return Object.freeze({id,group,title,subtitle,ref,level,steps,expected});
}
const all=Object.freeze([
item('normal-nav','ALIGN','Normal OFF → NAV','عرض معمولی · تست ON DC و ALIGN ده دقیقه‌ای',qr.normal,'CORE',
 ['سوئیچ را از OFF مستقیماً به NAV ببرید','روشن‌شدن لحظه‌ای ON DC و سپس ALIGN را بررسی کنید','Present Position صحیح وارد کنید','پس از پایان زمان، NAV READY و ALIGN خاموش را بررسی کنید'],
 ['ON DC ابتدا روشن، سپس خاموش','ALIGN ثابت و زمان‌سنج','ورود موقعیت معتبر','NAV READY بعد از پایان']),
item('normal-align','ALIGN','OFF → ALIGN hold','عرض 50°N · الزام انتخاب NAV به‌صورت دستی',qr.normal,'CORE',
 ['ALIGN را در عرض 50°N انتخاب کنید','پس از پایان ۱۰ دقیقه ALIGN باید ثابت بماند','تنها پس از آماده‌شدن، NAV را انتخاب کنید'],
 ['ALIGN روشن ثابت تا انتخاب NAV','زمان پایه ۱۰ دقیقه','موقعیت تا NAV نامعتبر']),
item('no-position','ALIGN','ENTER IRS POSITION — 08','زمان Alignment تمام شده اما PPOS وارد نشده',qr.align,'CORE',
 ['Alignment را بدون ورود موقعیت کامل کنید','چشمک‌زدن ALIGN و کد 08 را بررسی کنید','موقعیت صحیح را دوباره از FMC/ISDU وارد کنید'],
 ['ALIGN FLASH','ISDU 08','CDU ENTER IRS POS','NAV INVALID تا ورود موقعیت']),
item('motion','ALIGN','IRS MOTION — 03','حرکت هواپیما حین Alignment',qr.align,'CORE',
 ['در حال Alignment سرعت زمینی ایجاد کنید','چراغ ALIGN و کد 03 را مشاهده کنید','حرکت را متوقف و Full Alignment را دوباره بررسی کنید'],
 ['ALIGN FLASH','ISDU 03','CDU IRS MOTION','عدم تولید NAV معتبر']),
item('stored-position','ALIGN','Stored PPOS mismatch — 12','تفاوت موقعیت ذخیره و موقعیت جدید',qr.align,'CORE',
 ['مقایسه داخلی Stored Position را در تست ناموفق کنید','موقعیت را وارد کنید؛ کد 12 ظاهر شود','موقعیت تأییدشده را دوباره وارد کنید'],
 ['ALIGN FLASH','ISDU 12','ورود دوم همان PPOS مشکل نخست را برطرف می‌کند']),
item('computed-position','ALIGN','Unreasonable latitude — 04','شکست آزمون Latitude داخلی',qr.align,'CORE',
 ['آزمون داخلی Latitude را ناموفق کنید','کد 04 را پس از ورود موقعیت بررسی کنید','مقایسه را تصحیح و موقعیت معتبر وارد کنید'],
 ['ALIGN FLASH','ISDU 04','FAULT هنوز روشن نیست']),
item('computed-twice','ALIGN','Position check repeated → FAULT','شکست دوباره آزمون داخلی موقعیت',qr.fault,'CORE',
 ['یک موقعیت نامعتبر را دو بار در آزمون داخلی وارد کنید','FAULT روشن می‌شود','برای بازیابی، چرخه OFF و Full Alignment بررسی شود'],
 ['ISDU 04','FAULT ON','NAV INVALID','بازیابی با OFF']),
item('verify-origin','ALIGN','VERIFY POSITION (>4 NM)','هشدار FMC، نه خرابی IRS',qr.normal,'CORE',
 ['موقعیت ورودی را بیش از ۴NM از ORIGIN انتخاب کنید','هشدار VERIFY POSITION را ببینید','توجه کنید FAULT و کدهای 04/12 نباید ایجاد شوند'],
 ['CDU VERIFY POSITION','FAULT OFF','عدم تولید کد 04/12']),
item('invalid-format','ALIGN','Invalid latitude/longitude','آزمون فرمت ورودی کیپد/ISDU و CDU',qr.normal,'CORE',
 ['موقعیت با دقیقه نامعتبر وارد کنید','ورودی باید رد شود','نمایشگر موقعیت نباید معتبر شود'],
 ['INVALID COORDINATE','بدون اطلاعات NAV جعلی']),
item('high-lat-mode','ALIGN','High latitude wrong selector','OFF → NAV در 71°N (الزام ALIGN)',qr.normal,'CORE',
 ['در 71°N مستقیم NAV را انتخاب کنید','سیستم باید اشتباه حالت را شناسایی کند','برای شروع صحیح به OFF و سپس ALIGN برگردید'],
 ['HIGH LAT MODE REQUIRED','NAV INVALID']),
item('high-lat-correct','ALIGN','High latitude 17 min','71°N با حالت ALIGN',qr.normal,'CORE',
 ['از OFF به ALIGN در 71°N بروید','۱۷ دقیقه ثابت بمانید','سپس NAV را انتخاب کنید'],
 ['ALIGN HOLD','17 MIN','NAV دستی پس از پایان']),
item('fast-realign','ALIGN','Fast realignment','NAV → ALIGN، بروزرسانی موقعیت، ۳۰ ثانیه',qr.normal,'CORE',
 ['با NAV معتبر، ALIGN را انتخاب کنید','موقعیت را دوباره تأیید کنید','پس از ۳۰ ثانیه NAV را انتخاب کنید'],
 ['FAST REALIGN 30s','NAV INVALID هنگام تست']),
item('off-shutdown','ALIGN','OFF / 30s shutdown','چراغ ALIGN در چرخه خاموشی',qr.normal,'CORE',
 ['با IRS روشن، OFF را انتخاب کنید','چراغ ALIGN باید در چرخه SHUTDOWN روشن بماند','پس از حدود ۳۰ ثانیه OFF کامل بررسی شود'],
 ['SHUTDOWN 30s','NAV INVALID','ALIGN OFF پس از خاموشی']),
item('on-dc-left','POWER','L IRS ON DC','از دست‌رفتن AC STANDBY با DC سالم',qr.ondc,'CORE',
 ['AC STANDBY را قطع کنید','ON DC چپ روشن شود','تداوم عملکرد تا وقتی DC سالم باشد بررسی شود'],
 ['L ON DC ON','L NAV VALID','R normal']),
item('on-dc-right','POWER','R IRS ON DC','AC TRANSFER 2 از دست می‌رود',qr.ondc,'CORE',
 ['AC TRANSFER 2 را قطع کنید','ON DC راست روشن شود','محدودیت پنج دقیقه‌ای را بررسی کنید'],
 ['R ON DC ON','R DC backup','R cutoff at 300s']),
item('right-300','POWER','R IRS — 5-minute cutoff','پایان ۳۰۰ ثانیه برق پشتیبان راست',qr.ondc,'CORE',
 ['AC TRANSFER 2 را قطع کنید','۳۰۰ ثانیه در حالت DC جلو بروید','NAV راست از دست می‌رود و Alignment معتبر نیست'],
 ['R POWER LOST','L UNCHANGED','R NAV INVALID']),
item('dual-on-dc','POWER','Both IRS ON DC','هر دو منبع AC قطع، DC مشترک سالم',qr.ondc,'CORE',
 ['هر دو AC را قطع کنید','هر دو IRS از DC تغذیه شوند','پس از ۵ دقیقه، فقط R به محدودیت می‌رسد'],
 ['L ON DC','R ON DC','R five-minute limit']),
item('dc-fail-left','POWER','Single DC FAIL — L','خرابی شاخه DC پشتیبان چپ با AC سالم',qr.dc,'INJECTED',
 ['خرابی شاخه DC چپ را تزریق کنید','چراغ DC FAIL چپ روشن شود','IRS چپ همچنان روی AC معتبر است'],
 ['L DC FAIL','L NAV VALID','QRH 11.5 single case']),
item('dc-fail-right','POWER','Single DC FAIL — R','خرابی شاخه DC پشتیبان راست با AC سالم',qr.dc,'INJECTED',
 ['خرابی شاخه DC راست را تزریق کنید','چراغ DC FAIL راست روشن شود','IRS راست همچنان روی AC معتبر است'],
 ['R DC FAIL','R NAV VALID']),
item('dc-fail-dual','POWER','Dual DC FAIL','اختلال مشترک Switched Hot Battery',qr.dc,'CORE',
 ['SWITCHED HOT BATTERY BUS را قطع کنید','DC FAIL هر دو IRS را بررسی کنید','با AC سالم، هر دو NAV همچنان معتبر می‌مانند'],
 ['L/R DC FAIL','L/R AC VALID','بررسی تأمین DC مشترک']),
item('power-loss-left','POWER','Complete L power loss','قطع AC و DC موردنیاز IRS چپ',qr.mrg,'CORE',
 ['AC STANDBY و DC را از دسترس خارج کنید','IRS چپ NAV را از دست بدهد','IRS راست مستقل کار کند'],
 ['L POWER LOST','L NAV INVALID','R NAV VALID']),
item('power-restore','POWER','Restore AC / full alignment','بازگشت برق پس از از دست‌رفتن مرجع IRS',qr.normal,'CORE',
 ['قطع کامل برق IRS را ایجاد کنید','AC را برگردانید','سلف‌تست و Full Alignment از ابتدا الزامی شود'],
 ['SELFTEST','NO STALE NAV','NEW POSITION REQUIRED']),
item('fault-ground','QRH','IRS FAULT on ground','QRH 11.6–11.7 · FAULT + ALIGN و مسیر بازیابی',qr.fault,'CORE',
 ['FAULT + ALIGN را روی زمین بررسی کنید','حالت OFF تا پایان خاموش‌شدن','شروع مجدد با NAV و ورود موقعیت','ماندن FAULT: عدم تکمیل سناریوی اعزام'],
 ['FAULT ON','ALIGN FLASH','بازیابی یا توقف پرواز']),
item('fault-flight','QRH','IRS FAULT in flight','QRH 11.8–11.9 · از دست‌رفتن مرجع و ATT',qr.fault,'INJECTED',
 ['خرابی یک IRU را در پرواز تزریق کنید','خروجی NAV آن نامعتبر شود','گزینه ATT و جایگزینی منبع را در تمرین بررسی کنید'],
 ['FAULT ON','NAV INVALID','ATT فقط در صورت موفقیت بازیابی']),
item('att-relevel','QRH','ATT relevel 30 sec','شرایط پرواز مستقیم/هم‌سطح و ورود Heading',qr.fault,'INJECTED',
 ['IRU معیوب را به ATT منتقل کنید','۳۰ ثانیه شرایط پرواز یکنواخت را حفظ کنید','Magnetic heading را وارد کنید'],
 ['ATT RECOVERY','30s STRAIGHT/LEVEL','HEADING ENTRY']),
item('fault-both','QRH','Both IRS fault / transfer','تمرین منبع جایگزین و عدم قابلیت ناوبری',qr.fault,'INJECTED',
 ['دو خرابی IRU را اعمال کنید','NAV هر دو منبع نامعتبر شود','محدودیت و انتقال IRS در QRH را بررسی کنید'],
 ['DUAL FAULT','NO VALID IRS NAV','IRS TRANSFER TRAINING']),
item('unverified-cb','CB','Candidate IRS CB — unverified','جایگاه‌های IRS در P18-2 / P6-1 فاقد نگاشت WDM تأییدشده‌اند',qr.mrg,'INJECTED',
 ['یک CB کاندیدا را برای تست انتخاب کنید','وضعیت NOT VERIFIED نشان داده شود','بدون سند، قطع برق واقعی IRS را به این CB نسبت ندهید'],
 ['CB ROUTE UNVERIFIED','NO FALSE POWER DISCONNECT'])
]);
const groups=Object.freeze([
{id:'ALIGN',title:'Alignment / Position',subtitle:'11 سناریو + راه‌اندازی'},
{id:'POWER',title:'Electrical / Backup',subtitle:'9 سناریو'},
{id:'QRH',title:'Non-normal / QRH',subtitle:'4 سناریو'},
{id:'CB',title:'Circuit breakers',subtitle:'مدارهای تأییدنشده'}
]);
const byId=id=>all.find(x=>x.id===id)||null;
return Object.freeze({all,groups,byId,sourceEdition:'QRH-300500.pdf · D6-27370-3/500-SEP · 2016; MRG IV.11 pp.298-300'});
});

# Blast Rush Arena V5 — Client + Server ב־Deno

גרסה מקצועית ראשונית של Blast Rush למחשב, עם משחק Solo מתקדם, אתגר חבר באמצעות קישור ודו־קרב 1v1 בזמן אמת.

## מה נוסף בגרסה 5

- ארבעה עולמות: Nebula Forge, Crystal Rift, Solar Temple ו־Void Cathedral.
- לכל עולם צבעים, מהירות, הרכב אויבים ובוס משלו.
- משימת גל משתנה: PERFECT, שרשרת, קומבו, הישרדות או השמדת יעד.
- Mutator אקראי בכל גל: מהירות, שריון, פצצות, דיוק או Shard Rain.
- מערכת Augments בסגנון roguelite.
- בוסים עם שלושה שלבים וקצב התקפה שעולה ככל שהחיים שלהם יורדים.
- Quick Match ל־1v1.
- חדר פרטי וקישור הזמנה לחבר.
- שני השחקנים מקבלים Seed זהה ורצף קושי זהה.
- Pressure Attacks: Gravity Surge, EMP Veil, Time Fracture ו־Void Swarm.
- Rematch מיידי.
- אתגר אסינכרוני: משתפים תוצאת Solo, והחבר משחק עם אותו Seed גם בזמן אחר.
- Leaderboard הנשמר ב־Deno KV.
- PWA בסיסי ו־Web Share API עם fallback להעתקת קישור.
- Comfort FX, מוזיקה אדפטיבית, מסך מלא ושמירת התקדמות מקומית.

## הפעלה ב־Windows

### 1. התקנת Deno פעם אחת

פתח PowerShell והרץ:

```powershell
irm https://deno.land/install.ps1 | iex
```

סגור את PowerShell ופתח חלון חדש. בדוק:

```powershell
deno --version
```

### 2. הפעלת המשחק

לחץ פעמיים על:

```text
PLAY_WINDOWS.bat
```

השרת יעלה ב־`http://localhost:8000` והמשחק ייפתח בדפדפן.

למצב פיתוח עם טעינה מחדש אוטומטית השתמש ב־`PLAY_WINDOWS_DEV.bat`.

## משחק מול חבר

### על אותו מחשב או באותה רשת ביתית

1. הפעל את השרת.
2. בחר `CHALLENGE A FRIEND`.
3. שלח לחבר את קוד החדר.
4. אם החבר באותה רשת, החלף בקישור את `localhost` בכתובת ה־IP המקומית של המחשב שמריץ את השרת, לדוגמה:

```text
http://192.168.1.50:8000/?room=ABCDE
```

ייתכן ש־Windows Firewall יבקש אישור גישה ל־Deno.

### דרך האינטרנט

צריך לפרוס את התיקייה לשרת ציבורי. אפשר להריץ את Deno בתוך Docker, על VPS, או לפרוס דרך Deno Deploy. לאחר פריסה, קישורי החדר והאתגר ישתמשו אוטומטית בדומיין הציבורי.

## שליטה

- עכבר: פגיעה בליבות.
- `Space`: Overdrive.
- `B`: Reactor Blast.
- `Q`: Pressure Attack בדו־קרב.
- `P`: Pause ב־Solo.
- `F`: מסך מלא.

## פקודות פיתוח

```bash
deno task dev
deno task start
deno task check
deno task test
deno task fmt
```

## מגבלות ידועות של גרסה זו

זוהי גרסת Alpha מקצועית, לא Backend של משחק מסחרי בקנה מידה עולמי. שרת המשחק מאמת סדר אירועים, קצב הודעות ומגבלות ניקוד, אך אינו מריץ עדיין סימולציה מלאה וסמכותית של כל אובייקט. חדרים חיים נשמרים בזיכרון של instance יחיד. לפני השקה רחבה מומלץ להוסיף authentication, telemetry, moderation, replay validation, rate limiting חיצוני ו־Redis/NATS או שירות חדרים משותף בין instances.

## פריסה ציבורית ב־Deno Deploy

כדי שקישור הזמנה יעבוד מול חבר דרך האינטרנט, הרץ מתוך תיקיית הפרויקט:

```bash
deno deploy
```

בחר אפליקציה דינמית. הקובץ `deno.json` כבר מגדיר את `server/main.ts` כ־entrypoint. בפריסה ישירה ל־production אפשר להשתמש ב־`deno deploy --prod` לאחר יצירת האפליקציה.

אם המשחק נשאר כתת־תיקייה בתוך ריפו אחר, הדרך הפשוטה היא להריץ את הפקודה מתוך `blast-rush-arena` או להגדיר את התיקייה כ־app directory ב־Deno Deploy CLI.

## עמידות חיבור

בדו־קרב חי, ניתוק זמני אינו מסיים מיד את המשחק. השרת שומר את החדר, ה־Seed, הניקוד וה־Pressure למשך 10 שניות ומאפשר לשחקן לחזור לאותה ריצה. לאחר תום חלון החסד היריב מקבל ניצחון עקב ניתוק.

## מבנה ה־Client

מנוע המשחק נשמר במקטעים תחת `client/game-src/`. הפקודות `deno task start`, `deno task dev` ו־Deno Deploy מריצות אוטומטית את `scripts/build_client.ts` ומייצרות את `client/game.js` ללא npm וללא תלות חיצונית.

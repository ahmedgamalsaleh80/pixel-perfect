# منصة المهندس أحمد جمال

منصة تعليمية عربية لكورسات البرمجة والذكاء الاصطناعي — نفهم قبل ما نبرمج يا هندسة.

Built with [Lovable](https://lovable.dev) — every change in the Lovable editor syncs to this repository.

## التطوير محليًا

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## تعيين أول أدمن

1. سجّل حسابك من صفحة إنشاء حساب في المنصة وأكّد بريدك الإلكتروني.
2. من لوحة Lovable Cloud (قاعدة البيانات)، نفّذ:

```sql
select public.grant_admin_by_email('your-email@example.com');
```

3. سجّل دخولك من جديد — هتلاقي "لوحة الأدمن" في القائمة العلوية على `/admin`.

## النشر على Cloudflare Pages

المشروع مبني بـ TanStack Start (Vite 7) وبيستهدف Cloudflare Workers/Pages.

1. ادفع الكود لـ GitHub (متزامن تلقائيًا من Lovable).
2. في لوحة Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** واختار الريبو.
3. إعدادات البناء:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. أضف متغيرات البيئة في **Settings → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

   (القيم موجودة في ملف `.env` المحلي أو من إعدادات Lovable Cloud.)
5. Deploy — كل push لـ `main` هيعمل نشر تلقائي.

> ملاحظة: النشر الأساسي المدعوم هو زرار **Publish** داخل Lovable. نشر Cloudflare اختياري وبيحتاج إدارة متغيرات البيئة بنفسك.

## بنية المشروع

- `src/routes/` — الصفحات (TanStack Router)
- `src/routes/_authenticated/` — صفحات تتطلب تسجيل دخول (لوحة الطالب، الكورسات، الدروس، الأدمن)
- `src/lib/` — منطق المصادقة والكورسات وروابط Google Drive
- `drizzle/migrations/` — migrations قاعدة البيانات

import { useEffect, useState } from "react";
import { Download, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.classList.contains("light")), []);
  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try { localStorage.setItem("theme", next ? "light" : "dark"); } catch {}
  };
  return (
    <button onClick={toggle} aria-label={light ? "الوضع الداكن" : "الوضع الفاتح"} title={light ? "الوضع الداكن" : "الوضع الفاتح"}
      className="inline-flex size-9 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent">
      {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

export function InstallButton() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const h = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const done = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", h); window.removeEventListener("appinstalled", done); };
  }, []);
  if (installed) return null;
  const click = async () => {
    if (evt) { await evt.prompt(); await evt.userChoice; setEvt(null); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(ios
      ? "على الآيفون: اضغط زرار المشاركة في Safari واختار «إضافة إلى الشاشة الرئيسية»"
      : "من قائمة المتصفح (⋮) اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». الخيار ده بيشتغل على الموقع المنشور.");
  };
  return (
    <button onClick={click} title="تثبيت المنصة على جهازك"
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent">
      <Download className="size-4" /><span className="hidden sm:inline">تثبيت</span>
    </button>
  );
}

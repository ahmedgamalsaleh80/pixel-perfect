import { useRef, useState } from "react";
import { FolderOpen, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Lang = "python" | "javascript" | "html" | "css";
const LANGS: { id: Lang; label: string; ext: string; sample: string }[] = [
  { id: "python", label: "Python", ext: "py", sample: 'name = "أحمد"\nprint("أهلاً يا", name)\nfor i in range(3):\n    print(i)' },
  { id: "javascript", label: "JavaScript", ext: "js", sample: 'const nums = [1, 2, 3];\nconsole.log("المجموع:", nums.reduce((a, b) => a + b, 0));' },
  { id: "html", label: "HTML", ext: "html", sample: "<h1>أول صفحة ليا</h1>\n<p>مرحباً بالعالم</p>" },
  { id: "css", label: "CSS", ext: "css", sample: "body { font-family: sans-serif; background: #0f172a; color: #e2e8f0; }\nh1 { color: #38bdf8; }" },
];
const EXT_TO_LANG: Record<string, Lang> = { py: "python", js: "javascript", mjs: "javascript", html: "html", htm: "html", css: "css" };

function runnerDoc(lang: Lang, code: string) {
  const safe = JSON.stringify(code).replace(/</g, "\\u003c");
  const bridge = `<script>const send=(t,k)=>parent.postMessage({__runner:1,t:String(t),k},"*");</script>`;
  if (lang === "javascript")
    return `${bridge}<script>console.log=(...a)=>send(a.map(x=>typeof x==="object"?JSON.stringify(x):x).join(" "),"out");console.error=(...a)=>send(a.join(" "),"err");try{new Function(${safe})()}catch(e){send(e,"err")}send("","done")</script>`;
  if (lang === "python")
    return `${bridge}<script src="https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"></script><script>(async()=>{try{send("جاري تحميل بايثون...","info");const py=await loadPyodide({stdout:t=>send(t,"out"),stderr:t=>send(t,"err")});send("","clear");await py.runPythonAsync(${safe})}catch(e){send(e.message||e,"err")}send("","done")})()</script>`;
  return "";
}

export function CodeEditor({ compact = false }: { compact?: boolean }) {
  const [lang, setLang] = useState<Lang>("python");
  const [code, setCode] = useState(LANGS[0]!.sample);
  const [name, setName] = useState("my-code");
  const [output, setOutput] = useState<{ t: string; k: string }[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [doc, setDoc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const meta = LANGS.find((l) => l.id === lang)!;

  function onMessage(e: MessageEvent) {
    const d = e.data;
    if (!d || d.__runner !== 1) return;
    if (d.k === "clear") return setOutput([]);
    if (d.k === "done") return;
    setOutput((o) => [...o, { t: d.t, k: d.k }]);
  }

  function run() {
    setOutput([]);
    if (lang === "html" || lang === "css") {
      setDoc(null);
      setPreview(lang === "html" ? code : `<style>${code}</style><h1>عنوان تجريبي</h1><p>فقرة لتجربة التنسيق</p><button>زرار</button>`);
      return;
    }
    setPreview(null);
    window.removeEventListener("message", onMessage);
    window.addEventListener("message", onMessage);
    setDoc(runnerDoc(lang, code));
    setRunKey((k) => k + 1);
  }

  function save() {
    const base = name.trim().replace(/[\\/:*?"<>|]/g, "") || "my-code";
    const file = base.includes(".") ? base : `${base}.${meta.ext}`;
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = file; a.click();
    URL.revokeObjectURL(url);
    toast.success(`تم حفظ ${file} على جهازك`);
  }

  async function open(f: File | undefined) {
    if (!f) return;
    if (f.size > 1_000_000) return void toast.error("الملف كبير جداً");
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (EXT_TO_LANG[ext]) setLang(EXT_TO_LANG[ext]);
    setCode(await f.text());
    setName(f.name.replace(/\.[^.]+$/, ""));
    setOutput([]); setPreview(null);
    toast.success(`تم فتح ${f.name}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card-gradient">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
        <div className="flex flex-wrap gap-1">
          {LANGS.map((l) => (
            <Button key={l.id} size="sm" variant={lang === l.id ? "default" : "ghost"} onClick={() => { setLang(l.id); setCode(l.sample); setOutput([]); setPreview(null); }}>{l.label}</Button>
          ))}
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Input aria-label="اسم الملف" dir="ltr" value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-36" placeholder="اسم الملف" />
          <Button size="sm" variant="outline" onClick={save}><Save className="size-4" />حفظ</Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FolderOpen className="size-4" />فتح ملف</Button>
          <input ref={fileRef} type="file" accept=".py,.js,.mjs,.html,.htm,.css,.txt" className="hidden" onChange={(e) => open(e.target.files?.[0])} />
          <Button size="sm" onClick={run}><Play className="size-4" />تشغيل</Button>
        </div>
      </div>
      <div className={`grid ${compact ? "" : "lg:grid-cols-2"}`}>
        <textarea
          dir="ltr" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const t = e.currentTarget, s = t.selectionStart;
              setCode(code.slice(0, s) + "    " + code.slice(t.selectionEnd));
              requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 4; });
            }
          }}
          aria-label="محرر الكود"
          className="min-h-80 w-full resize-y bg-background/60 p-4 font-mono text-sm leading-relaxed text-foreground outline-none"
        />
        <div className="min-h-48 border-t border-border/60 lg:border-s lg:border-t-0">
          {preview !== null ? (
            <iframe title="المعاينة" sandbox="" srcDoc={preview} className="h-full min-h-80 w-full bg-background" />
          ) : (
            <pre dir="ltr" className="h-full min-h-48 overflow-auto p-4 font-mono text-sm">
              {output.length === 0 && <span className="text-muted-foreground">اضغط "تشغيل" وهتظهر النتيجة هنا</span>}
              {output.map((o, i) => <div key={i} className={o.k === "err" ? "text-destructive" : o.k === "info" ? "text-muted-foreground" : ""}>{o.t}</div>)}
            </pre>
          )}
          {doc && <iframe key={runKey} title="runner" sandbox="allow-scripts" srcDoc={doc} className="hidden" />}
        </div>
      </div>
    </div>
  );
}

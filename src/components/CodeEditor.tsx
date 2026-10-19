
import { useEffect, useRef, useState } from "react";
import { FolderOpen, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Lang = "python" | "javascript" | "html" | "css";

type OutputItem = {
  t: string;
  k: string;
};

const LANGS: {
  id: Lang;
  label: string;
  ext: string;
  sample: string;
}[] = [
  {
    id: "python",
    label: "Python",
    ext: "py",
    sample:
      'name = "أحمد"\nprint("أهلاً يا", name)\nfor i in range(3):\n    print(i)',
  },
  {
    id: "javascript",
    label: "JavaScript",
    ext: "js",
    sample:
      'const nums = [1, 2, 3];\nconsole.log("المجموع:", nums.reduce((a, b) => a + b, 0));',
  },
  {
    id: "html",
    label: "HTML",
    ext: "html",
    sample: "<h1>أول صفحة ليا</h1>\n<p>مرحباً بالعالم</p>",
  },
  {
    id: "css",
    label: "CSS",
    ext: "css",
    sample:
      "body { font-family: sans-serif; background: #0f172a; color: #e2e8f0; }\nh1 { color: #38bdf8; }",
  },
];

const EXT_TO_LANG: Record<string, Lang> = {
  py: "python",
  js: "javascript",
  mjs: "javascript",
  html: "html",
  htm: "html",
  css: "css",
};

function runnerDoc(lang: Lang, code: string) {
  const safeCode = JSON.stringify(code).replace(/</g, "\\u003c");

  const bridge = `
    <script>
      function send(t, k) {
        parent.postMessage({
          __runner: true,
          t: String(t ?? ""),
          k: k
        }, "*");
      }

      window.addEventListener("error", function(event) {
        send(event.message || "حدث خطأ أثناء التشغيل", "err");
      });
    </script>
  `;

  if (lang === "javascript") {
    return `<!doctype html>
      <html>
        <head><meta charset="utf-8"></head>
        <body>
          ${bridge}
          <script>
            const originalLog = console.log;
            const originalError = console.error;

            console.log = (...args) => {
              send(args.map(value => {
                if (typeof value === "object" && value !== null) {
                  try {
                    return JSON.stringify(value);
                  } catch {
                    return String(value);
                  }
                }
                return String(value);
              }).join(" "), "out");
            };

            console.error = (...args) => {
              send(args.map(String).join(" "), "err");
            };

            try {
              new Function(${safeCode})();
            } catch (error) {
              send(error?.stack || error?.message || String(error), "err");
            } finally {
              console.log = originalLog;
              console.error = originalError;
              send("", "done");
            }
          </script>
        </body>
      </html>`;
  }

  if (lang === "python") {
    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body>
          ${bridge}
          <script type="module">
            (async function() {
              try {
                send("جاري تحميل مكتبة Python...", "info");

                const pyodideUrl =
                  "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.mjs";

                const pyodideModule = await import(pyodideUrl);

                if (typeof pyodideModule.loadPyodide !== "function") {
                  throw new Error(
                    "دالة loadPyodide غير موجودة في المكتبة المحمّلة."
                  );
                }

                const py = await pyodideModule.loadPyodide({
                  stdout: function(text) {
                    send(text, "out");
                  },
                  stderr: function(text) {
                    send(text, "err");
                  }
                });

                send("", "clear");
                await py.runPythonAsync(${safeCode});
              } catch (error) {
                send(
                  error?.stack || error?.message || String(error),
                  "err"
                );
              } finally {
                send("", "done");
              }
            })();
          </script>
        </body>
      </html>`;
  }

  return "";
}

export function CodeEditor({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [lang, setLang] = useState<Lang>("python");
  const [code, setCode] = useState(LANGS[0]!.sample);
  const [name, setName] = useState("my-code");
  const [output, setOutput] = useState<OutputItem[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const runnerRef = useRef<HTMLIFrameElement>(null);
  const meta = LANGS.find((item) => item.id === lang)!;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = runnerRef.current;

      if (!frame || event.source !== frame.contentWindow) {
        return;
      }

      const data = event.data;

      if (!data || data.__runner !== true) {
        return;
      }

      if (data.k === "clear") {
        setOutput([]);
        return;
      }

      if (data.k === "done") {
        return;
      }

      setOutput((current) => [
        ...current,
        {
          t: String(data.t ?? ""),
          k: String(data.k ?? "out"),
        },
      ]);
    }

    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  function run() {
    setOutput([]);
    setPreview(null);
    setDoc(null);

    if (lang === "html") {
      setPreview(code);
      return;
    }

    if (lang === "css") {
      setPreview(`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>${code}</style>
          </head>
          <body>
            <h1>عنوان تجريبي</h1>
            <p>فقرة لتجربة التنسيق</p>
            <button>زرار</button>
          </body>
        </html>`);
      return;
    }

    setRunKey((current) => current + 1);
    setDoc(runnerDoc(lang, code));
  }

  function save() {
    const base =
      name.trim().replace(/[\\/:*?"<>|]/g, "") || "my-code";

    const fileName = base.includes(".")
      ? base
      : `${base}.${meta.ext}`;

    const url = URL.createObjectURL(
      new Blob([code], {
        type: "text/plain;charset=utf-8",
      })
    );

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    toast.success(`تم حفظ ${fileName} على جهازك`);
  }

  async function open(file: File | undefined) {
    if (!file) return;

    if (file.size > 1_000_000) {
      toast.error("الملف كبير جداً");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

    try {
      const content = await file.text();

      if (EXT_TO_LANG[extension]) {
        setLang(EXT_TO_LANG[extension]!);
      }

      setCode(content);
      setName(file.name.replace(/\.[^.]+$/, ""));
      setOutput([]);
      setPreview(null);
      setDoc(null);

      toast.success(`تم فتح ${file.name}`);
    } catch {
      toast.error("تعذر فتح الملف");
    } finally {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  function changeLanguage(nextLang: Lang) {
    const next = LANGS.find((item) => item.id === nextLang)!;

    setLang(nextLang);
    setCode(next.sample);
    setOutput([]);
    setPreview(null);
    setDoc(null);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card-gradient">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
        <div className="flex flex-wrap gap-1">
          {LANGS.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={lang === item.id ? "default" : "ghost"}
              onClick={() => changeLanguage(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Input
            aria-label="اسم الملف"
            dir="ltr"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 w-36"
            placeholder="اسم الملف"
          />

          <Button size="sm" variant="outline" onClick={save}>
            <Save className="size-4" />
            حفظ
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            <FolderOpen className="size-4" />
            فتح ملف
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept=".py,.js,.mjs,.html,.htm,.css,.txt"
            className="hidden"
            onChange={(event) => open(event.target.files?.[0])}
          />

          <Button size="sm" onClick={run}>
            <Play className="size-4" />
            تشغيل
          </Button>
        </div>
      </div>

      <div className={`grid ${compact ? "" : "lg:grid-cols-2"}`}>
        <textarea
          dir="ltr"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();

              const textarea = event.currentTarget;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;

              setCode(
                code.slice(0, start) + "    " + code.slice(end)
              );

              requestAnimationFrame(() => {
                textarea.selectionStart =
                  textarea.selectionEnd = start + 4;
              });
            }
          }}
          aria-label="محرر الكود"
          className="min-h-80 w-full resize-y bg-background/60 p-4 font-mono text-sm leading-relaxed text-foreground outline-none"
        />

        <div className="min-h-48 border-t border-border/60 lg:border-s lg:border-t-0">
          {preview !== null ? (
            <iframe
              title="المعاينة"
              sandbox=""
              srcDoc={preview}
              className="h-full min-h-80 w-full bg-background"
            />
          ) : (
            <pre
              dir="ltr"
              className="h-full min-h-48 overflow-auto p-4 font-mono text-sm"
            >
              {output.length === 0 && (
                <span className="text-muted-foreground">
                  اضغط "تشغيل" وهتظهر النتيجة هنا
                </span>
              )}

              {output.map((item, index) => (
                <div
                  key={index}
                  className={
                    item.k === "err"
                      ? "text-destructive"
                      : item.k === "info"
                        ? "text-muted-foreground"
                        : ""
                  }
                >
                  {item.t}
                </div>
              ))}
            </pre>
          )}

          {doc !== null && (
            <iframe
              key={runKey}
              ref={runnerRef}
              title="runner"
              sandbox="allow-scripts"
              srcDoc={doc}
              className="hidden"
            />
          )}
        </div>
      </div>
    </div>
  );
}

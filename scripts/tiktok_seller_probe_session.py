import argparse
import json
import os
import re
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from playwright.sync_api import BrowserContext, Error, Page, sync_playwright


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def safe_slug(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return normalized or "page"


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class JsonlWriter:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.fp = self.path.open("a", encoding="utf-8")

    def write(self, event: Dict[str, Any]) -> None:
        payload = {"at": now_iso(), **event}
        self.fp.write(json.dumps(payload, ensure_ascii=False) + "\n")
        self.fp.flush()

    def close(self) -> None:
        try:
            self.fp.close()
        except Exception:
            pass


def mask_value(raw: Any, max_len: int = 240) -> str:
    if raw is None:
        return ""
    text = str(raw)
    if len(text) > max_len:
        return text[: max_len - 3] + "..."
    return text


def build_dom_probe_script() -> str:
    return r"""
(() => {
  if (window.__buglogin_probe_ready__) return;
  window.__buglogin_probe_ready__ = true;

  const safeText = (value, maxLen = 240) => {
    if (value == null) return "";
    const text = String(value);
    return text.length > maxLen ? text.slice(0, maxLen - 3) + "..." : text;
  };

  const targetMeta = (target) => {
    if (!target || !(target instanceof Element)) return {};
    const id = target.getAttribute("id") || "";
    const name = target.getAttribute("name") || "";
    const type = target.getAttribute("type") || "";
    const placeholder = target.getAttribute("placeholder") || "";
    const role = target.getAttribute("role") || "";
    const tag = target.tagName ? target.tagName.toLowerCase() : "";
    const text = safeText(target.innerText || target.textContent || "", 180);
    let value = "";
    try { value = safeText(target.value ?? "", 240); } catch (_) {}
    if (type.toLowerCase() === "password") value = "__masked__";
    return { id, name, type, placeholder, role, tag, text, value };
  };

  const emit = (eventType, nativeEvent) => {
    const payload = {
      kind: "dom_event",
      eventType,
      href: location.href,
      title: document.title,
      target: targetMeta(nativeEvent && nativeEvent.target)
    };
    try {
      if (window.bugloginProbeRecord) {
        window.bugloginProbeRecord(payload);
      }
    } catch (_) {}
  };

  ["input", "change", "click", "submit", "blur"].forEach((name) => {
    document.addEventListener(name, (event) => emit(name, event), true);
  });
})();
"""


def attach_page_event_stream(page: Page, events: JsonlWriter) -> None:
    def on_request(request):
        events.write(
            {
                "kind": "request",
                "url": request.url,
                "method": request.method,
                "resourceType": request.resource_type,
            }
        )

    def on_response(response):
        req = response.request
        events.write(
            {
                "kind": "response",
                "url": response.url,
                "status": response.status,
                "method": req.method if req else "",
                "resourceType": req.resource_type if req else "",
            }
        )

    def on_console(msg):
        events.write(
            {
                "kind": "console",
                "level": msg.type,
                "text": mask_value(msg.text, 1000),
            }
        )

    def on_page_error(err):
        events.write({"kind": "pageerror", "message": mask_value(str(err), 1000)})

    def on_nav(frame):
        if frame == page.main_frame:
            events.write({"kind": "navigate", "url": frame.url})

    page.on("request", on_request)
    page.on("response", on_response)
    page.on("console", on_console)
    page.on("pageerror", on_page_error)
    page.on("framenavigated", on_nav)


def capture_page_snapshot(page: Page, out_dir: Path, events: JsonlWriter) -> None:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = safe_slug(page.url or page.title() or "page")
    base = f"{ts}-{slug}"
    html_path = out_dir / "html" / f"{base}.html"
    shot_path = out_dir / "screenshots" / f"{base}.png"
    meta_path = out_dir / "meta" / f"{base}.json"
    html_path.parent.mkdir(parents=True, exist_ok=True)
    shot_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.parent.mkdir(parents=True, exist_ok=True)

    html = page.content()
    html_path.write_text(html, encoding="utf-8")
    page.screenshot(path=str(shot_path), full_page=True)

    meta = {
        "capturedAt": now_iso(),
        "url": page.url,
        "title": page.title(),
        "htmlPath": str(html_path),
        "screenshotPath": str(shot_path),
    }
    write_json(meta_path, meta)
    events.write(
        {
            "kind": "snapshot",
            "url": page.url,
            "title": page.title(),
            "htmlPath": str(html_path),
            "screenshotPath": str(shot_path),
        }
    )


def ensure_probe_injected(context: BrowserContext, events: JsonlWriter) -> None:
    context.add_init_script(build_dom_probe_script())

    def probe_binding(_source, payload):
        if isinstance(payload, dict):
            events.write(payload)

    context.expose_binding("bugloginProbeRecord", probe_binding)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--start-url", required=True)
    parser.add_argument("--browser-type", choices=["firefox", "chromium"], default="firefox")
    parser.add_argument("--executable-path", default="")
    parser.add_argument("--seed-file", default="")
    parser.add_argument("--max-duration-seconds", type=int, default=0)
    parser.add_argument("--snapshot-interval-seconds", type=int, default=8)
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()

    out_dir = Path(args.output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    events = JsonlWriter(out_dir / "events.jsonl")

    seed_data: Dict[str, Any] = {}
    if args.seed_file:
        seed_path = Path(args.seed_file)
        if seed_path.exists():
            try:
                seed_data = json.loads(seed_path.read_text(encoding="utf-8"))
            except Exception:
                seed_data = {}
    write_json(
        out_dir / "session.json",
        {
            "startedAt": now_iso(),
            "startUrl": args.start_url,
            "browserType": args.browser_type,
            "headless": args.headless,
            "executablePath": args.executable_path,
            "maxDurationSeconds": args.max_duration_seconds,
            "seed": seed_data,
        },
    )

    end_at = None
    if args.max_duration_seconds and args.max_duration_seconds > 0:
        end_at = time.time() + args.max_duration_seconds

    events.write(
        {
            "kind": "session_start",
            "startUrl": args.start_url,
            "browserType": args.browser_type,
            "headless": args.headless,
        }
    )

    playwright_ctx = None
    browser = None
    context = None
    try:
        playwright_ctx = sync_playwright().start()
        launch_kwargs: Dict[str, Any] = {"headless": args.headless}
        if args.executable_path.strip():
            launch_kwargs["executable_path"] = args.executable_path.strip()

        if args.browser_type == "chromium":
            browser = playwright_ctx.chromium.launch(**launch_kwargs)
        else:
            browser = playwright_ctx.firefox.launch(**launch_kwargs)

        context = browser.new_context(
            viewport={"width": 1440, "height": 920},
            locale="en-US",
            timezone_id="America/New_York",
        )
        ensure_probe_injected(context, events)

        page = context.new_page()
        attach_page_event_stream(page, events)
        page.goto(args.start_url, wait_until="domcontentloaded", timeout=120000)
        events.write({"kind": "first_page_ready", "url": page.url, "title": page.title()})
        capture_page_snapshot(page, out_dir, events)

        last_snapshot = time.time()
        while True:
            if end_at is not None and time.time() >= end_at:
                events.write({"kind": "session_timeout"})
                break

            # Stop when browser/window closed by operator.
            pages = context.pages
            if len(pages) == 0:
                events.write({"kind": "no_open_pages"})
                break

            now = time.time()
            if now - last_snapshot >= max(2, args.snapshot_interval_seconds):
                for open_page in list(pages):
                    try:
                        if open_page.is_closed():
                            continue
                        attach_page_event_stream(open_page, events)
                        capture_page_snapshot(open_page, out_dir, events)
                    except Error as page_error:
                        events.write({"kind": "snapshot_error", "error": mask_value(str(page_error), 600)})
                last_snapshot = now

            time.sleep(1.0)

        events.write({"kind": "session_end"})
        return 0
    except KeyboardInterrupt:
        events.write({"kind": "keyboard_interrupt"})
        return 130
    except Exception as exc:
        events.write(
            {
                "kind": "session_error",
                "error": mask_value(str(exc), 1000),
                "traceback": mask_value(traceback.format_exc(), 4000),
            }
        )
        return 1
    finally:
        try:
            if context is not None:
                context.close()
        except Exception:
            pass
        try:
            if browser is not None:
                browser.close()
        except Exception:
            pass
        try:
            if playwright_ctx is not None:
                playwright_ctx.stop()
        except Exception:
            pass
        events.close()


if __name__ == "__main__":
    sys.exit(main())

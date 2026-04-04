"use client";

import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { Logo } from "./icons/logo";

type Platform = "macos" | "windows" | "linux";

function detectPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("mac")) return "macos";
  if (userAgent.includes("win")) return "windows";
  return "linux";
}

export function WindowDragArea() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDesktopShell, setIsDesktopShell] = useState(false);

  useEffect(() => {
    const applyWindowMetrics = (nextPlatform: Platform | null) => {
      const titlebarHeight =
        nextPlatform === "windows" || nextPlatform === "macos" ? "40px" : "0px";
      const controlsWidth = nextPlatform === "windows" ? "144px" : "0px";
      document.documentElement.style.setProperty(
        "--window-titlebar-height",
        titlebarHeight,
      );
      document.documentElement.style.setProperty(
        "--window-controls-width",
        controlsWidth,
      );
    };

    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);
    document.body.dataset.windowPlatform = detectedPlatform;
    applyWindowMetrics(detectedPlatform);

    const desktopShell = isTauri();
    setIsDesktopShell(desktopShell);
    if (!desktopShell) {
      let attempts = 0;
      const retryTimer = window.setInterval(() => {
        attempts += 1;
        if (isTauri()) {
          setIsDesktopShell(true);
          window.clearInterval(retryTimer);
          return;
        }
        if (attempts >= 20) {
          window.clearInterval(retryTimer);
        }
      }, 150);

      return () => {
        window.clearInterval(retryTimer);
        delete document.body.dataset.windowPlatform;
        applyWindowMetrics(null);
      };
    }

    try {
      if (detectedPlatform === "windows") {
        void getCurrentWindow()
          .isMaximized()
          .then(setIsMaximized)
          .catch(() => {
            setIsMaximized(false);
          });
      }

      let unlisten: (() => void) | undefined;
      void getCurrentWindow()
        .onResized(async () => {
          try {
            setIsMaximized(await getCurrentWindow().isMaximized());
          } catch {
            setIsMaximized(false);
          }
        })
        .then((cleanup) => {
          unlisten = cleanup;
        })
        .catch(() => {
          unlisten = undefined;
        });

      return () => {
        unlisten?.();
        delete document.body.dataset.windowPlatform;
        applyWindowMetrics(null);
      };
    } catch {
      delete document.body.dataset.windowPlatform;
      applyWindowMetrics(null);
      return;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    void getCurrentWindow().startDragging().catch(() => {
      // Best effort only.
    });
  };

  // Linux: system decorations handle everything
  if (!isDesktopShell || !platform || platform === "linux") {
    return null;
  }

  // macOS: transparent drag area overlay
  if (platform === "macos") {
    return (
      <button
        type="button"
        className="fixed top-0 right-0 left-0 h-10 bg-transparent border-0 z-[999999] select-none"
        data-window-drag-area="true"
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
    );
  }

  // Windows: custom title bar with drag area + minimize/close buttons
  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch {
      // Best effort only.
    }
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch {
      // Best effort only.
    }
  };

  const handleToggleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch {
      // Best effort only.
    }
  };

  return (
    <div
      className="fixed top-0 right-0 left-0 z-[999999] flex h-10 items-center border-b border-border/60 bg-muted/90 text-foreground shadow-sm select-none backdrop-blur"
      data-window-drag-area="true"
    >
      {/* Draggable area */}
      <button
        type="button"
        className="flex h-full flex-1 items-center gap-2 border-0 bg-transparent px-3 text-left cursor-default"
        onPointerDown={handlePointerDown}
        onDoubleClick={() => {
          void handleToggleMaximize();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Logo
          variant="icon"
          className="h-4 w-4 rounded-[4px] object-cover object-left"
          alt="BugLogin"
        />
        <span className="text-xs font-medium tracking-tight text-foreground/90">
          BugLogin
        </span>
      </button>
      {/* Window control buttons */}
      <div className="flex items-center h-full">
        <button
          type="button"
          onClick={handleMinimize}
          className="flex items-center justify-center w-12 h-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <svg
            width="10"
            height="1"
            viewBox="0 0 10 1"
            fill="currentColor"
            role="img"
            aria-label="Minimize"
          >
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleToggleMaximize}
          className="flex items-center justify-center w-12 h-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            role="img"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <>
                <path d="M3.2 1.8h5v5" />
                <path d="M1.8 3.2h5v5h-5z" />
              </>
            ) : (
              <rect x="1.5" y="1.5" width="7" height="7" />
            )}
          </svg>
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center w-12 h-full hover:bg-destructive/90 transition-colors text-muted-foreground hover:text-destructive-foreground"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            role="img"
            aria-label="Close"
          >
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

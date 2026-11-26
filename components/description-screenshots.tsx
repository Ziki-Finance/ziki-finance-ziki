"use client";

import { useState } from "react";
import { ScreenshotPreview } from "@/components/screenshot-preview";
import { BrokenShot, SafeImg } from "@/components/safe-img";

/**
 * The issue's screenshots at the left of its description (#description-screenshots): the first one large, the others as
 * thumbnails under it. A thumbnail shows that one large; the large one opens in the preview box.
 */
export function DescriptionScreenshots({ screenshots }: { screenshots: string[] }) {
  const [shown, setShown] = useState(0);
  const [opened, setOpened] = useState<number | null>(null);
  if (screenshots.length === 0) return null;
  const shots = screenshots.map((url, index) => ({ url, label: `Screenshot ${index + 1}` }));
  const main = shots[Math.min(shown, shots.length - 1)];
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue";
  return (
    <div aria-label="Screenshots" role="group" className="flex w-full shrink-0 flex-col gap-2 sm:w-60">
      <ScreenshotPreview shots={shots} index={opened} onIndex={setOpened} onClose={() => setOpened(null)} />
      <button
        type="button"
        onClick={() => setOpened(shots.indexOf(main))}
        aria-label={`Preview ${main.label.toLowerCase()}`}
        className={`block w-full cursor-zoom-in overflow-hidden rounded-lg border border-zk-border bg-zk-bg transition hover:border-zk-accent ${focus}`}
      >
        <SafeImg src={main.url} alt={main.label} className="aspect-[4/3] w-full object-cover object-top" fallback={<BrokenShot className="aspect-[4/3]" />} />
      </button>
      {shots.length > 1 ? (
        <div className="grid grid-cols-4 gap-1.5">
          {shots.map((shot, index) => (
            <button
              key={shot.url}
              type="button"
              onClick={() => setShown(index)}
              aria-label={`Show ${shot.label.toLowerCase()}`}
              aria-pressed={shot === main}
              className={`block overflow-hidden rounded-md border bg-zk-bg transition ${shot === main ? "border-electric-blue-strong" : "border-zk-border hover:border-zk-accent"} ${focus}`}
            >
              <SafeImg src={shot.url} alt="" className="aspect-square w-full object-cover object-top" fallback={<BrokenShot className="aspect-square" />} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

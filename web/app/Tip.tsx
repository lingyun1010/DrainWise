"use client";
import { useId, useState } from "react";
import { createPortal } from "react-dom";

// Hover or keyboard-focus hover card, same look as the map marker card (.fr-tip). Use this instead of the browser's
// native title tooltip. Shown under the element, kept inside the window.
export default function Tip({
  tip,
  className,
  style,
  children,
}: {
  tip: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const id = useId();
  const [pos, setPos] = useState<{ x: number; bottom: number } | null>(null);
  const show = (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, bottom: r.bottom });
  };
  const hide = () => setPos(null);
  return (
    <div
      className={className}
      style={style}
      tabIndex={0}
      aria-describedby={pos ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            id={id}
            className="fr-tip"
            style={{
              left: Math.min(Math.max(pos.x, 108), window.innerWidth - 108),
              top: pos.bottom + 6,
              transform: "translate(-50%, 0)",
            }}
          >
            {tip}
          </div>,
          document.body,
        )}
    </div>
  );
}

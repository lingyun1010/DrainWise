"use client";

import { usePathname } from "next/navigation";
import RoomChip from "./RoomChip";

// The Team button at the top right of every page. "/" (Manager header and role screen) and "/crew" place their own.
// "/welcome" is the public landing page for judges: no shared-room button there.
export default function TeamChipFloat() {
  const path = usePathname();
  if (path === "/" || path === "/crew" || path === "/welcome") return null;
  return (
    <div className="fr-teamfloat">
      <RoomChip />
    </div>
  );
}

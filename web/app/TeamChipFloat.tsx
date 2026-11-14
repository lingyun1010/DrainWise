"use client";

import { usePathname } from "next/navigation";
import RoomChip from "./RoomChip";

// The Team button at the top right of every page. "/" (Manager header and role screen) and "/crew" place their own.
export default function TeamChipFloat() {
  const path = usePathname();
  if (path === "/" || path === "/crew") return null;
  return (
    <div className="fr-teamfloat">
      <RoomChip />
    </div>
  );
}

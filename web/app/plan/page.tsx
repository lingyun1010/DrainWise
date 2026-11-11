// Review a run suggestion from a link (ticket 30). Access is by team code, like the shared room.
import { Suspense } from "react";
import PlanClient from "./PlanClient";

export const metadata = { title: "Review run · DrainWise (sample data)" };

export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanClient />
    </Suspense>
  );
}

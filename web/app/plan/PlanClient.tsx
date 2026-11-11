"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cleanRoomCode } from "../../../planner/src/roomCode";
import type { PlanRecord } from "../../../planner/src/planReview";
import { confirmPlanOnServer, loadPlan } from "@/lib/planClient";
import { PlanEditorBody, usePlanEditor } from "../PlanReview";

type Load = { s: "loading" } | { s: "error"; msg: string } | { s: "ready"; plan: PlanRecord };

export default function PlanClient() {
  const params = useSearchParams();
  const team = cleanRoomCode(params.get("team"));
  const id = params.get("id");
  const [load, setLoad] = useState<Load>({ s: "loading" });

  useEffect(() => {
    if (!team || !id) return;
    let live = true;
    void loadPlan(team, id).then((r) => {
      if (live) setLoad(r.ok ? { s: "ready", plan: r.plan } : { s: "error", msg: r.error });
    });
    return () => {
      live = false;
    };
  }, [team, id]);

  const shown: Load = !team || !id ? { s: "error", msg: "This link needs a team code and a plan id." } : load;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      <Link href="/" className="fr-btn fr-ghost">
        Back to Manager
      </Link>
      <h1 style={{ fontSize: 26, margin: "12px 0 4px" }}>Review the run suggestion</h1>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: "#8FB8CC", lineHeight: 1.4 }}>
        Sample data. Access is by team code in the link; production would use real sign-in.
      </p>
      {shown.s === "loading" && <p>Loading the suggestion…</p>}
      {shown.s === "error" && (
        <p role="alert" style={{ color: "#FFB38A" }}>
          {shown.msg}
        </p>
      )}
      {shown.s === "ready" && <Review plan={shown.plan} team={team!} />}
    </main>
  );
}

function Review({ plan, team }: { plan: PlanRecord; team: string }) {
  const router = useRouter();
  const ed = usePlanEditor(plan.proposed, plan.context.capacity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (plan.status === "confirmed") {
    return (
      <>
        <p>This suggestion was already confirmed with {plan.final.length} stops. Nothing more to do here.</p>
        <Link href={`/?team=${team}`} className="fr-btn fr-sec">
          Open the Manager page
        </Link>
      </>
    );
  }

  async function confirm() {
    if (!ed.check.ok) return;
    setBusy(true);
    setError(null);
    const r = await confirmPlanOnServer(plan.id, {
      team,
      source: plan.source,
      status: "confirmed",
      proposed: plan.proposed,
      final: ed.final,
      edits: ed.edits,
      context: plan.context,
    });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    // The Manager page picks the confirmed plan up and opens the crew chooser (capacity rule is checked there too).
    router.push(`/?team=${team}&planTeam=${team}&plan=${plan.id}`);
  }

  return (
    <>
      <p style={{ fontSize: 14, margin: "0 0 10px" }}>
        {plan.context.day} · truck {plan.context.capacity.toFixed(1)} m³ (assumption) · source: {plan.source}
      </p>
      <PlanEditorBody ed={ed} proposed={plan.proposed} capacity={plan.context.capacity} />
      {error && (
        <div role="alert" style={{ marginTop: 8, color: "#FFB38A", fontSize: 14 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="fr-btn fr-pri" type="button" disabled={!ed.check.ok || busy} onClick={confirm}>
          Confirm and choose a crew
        </button>
        <Link href="/" className="fr-btn fr-ghost">
          Cancel
        </Link>
      </div>
    </>
  );
}

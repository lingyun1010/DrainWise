// Local-only photo review page (ticket 13). It is a 404 in the public build only. Locally it works
// without a key too: suggestions then come from a labelled MOCK, not an AI.
import { notFound } from "next/navigation";
import { SAMPLE_COUNT, mockMode, reviewEnabled } from "@/lib/review";
import ReviewClient from "./ReviewClient";

export const metadata = { title: "Photo review · DrainWise (local prototype)" };

export default function ReviewPage() {
  if (!reviewEnabled()) notFound();
  return <ReviewClient count={SAMPLE_COUNT} mock={mockMode()} />;
}

// Photo review page (ticket 13), open in the public build too. Without a key it works
// without a key too: suggestions then come from a labelled MOCK, not an AI.
import { notFound } from "next/navigation";
import { SAMPLE_COUNT, mockMode, reviewEnabled } from "@/lib/review";
import ReviewClient from "./ReviewClient";

export const metadata = { title: "Photo review · DrainWise (prototype)" };

export default function ReviewPage() {
  if (!reviewEnabled()) notFound();
  return <ReviewClient count={SAMPLE_COUNT} mock={mockMode()} />;
}

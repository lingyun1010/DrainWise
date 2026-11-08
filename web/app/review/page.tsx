// Local-only photo review page (ticket 13). It does not exist unless a vision key is set locally
// and this is not the public build: without both, this route is a plain 404.
// The key is checked when the page is built or, with `npm run dev`, on each request. The public
// build has no key, so its 404 is fixed at build time.
import { notFound } from "next/navigation";
import { SAMPLE_COUNT, reviewEnabled } from "@/lib/review";
import ReviewClient from "./ReviewClient";

export const metadata = { title: "Photo review · DrainWise (local prototype)" };

export default function ReviewPage() {
  if (!reviewEnabled()) notFound();
  return <ReviewClient count={SAMPLE_COUNT} />;
}

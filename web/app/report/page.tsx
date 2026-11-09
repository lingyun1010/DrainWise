// Admin page for the risk report email (ticket 23). Preview shows which rule fired; Send mails it over Gmail SMTP.
import ReportClient from "./ReportClient";

export const metadata = { title: "Email report · DrainWise (sample data)" };

export default function ReportPage() {
  return <ReportClient />;
}

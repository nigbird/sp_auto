import { redirect } from "next/navigation";

export default function LeadOwnersRedirect() {
  redirect("/settings/organization/lead-owners");
}

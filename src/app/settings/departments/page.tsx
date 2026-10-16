import { redirect } from "next/navigation";

/** Departments were retired in favour of lead owners; old links land there. */
export default function DepartmentsRedirect() {
  redirect("/settings/organization/lead-owners");
}

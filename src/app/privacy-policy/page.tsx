import { PublicPolicyPage } from "@/app/_components/policy/PublicPolicyPage";
import { getPublicPolicies } from "@/lib/publicPolicies";

export const dynamic = "force-dynamic";

export default async function PrivacyPolicyPage() {
  const policies = await getPublicPolicies();

  return (
    <PublicPolicyPage
      badge="Privacy Policy"
      title="Privacy Policy"
      htmlContent={policies.privacyPolicy}
    />
  );
}

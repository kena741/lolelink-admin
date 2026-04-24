import { PublicPolicyPage } from "@/app/_components/policy/PublicPolicyPage";
import { getPublicPolicies } from "@/lib/publicPolicies";

export const dynamic = "force-dynamic";

export default async function TermsOfServicePage() {
  const policies = await getPublicPolicies();

  return (
    <PublicPolicyPage
      badge="Terms of Service"
      title="Terms of Service"
      htmlContent={policies.termsOfService}
    />
  );
}

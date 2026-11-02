import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import PricingContent from "@/components/pricing-content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "Free, Pro, and Team plans for PatchFlow — autonomous API reliability testing, real-time crash capture, and compiler-verified GitHub PR fixes.",
  path: "/pricing",
});

/**
 * Pricing route — server component so it can export static, indexable
 * Metadata (unique title + description + canonical). The interactive billing
 * toggle and plan cards live in the <PricingContent /> client component.
 */
export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-[#FF5A1F]/15 selection:text-[#FF5A1F]">
      <Navbar variant="landing" />
      <PricingContent />
      <Footer />
    </div>
  );
}

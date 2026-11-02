import type { Metadata } from "next";
import LegalPage, { legalMetadata } from "@/components/legal-page";

export const metadata: Metadata = legalMetadata(
  "Terms of Service — PatchFlow",
  "PatchFlow's terms of service, including acceptable use, auto-generated fixes, warranty disclaimers, and liability limits."
);

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" subtitle="Last updated: November 2, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of PatchFlow
        (the &ldquo;Service&rdquo;). By creating an account or installing the
        PatchFlow SDK, you agree to these Terms. If you are using PatchFlow on
        behalf of an organization, you represent that you are authorized to bind
        that organization.
      </p>

      <h2 id="the-service">1. The Service</h2>
      <p>
        PatchFlow is an autonomous API reliability platform. It stress-tests
        backend APIs with synthetic failure modes, monitors production errors
        via an optional SDK, and generates proposed code fixes that it opens as
        Draft Pull Requests in your connected GitHub repositories.
      </p>

      <h2 id="account">2. Your account</h2>
      <p>
        You sign in with GitHub. You are responsible for keeping your GitHub
        account secure and for all activity that occurs under it. You must be at
        least 16 years old to use PatchFlow.
      </p>

      <h2 id="acceptable-use">3. Acceptable use</h2>
      <p>
        You may only use PatchFlow to test APIs, services, sites, and repositories
        that you own or that you are explicitly authorized to test. You agree
        that you will not:
      </p>
      <ul>
        <li>Test or scan systems you do not own or are not authorized to test.</li>
        <li>Use PatchFlow to attack, disrupt, or degrade services you do not control.</li>
        <li>Attempt to access another user&apos;s data, repositories, or account.</li>
        <li>Reverse-engineer, resell, or build a competing service from PatchFlow.</li>
        <li>Use the Service to process unlawful, infringing, or harmful content.</li>
      </ul>

      <h2 id="repo-access">4. Repository access</h2>
      <p>
        Connecting a repository grants PatchFlow the GitHub scopes you authorize
        (repo, read:user, and user:email). We read your code to analyze failures
        and generate fixes, and we create branches and Draft Pull Requests on your
        behalf. You can revoke access at any time from your GitHub settings.
      </p>

      <h2 id="pr-disclaimer">5. Pull Request auto-creation disclaimer</h2>
      <p>
        Pull Requests created by PatchFlow are automated suggestions. They are
        opened as Drafts and are never merged automatically. You are solely
        responsible for reviewing, testing, and approving any change before it is
        merged. PatchFlow performs pre-merge build verification where possible,
        but a passing build does not guarantee correctness.
      </p>

      <h2 id="no-warranty">6. No warranty on auto-generated fixes</h2>
      <p>
        Auto-generated fixes and patches are provided &ldquo;as is&rdquo; without
        warranties of any kind, express or implied. PatchFlow does not warrant
        that any generated fix is correct, complete, secure, or fit for your
        purpose. Generated code may contain errors, may not address the root
        cause, or may introduce regressions. You assume all risk for code you
        merge.
      </p>

      <h2 id="sdk">7. SDK usage</h2>
      <p>
        The PatchFlow SDK is optional and runs in your application. It is
        designed to fail silently and never break your application if PatchFlow
        is unreachable or waking up, using short timeouts and queued, non-blocking
        reporting. You are responsible for installing it correctly and for any
        data your application sends to it. We recommend reviewing what the SDK
        transmits in our SDK documentation.
      </p>

      <h2 id="billing">8. Billing and plans</h2>
      <p>
        Free and paid plans are described on our Pricing page. Paid subscriptions
        are billed via Lemon Squeezy (our Merchant of Record). You can upgrade,
        downgrade, or cancel at any time; access continues until the end of your
        current billing cycle. Refunds are handled at our discretion in line with
        applicable law.
      </p>

      <h2 id="content-license">9. Your content and license to us</h2>
      <p>
        You retain all ownership of your code and repositories. By connecting a
        repository and using the Service, you grant PatchFlow a limited, revocable
        license to access, read, clone, modify, and transmit your code solely as
        needed to analyze failures and generate proposed fixes, and to open Pull
        Requests in your repository.
      </p>

      <h2 id="third-parties">10. Third-party services</h2>
      <p>
        PatchFlow integrates with GitHub, Google (Gemma), Render, Aiven, Lemon
        Squeezy, and Resend. Your use of those services is also subject to their
        respective terms and policies. We are not responsible for their practices.
      </p>

      <h2 id="termination">11. Termination and data deletion</h2>
      <p>
        You can delete your account or disconnect at any time from Settings or
        GitHub. We may suspend or terminate access if you violate these Terms or
        to protect the Service. Upon termination, your account and associated
        data are deleted in line with our retention schedule (see the Privacy
        Policy). Pull Requests already opened remain in your GitHub repository
        under your control.
      </p>

      <h2 id="disclaimer">12. Disclaimer</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
        without warranties of any kind. We do not guarantee that PatchFlow will be
        uninterrupted, error-free, or that it will detect or fix every failure.
      </p>

      <h2 id="liability">13. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, in no event will PatchFlow be
        liable for any indirect, incidental, special, consequential, or punitive
        damages, or for any loss of profits or data, arising out of your use of
        the Service. Our total aggregate liability for any claim arising out of
        or relating to these Terms or the Service shall not exceed the amount you
        paid us in the twelve (12) months preceding the claim, or fifty U.S.
        dollars ($50) if you have not paid us in that period.
      </p>

      <h2 id="indemnity">14. Indemnity</h2>
      <p>
        You agree to indemnify and hold PatchFlow harmless from claims arising
        from your use of the Service, your content, or your violation of these
        Terms or applicable law.
      </p>

      <h2 id="changes">15. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We will post changes here
        with a new &ldquo;Last updated&rdquo; date and, for material changes,
        notify active users. Continued use after changes take effect constitutes
        acceptance.
      </p>

      <h2 id="contact">16. Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:support@patchflow.dev">support@patchflow.dev</a>.
      </p>
    </LegalPage>
  );
}

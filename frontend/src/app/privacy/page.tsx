import { pageMetadata } from "@/lib/seo";
import LegalPage from "@/components/legal-page";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How PatchFlow collects, uses, and stores GitHub, repository, and SDK error data — and how to request deletion.",
  path: "/privacy",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" subtitle="Last updated: November 2, 2026">
      <p>
        PatchFlow (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an autonomous API
        reliability and self-healing platform. You sign in with GitHub, connect
        repositories, and optionally install our SDK to monitor live errors. This
        policy explains honestly what data we collect, why, who processes it, how
        long we keep it, and how to delete it.
      </p>

      <h2 id="summary">Summary</h2>
      <ul>
        <li>We sign you in with GitHub OAuth and request repo, profile, and email scopes.</li>
        <li>We read your repository code to analyze failures and write fixes, and open Pull Requests on your behalf.</li>
        <li>Our SDK collects error types, messages, and stack frames from your app — never request bodies, headers, cookies, or your end users&apos; PII.</li>
        <li>All incoming error text is run through automated PII redaction before it is stored.</li>
        <li>To generate fixes, error context and relevant code snippets are sent to our AI model provider (Google Gemma).</li>
        <li>Error logs are retained for your plan&apos;s window (7, 30, or 90 days) and then deleted.</li>
        <li>You can request deletion of your data at any time.</li>
      </ul>

      <h2 id="data-we-collect">1. Data we collect when you sign in</h2>
      <p>
        PatchFlow uses GitHub OAuth for authentication. When you click
        &ldquo;Continue with GitHub&rdquo;, you authorize the following scopes:
      </p>
      <ul>
        <li><strong>repo</strong> — read and write access to your public and private repositories. We use this to read your code for analysis, clone a repository to generate a fix, create a branch, push commits, and open a Draft Pull Request.</li>
        <li><strong>read:user</strong> — read your GitHub profile (username and avatar).</li>
        <li><strong>user:email</strong> — read your email address, including your primary verified email if your address is private.</li>
      </ul>
      <p>
        We store your GitHub username, avatar URL, email address, and the OAuth
        access token issued for your account. The access token is stored
        server-side in our database and used only to read your repositories and
        open Pull Requests on your behalf. We never share your token with third
        parties. You can revoke our access at any time from your GitHub settings,
        which immediately invalidates the token.
      </p>

      <h2 id="repository-access">2. Repository access and your code</h2>
      <p>
        When you connect a repository and trigger a scan or when the SDK pipeline
        generates a fix, PatchFlow:
      </p>
      <ul>
        <li>Reads the repository to discover endpoints and analyze the failing code path.</li>
        <li>Creates a temporary clone of the repository on our server to apply and verify a proposed fix.</li>
        <li>Creates a new branch, commits the generated change, and opens a <strong>Draft Pull Request</strong> for your review.</li>
      </ul>
      <p>
        Pull Requests are automated suggestions. You are responsible for
        reviewing and testing changes before merging. Sensitive files (auth,
        billing, payments, credentials, migrations) are blocklisted and are
        never auto-patched. Temporary working clones are short-lived and removed
        after a fix run completes.
      </p>

      <h2 id="sdk-data">3. Data collected by the PatchFlow SDK</h2>
      <p>
        If you install the PatchFlow SDK in your application, it reports
        unhandled errors to PatchFlow. On each captured error, the SDK sends:
      </p>
      <ul>
        <li>Error type and error message (truncated to 1,000 characters).</li>
        <li>The endpoint or route path, HTTP method, and status code where the error occurred.</li>
        <li>Stack frames: file path, line number, and function name (internal library frames are filtered out).</li>
        <li>Detected framework (for example Next.js, Express, Node) and the environment name.</li>
        <li>SDK version.</li>
      </ul>
      <p>
        The SDK is designed to <strong>never</strong> collect request bodies,
        request or response headers, cookies, environment variables, or
        personally identifiable information about your end users. All incoming
        error text is passed through an automated PII redaction step before it is
        stored. The SDK is engineered to fail silently — if PatchFlow is
        unreachable or waking up, it times out quickly and never throws, so it
        cannot break your application.
      </p>

      <h2 id="how-we-use-data">4. How we use your data</h2>
      <ul>
        <li>To authenticate you and manage your account.</li>
        <li>To read your repositories, analyze failures, and generate code fixes.</li>
        <li>To open Draft Pull Requests in your connected repositories.</li>
        <li>To send you incident alert emails when configured.</li>
        <li>To process subscription payments and enforce plan limits.</li>
        <li>To operate, secure, and improve the service.</li>
      </ul>
      <p>
        We do not sell your data. We do not use your repository code to train
        models. Code and error data are processed solely to provide the service
        to you.
      </p>

      <h2 id="ai-processing">5. AI processing</h2>
      <p>
        To generate proposed fixes, we send the failing error context (error
        type, message, stack frame, and surrounding code snippets) to our AI
        model provider, Google&apos;s Gemma API. The code snippets transmitted
        are limited to what is needed to produce a fix for the specific failure.
        Processing by our AI provider is governed by their privacy terms.
      </p>

      <h2 id="retention">6. Data retention</h2>
      <p>
        Error logs and incident records are retained for the window defined by
        your plan and then deleted:
      </p>
      <ul>
        <li><strong>Hobby (Free):</strong> 7 days.</li>
        <li><strong>Developer Pro:</strong> 30 days.</li>
        <li><strong>Team &amp; Business:</strong> 90 days.</li>
      </ul>
      <p>
        Temporary repository clones created during a fix run are removed after
        the run completes. Your account data (profile, email, connected
        repositories, and settings) is retained until you delete your account
        or disconnect the integration. Generated Pull Requests remain in your
        GitHub repository under your control.
      </p>

      <h2 id="processors">7. Third-party processors</h2>
      <p>
        We rely on the following sub-processors to operate PatchFlow. Each
        processes data only as needed to provide the service:
      </p>
      <ul>
        <li><strong>Render</strong> — application and web hosting (region configurable per account).</li>
        <li><strong>Aiven</strong> — managed PostgreSQL database where your account, site, and error data are stored (region configurable).</li>
        <li><strong>Google (Gemma / Generative Language API)</strong> — AI inference used to generate proposed fixes from error context and code snippets.</li>
        <li><strong>GitHub</strong> — OAuth authentication and repository access, including Pull Request creation.</li>
        <li><strong>Lemon Squeezy</strong> — payment processing as Merchant of Record.</li>
        <li><strong>Resend</strong> — transactional email delivery for incident alerts.</li>
      </ul>

      <h2 id="where-stored">8. Where your data is stored</h2>
      <p>
        Your primary data is stored in a PostgreSQL database hosted on Aiven and
        in the application servers hosted on Render. The specific cloud region
        for each service is set by the service operator at deploy time. Data in
        transit is encrypted with TLS. The database connection requires SSL.
        Contact us for the active regions for your account.
      </p>

      <h2 id="security">9. Security</h2>
      <ul>
        <li>All traffic to and from PatchFlow is encrypted over HTTPS/TLS.</li>
        <li>The database connection uses SSL (<code>sslmode=require</code> or stricter).</li>
        <li>All secrets, tokens, and API keys are stored in environment variables on the hosting provider and are never committed to source control.</li>
        <li>Sensitive file paths are blocklisted so authentication, billing, and credential files are never auto-patched.</li>
        <li>Incoming error payloads are PII-redacted before storage.</li>
      </ul>

      <h2 id="cookies">10. Cookies</h2>
      <p>
        We use essential cookies to keep you signed in (your session token).
        These are necessary and require no consent. With your explicit consent,
        we may load privacy-friendly analytics on public pages to understand how
        PatchFlow is used. You can accept or reject analytics via the consent
        banner, and change your choice anytime — your preference is stored
        locally on your device. Authenticated app pages do not load marketing
        analytics. The PatchFlow SDK&apos;s own error reporting is separate from
        and never shared with marketing analytics.
      </p>

      <h2 id="your-rights">11. Your rights and data deletion</h2>
      <p>You can exercise the following at any time:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of the data we hold about you.</li>
        <li><strong>Deletion</strong> — request that we delete your account, error logs, and associated data.</li>
        <li><strong>Disconnect</strong> — revoke PatchFlow&apos;s GitHub access from your GitHub settings, or remove a monitored site in the dashboard.</li>
      </ul>
      <p>
        To request access to or deletion of your data, email{" "}
        <a href="mailto:privacy@patchflow.dev">privacy@patchflow.dev</a> from the
        address on your account and we will action your request, typically within
        30 days. You can also delete your account from Settings.
      </p>

      <h2 id="childrens-privacy">12. Children&apos;s privacy</h2>
      <p>
        PatchFlow is intended for developers and businesses. We do not knowingly
        collect data from anyone under 16. If you believe a minor has registered,
        contact us and we will delete the account.
      </p>

      <h2 id="changes">13. Changes to this policy</h2>
      <p>
        We may update this policy as the service evolves. We will post the
        updated version here with a new &ldquo;Last updated&rdquo; date and, for
        material changes, notify active users by email.
      </p>

      <h2 id="contact">14. Contact</h2>
      <p>
        Questions about this policy or your data? Email{" "}
        <a href="mailto:privacy@patchflow.dev">privacy@patchflow.dev</a>. For
        general support, contact{" "}
        <a href="mailto:support@patchflow.dev">support@patchflow.dev</a>.
      </p>
    </LegalPage>
  );
}

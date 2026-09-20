import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, LEGAL_OPERATOR } from "@/features/legal/legal-meta";
import { LegalPageShell, LegalSection } from "@/features/legal/LegalPageShell";

export function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={LEGAL_LAST_UPDATED}>
      <LegalSection title="1. Overview">
        <p>
          This Privacy Policy describes how {LEGAL_OPERATOR} (&quot;we&quot;, &quot;us&quot;) collects and
          uses information when you use SchemaSay (&quot;the Service&quot;). SchemaSay is a web application
          that connects to databases you authorize and helps you ask questions in plain English.
        </p>
        <p>
          Contact:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-accent hover:text-accent-hover">
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>
          <strong className="text-text-primary">Account data:</strong> email address, optional full
          name, password (stored hashed), and Google account identifier if you use Google sign-in.
        </p>
        <p>
          <strong className="text-text-primary">Connection data:</strong> connection names, database
          type, host, port, database path, username, and encrypted database passwords. We cache schema
          metadata (table and column names, types, optional profiling stats such as null ratios and
          sample values) and business-language aliases you define.
        </p>
        <p>
          <strong className="text-text-primary">Query and usage data:</strong> natural-language
          questions, generated or edited SQL, execution metadata (duration, status, row counts,
          columns), confidence and routing telemetry, and audit log entries linked to your account.
        </p>
        <p>
          <strong className="text-text-primary">Feedback:</strong> ratings, reason categories,
          optional comments, and optional corrected SQL you submit to improve future answers.
        </p>
        <p>
          <strong className="text-text-primary">Technical data:</strong> session tokens, IP addresses,
          and server logs needed to operate and secure the Service.
        </p>
        <p>
          <strong className="text-text-primary">Browser-only data:</strong> theme preference, saved
          queries, and recent actions stored locally in your browser unless otherwise noted.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <ul className="list-disc space-y-2 pl-5">
          <li>Authenticate you and provide the Service</li>
          <li>Connect to your databases and run read-only SELECT queries you request</li>
          <li>Generate SQL using the heuristic engine and/or optional LLM providers</li>
          <li>Display results, trust signals, governance rules, metrics, and audit history</li>
          <li>Improve answer quality using verified feedback you provide for your connections</li>
          <li>Protect the platform against abuse and debug operational issues</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </LegalSection>

      <LegalSection title="4. Third-party services">
        <p>If configured by the operator, SchemaSay may send data to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-text-primary">OpenAI or Google (Gemini)</strong> — your question
            and relevant schema context when LLM features are enabled
          </li>
          <li>
            <strong className="text-text-primary">Google OAuth</strong> — authentication only, if you
            choose Google sign-in
          </li>
          <li>
            <strong className="text-text-primary">Hosting providers</strong> — where the deployed
            application and platform database are hosted
          </li>
        </ul>
        <p>
          When LLMs are used, question text and schema snippets may be processed by those providers
          under their own policies. Do not connect highly sensitive production data without reviewing
          those policies and your compliance obligations.
        </p>
      </LegalSection>

      <LegalSection title="5. Security">
        <p>
          We use password hashing, encrypted storage for database credentials, JWT-based sessions, and
          a read-only SQL gate that blocks writes and many dangerous statements. No system is perfectly
          secure — use strong passwords and avoid connecting data you cannot afford to expose.
        </p>
      </LegalSection>

      <LegalSection title="6. Retention and deletion">
        <p>
          Account, connection, and audit data are retained while your account exists or as needed to
          operate the Service. You may delete connections from the app. To request account deletion,
          contact us at {LEGAL_CONTACT_EMAIL}.
        </p>
      </LegalSection>

      <LegalSection title="7. Your choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>Update or delete database connections in the Connections page</li>
          <li>Log out at any time</li>
          <li>Use heuristic-only mode by not configuring LLM API keys on the deployment</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Children">
        <p>SchemaSay is not intended for users under 16 years of age.</p>
      </LegalSection>

      <LegalSection title="9. Changes">
        <p>
          We may update this policy from time to time. The &quot;Last updated&quot; date at the top
          will change when we do. Continued use after changes means you accept the updated policy.
        </p>
      </LegalSection>

      <p className="text-xs text-text-muted">
        This document is provided for transparency and is not legal advice. Consult a qualified
        professional for compliance questions specific to your jurisdiction or industry.
      </p>
    </LegalPageShell>
  );
}

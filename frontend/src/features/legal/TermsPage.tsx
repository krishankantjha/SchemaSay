import { Link } from "react-router-dom";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, LEGAL_OPERATOR } from "@/features/legal/legal-meta";
import { LegalPageShell, LegalSection } from "@/features/legal/LegalPageShell";

export function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated={LEGAL_LAST_UPDATED}>
      <LegalSection title="1. Acceptance">
        <p>
          By creating an account or using SchemaSay, you agree to these Terms of Service and our{" "}
          <Link to="/privacy" className="text-accent hover:text-accent-hover">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>
        <p>
          Operator: {LEGAL_OPERATOR}. Contact:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-accent hover:text-accent-hover">
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="2. The service">
        <p>
          SchemaSay lets you connect databases, sync schema metadata, ask questions in plain English
          or run manual SQL, and view results with charts, trust signals, metrics, governance rules,
          and audit history. Queries are intended to be read-only SELECT statements subject to platform
          validation.
        </p>
        <p>The Service is provided &quot;as is&quot; and &quot;as available.&quot;</p>
      </LegalSection>

      <LegalSection title="3. Eligibility">
        <p>
          You must be at least 16 years old and able to enter a binding agreement in your jurisdiction.
          You must have lawful authority to connect any database and query any data you attach to
          SchemaSay.
        </p>
      </LegalSection>

      <LegalSection title="4. Your responsibilities">
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate account information and keep credentials secure</li>
          <li>Only connect databases you own or are authorized to use</li>
          <li>Not use the Service for illegal activity or to bypass security controls</li>
          <li>
            Review generated SQL before making business decisions — answers may be wrong, incomplete,
            or misinterpret your question
          </li>
          <li>
            Ensure your use complies with laws and policies that apply to your data (employment,
            healthcare, financial, or other regulated contexts)
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. AI and automated SQL">
        <p>
          SchemaSay may use a heuristic compiler (no external AI) and/or third-party LLMs when
          configured. Generated SQL is probabilistic, not guaranteed correct. LLM providers are third
          parties with their own terms. We do not guarantee accuracy, uptime, or fitness for a
          particular purpose.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>You may not:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Attack, probe, or disrupt the platform or other users&apos; accounts</li>
          <li>Use the Service to access data you are not authorized to view</li>
          <li>Resell, scrape, or commercially exploit the Service without permission</li>
          <li>Upload malicious files or attempt destructive database operations</li>
        </ul>
        <p>We may suspend or terminate accounts that violate these Terms.</p>
      </LegalSection>

      <LegalSection title="7. Intellectual property">
        <p>
          SchemaSay software and branding are owned by the operator (see the MIT License in the
          repository for open-source terms). You retain ownership of your data and SQL you create.
          Feedback you submit may be used to improve answers for your account through the learning
          features described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimer of warranties">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SCHEMASAY IS PROVIDED WITHOUT WARRANTIES OF ANY KIND,
          WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, ACCURACY, AND NON-INFRINGEMENT.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR WRONG SQL, WRONG BUSINESS
          DECISIONS, DATA LOSS, DOWNTIME, SECURITY INCIDENTS, OR ACTIONS OF THIRD-PARTY PROVIDERS.
          OUR TOTAL LIABILITY IS LIMITED TO THE AMOUNT YOU PAID FOR THE SERVICE IN THE LAST 12 MONTHS,
          OR ZERO IF THE SERVICE IS FREE.
        </p>
      </LegalSection>

      <LegalSection title="10. Indemnity">
        <p>
          You agree to indemnify the operator against claims arising from your misuse of the Service,
          unauthorized database access, or violation of these Terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate access for
          violations or operational reasons. Data handling after termination is described in the
          Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law">
        <p>
          These Terms are governed by the laws of India. Disputes shall be subject to the courts of
          India, unless mandatory local law requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes">
        <p>
          We may update these Terms. Material changes will be posted with a new &quot;Last
          updated&quot; date. Continued use after changes constitutes acceptance.
        </p>
      </LegalSection>

      <p className="text-xs text-text-muted">
        This document is provided for transparency and is not legal advice. Consult a qualified
        professional before relying on it for regulated or commercial deployments.
      </p>
    </LegalPageShell>
  );
}

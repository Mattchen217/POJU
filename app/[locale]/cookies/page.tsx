import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cookie Policy — pojulife",
  description: "pojulife cookie and local storage policy — Version 1.1",
};

export default function CookiesPage() {
  return (
    <LegalPageShell
      version="Version 1.1"
      title="Cookie & Local Storage Policy"
      updated="Last updated: 2026-06-15"
      intro={
        <>
          <p>
            <strong>Governing Language:</strong> This agreement is formulated and executed exclusively in the English
            language. Any localized translations provided elsewhere are for convenience only, and this English version
            shall govern and prevail in all aspects of interpretation and dispute resolution.
          </p>
        </>
      }
      footer={
        <p className="legal-page__closing-note">
          <em>
            Subsequent infrastructure deployments may necessitate minor updates to our technical cookie designations.
            All revisions will be hard-stamped with an updated version tier at the apex of this policy layout.
          </em>
        </p>
      }
    >
      <h2>Our Architecture Philosophy</h2>
      <p>
        At pojulife, we believe your browser should be a sanctuary, not a surveillance node. While modern consumer
        platforms deploy invasive cross-site tracking pixels and behavioural analytical scripts to monetize your digital
        footprint, pojulife is engineered on a foundation of <strong>Absolute Data Sovereignty</strong>.
      </p>
      <p>
        We do not sell your navigation data, we do not partner with data brokers, and we do not use marketing tracking
        cookies. We utilize cookies and browser local storage environments strictly for operational survival,
        cryptographic session integrity, and secure billing execution.
      </p>

      <h2>1. Strictly Necessary Cookies</h2>
      <p>
        These technical cookies are fundamentally essential for our platform to boot, maintain basic stability, and
        process payment sequences. They cannot be toggled off inside our settings, as disabling them would break the
        application mechanics.
      </p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Cookie Identifier</th>
              <th scope="col">Architectural Provider</th>
              <th scope="col">Purpose / Function</th>
              <th scope="col">Operational Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>pojulife_session</code>
              </td>
              <td>Internal Engine</td>
              <td>
                Validates your current cryptographic active session state and maps token execution.
              </td>
              <td>Active Session Only</td>
            </tr>
            <tr>
              <td>
                <code>pojulife_locale</code>
              </td>
              <td>Internal Engine</td>
              <td>Safely preserves your chosen language interface preference across updates.</td>
              <td>1 Year</td>
            </tr>
            <tr>
              <td>
                <code>cf_clearance</code>
              </td>
              <td>Cloudflare</td>
              <td>Critical edge security flag used to mitigate automated bot incursions and DDoS attacks.</td>
              <td>30 Days</td>
            </tr>
            <tr>
              <td>
                <code>__stripe_mid</code> / <code>__stripe_sid</code> / Dodo Telemetry
              </td>
              <td>
                <strong>Dodo Payments (Merchant of Record)</strong>
              </td>
              <td>
                Essential fraud-prevention telemetry, card validation, and secure Monthly Pass subscription billing
                state matching. <em>Never used for advertising.</em>
              </td>
              <td>Persistent &amp; Session mixed</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>2. Functional &amp; Interface Cookies</h2>
      <p>
        These items improve your immediate application aesthetics and preference tracking but are not strictly required
        for backend computations.
      </p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Cookie Identifier</th>
              <th scope="col">Architectural Provider</th>
              <th scope="col">Purpose / Function</th>
              <th scope="col">Operational Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>pojulife_theme</code>
              </td>
              <td>Internal Engine</td>
              <td>Caches your dark mode / visual canvas styling preference.</td>
              <td>1 Year</td>
            </tr>
            <tr>
              <td>
                <code>pojulife_consent</code>
              </td>
              <td>Internal Engine</td>
              <td>
                Remembers that you have actively accepted our compliance gate so we don&apos;t prompt you on every
                refresh.
              </td>
              <td>1 Year</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>3. The Local Storage Layer (Browser Sovereignty Matrix)</h2>
      <p>
        Unlike legacy cloud apps that store your text input records on centralized remote servers, pojulife leverages
        your browser&apos;s native <strong>IndexedDB</strong> and <strong>Local Storage</strong> environments to preserve
        your entire conversational universe.
      </p>
      <p>
        This data is encrypted locally using <strong>AES-256-GCM</strong> keys and remains entirely under your hardware
        custody. We utilize this layer to preserve:
      </p>
      <ul>
        <li>Your conversation history across the POJU, Glyph, Syncro, and Match modules.</li>
        <li>Your current active premium token balances and Monthly Pass ecosystem voucher entitlements.</li>
        <li>Your personalized archetypal reflection logs and profile configurations.</li>
      </ul>
      <blockquote>
        <p>
          <strong>Technical Reality Note:</strong> This local cache never leaves your machine in unencrypted plain text.
          Because this data exists exclusively under your hardware domain, the operator cannot retrieve, restore, or
          reconstruct your logs if you destroy your device or clear your cache.
        </p>
      </blockquote>

      <h2>4. What We Explicitly Prohibit &amp; Do NOT Use</h2>
      <p>To preserve the clean parameters of our ecosystem, we completely ban the following technologies from our codebase:</p>
      <ul>
        <li>
          <strong>Behavioral Trackers:</strong> No Google Analytics, no Hotjar, no tracking session recordings.
        </li>
        <li>
          <strong>Commercial Retargeting Pixels:</strong> No Meta (Facebook) Pixel, no TikTok Pixel, no Google Ads
          cross-site tracking markers.
        </li>
        <li>
          <strong>Third-Party Identity Harvesters:</strong> No hidden tracking elements built to profile your commercial
          shopping behavior.
        </li>
      </ul>

      <h2>5. Sovereign User Jurisdiction &amp; Global Rights (GDPR / CCPA)</h2>
      <p>
        Whether you operate under the protection of the European Union GDPR, UK GDPR, or California Consumer Privacy Act
        (CCPA), our decentralized framework naturally respects your statutory digital autonomy by default:
      </p>
      <ul>
        <li>
          <strong>Granular Autonomy:</strong> We do not track or sell data; therefore, there is no behavioral profile to
          opt-out of.
        </li>
        <li>
          <strong>Absolute Deletion (The Nuclear Option):</strong> You hold absolute execution power. To wipe every trace
          of your locally cached token sessions, history matrices, and local cookies, simply access your application
          dashboard and select the <strong>&quot;End &amp; Wipe&quot;</strong> sequence, or clear your browser site data
          for <code>pojulife.com</code> directly via your browser configuration panel.
        </li>
        <li>
          <strong>Subscription Alignment Data:</strong> Any email addresses provided voluntarily for Monthly Pass
          subscription processing or ecosystem voucher synchronization can be permanently erased from our billing relay
          registries upon direct communication.
        </li>
      </ul>

      <h2>6. Contact &amp; Inquiry Nodes</h2>
      <p>For comprehensive system architecture inquiries or data erasure coordination, connect directly with our compliance mailbox:</p>
      <ul>
        <li>
          <strong>Data Privacy Inquiries:</strong>{" "}
          <a href="mailto:privacy@pojulife.com">privacy@pojulife.com</a>
        </li>
      </ul>
    </LegalPageShell>
  );
}

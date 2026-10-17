import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cookie Policy — Eastern OS",
  description: "Eastern OS Cookie & Local Storage Policy — Version 1.0",
};

export default function CookiesPage() {
  return (
    <LegalPageShell
      version="Version 1.0 (first public launch baseline)"
      title="Cookie & Local Storage Policy"
      updated="Last updated: 2026-10-16"
      intro={
        <>
          <p>
            <strong>Governing Language:</strong> This agreement is formulated and executed exclusively in the English
            language. Any localized translations provided elsewhere are for convenience only, and this English version
            shall govern and prevail in all aspects of interpretation and dispute resolution.
          </p>
        </>
      }
    >
      <h2>Purpose of this Policy</h2>
      <p>This Cookie &amp; Local Storage Policy explains, in plain English:</p>
      <ol>
        <li>Why Eastern OS uses cookies and similar technologies;</li>
        <li>How we categorize those technologies (necessary, functional / preferences, security / edge, payment / checkout);</li>
        <li>How <strong>browser-local</strong> storage (including IndexedDB / local storage in your <strong>current</strong> browser profile) is used for chat, deliverables, and preferences—and what it is <strong>not</strong>;</li>
        <li>What we do <strong>not</strong> use as a launch marketing-tracking posture;</li>
        <li>Controls you have to clear or limit site data; and</li>
        <li>How this page relates to the Privacy Policy, Terms of Service, Disclaimer, and Refund Policy.</li>
      </ol>
      <p>Related policies you should also read:</p>
      <ul>
        <li><Link href="/privacy">Privacy Policy</Link></li>
        <li><Link href="/terms">Terms of Service</Link></li>
        <li><Link href="/disclaimer">Disclaimer &amp; Sovereignty Architecture</Link></li>
        <li><Link href="/refund">Refund Policy</Link></li>
      </ul>
      <p>This Policy covers <strong>cookies, similar browser technologies, and client-side storage</strong> used in connection with Eastern OS. It does <strong>not</strong> redefine PASS packaging, refund eligibility, professional-advice boundaries, or the full inventory of personal-data processing—those live in the Terms, Refund Policy, Disclaimer, and Privacy Policy.</p>
      <p>By continuing to use Eastern OS after being presented with this Policy (including via Cookie Settings / related notices), you acknowledge the practices described here. Where applicable law requires consent for non-essential technologies, we will request it in the manner shown in the then-current UI.</p>
      <h2>1. Our approach</h2>
      <p>Eastern OS uses cookies and similar technologies for:</p>
      <ul>
        <li><strong>Basic operation</strong> of the site and application;</li>
        <li><strong>Session continuity</strong> (keeping you signed in / recognizing an active session where accounts are used);</li>
        <li><strong>Preferences</strong> (for example locale, theme, and disclaimer / entry-gate assent markers);</li>
        <li><strong>Security and edge protection</strong> (bot mitigation, abuse prevention, infrastructure reliability); and</li>
        <li><strong>Billing / checkout flows</strong> when you purchase a PASS or start a subscription (technologies set by the payment processor / merchant-of-record / checkout host actually integrated at launch).</li>
      </ul>
      <p>We do <strong>not</strong> sell your navigation data to data brokers as a business model, and we do <strong>not</strong> operate marketing tracking cookies / advertising pixels as a core Eastern OS monetization practice at launch. If tooling changes, this Policy and the Privacy Policy must be updated together.</p>
      <p><strong>Identifiers may change.</strong> Exact cookie names, storage keys, and library prefixes can change with infrastructure, auth providers, hosting, and client releases. Tables below describe <strong>categories and purposes</strong>. Where example identifiers are shown, they are illustrative of technologies commonly present in stacks like ours—or known from product architecture—and <strong>Engineer must sync live names before ship</strong>. Do not treat any single example string as a permanent inventory.</p>
      <h2>2. Categories of cookies and similar technologies</h2>
      <h3>2.1 Strictly Necessary</h3>
      <p>These technologies are required for Eastern OS to load, stay stable, authenticate accounts where used, and complete essential security or routing functions. Disabling them in the browser may break sign-in, checkout, or core application mechanics. They are not used for advertising.</p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Category / purpose</th>
              <th scope="col">Typical setter</th>
              <th scope="col">What it does</th>
              <th scope="col">Duration (typical)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Account authentication</strong>
                <br />
                <code>sb-access-token</code>, <code>sb-refresh-token</code>
                <br />
                <span className="legal-muted">(plus provider-prefixed Supabase auth cookies such as <code>sb-&lt;project-ref&gt;-auth-token</code> when the hosted auth client sets them)</span>
              </td>
              <td>Eastern OS / Supabase auth</td>
              <td>Keeps you signed in and authorizes account actions (PASS ledger, billing portal). Cleared on account delete / sign-out flows that wipe these names.</td>
              <td>Session and/or provider-defined refresh windows</td>
            </tr>
            <tr>
              <td>
                <strong>OAuth popup handoff</strong>
                <br />
                <code>easternos_oauth_popup</code>
              </td>
              <td>Eastern OS client (<code>lib/auth/oauth-popup.ts</code>)</td>
              <td>Short-lived marker while an OAuth popup completes sign-in.</td>
              <td>~10 minutes (Max-Age=600), then cleared</td>
            </tr>
            <tr>
              <td>
                <strong>Locale / routing</strong>
              </td>
              <td>Eastern OS / next-intl</td>
              <td>Locale is driven by the URL prefix (<code>/en</code>, <code>/zh</code>, …). <code>localeDetection</code> is off — we do <strong>not</strong> set a <code>NEXT_LOCALE</code> cookie as of this inventory.</td>
              <td>N/A (URL), not a cookie</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>2.2 Functional / preferences</h3>
      <p>These improve convenience and remember choices you make. They are not required for raw backend computation, but clearing them may re-prompt gates or reset appearance.</p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Category / purpose</th>
              <th scope="col">Typical setter</th>
              <th scope="col">What it does</th>
              <th scope="col">Duration (typical)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Disclaimer / entry-gate assent</strong>
                <br />
                <code>easternos_disclaimer_v1.0</code>
              </td>
              <td>Eastern OS client (<code>components/disclaimer/disclaimer-modal.tsx</code>)</td>
              <td>localStorage marker that you acknowledged the entry disclaimer / age themes so we do not re-prompt on every refresh in this browser profile. Version suffix follows <code>siteConfig.disclaimerVersion</code>.</td>
              <td>Until cleared, or when the gate version string changes</td>
            </tr>
            <tr>
              <td>
                <strong>Pending checkout intent</strong>
                <br />
                <code>pending_intent</code>
              </td>
              <td>Eastern OS client (<code>lib/auth/pending-intent.ts</code>)</td>
              <td>localStorage JSON remembering the plan you chose (Buy Pass / subscription) so checkout can resume after login.</td>
              <td>Until checkout completes or cleared</td>
            </tr>
            <tr>
              <td>
                <strong>Pending paywall unlock</strong>
                <br />
                <code>poju_pending_paywall_unlock</code>, <code>poju_completed_paywall_unlock</code>
              </td>
              <td>Eastern OS client (sessionStorage)</td>
              <td>Remembers a paywall unlock to finish after Pass purchase return.</td>
              <td>Session tab lifetime</td>
            </tr>
            <tr>
              <td>
                <strong>Other UI / product state (examples)</strong>
                <br />
                <code>pojulife_chat_welcome_seen_*</code>, archive/runtime keys, product flow session keys
              </td>
              <td>Eastern OS client</td>
              <td>Non-chat UI friction reducers (welcome toast, archive runtime lists, in-flow session flags). Not used for advertising.</td>
              <td>Until cleared / as configured</td>
            </tr>
            <tr>
              <td>
                <strong>Theme / UI preference</strong>
              </td>
              <td>Eastern OS client / CSS</td>
              <td>Landing and app use dark starfield styling; no dedicated <code>NEXT_THEME</code> cookie was found in this inventory. Appearance may still follow system / page class.</td>
              <td>N/A or until cleared</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>2.3 Security / edge</h3>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Category / purpose</th>
              <th scope="col">Typical setter</th>
              <th scope="col">What it does</th>
              <th scope="col">Duration (typical)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Edge / bot mitigation</strong></td>
              <td><strong>Cloudflare</strong> (and/or comparable edge)</td>
              <td>Security cookies commonly used to distinguish legitimate traffic from automated abuse (example family often includes identifiers such as <code>cf_clearance</code> when Cloudflare challenge/clearance flows are active). Exact names and lifetimes follow Cloudflare’s then-current behavior.</td>
              <td>Provider-defined (often days to weeks for clearance-style cookies)</td>
            </tr>
            <tr>
              <td><strong>Hosting / edge operational cookies</strong></td>
              <td><strong>Vercel</strong> and/or <strong>Cloudflare</strong> (as used for hosting / delivery)</td>
              <td>May support routing, reliability, and infrastructure controls. Not used by Eastern OS as advertising trackers.</td>
              <td>Provider-defined</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>2.4 Payment / checkout</h3>
      <p>When you start checkout or manage billing:</p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Category / purpose</th>
              <th scope="col">Typical setter</th>
              <th scope="col">What it does</th>
              <th scope="col">Duration (typical)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Checkout / fraud / billing state</strong>
                <br />
                <em>Set by the checkout / MoR host; names as shown on the hosted checkout domain</em>
              </td>
              <td>Payment processor / merchant-of-record / checkout host actually integrated at launch</td>
              <td>Cookies or similar technologies <strong>set by that provider</strong> (or on its hosted checkout domain) for secure payment, fraud prevention, and subscription / purchase state matching. <strong>Never used by Eastern OS as advertising pixels.</strong> Eastern OS does not hardcode third-party payment cookie names here—the provider name on your receipt controls.</td>
              <td>Session and persistent, per provider rules</td>
            </tr>
            <tr>
              <td>
                <strong>First-party checkout handoff (measured)</strong>
                <br />
                <code>pending_intent</code> (localStorage)
              </td>
              <td>Eastern OS client</td>
              <td>Remembers which PASS plan / quantity to buy before redirect to the hosted checkout. Not a payment-card cookie.</td>
              <td>Until checkout resumes or cleared</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p><strong>The exact provider name shown at live checkout and on your receipt controls.</strong> Eastern OS does <strong>not</strong> list third-party payment cookie names in this Policy in a way that hardcodes a vendor that may change. Payment-related cookies are those set by the payment provider / checkout host as shown at checkout.</p>
      <p>Eastern OS does <strong>not</strong> intend to store raw full card Primary Account Numbers on its own servers. See the Privacy Policy and Refund Policy.</p>
      <h2>3. Local storage / IndexedDB (browser-local chat &amp; deliverables)</h2>
      <h3>3.1 What stays in your browser</h3>
      <p>Eastern OS is designed so that <strong>dialogue / chat content and related in-browser deliverables</strong> (for example reports and same-line reminder content as presented in-product) are stored primarily in <strong>browser-local</strong> technologies such as <strong>IndexedDB</strong> and <strong>local storage</strong> in the <strong>current</strong> browser profile—not as a cloud chat archive synced through your account.</p>
      <p>This local layer may include, depending on the then-current client:</p>
      <ul>
        <li>Multi-turn decision dialogue history and related session artifacts for the <strong>unified</strong> Eastern OS dialogue experience;</li>
        <li>In-browser deliverables associated with a PASS line of work (for example report / reminder presentation state);</li>
        <li>Preference and assent markers described above;</li>
        <li>Other client-side caches needed for a smooth local experience.</li>
      </ul>
      <p>
        <strong>Measured client stores (engine inventory 2026-10-16):</strong> dialogue / session / archive rows use an IndexedDB database via Dexie in <code>lib/db/poju-db.ts</code> (database name as configured in that module — measured name <code>pojulife_v4</code> on this origin). Assent and checkout handoff keys in <strong>localStorage</strong> / <strong>sessionStorage</strong> are listed in the tables above. Identifiers can change with client releases.
      </p>
      <p><strong>Storage may be protected or organized as implemented in the then-current client.</strong> This Policy does <strong>not</strong> warrant a specific encryption algorithm as a universal property of all local stores. See the Privacy Policy for the accurate “browser-local” product statement.</p>
      <h3>3.2 What is <strong>not</strong> “primary truth” in local storage</h3>
      <p><strong>PASS balances, subscription entitlements, and billing ledgers are account / server-side</strong> (subject to the Privacy Policy and Terms). Local storage is <strong>not</strong> the authoritative billing ledger.</p>
      <p>Your <strong>account</strong> holds PASS / billing state. A <strong>receipt email</strong> confirms billing—it is <strong>not</strong> a backup of your chat history. To retain chat / deliverables beyond the current browser profile, use <strong>export / email</strong> (or other retention features) where offered.</p>
      <h3>3.3 Loss risks</h3>
      <p>Because chat / deliverables are browser-local, they may be <strong>permanently lost</strong> if, for example, you:</p>
      <ul>
        <li>Clear site data / cache / cookies / IndexedDB / local storage for easternos.com;</li>
        <li>Use or close an Incognito / Private window;</li>
        <li>Switch browsers, devices, or browser profiles;</li>
        <li>Uninstall a PWA / clear app storage; or</li>
        <li>Use aggressive privacy extensions that wipe origin storage.</li>
      </ul>
      <p>Eastern OS does <strong>not</strong> restore a cloud chat archive we do not keep. Accidental or user-caused local loss does <strong>not</strong>, by itself, create a refund or free PASS restoration—see the Refund Policy and Terms.</p>
      <h3>3.4 In-product wipe / clear controls</h3>
      <p>Where the then-current product offers in-app wipe controls (for example “End &amp; Wipe” style actions), you may use them to clear local session / chat data as designed in that UI. Otherwise—or in addition—you can clear <strong>site data</strong> for easternos.com in your browser settings.</p>
      <p>Clearing local chat does <strong>not</strong> automatically delete server-side account / PASS / billing records. For account-held personal data requests, contact <strong>privacy@easternos.com</strong> (see Privacy Policy).</p>
      <h2>4. What we do not use (launch posture)</h2>
      <p>As a <strong>launch posture</strong>, Eastern OS does <strong>not</strong> intentionally embed the following as product defaults for behavioral advertising or cross-site retargeting:</p>
      <ul>
        <li>Google Analytics (or equivalent general web analytics marketed primarily for advertising funnels);</li>
        <li>Hotjar (or equivalent session-recording / heatmap marketing tools);</li>
        <li>Meta (Facebook) Pixel, TikTok Pixel, Google Ads cross-site retargeting markers;</li>
        <li>Hidden third-party identity harvesters built to profile shopping behavior for ad networks.</li>
      </ul>
      <p>This section describes <strong>intent and launch tooling posture</strong>. Engineer must verify the production bundle before go-live. If any of the above (or similar) is later added, this Policy and the Privacy Policy will be updated.</p>
      <p>We still use <strong>operational</strong> security, hosting, auth, email, AI generation, and payment processors as described in the Privacy Policy—those are not “ad pixels,” but they do process data as needed to run the Service.</p>
      <h2>5. User controls</h2>
      <p>You can typically:</p>
      <ol>
        <li><strong>Review cookies</strong> for easternos.com in your browser’s site settings / developer tools;</li>
        <li><strong>Block or delete cookies</strong> in your browser (note: blocking necessary cookies may break sign-in, security challenges, or checkout);</li>
        <li><strong>Clear site data</strong> (cookies, local storage, IndexedDB) for easternos.com;</li>
        <li>Use <strong>in-product wipe controls where offered</strong>;</li>
        <li><strong>Export / email</strong> chat or deliverables before wiping, when those features are available;</li>
        <li><strong>Sign out</strong> / close account flows as described in Terms / Privacy for server-side account data;</li>
        <li>Contact <strong>privacy@easternos.com</strong> for privacy requests about account-held data.</li>
      </ol>
      <p>Eastern OS does not claim a universal “opt out of all strictly necessary cookies while still using the full Service.” Necessary technologies are required for core operation where accounts, security, or checkout are used.</p>
      <p>Where a jurisdiction requires a consent banner or granular non-essential toggles, the then-current Cookie Settings / banner UI controls those choices. This written Policy is the disclosure; the UI is the control surface.</p>
      <h2>6. Relationship to the Privacy Policy and other documents</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Role relative to cookies / local storage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>This Cookie &amp; Local Storage Policy</strong></td>
              <td>Categories, purposes, local IndexedDB/chat posture, user controls, launch “what we don’t use.”</td>
            </tr>
            <tr>
              <td><strong>Privacy Policy</strong></td>
              <td>Broader personal-data map: account / PASS / billing vs browser-local chat; processors (including hosting, auth, AI, email, payments); retention; rights.</td>
            </tr>
            <tr>
              <td><strong>Terms of Service</strong></td>
              <td>Account rules, PASS commerce, acceptable use; browser-local data loss vs entitlements.</td>
            </tr>
            <tr>
              <td><strong>Disclaimer &amp; Sovereignty Architecture</strong></td>
              <td>Product boundaries; local-session limits; crisis / age themes summarized in the entry modal.</td>
            </tr>
            <tr>
              <td><strong>Refund Policy</strong></td>
              <td>When payments may be refunded; local data loss generally not refundable by itself.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>If a technical privacy fact here conflicts with the Privacy Policy, <strong>prefer the Privacy Policy</strong> for storage architecture and processor inventory. If a commercial entitlement / refund rule conflicts with Marketing copy, prefer Terms + Refund + checkout / receipt.</p>
      <h2>7. Changes</h2>
      <p>We may update this Policy when infrastructure, auth, payment, or client storage behavior changes. Material updates will be reflected by a new <strong>Last updated</strong> date and Version stamp at the top of this page. Continued use after posting constitutes acknowledgment of the updated Policy to the extent permitted by law. Where consent is required for new non-essential technologies, we will request it as shown in the then-current UI.</p>
      <p>Subsequent infrastructure deployments may change technical cookie designations; revisions will be version-stamped on this page.</p>
      <h2>8. Contact</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Topic</th>
              <th scope="col">Contact</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Privacy / data / cookies</td>
              <td><strong>privacy@easternos.com</strong></td>
            </tr>
            <tr>
              <td>Legal</td>
              <td><strong>legal@easternos.com</strong></td>
            </tr>
            <tr>
              <td>Product / billing support</td>
              <td><strong>support@easternos.com</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2>9. Acknowledgment</h2>
      <p>By using Eastern OS, you acknowledge that:</p>
      <ul>
        <li>Cookies and similar technologies are used for <strong>operation, session, preferences, security, and billing flows</strong> as categorized above;</li>
        <li><strong>Chat / deliverables are browser-local</strong> in the current browser profile, with real loss risk across clears, Incognito, and device switches;</li>
        <li><strong>PASS / subscription entitlements are account / server-side</strong>, not the primary truth of local storage;</li>
        <li><strong>Receipt email ≠ chat backup</strong>; export / email for retention where offered;</li>
        <li>We do <strong>not</strong> sell navigation data to brokers or run marketing tracking cookies as a launch business model (subject to verified tooling);</li>
        <li>Payment cookies are set by the <strong>payment provider / checkout host as shown at checkout</strong>;</li>
        <li>You are <strong>18+</strong>; and</li>
        <li>Detailed personal-data processing is governed by the <strong>Privacy Policy</strong>.</li>
      </ul>
    </LegalPageShell>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
      <div className="prose max-w-none dark:prose-invert">
        <p className="text-gray-600">Last updated: June 2026</p>

        <p>
          Earn4Insights (&ldquo;Earn4Insights&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates a
          consumer-insights platform that connects brands, consumers, and influencers. This Privacy
          Policy explains what personal data we collect, how and why we use it, who we share it with,
          and the rights and choices you have. We are committed to handling your data in line with
          India&rsquo;s Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;) and, where
          applicable, the EU/UK General Data Protection Regulation (&ldquo;GDPR&rdquo;).
        </p>
        <p>
          This policy applies to consumers, brand users, and influencers who use our website and
          dashboard. By creating an account you confirm you have read this policy. Where we rely on
          your consent, that consent is always granular and can be withdrawn at any time (see
          &ldquo;Your Choices &amp; Consent&rdquo; below).
        </p>

        <h2>1. Who We Are (Data Fiduciary / Controller)</h2>
        <p>
          For the purposes of the DPDP Act, Earn4Insights is the <strong>Data Fiduciary</strong>; for
          the GDPR, we are the <strong>Data Controller</strong> of the personal data described here.
          You can reach us using the contact details in Section 12, including our Grievance Officer.
        </p>

        <h2>2. Information We Collect</h2>
        <p>We collect the following categories of personal data:</p>
        <ul>
          <li>
            <strong>Account &amp; identity data</strong> — name, email address, password (stored only
            as a salted hash), account role (consumer, brand, or influencer), and, where you choose to
            add it, a phone/WhatsApp number (verified via OTP before we save it).
          </li>
          <li>
            <strong>Profile data</strong> — information you add to your profile, such as demographics,
            interests, and preferences. Influencers may additionally provide niche, content
            categories, rate cards, portfolio links, and social handles.
          </li>
          <li>
            <strong>Feedback &amp; survey content</strong> — the text, audio, video, and images you
            submit, along with survey and NPS/CSAT responses. Audio and video may be transcribed to
            text and translated for analysis.
          </li>
          <li>
            <strong>Behavioral &amp; inferred signals</strong> — activity on the platform and signals
            we derive from it (e.g. interests, engagement patterns) used for personalization and
            audience matching. These are only collected and used where you have granted the relevant
            consent.
          </li>
          <li>
            <strong>Payment &amp; payout data</strong> — for rewards, payouts, and brand payments,
            limited transaction data and the bank/UPI details you provide. Card and banking
            credentials are handled by our payment processor (Razorpay); sensitive identifiers we do
            store (such as account numbers) are encrypted at rest.
          </li>
          <li>
            <strong>Technical &amp; usage data</strong> — IP address, device/browser information, and
            log data, used for security, fraud prevention, rate limiting, and analytics.
          </li>
          <li>
            <strong>Consent records</strong> — a record of the consents you grant or withdraw, kept so
            we can demonstrate the lawful basis for each processing activity.
          </li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <p>We use personal data to:</p>
        <ul>
          <li>Provide, operate, and secure the platform and your account;</li>
          <li>
            Process feedback and surveys, including transcription, language detection, translation, and
            sentiment/theme analysis;
          </li>
          <li>
            Personalize your experience and match consumers, brands, and influencers (for example,
            scoring a consumer against a brand&rsquo;s Ideal Consumer Profile) where you have consented;
          </li>
          <li>Calculate and deliver rewards, points, and payouts;</li>
          <li>Send service communications, notifications, and (with consent) marketing messages;</li>
          <li>Detect, prevent, and investigate fraud, abuse, and security incidents;</li>
          <li>Produce aggregated, anonymized insights for brands (see Section 5);</li>
          <li>Comply with our legal obligations and enforce our Terms of Service.</li>
        </ul>

        <h2>4. Legal Bases for Processing</h2>
        <p>
          Where the GDPR applies, we rely on: (a) <strong>your consent</strong> for behavioral signals,
          personalization, and marketing; (b) <strong>performance of a contract</strong> to provide the
          services you sign up for; (c) <strong>legitimate interests</strong> in securing the platform,
          preventing fraud, and improving our services; and (d) <strong>legal obligation</strong> where
          the law requires us to process data. Under the DPDP Act, we process personal data on the
          basis of your consent or for legitimate uses permitted by the Act.
        </p>

        <h2>5. How We Share Data &mdash; and What Brands See</h2>
        <p>
          <strong>We do not sell your personal data.</strong> Brands receive insights derived from
          consumer feedback as <strong>aggregated and anonymized</strong> data. To protect individuals,
          aggregated metrics and audience breakdowns are only shown above a minimum group size, so a
          single person cannot be singled out from a cohort. Brands can see the content and identity
          associated with feedback only where that is inherent to the interaction (for example, a
          response submitted directly to that brand) and subject to your consent settings.
        </p>
        <p>
          We share data with trusted third-party processors who act on our instructions and are bound
          by appropriate data-protection terms, including:
        </p>
        <ul>
          <li><strong>Razorpay</strong> — payment and payout processing;</li>
          <li><strong>Resend</strong> — transactional and notification email;</li>
          <li><strong>Twilio</strong> — SMS and WhatsApp verification/messaging;</li>
          <li><strong>OpenAI</strong> — transcription, translation, and AI-assisted analysis;</li>
          <li><strong>Pusher</strong> — real-time notifications;</li>
          <li><strong>Vercel</strong> — hosting and file/media storage;</li>
          <li><strong>Neon</strong> — managed database hosting;</li>
          <li><strong>Upstash</strong> — rate limiting.</li>
        </ul>
        <p>
          We may also disclose data where required by law, to protect our rights or users&rsquo; safety,
          or in connection with a corporate transaction (such as a merger or acquisition), in which case
          we will notify you as required.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We keep personal data only as long as necessary for the purposes described here or as
          required by law. Raw media files (audio, video, and images) are deleted after their retention
          window; derived data such as transcripts, scores, and analytics may be retained longer.
          Behavioral signals are subject to a defined retention period. When you delete your account, we
          delete or anonymize your personal data, except where we must retain certain records to meet
          legal, accounting, or fraud-prevention obligations.
        </p>

        <h2>7. Your Choices &amp; Consent</h2>
        <p>
          Consent on Earn4Insights is <strong>explicit, granular, and independently revocable</strong>.
          From your settings you can toggle each data category (for example, behavioral signals)
          on or off at any time, and withdrawing consent does not affect the lawfulness of processing
          carried out before the withdrawal. You can also manage cookie preferences via the cookie
          banner. Some features may not function if the consent they depend on is withdrawn.
        </p>

        <h2>8. Your Rights</h2>
        <p>
          Subject to applicable law, you have the right to:
        </p>
        <ul>
          <li><strong>Access</strong> and obtain a copy of your personal data;</li>
          <li><strong>Correct</strong> or update inaccurate or incomplete data;</li>
          <li><strong>Delete</strong> your data (&ldquo;right to erasure&rdquo;);</li>
          <li><strong>Withdraw consent</strong> for any consent-based processing;</li>
          <li><strong>Data portability</strong> &mdash; receive your data in a machine-readable format;</li>
          <li><strong>Object to or restrict</strong> certain processing (where the GDPR applies);</li>
          <li><strong>Nominate</strong> another person to exercise your rights in the event of death or incapacity (under the DPDP Act);</li>
          <li><strong>Grievance redressal</strong> &mdash; raise a complaint with our Grievance Officer, and escalate to the Data Protection Board of India or your local supervisory authority.</li>
        </ul>
        <p>
          You can exercise access, export, and deletion directly from your account settings (including a
          one-click data export), or by contacting us at the address in Section 12. We aim to respond
          within the timeframes required by law.
        </p>

        <h2>9. Security</h2>
        <p>
          We use technical and organizational measures to protect your data, including encryption in
          transit, encryption at rest for sensitive identifiers, hashed passwords, optional two-factor
          authentication, and access controls. No system is perfectly secure, but we work to protect
          your data and to notify you and the relevant authorities of incidents where the law requires.
        </p>

        <h2>10. International Transfers</h2>
        <p>
          Some of our processors operate outside India. Where personal data is transferred
          internationally, we rely on safeguards permitted under applicable law (such as the recipient
          being in a permitted jurisdiction or being bound by appropriate contractual protections).
        </p>

        <h2>11. Children</h2>
        <p>
          Earn4Insights is not intended for children under 18. We do not knowingly collect personal data
          from children without verifiable parental or guardian consent as required by the DPDP Act. If
          you believe a child has provided us data, please contact us and we will take appropriate action.
        </p>

        <h2>12. Cookies</h2>
        <p>
          We use essential cookies to run the platform (such as authentication and security) and, with
          your consent, analytics cookies to understand usage. You can manage non-essential cookies
          through the cookie banner at any time.
        </p>

        <h2>13. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will revise the &ldquo;Last
          updated&rdquo; date above and, for material changes, provide additional notice (for example,
          by email or an in-app message).
        </p>

        <h2>14. Contact Us &amp; Grievance Officer</h2>
        <p>
          For any questions, requests, or complaints about this policy or your personal data, contact our
          Grievance Officer at{' '}
          <a href="mailto:contact@earn4insights.com" className="text-blue-600">
            contact@earn4insights.com
          </a>
          . If you are in India and are not satisfied with our response, you may escalate your complaint
          to the Data Protection Board of India.
        </p>
      </div>
    </div>
  )
}

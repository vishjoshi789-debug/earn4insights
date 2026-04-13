export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Refund & Cancellation Policy</h1>
      <div className="prose max-w-none">
        <p className="text-gray-600">Last updated: April 2026</p>

        <h2>1. Overview</h2>
        <p>
          Earn4Insights is a two-sided marketplace connecting brands with influencers
          and consumers for consumer insights, influencer marketing campaigns, and
          feedback collection. All payments on the platform are processed securely
          through Razorpay payment gateway.
        </p>

        <h2>2. Campaign Payment Refunds (Brand Side)</h2>
        <ul>
          <li>All campaign payments are held in escrow until campaign milestones are completed and approved.</li>
          <li><strong>Full refund</strong> is issued if the influencer fails to deliver any agreed-upon deliverables.</li>
          <li><strong>Partial refund</strong> is issued proportional to undelivered milestones if only partial delivery is made.</li>
          <li><strong>No refund</strong> is available after content has been approved and published by the brand.</li>
          <li>Brands may raise a dispute through the platform&apos;s dispute resolution system for contested deliverables.</li>
          <li>Approved refunds are processed within <strong>5-7 business days</strong> to the original payment method.</li>
        </ul>

        <h2>3. Campaign Cancellation (Brand Side)</h2>
        <ul>
          <li>Campaigns can be cancelled at any time before an influencer accepts the invitation or application.</li>
          <li><strong>100% refund</strong> if the campaign is cancelled before any work has started.</li>
          <li><strong>50% refund</strong> if the campaign is cancelled during an active engagement (after influencer has started work).</li>
          <li><strong>No refund</strong> if the campaign has been completed.</li>
          <li>Cancellation requests can be submitted through the brand dashboard or by contacting support at{' '}
            <a href="mailto:contact@earn4insights.com" className="text-blue-600">contact@earn4insights.com</a>.
          </li>
        </ul>

        <h2>4. Influencer Payouts</h2>
        <ul>
          <li>Influencer payouts are processed after the brand approves the submitted milestone or deliverable.</li>
          <li>Payout timeline: <strong>3-5 business days</strong> after approval.</li>
          <li>Failed payouts are retried automatically by the payment gateway.</li>
          <li>For payout-related issues, influencers may contact support at{' '}
            <a href="mailto:contact@earn4insights.com" className="text-blue-600">contact@earn4insights.com</a>.
          </li>
        </ul>

        <h2>5. Consumer Rewards</h2>
        <ul>
          <li>Points earned through surveys, feedback, and platform activity are non-refundable.</li>
          <li>Once rewards are redeemed, the transaction is non-reversible.</li>
          <li>Expired points cannot be reinstated. Please check the expiry terms in your rewards dashboard.</li>
        </ul>

        <h2>6. How to Request a Refund</h2>
        <p>To request a refund, please follow these steps:</p>
        <ul>
          <li>Email us at{' '}
            <a href="mailto:contact@earn4insights.com" className="text-blue-600">contact@earn4insights.com</a>{' '}
            with your refund request.
          </li>
          <li>Alternatively, raise a dispute through the campaign dispute system in your dashboard.</li>
          <li>Our team will respond within <strong>24-48 hours</strong>.</li>
          <li>
            Please include the following in your request:
            <ul>
              <li>Campaign ID</li>
              <li>Transaction ID</li>
              <li>Reason for refund</li>
            </ul>
          </li>
        </ul>

        <h2>7. Contact Us</h2>
        <p>
          If you have any questions about this Refund & Cancellation Policy, please reach out to us:
        </p>
        <ul>
          <li>Email:{' '}
            <a href="mailto:contact@earn4insights.com" className="text-blue-600">contact@earn4insights.com</a>
          </li>
          <li>Website:{' '}
            <a href="https://www.earn4insights.com" className="text-blue-600" target="_blank" rel="noopener noreferrer">
              www.earn4insights.com
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
      <div className="prose max-w-none">
        <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        
        <h2>1. Information We Collect</h2>
        <p>
          We collect information you provide directly to us when you create an account,
          complete surveys, or interact with our platform.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          We use the information we collect to:
        </p>
        <ul>
          <li>Provide and improve our services</li>
          <li>Send you notifications about surveys and rankings</li>
          <li>Analyze platform usage and trends</li>
          <li>Protect against fraud and abuse</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <p>
          We do not sell your personal information. We may share aggregated,
          anonymized data for research and analytics purposes.
        </p>

        <h2>4. Your Rights</h2>
        <p>
          You have the right to access, correct, or delete your personal information
          at any time through your account settings.
        </p>

        <h2>5. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:privacy@earn4insights.com" className="text-blue-600">
            privacy@earn4insights.com
          </a>
        </p>
      </div>
    </div>
  )
}

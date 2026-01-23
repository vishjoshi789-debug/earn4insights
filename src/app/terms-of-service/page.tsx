export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Terms of Service</h1>
      <div className="prose max-w-none">
        <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Earn4Insights, you agree to be bound by these Terms
          of Service and all applicable laws and regulations.
        </p>

        <h2>2. User Accounts</h2>
        <p>
          You are responsible for:
        </p>
        <ul>
          <li>Maintaining the confidentiality of your account credentials</li>
          <li>All activities that occur under your account</li>
          <li>Providing accurate and complete information</li>
        </ul>

        <h2>3. User Content</h2>
        <p>
          By submitting content (surveys, feedback, etc.), you grant us a non-exclusive
          license to use, display, and distribute that content in connection with our services.
        </p>

        <h2>4. Prohibited Activities</h2>
        <p>You may not:</p>
        <ul>
          <li>Use the service for any illegal purpose</li>
          <li>Attempt to gain unauthorized access to our systems</li>
          <li>Submit false or misleading information</li>
          <li>Harass or harm other users</li>
        </ul>

        <h2>5. Termination</h2>
        <p>
          We reserve the right to terminate or suspend your account at any time
          for violations of these terms.
        </p>

        <h2>6. Limitation of Liability</h2>
        <p>
          Earn4Insights is provided "as is" without warranties of any kind.
          We are not liable for any indirect, incidental, or consequential damages.
        </p>

        <h2>7. Contact</h2>
        <p>
          Questions about these Terms? Contact us at{' '}
          <a href="mailto:legal@earn4insights.com" className="text-blue-600">
            legal@earn4insights.com
          </a>
        </p>
      </div>
    </div>
  )
}

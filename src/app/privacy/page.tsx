import React from 'react';


export const metadata = {
  title: 'Privacy Policy | KiloZero',
  description: 'The privacy policy for the KiloZero application, detailing our Zero-Cloud data paradigm and Health Connect integration.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="privacy-container" style={{ padding: '2rem 10%', color: '#e0e0e0', backgroundColor: '#0d1117', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '2.5rem', color: '#58a6ff', marginBottom: '1rem' }}>Privacy Policy for KiloZero</h1>
      <p style={{ fontStyle: 'italic', color: '#8b949e', marginBottom: '2rem' }}>Last Updated: May 6, 2026</p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#c9d1d9', borderBottom: '1px solid #30363d', paddingBottom: '0.5rem', marginBottom: '1rem' }}>1. Introduction</h2>
        <p style={{ lineHeight: '1.6' }}>
          Welcome to KiloZero. We are fundamentally committed to protecting your privacy. This Privacy Policy governs the manner in which KiloZero ("we", "us", "our") collects, uses, maintains, and discloses information collected from users of the KiloZero mobile application (the "App") and the kilozero.io website (the "Site").
        </p>
        <p style={{ lineHeight: '1.6', marginTop: '1rem' }}>
          <strong>Our Core Guarantee: "Zero-Cloud Processing".</strong> The vast majority of health and fitness apps store your most sensitive physiological data on their servers. We do not. All of your personal health data (weight, body fat percentage, and bio-impedance) is processed and stored strictly locally on your device.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#c9d1d9', borderBottom: '1px solid #30363d', paddingBottom: '0.5rem', marginBottom: '1rem' }}>2. Data We Collect and How We Use It</h2>
        
        <h3 style={{ fontSize: '1.3rem', color: '#e6edf3', marginTop: '1.5rem', marginBottom: '0.5rem' }}>a. Local Physiological Data (Zero-Cloud)</h3>
        <p style={{ lineHeight: '1.6' }}>
          When you use KiloZero to connect to a Bluetooth scale or input manual entries, your weight, body fat percentage, and related physiological data are saved to a local, encrypted SQLite database residing purely on your smartphone. We do not transmit, sync, or backup this data to our own servers. You are in complete control of your biological data.
        </p>

        <h3 style={{ fontSize: '1.3rem', color: '#e6edf3', marginTop: '1.5rem', marginBottom: '0.5rem' }}>b. Google Health Connect API</h3>
        <p style={{ lineHeight: '1.6' }}>
          KiloZero integrates with the Google Health Connect API to synchronize your weigh-in metrics (such as Body Mass and Body Fat Percentage) across your ecosystem.
        </p>
        <ul style={{ lineHeight: '1.6', marginLeft: '2rem', marginTop: '0.5rem' }}>
          <li><strong>Limited Use:</strong> Our use of information received from Health Connect adheres strictly to the <a href="https://developers.google.com/health-connect/terms" style={{ color: '#58a6ff' }} target="_blank" rel="noreferrer">Health Connect Permissions and User Data policies</a>. We request access only to the exact data types required for the app to function (Weight and Body Fat).</li>
          <li><strong>No Third-Party Sharing:</strong> We unequivocally do <strong>not</strong> sell, transfer, or disclose your Health Connect data to advertising platforms, data brokers, or any other third-party servers. </li>
          <li><strong>Local Execution:</strong> The interaction with Health Connect occurs directly between the KiloZero App on your device and the Android Health Connect system.</li>
        </ul>

        <h3 style={{ fontSize: '1.3rem', color: '#e6edf3', marginTop: '1.5rem', marginBottom: '0.5rem' }}>c. Opt-In Beta Telemetry & Hardware Logs</h3>
        <p style={{ lineHeight: '1.6' }}>
          To improve our universal Bluetooth scale drivers, KiloZero includes an <strong>opt-in</strong> telemetry feature. If (and only if) you explicitly grant permission within the app settings, KiloZero will transmit diagnostic hardware data to our secure Google Cloud backend.
        </p>
        <ul style={{ lineHeight: '1.6', marginLeft: '2rem', marginTop: '0.5rem' }}>
          <li>This data includes the scale's manufacturer, model number, Bluetooth MAC address, connection success/failure rates, and the raw payload (which includes weight and body fat measurements) directly from the scale.</li>
          <li>This data is collected strictly for the purpose of reverse-engineering universal hardware drivers and troubleshooting connection instability.</li>
          <li>This data is decoupled from your user identity.</li>
        </ul>

        <h3 style={{ fontSize: '1.3rem', color: '#e6edf3', marginTop: '1.5rem', marginBottom: '0.5rem' }}>d. Third-Party Advertising (AdMob)</h3>
        <p style={{ lineHeight: '1.6' }}>
          The App utilizes Google AdMob to display advertisements. AdMob may automatically collect non-personally identifiable diagnostic and usage information (such as device identifiers or ad engagement metrics) to serve targeted advertisements. You can manage your ad preferences via your Android device settings.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#c9d1d9', borderBottom: '1px solid #30363d', paddingBottom: '0.5rem', marginBottom: '1rem' }}>3. Data Retention and Deletion</h2>
        <p style={{ lineHeight: '1.6' }}>
          Because KiloZero operates on a Zero-Cloud architecture, data retention is entirely in your hands. 
        </p>
        <ul style={{ lineHeight: '1.6', marginLeft: '2rem', marginTop: '0.5rem' }}>
          <li><strong>Local Data:</strong> You may delete specific weight entries within the App. To permanently delete all physiological data associated with KiloZero, you simply need to uninstall the application from your device or clear the App's data via your Android settings.</li>
          <li><strong>Health Connect Data:</strong> Data written to Health Connect can be managed or deleted directly through the Google Health Connect application.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#c9d1d9', borderBottom: '1px solid #30363d', paddingBottom: '0.5rem', marginBottom: '1rem' }}>4. Security</h2>
        <p style={{ lineHeight: '1.6' }}>
          We employ industry-standard security measures, including Firebase App Check, to protect against unauthorized access, alteration, or destruction of the App's infrastructure. However, the security of your local physiological data depends on the physical and cryptographic security of your personal Android device (e.g., your lock screen passcode and device encryption).
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#c9d1d9', borderBottom: '1px solid #30363d', paddingBottom: '0.5rem', marginBottom: '1rem' }}>5. Changes to This Privacy Policy</h2>
        <p style={{ lineHeight: '1.6' }}>
          We reserve the right to update this Privacy Policy at any time. When we do, we will revise the "Last Updated" date at the top of this page. We encourage users to frequently check this page for any changes to stay informed about how we are protecting the information we collect.
        </p>
      </section>

      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#c9d1d9', borderBottom: '1px solid #30363d', paddingBottom: '0.5rem', marginBottom: '1rem' }}>6. Contacting Us</h2>
        <p style={{ lineHeight: '1.6' }}>
          If you have any questions about this Privacy Policy, the practices of this app, or your dealings with KiloZero, please contact our administrative and legal team at:
        </p>
        <p style={{ lineHeight: '1.6', marginTop: '1rem', fontWeight: 'bold' }}>
          <a href="mailto:admin@kilozero.io" style={{ color: '#58a6ff', textDecoration: 'none' }}>admin@kilozero.io</a>
        </p>
      </section>
    </div>
  );
}

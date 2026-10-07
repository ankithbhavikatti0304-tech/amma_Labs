import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy notice', description: 'How Amma Labs collects, uses and protects your personal and health information.' };

/*
 * DRAFT FOR LEGAL REVIEW. Written in plain language to match the DPDP Act 2023 notice
 * requirements, but the lab's legal advisor must review it, fill the [bracketed] items, and
 * bump CONSENT_VERSION in config/lab.ts so existing users are asked again.
 */
export default function Privacy() {
  return (
    <div className="wrap" style={{ maxWidth: 760, paddingBlock: 28 }}>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Privacy notice</span></nav>
      <div className="panel" style={{ marginTop: 18, display: 'grid', gap: 14 }}>
        <h1 style={{ fontSize: 30 }}>Privacy notice</h1>
        <p className="muted">Amma Labs, Bengaluru. This is how we handle your information under India&apos;s Digital Personal Data Protection Act, 2023.</p>

        <h2 style={{ fontSize: 19 }}>What we collect</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
          <li>Your name and mobile number, to create your account and send the login code.</li>
          <li>For each person tested: name, age and gender. Gender and age decide which reference range is used on the report.</li>
          <li>Your address and pincode, so we can collect the sample at home.</li>
          <li>The tests you order, the slot you choose, and how you pay. We never see your card or UPI PIN; payments are handled by our payment partner.</li>
          <li>Your test results and reports, and any prescription you upload.</li>
        </ul>

        <h2 style={{ fontSize: 19 }}>Why we use it</h2>
        <p>To book and collect your sample, run your tests, give you the report, tell you about your booking by SMS or WhatsApp, take payment, and answer your calls. We do not sell your information and we do not use your results for advertising.</p>

        <h2 style={{ fontSize: 19 }}>Who can see it</h2>
        <p>Only our staff who need it for your order: the person collecting your sample, the lab team, and the pathologist who checks your report. Our service providers (SMS, WhatsApp, payments and hosting) handle only what they need to do their job. We share your report with a doctor only if you choose to share it.</p>

        <h2 style={{ fontSize: 19 }}>How we protect it</h2>
        <p>Connections are encrypted. Login codes expire in 5 minutes and are stored only as a one-way hash. Reports and prescriptions are kept in private storage and are only opened through a link that checks it is you. We record who opened or changed a report.</p>

        <h2 style={{ fontSize: 19 }}>How long we keep it</h2>
        <p>[Amma Labs to confirm: how many years laboratory records and reports are retained, as required by applicable law.] After that, or earlier if you ask and the law allows, we delete or anonymise it.</p>

        <h2 style={{ fontSize: 19 }}>Your rights</h2>
        <p>You can ask to see what we hold about you, correct it, delete it, or withdraw your consent. You can also nominate someone to act for you. Withdrawing consent means we can no longer provide the service to you. Call us or write to the grievance contact below.</p>

        <h2 style={{ fontSize: 19 }}>Grievance contact</h2>
        <p>[Amma Labs to fill in: name, email and phone of the grievance officer.] If we do not resolve your complaint you may approach the Data Protection Board of India.</p>
      </div>
    </div>
  );
}

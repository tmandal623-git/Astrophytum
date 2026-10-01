// src/pages/PrivacyPage.tsx
import { InfoList, InfoPage, InfoSection } from '../components/info/InfoPage';
import { STORE } from '../config/store';

const strong = 'text-gray-800 dark:text-gray-200';

export function PrivacyPage() {
  return (
    <InfoPage
      icon="🔒"
      title="Privacy Policy"
      subtitle={`How ${STORE.name} collects, uses and protects your information.`}
      updated="1 October 2026"
    >
      <InfoSection title="Information we collect">
        <InfoList items={[
          <><strong className={strong}>Account details</strong> — your username, email address and password. Passwords are stored only in hashed form; we never see or store the plain text.</>,
          <><strong className={strong}>Order details</strong> — your name, email, phone number, delivery address, the items you buy and the payment transaction ID (UTR) you provide.</>,
          <><strong className={strong}>Auction activity</strong> — the bids you place and their amounts and times.</>,
          <><strong className={strong}>Messages</strong> — anything you send us by email or through the contact page.</>,
        ]} />
        <p>
          We do <strong className={strong}>not</strong> receive or store your card numbers, bank details or UPI PIN —
          payments are completed inside your own Google Pay / UPI app.
        </p>
      </InfoSection>

      <InfoSection title="How we use it">
        <InfoList items={[
          'To create and secure your account.',
          'To process orders, verify payments and deliver your plants.',
          'To run auctions and show your bid status.',
          'To send order confirmations, shipping updates and password-reset emails.',
          'To answer your questions and resolve problems.',
          'To prevent fraud and keep the site secure.',
        ]} />
        <p>We do not sell your personal information.</p>
      </InfoSection>

      <InfoSection title="Cookies & local storage">
        <InfoList items={[
          <><strong className={strong}>Login cookie</strong> — a secure, HTTP-only cookie that keeps you signed in. It is required for your account to work.</>,
          <><strong className={strong}>Local storage</strong> — your guest cart, your light/dark theme choice and the time of your last activity (used to log you out automatically after 5 minutes of inactivity).</>,
        ]} />
        <p>We don't use advertising or third-party tracking cookies.</p>
      </InfoSection>

      <InfoSection title="Who we share it with">
        <p>Only what's needed to complete your order:</p>
        <InfoList items={[
          'Delivery partners receive your name, phone number and address to deliver your parcel.',
          'Our email provider sends order and account emails on our behalf.',
          'Authorities, if we are legally required to.',
        ]} />
      </InfoSection>

      <InfoSection title="How long we keep it">
        <p>
          We keep account information while your account is active, and order records for as long as needed for
          accounting, tax and legal purposes. You can ask us to delete your account at any time.
        </p>
      </InfoSection>

      <InfoSection title="Your rights">
        <p>You can ask us to:</p>
        <InfoList items={[
          'Give you a copy of the personal data we hold about you.',
          'Correct information that is wrong or out of date.',
          'Delete your account and personal data (except records we must keep by law).',
        ]} />
        <p>
          Email <a href={`mailto:${STORE.email}`} className="text-cactus-600 dark:text-cactus-400 font-medium hover:underline break-all">{STORE.email}</a> and
          we'll respond as soon as we can.
        </p>
      </InfoSection>

      <InfoSection title="Security">
        <p>
          Passwords are hashed, your session is kept in an HTTP-only cookie, and you're logged out automatically after
          a period of inactivity. No system is perfectly secure, so please use a strong, unique password.
        </p>
      </InfoSection>

      <InfoSection title="Changes to this policy">
        <p>
          We may update this policy from time to time. The “Last updated” date at the top shows when it last changed.
        </p>
      </InfoSection>
    </InfoPage>
  );
}

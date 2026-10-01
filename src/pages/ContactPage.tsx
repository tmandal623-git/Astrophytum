// src/pages/ContactPage.tsx
// No contact API exists yet, so the form opens the user's email app with the message pre-filled.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { InfoPage } from '../components/info/InfoPage';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { STORE } from '../config/store';
import { cn } from '../utils/cn';

const SUBJECTS = ['Order question', 'Payment verification', 'Auctions', 'Shipping & returns', 'Plant care', 'Other'];

interface ContactForm { name: string; email: string; subject: string; orderNumber: string; message: string; }
const EMPTY_FORM: ContactForm = { name: '', email: '', subject: SUBJECTS[0], orderNumber: '', message: '' };

const inputCls = (err?: string) => cn(
  'w-full px-3 py-2.5 text-sm border rounded-lg bg-white dark:bg-gray-900',
  'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
  'focus:outline-none focus:ring-2 focus:ring-cactus-500 transition-colors',
  err ? 'border-red-400' : 'border-gray-200 dark:border-gray-700',
);

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function ContactPage() {
  const { user }      = useAuth();
  const { showToast } = useToast();
  const [form,   setForm]   = useState<ContactForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});

  // Pre-fill from the logged-in account
  useEffect(() => {
    if (user) setForm(f => ({ ...f, name: f.name || user.username, email: f.email || user.email }));
  }, [user]);

  const set = (key: keyof ContactForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (!form.name.trim()) err.name = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = 'Valid email required';
    if (form.message.trim().length < 10) err.message = 'Please write at least 10 characters';
    setErrors(err);
    if (Object.keys(err).length) return;

    const subject = `[${form.subject}]${form.orderNumber ? ` Order ${form.orderNumber.trim()}` : ''}`;
    const body = [
      form.message.trim(),
      '',
      '—',
      `Name: ${form.name.trim()}`,
      `Email: ${form.email.trim()}`,
      form.orderNumber && `Order number: ${form.orderNumber.trim()}`,
    ].filter(Boolean).join('\n');

    window.location.href = `mailto:${STORE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showToast('Opening your email app — just press send.', 'info');
  };

  const channels = [
    { icon: '✉️', label: 'Email',  value: STORE.email,   href: `mailto:${STORE.email}` },
    STORE.phone   && { icon: '📞', label: 'Phone',   value: STORE.phone,   href: `tel:${STORE.phone.replace(/\s/g, '')}` },
    { icon: '🕒', label: 'Support hours', value: STORE.hours },
    STORE.address && { icon: '📍', label: 'Address', value: STORE.address },
  ].filter(Boolean) as { icon: string; label: string; value: string; href?: string }[];

  return (
    <InfoPage
      icon="💬"
      title="Contact Us"
      subtitle="Questions about an order, a payment or a plant? We usually reply within one business day."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Contact channels */}
        <div className="flex flex-col gap-3">
          {channels.map(({ icon, label, value, href }) => (
            <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">{icon}</span>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                {href
                  ? <a href={href} className="text-sm font-medium text-cactus-600 dark:text-cactus-400 hover:underline break-all">{value}</a>
                  : <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{value}</p>}
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
            Many answers are already in our <Link to="/faq" className="text-cactus-600 dark:text-cactus-400 hover:underline">FAQ</Link>.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate
          className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <h2 className="sm:col-span-2 font-display text-xl text-gray-900 dark:text-white">Send us a message</h2>
          <Field label="Name" error={errors.name}>
            <input className={inputCls(errors.name)} value={form.name} onChange={set('name')} placeholder="Jane Smith" />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" className={inputCls(errors.email)} value={form.email} onChange={set('email')} placeholder="jane@example.com" />
          </Field>
          <Field label="Topic">
            <select className={inputCls()} value={form.subject} onChange={set('subject')}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Order number (optional)">
            <input className={inputCls()} value={form.orderNumber} onChange={set('orderNumber')} placeholder="CM-000123" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Message" error={errors.message}>
              <textarea rows={5} className={cn(inputCls(errors.message), 'resize-y')} value={form.message} onChange={set('message')}
                placeholder="How can we help?" />
            </Field>
          </div>
          <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-gray-400">This opens your email app with your message ready to send.</p>
            <button type="submit"
              className="px-6 py-2.5 bg-cactus-600 hover:bg-cactus-700 text-white text-sm font-semibold rounded-lg transition-colors">
              Send Message
            </button>
          </div>
        </form>
      </div>
    </InfoPage>
  );
}

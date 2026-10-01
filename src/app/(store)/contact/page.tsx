import { getSettings } from '@/lib/data/content';
import { ContactForm } from './contact-form';
import { InstagramIcon, WhatsAppIcon } from '@/components/ui/icons';
import { meta } from '@/lib/seo';

export const revalidate = 300;
export const generateMetadata = () => meta({ title: 'Contact', description: 'Get in touch with Hairver Green in Lagos — orders, custom units and hair advice.', path: '/contact' });

export default async function Contact() {
  const { store } = await getSettings();
  return (
    <div className="container-x grid gap-14 py-14 md:py-20 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <p className="eyebrow">Contact</p>
        <h1 className="display-2 mt-3">We&apos;d love to hear from you.</h1>
        <p className="lede mt-5">Questions about textures, a custom unit or an order? Our team replies personally{store.support_hours ? `, ${store.support_hours}` : ''}.</p>
        <dl className="mt-10 space-y-5 text-[15px]">
          {store.email && <div><dt className="label">Email</dt><dd className="mt-1"><a href={`mailto:${store.email}`} className="link-underline">{store.email}</a></dd></div>}
          {store.phone && <div><dt className="label">Phone</dt><dd className="mt-1"><a href={`tel:${store.phone}`}>{store.phone}</a></dd></div>}
          {store.whatsapp && <div><dt className="label">WhatsApp</dt><dd className="mt-1"><a href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 link-underline"><WhatsAppIcon width={16} height={16} /> Chat with us</a></dd></div>}
          {store.instagram && <div><dt className="label">Instagram</dt><dd className="mt-1"><a href={store.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 link-underline"><InstagramIcon width={16} height={16} /> @hairvergreen</a></dd></div>}
          <div><dt className="label">Studio</dt><dd className="mt-1">{store.address}</dd></div>
        </dl>
      </div>
      <div className="lg:col-span-6 lg:col-start-7"><ContactForm /></div>
    </div>
  );
}

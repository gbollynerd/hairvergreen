import { ConsultationForm } from '@/components/services/consultation-form';
import { meta } from '@/lib/seo';

export const generateMetadata = () => meta({ title: 'Book a Consultation', description: 'Book a hair consultation with Hairver Green — custom units, wig customisation and hair services in Lagos or online.', path: '/services/consultation' });

export default async function Consultation({ searchParams }: PageProps<'/services/consultation'>) {
  const sp = await searchParams;
  const kind = sp.type === 'service' ? 'service' : 'consultation';
  return (
    <div className="container-x grid gap-14 py-14 md:py-20 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <p className="eyebrow">Services</p>
        <h1 className="display-2 mt-3">{kind === 'service' ? 'Wig customisation & hair services' : 'Book a consultation'}</h1>
        <p className="lede mt-5">Tell us about the look you want. A stylist will get back to you to schedule a call, a studio visit in Lagos, or a video consultation wherever you are.</p>
        <ul className="mt-8 space-y-3 text-[15px] text-muted"><li>· Custom units designed with you</li><li>· Wig customisation — plucking, bleaching, cutting, colour</li><li>· Install and styling appointments</li><li>· Advice on texture, length and density</li></ul>
      </div>
      <div className="lg:col-span-6 lg:col-start-7"><ConsultationForm kind={kind} /></div>
    </div>
  );
}

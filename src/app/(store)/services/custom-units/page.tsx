import { supabasePublic } from '@/lib/supabase/public';
import { getProduct } from '@/lib/data/catalog';
import { DEFAULT_CUSTOM_UNIT, type CustomUnitConfig } from '@/lib/commerce/custom-unit';
import { CustomUnitConfigurator } from '@/components/services/custom-unit-configurator';
import { Media } from '@/components/ui/media';
import { Reveal } from '@/components/ui/reveal';
import { meta } from '@/lib/seo';

export const revalidate = 300;
export const generateMetadata = () => meta({ title: 'Custom Units — Made Around You', description: 'Design a custom wig unit with Hairver Green in Lagos: choose hair, texture, length, lace, density, colour and finish. Confirmed with you before production.', path: '/services/custom-units' });

export default async function CustomUnits() {
  const [product, { data: cfgRow }] = await Promise.all([
    getProduct('custom-unit'),
    supabasePublic().from('settings').select('value').eq('key', 'custom_unit').maybeSingle(),
  ]);
  const cfg = (cfgRow?.value as CustomUnitConfig) || DEFAULT_CUSTOM_UNIT;
  const steps = ['Choose your hair', 'Choose length', 'Choose texture', 'Choose lace', 'Choose density', 'Choose colour', 'Add customisation', 'Submit & confirm'];
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-contrast">
        <div className="grid lg:grid-cols-2">
          <div className="flex items-center px-6 py-20 md:px-14 lg:px-20">
            <div className="max-w-xl">
              <p className="eyebrow !text-accent">Custom units</p>
              <h1 className="display-1 mt-5">Crafted around you.</h1>
              <p className="mt-6 text-[17px] leading-8 text-primary-contrast/75">Choose every detail — hair, lace, density, colour and finish. Our team confirms your configuration with you before a single strand is ventilated.</p>
              <div className="mt-8 flex flex-wrap gap-3"><a href="#configure" className="btn btn-light">Design your unit</a><a href="/services/consultation" className="btn btn-ghost-light">Book a consultation</a></div>
            </div>
          </div>
          <div className="relative min-h-[380px]"><Media src={product?.media[0]?.media.url ?? '/demo/custom-unit.svg'} alt="" fill priority sizes="50vw" /></div>
        </div>
      </section>
      <section className="container-x py-16 md:py-24">
        <ol className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {steps.map((s, i) => <Reveal as="li" key={s} delay={(i % 4) * 70} className="border-t border-line pt-4"><span className="font-display text-[26px] text-accent-strong">{String(i + 1).padStart(2, '0')}</span><p className="mt-1 text-[15px]">{s}</p></Reveal>)}
        </ol>
      </section>
      <section id="configure" className="scroll-mt-32 bg-panel py-16 md:py-24">
        <div className="container-x">
          {product ? <CustomUnitConfigurator productId={product.id} variantId={product.variants[0]?.id} basePrice={product.variants[0]?.price ?? product.price} config={cfg} />
            : <p className="text-center text-muted">The custom unit configurator is being set up. Please <a href="/services/consultation" className="underline">book a consultation</a>.</p>}
        </div>
      </section>
    </>
  );
}

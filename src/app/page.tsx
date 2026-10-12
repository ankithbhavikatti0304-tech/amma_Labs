import Link from 'next/link';
import { cookies } from 'next/headers';
import { getCatalogue } from '@/server/catalogue';
import { Character } from '@/components/character/Character';
import { CategoryArt } from '@/components/catalogue/Listing';
import { ProductCard } from '@/components/catalogue/ProductCard';
import { CallButton, HeroSearch, PackageRail, UploadButton, WhatsAppLink } from '@/components/home/HomeParts';
import { Icon } from '@/components/Icon';
import { CITIES, CITY_COOKIE, DEFAULT_CITY } from '@/config/lab';
import { CLAIMS } from '@/config/claims';
import { inCategory, mostBooked } from '@/lib/catalogue';
import { inr } from '@/lib/money';

const bar = (x: string) => ({ ['--x' as string]: x });

export default async function Home() {
  const [{ categories, tests, settings }, jar] = await Promise.all([getCatalogue(), cookies()]);
  const c = jar.get(CITY_COOKIE)?.value ?? '';
  const city = (CITIES as readonly string[]).includes(c) ? c : DEFAULT_CITY;
  const marquee = [
    ...(CLAIMS.nabl ? ['NABL-certified lab'] : []),
    'Doctor-verified reports',
    `Free home collection above ${inr(settings.freeCollectionAbove)}`,
    'Reports on WhatsApp',
    'Slots from 6 am, all 7 days',
    'Pay at collection',
    'Trained phlebotomists',
  ];

  return (
    <>
      <section className="wrap hero">
        <div className="bento">
          <div className="b-main">
            <span className="eyebrow"><i />Collecting today in {city}</span>
            <h1>Lab tests at home.<br />Reports <span className="mark">on your phone.</span></h1>
            <p className="lede">Book in a minute. A trained phlebotomist collects your sample at home, and your report reaches your phone with every value marked against its normal range.</p>
            <HeroSearch />
            <div className="quick">Popular:
              <Link className="chip" href="/category/full">Full body</Link>
              <Link className="chip" href="/category/thyroid">Thyroid</Link>
              <Link className="chip" href="/category/vitamin">Vitamins</Link>
              <Link className="chip" href="/category/diabetes">Diabetes</Link>
            </div>
            <div className="chans">
              <WhatsAppLink className="chan wa">Book on WhatsApp</WhatsAppLink>
              <CallButton className="chan"><span className="ic"><Icon name="phone" size={18} /></span>Book by phone</CallButton>
              <UploadButton className="chan"><span className="ic"><Icon name="rx" size={18} /></span>Upload prescription</UploadButton>
            </div>
          </div>

          <div className="b-phone">
            <span className="ring r1" /><span className="ring r2" />
            <h3>Your report, explained in plain view</h3>
            <p>Each value shows where it sits in the normal range, verified by our pathologist.</p>
            <span className="gchip c2"><Icon name="check" size={14} /> Doctor-verified</span>
            {CLAIMS.nabl ? <span className="gchip c1"><Icon name="shield" size={14} /> NABL-certified lab</span> : null}
            <div className="phone" aria-hidden="true"><div className="scr"><span className="notch" /><span className="stat">9:41</span>
              <div className="ptoast"><span className="pm" /><span><b>Amma Labs · now</b>Your Thyroid report is ready</span></div>
              <div className="pcard"><div><h4>Thyroid Profile</h4><small>Example report</small></div>
                <div className="prow"><span>TSH</span><span>2.14 <span className="pflag">Normal</span></span><div className="pbar"><i style={bar('48%')} /></div></div>
                <div className="prow"><span>T3, total</span><span>112 <span className="pflag">Normal</span></span><div className="pbar"><i style={bar('41%')} /></div></div>
                <div className="prow"><span>T4, total</span><span>8.6 <span className="pflag">Normal</span></span><div className="pbar"><i style={bar('55%')} /></div></div>
              </div>
              <div className="pcard"><div className="prow"><span>Vitamin D</span><span>24.1 <span className="pflag l">Low</span></span><div className="pbar"><i className="lo" style={bar('19%')} /></div></div></div>
              <div className="pbtn">Share with my doctor</div>
            </div></div>
          </div>

          <div className="b-mini b-pick"><div><b>Home sample pickup</b><span>From 6 am, all 7 days. Free above {inr(settings.freeCollectionAbove)}.</span></div><Character id="nurse" size="lg" /></div>
          <div className="b-mini b-fast"><b className="big-n">12–24h</b><span>Most reports reach your phone by the next day.</span>
            <div className="bars" aria-hidden="true">{[30, 45, 38, 60, 52, 74, 100].map((h, i) => <i key={i} style={{ ['--h' as string]: `${h}%`, animationDelay: `${i * 0.06}s` }} />)}</div></div>
        </div>
        <div className="marquee" aria-label="Why Amma Labs"><div className="mq">
          {marquee.map((m) => <span key={m}><Icon name="shield" size={18} />{m}</span>)}
          {marquee.map((m) => <span key={`b-${m}`} aria-hidden="true"><Icon name="shield" size={18} />{m}</span>)}
        </div></div>
      </section>

      <section className="wrap sec">
        <div className="sec-head"><div><span className="eyebrow">Browse</span><h2>What are you testing for?</h2></div><Link className="link" href="/tests">All {tests.length} tests →</Link></div>
        <div className="cats">
          {categories.map((cat) => (
            <Link key={cat.id} className={`cat t-${cat.tint}`} href={`/category/${cat.id}`}>
              <span><b>{cat.name}</b><small>{inCategory(tests, cat.id).length} options</small></span>
              <span className="arr"><Icon name="arrow" size={14} /></span>
              <CategoryArt c={cat} size="md" />
            </Link>
          ))}
        </div>
      </section>

      <PackageRail />

      <section className="wrap sec" id="how">
        <div className="sec-head"><div><span className="eyebrow">How it works</span><h2>Three steps, no queue</h2></div></div>
        <div className="steps">
          <div className="step"><span className="n">Step 1</span><Character id="booking" size="lg" /><h3>Book in a minute</h3><p>Add tests online, send your cart on WhatsApp, or call us. Log in with your number and a one-time code.</p></div>
          <div className="step"><span className="n">Step 2</span><Character id="nurse" size="lg" /><h3>We come to you</h3><p>A trained phlebotomist collects your sample at home in the slot you pick, from 6 am.</p></div>
          <div className="step"><span className="n">Step 3</span><Character id="report" size="lg" /><h3>Report on your phone</h3><p>Usually within 12–24 hours, with each value flagged as normal, high or low.</p></div>
        </div>
      </section>

      <section className="wrap sec">
        <div className="sec-head"><div><span className="eyebrow">Single tests</span><h2>Most booked tests</h2></div><Link className="link" href="/tests">See all →</Link></div>
        <div className="grid">{mostBooked(tests).map((t) => <ProductCard key={t.id} t={t} />)}</div>
      </section>

      <section className="wrap"><div className="cta">
        <span className="ring" />
        <div style={{ position: 'relative', zIndex: 1 }}><h2>Not sure which test you need?</h2>
          <p>Send us your symptoms or your doctor&apos;s prescription. Our team suggests the right tests and books a slot for you.</p>
          <div className="bar"><WhatsAppLink className="btn white">Chat on WhatsApp</WhatsAppLink><CallButton className="btn glass"><Icon name="phone" size={18} /> {settings.phone}</CallButton></div></div>
        <div className="dolls"><Character id="swom" size="lg" /><Character id="madv" size="lg" /><Character id="faw" size="lg" /></div>
      </div></section>
    </>
  );
}

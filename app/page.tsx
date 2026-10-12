import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Coins, MapPinned, Store } from "lucide-react";

const houses = ["house-coral", "house-green", "house-gold", "house-blue", "house-peach"];

export default function Home() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-grid" aria-hidden="true" />
        <div className="landing-skyline" aria-hidden="true">
          {houses.map((house, index) => <div className={`sky-house ${house}`} key={house} style={{ "--house-index": index } as React.CSSProperties}><span /><i /></div>)}
          <div className="sky-tree tree-one" /><div className="sky-tree tree-two" />
          <div className="street-ribbon"><span>HUSTLE STREET</span><i /> <small>LAGOS, NIGERIA</small></div>
        </div>
        <header className="landing-nav">
          <Link href="/" className="brand-lockup" aria-label="Naija Business Tycoon home"><span className="brand-mark"><Store size={20} strokeWidth={2.4} /></span><span><strong>NAIJA</strong><small>BUSINESS TYCOON</small></span></Link>
          <span className="prototype-label">LOCAL PROTOTYPE <i /></span>
        </header>
        <div className="landing-copy">
          <div className="eyebrow light-eyebrow"><span /> A LITTLE STREET WITH BIG PLANS</div>
          <h1>Make it on<br /><em>Hustle Street.</em></h1>
          <p>Six plots, three businesses, one ₦50,000 head start. Your corner of Lagos is ready when you are.</p>
          <Link href="/game" className="landing-cta">Play Now <ArrowUpRight size={19} /></Link>
          <div className="landing-trust"><span><Coins size={15} /> ₦50,000 to start</span><i /><span><MapPinned size={15} /> Your own block</span></div>
        </div>
        <div className="landing-bottom"><span>THE NEIGHBORHOOD IS YOURS TO BUILD</span><a href="#how-it-works">Take a look <ArrowDownRight size={15} /></a></div>
      </section>

      <section id="how-it-works" className="landing-details">
        <div><span className="eyebrow">FIRST THINGS FIRST</span><h2>Start small.<br /><em>Build with purpose.</em></h2></div>
        <p>Pick an empty plot, choose a neighborhood business, and make it yours. Your progress stays right here on this device.</p>
        <div className="starter-businesses"><span><b>01</b> POS kiosk</span><span><b>02</b> Provision shop</span><span><b>03</b> Food stand</span></div>
        <Link href="/game" className="details-link">Step onto the street <ArrowUpRight size={17} /></Link>
      </section>
      <footer className="landing-footer"><span>NAIJA BUSINESS TYCOON</span><span>Phase 1 · The first storefront</span></footer>
    </main>
  );
}

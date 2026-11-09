import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import './ModeDestinations.css';

export default function ModeDestinations({ onPersonal }) {
  return <nav className="mode-destinations" aria-label="Explore vocabulary modes">
    <a className="mode-destination mode-personal" href="?mode=personal" onClick={event => {
      if (onPersonal && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault(); onPersonal();
      }
    }}>
      <span className="mode-monogram" aria-hidden="true"><span>MY</span><span>VV</span></span>
      <span className="mode-copy"><span className="mode-name">My Vocabulary</span><span className="mode-description">Heard it? Keep it. Make it yours.</span></span>
      <ArrowUpRight aria-hidden="true"/>
    </a>
    <a className="mode-destination mode-personal" href="?mode=personal&amp;studio=thesaurus">
      <span className="mode-monogram" aria-hidden="true">TH</span>
      <span className="mode-copy"><span className="mode-name">Intelligent Thesaurus</span><span className="mode-description">Find the word that fits.</span></span>
      <ArrowUpRight aria-hidden="true"/>
    </a>
    <a className="mode-destination mode-aave" href="https://aave-ebon.vercel.app/" target="_blank" rel="noreferrer">
      <span className="mode-monogram" aria-hidden="true"><span>AA</span><span>VE</span></span>
      <span className="mode-copy"><span className="mode-name">AAVE Ebon</span><span className="mode-description">Slang, expression & the culture.</span></span>
      <ArrowUpRight aria-hidden="true"/>
    </a>
  </nav>;
}

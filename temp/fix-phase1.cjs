const fs = require("fs");
const path = require("path");

function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
  console.log("wrote", p);
}

// ---------- 1) FR FAQ paste (faq-i18n.js) ----------
{
  let s = fs.readFileSync("public/v2/faq-i18n.js", "utf8");
  const replacements = [
    // q1 A FR
    [
      /Eastern OS est un <strong>dialogue multi-tours de décision<\/strong> pour un choix bloqué\. En une course tu obtiens : le dialogue ; une <strong>voie principale<\/strong> et une <strong>de secours<\/strong> ; un <strong>rapport de décision<\/strong> rouvrable dans ce navigateur ; et des rappels quotidiens 30 jours sur la même ligne <em>fournis ensemble<\/em> \(pas un achat séparé\)\./,
      "Eastern OS est un <strong>dialogue multi-tours de décision</strong> pour un choix bloqué. En une <strong>session</strong> tu obtiens : le dialogue ; une <strong>voie principale</strong> et une <strong>de secours</strong> ; un <strong>rapport de décision</strong> rouvrable dans ce navigateur ; et des rappels quotidiens 30 jours sur la même ligne <em>fournis ensemble</em> (pas un achat séparé)."
    ],
    // q2 A FR
    [
      /<strong>1 PASS<\/strong> = une course complète : dialogue multi-tours → voie principale \+ secours \+ rapport → rappels quotidiens 30 jours <em>fournis ensemble<\/em>\. Prix d'un Pass unitaire : <strong>\$19\.99<\/strong> \(une fois\)\. Un abonnement accorde des PASS chaque mois au lieu d'acheter un par un—voir Forfaits & facturation\./,
      "<strong>1 PASS</strong> = une <strong>session complète</strong> : dialogue multi-tours → voie principale + secours + rapport → rappels quotidiens 30 jours <em>fournis ensemble</em>. Prix d'un Pass unitaire : <strong>$19.99</strong> (une fois). Un abonnement accorde des PASS chaque mois au lieu d'acheter un par un—voir Forfaits & facturation."
    ],
  ];
  // Safer: parse as JS object via Function if it's `window.V2_FAQ_I18N = {...}`
  // Fall back to surgical string replaces for known FR strings.
  const frFixes = [
    ["En une course tu obtiens", "En une <strong>session</strong> tu obtiens"],
    ["En une course tu obtiens", "En une <strong>session</strong> tu obtiens"], // noop if already
    ["= une course complète", "= une <strong>session complète</strong>"],
    ["d'historique de chat.", "d'historique de <strong>conversation</strong>."],
    ["d’historique de chat.", "d’historique de <strong>conversation</strong>."],
    ["sauvegarde de mon chat ?", "sauvegarde de ma <strong>conversation</strong> ?"],
    ["sauvegarde du chat.", "sauvegarde de la <strong>conversation</strong>."],
    ["pas l'historique de chat.", "pas l'historique de <strong>conversation</strong>."],
    ["pas l’historique de chat.", "pas l’historique de <strong>conversation</strong>."],
  ];
  for (const [a,b] of frFixes) {
    if (s.includes(a)) { s = s.split(a).join(b); console.log("FAQ replace:", a.slice(0,40)); }
    else console.log("FAQ miss:", a.slice(0,40));
  }
  write("public/v2/faq-i18n.js", s);
}

// ---------- 2) Landing How Stage4 + Privacy FR ----------
{
  let s = fs.readFileSync("public/v2-landing.html", "utf8");
  const landFixes = [
    ['"stage4.youGet": "Des routes concrètes—pas un chat qui disparaît."',
     '"stage4.youGet": "Des routes concrètes—pas une <strong>conversation</strong> qui disparaît."'],
    // Privacy C1 already starts with Ta conversation per earlier read — verify Ton chat
    ["Ton chat et le rapport", "Ta <strong>conversation</strong> et le rapport"],
    ["Ton <strong>chat</strong> et le rapport", "Ta <strong>conversation</strong> et le rapport"],
  ];
  for (const [a,b] of landFixes) {
    if (s.includes(a)) { s = s.split(a).join(b); console.log("LAND replace:", a.slice(0,50)); }
    else console.log("LAND miss:", a.slice(0,50));
  }

  // Hero: omit energy/cosmic carousel slides (interim per SoT §10)
  const oldCarousel = `<div class="v2-product-carousel" id="v2-product-carousel" aria-live="polite">
<img class="is-active" alt="Eastern OS — product preview" width="1600" height="900" src="/v2/v2.png" decoding="async"/>
<img alt="" width="1600" height="900" src="/v2/V3.png" decoding="async"/>
<img alt="" width="1600" height="900" src="/v2/v4.png" decoding="async"/>
</div>`;
  const newCarousel = `<div class="v2-product-carousel v2-product-carousel--placeholder" id="v2-product-carousel" aria-live="polite">
<!-- Must-fix 10 interim: omit v2/V3/v4 mocks (baked-in Daily Cosmic Resonance / Personal Energy Profile / True solar) until redraw -->
<div class="v2-product-placeholder" role="img" aria-label="Decision dialogue preview">
<p class="v2-product-placeholder__eyebrow" data-preview-caption="eyebrow">Eastern OS</p>
<p class="v2-product-placeholder__title" data-preview-caption="title">Decision dialogue preview</p>
<p class="v2-product-placeholder__sub" data-preview-caption="sub">Main path · backup · reopenable report — mock UI redraw coming soon.</p>
</div>
</div>`;
  if (s.includes('src="/v2/v2.png"') && s.includes('src="/v2/V3.png"')) {
    // more flexible replace
    s = s.replace(
      /<div class="v2-product-carousel" id="v2-product-carousel"[^>]*>[\s\S]*?<\/div>\s*(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/section>)/,
      newCarousel + "\n"
    );
    console.log("LAND hero carousel omitted");
  } else {
    console.log("LAND hero carousel pattern miss — trying alt");
  }

  // Strengthen CSS: hide any remaining energy mock imgs + style placeholder
  if (!s.includes("v2-product-placeholder__title")) {
    // CSS will be injected below
  }
  const cssInject = `
        /* Must-fix 10 v1.1: omit energy/cosmic mock slides; placeholder only */
        .v2-product-carousel--placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: clamp(16rem, 36vw, 24rem);
          background: linear-gradient(160deg, #0b1020 0%, #12182a 55%, #0a0e18 100%);
        }
        .v2-product-placeholder {
          text-align: center;
          padding: 2.5rem 1.5rem;
          max-width: 36rem;
        }
        .v2-product-placeholder__eyebrow {
          font-size: 0.7rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #d4af37;
          margin: 0 0 0.75rem;
        }
        .v2-product-placeholder__title {
          font-size: clamp(1.25rem, 2.5vw, 1.75rem);
          font-weight: 700;
          color: #f8fafc;
          margin: 0 0 0.75rem;
        }
        .v2-product-placeholder__sub {
          font-size: 0.9rem;
          color: #94a3b8;
          margin: 0;
          line-height: 1.5;
        }
        /* Never show energy/cosmic mock frames if reintroduced */
        .v2-product-carousel img[src*="v2.png"],
        .v2-product-carousel img[src*="V2.png"],
        .v2-product-carousel img[src*="V3.png"],
        .v2-product-carousel img[src*="v3.png"],
        .v2-product-carousel img[src*="v4.png"],
        .v2-product-carousel img[src*="V4.png"] {
          display: none !important;
        }
`;
  if (!s.includes("v2-product-carousel--placeholder {")) {
    s = s.replace(
      /\/\* Crop baked-in energy\/cosmic title bands[\s\S]*?\.v2-hero-slide\[data-mock="cosmic"\] \{\s*display: none !important;\s*\}/,
      (m) => m + "\n" + cssInject
    );
    // fallback inject before </style> in that block
    if (!s.includes("v2-product-carousel--placeholder {")) {
      s = s.replace("</style>\n<script>\n      tailwind.config", cssInject + "\n        </style>\n<script>\n      tailwind.config");
    }
    console.log("LAND CSS placeholder injected");
  }

  // Fix conflicting object-position that undoes crop (if imgs ever return)
  s = s.replace(
    /\.v2-product-carousel img\.is-active \{([\s\S]*?)object-position:\s*top center;/g,
    (m) => m.replace("object-position: top center;", "object-position: center 40%; /* hide top energy chrome */")
  );
  s = s.replace(
    /\.v2-product-carousel img:not\(\.is-active\) \{([\s\S]*?)object-position:\s*top center;/g,
    (m) => m.replace("object-position: top center;", "object-position: center 40%;")
  );

  write("public/v2-landing.html", s);
}

console.log("phase1 done");

import fs from "node:fs/promises";
import path from "node:path";

export const TIKTOK_SELLER_DEMO_STEPS = [
  "register",
  "login",
  "business-name",
  "ein",
  "legal-name",
  "residential-address",
  "primary-product-category",
  "shop-name",
  "review-app-kyc",
] as const;

export type TiktokSellerDemoStep = (typeof TIKTOK_SELLER_DEMO_STEPS)[number];

const FIXTURE_ROOT = path.join(
  process.cwd(),
  "src/features/web/tiktok-seller-demo/fixtures",
);
const GOOGLE_MAPS_KEY_PLACEHOLDER = "__BUGLOGIN_GOOGLE_MAPS_API_KEY__";

function injectRuntimeSecrets(html: string): string {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  return html.replaceAll(GOOGLE_MAPS_KEY_PLACEHOLDER, mapsApiKey);
}

export function resolveTiktokSellerDemoStep(
  slug?: string[],
): TiktokSellerDemoStep | null {
  if (!slug || slug.length === 0) {
    return "register";
  }

  const step = slug.join("/");
  if ((TIKTOK_SELLER_DEMO_STEPS as readonly string[]).includes(step)) {
    return step as TiktokSellerDemoStep;
  }

  return null;
}

export async function readTiktokSellerDemoDocument(
  step: TiktokSellerDemoStep,
): Promise<string> {
  const docPath = path.join(FIXTURE_ROOT, `${step}.html`);
  const source = await fs.readFile(docPath, "utf8");
  return injectRuntimeSecrets(source);
}

export function buildTiktokSellerDemoDocument(
  html: string,
  currentStep: TiktokSellerDemoStep,
  mode: "demo" | "raw",
): string {
  if (mode === "raw") {
    return html;
  }

  const withoutScripts = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );

  const navScript = `<style id="buglogin-tiktok-seller-demo-style">
#buglogin-demo-toolbar {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 2147483647;
  background: rgba(11, 15, 25, 0.92);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 10px;
  padding: 10px;
  width: 360px;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
  box-shadow: 0 12px 40px rgba(0,0,0,0.45);
}
#buglogin-demo-toolbar h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .02em;
  text-transform: uppercase;
  opacity: 0.9;
}
#buglogin-demo-toolbar .row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
#buglogin-demo-toolbar select,
#buglogin-demo-toolbar button {
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(255,255,255,0.08);
  color: #fff;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}
#buglogin-demo-toolbar button { cursor:pointer; }
#buglogin-demo-toolbar .status {
  background: rgba(33, 40, 53, 0.78);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 6px;
  padding: 8px;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
}
#buglogin-demo-toolbar .tag {
  display:inline-flex;
  align-items:center;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.2);
  padding: 2px 8px;
  font-size: 11px;
}
</style>
<div id="buglogin-demo-toolbar">
  <h3>TikTok Seller Demo Mode</h3>
  <div class="row">
    <span class="tag">step: ${currentStep}</span>
    <button id="bl-demo-prev" type="button">Back</button>
    <button id="bl-demo-next" type="button">Next</button>
  </div>
  <div class="row">
    <select id="bl-demo-step"></select>
    <button id="bl-demo-go" type="button">Go</button>
    <button id="bl-demo-fill" type="button">Autofill</button>
    <button id="bl-demo-validate" type="button">Validate</button>
  </div>
  <div id="bl-demo-status" class="status">ready</div>
</div>
<script id="buglogin-tiktok-seller-demo-script">
(function(){
  const STEPS = ${JSON.stringify(TIKTOK_SELLER_DEMO_STEPS)};
  const CURRENT = ${JSON.stringify(currentStep)};
  const SAMPLE = {
    phone: "5207833278",
    email: "manshanminiisw@hotmail.com",
    businessName: "TYLER PAULE",
    ein: "41-4760600",
    legalFirst: "Tyler",
    legalLast: "Paule",
    dob: "07/23/1991",
    addr1: "2691 N Klamm Rd Apt 136",
    city: "Kansas City",
    state: "MO",
    zip: "64151",
    shopName: "TYLER PAULE"
  };

  function text(el){ return (el && (el.textContent || el.innerText || "").trim()) || ""; }
  function firstEditableInput(){
    return Array.from(document.querySelectorAll('input,textarea')).find((el)=>{
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled;
    }) || null;
  }
  function byPlaceholder(keyword){
    const key = String(keyword || '').toLowerCase();
    return Array.from(document.querySelectorAll('input,textarea')).find((el)=>{
      const p=(el.getAttribute('placeholder')||'').toLowerCase();
      return p.includes(key);
    }) || null;
  }
  function trySet(el, value){
    if (!el) return false;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
    return true;
  }
  const status = document.getElementById('bl-demo-status');
  const setStatus = (msg)=>{ if (status) status.textContent = msg; };

  function stepUrl(step){ return '/tiktok-seller-demo/' + step + '?mode=demo'; }
  function nav(step){ window.location.href = stepUrl(step); }

  const stepSel = document.getElementById('bl-demo-step');
  if (stepSel) {
    for (const s of STEPS) {
      const op = document.createElement('option');
      op.value = s;
      op.textContent = s;
      if (s === CURRENT) op.selected = true;
      stepSel.appendChild(op);
    }
  }

  document.getElementById('bl-demo-go')?.addEventListener('click', ()=>{
    const step = stepSel && stepSel.value;
    if (step && STEPS.includes(step)) nav(step);
  });
  document.getElementById('bl-demo-prev')?.addEventListener('click', ()=>{
    const i = STEPS.indexOf(CURRENT);
    if (i > 0) nav(STEPS[i-1]);
  });
  document.getElementById('bl-demo-next')?.addEventListener('click', ()=>{
    const i = STEPS.indexOf(CURRENT);
    if (i >= 0 && i < STEPS.length-1) nav(STEPS[i+1]);
  });

  document.getElementById('bl-demo-fill')?.addEventListener('click', ()=>{
    const logs = [];
    logs.push('autofill on step: ' + CURRENT);
    if (CURRENT === 'register') {
      const target = byPlaceholder('phone number or email') || byPlaceholder('phone number') || firstEditableInput();
      logs.push(trySet(target, SAMPLE.phone) ? 'filled phone/email' : 'missing phone/email input');
    }
    if (CURRENT === 'login') {
      const usernameInput = byPlaceholder('email or username') || byPlaceholder('phone number') || firstEditableInput();
      const passwordInput = byPlaceholder('password') || Array.from(document.querySelectorAll('input[type="password"],input')).find((el)=>el.type === 'password') || null;
      logs.push(trySet(usernameInput, SAMPLE.phone + '.bug') ? 'filled username' : 'missing username');
      logs.push(trySet(passwordInput, SAMPLE.phone + 'bug!') ? 'filled password' : 'missing password');
    }
    if (CURRENT === 'business-name') {
      logs.push(trySet(byPlaceholder('business name'), SAMPLE.businessName) ? 'filled legal business name' : 'missing business name input');
      logs.push(trySet(byPlaceholder('street address'), SAMPLE.addr1) ? 'filled address line 1' : 'missing street address');
      logs.push(trySet(byPlaceholder('city'), SAMPLE.city) ? 'filled city' : 'missing city');
      logs.push(trySet(byPlaceholder('zip'), SAMPLE.zip) ? 'filled zip' : 'missing zip');
    }
    if (CURRENT === 'ein') {
      logs.push(trySet(byPlaceholder('ein'), SAMPLE.ein) ? 'filled EIN' : 'missing EIN input');
    }
    if (CURRENT === 'legal-name') {
      logs.push(trySet(byPlaceholder('first name'), SAMPLE.legalFirst) ? 'filled first name' : 'missing first name');
      logs.push(trySet(byPlaceholder('last name'), SAMPLE.legalLast) ? 'filled last name' : 'missing last name');
      logs.push(trySet(byPlaceholder('date of birth'), SAMPLE.dob) ? 'filled dob' : 'missing dob');
    }
    if (CURRENT === 'residential-address') {
      logs.push(trySet(byPlaceholder('street address'), SAMPLE.addr1) ? 'filled residential address' : 'missing address');
      logs.push(trySet(byPlaceholder('city'), SAMPLE.city) ? 'filled city' : 'missing city');
      logs.push(trySet(byPlaceholder('zip'), SAMPLE.zip) ? 'filled zip' : 'missing zip');
    }
    if (CURRENT === 'shop-name') {
      logs.push(trySet(byPlaceholder('shop name'), SAMPLE.shopName) ? 'filled shop name' : 'missing shop name input');
    }
    setStatus(logs.join('\n'));
  });

  document.getElementById('bl-demo-validate')?.addEventListener('click', ()=>{
    const fields = Array.from(document.querySelectorAll('input,select,textarea')).filter((el)=>{
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled;
    });
    const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).filter((el)=> text(el).length > 0);
    const hints = Array.from(document.querySelectorAll('*')).filter((n)=>{
      const t = text(n).toLowerCase();
      return t.includes('required') || t.includes('mandatory') || t.includes('invalid');
    }).slice(0, 5);
    setStatus([
      'validate on step: ' + CURRENT,
      'visible fields: ' + fields.length,
      'action buttons: ' + buttons.length,
      'validation hints: ' + hints.length,
      hints.length ? ('hints: ' + hints.map((n)=>text(n)).join(' | ')) : 'hints: none'
    ].join('\n'));
  });

  setStatus('ready: use Autofill + Validate + Back/Next');
})();
</script>`;

  if (withoutScripts.includes("</body>")) {
    return withoutScripts.replace("</body>", `${navScript}</body>`);
  }

  return `${withoutScripts}${navScript}`;
}

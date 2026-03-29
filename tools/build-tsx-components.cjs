const fs = require('fs');
const path = require('path');

function htmlToJsx(html) {
  let jsx = html;
  jsx = jsx.replace(/class=/g, 'className=');
  jsx = jsx.replace(/for=/g, 'htmlFor=');
  
  const attrs = [
    'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule',
    'clip-path', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
    'fill-opacity', 'stop-color', 'stop-opacity', 'vector-effect', 'text-anchor',
    'pointer-events', 'font-size', 'font-family', 'font-weight', 'letter-spacing',
    'stroke-opacity'
  ];
  attrs.forEach(attr => {
    const camel = attr.split('-').map((w, i) => i === 0 ? w : w[0].toUpperCase() + w.slice(1)).join('');
    jsx = jsx.replace(new RegExp(attr + '(?=>|=)', 'g'), camel);
  });

  jsx = jsx.replace(/crossorigin/gi, 'crossOrigin="anonymous"');
  
  const voidElements = ['path', 'img', 'input', 'br', 'hr', 'area', 'base', 'col', 'embed', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'];
  voidElements.forEach(tag => {
    const openReg = new RegExp('<' + tag + '\\b([^>]*?[^\\/])>', 'gi');
    jsx = jsx.replace(openReg, '<' + tag + ' $1 />');
    const closeReg = new RegExp('<\/' + tag + '>', 'gi');
    jsx = jsx.replace(closeReg, '');
  });
  
  // FIX: Properly parse CSS var keys without stripping their dashes
  jsx = jsx.replace(/style=\"([^\"]*)\"/g, (match, styleString) => {
     let out = [];
     styleString.split(';').forEach(rule => {
        let parts = rule.split(':');
        if (parts.length >= 2) {
           let originalKey = parts[0].trim();
           let val = parts.slice(1).join(':').trim();
           if (originalKey.startsWith('--')) {
              out.push(`"${originalKey}": "${val}"`);
           } else {
              let key = originalKey.replace(/-([a-z])/g, g => g[1].toUpperCase());
              out.push(`${key}: "${val}"`);
           }
        }
     });
     return 'style={{' + out.join(', ') + '}}';
  });

  jsx = jsx.replace(/className=""/g, '');

  return jsx;
}

try {
  let headerHtml = fs.readFileSync('e:/bug-login/temp-header.html', 'utf8');
  let headerJsx = htmlToJsx(headerHtml);

  headerJsx = headerJsx.replace(/<a[^>]*aria-label="Navigate to home page"[^>]*>[\s\S]*?<\/a>/i, '<Link href="/" style={{display:"flex", alignItems:"center", gap:"8px", fontWeight:700, fontSize:"18px", color:"white", textDecoration:"none"}}><div style={{background:"white", color:"black", borderRadius:"4px", width:"20px", height:"20px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px"}}>B</div> BugLogin</Link>');
  headerJsx = headerJsx.replace(/<a([^>]*)>Product<\/a>/gi, '<Link$1>Browser</Link>');
  headerJsx = headerJsx.replace(/<a([^>]*)>Resources<\/a>/gi, '<Link$1>Profile</Link>');
  headerJsx = headerJsx.replace(/<a([^>]*)>Customers<\/a>/gi, '<Link$1>Proxy</Link>');
  headerJsx = headerJsx.replace(/<a([^>]*)>Pricing<\/a>/gi, '<Link$1>Billing</Link>');
  headerJsx = headerJsx.replace(/<a([^>]*)>Contact<\/a>/gi, '<Link$1>Admin</Link>');

  headerJsx = headerJsx.replace(/<a([^>]*)>Log in<\/a>/gi, '<Link href="/auth" $1>Auth</Link>');
  headerJsx = headerJsx.replace(/<a([^>]*)>Sign up<\/a>/gi, '<Link href="/pricing" $1>Checkout</Link>');

  headerJsx = headerJsx.replace(/<a([^>]*)>/g, '<Link$1>');
  headerJsx = headerJsx.replace(/<\/a>/g, '</Link>');

  const tsxContentHeader = `import Link from 'next/link';\n\nexport function LinearHeader() {\n  return (\n    <>\n      ${headerJsx}\n    </>\n  );\n}\n`;
  fs.writeFileSync('e:/bug-login/src/components/portal/linear-header.tsx', tsxContentHeader);
  console.log('Successfully updated linear-header.tsx');

  let mainHtml = fs.readFileSync('e:/bug-login/temp-main.html', 'utf8');
  let mainJsx = htmlToJsx(mainHtml);
  
  mainJsx = mainJsx
    .replace(/>Linear</g, ">BugLogin<")
    .replace(/>Linear –/g, ">BugLogin –<")
    .replace(/The product<br \/>development<br \/>system for teams<\/h1>/gi, "Vít Camp Tối Đa<br />Cho Dân MMO</h1>")
    .replace(/Linear sets a new standard/gi, "BugLogin thiết lập một tiêu chuẩn mới")
    .replace(/The product development system for teams and agents/g, "Trình duyệt chống phát hiện tốt nhất cho MMO")
    .replace(/Purpose-built for planning and building products/gi, "Được thiết kế để quản lý hàng nghìn profile và proxy vượt mọi thuật toán")
    .replace(/Designed for teams/gi, "Hoàn hảo cho nông dân")
    .replace(/Meet the new standard for modern software development/gi, "Trải nghiệm sức mạnh Vít Camp Tối Đa")
    .replace(/>Build products</gi, ">Scale Profiles<")
    .replace(/>Issue tracking</gi, ">Anti-Detect<")
    .replace(/>Cycles</g, ">Proxies<");
    
  mainJsx = mainJsx.replace(/<a([^>]*)href="\/([^"]*)"([^>]*)>/g, '<Link href="/$2" $1 $3>');
  mainJsx = mainJsx.replace(/<\/a>/g, '</Link>');

  const tsxContentHero = `import Link from 'next/link';\n\nexport function LinearHero() {\n  return (\n    <>\n      ${mainJsx}\n    </>\n  );\n}\n`;
  fs.writeFileSync('e:/bug-login/src/components/portal/linear-hero.tsx', tsxContentHero);
  console.log('Successfully updated linear-hero.tsx');
  
} catch (e) {
  console.error("Error generating TSX components:", e);
}

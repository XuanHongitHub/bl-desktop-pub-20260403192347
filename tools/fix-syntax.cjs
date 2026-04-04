const fs = require('fs');

function fixJsxSyntax(jsxStr) {
  let patched = jsxStr;

  // 1. Fix HTML comments
  // Replace <!-- content --> with {/* content */}
  patched = patched.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');

  // 2. Fix reserved DOM attributes that SWC might choke on or warn aggressively
  patched = patched.replace(/spellcheck=/gi, 'spellCheck=');
  patched = patched.replace(/autocapitalize=/gi, 'autoCapitalize=');
  patched = patched.replace(/autocomplete=/gi, 'autoComplete=');
  patched = patched.replace(/autocorrect=/gi, 'autoCorrect=');
  patched = patched.replace(/tabindex=/gi, 'tabIndex=');

  // 3. Fix unescaped textarea contents which will crash if they contain `{` or `<`
  patched = patched.replace(/<textarea([^>]*)>([\s\S]*?)<\/textarea>/gi, (match, attrs, content) => {
     // Escape backticks and dollars for template literals
     let safeContent = content.replace(/`/g, '\\`').replace(/\$/g, '\\$');
     return `<textarea${attrs} defaultValue={\`${safeContent}\`} />`;
  });

  return patched;
}

try {
  let heroPath = 'e:/bug-login/src/components/portal/linear-hero.tsx';
  let heroJsx = fs.readFileSync(heroPath, 'utf8');
  let newHeroJsx = fixJsxSyntax(heroJsx);
  if (newHeroJsx !== heroJsx) {
    fs.writeFileSync(heroPath, newHeroJsx);
    console.log('Patched syntax in linear-hero.tsx');
  }

  let headerPath = 'e:/bug-login/src/components/portal/linear-header.tsx';
  let headerJsx = fs.readFileSync(headerPath, 'utf8');
  let newHeaderJsx = fixJsxSyntax(headerJsx);
  if (newHeaderJsx !== headerJsx) {
    fs.writeFileSync(headerPath, newHeaderJsx);
    console.log('Patched syntax in linear-header.tsx');
  }
} catch (e) {
  console.error("Syntax patcher error:", e);
}

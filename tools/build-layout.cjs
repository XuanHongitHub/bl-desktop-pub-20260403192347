const fs = require('fs');

try {
  let headHtml = fs.readFileSync('e:/bug-login/temp-head.html', 'utf8');
  
  const layoutTsx = `
"use client";
import { ReactNode, useEffect } from "react";

// The globally extracted styles and CSS links
export function LinearStyles() {
  // We use dangerouslySetInnerHTML to render the exact raw CSS string
  return <div dangerouslySetInnerHTML={{ __html: \`${headHtml.replace(/`/g, '\\`')}\` }} />;
}

export function LinearLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Ensure dark mode persists cleanly for the mock
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
  }, []);

  return (
    <div className="min-h-screen bg-[#08090a] text-white">
      <LinearStyles />
      {children}
      {/* We add an empty spacer so footer doesn't crush contents if we use layout flex */}
    </div>
  );
}
`;

  fs.writeFileSync('e:/bug-login/src/components/portal/linear-layout.tsx', layoutTsx);
  console.log('Successfully created linear-layout.tsx');
  
} catch (e) {
  console.error("Error generating TSX layout:", e);
}

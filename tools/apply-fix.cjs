const fs = require('fs');

let file = 'e:/bug-login/src/components/portal/linear-hero.tsx';
let jsx = fs.readFileSync(file, 'utf8');

// 1. Fix unescaped < and > in text nodes (often within spans like > <</span>)
jsx = jsx.replace(/> [<>]+?<\/span>/g, (match) => {
   if (match.includes('<')) return '> &lt;</span>';
   if (match.includes('>')) return '> &gt;</span>';
   return match;
});

// Since the line 8 error was exactly snippet "an className=\"code-diff_text__j1V9d\"> <</span>"
jsx = jsx.replace(/> <<\/span>/g, '> &lt;</span>');
jsx = jsx.replace(/> \><\/span>/g, '> &gt;</span>');

// 1.b there are also other < and > inside code blocks
jsx = jsx.replace(/>&lt;\/span>/g, '>&amp;lt;</span>');

// Specifically find the known literal less-than symbol in code spans
jsx = jsx.replace(/<span\s+className=\"code-diff_text__j1V9d\">\s*<\s*<\/span>/g, '<span className=\"code-diff_text__j1V9d\"> &lt; </span>');
jsx = jsx.replace(/>\s*<\s*<\/span>/g, '> &lt; </span>');

// 2. Fix the corrupted style object that became a fragmented JSX string
// The error was: d-areas-default": ""}} a="" b="" c="" c";--grid-areas-desk
// We find any place where style={{"--grid-areas-default": ""}} a="" b="" c="" exists and fix it.
// The original intended style was likely a grid template.
jsx = jsx.replace(/style=\{\{\"--grid-areas-default\": \"\"\}\}\sa=\"\"\sb=\"\"\sc=\"\"\sc\";--grid-areas-desktop:/g, 'style={{"--grid-areas-default": "\\"a a a\\" \\"b b c\\" \\"c c c\\"", "--grid-areas-desktop":');

// Just in case it's slightly different:
jsx = jsx.replace(/style=\{\{\"--grid-areas-default\":\s*\"\"\}\}\s*a=\"\"\s*b=\"\"\s*c=\"\".*?--grid-areas-desktop:/gi, 'style={{"--grid-areas-default": "\\"a a a\\" \\"b b c\\" \\"c c c\\"", "--grid-areas-desktop":');

// Let's just find `a="" b="" c="" c"` anywhere and nuke it if it's near grid areas
jsx = jsx.replace(/\"\}\}\s*a=\"\"\s*b=\"\"\s*c=\"\"\s*c\";/g, '", ');

// Write it back
fs.writeFileSync(file, jsx);
console.log('Applied surgical syntax fixes to linear-hero.tsx');

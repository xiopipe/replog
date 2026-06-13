const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const src = __dirname;                 // assets/_icon-concepts
const out = path.join(src, '..');      // assets/

function render(svgName, width) {
  const svg = fs.readFileSync(path.join(src, svgName), 'utf8');
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

const jobs = [
  ['icon-full.svg',           1024, 'icon.png'],
  ['adaptive-foreground.svg', 1024, 'android-icon-foreground.png'],
  ['adaptive-background.svg', 1024, 'android-icon-background.png'],
  ['monochrome.svg',          1024, 'android-icon-monochrome.png'],
  ['icon-full.svg',            196, 'favicon.png'],
  ['icon-full.svg',           1024, 'splash-icon.png'],
];

for (const [svg, w, dest] of jobs) {
  fs.writeFileSync(path.join(out, dest), render(svg, w));
  console.log('wrote', dest, `(${w}px)`);
}

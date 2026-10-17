// Optional artwork rebuild; the generated social image is committed for CF builds.
const sharp = require('sharp');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
sharp(path.join(root, 'scripts/zodiac/zodiakas-1200x630.svg'))
  .removeAlpha().png({compressionLevel:9,effort:10}).toFile(path.join(root, 'site/assets/visuals/zodiac/zodiakas-1200x630.png'))
  .then(result => { if (result.width !== 1200 || result.height !== 630) throw Error('Invalid OG dimensions'); console.log(result); });

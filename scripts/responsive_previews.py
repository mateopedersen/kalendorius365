from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];source=ROOT/'site/assets/previews';target=ROOT/'site/assets/previews-small';target.mkdir(exist_ok=True)
for path in source.glob('*.webp'):
 out=target/path.name
 if out.exists() and out.stat().st_mtime>=path.stat().st_mtime:continue
 image=Image.open(path);image.thumbnail((340,340),Image.Resampling.LANCZOS);image.save(out,'WEBP',quality=87,method=4)
print('Responsive 340px previews prepared.')

"""Original, fully Lithuanian 1200x630 social image from the shared moon renderer."""
from PIL import Image,ImageDraw,ImageFont
from core import ROOT
from render import disc

def main():
    image=Image.new('RGB',(1200,630),'#102c3b');draw=ImageDraw.Draw(image)
    for y in range(630):
        t=y/630;draw.line((0,y,1200,y),fill=(int(13+7*t),int(35+15*t),int(49+13*t)))
    for inset in (0,30):draw.ellipse((660-inset,65-inset,1160+inset,565+inset),outline='#2b4b59',width=1)
    moon=disc({'phase_angle_deg':0,'waxing_or_waning':'waxing'},768).resize((430,430),Image.Resampling.LANCZOS)
    image.paste(moon,(710,100),moon)
    def text(x,y,value,size,weight='Regular',color='#edf4ef'):
        font=ImageFont.truetype(str(ROOT/f'site/assets/fonts/Lato-{weight}.ttf'),size)
        bounds=draw.textbbox((x,y),value,font=font)
        assert bounds[2]<690 or size==14,(value,bounds)
        draw.text((x,y),value,font=font,fill=color)
    text(64,56,'KALENDORIUS365',20,'Bold','#acc7cc')
    text(60,134,'Mėnulio',82,'Black');text(60,225,'kalendorius',82,'Black')
    text(64,350,'2027–2029',42,'Bold','#e1c18a')
    text(64,423,'Kasdienė šviesos kaita.',28)
    text(64,470,'Lietuvos laikas · PDF ir WebP',24,'Regular','#bbced4')
    text(64,582,'Paviršius: NASA mokslinės vizualizacijos studija / LRO.',14,'Regular','#acc3c9')
    # A fixed palette keeps social crawlers below the site's 300 kB OG budget.
    image.quantize(colors=256,dither=Image.Dither.NONE).save(ROOT/'site/assets/lunar/menulio-kalendorius-1200x630.png',optimize=True)

if __name__=='__main__':main()

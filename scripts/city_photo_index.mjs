import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WEATHER_CITIES} from '../site/assets/data/weather-cities.js';
import {WEATHER_CITY_BACKGROUNDS} from '../site/assets/data/weather-backgrounds.js';
import {WEATHER_NIGHT_BACKGROUNDS} from '../site/assets/data/weather-night-backgrounds.js';
const rows=[];
for(const city of WEATHER_CITIES)for(const [period,photo] of [['day',WEATHER_CITY_BACKGROUNDS[city.id]],['night',WEATHER_NIGHT_BACKGROUNDS[city.id]]]){
 if(!photo)continue;
 if(!photo.author||!photo.source||!photo.license)throw Error('Missing photo provenance: '+city.id);
 const path=new URL('../site'+photo.image,import.meta.url);if(!existsSync(path))throw Error('Missing photograph: '+city.id);
 rows.push({city:city.id,period,image:photo.image,source:photo.source,author:photo.author,license:photo.license,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
}
writeFileSync(new URL('../data/weather-photo-index.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');
console.log('Verified '+rows.length+' source-bound day/night photographs');

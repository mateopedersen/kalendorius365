import {WEATHER_CITIES} from './weather-cities.js';
import {WEATHER_CITY_BACKGROUNDS} from './weather-backgrounds.js';
import {WEATHER_NIGHT_BACKGROUNDS} from './weather-night-backgrounds.js';
import {createCityPhotoController} from './city-photo-controller.js';

let controller;
function initialize() {
  const card=document.querySelector('.climate-card');
  const picture=card?.querySelector('picture');
  let shown=picture?.querySelector('.climate-card__image');
  if(!shown)return null;
  const stateModule='/photo-time/state-8f37e36480e7f760.mjs';
  let solar;
  controller=createCityPhotoController({
    cities:WEATHER_CITIES.map(city=>({...city,timeZone:'Europe/Vilnius'})),
    day:WEATHER_CITY_BACKGROUNDS,night:WEATHER_NIGHT_BACKGROUNDS,
    stateFor:async(city,instant)=>(await(solar??=import(stateModule))).cityPhotoState(city,instant),
    load:photo=>new Promise((resolve,reject)=>{
      const frame=new Image();
      const timeout=setTimeout(()=>reject(Error('Photo timeout')),15000);
      frame.onload=async()=>{
        try{await frame.decode();clearTimeout(timeout);resolve(frame);}
        catch(error){clearTimeout(timeout);reject(error);}
      };
      frame.onerror=()=>{clearTimeout(timeout);reject(Error('Photo unavailable'));};
      frame.decoding='async';frame.src=photo.image;
    }),
    display({city,photo,period,frame}){
      picture.querySelectorAll('source').forEach(source=>source.removeAttribute('srcset'));
      if(frame!==shown){
        for(const attribute of [...shown.attributes])
          if(!['src','srcset','alt','aria-hidden','decoding'].includes(attribute.name))
            frame.setAttribute(attribute.name,attribute.value);
        shown.replaceWith(frame);shown=frame;
      }
      shown.alt=photo.alt||city.name+' dieną';
      shown.removeAttribute('aria-hidden');
      shown.style.objectPosition=photo.focalPoint||'center center';
      card.dataset.weatherCity=city.id;
      card.dataset.weatherPhotoPeriod=period;
    },
  });
  const picker=document.querySelector('#weather-city');
  const warm=()=>{
    const at=WEATHER_CITIES.findIndex(city=>city.id===picker.value);
    for(const city of WEATHER_CITIES.slice(Math.max(0,at-2),at+3))void controller.preload(city.id);
  };
  picker?.addEventListener('focus',warm);
  picker?.addEventListener('pointerdown',warm,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void controller.update();});
  window.addEventListener('pageshow',()=>{void controller.update();});
  setInterval(()=>{if(!document.hidden)void controller.update();},30000);
  return controller;
}
export function updateWeatherBackground(id) {
  return(controller||initialize())?.select(id);
}

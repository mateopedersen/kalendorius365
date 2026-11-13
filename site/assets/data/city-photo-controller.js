// The displayed frame is always a fully decoded, source-bound photograph.
// Solar transitions and city selections share one race-safe commit path.
export function createCityPhotoController({cities, day, night, stateFor, load, display,
  now=()=>new Date(), setTimer=setTimeout, clearTimer=clearTimeout, cacheLimit=16}) {
  let selected=null, revision=0, timer=null, displayedKey=null;
  const images=new Map();
  function prepare(photo) {
    if(!images.has(photo.image)) {
      const pending=Promise.resolve().then(()=>load(photo)).catch(error=>{
        images.delete(photo.image);throw error;
      });
      images.set(photo.image,pending);
      if(images.size>cacheLimit)images.delete(images.keys().next().value);
    }
    return images.get(photo.image);
  }
  async function update() {
    if(!selected)return false;
    const city=selected, run=++revision;
    clearTimer(timer);
    try {
      const state=await stateFor(city,now());
      if(run!==revision)return false;
      const delay=Math.max(25,Math.min(2147483647,+state.nextChange-+now()+25));
      timer=setTimer(()=>{void update();},Number.isFinite(delay)?delay:30000);
      const photo=state.period==='night'?(night[city.id]||day[city.id]):day[city.id];
      if(!photo)return false;
      const period=state.period==='night'&&!night[city.id]?'archive':state.period;
      const key=[city.id,period,photo.image].join('|');
      if(displayedKey===key)return true;
      const frame=await prepare(photo);
      if(run!==revision)return false;
      display({city,photo,period,frame});displayedKey=key;
      return true;
    } catch {
      if(run===revision)timer=setTimer(()=>{void update();},60000);
      return false;
    }
  }
  return {
    select(id){selected=cities.find(city=>city.id===id)||null;return update();},
    update,
    async preload(id){
      const city=cities.find(city=>city.id===id);if(!city)return false;
      try{const state=await stateFor(city,now());const photo=state.period==='night'?(night[id]||day[id]):day[id];if(photo)await prepare(photo);return !!photo;}catch{return false;}
    },
    dispose(){revision++;selected=null;clearTimer(timer);},
  };
}

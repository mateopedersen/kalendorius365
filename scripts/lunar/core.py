"""Shared Lithuanian lunar vocabulary and deterministic rendering geometry."""
from __future__ import annotations
import calendar
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
TZ = ZoneInfo('Europe/Vilnius')
MONTHS = ['Sausis','Vasaris','Kovas','Balandis','Gegužė','Birželis','Liepa','Rugpjūtis','Rugsėjis','Spalis','Lapkritis','Gruodis']
GENITIVE = ['sausio','vasario','kovo','balandžio','gegužės','birželio','liepos','rugpjūčio','rugsėjo','spalio','lapkričio','gruodžio']
SLUGS = ['sausis','vasaris','kovas','balandis','geguze','birzelis','liepa','rugpjutis','rugsejis','spalis','lapkritis','gruodis']
WEEKDAYS = ['Pirmadienis','Antradienis','Trečiadienis','Ketvirtadienis','Penktadienis','Šeštadienis','Sekmadienis']
PRIMARY = {'new':'Jaunatis','first':'Priešpilnis','full':'Pilnatis','last':'Delčia'}
STAGES = ['Jaunaties laikotarpis','Augantis pjautuvas','Priešpilnio laikotarpis','Augantis išgaubtas Mėnulis','Pilnaties laikotarpis','Dylantis išgaubtas Mėnulis','Delčios laikotarpis','Dylantis pjautuvas']
VERSION = 'k365-lunar-1.0.0'

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def write_json(path, value):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n')

def stage(elongation):
    return STAGES[int((elongation+22.5)%360//45)]

def local_label(instant):
    d=datetime.fromisoformat(instant.replace('Z','+00:00')).astimezone(TZ)
    return f'{d.year} m. {GENITIVE[d.month-1]} {d.day} d. {d:%H:%M}'

def load_data():
    return json.loads((ROOT/'data/lunar/calendar.json').read_text())

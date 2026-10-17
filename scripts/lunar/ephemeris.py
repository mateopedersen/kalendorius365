"""Offline 1096-day ephemeris; independent JPL DE440s and USNO comparisons."""
from __future__ import annotations
import argparse
import calendar
import json
from datetime import datetime,timedelta,timezone
from pathlib import Path
import astronomy as astro
import numpy as np
from skyfield.api import load,load_file
from core import ROOT,TZ,PRIMARY,VERSION,stage,digest,write_json,local_label

def at(d):
    return astro.Time.Make(d.year,d.month,d.day,d.hour,d.minute,d.second+d.microsecond/1e6)

def generate(kernel):
    phase_keys={'New Moon':'new','First Quarter':'first','Full Moon':'full','Last Quarter':'last'}
    events=[]
    sources=[]
    for year in range(2026,2031):
        p=ROOT/f'data/lunar/sources/usno-{year}.json'
        raw=json.loads(p.read_text())
        assert raw['apiversion']=='4.0.1'
        sources.append({'year':year,'url':f'https://aa.usno.navy.mil/api/moon/phases/year?year={year}','sha256':digest(p)})
        for row in raw['phasedata']:
            key=phase_keys[row['phase']]
            instant=datetime.fromisoformat(f"{row['year']}-{row['month']:02}-{row['day']:02}T{row['time']}:00+00:00")
            utc=instant.isoformat().replace('+00:00','Z')
            events.append({'utc':utc,'phase':key,'label_lt':PRIMARY[key],'local_date':instant.astimezone(TZ).date().isoformat(),'local_time':instant.astimezone(TZ).strftime('%H:%M'),'local_label_lt':local_label(utc)})
    events.sort(key=lambda r:r['utc'])
    records=[]; datetimes=[]
    day=datetime(2027,1,1,12,tzinfo=TZ)
    while day.year<=2029:
        utc=day.astimezone(timezone.utc); t=at(utc)
        info=astro.Illumination(astro.Body.Moon,t)
        elong=astro.MoonPhase(t)
        previous=max(e['utc'] for e in events if e['phase']=='new' and e['utc']<=utc.isoformat().replace('+00:00','Z'))
        age=(utc-datetime.fromisoformat(previous.replace('Z','+00:00'))).total_seconds()/86400
        records.append({'date_local':day.date().isoformat(),'weekday':day.weekday(),'sampled_instant_utc':utc.isoformat().replace('+00:00','Z'),'sampled_local_time':'12:00','illumination_fraction':round(info.phase_fraction,10),'phase_angle_deg':round(info.phase_angle,8),'elongation_deg':round(elong,8),'sun_ecliptic_longitude_deg':round(astro.SunPosition(t).elon,8),'moon_ecliptic_longitude_deg':round(astro.EclipticGeoMoon(t).lon,8),'waxing_or_waning':'waxing' if elong<180 else 'waning','phase_label_lt':stage(elong),'moon_age_days':round(age,6),'age_method':'Laikas nuo ankstesnės USNO jaunaties, minutės tikslumu','orientation':'Šiaurė viršuje; augant apšviesta dešinė; libracija ir vietinis posūkis nemodeliuojami'})
        datetimes.append(utc); day+=timedelta(days=1)
    assert len(records)==1096
    # Separate engine, separate numerical model: JPL Chebyshev kernel through Skyfield.
    ts=load.timescale(builtin=True); eph=load_file(str(kernel)); t=ts.from_datetimes(datetimes)
    observed=eph['earth'].at(t).observe(eph['moon']).apparent()
    independent=observed.fraction_illuminated(eph['sun'])
    delta=np.abs(independent-np.array([r['illumination_fraction'] for r in records]))
    assert float(delta.max())<0.0005,delta.max()
    comparisons=[]
    for e in events:
        instant=datetime.fromisoformat(e['utc'].replace('Z','+00:00'))
        if instant.year not in (2027,2028,2029): continue
        angle={'new':0,'first':90,'full':180,'last':270}[e['phase']]
        found=astro.SearchMoonPhase(angle,at(instant-timedelta(days=1)),2)
        seconds=abs((found.Utc()-instant.replace(tzinfo=None)).total_seconds())
        assert seconds<180,(e,seconds)
        comparisons.append({'utc_usno':e['utc'],'phase':e['phase'],'engine_utc':found.Utc().isoformat()+'Z','difference_seconds':round(seconds,3)})
    assert [e['utc'] for e in events if e['utc'].startswith('2027-01')]==['2027-01-07T20:24:00Z','2027-01-15T20:34:00Z','2027-01-22T12:17:00Z','2027-01-29T10:55:00Z']
    meta={'schema':1,'engine':'Astronomy Engine 2.1.19','renderer_version':VERSION,'timezone':'Europe/Vilnius','sampling_lt':'Kiekvienos datos 12:00 Lietuvos laiku','phase_convention_lt':'Elongacija 0–360°; 0° jaunatis, 90° priešpilnis, 180° pilnatis, 270° delčia. Fazės kampas – Saulės ir Žemės krypčių kampas ties Mėnuliu.','sources':sources,'records':records,'events':events}
    write_json(ROOT/'data/lunar/calendar.json',meta)
    write_json(ROOT/'site/assets/data/lunar/calendar.json',meta)
    report={'status':'passed','days':1096,'independent_engine':'Skyfield 1.55 + JPL DE440s','kernel_sha256':digest(kernel),'daily_illumination_max_absolute_difference':float(delta.max()),'daily_illumination_rms_difference':float(np.sqrt(np.mean(delta**2))),'daily_tolerance':0.0005,'primary_events_checked':len(comparisons),'primary_tolerance_seconds':180,'maximum_primary_difference_seconds':max(r['difference_seconds'] for r in comparisons),'primary_comparisons':comparisons,'daily_comparisons':[{'date':r['date_local'],'astronomy_engine':r['illumination_fraction'],'jpl':round(float(i),10),'difference':round(float(d),10)} for r,i,d in zip(records,independent,delta)]}
    write_json(ROOT/'docs/lunar/qa/astronomy-pass-a.json',report)
    print({k:v for k,v in report.items() if k not in ('primary_comparisons','daily_comparisons')},flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--kernel',type=Path,required=True)
    generate(p.parse_args().kernel)

"""Pixel geometry and date-matrix checks, separate from the ephemeris comparison."""
import calendar,json,math
from datetime import date
import numpy as np
from core import ROOT,load_data,digest,write_json

data=load_data();records=data['records'];n=512
axis=(np.arange(n)+.5)/n*2-1;x,y=np.meshgrid(axis,axis);inside=x*x+y*y<1;z=np.sqrt(np.maximum(0,1-x*x-y*y))
errors=[];centroids=[]
for row in records:
    angle=math.radians(row['phase_angle_deg']);sign=1 if row['waxing_or_waning']=='waxing' else -1
    lit=(x*math.sin(angle)*sign+z*math.cos(angle))>0
    fraction=float(np.count_nonzero(lit&inside)/np.count_nonzero(inside));error=abs(fraction-row['illumination_fraction'])
    assert error<(2/(math.pi*n)+.0001),(row['date_local'],error)
    if .02<row['illumination_fraction']<.98:
        centroid=float(x[lit&inside].mean());assert centroid*sign>0
    errors.append(error)
    d=date.fromisoformat(row['date_local']);assert d.weekday()==row['weekday']
    assert row['sampled_local_time']=='12:00'
for year in (2027,2028,2029):
    for month in range(1,13):
        days=[r['date_local'] for r in records if r['date_local'].startswith(f'{year}-{month:02}')]
        assert len(days)==calendar.monthrange(year,month)[1] and len(set(days))==len(days)
images=sorted((ROOT/'site/assets/lunar/days').glob('*.webp'));assert len(images)==1096
from collections import defaultdict
encodings=defaultdict(list)
for image in images:encodings[digest(image)].append(image.stem)
unique=len(encodings);assert unique>1000
bydate={r['date_local']:r for r in records};compression_matches=[]
for dates in encodings.values():
    if len(dates)<2:continue
    rows=[bydate[d] for d in dates]
    assert len({r['waxing_or_waning'] for r in rows})==1
    difference=max(r['illumination_fraction'] for r in rows)-min(r['illumination_fraction'] for r in rows)
    assert difference<.00001,(dates,difference)
    compression_matches.append({'dates':dates,'fraction_difference':difference})
benchmarks=[]
for elongation in range(0,360,45):
    angle=math.radians(abs(180-elongation));sign=1 if elongation<=180 else -1
    fraction=np.count_nonzero(((x*math.sin(angle)*sign+z*math.cos(angle))>0)&inside)/np.count_nonzero(inside)
    expected=(1+math.cos(angle))/2;assert abs(fraction-expected)<.002
    benchmarks.append({'elongation':elongation,'fraction':float(fraction),'expected':expected})
report={'status':'passed','canonical_dates':1096,'month_matrices':36,'daily_image_files':1096,'unique_webp_encodings':unique,'quantized_matches_for_nearly_identical_phases':compression_matches,'pixel_disc_resolution':n,'maximum_illuminated_area_discretization_error':max(errors),'area_tolerance':2/(math.pi*n)+.0001,'orientation':'waxing right, waning left, north up','benchmark_phases':benchmarks}
write_json(ROOT/'docs/lunar/qa/disc-geometry.json',report)
print(report)

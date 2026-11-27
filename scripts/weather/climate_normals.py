"""Import the two LHMT 1991–2020 station-normal tables from a saved official HTML page."""

from argparse import ArgumentParser
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import json


SOURCE = 'https://www.meteo.lt/klimatas/lietuvos-klimatas/klimato-duomenys/'
STATIONS = {
    'Biržai': 'birzu-ams', 'Dotnuva': 'dotnuvos-ams', 'Dūkštas': 'duksto-ams',
    'Kaunas': 'kauno-ams', 'Kybartai': 'kybartu-ams', 'Klaipėda': 'klaipedos-ams',
    'Laukuva': 'laukuvos-ams', 'Lazdijai': 'lazdiju-ams', 'Nida': 'nidos-ams',
    'Panevėžys': 'panevezio-ams', 'Raseiniai': 'raseiniu-ams', 'Šiauliai': 'siauliu-ams',
    'Šilutė': 'silutes-ams', 'Telšiai': 'telsiu-ams', 'Ukmergė': 'ukmerges-ams',
    'Utena': 'utenos-ams', 'Varėna': 'varenos-ams', 'Vilnius': 'vilniaus-ams',
}
MONTHS = 'I II III IV V VI VII VIII IX X XI XII'.split()
LABELS = {'temperature': 'Vidutinė oro temperatūra (°C)', 'rainfall': 'Kritulių kiekis (mm.)'}


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self.heading = ''
        self.reading_heading = False
        self.rows = self.row = self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'h3':
            self.heading = ''
            self.reading_heading = True
        elif tag == 'table':
            self.rows = []
        elif tag == 'tr' and self.rows is not None:
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = ''

    def handle_data(self, data):
        if self.reading_heading:
            self.heading += data
        if self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if tag == 'h3':
            self.reading_heading = False
        elif tag in ('td', 'th') and self.cell is not None:
            self.row.append(self.cell.strip())
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        elif tag == 'table' and self.rows is not None:
            self.tables.append((self.heading.strip(), self.rows))
            self.rows = None


def parse(source):
    parser = Tables()
    parser.feed(source.decode('utf-8'))
    stations = {code: {} for code in STATIONS.values()}
    for metric, label in LABELS.items():
        matches = [rows for title, rows in parser.tables
                   if title.startswith(label) and '1991' in title and '2020' in title]
        if len(matches) != 1 or matches[0][0] != ['Stotis', *MONTHS, 'Metų']:
            raise ValueError(f'Unexpected table or month order for {label}')
        seen = set()
        for name, *values in matches[0][1:]:
            if name not in STATIONS or name in seen or len(values) != 13:
                raise ValueError(f'Unexpected station row: {name}')
            seen.add(name)
            if metric == 'temperature':
                values = [float(value.replace('−', '-').replace(',', '.')) for value in values]
                valid = all(-25 <= value <= 35 for value in values)
            else:
                values = [int(value) for value in values]
                valid = all(0 <= value <= 300 for value in values[:12]) and 0 < values[12] < 2000
            if not valid:
                raise ValueError(f'Out-of-range values for {name}: {metric}')
            stations[STATIONS[name]][metric] = values
        if seen != set(STATIONS):
            raise ValueError(f'Missing stations in {label}')
    return {'source': SOURCE, 'sourceSha256': sha256(source).hexdigest(), 'years': [1991, 2020],
            'stations': stations}


if __name__ == '__main__':
    cli = ArgumentParser(description=__doc__)
    cli.add_argument('source', type=Path)
    args = cli.parse_args()
    output = Path(__file__).resolve().parents[2] / 'data/weather-climate-normals.json'
    dataset = parse(args.source.read_bytes())
    output.write_text(json.dumps(dataset, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(dataset["stations"])} LHMT station normals')

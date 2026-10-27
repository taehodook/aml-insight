"""공식 명단 세 곳을 모두 검증한 뒤 로컬 WLF 파일을 교체해요. 배포하지 않아요."""
import argparse, csv, io, json, os, urllib.request
from pathlib import Path
from datetime import datetime, timezone, timedelta
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'OFAC': 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML',
    'UN': 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
    'EU': 'https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw',
}

def xml(data):
    root = ET.fromstring(data)
    for el in root.iter():
        el.tag = el.tag.rsplit('}', 1)[-1]
    return root

def text(el, key):
    return (el.findtext(key) or '').strip()

def parse_ofac(data):
    root, rows = xml(data), []
    for el in root.findall('sdnEntry'):
        name = ', '.join(filter(None, [text(el, 'lastName'), text(el, 'firstName')]))
        kind = {'Individual': '개인', 'Entity': '단체', 'Vessel': '선박', 'Aircraft': '항공기'}.get(text(el, 'sdnType'))
        if not kind:
            raise ValueError('OFAC 유형을 확인해 주세요.')
        program = '; '.join(p.text for p in el.findall('./programList/program') if p.text)
        names = [name] + [', '.join(filter(None, [text(a, 'lastName'), text(a, 'firstName')])) for a in el.findall('./akaList/aka')]
        for n in dict.fromkeys(names):
            if n:
                rows.append(['OFAC', text(el, 'uid'), n, program, kind])
    if int(root.findtext('./publshInformation/Record_Count') or 0) != len(root.findall('sdnEntry')):
        raise ValueError('OFAC 원천 건수가 맞지 않아요.')
    date = datetime.strptime(root.findtext('./publshInformation/Publish_Date'), '%m/%d/%Y').date().isoformat()
    return rows, date

def parse_un(data):
    root, rows = xml(data), []
    for tag, kind in [('INDIVIDUAL', '개인'), ('ENTITY', '단체')]:
        for el in root.iter(tag):
            name = ' '.join(filter(None, [text(el, k) for k in ['FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME']]))
            aliases = [text(a, 'ALIAS_NAME') for a in el.findall(tag + '_ALIAS')]
            for n in dict.fromkeys([name] + aliases):
                if n:
                    rows.append(['UN', text(el, 'REFERENCE_NUMBER'), n, text(el, 'UN_LIST_TYPE'), kind])
    return rows, (root.get('dateGenerated') or '')[:10]

def eu_kind(value):
    value = value.strip().lower()
    if value in ('p', 'person', 'individual'):
        return '개인'
    if value in ('e', 'enterprise', 'entity'):
        return '단체'
    raise ValueError('EU 유형을 확인해 주세요: ' + value)

def parse_eu(data):
    reader = csv.DictReader(io.StringIO(data.decode('utf-8-sig')), delimiter=';')
    rows, date = [], ''
    for row in reader:
        name = (row.get('NameAlias_WholeName') or '').strip()
        if name:
            rows.append(['EU', row.get('Entity_EU_ReferenceNumber') or row.get('Entity_LogicalId'), name, row.get('Entity_Regulation_Programme', ''), eu_kind(row.get('Entity_SubjectType', ''))])
        date = date or row.get('fileGenerationDate', '')
    for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
        try:
            date = datetime.strptime(date[:10], fmt).date().isoformat()
            break
        except ValueError:
            pass
    return rows, date

def validate(rows, source, previous):
    if len(rows) < {'OFAC': 10000, 'UN': 500, 'EU': 1000}[source]:
        raise ValueError(source + ' 명단이 비정상적으로 작아요.')
    if previous and len(rows) < previous * .7:
        raise ValueError(source + ' 명단이 30% 이상 줄어 원천 확인이 필요해요.')
    if any(len(r) != 5 or not r[1] or not r[2] for r in rows):
        raise ValueError(source + ' 식별번호나 이름이 누락됐어요.')

def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--source-dir', type=Path, help='검증할 공식 원천 파일 폴더: ofac.xml, un.xml, eu.csv')
    options = args.parse_args()
    target = ROOT / 'sanctions.json'
    old = json.loads(target.read_text(encoding='utf-8'))
    rows, meta = [], {}
    checked = datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds')
    for source, parser in [('OFAC', parse_ofac), ('UN', parse_un), ('EU', parse_eu)]:
        if options.source_dir:
            name = {'OFAC': 'ofac.xml', 'UN': 'un.xml', 'EU': 'eu.csv'}[source]
            data = (options.source_dir / name).read_bytes()
        else:
            request = urllib.request.Request(SOURCES[source], headers={'User-Agent': 'AML-Insight/1.0'})
            with urllib.request.urlopen(request, timeout=180) as response:
                data = response.read()
        batch, published = parser(data)
        datetime.strptime(published, '%Y-%m-%d')
        batch = list({tuple(r): r for r in batch}.values())
        validate(batch, source, old.get('counts', {}).get(source, 0))
        rows.extend(batch)
        meta[source] = {'publishedAt': published, 'checkedAt': checked, 'url': SOURCES[source], 'nameRows': len(batch)}
    kmeta = json.loads((ROOT / 'data/wlf/kofiu-meta.json').read_text(encoding='utf-8'))
    for i in range(1, kmeta['parts'] + 1):
        rows.extend(json.loads((ROOT / f'data/wlf/kofiu-{i}.json').read_text(encoding='utf-8'))['rows'])
    document = {'date': checked[:10], 'counts': {s: sum(r[0] == s for r in rows) for s in ['OFAC', 'UN', 'EU', 'KoFIU']}, 'rows': rows, 'sources': meta, 'kofiu': kmeta}
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(document, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    os.replace(temp, target)
    print('공식 명단 확인 완료:', document['counts'])

if __name__ == '__main__':
    main()

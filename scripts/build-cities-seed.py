#!/usr/bin/env python3
"""Builds the INSERT statements for public.cities from GeoNames (https://www.geonames.org, CC BY 4.0).

Research/build script, not app code. Download these three files from
https://download.geonames.org/export/dump/ into one folder, then:

    python3 scripts/build-cities-seed.py <folder> > seed.sql

    cities15000.zip (unzipped)   every city with more than 15,000 people
    admin1CodesASCII.txt         state / region names
    countryInfo.txt              country names
"""
import sys
from pathlib import Path

folder = Path(sys.argv[1])
regions = {}
for line in (folder / "admin1CodesASCII.txt").read_text(encoding="utf-8").splitlines():
    code, name, *_ = line.split("\t")
    regions[code] = name
countries = {}
for line in (folder / "countryInfo.txt").read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#"):
        cols = line.split("\t")
        countries[cols[0]] = cols[4]

q = lambda s: "'" + s.replace("'", "''") + "'"
rows = []
for line in (folder / "cities15000.txt").read_text(encoding="utf-8").splitlines():
    c = line.split("\t")
    geoname_id, name, ascii_name, country_code, admin1, population = c[0], c[1], c[2], c[8], c[10], int(c[14] or 0)
    if not country_code or country_code not in countries:
        continue
    region = regions.get(f"{country_code}.{admin1}")
    if region == name:
        region = None  # city-states: "Singapore, Singapore"
    rows.append((population, f"({geoname_id}, {q(name)}, {q((ascii_name or name).lower())}, {q(region) if region else 'null'}, "
                             f"{q(country_code)}, {q(countries[country_code])}, {population})"))

rows.sort(key=lambda r: -r[0])
print(f"-- {len(rows)} cities")
for i in range(0, len(rows), 500):
    print("insert into public.cities (id, name, search_name, region, country_code, country, population) values")
    print(",\n".join(r[1] for r in rows[i : i + 500]) + ";")

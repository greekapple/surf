#!/bin/zsh
# Local capture of public surf-height reference data (spec 2026-11-11-overnight-surf-height, S3).
# Sources (licences in docs/research/SURF-HEIGHT-SOURCES.md):
#   NDBC/CDIP nearshore gauges (hourly), NWS Surf Zone Forecasts SRF (every 6 h),
#   USACE FRF Duck 8 m array + lidar (hourly; private calibration only, no commercial use).
# Writes to ~/Development/swello-data/surf-height/<source>/<UTC date>/. Polite: 1 request/s, project UA.
UA='SWELLO surf forecast prototype'
OUT=~/Development/swello-data/surf-height
GAUGES=(LJPC1 46254 46266 46274 46285 46268 46286 41115 41121 51211 44056)
OFFICES=(BOX BRO CAR CRP EKA GUM HFO JAX LOX MFL MFR MLB MOB MTR PQR SGX SJU TAE TBW)
get() { curl -sf --max-time 60 -A "$UA" "$1" -o "$2" || { rm -f "$2"; echo "$(date -u +%FT%TZ) FAIL $1" >> $OUT/errors.log; }; sleep 1; }
mkdir -p $OUT
i=0
while true; do
  d=$(date -u +%F); t=$(date -u +%H%M)
  mkdir -p $OUT/gauges/$d $OUT/frf/$d $OUT/srf/$d
  for g in $GAUGES; do get "https://www.ndbc.noaa.gov/data/realtime2/$g.txt" $OUT/gauges/$d/$g-$t.txt; done
  ym=$(date -u +%Y%m); y=$(date -u +%Y)
  get "https://chldata.erdc.dren.mil/thredds/dodsC/frf/oceanography/waves/8m-array/$y/FRF-ocean_waves_8m-array_$ym.nc.ascii?time,waveHs,waveTp" $OUT/frf/$d/8m-array-$t.txt
  get "https://chldata.erdc.dren.mil/thredds/dodsC/frf/oceanography/waves/lidarWaveGauge110/$y/FRF-ocean_waves_lidarWaveGauge110_$ym.nc.ascii?time,waveHs" $OUT/frf/$d/lidar110-$t.txt
  if (( i % 6 == 0 )); then
    for o in $OFFICES; do
      for id in $(curl -sf --max-time 60 -A "$UA" "https://api.weather.gov/products/types/SRF/locations/$o" | jq -r '.["@graph"][:3][].id'); do
        f=$OUT/srf/products/$id.json; mkdir -p $OUT/srf/products
        [ -s $f ] || get "https://api.weather.gov/products/$id" $f
      done; sleep 1
    done
  fi
  echo "$(date -u +%FT%TZ) cycle $i done" >> $OUT/capture.log
  i=$((i+1)); sleep 3600
done

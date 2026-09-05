# DATA DICTIONARY — PROJECT 26066 OCEAN AI SYSTEM

This data dictionary provides automated metadata, missing value percentages, value ranges, coordinate coverages, and dimensions for all variables in the Ocean AI dataset.


## Dataset Source: GLORYS Reanalysis (GLORYS_Target_025_grid.nc)

| Variable | Meaning | Units | Dimensions | Missing % | Min | Max | Temporal Coverage | Spatial Coverage | Depth Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bottomT` | Sea floor potential temperature | degrees_C | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 101, 'longitude': 241})` | 51.30% | 0.8065 | 32.0995 | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `mlotst` | Density ocean mixed layer thickness | m | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 101, 'longitude': 241})` | 51.30% | 6.1037 | 119.6326 | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `siconc` | Ice concentration | 1 | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 101, 'longitude': 241})` | 100.00% | N/A | N/A | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `sithick` | Sea ice thickness | m | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 101, 'longitude': 241})` | 100.00% | N/A | N/A | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `so` | Salinity | 1e-3 | `['time', 'depth', 'latitude', 'longitude'] ({'time': 7, 'depth': 35, 'latitude': 101, 'longitude': 241})` | 56.69% | 4.7853 | 39.6558 | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `thetao` | Temperature | degrees_C | `['time', 'depth', 'latitude', 'longitude'] ({'time': 7, 'depth': 35, 'latitude': 101, 'longitude': 241})` | 56.69% | 5.8963 | 32.0438 | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `uo` | Eastward velocity | m s-1 | `['time', 'depth', 'latitude', 'longitude'] ({'time': 7, 'depth': 35, 'latitude': 101, 'longitude': 241})` | 56.69% | -1.3794 | 0.8930 | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `usi` | Sea ice eastward velocity | m s-1 | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 101, 'longitude': 241})` | 100.00% | N/A | N/A | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `vo` | Northward velocity | m s-1 | `['time', 'depth', 'latitude', 'longitude'] ({'time': 7, 'depth': 35, 'latitude': 101, 'longitude': 241})` | 56.69% | -1.2110 | 1.0785 | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `vsi` | Sea ice northward velocity | m s-1 | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 101, 'longitude': 241})` | 100.00% | N/A | N/A | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |
| `zos` | Sea surface height | m | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 101, 'longitude': 241})` | 51.30% | -0.0693 | 1.2003 | 7 time steps | Lat: 5.00° to 30.00°, Lon: 45.00° to 105.00° | 35 levels: 0.49m to 902.34m |

## Dataset Source: CCMP Satellite Wind (CCMP_Wind_Analysis_*.nc)

| Variable | Meaning | Units | Dimensions | Missing % | Min | Max | Temporal Coverage | Spatial Coverage | Depth Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `uwnd` | u-wind vector component at 10 meters | m s-1 | `['time', 'latitude', 'longitude'] ({'time': 4, 'latitude': 720, 'longitude': 1440})` | 12.78% | -30.0870 | 29.2083 | 4 time steps | Lat: -89.88° to 89.88°, Lon: 0.12° to 359.88° | Surface |
| `vwnd` | v-wind vector component at 10 meters | m s-1 | `['time', 'latitude', 'longitude'] ({'time': 4, 'latitude': 720, 'longitude': 1440})` | 12.78% | -26.4093 | 30.1449 | 4 time steps | Lat: -89.88° to 89.88°, Lon: 0.12° to 359.88° | Surface |
| `ws` | wind speed at 10 meters | m s-1 | `['time', 'latitude', 'longitude'] ({'time': 4, 'latitude': 720, 'longitude': 1440})` | 12.78% | 0.0002 | 31.5835 | 4 time steps | Lat: -89.88° to 89.88°, Lon: 0.12° to 359.88° | Surface |
| `nobs` | number of observations used to derive wind vector components | dimensionless | `['time', 'latitude', 'longitude'] ({'time': 4, 'latitude': 720, 'longitude': 1440})` | 12.78% | 0.0000 | 8.0000 | 4 time steps | Lat: -89.88° to 89.88°, Lon: 0.12° to 359.88° | Surface |

## Dataset Source: OSTIA SST (ostia_north_indian_ocean.nc)

| Variable | Meaning | Units | Dimensions | Missing % | Min | Max | Temporal Coverage | Spatial Coverage | Depth Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `analysed_sst` | analysed sea surface temperature | kelvin | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 500, 'longitude': 1200})` | 50.09% | 273.7700 | 303.8200 | 7 time steps | Lat: 5.03° to 29.98°, Lon: 45.03° to 104.97° | Surface |
| `analysis_error` | estimated error standard deviation of analysed_sst | kelvin | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 500, 'longitude': 1200})` | 50.09% | 0.1200 | 1.9100 | 7 time steps | Lat: 5.03° to 29.98°, Lon: 45.03° to 104.97° | Surface |
| `mask` | land sea ice lake bit mask | dimensionless | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 500, 'longitude': 1200})` | 0.00% | 1.0000 | 6.0000 | 7 time steps | Lat: 5.03° to 29.98°, Lon: 45.03° to 104.97° | Surface |
| `sea_ice_fraction` | sea ice area fraction | 1 | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 500, 'longitude': 1200})` | 50.09% | 0.0000 | 0.0000 | 7 time steps | Lat: 5.03° to 29.98°, Lon: 45.03° to 104.97° | Surface |

## Dataset Source: SSH Altimetry (ssh_north_indian_ocean.nc)

| Variable | Meaning | Units | Dimensions | Missing % | Min | Max | Temporal Coverage | Spatial Coverage | Depth Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `adt` | Absolute dynamic topography | m | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 48.36% | 0.3378 | 1.5823 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `err_sla` | Formal mapping error | m | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 49.51% | 0.0089 | 0.1209 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `err_ugosa` | Formal mapping error on zonal geostrophic velocity anomalies | m/s | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 49.51% | 0.0276 | 0.6183 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `err_vgosa` | Formal mapping error on meridional geostrophic velocity anomalies | m/s | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 49.51% | 0.0410 | 0.4874 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `flag_ice` | Ice Flag for a 15% criterion of ice concentration | dimensionless | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 48.36% | 0.0000 | 0.0000 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `sla` | Sea level anomaly | m | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 48.36% | -0.2787 | 0.4384 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `tpa_correction` | TOPEX-A instrumental drift correction derived from altimetry and tide gauges global comparisons (WCRP Sea Level Budget Group, 2018) | m | `['time'] ({'time': 7})` | 100.00% | N/A | N/A | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `ugos` | Absolute geostrophic velocity: zonal component | m/s | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 48.36% | -2.0484 | 1.2775 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `ugosa` | Geostrophic velocity anomalies: zonal component | m/s | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 48.36% | -1.9615 | 1.3439 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `vgos` | Absolute geostrophic velocity: meridian component | m/s | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 48.36% | -0.8998 | 2.3600 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |
| `vgosa` | Geostrophic velocity anomalies: meridian component | m/s | `['time', 'latitude', 'longitude'] ({'time': 7, 'latitude': 100, 'longitude': 240})` | 48.36% | -1.1431 | 2.2985 | 7 time steps | Lat: 5.12° to 29.88°, Lon: 45.12° to 104.88° | Surface |

## Dataset Source: SSS Satellite Salinity (sss_north_indian_ocean.nc)

| Variable | Meaning | Units | Dimensions | Missing % | Min | Max | Temporal Coverage | Spatial Coverage | Depth Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dos` | sea surface density | kg/m3 | `['time', 'depth', 'latitude', 'longitude'] ({'time': 7, 'depth': 1, 'latitude': 200, 'longitude': 480})` | 50.48% | 1018.2542 | 1029.2372 | 7 time steps | Lat: 5.06° to 29.94°, Lon: 45.06° to 104.94° | 1 levels: 0.00m to 0.00m |
| `dos_error` | sea surface density error | kg/m3 | `['time', 'depth', 'latitude', 'longitude'] ({'time': 7, 'depth': 1, 'latitude': 200, 'longitude': 480})` | 0.00% | 0.1145 | 6.6800 | 7 time steps | Lat: 5.06° to 29.94°, Lon: 45.06° to 104.94° | 1 levels: 0.00m to 0.00m |
| `sea_ice_fraction` | sea ice area fraction | percent | `['time', 'depth', 'latitude', 'longitude'] ({'time': 7, 'depth': 1, 'latitude': 200, 'longitude': 480})` | 50.30% | 0.0000 | 0.0000 | 7 time steps | Lat: 5.06° to 29.94°, Lon: 45.06° to 104.94° | 1 levels: 0.00m to 0.00m |
| `sos` | sea surface salinity | .001 | `['time', 'depth', 'latitude', 'longitude'] ({'time': 7, 'depth': 1, 'latitude': 200, 'longitude': 480})` | 50.34% | 29.2545 | 39.9998 | 7 time steps | Lat: 5.06° to 29.94°, Lon: 45.06° to 104.94° | 1 levels: 0.00m to 0.00m |
| `sos_error` | sea surface salinity error | 0.001 | `['time', 'depth', 'latitude', 'longitude'] ({'time': 7, 'depth': 1, 'latitude': 200, 'longitude': 480})` | 0.00% | 0.1430 | 6.6800 | 7 time steps | Lat: 5.06° to 29.94°, Lon: 45.06° to 104.94° | 1 levels: 0.00m to 0.00m |

## Dataset Source: ARGO Profiles (data set/*.nc)

| Variable | Meaning | Units | Dimensions | Missing % | Min | Max | Temporal Coverage | Spatial Coverage | Depth Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DATA_TYPE` | Data type | dimensionless | `[] ({})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `FORMAT_VERSION` | File format version | dimensionless | `[] ({})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `HANDBOOK_VERSION` | Data handbook version | dimensionless | `[] ({})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `REFERENCE_DATE_TIME` | Date of reference for Julian days | dimensionless | `[] ({})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `DATE_CREATION` | Date of file creation | dimensionless | `[] ({})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `DATE_UPDATE` | Date of update of this file | dimensionless | `[] ({})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PLATFORM_NUMBER` | Float unique identifier | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PROJECT_NAME` | Name of the project | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PI_NAME` | Name of the principal investigator | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `STATION_PARAMETERS` | List of available parameters for the station | dimensionless | `['N_PROF', 'N_PARAM'] ({'N_PROF': 62, 'N_PARAM': 3})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `CYCLE_NUMBER` | Float cycle number | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | 1.0000 | 483.0000 | N/A | N/A | Surface |
| `DIRECTION` | Direction of the station profiles | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `DATA_CENTRE` | Data centre in charge of float data processing | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `DC_REFERENCE` | Station unique identifier in data centre | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `DATA_STATE_INDICATOR` | Degree of processing the data have passed through | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `DATA_MODE` | Delayed mode or real time data | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PLATFORM_TYPE` | Type of float | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `FLOAT_SERIAL_NO` | Serial number of the float | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `FIRMWARE_VERSION` | Instrument firmware version | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `WMO_INST_TYPE` | Coded instrument type | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `JULD` | Julian day (UTC) of the station relative to REFERENCE_DATE_TIME | days since 1950-01-01 00:00:00 UTC | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | 27028.0124 | 27028.9962 | N/A | N/A | Surface |
| `JULD_QC` | Quality on date and time | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `JULD_LOCATION` | Julian day (UTC) of the location relative to REFERENCE_DATE_TIME | days since 1950-01-01 00:00:00 UTC | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | 27028.0312 | 27029.0021 | N/A | N/A | Surface |
| `LATITUDE` | Latitude of the station, best estimate | degree_north | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | -65.0280 | 19.6190 | N/A | N/A | Surface |
| `LONGITUDE` | Longitude of the station, best estimate | degree_east | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | 20.9229 | 143.7487 | N/A | N/A | Surface |
| `POSITION_QC` | Quality on position (latitude and longitude) | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `POSITIONING_SYSTEM` | Positioning system | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PROFILE_PRES_QC` | Global quality flag of PRES profile | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PROFILE_TEMP_QC` | Global quality flag of TEMP profile | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PROFILE_PSAL_QC` | Global quality flag of PSAL profile | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `VERTICAL_SAMPLING_SCHEME` | Vertical sampling scheme | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `CONFIG_MISSION_NUMBER` | Unique number denoting the missions performed by the float | dimensionless | `['N_PROF'] ({'N_PROF': 62})` | 0.00% | 1.0000 | 260.0000 | N/A | N/A | Surface |
| `PRES` | Sea water pressure, equals 0 at sea-level | decibar | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 47.07% | -0.3000 | 5686.1001 | N/A | N/A | Surface |
| `PRES_QC` | quality flag | dimensionless | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PRES_ADJUSTED` | Sea water pressure, equals 0 at sea-level | decibar | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 49.78% | 0.0000 | 5686.6001 | N/A | N/A | Surface |
| `PRES_ADJUSTED_QC` | quality flag | dimensionless | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PRES_ADJUSTED_ERROR` | Contains the error on the adjusted values as determined by the delayed mode QC process | decibar | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 52.76% | 2.0010 | 4.5000 | N/A | N/A | Surface |
| `TEMP` | Sea temperature in-situ ITS-90 scale | degree_Celsius | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 47.07% | -1.6610 | 30.6330 | N/A | N/A | Surface |
| `TEMP_QC` | quality flag | dimensionless | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `TEMP_ADJUSTED` | Sea temperature in-situ ITS-90 scale | degree_Celsius | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 49.80% | -1.6610 | 30.6330 | N/A | N/A | Surface |
| `TEMP_ADJUSTED_QC` | quality flag | dimensionless | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `TEMP_ADJUSTED_ERROR` | Contains the error on the adjusted values as determined by the delayed mode QC process | degree_Celsius | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 52.78% | 0.0010 | 0.0020 | N/A | N/A | Surface |
| `PSAL` | Practical salinity | psu | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 47.10% | 0.0000 | 36.6460 | N/A | N/A | Surface |
| `PSAL_QC` | quality flag | dimensionless | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PSAL_ADJUSTED` | Practical salinity | psu | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 56.20% | 32.4960 | 36.4820 | N/A | N/A | Surface |
| `PSAL_ADJUSTED_QC` | quality flag | dimensionless | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `PSAL_ADJUSTED_ERROR` | Contains the error on the adjusted values as determined by the delayed mode QC process | psu | `['N_PROF', 'N_LEVELS'] ({'N_PROF': 62, 'N_LEVELS': 1379})` | 58.56% | 0.0040 | 0.0468 | N/A | N/A | Surface |
| `PARAMETER` | List of parameters with calibration information | dimensionless | `['N_PROF', 'N_CALIB', 'N_PARAM'] ({'N_PROF': 62, 'N_CALIB': 3, 'N_PARAM': 3})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `SCIENTIFIC_CALIB_EQUATION` | Calibration equation for this parameter | dimensionless | `['N_PROF', 'N_CALIB', 'N_PARAM'] ({'N_PROF': 62, 'N_CALIB': 3, 'N_PARAM': 3})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `SCIENTIFIC_CALIB_COEFFICIENT` | Calibration coefficients for this equation | dimensionless | `['N_PROF', 'N_CALIB', 'N_PARAM'] ({'N_PROF': 62, 'N_CALIB': 3, 'N_PARAM': 3})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `SCIENTIFIC_CALIB_COMMENT` | Comment applying to this parameter calibration | dimensionless | `['N_PROF', 'N_CALIB', 'N_PARAM'] ({'N_PROF': 62, 'N_CALIB': 3, 'N_PARAM': 3})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
| `SCIENTIFIC_CALIB_DATE` | Date of calibration | dimensionless | `['N_PROF', 'N_CALIB', 'N_PARAM'] ({'N_PROF': 62, 'N_CALIB': 3, 'N_PARAM': 3})` | 0.00% | N/A | N/A | N/A | N/A | Surface |
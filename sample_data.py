import xarray as xr
import numpy as np

f_so = r"C:\Users\dayaa\Downloads\Telegram Desktop\cmems_mod_glo_phy_my_0.083deg_P1D-m_1788942953020.nc"
f_thetao = r"C:\Users\dayaa\Downloads\Telegram Desktop\cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m_1788942909084.nc"
f_wind = r"C:\Users\dayaa\Downloads\Telegram Desktop\cmems_obs_wind_glo_phy_nrt_l3_hy2c_hscat_des_0_5deg_P1D_i_1788943897677.nc"

ds_so = xr.open_dataset(f_so)
ds_th = xr.open_dataset(f_thetao)
ds_w = xr.open_dataset(f_wind)

print("SO time range:", str(ds_so.time.values[0])[:10], "to", str(ds_so.time.values[-1])[:10], "total:", len(ds_so.time))
print("TH time range:", str(ds_th.time.values[0])[:10], "to", str(ds_th.time.values[-1])[:10], "total:", len(ds_th.time))
print("WIND time range:", str(ds_w.time.values[0])[:10], "to", str(ds_w.time.values[-1])[:10], "total:", len(ds_w.time))

# Check the canonical stations:
# Atlantic / Central Indian Ocean: lat 8.5, lon 74.2
# Pacific / Arabian Sea: lat 17.4, lon 63.8
# Southern / Bay of Bengal: lat 15.2, lon 89.1
stations = [
    ("Central Indian Ocean", 8.5, 74.2),
    ("Arabian Sea", 17.4, 63.8),
    ("Bay of Bengal", 15.2, 89.1),
]

print("\n--- SAMPLE VALUES AT STATIONS ---")
for name, lat, lon in stations:
    th_last = float(ds_th['thetao'].sel(latitude=lat, longitude=lon, method='nearest').isel(time=-1).squeeze().values)
    so_last = float(ds_so['so'].sel(latitude=lat, longitude=lon, method='nearest').isel(time=-1).squeeze().values)
    w_last = float(ds_w['wind_speed'].sel(latitude=lat, longitude=lon, method='nearest').isel(time=-1).squeeze().values)
    print(f"{name} ({lat}, {lon}): TH_last={th_last:.2f} C, SO_last={so_last:.2f} PSU, Wind_last={w_last:.2f} m/s")

ds_so.close()
ds_th.close()
ds_w.close()

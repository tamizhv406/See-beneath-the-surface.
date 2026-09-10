import os
import xarray as xr

files = [
    r"C:\Users\dayaa\Downloads\Telegram Desktop\cmems_mod_glo_phy_my_0.083deg_P1D-m_1788942953020.nc",
    r"C:\Users\dayaa\Downloads\Telegram Desktop\cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m_1788942909084.nc",
    r"C:\Users\dayaa\Downloads\Telegram Desktop\cmems_obs_wind_glo_phy_nrt_l3_hy2c_hscat_des_0_5deg_P1D_i_1788943897677.nc"
]

for f in files:
    print("=" * 60)
    print("FILE:", os.path.basename(f), "EXISTS:", os.path.exists(f))
    if os.path.exists(f):
        try:
            ds = xr.open_dataset(f)
            print("DIMS:", dict(ds.dims))
            print("COORDS:", list(ds.coords.keys()))
            print("DATA VARS:", list(ds.data_vars.keys()))
            for v in ds.data_vars:
                print(f"  VAR {v}: dims={ds[v].dims}, shape={ds[v].shape}, units={ds[v].attrs.get('units')}, long_name={ds[v].attrs.get('long_name')}")
            for t_name in ['time', 'date', 'TIME']:
                if t_name in ds.coords:
                    t_vals = ds[t_name].values
                    print(f"TIME ({t_name}): len={len(t_vals)}, min={t_vals[0]}, max={t_vals[-1]}")
            for d_name in ['depth', 'lev', 'DEPTH']:
                if d_name in ds.coords:
                    d_vals = ds[d_name].values
                    print(f"DEPTH ({d_name}): len={len(d_vals)}, vals={d_vals[:8]}")
            for lat_name in ['latitude', 'lat', 'LATITUDE']:
                if lat_name in ds.coords:
                    l = ds[lat_name]
                    print(f"LAT ({lat_name}): {float(l.min())} to {float(l.max())}")
            for lon_name in ['longitude', 'lon', 'LONGITUDE']:
                if lon_name in ds.coords:
                    l = ds[lon_name]
                    print(f"LON ({lon_name}): {float(l.min())} to {float(l.max())}")
            ds.close()
        except Exception as e:
            print("Error reading:", e)

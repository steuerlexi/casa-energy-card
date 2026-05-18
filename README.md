# Casa Energy Card

A custom Lovelace card for Home Assistant that visualizes multi-battery energy systems with animated power flows and live watt sensors.

## Features

- **Animated Power Flows** — SVG-based animated dashes show energy direction and magnitude
- **3 Battery Systems** — Support for multiple batteries with individual SoC and power
- **Live Watt Values** — All sensors update in real-time via Home Assistant state changes
- **Solar Inputs** — Multiple PV sources shown separately
- **Top Consumers** — Track individual device loads
- **Color-coded Flows** — Yellow (Solar), Green/Orange (Battery), Blue/Red (Grid), Red (Consumption)
- **Auto-scaling** — Values automatically switch to kW when >= 1000 W
- **Customizable** — Configurable colors, decimal places, animation speed

## Installation

### HACS (recommended)

1. Go to HACS → Frontend → Custom repositories
2. Add `https://github.com/steuerlexi/casa-energy-card`
3. Install the card
4. Add the resource to your dashboard

### Manual

1. Copy `casa-energy-card.js` to `/config/www/`
2. Add as resource: Settings → Dashboards → Resources → Add Resource
   - URL: `/local/casa-energy-card.js`
   - Type: JavaScript Module

## Configuration

```yaml
type: custom:casa-energy-card
title: "Energy Flow"
show_title: true
decimal_places: 0
auto_scale: true
animation_speed: 1
colors:
  solar: "#F6DF28"
  solar_bkw: "#ff6b35"
  grid_export: "#2196f3"
  grid_import: "#f44336"
  battery_charge: "#4caf50"
  battery_discharge: "#ff9800"
  consumption: "#B62D00"
entities:
  pv_main: sensor.sonnenbatterie_81923_production_w
  pv_bkw: sensor.b2500_total_power_in
  consumption: sensor.sonnenbatterie_81923_consumption_w
  grid: sensor.sonnenbatterie_81923_state_grid_inout
  battery_main_power: sensor.sonnenbatterie_81923_state_battery_inout
  battery_main_soc: sensor.sonnenbatterie_81923_state_charge_user
  battery_b2500_1_power: sensor.b2500_baab_netto_power
  battery_b2500_1_soc: sensor.baab_b2500_1_baab_battery_level
  battery_b2500_2_power: sensor.b2500_b9f4_netto_power
  battery_b2500_2_soc: sensor.b9f4_b2500_2_b9f4_battery_level
  load_klima: sensor.shelly_klimaanlage_switch_0_power
  load_server: sensor.plug_proxmoxserver_power
  load_warmwasser: sensor.plug_warmwasserspeicher_power
  load_trockner: sensor.plug_trockner_power
  load_garage: sensor.shelly_garage_switch_0_power
  load_garten: sensor.shelly_garten_leistung
```

### Entity Descriptions

| Entity | Description | Default |
|--------|-------------|---------|
| `pv_main` | Main PV production (W) | `sensor.sonnenbatterie_81923_production_w` |
| `pv_bkw` | BKW PV input (W) | `sensor.b2500_total_power_in` |
| `consumption` | Total house consumption (W) | `sensor.sonnenbatterie_81923_consumption_w` |
| `grid` | Grid in/out (positive = export) | `sensor.sonnenbatterie_81923_state_grid_inout` |
| `battery_main_power` | Main battery power (negative = charging) | `sensor.sonnenbatterie_81923_state_battery_inout` |
| `battery_main_soc` | Main battery SoC (%) | `sensor.sonnenbatterie_81923_state_charge_user` |
| `battery_b2500_1_power` | B2500-1 net power (W) | `sensor.b2500_baab_netto_power` |
| `battery_b2500_1_soc` | B2500-1 SoC (%) | `sensor.baab_b2500_1_baab_battery_level` |
| `battery_b2500_2_power` | B2500-2 net power (W) | `sensor.b2500_b9f4_netto_power` |
| `battery_b2500_2_soc` | B2500-2 SoC (%) | `sensor.b9f4_b2500_2_b9f4_battery_level` |
| `load_*` | Individual load sensors (W) | Various shelly/plug sensors |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | `"Casa Energy"` | Card title |
| `show_title` | boolean | `false` | Show title header |
| `decimal_places` | number | `0` | Decimal places for values |
| `auto_scale` | boolean | `false` | Auto-switch W → kW |
| `animation_speed` | number | `1` | Flow animation speed multiplier |
| `min_flow_watts` | number | `10` | Hide flow animation below this wattage |
| `show_daily_values` | boolean | `true` | Show daily kWh subtext under nodes |
| `show_sonnenbatterie` | boolean | `true` | Show main battery box |
| `show_b2500_baab` | boolean | `true` | Show B2500 baab battery box |
| `show_b2500_b9f4` | boolean | `true` | Show B2500 b9f4 battery box |
| `colors` | object | see above | Color overrides |
| `entities` | object | see above | Entity ID overrides |

## Sign Conventions

- **Grid**: positive = export to grid, negative = import from grid
- **Battery**: negative = charging, positive = discharging
- **BKW**: positive = discharging/output, negative = charging

## Energy Balance

The card visualizes the energy balance equation:

```
PV Production = Consumption + Grid Export − Grid Import + Battery Charge − Battery Discharge
```

## Support

For issues or feature requests, please open an issue on GitHub.

## License

MIT

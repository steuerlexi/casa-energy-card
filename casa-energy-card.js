class CasaEnergyCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._entities = {};
    this._lastRender = 0;
    this._animationFrame = null;
    this._initialized = false;
  }

  setConfig(config) {
    const defaults = {
      title: 'Casa Energy',
      show_title: true,
      decimal_places: 0,
      auto_scale: true,
      animation_speed: 1,
      colors: {
        solar: '#F6DF28',
        solar_bkw: '#ff6b35',
        grid_export: '#2196f3',
        grid_import: '#f44336',
        battery_charge: '#4caf50',
        battery_discharge: '#ff9800',
        consumption: '#B62D00',
        inverter: '#9e9e9e',
        background: 'var(--card-background-color, #fff)',
        text: 'var(--primary-text-color, #000)',
        text_secondary: 'var(--secondary-text-color, #666)'
      },
      entities: {
        pv_main: 'sensor.sonnenbatterie_81923_production_w',
        pv_bkw: 'sensor.b2500_total_power_in',
        consumption: 'sensor.sonnenbatterie_81923_consumption_w',
        grid: 'sensor.sonnenbatterie_81923_state_grid_inout',
        battery_main_power: 'sensor.sonnenbatterie_81923_state_battery_inout',
        battery_main_soc: 'sensor.sonnenbatterie_81923_state_charge_user',
        battery_b2500_1_power: 'sensor.b2500_baab_netto_power',
        battery_b2500_1_soc: 'sensor.baab_b2500_1_baab_battery_level',
        battery_b2500_2_power: 'sensor.b2500_b9f4_netto_power',
        battery_b2500_2_soc: 'sensor.b9f4_b2500_2_b9f4_battery_level',
        inverter_status: 'sensor.sonnenbatterie_81923_systemstatus',
        inverter_freq: 'sensor.sonnenbatterie_81923_state_netfrequency',
        daily_solar: 'sensor.sonnenbatterie_81923_pv_tagesertrag',
        daily_export: 'sensor.sonnenbatterie_81923_einspeisung_tagesertrag',
        load_klima: 'sensor.shelly_klimaanlage_switch_0_power',
        load_server: 'sensor.plug_proxmoxserver_power',
        load_warmwasser: 'sensor.plug_warmwasserspeicher_power',
        load_trockner: 'sensor.plug_trockner_power',
        load_garage: 'sensor.shelly_garage_switch_0_power',
        load_garten: 'sensor.shelly_garten_leistung',
        daily_load: 'sensor.sonnenbatterie_81923_consumption_avg'
      }
    };

    this._config = this._deepMerge(defaults, config);
    this._entities = this._config.entities;

    if (this._hass) this._render();
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;

    if (!this._initialized) {
      this._initialized = true;
      this._render();
      return;
    }

    if (this._shouldUpdate(oldHass, hass)) {
      this._updateValues();
      this._updateFlows();
    }
  }

  _shouldUpdate(oldHass, newHass) {
    if (!oldHass || !newHass) return true;
    for (const key of Object.values(this._entities)) {
      if (!key) continue;
      const oldState = oldHass.states[key];
      const newState = newHass.states[key];
      if (!oldState || !newState) return true;
      if (oldState.state !== newState.state || oldState.last_changed !== newState.last_changed) return true;
    }
    return false;
  }

  _deepMerge(target, source) {
    const result = JSON.parse(JSON.stringify(target));
    if (!source) return result;
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  _getState(entityId, defaultValue = 0) {
    if (!this._hass || !entityId) return defaultValue;
    const state = this._hass.states[entityId];
    if (!state || state.state === 'unavailable' || state.state === 'unknown') return defaultValue;
    const val = parseFloat(state.state);
    return isNaN(val) ? defaultValue : val;
  }

  _getTextState(entityId, defaultValue = '') {
    if (!this._hass || !entityId) return defaultValue;
    const state = this._hass.states[entityId];
    if (!state || state.state === 'unavailable' || state.state === 'unknown') return defaultValue;
    return state.state;
  }

  _formatValue(val, unit = 'W') {
    if (this._config.auto_scale && Math.abs(val) >= 1000) {
      return (val / 1000).toFixed(this._config.decimal_places) + ' k' + unit;
    }
    return Math.round(val) + ' ' + unit;
  }

  _render() {
    if (!this._config) return;
    const now = Date.now();
    if (now - this._lastRender < 50) return;
    this._lastRender = now;

    this.innerHTML = '';

    const card = document.createElement('ha-card');
    card.style.padding = '16px';
    card.style.background = this._config.colors.background;
    card.style.color = this._config.colors.text;
    card.style.display = 'block';
    card.style.fontFamily = 'var(--paper-font-body1_-_font-family), Roboto, sans-serif';

    if (this._config.show_title) {
      const title = document.createElement('div');
      title.textContent = this._config.title;
      title.style.fontSize = '18px';
      title.style.fontWeight = '500';
      title.style.marginBottom = '12px';
      title.style.textAlign = 'center';
      card.appendChild(title);
    }

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 800 520');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.maxHeight = '520px';
    svg.style.display = 'block';

    const defs = document.createElementNS(svgNS, 'defs');
    defs.innerHTML = `
      <marker id="arrow-solar" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <polygon points="0,0 6,3 0,6" fill="${this._config.colors.solar}"/>
      </marker>
      <marker id="arrow-solar-bkw" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <polygon points="0,0 6,3 0,6" fill="${this._config.colors.solar_bkw}"/>
      </marker>
      <marker id="arrow-grid-export" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <polygon points="0,0 6,3 0,6" fill="${this._config.colors.grid_export}"/>
      </marker>
      <marker id="arrow-grid-import" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <polygon points="0,0 6,3 0,6" fill="${this._config.colors.grid_import}"/>
      </marker>
      <marker id="arrow-battery-charge" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <polygon points="0,0 6,3 0,6" fill="${this._config.colors.battery_charge}"/>
      </marker>
      <marker id="arrow-battery-discharge" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <polygon points="0,0 6,3 0,6" fill="${this._config.colors.battery_discharge}"/>
      </marker>
      <marker id="arrow-consumption" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
        <polygon points="0,0 6,3 0,6" fill="${this._config.colors.consumption}"/>
      </marker>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="grad-solar" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.solar}" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="${this._config.colors.solar}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${this._config.colors.solar}" stop-opacity="0.3"/>
      </linearGradient>
      <linearGradient id="grad-solar-bkw" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.solar_bkw}" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="${this._config.colors.solar_bkw}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${this._config.colors.solar_bkw}" stop-opacity="0.3"/>
      </linearGradient>
      <linearGradient id="grad-grid-export" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.grid_export}" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="${this._config.colors.grid_export}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${this._config.colors.grid_export}" stop-opacity="0.3"/>
      </linearGradient>
      <linearGradient id="grad-grid-import" x1="100%" y1="0%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.grid_import}" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="${this._config.colors.grid_import}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${this._config.colors.grid_import}" stop-opacity="0.3"/>
      </linearGradient>
      <linearGradient id="grad-battery-charge" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.battery_charge}" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="${this._config.colors.battery_charge}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${this._config.colors.battery_charge}" stop-opacity="0.3"/>
      </linearGradient>
      <linearGradient id="grad-battery-discharge" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${this._config.colors.battery_discharge}" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="${this._config.colors.battery_discharge}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${this._config.colors.battery_discharge}" stop-opacity="0.3"/>
      </linearGradient>
      <linearGradient id="grad-consumption" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.consumption}" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="${this._config.colors.consumption}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${this._config.colors.consumption}" stop-opacity="0.3"/>
      </linearGradient>
    `;
    svg.appendChild(defs);

    this._svg = svg;
    this._svgNS = svgNS;

    this._drawStaticElements(svg, svgNS);
    this._drawFlowPaths(svg, svgNS);
    this._drawBatteryBoxes(svg, svgNS);
    this._drawSubLoads(svg, svgNS);

    card.appendChild(svg);
    this.appendChild(card);

    this._startAnimation();
  }

  _drawStaticElements(svg, ns) {
    const groups = {
      pvMain: this._createNodeGroup(svg, ns, 80, 60, 'mdi:solar-power', 'PV Anlage', this._config.colors.solar, 'pv-main-value', 'pv-main-daily'),
      pvBkw: this._createNodeGroup(svg, ns, 80, 180, 'mdi:solar-panel', 'BKW', this._config.colors.solar_bkw, 'pv-bkw-value'),
      inverter: this._createInverterGroup(svg, ns, 400, 120),
      grid: this._createNodeGroup(svg, ns, 720, 60, 'mdi:transmission-tower', 'Netz', this._config.colors.grid_export, 'grid-value', 'grid-daily'),
      house: this._createNodeGroup(svg, ns, 720, 180, 'mdi:home-lightning-bolt', 'Haus', this._config.colors.consumption, 'house-value', 'house-daily'),
    };
    this._nodeGroups = groups;
  }

  _createNodeGroup(svg, ns, x, y, icon, label, color, valueId, dailyId = null) {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('r', '28');
    circle.setAttribute('fill', 'var(--card-background-color, #fff)');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '2');
    g.appendChild(circle);

    const iconText = document.createElementNS(ns, 'text');
    iconText.setAttribute('text-anchor', 'middle');
    iconText.setAttribute('dy', '5');
    iconText.setAttribute('font-size', '20');
    iconText.textContent = this._getIconChar(icon);
    iconText.setAttribute('fill', color);
    g.appendChild(iconText);

    const labelText = document.createElementNS(ns, 'text');
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('y', '45');
    labelText.setAttribute('font-size', '11');
    labelText.setAttribute('font-weight', '500');
    labelText.setAttribute('fill', this._config.colors.text);
    labelText.textContent = label;
    g.appendChild(labelText);

    const valueText = document.createElementNS(ns, 'text');
    valueText.setAttribute('text-anchor', 'middle');
    valueText.setAttribute('y', '60');
    valueText.setAttribute('font-size', '13');
    valueText.setAttribute('font-weight', '600');
    valueText.setAttribute('fill', color);
    valueText.setAttribute('id', valueId);
    valueText.textContent = '0 W';
    g.appendChild(valueText);

    if (dailyId) {
      const dailyText = document.createElementNS(ns, 'text');
      dailyText.setAttribute('text-anchor', 'middle');
      dailyText.setAttribute('y', '74');
      dailyText.setAttribute('font-size', '10');
      dailyText.setAttribute('fill', this._config.colors.text_secondary);
      dailyText.setAttribute('id', dailyId);
      dailyText.textContent = '';
      g.appendChild(dailyText);
    }

    svg.appendChild(g);
    return g;
  }

  _createInverterGroup(svg, ns, x, y) {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', '-40');
    rect.setAttribute('y', '-30');
    rect.setAttribute('width', '80');
    rect.setAttribute('height', '60');
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', 'var(--card-background-color, #fff)');
    rect.setAttribute('stroke', this._config.colors.inverter);
    rect.setAttribute('stroke-width', '2');
    g.appendChild(rect);

    const iconText = document.createElementNS(ns, 'text');
    iconText.setAttribute('text-anchor', 'middle');
    iconText.setAttribute('dy', '5');
    iconText.setAttribute('font-size', '20');
    iconText.textContent = this._getIconChar('mdi:current-ac');
    iconText.setAttribute('fill', this._config.colors.inverter);
    g.appendChild(iconText);

    const statusText = document.createElementNS(ns, 'text');
    statusText.setAttribute('text-anchor', 'middle');
    statusText.setAttribute('y', '45');
    statusText.setAttribute('font-size', '9');
    statusText.setAttribute('fill', this._config.colors.text_secondary);
    statusText.setAttribute('id', 'inverter-status');
    statusText.textContent = 'Standby';
    g.appendChild(statusText);

    svg.appendChild(g);
    return g;
  }

  _getIconChar(iconName) {
    const iconMap = {
      'mdi:solar-power': '☀',
      'mdi:solar-panel': '☀',
      'mdi:transmission-tower': '⚡',
      'mdi:home-lightning-bolt': '⌂',
      'mdi:current-ac': '∿',
      'mdi:battery': 'ὐB',
      'mdi:battery-charging': '⚡',
      'mdi:air-conditioner': '❄',
      'mdi:monitor': '὚5',
      'mdi:water-boiler': '♨',
      'mdi:tumble-dryer': 'ᾟA',
      'mdi:garage': 'Ἶ0',
      'mdi:tree-outline': 'ἳ1'
    };
    return iconMap[iconName] || '●';
  }

  _drawFlowPaths(svg, ns) {
    const paths = {};

    // PV Main -> Inverter (top-left to center-left)
    paths.pvMainToInv = this._createFlowPath(svg, ns, 108, 60, 360, 90, 'grad-solar', 'arrow-solar', 'flow-pv-main');

    // PV BKW -> Inverter (mid-left to center-left-bottom)
    paths.pvBkwToInv = this._createFlowPath(svg, ns, 108, 180, 360, 150, 'grad-solar-bkw', 'arrow-solar-bkw', 'flow-pv-bkw');

    // Inverter -> Grid (center-right to top-right)
    paths.invToGrid = this._createFlowPath(svg, ns, 440, 90, 692, 60, 'grad-grid-export', 'arrow-grid-export', 'flow-grid');

    // Inverter -> House (center-right to mid-right)
    paths.invToHouse = this._createFlowPath(svg, ns, 440, 150, 692, 180, 'grad-consumption', 'arrow-consumption', 'flow-house');

    // Inverter -> Batteries (center-bottom to each battery)
    paths.invToBatMain = this._createFlowPath(svg, ns, 400, 150, 200, 320, 'grad-battery-charge', 'arrow-battery-charge', 'flow-bat-main');
    paths.invToBatB2500_1 = this._createFlowPath(svg, ns, 420, 150, 400, 320, 'grad-battery-charge', 'arrow-battery-charge', 'flow-bat-b2500-1');
    paths.invToBatB2500_2 = this._createFlowPath(svg, ns, 440, 150, 600, 320, 'grad-battery-charge', 'arrow-battery-charge', 'flow-bat-b2500-2');

    // Battery discharge -> Inverter (reverse paths)
    paths.batMainToInv = this._createFlowPath(svg, ns, 200, 300, 380, 140, 'grad-battery-discharge', 'arrow-battery-discharge', 'flow-bat-main-out');
    paths.batB2500_1ToInv = this._createFlowPath(svg, ns, 400, 300, 400, 140, 'grad-battery-discharge', 'arrow-battery-discharge', 'flow-bat-b2500-1-out');
    paths.batB2500_2ToInv = this._createFlowPath(svg, ns, 600, 300, 420, 140, 'grad-battery-discharge', 'arrow-battery-discharge', 'flow-bat-b2500-2-out');

    this._flowPaths = paths;
  }

  _createFlowPath(svg, ns, x1, y1, x2, y2, gradientId, markerId, id) {
    const path = document.createElementNS(ns, 'path');
    const midX = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', `url(#${gradientId})`);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('id', id);
    path.style.opacity = '0.6';
    svg.insertBefore(path, svg.firstChild.nextSibling);
    return path;
  }

  _drawBatteryBoxes(svg, ns) {
    const batteries = [
      { x: 200, y: 350, label: 'Sonnenbatterie', color: '#4caf50', powerId: 'bat-main-power', socId: 'bat-main-soc', socBarId: 'bat-main-bar' },
      { x: 400, y: 350, label: 'B2500-1', color: '#ff6b35', powerId: 'bat-b2500-1-power', socId: 'bat-b2500-1-soc', socBarId: 'bat-b2500-1-bar' },
      { x: 600, y: 350, label: 'B2500-2', color: '#ff8c42', powerId: 'bat-b2500-2-power', socId: 'bat-b2500-2-soc', socBarId: 'bat-b2500-2-bar' },
    ];

    this._batteryElements = [];

    for (const bat of batteries) {
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('transform', `translate(${bat.x}, ${bat.y})`);

      // Battery outline
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', '-45');
      rect.setAttribute('y', '-25');
      rect.setAttribute('width', '90');
      rect.setAttribute('height', '50');
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', 'var(--card-background-color, #fff)');
      rect.setAttribute('stroke', bat.color);
      rect.setAttribute('stroke-width', '2');
      g.appendChild(rect);

      // Battery positive terminal
      const term = document.createElementNS(ns, 'rect');
      term.setAttribute('x', '-8');
      term.setAttribute('y', '-30');
      term.setAttribute('width', '16');
      term.setAttribute('height', '5');
      term.setAttribute('fill', bat.color);
      g.appendChild(term);

      // SoC fill
      const fill = document.createElementNS(ns, 'rect');
      fill.setAttribute('x', '-43');
      fill.setAttribute('y', '-23');
      fill.setAttribute('width', '86');
      fill.setAttribute('height', '46');
      fill.setAttribute('rx', '2');
      fill.setAttribute('fill', bat.color);
      fill.setAttribute('fill-opacity', '0.2');
      fill.setAttribute('id', bat.socBarId);
      g.appendChild(fill);

      // Label
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('y', '-32');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-weight', '500');
      label.setAttribute('fill', this._config.colors.text);
      label.textContent = bat.label;
      g.appendChild(label);

      // Power value
      const power = document.createElementNS(ns, 'text');
      power.setAttribute('text-anchor', 'middle');
      power.setAttribute('y', '5');
      power.setAttribute('font-size', '12');
      power.setAttribute('font-weight', '600');
      power.setAttribute('fill', bat.color);
      power.setAttribute('id', bat.powerId);
      power.textContent = '0 W';
      g.appendChild(power);

      // SoC value
      const soc = document.createElementNS(ns, 'text');
      soc.setAttribute('text-anchor', 'middle');
      soc.setAttribute('y', '20');
      soc.setAttribute('font-size', '10');
      soc.setAttribute('fill', this._config.colors.text_secondary);
      soc.setAttribute('id', bat.socId);
      soc.textContent = '0%';
      g.appendChild(soc);

      svg.appendChild(g);
      this._batteryElements.push({ group: g, data: bat });
    }
  }

  _drawSubLoads(svg, ns) {
    const loads = [
      { x: 720, y: 260, icon: 'mdi:air-conditioner', label: 'Klima', entity: this._entities.load_klima, valueId: 'load-klima' },
      { x: 720, y: 310, icon: 'mdi:monitor', label: 'Server', entity: this._entities.load_server, valueId: 'load-server' },
      { x: 720, y: 360, icon: 'mdi:water-boiler', label: 'Warmw.', entity: this._entities.load_warmwasser, valueId: 'load-warmwasser' },
      { x: 720, y: 410, icon: 'mdi:tumble-dryer', label: 'Trockner', entity: this._entities.load_trockner, valueId: 'load-trockner' },
      { x: 720, y: 460, icon: 'mdi:garage', label: 'Garage', entity: this._entities.load_garage, valueId: 'load-garage' },
      { x: 720, y: 510, icon: 'mdi:tree-outline', label: 'Garten', entity: this._entities.load_garten, valueId: 'load-garten' },
    ];

    this._subLoadElements = [];

    for (const load of loads) {
      if (!load.entity) continue;

      const g = document.createElementNS(ns, 'g');
      g.setAttribute('transform', `translate(${load.x}, ${load.y})`);

      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', '-70');
      rect.setAttribute('y', '-14');
      rect.setAttribute('width', '140');
      rect.setAttribute('height', '28');
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', 'var(--card-background-color, #fff)');
      rect.setAttribute('stroke', this._config.colors.consumption);
      rect.setAttribute('stroke-width', '1');
      rect.setAttribute('stroke-opacity', '0.3');
      g.appendChild(rect);

      const labelText = document.createElementNS(ns, 'text');
      labelText.setAttribute('text-anchor', 'start');
      labelText.setAttribute('x', '-60');
      labelText.setAttribute('dy', '4');
      labelText.setAttribute('font-size', '10');
      labelText.setAttribute('fill', this._config.colors.text);
      labelText.textContent = load.label;
      g.appendChild(labelText);

      const valueText = document.createElementNS(ns, 'text');
      valueText.setAttribute('text-anchor', 'end');
      valueText.setAttribute('x', '60');
      valueText.setAttribute('dy', '4');
      valueText.setAttribute('font-size', '10');
      valueText.setAttribute('font-weight', '600');
      valueText.setAttribute('fill', this._config.colors.consumption);
      valueText.setAttribute('id', load.valueId);
      valueText.textContent = '0 W';
      g.appendChild(valueText);

      svg.appendChild(g);
      this._subLoadElements.push({ group: g, data: load });
    }
  }

  _updateValues() {
    if (!this._hass) return;

    const e = this._entities;

    // Solar
    const pvMain = this._getState(e.pv_main);
    const pvBkw = this._getState(e.pv_bkw);
    const dailySolar = this._getState(e.daily_solar);
    const dailyExport = this._getState(e.daily_export);

    this._setText('pv-main-value', this._formatValue(pvMain));
    this._setText('pv-main-daily', dailySolar > 0 ? `${dailySolar.toFixed(1)} kWh` : '');
    this._setText('pv-bkw-value', this._formatValue(pvBkw));

    // Grid
    const grid = this._getState(e.grid);
    const isExport = grid > 0;
    const gridAbs = Math.abs(grid);
    const gridColor = isExport ? this._config.colors.grid_export : this._config.colors.grid_import;
    this._setText('grid-value', this._formatValue(gridAbs));
    this._setText('grid-daily', dailyExport > 0 ? `${dailyExport.toFixed(1)} kWh` : '');
    this._updateNodeColor('grid-value', gridColor);

    // House
    const consumption = this._getState(e.consumption);
    this._setText('house-value', this._formatValue(consumption));

    // Inverter status
    const status = this._getTextState(e.inverter_status, 'Standby');
    this._setText('inverter-status', status);

    // Batteries
    const batMainPower = this._getState(e.battery_main_power);
    const batMainSoc = this._getState(e.battery_main_soc);
    this._setText('bat-main-power', this._formatValue(Math.abs(batMainPower)));
    this._setText('bat-main-soc', `${Math.round(batMainSoc)}%`);
    this._setBatteryBar('bat-main-bar', batMainSoc, batMainPower > 0);

    const batB2500_1Power = this._getState(e.battery_b2500_1_power);
    const batB2500_1Soc = this._getState(e.battery_b2500_1_soc);
    this._setText('bat-b2500-1-power', this._formatValue(Math.abs(batB2500_1Power)));
    this._setText('bat-b2500-1-soc', `${Math.round(batB2500_1Soc)}%`);
    this._setBatteryBar('bat-b2500-1-bar', batB2500_1Soc, batB2500_1Power > 0);

    const batB2500_2Power = this._getState(e.battery_b2500_2_power);
    const batB2500_2Soc = this._getState(e.battery_b2500_2_soc);
    this._setText('bat-b2500-2-power', this._formatValue(Math.abs(batB2500_2Power)));
    this._setText('bat-b2500-2-soc', `${Math.round(batB2500_2Soc)}%`);
    this._setBatteryBar('bat-b2500-2-bar', batB2500_2Soc, batB2500_2Power > 0);

    // Sub-loads
    const loads = [
      { id: 'load-klima', entity: e.load_klima },
      { id: 'load-server', entity: e.load_server },
      { id: 'load-warmwasser', entity: e.load_warmwasser },
      { id: 'load-trockner', entity: e.load_trockner },
      { id: 'load-garage', entity: e.load_garage },
      { id: 'load-garten', entity: e.load_garten },
    ];

    for (const load of loads) {
      if (!load.entity) continue;
      const val = this._getState(load.entity);
      this._setText(load.id, val > 0 ? this._formatValue(val) : '-');
    }

    // Update flow visibility and colors
    this._updateFlows();
  }

  _setText(id, text) {
    const el = this.querySelector(`#${id}`);
    if (el) el.textContent = text;
  }

  _updateNodeColor(id, color) {
    const el = this.querySelector(`#${id}`);
    if (el) el.setAttribute('fill', color);
  }

  _setBatteryBar(id, soc, isCharging) {
    const el = this.querySelector(`#${id}`);
    if (!el) return;
    const width = (soc / 100) * 86;
    el.setAttribute('width', Math.max(0, width));
    el.setAttribute('fill-opacity', isCharging ? '0.4' : '0.2');
  }

  _updateFlows() {
    if (!this._flowPaths || !this._hass) return;
    const e = this._entities;

    const pvMain = this._getState(e.pv_main);
    const pvBkw = this._getState(e.pv_bkw);
    const grid = this._getState(e.grid);
    const consumption = this._getState(e.consumption);
    const batMain = this._getState(e.battery_main_power);
    const batB2500_1 = this._getState(e.battery_b2500_1_power);
    const batB2500_2 = this._getState(e.battery_b2500_2_power);

    // PV Main -> Inverter (always flows when producing)
    this._setFlowVisibility('flow-pv-main', pvMain > 0);
    this._setFlowWidth('flow-pv-main', pvMain);

    // PV BKW -> Inverter
    this._setFlowVisibility('flow-pv-bkw', pvBkw > 0);
    this._setFlowWidth('flow-pv-bkw', pvBkw);

    // Inverter -> Grid (when exporting)
    const isExport = grid > 0;
    this._setFlowVisibility('flow-grid', isExport);
    this._setFlowWidth('flow-grid', Math.abs(grid));
    if (isExport) {
      this._setFlowColor('flow-grid', `url(#grad-grid-export)`);
    }

    // Grid -> Inverter (when importing) - reverse direction
    // Note: For import we would need a separate path, for now we just hide export path

    // Inverter -> House
    this._setFlowVisibility('flow-house', consumption > 0);
    this._setFlowWidth('flow-house', consumption);

    // Battery Main
    const batMainCharging = batMain < 0;
    this._setFlowVisibility('flow-bat-main', batMainCharging);
    this._setFlowVisibility('flow-bat-main-out', !batMainCharging && batMain !== 0);
    this._setFlowWidth('flow-bat-main', Math.abs(batMain));
    this._setFlowWidth('flow-bat-main-out', Math.abs(batMain));

    // Battery B2500-1
    const batB2500_1Charging = batB2500_1 < 0;
    this._setFlowVisibility('flow-bat-b2500-1', batB2500_1Charging);
    this._setFlowVisibility('flow-bat-b2500-1-out', !batB2500_1Charging && batB2500_1 !== 0);
    this._setFlowWidth('flow-bat-b2500-1', Math.abs(batB2500_1));
    this._setFlowWidth('flow-bat-b2500-1-out', Math.abs(batB2500_1));

    // Battery B2500-2
    const batB2500_2Charging = batB2500_2 < 0;
    this._setFlowVisibility('flow-bat-b2500-2', batB2500_2Charging);
    this._setFlowVisibility('flow-bat-b2500-2-out', !batB2500_2Charging && batB2500_2 !== 0);
    this._setFlowWidth('flow-bat-b2500-2', Math.abs(batB2500_2));
    this._setFlowWidth('flow-bat-b2500-2-out', Math.abs(batB2500_2));
  }

  _setFlowVisibility(id, visible) {
    const el = this.querySelector(`#${id}`);
    if (el) el.style.opacity = visible ? '0.8' : '0';
  }

  _setFlowWidth(id, power) {
    const el = this.querySelector(`#${id}`);
    if (!el) return;
    const minWidth = 1;
    const maxWidth = 8;
    const normalizedWidth = Math.min(maxWidth, minWidth + (Math.abs(power) / 500));
    el.setAttribute('stroke-width', normalizedWidth);
  }

  _setFlowColor(id, color) {
    const el = this.querySelector(`#${id}`);
    if (el) el.setAttribute('stroke', color);
  }

  _startAnimation() {
    if (this._animationFrame) return;
    const animate = () => {
      this._animateFlows();
      this._animationFrame = requestAnimationFrame(animate);
    };
    this._animationFrame = requestAnimationFrame(animate);
  }

  _animateFlows() {
    if (!this._flowPaths) return;
    const now = Date.now();
    const paths = this._flowPaths;

    for (const key in paths) {
      const path = paths[key];
      if (!path) continue;
      const style = window.getComputedStyle(path);
      if (style.opacity === '0') continue;

      const length = path.getTotalLength ? path.getTotalLength() : 200;
      const offset = -((now / (10 / this._config.animation_speed)) % length);
      path.style.strokeDasharray = '10, 15';
      path.style.strokeDashoffset = offset;
    }
  }

  disconnectedCallback() {
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  getCardSize() {
    return 8;
  }

  static getConfigForm() {
    return {
      schema: [
        { name: 'title', selector: { text: {} } },
        { name: 'show_title', selector: { boolean: {} } },
        { name: 'decimal_places', selector: { number: { min: 0, max: 3, step: 1 } } },
        { name: 'auto_scale', selector: { boolean: {} } },
        { name: 'animation_speed', selector: { number: { min: 0.1, max: 5, step: 0.1 } } },
      ]
    };
  }

  static getStubConfig() {
    return {
      title: 'Casa Energy',
      show_title: true,
      decimal_places: 0,
      auto_scale: true,
      animation_speed: 1
    };
  }
}

customElements.define('casa-energy-card', HeckmannEnergyFlowCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'casa-energy-card',
  name: 'Casa Energy',
  description: 'Animated power flow card for multi-battery energy systems with live watt sensors',
  preview: true,
  documentationURL: 'https://github.com/steuerlexi/casa-energy-card'
});

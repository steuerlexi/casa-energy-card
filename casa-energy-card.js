class CasaEnergyCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._entities = {};
    this._lastRender = 0;
    this._animationFrame = null;
    this._initialized = false;
    this._intersectionObserver = null;
  }

  connectedCallback() {
    if (!this._intersectionObserver) {
      this._intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this._startAnimation();
            } else {
              this._stopAnimation();
            }
          });
        },
        { threshold: 0 }
      );
    }
    this._intersectionObserver.observe(this);
    this._startAnimation();
  }

  setConfig(config) {
    const defaults = {
      title: 'Casa Energy',
      show_title: false,
      decimal_places: 0,
      auto_scale: false,
      animation_speed: 1,
      show_sonnenbatterie: true,
      show_b2500_baab: true,
      show_b2500_b9f4: true,
      show_daily_values: true,
      min_flow_watts: 10,
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
        daily_b2500_in: 'sensor.b2500_total_daily_energy_in',
        daily_b2500_out: 'sensor.b2500_total_daily_energy_out',
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

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    const event = new Event('hass-more-info', {
      bubbles: true,
      composed: true,
    });
    event.detail = { entityId: entityId };
    this.dispatchEvent(event);
  }

  _attachClickHandler(element, entityId) {
    if (!entityId) return;
    element.style.cursor = 'pointer';
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      this._fireMoreInfo(entityId);
    });
    element.addEventListener('mouseenter', () => {
      element.style.opacity = '0.85';
    });
    element.addEventListener('mouseleave', () => {
      element.style.opacity = '1';
    });
  }

  _render() {
    if (!this._config) return;
    const now = Date.now();
    if (now - this._lastRender < 50) return;
    this._lastRender = now;

    this.innerHTML = '';

    const card = document.createElement('ha-card');
    card.style.padding = '8px';
    card.style.background = this._config.colors.background;
    card.style.color = this._config.colors.text;
    card.style.display = 'block';
    card.style.width = '100%';
    card.style.fontFamily = 'var(--paper-font-body1_-_font-family), Roboto, sans-serif';

    if (this._config.show_title) {
      const title = document.createElement('div');
      title.textContent = this._config.title;
      title.style.fontSize = '18px';
      title.style.fontWeight = '500';
      title.style.marginBottom = '4px';
      title.style.textAlign = 'center';
      card.appendChild(title);
    }

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 800 340');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.maxHeight = 'none';
    svg.style.display = 'block';

    const defs = document.createElementNS(svgNS, 'defs');
    defs.innerHTML = `
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="grad-solar" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.solar}" stop-opacity="0.2"/>
        <stop offset="50%" stop-color="${this._config.colors.solar}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${this._config.colors.solar}" stop-opacity="0.2"/>
      </linearGradient>
      <linearGradient id="grad-solar-bkw" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.solar_bkw}" stop-opacity="0.2"/>
        <stop offset="50%" stop-color="${this._config.colors.solar_bkw}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${this._config.colors.solar_bkw}" stop-opacity="0.2"/>
      </linearGradient>
      <linearGradient id="grad-grid-export" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.grid_export}" stop-opacity="0.2"/>
        <stop offset="50%" stop-color="${this._config.colors.grid_export}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${this._config.colors.grid_export}" stop-opacity="0.2"/>
      </linearGradient>
      <linearGradient id="grad-grid-import" x1="100%" y1="0%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.grid_import}" stop-opacity="0.2"/>
        <stop offset="50%" stop-color="${this._config.colors.grid_import}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${this._config.colors.grid_import}" stop-opacity="0.2"/>
      </linearGradient>
      <linearGradient id="grad-battery-charge" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.battery_charge}" stop-opacity="0.2"/>
        <stop offset="50%" stop-color="${this._config.colors.battery_charge}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${this._config.colors.battery_charge}" stop-opacity="0.2"/>
      </linearGradient>
      <linearGradient id="grad-battery-discharge" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${this._config.colors.battery_discharge}" stop-opacity="0.2"/>
        <stop offset="50%" stop-color="${this._config.colors.battery_discharge}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${this._config.colors.battery_discharge}" stop-opacity="0.2"/>
      </linearGradient>
      <linearGradient id="grad-consumption" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${this._config.colors.consumption}" stop-opacity="0.2"/>
        <stop offset="50%" stop-color="${this._config.colors.consumption}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${this._config.colors.consumption}" stop-opacity="0.2"/>
      </linearGradient>
    `;
    svg.appendChild(defs);

    this._svg = svg;
    this._svgNS = svgNS;

    this._drawStaticElements(svg, svgNS);
    this._drawFlowPaths(svg, svgNS);
    this._drawBatteryBoxes(svg, svgNS);

    card.appendChild(svg);
    this.appendChild(card);

    this._startAnimation();
  }

  _drawStaticElements(svg, ns) {
    const e = this._entities;

    this._nodeGroups = {
      pvMain: this._createNodeGroup(svg, ns, 80, 60, 'mdi:solar-power', 'PV Anlage', this._config.colors.solar, 'pv-main-value', 'pv-main-daily', e.pv_main),
      pvBkw: this._createNodeGroup(svg, ns, 80, 180, 'mdi:solar-panel', 'BKW', this._config.colors.solar_bkw, 'pv-bkw-value', 'pv-bkw-daily', e.pv_bkw),
      inverter: this._createInverterGroup(svg, ns, 400, 120),
      grid: this._createNodeGroup(svg, ns, 720, 60, 'mdi:transmission-tower', 'Netz', this._config.colors.grid_export, 'grid-value', 'grid-daily', e.grid),
      house: this._createNodeGroup(svg, ns, 720, 180, 'mdi:home-lightning-bolt', 'Haus', this._config.colors.consumption, 'house-value', 'house-daily', e.consumption),
    };
  }

  _createNodeGroup(svg, ns, x, y, icon, label, color, valueId, dailyId = null, entityId = null) {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(${x}, ${y})`);

    // Clickable background circle (invisible but captures clicks)
    const hitArea = document.createElementNS(ns, 'circle');
    hitArea.setAttribute('r', '44');
    hitArea.setAttribute('fill', 'transparent');
    this._attachClickHandler(hitArea, entityId);
    g.appendChild(hitArea);

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('r', '28');
    circle.setAttribute('fill', 'var(--card-background-color, #fff)');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '2');
    g.appendChild(circle);

    const iconImg = document.createElementNS(ns, 'image');
    iconImg.setAttribute('href', this._getOpenMojiUrl(icon));
    iconImg.setAttribute('x', '-14');
    iconImg.setAttribute('y', '-14');
    iconImg.setAttribute('width', '28');
    iconImg.setAttribute('height', '28');
    iconImg.style.pointerEvents = 'none';
    g.appendChild(iconImg);

    const labelText = document.createElementNS(ns, 'text');
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('y', '45');
    labelText.setAttribute('font-size', '11');
    labelText.setAttribute('font-weight', '500');
    labelText.setAttribute('fill', this._config.colors.text);
    labelText.textContent = label;
    labelText.style.pointerEvents = 'none';
    g.appendChild(labelText);

    const valueText = document.createElementNS(ns, 'text');
    valueText.setAttribute('text-anchor', 'middle');
    valueText.setAttribute('y', '60');
    valueText.setAttribute('font-size', '13');
    valueText.setAttribute('font-weight', '600');
    valueText.setAttribute('fill', color);
    valueText.setAttribute('id', valueId);
    valueText.textContent = '0 W';
    valueText.style.cursor = entityId ? 'pointer' : 'default';
    valueText.style.pointerEvents = 'auto';
    this._attachClickHandler(valueText, entityId);
    g.appendChild(valueText);

    if (dailyId && this._config.show_daily_values) {
      const dailyText = document.createElementNS(ns, 'text');
      dailyText.setAttribute('text-anchor', 'middle');
      dailyText.setAttribute('y', '74');
      dailyText.setAttribute('font-size', '10');
      dailyText.setAttribute('fill', this._config.colors.text_secondary);
      dailyText.setAttribute('id', dailyId);
      dailyText.textContent = '';
      dailyText.style.pointerEvents = 'none';
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

    const iconImg = document.createElementNS(ns, 'image');
    iconImg.setAttribute('href', this._getOpenMojiUrl('mdi:current-ac'));
    iconImg.setAttribute('x', '-14');
    iconImg.setAttribute('y', '-14');
    iconImg.setAttribute('width', '28');
    iconImg.setAttribute('height', '28');
    iconImg.style.pointerEvents = 'none';
    g.appendChild(iconImg);

    const statusText = document.createElementNS(ns, 'text');
    statusText.setAttribute('text-anchor', 'middle');
    statusText.setAttribute('y', '45');
    statusText.setAttribute('font-size', '9');
    statusText.setAttribute('fill', this._config.colors.text_secondary);
    statusText.setAttribute('id', 'inverter-status');
    statusText.textContent = 'Standby';
    statusText.style.pointerEvents = 'none';
    g.appendChild(statusText);

    svg.appendChild(g);
    return g;
  }

  _getOpenMojiUrl(iconName) {
    const iconMap = {
      'mdi:solar-power': 'solar-energy',
      'mdi:solar-panel': 'solar-energy',
      'mdi:transmission-tower': 'high-voltage',
      'mdi:home-lightning-bolt': 'house',
      'mdi:current-ac': 'electric-plug',
      'mdi:battery': 'battery',
      'mdi:battery-charging': 'battery',
      'mdi:air-conditioner': 'snowflake',
      'mdi:monitor': 'desktop-computer',
      'mdi:water-boiler': 'hot-springs',
      'mdi:tumble-dryer': 't-shirt',
      'mdi:garage': 'automobile',
      'mdi:tree-outline': 'deciduous-tree'
    };
    const openmojiName = iconMap[iconName] || 'red-circle';
    return `https://api.iconify.design/openmoji/${openmojiName}.svg`;
  }

  _drawFlowPaths(svg, ns) {
    const c = this._config.colors;
    const paths = {};

    // PV Main -> Inverter
    paths.pvMainToInv = this._createFlowPath(svg, ns, 108, 60, 360, 90, 'grad-solar', c.solar, 'flow-pv-main');

    // PV BKW -> Inverter
    paths.pvBkwToInv = this._createFlowPath(svg, ns, 108, 180, 360, 150, 'grad-solar-bkw', c.solar_bkw, 'flow-pv-bkw');

    // Inverter -> Grid (export)
    paths.invToGrid = this._createFlowPath(svg, ns, 440, 90, 692, 60, 'grad-grid-export', c.grid_export, 'flow-grid');

    // Grid -> Inverter (import) - reverse direction, separate path
    paths.gridToInv = this._createFlowPath(svg, ns, 692, 60, 440, 90, 'grad-grid-import', c.grid_import, 'flow-grid-import');

    // Inverter -> House
    paths.invToHouse = this._createFlowPath(svg, ns, 440, 150, 692, 180, 'grad-consumption', c.consumption, 'flow-house');

    // Inverter -> Batteries (charge paths)
    if (this._config.show_sonnenbatterie) {
      paths.invToBatMain = this._createFlowPath(svg, ns, 400, 150, 200, 276, 'grad-battery-charge', c.battery_charge, 'flow-bat-main');
    }
    if (this._config.show_b2500_baab) {
      paths.invToBatB2500_1 = this._createFlowPath(svg, ns, 420, 150, 400, 276, 'grad-battery-charge', c.battery_charge, 'flow-bat-b2500-1');
    }
    if (this._config.show_b2500_b9f4) {
      paths.invToBatB2500_2 = this._createFlowPath(svg, ns, 440, 150, 600, 276, 'grad-battery-charge', c.battery_charge, 'flow-bat-b2500-2');
    }

    // Battery discharge -> Inverter
    if (this._config.show_sonnenbatterie) {
      paths.batMainToInv = this._createFlowPath(svg, ns, 200, 276, 380, 140, 'grad-battery-discharge', c.battery_discharge, 'flow-bat-main-out');
    }
    if (this._config.show_b2500_baab) {
      paths.batB2500_1ToInv = this._createFlowPath(svg, ns, 400, 276, 400, 140, 'grad-battery-discharge', c.battery_discharge, 'flow-bat-b2500-1-out');
    }
    if (this._config.show_b2500_b9f4) {
      paths.batB2500_2ToInv = this._createFlowPath(svg, ns, 600, 276, 420, 140, 'grad-battery-discharge', c.battery_discharge, 'flow-bat-b2500-2-out');
    }

    this._flowPaths = paths;
  }

  _createFlowPath(svg, ns, x1, y1, x2, y2, gradientId, arrowColor, id) {
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
    path.style.pointerEvents = 'none';
    svg.insertBefore(path, svg.firstChild.nextSibling);

    // Mid-path arrow
    const arrow = this._createMidArrow(svg, ns, x1, y1, x2, y2, arrowColor, id + '-arrow');

    return { path, arrow };
  }

  _createMidArrow(svg, ns, x1, y1, x2, y2, color, id) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = 2 * (y2 - y1);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(${midX}, ${midY}) rotate(${angle})`);
    g.setAttribute('id', id);
    g.style.opacity = '0';
    g.style.pointerEvents = 'none';

    const polygon = document.createElementNS(ns, 'polygon');
    polygon.setAttribute('points', '-6,-4 6,0 -6,4');
    polygon.setAttribute('fill', color);
    g.appendChild(polygon);

    svg.insertBefore(g, svg.firstChild.nextSibling);
    return g;
  }

  _drawBatteryBoxes(svg, ns) {
    const e = this._entities;
    const batteries = [];
    if (this._config.show_sonnenbatterie) {
      batteries.push({ x: 200, y: 276, label: 'Sonnenbatterie', color: '#4caf50', powerId: 'bat-main-power', socId: 'bat-main-soc', socBarId: 'bat-main-bar', entityPower: e.battery_main_power, entitySoc: e.battery_main_soc });
    }
    if (this._config.show_b2500_baab) {
      batteries.push({ x: 400, y: 276, label: 'B2500 baab', color: '#ff6b35', powerId: 'bat-b2500-1-power', socId: 'bat-b2500-1-soc', socBarId: 'bat-b2500-1-bar', entityPower: e.battery_b2500_1_power, entitySoc: e.battery_b2500_1_soc });
    }
    if (this._config.show_b2500_b9f4) {
      batteries.push({ x: 600, y: 276, label: 'B2500 b9f4', color: '#ff8c42', powerId: 'bat-b2500-2-power', socId: 'bat-b2500-2-soc', socBarId: 'bat-b2500-2-bar', entityPower: e.battery_b2500_2_power, entitySoc: e.battery_b2500_2_soc });
    }

    this._batteryElements = [];

    for (const bat of batteries) {
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('transform', `translate(${bat.x}, ${bat.y})`);

      // Hit area for clicking
      const hitArea = document.createElementNS(ns, 'rect');
      hitArea.setAttribute('x', '-50');
      hitArea.setAttribute('y', '-35');
      hitArea.setAttribute('width', '100');
      hitArea.setAttribute('height', '70');
      hitArea.setAttribute('fill', 'transparent');
      hitArea.setAttribute('cursor', 'pointer');
      this._attachClickHandler(hitArea, bat.entityPower || bat.entitySoc);
      g.appendChild(hitArea);

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
      label.style.pointerEvents = 'none';
      g.appendChild(label);

      // Power value (clickable)
      const power = document.createElementNS(ns, 'text');
      power.setAttribute('text-anchor', 'middle');
      power.setAttribute('y', '5');
      power.setAttribute('font-size', '12');
      power.setAttribute('font-weight', '600');
      power.setAttribute('fill', bat.color);
      power.setAttribute('id', bat.powerId);
      power.textContent = '0 W';
      power.style.cursor = bat.entityPower ? 'pointer' : 'default';
      power.style.pointerEvents = 'auto';
      this._attachClickHandler(power, bat.entityPower);
      g.appendChild(power);

      // SoC value (clickable)
      const soc = document.createElementNS(ns, 'text');
      soc.setAttribute('text-anchor', 'middle');
      soc.setAttribute('y', '20');
      soc.setAttribute('font-size', '10');
      soc.setAttribute('fill', this._config.colors.text_secondary);
      soc.setAttribute('id', bat.socId);
      soc.textContent = '0%';
      soc.style.cursor = bat.entitySoc ? 'pointer' : 'default';
      soc.style.pointerEvents = 'auto';
      this._attachClickHandler(soc, bat.entitySoc);
      g.appendChild(soc);

      svg.appendChild(g);
      this._batteryElements.push({ group: g, data: bat });
    }
  }

  _drawSubLoads(svg, ns) {
    // Sub-loads removed per user request
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

    // B2500 daily energy
    const dailyB2500In = this._getState(e.daily_b2500_in);
    const dailyB2500Out = this._getState(e.daily_b2500_out);
    let bkwDailyText = '';
    if (dailyB2500In > 0 || dailyB2500Out > 0) {
      bkwDailyText = `${dailyB2500In.toFixed(1)} in / ${dailyB2500Out.toFixed(1)} out kWh`;
    } else if (dailyB2500In > 0) {
      bkwDailyText = `${dailyB2500In.toFixed(1)} kWh`;
    }
    this._setText('pv-bkw-daily', bkwDailyText);

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
    const dailyLoad = this._getState(e.daily_load);
    this._setText('house-daily', dailyLoad > 0 ? `${dailyLoad.toFixed(1)} kWh` : '');

    // Inverter status
    const status = this._getTextState(e.inverter_status, 'Standby');
    this._setText('inverter-status', status);

    // Batteries
    const batMainPower = this._getState(e.battery_main_power);
    const batMainSoc = this._getState(e.battery_main_soc);
    this._setText('bat-main-power', this._formatValue(Math.abs(batMainPower)));
    this._setText('bat-main-soc', `${Math.round(batMainSoc)}%`);
    this._setBatteryBar('bat-main-bar', batMainSoc, batMainPower < 0);

    const batB2500_1Power = this._getState(e.battery_b2500_1_power);
    const batB2500_1Soc = this._getState(e.battery_b2500_1_soc);
    this._setText('bat-b2500-1-power', this._formatValue(Math.abs(batB2500_1Power)));
    this._setText('bat-b2500-1-soc', `${Math.round(batB2500_1Soc)}%`);
    this._setBatteryBar('bat-b2500-1-bar', batB2500_1Soc, batB2500_1Power < 0);

    const batB2500_2Power = this._getState(e.battery_b2500_2_power);
    const batB2500_2Soc = this._getState(e.battery_b2500_2_soc);
    this._setText('bat-b2500-2-power', this._formatValue(Math.abs(batB2500_2Power)));
    this._setText('bat-b2500-2-soc', `${Math.round(batB2500_2Soc)}%`);
    this._setBatteryBar('bat-b2500-2-bar', batB2500_2Soc, batB2500_2Power < 0);

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
    const minW = this._config.min_flow_watts || 10;

    if (!this._flowSpeeds) this._flowSpeeds = {};

    const pvMain = this._getState(e.pv_main);
    const pvBkw = this._getState(e.pv_bkw);
    const grid = this._getState(e.grid);
    const consumption = this._getState(e.consumption);
    const batMain = this._getState(e.battery_main_power);
    const batB2500_1 = this._getState(e.battery_b2500_1_power);
    const batB2500_2 = this._getState(e.battery_b2500_2_power);

    // PV Main -> Inverter
    this._setFlowVisibility('flow-pv-main', pvMain > minW);
    this._setFlowWidth('flow-pv-main', pvMain);
    this._flowSpeeds['flow-pv-main'] = this._calcFlowSpeed(pvMain);

    // PV BKW -> Inverter
    this._setFlowVisibility('flow-pv-bkw', pvBkw > minW);
    this._setFlowWidth('flow-pv-bkw', pvBkw);
    this._flowSpeeds['flow-pv-bkw'] = this._calcFlowSpeed(pvBkw);

    // Grid flows
    const isExport = grid > minW;
    const isImport = grid < -minW;
    this._setFlowVisibility('flow-grid', isExport);
    this._setFlowVisibility('flow-grid-import', isImport);
    this._setFlowWidth('flow-grid', Math.abs(grid));
    this._setFlowWidth('flow-grid-import', Math.abs(grid));
    this._flowSpeeds['flow-grid'] = this._calcFlowSpeed(Math.abs(grid));
    this._flowSpeeds['flow-grid-import'] = this._calcFlowSpeed(Math.abs(grid));

    // Inverter -> House
    this._setFlowVisibility('flow-house', consumption > minW);
    this._setFlowWidth('flow-house', consumption);
    this._flowSpeeds['flow-house'] = this._calcFlowSpeed(consumption);

    // Battery Main
    const batMainCharging = batMain < -minW;
    const batMainDischarging = batMain > minW;
    this._setFlowVisibility('flow-bat-main', batMainCharging);
    this._setFlowVisibility('flow-bat-main-out', batMainDischarging);
    this._setFlowWidth('flow-bat-main', Math.abs(batMain));
    this._setFlowWidth('flow-bat-main-out', Math.abs(batMain));
    this._flowSpeeds['flow-bat-main'] = this._calcFlowSpeed(Math.abs(batMain));
    this._flowSpeeds['flow-bat-main-out'] = this._calcFlowSpeed(Math.abs(batMain));

    // Battery B2500-1
    const bat1Charging = batB2500_1 < -minW;
    const bat1Discharging = batB2500_1 > minW;
    this._setFlowVisibility('flow-bat-b2500-1', bat1Charging);
    this._setFlowVisibility('flow-bat-b2500-1-out', bat1Discharging);
    this._setFlowWidth('flow-bat-b2500-1', Math.abs(batB2500_1));
    this._setFlowWidth('flow-bat-b2500-1-out', Math.abs(batB2500_1));
    this._flowSpeeds['flow-bat-b2500-1'] = this._calcFlowSpeed(Math.abs(batB2500_1));
    this._flowSpeeds['flow-bat-b2500-1-out'] = this._calcFlowSpeed(Math.abs(batB2500_1));

    // Battery B2500-2
    const bat2Charging = batB2500_2 < -minW;
    const bat2Discharging = batB2500_2 > minW;
    this._setFlowVisibility('flow-bat-b2500-2', bat2Charging);
    this._setFlowVisibility('flow-bat-b2500-2-out', bat2Discharging);
    this._setFlowWidth('flow-bat-b2500-2', Math.abs(batB2500_2));
    this._setFlowWidth('flow-bat-b2500-2-out', Math.abs(batB2500_2));
    this._flowSpeeds['flow-bat-b2500-2'] = this._calcFlowSpeed(Math.abs(batB2500_2));
    this._flowSpeeds['flow-bat-b2500-2-out'] = this._calcFlowSpeed(Math.abs(batB2500_2));
  }

  _calcFlowSpeed(powerWatts) {
    const baseSpeed = this._config.animation_speed || 1;
    if (powerWatts <= 10) return 0.2 * baseSpeed;
    const logSpeed = 0.3 + 0.4 * Math.log10(powerWatts / 10);
    return Math.min(2.0, logSpeed) * baseSpeed;
  }

  _setFlowVisibility(id, visible) {
    const path = this.querySelector(`#${id}`);
    if (path) path.style.opacity = visible ? '0.8' : '0';
    const arrow = this.querySelector(`#${id}-arrow`);
    if (arrow) arrow.style.opacity = visible ? '0.9' : '0';
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
    if (!this.isConnected || !this._flowPaths) return;
    const animate = () => {
      if (!this.isConnected) {
        this._stopAnimation();
        return;
      }
      this._animateFlows();
      this._animationFrame = requestAnimationFrame(animate);
    };
    this._animationFrame = requestAnimationFrame(animate);
  }

  _animateFlows() {
    if (!this._flowPaths) return;
    const now = Date.now();
    const paths = this._flowPaths;
    const speeds = this._flowSpeeds || {};

    for (const key in paths) {
      const obj = paths[key];
      if (!obj || !obj.path) continue;
      const path = obj.path;
      const style = window.getComputedStyle(path);
      if (style.opacity === '0') continue;

      const length = path.getTotalLength ? path.getTotalLength() : 200;
      const pathSpeed = speeds[key] || 0.5;
      const offset = -((now / (15 / pathSpeed)) % length);
      path.style.strokeDasharray = '10, 15';
      path.style.strokeDashoffset = offset;
    }
  }

  disconnectedCallback() {
    this._stopAnimation();
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }
  }

  _stopAnimation() {
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  getCardSize() {
    return 5;
  }

  static getConfigForm() {
    return {
      schema: [
        { name: 'title', selector: { text: {} } },
        { name: 'show_title', selector: { boolean: {} } },
        { name: 'decimal_places', selector: { number: { min: 0, max: 3, step: 1 } } },
        { name: 'auto_scale', selector: { boolean: {} } },
        { name: 'animation_speed', selector: { number: { min: 0.1, max: 5, step: 0.1 } } },
        { name: 'min_flow_watts', selector: { number: { min: 0, max: 100, step: 1 } } },
        { name: 'show_daily_values', selector: { boolean: {} } },
        { name: 'show_sonnenbatterie', selector: { boolean: {} } },
        { name: 'show_b2500_baab', selector: { boolean: {} } },
        { name: 'show_b2500_b9f4', selector: { boolean: {} } },
        { name: 'entities.pv_main', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.pv_bkw', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.daily_solar', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.grid', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.daily_export', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.consumption', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.daily_load', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.battery_main_power', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.battery_main_soc', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.battery_b2500_1_power', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.battery_b2500_1_soc', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.battery_b2500_2_power', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.battery_b2500_2_soc', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.daily_b2500_in', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.daily_b2500_out', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.inverter_status', selector: { entity: { domain: ['sensor'] } } },
        { name: 'entities.inverter_freq', selector: { entity: { domain: ['sensor'] } } },
      ]
    };
  }

  static getStubConfig() {
    return {
      title: 'Casa Energy',
      show_title: false,
      decimal_places: 0,
      auto_scale: false,
      animation_speed: 1,
      show_sonnenbatterie: true,
      show_b2500_baab: true,
      show_b2500_b9f4: true,
      show_daily_values: true,
      min_flow_watts: 10,
      grid_options: {
        columns: 'full',
        rows: 'auto'
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
        daily_solar: 'sensor.sonnenbatterie_81923_pv_tagesertrag',
        daily_export: 'sensor.sonnenbatterie_81923_einspeisung_tagesertrag',
        daily_b2500_in: 'sensor.b2500_total_daily_energy_in',
        daily_b2500_out: 'sensor.b2500_total_daily_energy_out',
      }
    };
  }
}

customElements.define('casa-energy-card', CasaEnergyCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'casa-energy-card',
  name: 'Casa Energy',
  description: 'Animated power flow card for multi-battery energy systems with live watt sensors',
  preview: true,
  documentationURL: 'https://github.com/steuerlexi/casa-energy-card'
});

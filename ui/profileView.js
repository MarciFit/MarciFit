/* MarciFit Profilo rendering, measurements, goal and anagrafica UI. */

function renderProfile() {
  renderProfileMenu();
  renderAnagrafica();
  renderGoalCard();
  renderOnDaysPicker();
  if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
  applyProfileSectionState();
}

const PROFILE_SECTIONS = [
  { key: 'account', label: 'Profilo locale', icon: '👤', desc: 'Dati salvati su questo dispositivo.' },
  { key: 'anagrafica', label: 'Anagrafica', icon: '📋', desc: 'Dati base, obiettivo e fabbisogno.' },
  { key: 'orari', label: 'Orari pasti', icon: '🕒', desc: 'Finestre orarie dei pasti principali.' },
  { key: 'allenamento', label: 'Giorni di allenamento', icon: '🏋️', desc: 'Settimana Workout/Rest abituale.' },
  { key: 'dati', label: 'Dati/export', icon: '💾', desc: 'Import, export e ripristino dati.' },
];

function getProfileActiveSection() {
  const key = S.profileUi?.activeSection || '';
  return PROFILE_SECTIONS.some(section => section.key === key) ? key : '';
}

function renderProfileMenu() {
  const el = document.getElementById('profile-menu');
  if (!el) return;
  const active = getProfileActiveSection();
  el.innerHTML = PROFILE_SECTIONS.map(section => `
    <button class="profile-menu-card${active === section.key ? ' active' : ''}" onclick="openProfileSection('${section.key}')">
      <span class="profile-menu-icon">${section.icon}</span>
      <span class="profile-menu-copy">
        <span class="profile-menu-title">${section.label}</span>
        <span class="profile-menu-desc">${section.desc}</span>
      </span>
      <span class="profile-menu-arrow">›</span>
    </button>`).join('');
}

function applyProfileSectionState() {
  const active = getProfileActiveSection();
  const menu = document.getElementById('profile-menu');
  const head = document.getElementById('profile-section-head');
  if (menu) menu.style.display = active ? 'none' : 'grid';
  if (head) {
    const section = PROFILE_SECTIONS.find(item => item.key === active);
    head.style.display = active ? 'flex' : 'none';
    head.innerHTML = section ? `
      <button class="profile-back-btn" onclick="openProfileSection('')" aria-label="Torna al menu profilo">‹</button>
      <div class="profile-section-head-copy">
        <div class="profile-section-kicker">Profilo</div>
        <div class="profile-section-title">${section.label}</div>
      </div>` : '';
  }
  document.querySelectorAll('[data-profile-section]').forEach(node => {
    node.style.display = active && node.dataset.profileSection === active ? '' : 'none';
  });
}

function openProfileSection(sectionKey = '') {
  if (!S.profileUi || typeof S.profileUi !== 'object') S.profileUi = {};
  S.profileUi.activeSection = sectionKey || '';
  saveSoon();
  renderProfileMenu();
  applyProfileSectionState();
}
function drawChart(log, opts = {}) {
  const el = document.getElementById('w-canvas');
  if (!el || !log?.length) return;
  const isCompact = window.innerWidth <= 720;
  const cssWidth = Math.max(260, Math.round(el.getBoundingClientRect().width || el.offsetWidth || 680));
  const cssHeight = isCompact ? 170 : 210;
  const dpr = window.devicePixelRatio || 1;
  el.style.width = '100%';
  el.style.height = `${cssHeight}px`;
  el.width = Math.round(cssWidth * dpr);
  el.height = Math.round(cssHeight * dpr);
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W=cssWidth, H=cssHeight, pad={t:18,r:24,b:30,l:42};
  const vals = log.map(l=>l.val);
  const rolling = opts.rolling || [];
  const targetW = opts.targetWeight ?? null;
  const n = vals.length;
  const allVals = [...vals, ...rolling.map(entry => entry.val), targetW].filter(v => v != null);
  const vmin = Math.min(...allVals) - 0.8;
  const vmax = Math.max(...allVals) + 0.8;
  const xs = i => pad.l + (W-pad.l-pad.r)*i/Math.max(n-1,1);
  const ys = v => H-pad.b - (v-vmin)/(vmax-vmin)*(H-pad.t-pad.b);
  ctx.clearRect(0,0,W,H);
  ctx.imageSmoothingEnabled = true;

  [0,.25,.5,.75,1].forEach(t => {
    const y=pad.t+(H-pad.t-pad.b)*t, v=(vmax-(vmax-vmin)*t).toFixed(1);
    ctx.strokeStyle='#e2dfd8';ctx.lineWidth=1;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    ctx.fillStyle='#8c877f';ctx.font='10px JetBrains Mono';ctx.fillText(v,2,y+3);
  });

  if (targetW) {
    const ty = ys(targetW);
    ctx.strokeStyle='#1c52a0';ctx.lineWidth=1;ctx.setLineDash([5,3]);
    ctx.beginPath();ctx.moveTo(pad.l,ty);ctx.lineTo(W-pad.r,ty);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#1c52a0';ctx.font='10px JetBrains Mono';
    ctx.fillText(`target ${targetW}kg`,W-pad.r+3,ty+3);
  }

  if (rolling.length >= 2) {
    ctx.strokeStyle='rgba(28,82,160,.5)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
    ctx.beginPath();
    rolling.forEach((entry, i) => i ? ctx.lineTo(xs(i), ys(entry.val)) : ctx.moveTo(xs(i), ys(entry.val)));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (vals.length < 2) {
    ctx.fillStyle='#1a6b3f';ctx.beginPath();ctx.arc(xs(0),ys(vals[0]),4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8c877f';ctx.font='10px JetBrains Mono';
    ctx.fillText(log[0].shortLabel || String(log[0].date || '').slice(0,5), pad.l+6, H-4);
    return;
  }

  const g=ctx.createLinearGradient(0,pad.t,0,H-pad.b);
  g.addColorStop(0,'rgba(26,107,63,.18)');g.addColorStop(1,'rgba(26,107,63,0)');
  ctx.fillStyle=g;ctx.beginPath();
  ctx.moveTo(xs(0),H-pad.b);
  vals.forEach((v,i)=>ctx.lineTo(xs(i),ys(v)));
  ctx.lineTo(xs(n-1),H-pad.b);ctx.closePath();ctx.fill();

  ctx.strokeStyle='#1a6b3f';ctx.lineWidth=2;ctx.lineJoin='round';ctx.setLineDash([]);
  ctx.beginPath();vals.forEach((v,i)=>i?ctx.lineTo(xs(i),ys(v)):ctx.moveTo(xs(i),ys(v)));ctx.stroke();

  vals.forEach((v,i)=>{
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(xs(i),ys(v),4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#1a6b3f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(xs(i),ys(v),4,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#8c877f';ctx.font='10px JetBrains Mono';
    const lx = Math.min(Math.max(xs(i)-12, pad.l), W-pad.r-36);
    ctx.fillText(log[i].shortLabel || String(log[i].date || '').slice(0,5), lx, H-4);
  });
}
function renderHeatmap(data) {
  const el = document.getElementById('stats-heatmap');
  if (!el) return;
  const CELL=14, GAP=3, DOW_W=18, STEP=CELL+GAP;
  const today = new Date(); today.setHours(23,59,59,0);
  const rangeEnd = new Date(data?.bounds?.end || today);
  rangeEnd.setHours(23,59,59,0);
  const daysBack = data?.bounds?.range === 'all'
    ? Math.min(Math.max((data?.bounds?.days || 1) - 1, 27), 111)
    : Math.max((data?.bounds?.days || 30) - 1, 27);
  const start = new Date(rangeEnd); start.setDate(rangeEnd.getDate()-daysBack);
  const startDow = start.getDay();
  start.setDate(start.getDate() + (startDow===0?-6:1-startDow));

  // Build week matrix
  const weeks=[], d=new Date(start);
  let week=[];
  while(d<=rangeEnd){ week.push({key:localDate(d),dow:d.getDay(),date:new Date(d),info:S.doneByDate[localDate(d)]}); if(week.length===7){weeks.push(week);week=[];} d.setDate(d.getDate()+1); }
  if(week.length) weeks.push(week);

  const W = DOW_W + weeks.length*STEP + GAP;
  const H = 20 + 7*STEP + 4; // month labels + 7 rows + padding

  el.innerHTML = `<canvas id="hm-canvas" style="width:100%;max-width:${W}px;height:${H}px;display:block"></canvas>
    <div class="hm-legend">
      <div class="hm-leg-item"><div class="hm-leg-dot" style="background:#1a6b3f"></div>ON completo</div>
      <div class="hm-leg-item"><div class="hm-leg-dot" style="background:#dfc070"></div>OFF completo</div>
      <div class="hm-leg-item"><div class="hm-leg-dot" style="background:#a8d4b8"></div>Parziale</div>
      <div class="hm-leg-item"><div class="hm-leg-dot" style="background:#e2dfd8"></div>Nessuno</div>
    </div>`;

  const cv = document.getElementById('hm-canvas');
  const dpr = window.devicePixelRatio||1;
  cv.width = W*dpr; cv.height = H*dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr,dpr);

  const COLORS = { full_on:'#2c9e5a', full_off:'#dfc070', part:'#a8d4b8', none:'#e2dfd8', future:'#f5f3f0' };
  const DOW_NAMES=['L','M','M','G','V','S','D'];

  // Day-of-week labels
  DOW_NAMES.forEach((lbl,i)=>{
    ctx.fillStyle='#8c877f';ctx.font='bold 8px Manrope,sans-serif';ctx.textAlign='right';
    ctx.fillText(lbl,DOW_W-2,20+i*STEP+CELL*0.75);
  });

  // Month labels + cells
  const MONTHS=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  let lastMonth=-1;
  weeks.forEach((w,wi)=>{
    const wx = DOW_W + wi*STEP;
    // Month label on first week of month
    const m = w[0].date.getMonth();
    if(m!==lastMonth){ ctx.fillStyle='#8c877f';ctx.font='bold 8px Manrope,sans-serif';ctx.textAlign='left'; ctx.fillText(MONTHS[m],wx,12); lastMonth=m; }
    w.forEach(({key,info,date},di)=>{
      const isFuture = date>today;
      let color = COLORS.none;
      if(isFuture) color=COLORS.future;
      else if(info?.hasActivity){ color = info.done > 0 && info.done>=info.total ? (info.type==='on'?COLORS.full_on:COLORS.full_off) : COLORS.part; }
      ctx.fillStyle=color;
      const rx=wx, ry=20+di*STEP;
      // Rounded rect
      const r=3;
      ctx.beginPath();ctx.moveTo(rx+r,ry);ctx.lineTo(rx+CELL-r,ry);ctx.quadraticCurveTo(rx+CELL,ry,rx+CELL,ry+r);
      ctx.lineTo(rx+CELL,ry+CELL-r);ctx.quadraticCurveTo(rx+CELL,ry+CELL,rx+CELL-r,ry+CELL);
      ctx.lineTo(rx+r,ry+CELL);ctx.quadraticCurveTo(rx,ry+CELL,rx,ry+CELL-r);
      ctx.lineTo(rx,ry+r);ctx.quadraticCurveTo(rx,ry,rx+r,ry);ctx.closePath();ctx.fill();
    });
  });

  // Tooltip on hover
  cv._weeks=weeks; cv._today=today; cv._DOW_W=DOW_W; cv._STEP=STEP; cv._CELL=CELL;
  cv.onmousemove = function(e) {
    const rect=this.getBoundingClientRect(), mx=(e.clientX-rect.left)*(this.width/dpr/rect.width), my=(e.clientY-rect.top)*(this.height/dpr/rect.height);
    const wi=Math.floor((mx-this._DOW_W)/this._STEP), di=Math.floor((my-20)/this._STEP);
    if(wi>=0&&wi<this._weeks.length&&di>=0&&di<7){
      const cell=this._weeks[wi][di];
      if (cell) {
        const note = S.notes[cell.key] ? ` · "${S.notes[cell.key].slice(0,30)}${S.notes[cell.key].length>30?'?':''}"` : '';
        const meta = cell.info?.hasActivity
          ? ` · ${cell.info.done}/${cell.info.total} pasti${cell.info.suppDone ? ` · ${cell.info.suppDone} integratori` : ''}${cell.info.waterCount ? ` · ${cell.info.waterCount} bicchieri` : ''}`
          : '';
        this.title = `${cell.key}${meta}${note}`;
      }
    }
  };
}
function renderRatio(data) {
  const el = document.getElementById('stats-ratio');
  if (!el) return;
  const entries = [];
  const cursor = new Date(data.bounds.start);
  while (cursor <= data.bounds.end) {
    const key = localDate(cursor);
    const info = S.doneByDate?.[key];
    if (info?.hasActivity) entries.push(info);
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!entries.length) { el.innerHTML = `<div style="font-size:12px;color:var(--muted)">Aggiungi un po di giorni e qui comparira il ritmo.</div>`; return; }
  const onDays  = entries.filter(e=>e.type==='on').length;
  const offDays = entries.filter(e=>e.type==='off').length;
  const total = onDays + offDays;
  const onPct = total ? Math.round(onDays/total*100) : 0;
  const expOnPct = Math.round(S.onDays.length/7*100);
  el.innerHTML = `
    <div class="ratio-labels stats-ratio-labels">
      <span style="color:var(--on)">Workout ${onDays} giorni (${onPct}%)</span>
      <span style="color:var(--off)">Rest ${offDays} giorni</span>
    </div>
    <div class="ratio-bar"><div class="ratio-fill" style="width:${onPct}%"></div></div>
    <div style="font-size:10px;color:var(--muted);margin-top:4px">Teorico: ${expOnPct}% Workout · ${100-expOnPct}% Rest</div>
    <div class="ratio-stats">
      <div class="rs"><div class="rs-v" style="color:var(--on)">${entries.filter(e=>e.type==='on'&&e.done>0&&e.done>=e.total).length}</div><div class="rs-l">Workout comp.</div></div>
      <div class="rs"><div class="rs-v" style="color:var(--off)">${entries.filter(e=>e.type==='off'&&e.done>0&&e.done>=e.total).length}</div><div class="rs-l">Rest comp.</div></div>
    </div>`;
}
function renderMeasurementsForm(bounds, entryTargetId = 'measurements-entry', logTargetId = 'measurements-log') {
  const el = document.getElementById(entryTargetId);
  if (!el) return;
  el.innerHTML = `
    <div class="meas-form">
      <div class="stats-form-note">Compila solo i campi che vuoi tracciare oggi. Potrai sempre sistemarli piu avanti.</div>
      <div class="meas-grid">
        <div class="meas-field"><label>Vita</label><input type="number" id="m-vita" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Fianchi</label><input type="number" id="m-fianchi" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Petto</label><input type="number" id="m-petto" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Braccio dx</label><input type="number" id="m-braccio" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Coscia</label><input type="number" id="m-coscia" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Peso</label><input type="number" id="m-peso" step="0.1" placeholder="–"><div class="meas-unit">kg</div></div>
      </div>
      <button class="meas-btn" onclick="addMeasurement()">+ Salva rilevazione</button>
    </div>`;
  renderMeasurementsLog(bounds, logTargetId);
}
function renderMeasurementsLog(bounds, targetId = 'measurements-log') {
  const el = document.getElementById(targetId);
  if (!el) return;
  const log = [...(bounds ? getMeasurementsForBounds(bounds) : (S.measurements || []).map(m => ({ ...m })))].reverse().slice(0,10);
  if (!log.length) { el.innerHTML=''; return; }
  const LABELS = {peso:'Peso',vita:'Vita',fianchi:'Fianchi',petto:'Petto',braccio:'Braccio',coscia:'Coscia'};
  const UNITS  = {peso:'kg', vita:'cm',fianchi:'cm',petto:'cm',braccio:'cm',coscia:'cm'};
  el.innerHTML = `<div class="stats-measure-log-card">
    <div class="stats-form-note" style="margin-bottom:10px">Cronologia misure: apri ogni riga se vuoi correggerla o rimuoverla.</div>
    <div class="stats-measure-log-scroll">
    ${log.map((m,ri) => {
      const prev = log[ri+1];
      const pills = Object.entries(LABELS).filter(([k])=>m[k]!==null&&m[k]!==undefined).map(([k,lbl])=>{
        let delta='';
        if(prev&&prev[k]!=null){const d=(m[k]-prev[k]).toFixed(1);const c=k==='peso'?(+d>0?'var(--on)':'var(--red)'):(+d>0?'var(--red)':'var(--on)');delta=`<span style="font-size:9px;color:${c};margin-left:3px">${+d>0?'+':''}${d}</span>`;}
        return `<div class="meas-pill"><strong>${m[k]}</strong> ${UNITS[k]} <span style="color:var(--muted)">${lbl}</span>${delta}</div>`;
      }).join('');
      return `<div class="meas-log-item">
        <div class="meas-log-date">${m.date.split('-').reverse().join('/')}</div>
        <div class="meas-vals">${pills}</div>
        <div class="stats-row-actions">
          <button class="stats-icon-btn" title="Modifica rilevazione" aria-label="Modifica rilevazione" onclick="editMeasurement(${m._idx})">✏️</button>
          <button class="stats-icon-btn danger" title="Elimina rilevazione" aria-label="Elimina rilevazione" onclick="delMeasurement(${m._idx})">🗑️</button>
        </div>
      </div>`;
    }).join('')}
    </div>
  </div>`;
}
function renderGoalCard() {
  const el = document.getElementById('goal-card');
  if (!el) return;
  el.innerHTML = '';
}
function supplementFormHTML(scope, opts = {}) {
  const safeScope = htmlEsc(scope || 'today');
  const isVisible = !!opts.visible;
  const isModal = !!opts.modal;
  return `
    <div id="supp-form-${safeScope}" data-supp-form-scope="${safeScope}" class="supp-form-shell${isModal ? ' supp-form-modal' : ''}" style="display:${isVisible ? 'block' : 'none'}">
      <div class="supp-form-grid">
        <div class="supp-form-field supp-form-field-name"><label class="supp-form-label">Nome</label>
          <input id="sf-name-${safeScope}" class="supp-form-input" type="text" placeholder="es. Magnesio"></div>
        <div class="supp-form-field"><label class="supp-form-label">Dose</label>
          <div class="supp-dose-wrap"><input id="sf-dose-${safeScope}" class="supp-form-input supp-dose-input" type="number" inputmode="decimal" min="0.1" max="100" step="0.1" placeholder="3"><span>g</span></div></div>
        <div class="supp-form-field"><label class="supp-form-label">Quando</label>
          <select id="sf-when-${safeScope}" class="supp-form-input supp-form-select">
            <option value="mattina">mattina</option>
            <option value="pranzo">pranzo</option>
            <option value="pomeriggio">pomeriggio</option>
            <option value="cena">cena</option>
            <option value="sera">sera</option>
          </select></div>
      </div>
      <div class="supp-form-actions">
        <button onclick="confirmAddSupp('${esc(scope || 'today')}')" class="supp-form-btn supp-form-btn-primary">Aggiungi</button>
        <button onclick="${isModal ? 'closeDayModal()' : `toggleSuppForm('${esc(scope || 'today')}')`}" class="supp-form-btn supp-form-btn-secondary">Annulla</button>
      </div>
    </div>`;
}
function renderWater() {
  const el = document.getElementById('water-widget');
  if (!el) return;
  const dateKey = S.selDate || localDate();
  const count = (S.water && S.water[dateKey]) || 0;
  const waterInfo = getWaterTargetInfo(dateKey);
  const totalMl = waterInfo.totalMl;
  const target = waterInfo.glasses;
  const remaining = Math.max(0, target - count);
  const footText = remaining === 0
    ? 'Obiettivo idratazione centrato.'
    : remaining === 1
      ? 'Manca 1 bicchiere.'
      : `Mancano ${remaining} bicchieri.`;

  const pct = Math.min(count / target, 1) * 100;
  const glasses = Array.from({length: target}, (_,i) =>
    `<span class="water-glass${i < count ? ' filled' : ''}" title="Bicchiere ${i+1}">🥛</span>`
  ).join('');

  const infoBtn = `<button class="water-info-btn" onmouseenter="showWaterTip(this)" onmouseleave="hideTip('tip-water')" onclick="showWaterTip(this)" title="Info fabbisogno idrico">i</button>`;
  const editBtn = `<button class="water-edit-btn" onclick="editWaterTarget('${dateKey}')" title="Modifica obiettivo acqua" aria-label="Modifica obiettivo acqua"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>`;

  el.innerHTML = `<div class="water-widget support-mini-card">
    <div class="water-top support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">Supporto idratazione</div>
        <div class="support-mini-title-row">
          <div class="water-title-cluster">
            <div class="support-mini-title">💧 Acqua di oggi</div>
            ${infoBtn}
            ${editBtn}
          </div>
        </div>
        <div class="support-mini-sub">${count}/${target} bicchieri · ${totalMl} ml</div>
      </div>
      <div class="water-head-actions">
        <div class="water-btns">
          <button class="water-btn" onclick="addWater(-1)"${count<=0?' disabled':''}>−</button>
          <span class="water-count">${count}<span class="water-target">/${target}</span></span>
          <button class="water-btn" onclick="addWater(1)"${count>=12?' disabled':''}>+</button>
        </div>
      </div>
    </div>
    <div class="water-bar-wrap">
      <div class="water-bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="water-glasses">${glasses}</div>
    <div class="water-foot">${footText}</div>
  </div>`;
}

function showWaterTip(anchor) {
  const tip = document.getElementById('tip-water');
  if (!tip) return;
  const dateKey = S.selDate || localDate();
  const { dayType, baseMl, bonusMl, autoMl, totalMl, glasses: target, isManual } = getWaterTargetInfo(dateKey);

  tip.innerHTML = `
    <div class="tip-title">💧 Fabbisogno idrico</div>
    <div class="tip-desc">
      Formula: <strong>35 ml × kg</strong> di peso corporeo${dayType === 'on' ? ' + <strong>350 ml</strong> giorno Workout' : ''}.
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
        <div style="text-align:center;background:var(--bg);border-radius:6px;padding:6px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:500;color:var(--on)">${totalMl} ml</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Obiettivo</div>
        </div>
        <div style="text-align:center;background:var(--bg);border-radius:6px;padding:6px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:500;color:var(--on)">${target} 🥛</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Bicchieri (250ml)</div>
        </div>
      </div>
      ${S.anagrafica?.peso > 0 ? `<div style="margin-top:8px;font-size:11px">Base automatica: ${S.anagrafica.peso} kg × 35 ml = <strong>${baseMl} ml</strong>${bonusMl ? ` + ${bonusMl} ml (giorno Workout) = <strong>${autoMl} ml</strong>` : ''}</div>` : '<div style="margin-top:8px;font-size:11px;color:var(--muted)">Inserisci il peso nel Profilo per un calcolo preciso.</div>'}
      ${isManual ? `<div style="margin-top:6px;font-size:11px;color:var(--on)">Target manuale attivo per questa data.</div>` : ''}
      <div style="margin-top:6px;font-size:10px;color:var(--muted)">Fonte: linee guida EFSA (2010) — adulti sani in clima temperato.</div>
    </div>`;
  showTip('tip-water', anchor);
}

function showDayModeTip(anchor) {
  const tip = document.getElementById('tip-day-mode');
  if (!tip) return;
  const phase = S.goal?.phase || 'mantieni';
  const phaseLabel = { bulk: 'bulk', cut: 'cut', mantieni: 'mantenimento' }[phase] || 'mantenimento';
  tip.innerHTML = `
    <div class="tip-title">Workout / Rest</div>
    <div class="tip-desc">
      Questo pulsante cambia la giornata tra <strong>allenamento</strong> e <strong>riposo</strong>.<br><br>
      Quando lo cambi, MarciFit aggiorna in modo coerente i <strong>target di kcal e macro</strong> del giorno in base alla tua fase attiva di <strong>${phaseLabel}</strong>.<br><br>
      In pratica: <strong>Workout</strong> usa i target del giorno con allenamento, <strong>Rest</strong> quelli del giorno di recupero.
    </div>`;
  showTip('tip-day-mode', anchor);
}

function pastiDistInfoHTML() {
  const type = S.day || 'on';
  const meals = S.meals[type] || [];
  const tgtK  = S.macro?.[type]?.k || 0;
  const totalPlanK = meals.reduce((s, meal) => s + (mealMacros(meal).kcal || 0), 0);
  const scale = tgtK > 0 && totalPlanK > 0 ? tgtK / totalPlanK : 1;
  const distRows = meals.map((meal, i) => {
    const mk = Math.round((mealMacros(meal).kcal || 0) * scale);
    const pct = tgtK > 0 ? Math.round(mk / tgtK * 100) : 0;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--b1)">
      <span style="font-size:11px;color:var(--ink2)">${meal.name || 'Pasto '+(i+1)}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500">${mk} kcal <span style="color:var(--muted);font-size:10px">(${pct}%)</span></span>
    </div>`;
  }).join('');
  return `
      <div style="margin-bottom:8px">
        ${distRows || '<span style="color:var(--muted)">Nessun pasto nel piano.</span>'}
      </div>
      <div style="margin-top:4px;font-size:10px;color:var(--muted)">
        Linee guida ISSN/ACSM: distribuire le proteine in <strong>3–5 pasti</strong> da 20–40 g per massimizzare la sintesi proteica muscolare (MPS).<br><br>
        Per la performance: il pasto pre-allenamento dovrebbe coprire il <strong>25–30%</strong> delle calorie giornaliere, con carboidrati complessi e proteine moderate.<br><br>
        Fonte: ISSN Position Stand 2017 · Aragon & Schoenfeld (2013).
      </div>`;
}

function showPastiDistInfoModal() {
  if (typeof showDayModal !== 'function') return;
  showDayModal({
    icon: '🍽️',
    eyebrow: 'Progress pasti',
    title: 'Distribuzione calorie',
    noButtons: true,
    modalClass: 'day-modal-detail pasti-dist-info-modal',
    body: `<div class="tip-desc">${pastiDistInfoHTML()}</div>`,
  });
}

function showPastiDistTip(anchor) {
  const tip = document.getElementById('tip-pasti-dist');
  if (!tip) return;
  tip.innerHTML = `
    <div class="tip-title">🍽️ Distribuzione calorie</div>
    <div class="tip-desc">${pastiDistInfoHTML()}</div>`;
  showTip('tip-pasti-dist', anchor);
}

function renderSuppToday() {
  const el = document.getElementById('supp-today');
  if (!el) return;
  const active = S.supplements.filter(s=>s.active);
  const dateKey = S.selDate || localDate();
  const checked = S.suppChecked[dateKey] || [];
  const checkSVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const doneCount = active.filter(s => checked.includes(s.id)).length;
  const pendingCount = Math.max(0, active.length - doneCount);
  const progressPct = active.length ? Math.round(doneCount / active.length * 100) : 0;
  const statusCls = active.length === 0 ? 'idle' : pendingCount === 0 ? 'done' : doneCount > 0 ? 'progress' : 'pending';
  const statusText = active.length === 0
    ? 'Da creare'
    : pendingCount === 0
      ? 'Fatta'
      : `${doneCount}/${active.length} presi`;
  const subText = active.length === 0
    ? 'Crea una routine semplice da ritrovare ogni giorno.'
    : pendingCount === 0
      ? 'Routine chiusa per oggi.'
      : doneCount === 0
        ? 'Segna gli integratori presi.'
        : `${pendingCount} ancora da segnare.`;
  const listMode = active.length > 4 ? ' is-long' : '';
  const rows = active.length ? active.map(s => {
    const done = checked.includes(s.id);
    const suppIndex = S.supplements.findIndex(item => item.id === s.id);
    const doseHTML = s.dose ? `<span class="supp-today-chip support-mini-chip">${htmlEsc(s.dose)}</span>` : '';
    const whenHTML = s.when ? `<span class="supp-today-chip support-mini-chip is-time">${htmlEsc(s.when)}</span>` : '';
    return `<div class="supp-today-item${done ? ' is-done' : ''}" data-supp-id="${s.id}">
      <button class="supp-today-btn${done?' done':''}" onclick="toggleSupp('${s.id}')">
        <span class="supp-today-check">${done ? checkSVG : ''}</span>
        <span class="supp-today-copy">
          <span class="supp-today-name">${htmlEsc(s.name)}</span>
          ${(doseHTML || whenHTML) ? `<span class="supp-today-meta">${doseHTML}${whenHTML}</span>` : `<span class="supp-today-meta supp-today-meta-muted">Tocca per segnare</span>`}
        </span>
      </button>
      <button class="supp-today-manage" onclick="toggleSuppActive(${suppIndex})" title="Disattiva integratore">✕</button>
    </div>`;
  }).join('') : `<div class="supp-today-empty">
      <div class="supp-today-empty-title">Nessuna routine ancora</div>
      <div class="supp-today-empty-text">Aggiungi il primo integratore e trasformalo in un gesto semplice da ritrovare ogni giorno.</div>
    </div>`;
  const addCard = `<button class="supp-today-add-card" onclick="toggleSuppForm('today')">
      <span class="supp-today-add-mark">
        <span class="supp-today-add-plus">+</span>
      </span>
      <span class="supp-today-add-copy">
        <span class="supp-today-add-title">Aggiungi integratore</span>
      </span>
    </button>`;

  el.innerHTML = `
    <div class="support-mini-card support-mini-card-supp ${statusCls}${active.length ? '' : ' is-empty'}">
      <div class="supp-today-head support-mini-head">
        <div class="supp-today-head-copy support-mini-head-copy">
          <div class="supp-today-kicker support-mini-kicker">Supporto routine</div>
          <div class="supp-today-title-row support-mini-title-row">
            <div class="supp-today-title support-mini-title"><span class="supp-today-title-icon">💊</span>Integratori</div>
            <span class="supp-today-state support-mini-state ${statusCls}">${statusText}</span>
          </div>
          <div class="supp-today-sub support-mini-sub">${subText}</div>
        </div>
      </div>
      ${active.length ? `<div class="supp-today-progress-shell">
        <div class="supp-today-progress-label">
          <span>${doneCount} completati</span>
          <span>${pendingCount ? `${pendingCount} mancanti` : 'tutto fatto'}</span>
        </div>
        <div class="supp-today-progress"><div class="supp-today-progress-fill ${statusCls}" style="width:${progressPct}%"></div></div>
      </div>` : ''}
      <div class="supp-today-list-shell${listMode}">
        <div class="supp-today-row">
          ${rows}
        </div>
      </div>
      ${addCard}
    </div>`;
  el.style.display='block';
}
function showStreakTip(anchor, streak) {
  const tip = document.getElementById('tip-streak');
  if (!tip) return;
  // Find best streak ever
  let best = 0, cur = 0;
  const days = Object.keys(S.doneByDate)
    .filter(key => (S.doneByDate[key]?.activityCount || 0) > 0)
    .sort();
  days.forEach((key, i) => {
    const prev = i > 0 ? days[i-1] : null;
    if (prev) {
      const diff = (new Date(key+'T12:00:00') - new Date(prev+'T12:00:00')) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
    } else cur = 1;
    if (cur > best) best = cur;
  });
  const adh = calcAdherence(28);
  tip.innerHTML = `
    <div class="tip-title">Streak · Giorni consecutivi</div>
    <div class="tip-desc">
      Giorni con almeno <strong>1 attivita registrata</strong> consecutiva: cibo, integratori o acqua.<br><br>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
        <div style="text-align:center;background:var(--off-l);border-radius:6px;padding:8px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;color:var(--amber)">${streak}</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Attuale</div>
        </div>
        <div style="text-align:center;background:var(--on-l);border-radius:6px;padding:8px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;color:var(--on)">${best}</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Record</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:11px">Aderenza 28 gg: <strong>${adh}%</strong></div>
    </div>`;
  showTip('tip-streak', anchor);
}

function showStatsScoreTip(anchor, score) {
  const tip = document.getElementById('tip-score');
  if (!tip) return;
  const data = getStatsRangeData(S.statsRange || '30d');
  const scoreLabel = getStatsScoreLabel(score);
  tip.innerHTML = `
    <div class="tip-title">Score · Lettura rapida della costanza</div>
    <div class="tip-desc">
      Lo score combina <strong>aderenza</strong>, pasti completati, idratazione, integrazione e un piccolo bonus streak.<br><br>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
        <div style="text-align:center;background:var(--off-l);border-radius:6px;padding:8px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;color:var(--ink)">${score}</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">${scoreLabel}</div>
        </div>
        <div style="text-align:center;background:var(--on-l);border-radius:6px;padding:8px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;color:var(--on)">${data.adherence.adherenceRate}%</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Aderenza</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:11px">Pasti completati: <strong>${data.adherence.mealRate}%</strong> · Acqua: <strong>${data.adherence.hydrationRate}%</strong> · Streak: <strong>${calcStreak()} giorni</strong></div>
    </div>`;
  showTip('tip-score', anchor);
}
// htmlEsc: safe for innerHTML content (escapes HTML entities)
function htmlEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// esc: safe for JS string attributes in onclick/onchange handlers
function esc(s) { return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/\n/g,' '); }
const _tipShownAt = {}; // tracks when each tip was last shown (ms)

function showTip(id, anchor) {
  const tip = document.getElementById(id);
  if (!tip) return;
  _tipShownAt[id] = Date.now();

  // Remove any stale outside-click handler from previous open
  if (tip._outsideHandler) {
    document.removeEventListener('pointerdown', tip._outsideHandler);
    tip._outsideHandler = null;
  }

  // Make visible off-screen to measure size
  tip.style.visibility = 'hidden';
  tip.style.display = 'block';

  const tipW = tip.offsetWidth;
  const tipH = tip.offsetHeight;
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const GAP = 10;

  // Horizontal: try to centre on anchor, clamp to viewport with padding
  let left = rect.left + rect.width/2 - tipW/2;
  left = Math.max(12, Math.min(left, vw - tipW - 12));

  // Vertical: prefer above, fall back to below if no room
  let top, arrowDir;
  if (rect.top - tipH - GAP > 12) {
    top = rect.top - tipH - GAP;
    arrowDir = 'up';
  } else {
    top = rect.bottom + GAP;
    arrowDir = 'down';
  }

  // Arrow x offset relative to tooltip
  const arrowX = Math.min(Math.max(rect.left + rect.width/2 - left, 16), tipW - 16);

  tip.className = `stat-tip tip-${arrowDir}`;
  tip.style.setProperty('--arrow-x', arrowX + 'px');
  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
  tip.style.visibility = 'visible';

  // Close immediately on scroll (user expects hover to vanish when scrolling)
  const onScroll = () => {
    tip.style.display = 'none';
    if (tip._outsideHandler) { document.removeEventListener('pointerdown', tip._outsideHandler); tip._outsideHandler = null; }
    tip._scrollHandler = null;
  };
  window.addEventListener('scroll', onScroll, { once: true, passive: true, capture: true });
  tip._scrollHandler = onScroll;

  // Outside-click/tap: close when touching anywhere outside the tip
  // (delayed 200ms to skip the triggering touch itself)
  const outside = (e) => {
    if (!tip.contains(e.target) && e.target !== anchor) {
      tip.style.display = 'none';
      if (tip._scrollHandler) { window.removeEventListener('scroll', tip._scrollHandler, { capture: true }); tip._scrollHandler = null; }
      document.removeEventListener('pointerdown', outside);
      tip._outsideHandler = null;
    }
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', outside, { passive: true });
    tip._outsideHandler = outside;
  }, 200);
}

function hideTip(id) {
  // Debounce: on mobile, a synthetic mouseleave fires immediately after onclick (~50ms).
  // Ignore if shown less than 400ms ago — scroll handler will close it instead.
  if (Date.now() - (_tipShownAt[id] || 0) < 80) return;
  const tip = document.getElementById(id);
  if (!tip) return;
  if (tip._outsideHandler) { document.removeEventListener('pointerdown', tip._outsideHandler); tip._outsideHandler = null; }
  if (tip._scrollHandler) { window.removeEventListener('scroll', tip._scrollHandler, { capture: true }); tip._scrollHandler = null; }
  tip.style.display = 'none';
}

// --- Fabbisogno section tooltips ---

function showFabBmrTip(anchor) {
  showDayModal({
    icon: '⚙️',
    title: 'Base metabolica',
    eyebrow: 'Fabbisogno',
    modalClass: 'day-modal-detail fab-explain-modal',
    noButtons: true,
    body: `<div class="fab-modal-copy">
      <p>È la stima delle calorie che consumeresti in una giornata di riposo completo, solo per mantenere attive le funzioni vitali: respirazione, temperatura corporea, organi, cervello.</p>
      <p>MarciFit usa la formula più adatta ai dati disponibili. Se hai inserito la percentuale di grasso, può stimare meglio la massa magra; altrimenti usa una formula standard basata su sesso, età, peso e altezza.</p>
      <p>Non è un obiettivo da mangiare: è la base su cui vengono aggiunti movimento, allenamento e digestione.</p>
    </div>`
  });
}

function showFabPalTip(anchor) {
  showDayModal({
    icon: '🚶',
    title: 'Movimento e attività',
    eyebrow: 'Fabbisogno',
    modalClass: 'day-modal-detail fab-explain-modal',
    noButtons: true,
    body: `<div class="fab-modal-copy">
      <p>Qui vengono aggiunte alla base metabolica le calorie legate alla vita reale.</p>
      <p><strong>Movimento quotidiano</strong>: passi, spostamenti, scale, lavoro e tutto ciò che non è allenamento. Se inserisci i passi medi, la stima diventa più personale.</p>
      <p><strong>Allenamento medio</strong>: le calorie degli allenamenti vengono distribuite sulla settimana, così il piano resta stabile giorno per giorno.</p>
      <p><strong>Digestione</strong>: una piccola quota di energia viene usata per digerire e metabolizzare il cibo. L'app usa un valore prudente e stabile.</p>
    </div>`
  });
}

function showFabTdeeTip(anchor) {
  showDayModal({
    icon: '🔥',
    title: 'Fabbisogno stimato',
    eyebrow: 'Fabbisogno',
    modalClass: 'day-modal-detail fab-explain-modal',
    noButtons: true,
    body: `<div class="fab-modal-copy">
      <p>È la stima delle calorie che consumi in un giorno medio. Serve come punto di partenza per calcolare i target di dieta.</p>
      <p>In pratica: <strong>base metabolica + movimento quotidiano + allenamento + digestione</strong>. Il risultato non è una verità assoluta, ma una stima ragionevole da cui partire.</p>
      <p>Il range mostrato accanto al valore principale ricorda che il dispendio reale può oscillare: sonno, stress, passi, intensità degli allenamenti e aderenza cambiano il risultato.</p>
      <p>Dopo abbastanza dati, l'app può calibrare leggermente i target se il peso non si muove come previsto.</p>
    </div>`
  });
}

function showFabGoalTip(anchor) {
  const phase = (typeof S !== 'undefined' && S.goal?.phase) || 'mantieni';
  const data = {
    bulk:     { title: 'BULK — MASSA', on: 'TDEE + 200 kcal', off: 'TDEE + 100 kcal', note: 'Surplus moderato: proteine fisse, grassi adeguati e carboidrati come variabile principale per spingere performance e recupero.', prot: '1.7 g/kg · grassi 1.0 g/kg' },
    cut:      { title: 'CUT — DEFINIZIONE', on: 'TDEE − 300 kcal', off: 'TDEE − 450 kcal', note: 'Deficit moderato con proteine più alte per proteggere la massa magra; i carboidrati scendono per ultimi.', prot: '2.0 g/kg · grassi 0.8 g/kg' },
    mantieni: { title: 'MANTENIMENTO', on: 'TDEE', off: 'TDEE − 100 kcal', note: 'Proteine e grassi restano stabili; i carboidrati completano le calorie residue e sostengono meglio le giornate ON.', prot: '1.6 g/kg · grassi 0.9 g/kg' },
  };
  const d = data[phase] || data.mantieni;
  showDayModal({
    icon: '🎯',
    title: d.title,
    eyebrow: 'Target',
    modalClass: 'day-modal-detail fab-explain-modal',
    noButtons: true,
    body: `<div class="fab-modal-copy">
      <p><strong>Giorno Workout:</strong> ${d.on}. È il giorno in cui l'allenamento richiede più energia e più carboidrati disponibili.</p>
      <p><strong>Giorno Rest:</strong> ${d.off}. È leggermente più basso perché non deve sostenere la stessa richiesta dell'allenamento.</p>
      <p>${d.note}</p>
      <p>Le proteine e i grassi hanno una soglia minima sensata: <strong>${d.prot}</strong>. Le calorie rimanenti vengono assegnate ai carboidrati.</p>
    </div>`
  });
}
function renderTmplFormItems() {
  const el = document.getElementById('tf-items-list');
  if (!el) return;
  el.innerHTML = '';
  if (!_tmplFormItems.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:4px 0">Nessun ingrediente ancora. Cercane uno qui sotto.</div>';
    return;
  }
  _tmplFormItems.forEach((it, ii) => {
    const k = Math.round(it.kcal100*it.grams/100);
    const row = document.createElement('div');
    row.className = 'food-item-row';
    row.innerHTML = `<div class="fir-dot"></div>
      <div class="fir-name">${htmlEsc(it.name)}</div>
      <div class="fir-grams-wrap">
        <input type="number" class="fir-grams" value="${it.grams}" min="0" max="2000" step="1">
        <span class="fir-unit">g</span>
      </div>
      <div class="fir-kcal">${k} kcal</div>
      <button class="fir-del">\xd7</button>`;
    row.querySelector('.fir-grams').addEventListener('input', function() {
      const nextGrams = Math.max(0, Math.round(+this.value || 0));
      _tmplFormItems[ii].grams = nextGrams;
      const kcalEl = row.querySelector('.fir-kcal');
      if (kcalEl) kcalEl.textContent = `${Math.round(it.kcal100 * nextGrams / 100)} kcal`;
    });
    row.querySelector('.fir-grams').addEventListener('blur', function() {
      const nextGrams = Math.max(0, Math.round(+this.value || 0));
      _tmplFormItems[ii].grams = nextGrams;
      this.value = nextGrams;
    });
    row.querySelector('.fir-del').addEventListener('click', () => {
      _tmplFormItems.splice(ii, 1);
      renderTmplFormItems();
    });
    el.appendChild(row);
  });
}
function renderAnagrafica() {
  const a = S.anagrafica || {};
  const g = S.goal || {};
  if (!S.profileUi || typeof S.profileUi !== 'object') S.profileUi = {};
  if (typeof S.profileUi.primaryExpanded !== 'boolean') S.profileUi.primaryExpanded = true;
  const coreProfileFields = [a.nome, a.sesso, a.eta, a.altezza, a.peso];
  const coreProfileCount = coreProfileFields.filter(v => v !== null && v !== undefined && String(v).trim() !== '').length;
  const hasStepsContext = a.passiGiornalieri !== null && a.passiGiornalieri !== undefined && String(a.passiGiornalieri).trim() !== '';
  const profileStateCls = coreProfileCount >= 5 && hasStepsContext ? 'done' : coreProfileCount >= 5 || coreProfileCount >= 3 ? 'progress' : 'idle';
  const profileStateText = coreProfileCount >= 5
    ? (hasStepsContext ? 'Completo' : 'Quasi pronto')
    : `${coreProfileCount}/5 essenziali`;

  // Orari pasti: parse e genera righe per i 4 pasti principali
  const _MT_LABELS = ['Colazione', 'Pranzo', 'Spuntino pom.', 'Cena'];
  const _MT_ICONS  = ['🥣', '🍽️', '🍎', '🍳'];
  function _parseT(str) {
    const m = (str || '').match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    return m ? { s: m[1], e: m[2] } : { s: '', e: '' };
  }
  const configuredMealTimes = [0,1,2,3].reduce((count, i) => {
    const meal = S.meals.off?.[i] || S.meals.on?.[i] || {};
    const { s, e } = _parseT(meal.time);
    return count + (s && e ? 1 : 0);
  }, 0);
  const mealTimeRowsHTML = [0,1,2,3].map(i => {
    const meal = S.meals.off?.[i] || S.meals.on?.[i] || {};
    const {s, e} = _parseT(meal.time);
    return `<div class="mt-row">
      <span class="mt-icon">${_MT_ICONS[i]}</span>
      <span class="mt-name">${_MT_LABELS[i]}</span>
      <div class="mt-time-group">
        <input type="time" class="mt-time-inp" id="mt-start-${i}" value="${s}" onchange="updateMealTime(${i})">
        <span class="mt-sep">–</span>
        <input type="time" class="mt-time-inp" id="mt-end-${i}" value="${e}" onchange="updateMealTime(${i})">
      </div>
    </div>`;
  }).join('');

  const curProf = PROFESSIONI.find(p => p.key === (a.professione || 'desk_sedentary')) || PROFESSIONI[0];
  const profItems = PROFESSIONI.map(p =>
    `<button class="pdrop-item${p.key === curProf.key ? ' sel' : ''}" onclick="setAnagProf('${p.key}')">
      <span class="pdrop-label">${htmlEsc(p.label)}</span>
      <span class="pdrop-desc">${htmlEsc(p.desc)}</span>
    </button>`
  ).join('');

  const freqBtns = ALLENAMENTI.map(al =>
    `<button class="freq-btn${a.allenamentiSett===al.key?' active':''}" data-k="${al.key}"
      onclick="setAnagFreq('${al.key}')" title="${htmlEsc(al.desc)}">${htmlEsc(al.label)}</button>`
  ).join('');

  const PHASE_INFO = {
    bulk:     { lbl:'Bulk',     desc:'Surplus moderato, proteine a 1.7 g/kg, grassi a 1.0 g/kg e carboidrati come leva principale per sostenere performance e crescita.' },
    cut:      { lbl:'Cut',      desc:'Deficit moderato con proteine a 2.0 g/kg e grassi a 0.8 g/kg; i carboidrati si adattano alle calorie residue.' },
    mantieni: { lbl:'Mantieni', desc:'Target vicino al mantenimento con proteine a 1.6 g/kg, grassi a 0.9 g/kg e carboidrati in residuo.' },
  };
  const phaseBtns = Object.entries(PHASE_INFO).map(([id, info]) =>
    `<button class="goal-phase-btn${g.phase===id?' active-'+id:''}" data-phase="${id}" onclick="setGoalPhase('${id}', true);_updateFabbisognoPreview();scheduleAnagraficaAutosave({immediate:true})">${info.lbl}</button>`
  ).join('');
  const activePhaseDesc = PHASE_INFO[g.phase]?.desc || '';
  const isPrimaryExpanded = S.profileUi?.activeSection === 'anagrafica' ? true : !!S.profileUi.primaryExpanded;

  document.getElementById('prof-card').innerHTML = `
    <div class="profile-anag-stack">
      <section class="profile-subcard profile-fab-subcard">
        <div class="profile-subcard-head">
          <div>
            <div class="anag-section-title">Fabbisogno</div>
            <div class="profile-subcard-title">Target giornalieri</div>
          </div>
          <span class="profile-collapse-badge ${profileStateCls}">${profileStateText}</span>
        </div>
        <div class="fabbisogno-card" id="fab-preview">
          <div class="fab-empty">Caricamento…</div>
        </div>
      </section>

      <section class="profile-subcard">
        <div class="profile-subcard-head">
          <div>
            <div class="anag-section-title">Anagrafica</div>
            <div class="profile-subcard-title">Dati base</div>
          </div>
        </div>
    <div class="anag-grid">
      <div class="anag-field anag-field-name">
        <div class="field-label-row">
          <label class="anag-label">Nome</label>
          <div class="name-char-count" id="anag-nome-count">${Math.min(String(a.nome || '').length, 40)}/40</div>
        </div>
        <input id="anag-nome" class="anag-input" maxlength="40" autocomplete="name" value="${htmlEsc(a.nome||'')}" oninput="_handleAnagInput('anag-nome');_updateFabbisognoPreview();scheduleAnagraficaAutosave()" onblur="_handleAnagInput('anag-nome',{forceValidate:true});scheduleAnagraficaAutosave({immediate:true})">
        <div class="anag-field-error" id="anag-error-nome"></div>
      </div>
      <div class="anag-field anag-field-sex">
        <label class="anag-label">Sesso</label>
        <div class="sesso-toggle">
          <button class="sesso-btn${a.sesso==='m'?' active':''}" data-s="m" onclick="setAnagSesso('m')">M</button>
          <button class="sesso-btn${a.sesso==='f'?' active':''}" data-s="f" onclick="setAnagSesso('f')">F</button>
        </div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Età</label>
        <div class="anag-input-wrap">
          <div class="anag-spin-wrap">
            <input id="anag-eta" class="anag-input anag-spin-input" type="number" min="10" max="99" inputmode="numeric" value="${a.eta||''}" oninput="_handleAnagInput('anag-eta');_updateFabbisognoPreview();scheduleAnagraficaAutosave()" onblur="_handleAnagInput('anag-eta',{forceValidate:true});scheduleAnagraficaAutosave({immediate:true})">
            <div class="anag-stepper"><button class="anag-step-btn" onclick="_stepAnagField('anag-eta',1)">▲</button><button class="anag-step-btn" onclick="_stepAnagField('anag-eta',-1)">▼</button></div>
          </div>
          <span class="anag-unit">anni</span>
        </div>
        <div class="anag-field-error" id="anag-error-eta"></div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Altezza</label>
        <div class="anag-input-wrap">
          <div class="anag-spin-wrap">
            <input id="anag-altezza" class="anag-input anag-spin-input" type="number" min="120" max="250" inputmode="numeric" value="${a.altezza||''}" oninput="_handleAnagInput('anag-altezza');_updateFabbisognoPreview();scheduleAnagraficaAutosave()" onblur="_handleAnagInput('anag-altezza',{forceValidate:true});scheduleAnagraficaAutosave({immediate:true})">
            <div class="anag-stepper"><button class="anag-step-btn" onclick="_stepAnagField('anag-altezza',1)">▲</button><button class="anag-step-btn" onclick="_stepAnagField('anag-altezza',-1)">▼</button></div>
          </div>
          <span class="anag-unit">cm</span>
        </div>
        <div class="anag-field-error" id="anag-error-altezza"></div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Peso</label>
        <div class="anag-input-wrap">
          <div class="anag-spin-wrap">
            <input id="anag-peso" class="anag-input anag-spin-input" type="number" min="30" max="300" step="0.1" inputmode="decimal" value="${a.peso||''}" oninput="_handleAnagInput('anag-peso');_updateFabbisognoPreview();scheduleAnagraficaAutosave()" onblur="_handleAnagInput('anag-peso',{forceValidate:true});scheduleAnagraficaAutosave({immediate:true})">
            <div class="anag-stepper"><button class="anag-step-btn" onclick="_stepAnagField('anag-peso',1)">▲</button><button class="anag-step-btn" onclick="_stepAnagField('anag-peso',-1)">▼</button></div>
          </div>
          <span class="anag-unit">kg</span>
        </div>
        <div class="anag-field-error" id="anag-error-peso"></div>
      </div>
      <div class="anag-field">
        <label class="anag-label">% Grasso <span class="anag-opt">(opz.)</span></label>
        <div class="anag-input-wrap">
          <input id="anag-grasso" class="anag-input" type="number" min="3" max="60" step="0.1" inputmode="decimal" value="${a.grassoCorporeo||''}" placeholder="—" oninput="_handleAnagInput('anag-grasso');_updateFabbisognoPreview();scheduleAnagraficaAutosave()" onblur="_handleAnagInput('anag-grasso',{forceValidate:true});scheduleAnagraficaAutosave({immediate:true})">
          <span class="anag-unit">%</span>
        </div>
        <div class="anag-field-error" id="anag-error-grasso"></div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Passi medi <span class="anag-opt">(opz.)</span></label>
        <div class="anag-input-wrap">
          <input id="anag-passi" class="anag-input" type="number" min="1000" max="40000" step="100" inputmode="numeric" value="${a.passiGiornalieri||''}" placeholder="Es. 8000" oninput="_handleAnagInput('anag-passi');_updateFabbisognoPreview();scheduleAnagraficaAutosave()" onblur="_handleAnagInput('anag-passi',{forceValidate:true});scheduleAnagraficaAutosave({immediate:true})">
          <span class="anag-unit">passi</span>
        </div>
        <div class="anag-field-error" id="anag-error-passi"></div>
      </div>
    </div>
      </section>

      <section class="profile-subcard">
        <div class="profile-subcard-head">
          <div>
            <div class="anag-section-title">Attività</div>
            <div class="profile-subcard-title">Movimento e allenamento</div>
          </div>
        </div>
    <div class="anag-field anag-field-wide" style="margin-bottom:12px">
      <label class="anag-label">Professione</label>
      <div class="pdrop" id="pdrop">
        <button class="pdrop-trigger" onclick="toggleProfDropdown(event)">
          <span id="pdrop-cur">${htmlEsc(curProf.label)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="pdrop-chevron"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="pdrop-list" id="pdrop-list">${profItems}</div>
      </div>
    </div>
    <div class="anag-field anag-field-wide">
      <label class="anag-label">Allenamenti / sett.</label>
      <div class="freq-toggle">${freqBtns}</div>
    </div>
      </section>

      <section class="profile-subcard profile-target-subcard">
        <div class="profile-subcard-head">
          <div>
            <div class="anag-section-title">Target</div>
            <div class="profile-subcard-title">Obiettivo nutrizionale</div>
          </div>
        </div>
      <div class="goal-phase-btns">${phaseBtns}</div>
      <div class="goal-phase-desc" id="goal-phase-desc">${activePhaseDesc}</div>
      </section>

      <div class="profile-autosave-note">Salvataggio automatico attivo</div>
    </div>`;

  // ── Card 2: Orari pasti ──
  const timesEl = document.getElementById('prof-times-card');
  if (timesEl) timesEl.innerHTML = `
    <div class="profile-card-head support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">Profilo</div>
        <div class="support-mini-title-row">
          <div class="support-mini-title">Orari pasti</div>
          <span class="support-mini-state ${configuredMealTimes === 4 ? 'done' : configuredMealTimes > 0 ? 'progress' : 'idle'}">${configuredMealTimes}/4</span>
        </div>
        <div class="support-mini-sub">Orari guida per tenere la giornata piu ordinata.</div>
      </div>
    </div>
    <div class="mt-card">${mealTimeRowsHTML}</div>`;

  const foodsEl = document.getElementById('prof-foods-card');
  if (foodsEl) foodsEl.innerHTML = favoriteFoodsProfileRedirectHTML();

  setTimeout(_updateFabbisognoPreview, 0);
}

function toggleProfilePrimaryCard() {
  if (!S.profileUi || typeof S.profileUi !== 'object') S.profileUi = {};
  S.profileUi.primaryExpanded = !S.profileUi.primaryExpanded;
  renderAnagrafica();
}

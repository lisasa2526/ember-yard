// Ember Yard — HUD, menus, kill feed, scoreboard and banners. A thin
// wrapper over the DOM ids in index.html; the game logic never touches the
// DOM directly, it calls these methods.
import { WEAPONS, SHOP } from './weapons.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.feedItems = [];
    this._bannerT = 0;
  }

  showHud(on) { $('hud').hidden = !on; }
  showMenu(on) { $('menu').hidden = !on; }
  showEnd(on) { $('end').hidden = !on; }
  showBoard(on) { $('board').hidden = !on; }
  showBuy(on) { $('buy').hidden = !on; }

  setVitals(hp, armor) {
    $('hp').textContent = Math.ceil(hp);
    $('hp').classList.toggle('low', hp <= 30);
    $('armor').textContent = armor > 0 ? `ARMOR ${Math.ceil(armor)}` : 'ARMOR 0';
    $('hp-bar').style.width = `${Math.max(0, hp)}%`;
    $('hp-bar').classList.toggle('low', hp <= 30);
    $('armor-bar').style.width = `${Math.max(0, Math.min(100, armor))}%`;
  }

  setAmmo(mag, reserve, weaponKey, reloading) {
    $('ammo-mag').textContent = reloading ? '--' : mag;
    $('ammo-reserve').textContent = `/ ${reserve}`;
    $('ammo').classList.toggle('empty', mag === 0);
    $('weapon-name').textContent = WEAPONS[weaponKey].name + (reloading ? ' · RELOADING' : '');
  }

  setScore(az, em, round, maxRounds) {
    $('score-az').textContent = az;
    $('score-em').textContent = em;
    $('round-label').textContent = `ROUND ${round} / ${maxRounds}`;
  }

  setTimer(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    $('timer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('timer').classList.toggle('urgent', s <= 15);
  }

  setMoney(m) {
    $('money').firstChild.textContent = `$${m}`;
  }

  setObjective(html) {
    $('objective').innerHTML = html;
  }

  setCrosshairSpread(px) {
    const c = $('crosshair');
    c.style.setProperty('--sp', `${px}px`);
    c.style.transform = `translate(-50%, -50%) scale(${1 + px / 26})`;
  }

  hitmarker(kill) {
    const h = $('hitmarker');
    h.classList.toggle('kill', !!kill);
    h.classList.add('on');
    setTimeout(() => h.classList.remove('on'), 110);
  }

  damageFlash() {
    const d = $('damage');
    d.classList.add('on');
    setTimeout(() => d.classList.remove('on'), 140);
  }

  feed(killer, victim, killerTeam, headshot) {
    const el = $('feed');
    const div = document.createElement('div');
    const kc = killerTeam === 'AZ' ? 'az' : 'em';
    div.innerHTML = `<b class="${kc}">${killer}</b> ${headshot ? '◉' : '✕'} <b>${victim}</b>`;
    el.prepend(div);
    while (el.children.length > 5) el.removeChild(el.lastChild);
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 6000);
  }

  banner(title, sub, kind) {
    const b = $('banner');
    $('banner-title').textContent = title;
    $('banner-sub').textContent = sub || '';
    b.className = `show ${kind || ''}`;
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => {
      b.className = '';
    }, 2600);
  }

  plant(show, label, frac) {
    $('plant').hidden = !show;
    if (show) {
      $('plant-label').textContent = label;
      $('plant-fill').style.width = `${Math.round(frac * 100)}%`;
    }
  }

  buildShop(money, owned, onBuy) {
    const shop = $('shop');
    shop.innerHTML = '';
    SHOP.forEach((item, i) => {
      const div = document.createElement('div');
      const isOwned = item.key === 'armor' ? false : owned.includes(item.key);
      const cant = money < item.price || (isOwned && item.key !== 'ammo');
      div.className = `item${isOwned ? ' owned' : ''}${cant ? ' cant' : ''}`;
      div.innerHTML = `<span class="k">${i + 1}</span><span><span class="n">${item.name}</span><br><span class="d">${item.desc}</span></span><span class="p">$${item.price}</span><span>${isOwned ? 'OWNED' : ''}</span>`;
      if (!cant) div.addEventListener('click', () => onBuy(item.key));
      shop.appendChild(div);
    });
  }

  setBuySub(text) {
    $('buy-sub').textContent = text;
  }

  scoreboard(rows, title) {
    $('board-title').textContent = title || 'Scoreboard';
    const body = $('board-body');
    body.innerHTML = '';
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.name}${r.you ? ' (YOU)' : ''}</td><td class="${r.team === 'AZ' ? 'az' : 'em'}">${r.team === 'AZ' ? 'AZURE' : 'EMBER'}</td><td>${r.kills}</td><td>${r.deaths}</td><td>$${r.money}</td>`;
      body.appendChild(tr);
    }
  }

  end(winner, sub) {
    $('end-title').textContent = winner === 'AZ' ? 'AZURE takes the yard' : 'EMBER holds the yard';
    $('end-sub').textContent = sub;
    $('end').hidden = false;
  }
}

(function () {
  'use strict';

  const trip = window.TRIP_DATA;
  const flightArchive = window.FLIGHT_DATA || { flights: [], years: [], statusCounts: {} };
  const app = document.getElementById('app');
  if (!trip || !app) {
    if (app) app.innerHTML = '<div class="loading-shell">影像资料未能载入，请检查 trip-data.js。</div>';
    return;
  }

  const photos = new Map(trip.photos.map(photo => [photo.id, photo]));
  const chapterById = new Map(trip.chapters.map(chapter => [chapter.id, chapter]));
  const lightboxOrder = trip.chapters.flatMap(chapter => chapter.photoIds);
  const sceneSteps = trip.chapters.flatMap(chapter => chapter.scenes);
  const sceneStepIndex = new Map(sceneSteps.map((scene, index) => [scene.id, index]));
  let currentLightboxIndex = 0;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateLabel = date => date ? date.slice(5).replace('-', '.') : '日期待确认';
  const photoOf = id => photos.get(id);

  // Airport reference points: OurAirports airports.csv (public domain), IATA codes.
  // Coordinates are kept locally so the flight map never requests remote map tiles.
  const flightAirportCoordinates = {
    BAR: [19.140951, 110.452766],
    BKI: [5.932743, 116.049324],
    BKK: [13.6811, 100.747002],
    CAN: [23.392401, 113.299004],
    CGQ: [43.996201, 125.684998],
    CJU: [33.512058, 126.492548],
    CKG: [29.712254, 106.651895],
    CNX: [18.7668, 98.962601],
    CTU: [30.558257, 103.945966],
    DCY: [29.31632, 100.060317],
    DLC: [38.965719, 121.538477],
    DLU: [25.649401, 100.319],
    DMK: [13.9126, 100.607002],
    DPS: [-8.748409, 115.167123],
    GMP: [37.5583, 126.791],
    HAK: [19.9349, 110.459],
    HAN: [21.221201, 105.806999],
    HGH: [30.23609, 120.428865],
    HKG: [22.31184, 113.914862],
    HND: [35.549678, 139.786958],
    ICN: [37.469101, 126.450996],
    KBV: [8.095591, 98.988955],
    KHH: [22.577101, 120.349998],
    KIX: [34.427299, 135.244003],
    KMG: [25.110313, 102.936743],
    KUL: [2.74558, 101.709999],
    LBJ: [-8.480694, 119.888306],
    LGK: [6.32973, 99.728699],
    LUM: [24.4011, 98.5317],
    MFM: [22.149599, 113.592003],
    NGO: [34.858398, 136.804993],
    NKG: [31.735032, 118.865949],
    NRT: [35.76858, 140.388714],
    PEK: [40.077349, 116.596702],
    PKX: [39.501289, 116.413967],
    PUS: [35.179501, 128.938004],
    PVG: [31.1434, 121.805],
    SHA: [31.198104, 121.33426],
    SUB: [-7.37983, 112.787003],
    SWA: [23.552, 116.5033],
    SYX: [18.3029, 109.412003],
    SZX: [22.639474, 113.803262],
    TAO: [36.361953, 120.088171],
    TFU: [30.31252, 104.441284],
    TPE: [25.0777, 121.233002],
    URC: [43.913584, 87.479372],
    USM: [9.54779, 100.061996],
    VTE: [17.985052, 102.566692],
    WUH: [30.774798, 114.213723],
    XIY: [34.442207, 108.762385],
    XMN: [24.543889, 118.127454],
    YNJ: [42.882801, 129.451004],
    ZUH: [22.006399, 113.375999],
  };

  function renderCover() {
    const cover = photoOf(trip.coverPhotoId);
    return `
      <section class="cover" id="cover" aria-label="旅行影像手记封面">
        <img class="cover-photo" src="${escapeHtml(cover.full)}" alt="${escapeHtml(cover.caption)}" fetchpriority="high">
        <div class="cover-shade" aria-hidden="true"></div>
        <div class="cover-content">
          <p class="cover-eyebrow">DON / A personal travel journal</p>
          <h1>Elsewhere.</h1>
          <p class="cover-subtitle">沿途 · DON 的旅行影像手记</p>
          <a class="cover-link" href="#map">打开旅程地图 <span aria-hidden="true">↗</span></a>
        </div>
        <div class="cover-edition">${trip.journeyCount} journeys<br>${trip.selectedCount} photographs</div>
      </section>`;
  }

  function renderOpeningNote() {
    return `<section class="opening-note" aria-label="影像手记简介">
      <h2>有些日子，<br>会因为一束<em>光</em><br>记得更久。</h2>
      <p>奈良的鹿在树影下回望，京都的鸟居在暮色里层层延伸，西安的夜色里有歌声；万象的路边是浓浓树荫，琅勃拉邦天还没亮，僧侣已经从街头走过。后来沿着东京湾去看海，在镰仓把脚步交给海风；到清迈看鸽群飞起，在名古屋等樱花开放。沿釜山海岸坐小火车，在首尔宫门前遇见春天；去阳朔顺水而行，到布罗莫等一场日出。旅途也走进香港、河内与大阪的街巷，海风吹过济州、甲米和科莫多。抬头看富士山，在大连沿海走一段路，才发现记住一场旅行的，常常是那些不经意的片刻。</p>
    </section>`;
  }

  // Give nearby places distinct targets while leaving routes at their real coordinates.
  function layoutMapMarkers(markers) {
    const laidOut = markers.map(marker => ({ ...marker, displayX: marker.x, displayY: marker.y }));
    const spacing = 38;
    for (let pass = 0; pass < 100; pass++) {
      if (pass < 70) {
        for (const marker of laidOut) {
          marker.displayX += (marker.x - marker.displayX) * .045;
          marker.displayY += (marker.y - marker.displayY) * .045;
        }
      }
      for (let i = 0; i < laidOut.length; i++) {
        for (let j = i + 1; j < laidOut.length; j++) {
          const first = laidOut[i];
          const second = laidOut[j];
          let dx = second.displayX - first.displayX;
          let dy = second.displayY - first.displayY;
          let distance = Math.hypot(dx, dy);
          if (distance >= spacing) continue;
          if (distance < .001) {
            const angle = (i * 7 + j * 11) * 2.39996;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }
          const shift = (spacing - distance) / (distance * 2);
          first.displayX -= dx * shift;
          first.displayY -= dy * shift;
          second.displayX += dx * shift;
          second.displayY += dy * shift;
        }
      }
      for (const marker of laidOut) {
        marker.displayX = Math.max(19, Math.min(981, marker.displayX));
        marker.displayY = Math.max(19, Math.min(541, marker.displayY));
      }
    }
    return laidOut;
  }

  function renderMap() {
    const markerById = new Map(trip.map.markers.map(marker => [marker.id, marker]));
    const routes = trip.map.routes.map(route => `<polyline class="map-route map-route-${route.year}" points="${route.ids.map(id => {
      const marker = markerById.get(id);
      return `${marker.x},${marker.y}`;
    }).join(' ')}"/>`).join('');
    const grid = [180, 360, 540, 720, 900].map(x => `<path class="map-grid" d="M${x} 0V560"/>`).join('')
      + [112, 224, 336, 448].map(y => `<path class="map-grid" d="M0 ${y}H1000"/>`).join('');
    const mapPaths = Object.entries(trip.map.paths).map(([code, path]) => `<path class="map-land map-land-${code.toLowerCase()}" d="${path}"/>`).join('');
    const markers = layoutMapMarkers(trip.map.markers).map(marker => {
      const moved = Math.hypot(marker.displayX - marker.x, marker.displayY - marker.y) > 2;
      return `<a class="map-marker map-marker-${marker.year}" data-map-city="${escapeHtml(marker.id)}" href="#${escapeHtml(marker.anchor)}" aria-label="跳转到${escapeHtml(marker.name)}照片">
        <title>${escapeHtml(marker.name)}</title>
        ${moved ? `<line class="map-marker-leader" x1="${marker.x}" y1="${marker.y}" x2="${marker.displayX.toFixed(1)}" y2="${marker.displayY.toFixed(1)}"/><circle class="map-marker-origin" cx="${marker.x}" cy="${marker.y}" r="2"/>` : ''}
        <circle class="map-marker-hit" cx="${marker.displayX.toFixed(1)}" cy="${marker.displayY.toFixed(1)}" r="18"/>
        <circle class="map-marker-halo" cx="${marker.displayX.toFixed(1)}" cy="${marker.displayY.toFixed(1)}" r="10"/>
        <circle class="map-marker-core" cx="${marker.displayX.toFixed(1)}" cy="${marker.displayY.toFixed(1)}" r="3"/>
      </a>`;
    }).join('');
    const cityLinks = trip.years.map(year => `<div class="map-city-year"><span>${year}</span>${trip.map.markers.filter(marker => marker.year === year).map(marker => `<a href="#${escapeHtml(marker.anchor)}" data-map-city="${escapeHtml(marker.id)}">${escapeHtml(marker.name)}</a>`).join('')}</div>`).join('');
    const list = trip.years.map(year => `<div class="atlas-year-group"><div class="atlas-year-label"><span>${year}</span><span>${trip.chapters.filter(chapter => chapter.year === year).length} 段旅程</span></div><ol class="atlas-list">${trip.chapters.filter(chapter => chapter.year === year).map(chapter => `<li>
      <a href="#${chapter.id}" data-map-country="${escapeHtml(chapter.id)}"><span class="route-number">${chapter.number}</span>
        <span class="route-name">${escapeHtml(chapter.name)} <small>${escapeHtml(chapter.english)}</small></span>
        <span class="route-date">${escapeHtml(chapter.period)}</span>
        <span class="route-place">${escapeHtml(chapter.country)} · ${escapeHtml(chapter.place)}</span>
      </a></li>`).join('')}</ol></div>`).join('');
    return `<section class="atlas" id="map" aria-labelledby="map-title">
      <div class="atlas-inner">
        <div class="atlas-head"><span class="section-kicker">Journey map</span><h2 id="map-title">把走过的路，<br>连成一张地图。</h2><p>路线按真实的城市位置绘制。相近的标记略微错开，细线指向实际位置。点击标记或城市名，回到那一段旅程的影像。</p></div>
        <div class="atlas-body">
          <div class="atlas-map">
            <svg viewBox="${trip.map.viewBox}" role="group" aria-label="旅行影像中的城市位置地图">
              <rect x="0" y="0" width="1000" height="560" fill="var(--paper-deep)"/>
              ${grid}${mapPaths}${routes}${markers}
            </svg>
            <nav class="map-city-list" aria-label="按城市查看照片">${cityLinks}</nav>
            <div class="map-note"><span>灰蓝：2024 · 蓝绿：2025 · 赭红：2026</span><span>底图轮廓：Natural Earth</span></div>
          </div>
          <div class="atlas-journey-list">${list}</div>
        </div>
      </div>
    </section>`;
  }

  function renderPhoto(id, featured = false) {
    const photo = photoOf(id);
    return `<figure class="photo-item${featured ? ' is-featured' : ''}" style="--photo-ratio: ${(photo.width / photo.height).toFixed(4)}">
      <button type="button" class="photo-button" data-photo-id="${escapeHtml(id)}" aria-label="查看高清照片：${escapeHtml(photo.caption)}">
        <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption)}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async">
      </button>
      <figcaption class="photo-caption"><span class="caption-name">${escapeHtml(photo.caption)}</span><span class="caption-date">${dateLabel(photo.date)}</span></figcaption>
    </figure>`;
  }

  function photoRows(ids) {
    const isPortrait = id => {
      const photo = photoOf(id);
      return photo.width / photo.height < .95;
    };
    const pairs = items => {
      const rows = [];
      for (let index = 0; index < items.length;) {
        if (index + 6 <= items.length && items.slice(index, index + 6).every(isPortrait)) {
          rows.push(items.slice(index, index + 3), items.slice(index + 3, index + 6));
          index += 6;
        } else {
          rows.push(items.slice(index, index + 2));
          index += 2;
        }
      }
      return rows;
    };
    if (ids.length === 1) return [ids];
    if (ids.length % 2 === 0) return pairs(ids);
    const featuredIndex = ids.findIndex((id, index) => {
      const photo = photoOf(id);
      return index % 2 === 0 && photo.width / photo.height >= 1.1;
    });
    if (featuredIndex >= 0) {
      return [...pairs(ids.slice(0, featuredIndex)), [ids[featuredIndex]],
        ...pairs(ids.slice(featuredIndex + 1))];
    }
    return [ids.slice(0, 3), ...pairs(ids.slice(3))];
  }

  function renderScene(scene) {
    const index = sceneStepIndex.get(scene.id);
    const previous = sceneSteps[index - 1];
    const next = sceneSteps[index + 1];
    const steps = `<nav class="scene-step-nav" aria-label="站点导航">
      ${previous ? `<a href="#${escapeHtml(previous.id)}">← 上一站</a>` : `<a href="#map">← 返回地图</a>`}
      ${next ? `<a href="#${escapeHtml(next.id)}">下一站 →</a>` : `<a href="#index">影像索引 →</a>`}
    </nav>`;
    const gallery = scene.layout === 'feature-grid'
      ? scene.photoIds.map(id => renderPhoto(id, id === scene.featuredPhotoId)).join('')
      : photoRows(scene.photoIds).map(row => `<div class="photo-row">${row.map(id => renderPhoto(id)).join('')}</div>`).join('');
    return `<article class="scene" id="${scene.id}">
      <div class="scene-copy"><span class="scene-date">${escapeHtml(scene.date)}</span><h4>${escapeHtml(scene.title)}</h4><p>${escapeHtml(scene.body)}</p><span class="scene-place">${escapeHtml(scene.place)}</span>${steps}</div>
      <div class="scene-gallery" data-count="${scene.photoIds.length}"${scene.layout ? ` data-layout="${escapeHtml(scene.layout)}"` : ''}>${gallery}</div>
    </article>`;
  }

  function renderYearDivider(year) {
    const chapters = trip.chapters.filter(chapter => chapter.year === year);
    const photos = chapters.reduce((total, chapter) => total + chapter.photoCount, 0);
    return `<section class="year-divider" id="year-${year}" aria-label="${year} 年旅程">
      <div class="year-divider-inner"><span class="section-kicker">The travel chapters</span><h2>${year}<span>.</span></h2>
      <p>${chapters.length} 段旅程 · ${photos} 张照片<br>${escapeHtml(chapters.map(chapter => chapter.name).join(' / '))}</p></div>
    </section>`;
  }

  function renderChapter(chapter, index) {
    const hero = photoOf(chapter.heroId);
    const next = trip.chapters[index + 1];
    const previous = trip.chapters[index - 1];
    const nextLink = next ? `<a class="chapter-next" href="#${next.id}">下一程：${escapeHtml(next.name)} ↗</a>` : '<a class="chapter-next" href="#index">查看影像索引 ↗</a>';
    const previousLink = previous ? `<a href="#${previous.id}">← 上一程：${escapeHtml(previous.name)}</a>` : '<a href="#map">← 返回地图</a>';
    return `<section class="chapter" id="${chapter.id}" data-chapter="${chapter.id}" data-year="${chapter.year}" aria-labelledby="${chapter.id}-title">
      <div class="chapter-opening">
        <img src="${escapeHtml(hero.full)}" alt="${escapeHtml(hero.caption)}" loading="lazy" decoding="async">
        <div class="chapter-opening-title"><span class="chapter-no">CHAPTER ${chapter.number} / ${chapter.year} · ${escapeHtml(chapter.period)}</span><h2 id="${chapter.id}-title">${escapeHtml(chapter.english)}</h2><p class="country-zh">${escapeHtml(chapter.country)} · ${escapeHtml(chapter.place)}</p></div>
      </div>
      <div class="chapter-intro"><div class="chapter-meta">${chapter.number} / ${chapter.year}<br>${escapeHtml(chapter.period)}</div><h3>${escapeHtml(chapter.opening)}</h3><p>${escapeHtml(chapter.intro)}</p></div>
      ${chapter.scenes.map(renderScene).join('')}
      <nav class="chapter-footer" aria-label="章节导航">${previousLink}<a href="#map">返回地图</a>${nextLink}</nav>
    </section>`;
  }

  function renderEnding() {
    const groups = trip.years.map(year => `<div class="contact-year-label">${year} / ${trip.chapters.filter(chapter => chapter.year === year).length} journeys</div>` + trip.chapters.filter(chapter => chapter.year === year).map(chapter => {
      const cells = chapter.photoIds.map((id, index) => {
        const photo = photoOf(id);
        return `<button type="button" class="contact-cell" data-number="${String(index + 1).padStart(2, '0')}" data-photo-id="${id}" aria-label="查看高清照片：${escapeHtml(photo.caption)}"><img src="${escapeHtml(photo.src)}" alt="" loading="lazy" decoding="async"></button>`;
      }).join('');
      return `<section class="contact-group" aria-labelledby="contact-${chapter.id}"><div class="contact-head"><h3 id="contact-${chapter.id}"><a href="#${chapter.id}">${escapeHtml(chapter.name)} / ${escapeHtml(chapter.english)}</a></h3><span>${chapter.photoCount} 张 · ${escapeHtml(chapter.period)}</span></div><div class="contact-grid">${cells}</div></section>`;
    }).join('')).join('');
    return `<section class="ending" id="index" aria-labelledby="index-title"><div class="ending-inner">
      <div class="ending-head"><span class="section-kicker">Journey index</span><h2 id="index-title">把路上的片刻，<br>排成一页。</h2><p>${trip.journeyCount} 段旅程的影像索引，收录本页全部 ${trip.selectedCount} 张照片。点击画面查看高清版本，用方向键继续翻阅。</p></div>
      ${groups}
      <div class="ending-note"><p>旅程结束后，照片仍会带我们回到那个时刻。</p><a href="#cover">回到封面 ↑</a></div>
    </div></section>`;
  }

  function flightMapPoint(code, historicTao) {
    // All current TAO records predate the 2021-08-12 move from Liuting to Jiaodong.
    const position = code === 'TAO' && historicTao ? [36.265837, 120.37459] : flightAirportCoordinates[code];
    return position && Number.isFinite(position[0]) && Number.isFinite(position[1])
      ? { x: (position[1] - 90) / 55 * 1000, y: (48 - position[0]) / 58 * 560 }
      : null;
  }

  function layoutFlightMapAirports(airports) {
    const placed = airports.map(airport => ({ ...airport, displayX: airport.x, displayY: airport.y }));
    for (let pass = 0; pass < 60; pass++) {
      for (const airport of placed) {
        airport.displayX += (airport.x - airport.displayX) * .055;
        airport.displayY += (airport.y - airport.displayY) * .055;
      }
      for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
        const first = placed[i], second = placed[j];
        let dx = second.displayX - first.displayX, dy = second.displayY - first.displayY;
        let distance = Math.hypot(dx, dy);
        if (distance >= 16) continue;
        if (distance < .001) {
          const angle = (i * 7 + j * 11) * 2.39996;
          dx = Math.cos(angle); dy = Math.sin(angle); distance = 1;
        }
        const push = (16 - distance) / distance / 2;
        first.displayX -= dx * push; first.displayY -= dy * push;
        second.displayX += dx * push; second.displayY += dy * push;
      }
    }
    return placed;
  }

  function flightMapArc(first, second) {
    const dx = second.x - first.x, dy = second.y - first.y;
    const bend = Math.min(48, Math.hypot(dx, dy) * .13);
    const controlX = (first.x + second.x) / 2 - dy / Math.max(1, Math.hypot(dx, dy)) * bend;
    const controlY = (first.y + second.y) / 2 + dx / Math.max(1, Math.hypot(dx, dy)) * bend;
    return `M${first.x.toFixed(1)},${first.y.toFixed(1)} Q${controlX.toFixed(1)},${controlY.toFixed(1)} ${second.x.toFixed(1)},${second.y.toFixed(1)}`;
  }

  function renderFlightMap(records) {
    const airports = new Map(), routes = new Map();
    const taoFlights = records.filter(flight => flight.departure === 'TAO' || flight.arrival === 'TAO');
    const historicTao = taoFlights.length > 0 && taoFlights.every(flight => flight.date < '2021-08-12');
    for (const flight of records) {
      for (const [codeKey, cityKey, countKey] of [
        ['departure', 'departureCity', 'departures'], ['arrival', 'arrivalCity', 'arrivals']
      ]) {
        const code = String(flight[codeKey] || '').trim().toUpperCase();
        if (!code) continue;
        if (!airports.has(code)) airports.set(code, { code, city: '', departures: 0, arrivals: 0 });
        const airport = airports.get(code);
        if (!airport.city && flight[cityKey]) airport.city = String(flight[cityKey]).trim();
        airport[countKey]++;
      }
      const from = String(flight.departure || '').trim().toUpperCase();
      const to = String(flight.arrival || '').trim().toUpperCase();
      if (from && to && from !== to) {
        const key = [from, to].sort().join('—');
        routes.set(key, (routes.get(key) || 0) + 1);
      }
    }

    const mappedAirports = layoutFlightMapAirports([...airports.values()].map(airport => {
      const point = flightMapPoint(airport.code, historicTao);
      return point && { ...airport, ...point, city: historicTao && airport.code === 'TAO' ? `${airport.city}流亭机场` : airport.city };
    }).filter(Boolean));
    const byCode = new Map(mappedAirports.map(airport => [airport.code, airport]));
    const mappedRoutes = [...routes].map(([key, count]) => {
      const [from, to] = key.split('—');
      return byCode.has(from) && byCode.has(to) ? { from, to, count, first: byCode.get(from), second: byCode.get(to) } : null;
    }).filter(Boolean).sort((first, second) => first.count - second.count || first.from.localeCompare(second.from));
    const mapPaths = Object.entries(trip.map.paths).map(([code, path]) => `<path class="flight-map-land flight-map-land-${code.toLowerCase()}" d="${path}"/>`).join('');
    const routePaths = mappedRoutes.map(route => {
      const label = `${route.first.city || route.from} ${route.from} 往返 ${route.second.city || route.to} ${route.to}，共 ${route.count} 趟`;
      const path = flightMapArc(route.first, route.second);
      return `<g class="flight-map-route${route.count >= 3 ? ' is-frequent' : ''}" data-flight-map-route data-from="${escapeHtml(route.from)}" data-to="${escapeHtml(route.to)}" data-label="${escapeHtml(label)}" data-count="${route.count}" role="button" tabindex="0" aria-label="${escapeHtml(label)}" aria-pressed="false"><path class="flight-map-route-stroke" d="${path}" style="--route-weight:${(1.1 + Math.sqrt(route.count) * .36).toFixed(2)}"/><path class="flight-map-route-hit" d="${path}"/></g>`;
    }).join('');
    const rank = mappedAirports.slice().sort((first, second) => second.departures + second.arrivals - first.departures - first.arrivals);
    const labeled = [];
    for (const airport of rank) {
      if (labeled.length >= 8) break;
      if (labeled.every(other => Math.hypot(other.displayX - airport.displayX, other.displayY - airport.displayY) >= 53)) labeled.push(airport);
    }
    const labelCodes = new Set(labeled.map(airport => airport.code));
    const markers = mappedAirports.map(airport => {
      const visits = airport.departures + airport.arrivals;
      const label = `${airport.city || airport.code} ${airport.code}，起飞 ${airport.departures} 次，抵达 ${airport.arrivals} 次`;
      const moved = Math.hypot(airport.x - airport.displayX, airport.y - airport.displayY) > 2;
      return `<g class="flight-map-airport${labelCodes.has(airport.code) ? ' is-labeled' : ''}" data-flight-map-airport data-code="${escapeHtml(airport.code)}" data-label="${escapeHtml(label)}" role="button" tabindex="0" aria-label="${escapeHtml(label)}" aria-pressed="false">${moved ? `<path class="flight-map-leader" d="M${airport.x.toFixed(1)},${airport.y.toFixed(1)}L${airport.displayX.toFixed(1)},${airport.displayY.toFixed(1)}"/>` : ''}<circle class="flight-map-airport-hit" cx="${airport.displayX.toFixed(1)}" cy="${airport.displayY.toFixed(1)}" r="11"/><circle class="flight-map-airport-ring" cx="${airport.displayX.toFixed(1)}" cy="${airport.displayY.toFixed(1)}" r="${Math.min(5.5, 2.7 + Math.sqrt(visits) * .24).toFixed(1)}"/><circle class="flight-map-airport-core" cx="${airport.displayX.toFixed(1)}" cy="${airport.displayY.toFixed(1)}" r="1.4"/>${labelCodes.has(airport.code) ? `<text x="${(airport.displayX + 11).toFixed(1)}" y="${(airport.displayY - 8).toFixed(1)}">${escapeHtml(airport.code)}</text>` : ''}</g>`;
    }).join('');
    const knownDistances = records.map(flight => Number(flight.distance)).filter(distance => Number.isFinite(distance) && distance > 0);
    const totalDistance = knownDistances.reduce((sum, distance) => sum + distance, 0);
    const missingCodes = [...airports.keys()].filter(code => !byCode.has(code));
    const coverage = missingCodes.length ? `已绘制 ${mappedAirports.length}/${airports.size} 座机场；待定位 ${missingCodes.join('、')}` : `已绘制全部 ${airports.size} 座机场`;
    return `<div class="flight-atlas" aria-labelledby="flight-atlas-title">
      <div class="flight-atlas-header"><div><span class="flight-atlas-eyebrow">Route atlas / 航线地理</span><h4 id="flight-atlas-title">把起飞与抵达，<br>落在地图上。</h4></div><div class="flight-atlas-distance"><strong>约 ${totalDistance.toLocaleString('zh-CN')}<small> km</small></strong><span>档案航程参考合计（非实际飞行轨迹）</span>${knownDistances.length < records.length ? `<small>${knownDistances.length}/${records.length} 趟有里程</small>` : ''}</div></div>
      <div class="flight-atlas-toolbar"><p>${records.length} 趟航班 · ${routes.size} 组机场组合 · ${coverage}</p><div class="flight-map-filters" role="group" aria-label="筛选地图航线"><button type="button" data-flight-map-filter="all" aria-pressed="true">全部航线</button><button type="button" data-flight-map-filter="frequent" aria-pressed="false">常飞航线 ≥ 3 趟</button></div></div>
      <p class="flight-map-mobile-hint">← 左右滑动查看全图 →</p><div class="flight-atlas-scroll" tabindex="0" aria-label="航线图，窄屏时可横向滚动"><svg class="flight-atlas-svg" viewBox="-145 -20 1230 620" role="group" aria-label="以真实机场位置绘制的航线图。可点击或用 Tab 键选择机场及航线。"><rect class="flight-map-sea" x="-145" y="-20" width="1230" height="620"/><g class="flight-map-grid"><path d="M0 -20V600M200 -20V600M400 -20V600M600 -20V600M800 -20V600M1000 -20V600M-145 100H1085M-145 250H1085M-145 400H1085M-145 550H1085"/></g><g class="flight-map-landforms">${mapPaths}</g><g class="flight-map-routes">${routePaths}</g><g class="flight-map-airports">${markers}</g></svg></div>
      <div class="flight-atlas-bottom"><p class="flight-atlas-inspector" id="flight-atlas-inspector" aria-live="polite"><strong>从一座机场，到另一座机场。</strong><span>点选地图上的航线或机场，查看这段记录。</span></p><button class="flight-map-reset" type="button" id="flight-map-reset" hidden>清除选择 ↗</button></div>
      <p class="flight-atlas-note">地图聚焦记录中的机场。弧线按机场组合合并，线条轻重表示次数，线路仅为示意；相近机场标记略微错开，细线指向实际位置。涉及国家轮廓：<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>；机场坐标：<a href="https://ourairports.com/data/" target="_blank" rel="noopener noreferrer">OurAirports</a>。${historicTao ? '2021 年的 TAO 航班按当时的流亭机场位置绘制。' : ''}</p>
    </div>`;
  }

  function renderFlightStats(records) {
    const airports = new Map();
    const airlines = new Map();
    const routes = new Map();
    const formatNumber = value => Number(value).toLocaleString('zh-CN');

    for (const flight of records) {
      const airline = String(flight.airline || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
      if (airline) airlines.set(airline, (airlines.get(airline) || 0) + 1);

      for (const [codeKey, cityKey, countKey] of [
        ['departure', 'departureCity', 'departures'],
        ['arrival', 'arrivalCity', 'arrivals']
      ]) {
        const code = String(flight[codeKey] || '').trim().toUpperCase();
        if (!code) continue;
        const city = String(flight[cityKey] || '').trim();
        if (!airports.has(code)) airports.set(code, { code, city, departures: 0, arrivals: 0 });
        const airport = airports.get(code);
        if (!airport.city && city) airport.city = city;
        airport[countKey]++;
      }

      const from = String(flight.departure || '').trim().toUpperCase();
      const to = String(flight.arrival || '').trim().toUpperCase();
      if (from && to && from !== to) {
        const key = [from, to].sort().join('↔');
        routes.set(key, (routes.get(key) || 0) + 1);
      }
    }

    const airportRanking = [...airports.values()].sort((first, second) =>
      second.departures + second.arrivals - first.departures - first.arrivals || first.code.localeCompare(second.code)
    );
    const airlineRanking = [...airlines].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0], 'zh-CN'));
    const routeRanking = [...routes].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]));
    const leaderCount = routeRanking[0]?.[1] || 0;
    const routeLeaders = routeRanking.filter(([, count]) => count === leaderCount);
    const withDistance = records.filter(flight => Number.isFinite(Number(flight.distance)) && Number(flight.distance) > 0);
    const estimatedCount = withDistance.filter(flight => flight.distanceBasis?.includes('大圆距离')).length;
    const distanceValues = withDistance.map(flight => Number(flight.distance));
    const longest = distanceValues.length ? Math.max(...distanceValues) : null;
    const shortest = distanceValues.length ? Math.min(...distanceValues) : null;

    const renderRanking = (items, type, start = 0) => items.map((item, index) => {
      const airport = type === 'airport' ? item : null;
      const name = airport ? airport.city || airport.code : item[0];
      const count = airport ? airport.departures + airport.arrivals : item[1];
      const detail = airport ? `${airport.code} · 起飞 ${airport.departures} / 抵达 ${airport.arrivals}` : '航班记录';
      return `<li><span class="flight-stat-rank">${String(start + index + 1).padStart(2, '0')}</span><span class="flight-stat-name"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></span><span class="flight-stat-count">${formatNumber(count)}<small>次</small></span></li>`;
    }).join('');

    const renderDistanceFlights = flights => flights.slice().sort((first, second) => first.date.localeCompare(second.date) || first.flightNo.localeCompare(second.flightNo)).map(flight =>
      `<li><span>${escapeHtml(flight.date.replace(/-/g, '.'))} · ${escapeHtml(flight.flightNo)}</span><strong>${escapeHtml(flight.departureCity || flight.departure)} <small>${escapeHtml(flight.departure)}</small><span aria-hidden="true"> → </span>${escapeHtml(flight.arrivalCity || flight.arrival)} <small>${escapeHtml(flight.arrival)}</small></strong></li>`
    ).join('');

    const routeCards = routeLeaders.map(([key, count]) => {
      const [from, to] = key.split('↔');
      const firstCity = airports.get(from)?.city || from;
      const secondCity = airports.get(to)?.city || to;
      return `<div><strong>${escapeHtml(from)} <span aria-hidden="true">↔</span> ${escapeHtml(to)}</strong><span>${escapeHtml(firstCity)} ↔ ${escapeHtml(secondCity)} · ${formatNumber(count)} 趟</span></div>`;
    }).join('');

    return `<section class="flight-stats" id="flight-stats" aria-labelledby="flight-stats-title">
      <div class="flight-stats-head"><div><span class="section-kicker">Flight notes / 记录里的数字</span><h3 id="flight-stats-title">一段段航程，<br>连成了自己的航线图。</h3></div><p>机场按代码分别计数；同一趟航班的起飞和抵达，各为对应机场记一次。航司按每趟航班记录统计。</p></div>
      ${renderFlightMap(records)}
      <div class="flight-stats-totals" aria-label="机场与航司总数"><div><strong>${formatNumber(airports.size)}</strong><span>座机场</span></div><div><strong>${formatNumber(airlines.size)}</strong><span>家航司</span></div><div class="flight-stats-route"><small>往返最多的机场组合</small>${routeCards}</div></div>
      <div class="flight-stats-rankings">
        <section class="flight-stat-panel" aria-labelledby="flight-airports-title"><div class="flight-stat-panel-head"><span>01 / Airports</span><h4 id="flight-airports-title">途经的机场</h4><p>每次起飞与抵达，分别记入对应机场。</p></div><ol class="flight-stat-list">${renderRanking(airportRanking.slice(0, 5), 'airport')}</ol>${airportRanking.length > 5 ? `<details class="flight-stat-more"><summary>查看其余 ${airportRanking.length - 5} 座机场 <span aria-hidden="true">＋</span></summary><ol class="flight-stat-list" start="6">${renderRanking(airportRanking.slice(5), 'airport', 5)}</ol></details>` : ''}</section>
        <section class="flight-stat-panel" aria-labelledby="flight-airlines-title"><div class="flight-stat-panel-head"><span>02 / Airlines</span><h4 id="flight-airlines-title">同行的航司</h4><p>按记录中的航司名称统计每趟航班。</p></div><ol class="flight-stat-list">${renderRanking(airlineRanking.slice(0, 5), 'airline')}</ol>${airlineRanking.length > 5 ? `<details class="flight-stat-more"><summary>查看其余 ${airlineRanking.length - 5} 家航司 <span aria-hidden="true">＋</span></summary><ol class="flight-stat-list" start="6">${renderRanking(airlineRanking.slice(5), 'airline', 5)}</ol></details>` : ''}</section>
      </div>
      ${withDistance.length ? `<div class="flight-distance-head"><span>03 / Distance records</span><h4>记下来的，最远与最近。</h4></div><div class="flight-distance-grid"><section class="flight-distance-card" aria-labelledby="flight-longest-title"><span id="flight-longest-title">最远航程</span><p><strong>${formatNumber(longest)}</strong> km</p><ol>${renderDistanceFlights(withDistance.filter(flight => Number(flight.distance) === longest))}</ol></section><section class="flight-distance-card" aria-labelledby="flight-shortest-title"><span id="flight-shortest-title">最近航程</span><p><strong>${formatNumber(shortest)}</strong> km</p><ol>${renderDistanceFlights(withDistance.filter(flight => Number(flight.distance) === shortest))}</ol></section></div><p class="flight-stats-note">仅比较 ${withDistance.length} 趟已记里程的航班；${records.length > withDistance.length ? `另 ${records.length - withDistance.length} 趟未记录里程，未参与比较。` : '全部航班均已记录里程。'}${estimatedCount ? `其中 ${estimatedCount} 趟依据机场基准点估算，已在记录中标“约”。` : ''}里程不代表实际飞行轨迹长度。</p>` : '<p class="flight-stats-note">目前没有已记录里程的航班，暂无法比较最远与最近航程。</p>'}
    </section>`;
  }

  function renderFlights() {
    const records = flightArchive.flights || [];
    const years = (flightArchive.years || []).map(year => {
      const yearRecords = records.filter(flight => flight.date.startsWith(year));
      const items = yearRecords.map(flight => {
        const needsReview = flight.status !== '已使用';
        const search = [flight.date,flight.flightNo,flight.airline,flight.airlineEn,flight.departure,flight.arrival,flight.departureCity,flight.arrivalCity,flight.departureTerminal,flight.arrivalTerminal].filter(Boolean).join(' ').toLowerCase();
        const chapter = chapterById.get(flight.chapter);
        return `<article class="flight-row" data-flight-row data-search="${escapeHtml(search)}">
          <div class="flight-date"><strong>${escapeHtml(flight.date.slice(5).replace('-', '.'))}</strong><span>${year}</span></div>
          <div class="flight-route"><div><strong>${escapeHtml(flight.departure || '—')}</strong><span>${escapeHtml(flight.departureCity || '')}${flight.departureTerminal ? ' · '+escapeHtml(flight.departureTerminal) : ''}</span></div><span class="flight-route-line" aria-hidden="true">→</span><div><strong>${escapeHtml(flight.arrival || '—')}</strong><span>${escapeHtml(flight.arrivalCity || '')}${flight.arrivalTerminal ? ' · '+escapeHtml(flight.arrivalTerminal) : ''}</span></div></div>
          <div class="flight-info"><strong>${escapeHtml(flight.flightNo || '—')}</strong><span>${escapeHtml(flight.airline || '')}${flight.aircraft ? ' · '+escapeHtml(flight.aircraft) : ''}</span><small>${escapeHtml(flight.depTime || '—')}–${escapeHtml(flight.arrTime || '—')}${flight.distance ? ' · '+(flight.distanceBasis?.includes('大圆距离') ? '约 ' : '')+Number(flight.distance).toLocaleString()+' km' : ''}</small></div>
          <div class="flight-last">${needsReview ? '<span class="flight-status is-unresolved">待核对</span>' : ''}${chapter ? `<a href="#${chapter.id}">${escapeHtml(chapter.name)}影像 ↗</a>` : ''}</div>
        </article>`;
      }).join('');
      return `<details class="flight-year-group" data-flight-year="${year}" ${Number(year) >= 2025 ? 'open' : ''}><summary><span>${year}</span><small>${yearRecords.length} 条记录</small><span class="flight-year-arrow" aria-hidden="true">＋</span></summary><div class="flight-year-rows">${items}</div></details>`;
    }).join('');
    return `<section class="flight-archive" id="flights" aria-labelledby="flights-title"><div class="flight-inner">
      <figure class="flight-feature"><img src="media/flight-hero.webp" alt="从飞机舷窗望见清晨天空下的机翼剪影" loading="lazy" decoding="async"><div class="flight-head"><span class="section-kicker">Flight archive</span><h2 id="flights-title">飞行，也是一种<br>沿途。</h2><p>每一次起飞，都把两座城市连在一起。点开一段航程，还能回到那次旅行的影像。</p></div><figcaption><span>Above the clouds</span><span>飞往大阪的清晨</span></figcaption></figure>
      <div class="flight-summary"><div><strong>${records.length}</strong><span>航班记录</span></div></div>
      <div class="flight-filter"><label for="flight-search">查找航班</label><input id="flight-search" type="search" placeholder="城市、机场、航司或航班号" autocomplete="off"><span id="flight-results">共 ${records.length} 条</span></div>
      <div class="flight-years">${years}</div><p class="flight-empty" id="flight-empty" hidden>没有找到匹配的航班。</p>
      ${renderFlightStats(records)}
      <nav class="flight-footer"><a href="#map">返回旅程地图 ↑</a><a href="#index">查看影像索引 ↗</a></nav>
    </div></section>`;
  }

  function renderFooter() {
    return `<footer class="site-footer"><span>DON · 沿途 · 旅行影像手记</span><span>照片来自个人旅途 · 地图轮廓：<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a> · 航班来自个人记录</span></footer>`;
  }

  const chaptersByYear = trip.years.map(year => renderYearDivider(year) + trip.chapters.filter(chapter => chapter.year === year).map(chapter => renderChapter(chapter, trip.chapters.indexOf(chapter))).join('')).join('');
  app.innerHTML = renderCover() + renderOpeningNote() + renderMap()
    + chaptersByYear + renderEnding() + renderFlights() + renderFooter();

  const directory = trip.years.map(year => `<div class="directory-year"><span>${year}</span><div>${trip.chapters.filter(chapter => chapter.year === year).map(chapter => `<a href="#${chapter.id}" data-directory-chapter="${chapter.id}"><span>${chapter.number}</span><strong>${escapeHtml(chapter.name)}</strong><small>${escapeHtml(chapter.country)}</small></a>`).join('')}</div></div>`).join('');
  document.getElementById('journey-menu-panel').innerHTML = directory;
  document.getElementById('mobile-journey-menu').innerHTML = directory;

  const flightSearch = document.getElementById('flight-search');
  flightSearch.addEventListener('input', () => {
    const query = flightSearch.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('[data-flight-year]').forEach(group => {
      let groupCount = 0;
      group.querySelectorAll('[data-flight-row]').forEach(row => {
        const match = row.dataset.search.includes(query);
        row.hidden = !match;
        if (match) { visible++;groupCount++; }
      });
      group.hidden = groupCount === 0;
      if (query && groupCount) group.open = true;
    });
    document.getElementById('flight-results').textContent = `找到 ${visible} 条`;
    document.getElementById('flight-empty').hidden = visible > 0;
  });

  const flightAtlas = document.querySelector('.flight-atlas');
  if (flightAtlas) {
    const map = flightAtlas.querySelector('.flight-atlas-svg');
    const routes = [...map.querySelectorAll('[data-flight-map-route]')];
    const airports = [...map.querySelectorAll('[data-flight-map-airport]')];
    const inspector = flightAtlas.querySelector('#flight-atlas-inspector');
    const reset = flightAtlas.querySelector('#flight-map-reset');
    let pinned = null;

    function showFlightMapDetail(target) {
      const current = target || pinned;
      const selectedCode = current?.dataset.code || '';
      const from = current?.dataset.from || '';
      const to = current?.dataset.to || '';
      for (const route of routes) {
        const connected = selectedCode && (route.dataset.from === selectedCode || route.dataset.to === selectedCode);
        const active = current && (route === current || connected);
        route.classList.toggle('is-active', Boolean(active));
        route.classList.toggle('is-dimmed', Boolean(current && !active));
        route.setAttribute('aria-pressed', String(route === pinned));
      }
      for (const airport of airports) {
        const active = current && (airport === current || airport.dataset.code === from || airport.dataset.code === to);
        airport.classList.toggle('is-active', Boolean(active));
        airport.classList.toggle('is-dimmed', Boolean(current && !active));
        airport.setAttribute('aria-pressed', String(airport === pinned));
      }
      const heading = inspector.querySelector('strong');
      const detail = inspector.querySelector('span');
      heading.textContent = current ? (selectedCode || `${from} — ${to}`) : '从一座机场，到另一座机场。';
      detail.textContent = current ? current.dataset.label : '点选地图上的航线或机场，查看这段记录。';
      reset.hidden = !pinned;
    }

    function mapTarget(target) {
      return target?.closest?.('[data-flight-map-route], [data-flight-map-airport]') || null;
    }
    map.addEventListener('pointerover', event => {
      const target = mapTarget(event.target);
      if (target && !target.hasAttribute('hidden')) showFlightMapDetail(target);
    });
    map.addEventListener('pointerleave', () => showFlightMapDetail(null));
    map.addEventListener('focusin', event => {
      const target = mapTarget(event.target);
      if (target && !target.hasAttribute('hidden')) showFlightMapDetail(target);
    });
    map.addEventListener('focusout', event => {
      if (!map.contains(event.relatedTarget)) showFlightMapDetail(null);
    });
    map.addEventListener('click', event => {
      const target = mapTarget(event.target);
      if (!target || target.hasAttribute('hidden')) return;
      pinned = pinned === target ? null : target;
      showFlightMapDetail(target === pinned ? target : null);
    });
    map.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        pinned = null;
        showFlightMapDetail(null);
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = mapTarget(event.target);
      if (!target || target.hasAttribute('hidden')) return;
      event.preventDefault();
      pinned = pinned === target ? null : target;
      showFlightMapDetail(target === pinned ? target : null);
    });
    reset.addEventListener('click', () => {
      pinned = null;
      showFlightMapDetail(null);
    });
    flightAtlas.querySelectorAll('[data-flight-map-filter]').forEach(button => button.addEventListener('click', () => {
      const frequent = button.dataset.flightMapFilter === 'frequent';
      flightAtlas.querySelectorAll('[data-flight-map-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      for (const route of routes) {
        if (frequent && Number(route.dataset.count) < 3) route.setAttribute('hidden', '');
        else route.removeAttribute('hidden');
      }
      pinned = null;
      showFlightMapDetail(null);
    }));
    const scrollRegion = flightAtlas.querySelector('.flight-atlas-scroll');
    if (window.matchMedia('(max-width: 760px)').matches) scrollRegion.scrollLeft = 145;
  }

  const dialog = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxCount = document.getElementById('lightbox-count');

  function showLightboxPhoto(index) {
    currentLightboxIndex = (index + lightboxOrder.length) % lightboxOrder.length;
    const photo = photoOf(lightboxOrder[currentLightboxIndex]);
    const chapter = chapterById.get(photo.chapter);
    lightboxImage.src = photo.full;
    lightboxImage.alt = photo.caption;
    lightboxCaption.innerHTML = `<span>${escapeHtml(photo.caption)} · ${escapeHtml(chapter.country)}</span><span>${dateLabel(photo.date)}</span>`;
    lightboxCount.textContent = `${String(currentLightboxIndex + 1).padStart(2, '0')} / ${lightboxOrder.length}`;
  }

  app.addEventListener('click', event => {
    const photoButton = event.target.closest('[data-photo-id]');
    if (photoButton) {
      const index = lightboxOrder.indexOf(photoButton.dataset.photoId);
      if (index >= 0) {
        showLightboxPhoto(index);
        if (!dialog.open) dialog.showModal();
      }
    }
  });
  document.getElementById('lightbox-close').addEventListener('click', () => dialog.close());
  document.getElementById('lightbox-prev').addEventListener('click', () => showLightboxPhoto(currentLightboxIndex - 1));
  document.getElementById('lightbox-next').addEventListener('click', () => showLightboxPhoto(currentLightboxIndex + 1));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.addEventListener('keydown', event => {
    if (!dialog.open) return;
    if (event.key === 'ArrowLeft') showLightboxPhoto(currentLightboxIndex - 1);
    if (event.key === 'ArrowRight') showLightboxPhoto(currentLightboxIndex + 1);
  });

  document.querySelectorAll('.mobile-nav a, .journey-menu a').forEach(link => link.addEventListener('click', () => {
    document.querySelector('.mobile-nav').open = false;
    document.querySelector('.journey-menu').open = false;
  }));
  document.addEventListener('click', event => {
    const menu = document.querySelector('.journey-menu');
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const hash = link.getAttribute('href');
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    history.pushState(null, '', hash);
    const distance = Math.abs(target.getBoundingClientRect().top);
    target.scrollIntoView({ behavior: distance > window.innerHeight * 2 ? 'instant' : 'smooth', block: 'start' });
    scheduleReadingUpdate();
  });

  const header = document.getElementById('site-header');
  const coverObserver = new IntersectionObserver(entries => {
    header.classList.toggle('is-scrolled', !entries[0].isIntersecting);
  }, { threshold: 0.08 });
  coverObserver.observe(document.getElementById('cover'));

  const navLinks = [...document.querySelectorAll('[data-nav]')];
  const readingSections = ['cover', 'map', ...trip.years.flatMap(year => [`year-${year}`,...trip.chapters.filter(chapter => chapter.year === year).map(chapter => chapter.id)]), 'index', 'flights']
    .map(id => document.getElementById(id));
  const mapCountryLinks = [...document.querySelectorAll('[data-map-country]')];
  const mapCityLinks = [...document.querySelectorAll('[data-map-city]')];
  let readingUpdatePending = false;
  function updateReadingLocation() {
    readingUpdatePending = false;
    const readingLine = window.innerHeight * .35;
    let activeId = '';
    for (const section of readingSections) {
      if (section.getBoundingClientRect().top <= readingLine) activeId = section.id;
    }
    const chapter = chapterById.get(activeId);
    const navId = chapter ? `year-${chapter.year}` : activeId;
    navLinks.forEach(link => link.classList.toggle('is-active', link.dataset.nav === navId));
    mapCountryLinks.forEach(link => link.classList.toggle('is-active', link.dataset.mapCountry === activeId));
    document.querySelectorAll('[data-directory-chapter]').forEach(link => link.classList.toggle('is-active', link.dataset.directoryChapter === activeId));
    let activeCity = '';
    if (chapter) {
      const cityMarkers = trip.map.markers.filter(marker => marker.country === chapter.id);
      activeCity = cityMarkers[0]?.id || '';
      for (const marker of cityMarkers) {
        if (document.getElementById(marker.anchor).getBoundingClientRect().top <= readingLine) activeCity = marker.id;
      }
    }
    mapCityLinks.forEach(link => link.classList.toggle('is-active', link.dataset.mapCity === activeCity));
  }
  function scheduleReadingUpdate() {
    if (readingUpdatePending) return;
    readingUpdatePending = true;
    requestAnimationFrame(updateReadingLocation);
  }
  window.addEventListener('scroll', scheduleReadingUpdate, { passive: true });
  window.addEventListener('resize', scheduleReadingUpdate);
  scheduleReadingUpdate();
  if (location.hash) {
    const initialTarget = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (initialTarget) requestAnimationFrame(() => {
      initialTarget.scrollIntoView({ behavior: 'instant', block: 'start' });
      scheduleReadingUpdate();
    });
  }
})();

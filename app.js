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
      <p>在清迈看鸽群飞起，等山边日落；在香港等城堡亮灯，听电车驶过街口。去名古屋遇见早开的樱花，去犬山看城与河；沿着釜山的海岸坐小火车，又在首尔的宫门前遇见春天。在阳朔顺水而行，在布罗莫等一场日出。海风吹过济州、甲米和科莫多，脚步也落进河内与大阪的街巷。后来抬头看富士山，在大连沿海走一段路，才发现记住一场旅行的，常常是那些不经意的片刻。</p>
    </section>`;
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
    const markers = trip.map.markers.map(marker => {
      return `<a class="map-marker map-marker-${marker.year}" data-map-city="${escapeHtml(marker.id)}" href="#${escapeHtml(marker.anchor)}" aria-label="跳转到${escapeHtml(marker.name)}照片">
        <circle class="map-marker-hit" cx="${marker.x}" cy="${marker.y}" r="24"/>
        <circle class="map-marker-halo" cx="${marker.x}" cy="${marker.y}" r="10"/>
        <circle class="map-marker-core" cx="${marker.x}" cy="${marker.y}" r="3"/>
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
        <div class="atlas-head"><span class="section-kicker">Journey map</span><h2 id="map-title">把走过的路，<br>连成一张地图。</h2><p>每个地点都落在真实的经纬度上。点击标记或城市名，回到那一段旅程的影像。</p></div>
        <div class="atlas-body">
          <div class="atlas-map">
            <svg viewBox="${trip.map.viewBox}" role="img" aria-label="旅行影像中的城市位置地图">
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
          <div class="flight-info"><strong>${escapeHtml(flight.flightNo || '—')}</strong><span>${escapeHtml(flight.airline || '')}${flight.aircraft ? ' · '+escapeHtml(flight.aircraft) : ''}</span><small>${escapeHtml(flight.depTime || '—')}–${escapeHtml(flight.arrTime || '—')}${flight.distance ? ' · '+Number(flight.distance).toLocaleString()+' km' : ''}</small></div>
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

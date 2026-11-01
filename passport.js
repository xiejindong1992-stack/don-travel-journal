/* Travel passport: only journeys already present in the journal are counted.
   Regions and destination aliases are editorial metadata, not inferred from flights. */
(function () {
  'use strict';
  const regions = {
    CN: ['中国内地', 'Mainland China'], HK: ['中国香港', 'Hong Kong'],
    MO: ['中国澳门', 'Macao'], TW: ['中国台湾', 'Taiwan'],
    JP: ['日本', 'Japan'], KR: ['韩国', 'South Korea'], TH: ['泰国', 'Thailand'],
    MY: ['马来西亚', 'Malaysia'], LA: ['老挝', 'Laos'], VN: ['越南', 'Vietnam'], ID: ['印度尼西亚', 'Indonesia']
  };
  const provinces = [
    ['BJ','北京','京'],['TJ','天津','津'],['HE','河北','冀'],['SX','山西','晋'],['NM','内蒙古','蒙'],
    ['LN','辽宁','辽'],['JL','吉林','吉'],['HL','黑龙江','黑'],['SH','上海','沪'],['JS','江苏','苏'],
    ['ZJ','浙江','浙'],['AH','安徽','皖'],['FJ','福建','闽'],['JX','江西','赣'],['SD','山东','鲁'],
    ['HA','河南','豫'],['HB','湖北','鄂'],['HN','湖南','湘'],['GD','广东','粤'],['GX','广西','桂'],
    ['HI','海南','琼'],['CQ','重庆','渝'],['SC','四川','川'],['GZ','贵州','黔'],['YN','云南','滇'],
    ['XZ','西藏','藏'],['SN','陕西','陕'],['GS','甘肃','甘'],['QH','青海','青'],['NX','宁夏','宁'],
    ['XJ','新疆','新'],['TW','台湾','台'],['HK','香港','港'],['MO','澳门','澳']
  ];
  const provinceByChapter = {
    'urumqi-2017':'XJ','beijing-2019':'BJ','yading-2020':'SC','nanjing-2020':'JS',
    'suzhou-2020':'JS','chengdu-2020':'SC','shanghai-2020':'SH','mangshi-2020':'YN',
    'tengchong-2020':'YN','hangzhou-2020':'ZJ','kunming-2020':'YN','changbai-yanji-2020':'JL',
    'hangzhou-2021':'ZJ','chaozhou-2021':'GD','shantou-nanao-2022':'GD','quanzhou-2023':'FJ',
    'xian-2024':'SN','chenzhou-2024':'HN','yangshuo-2025':'GX','china':'LN'
  };
  // Merge neighbourhoods / attractions under their destination. Keep the original
  // names as places inside it, and retain the exact journal anchors for navigation.
  const aliases = {
    '瑞穗':'花莲','池上':'台东','恒春':'屏东','垦丁':'屏东','高雄 · 美丽岛':'高雄',
    '驳二':'高雄','西子湾':'高雄','麦理浩径':'香港','香港迪士尼':'香港',
    '维多利亚港':'香港','中环':'香港','氹仔':'澳门','澳门半岛':'澳门',
    '凤凰山':'潮州','泉州老城':'泉州','户隐':'长野','巴厘岛南岸':'巴厘岛',
    '富士山周边':'河口湖','南澳岛':'汕头'
  };
  const excludedMarkers = new Set(['bangkok-samui-2019','hsinchu-transit-2019','taoyuan-return-2019','changchun-transit-2020']);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const regionOf = c => /香港/.test(c.country) || /hong.?kong|maclehose/.test(c.id) ? 'HK'
    : /澳门/.test(c.name) ? 'MO' : c.code;
  const firstDate = c => c.dateStart || `${c.year}-01-01`;
  const lastDate = c => c.dateEnd || firstDate(c);
  const nameOf = m => aliases[m.name] || m.name.replace(/（[^）]*）/g, '').trim();
  const unique = values => [...new Set(values)];
  const isHash = hash => /^#passport(?:\/|\?|$)/.test(hash);
  function parse(hash) {
    const [path, query=''] = hash.slice(1).split('?');
    const [, rawMode, rawSelection] = path.split('/');
    const mode = rawMode === 'china' ? 'china' : 'world';
    const valid = mode === 'china' ? provinces.some(p => p[0] === rawSelection) : Boolean(regions[rawSelection]);
    const year = new URLSearchParams(query).get('year');
    return {mode, selected: valid ? rawSelection : '', year: /^\d{4}$/.test(year || '') ? year : ''};
  }
  function href(mode, selected='', year='') {
    return `#passport/${mode}${selected ? '/' + selected : ''}${year ? '?year=' + year : ''}`;
  }
  function records(trip, year='') {
    return trip.chapters.filter(c => !year || (firstDate(c) <= `${year}-12-31` && lastDate(c) >= `${year}-01-01`))
      .map(chapter => {
        const region = regionOf(chapter);
        const province = ['HK','MO','TW'].includes(region) ? region : provinceByChapter[chapter.id];
        const markers = trip.map.markers.filter(m => m.country === chapter.id && !excludedMarkers.has(m.id));
        const places = markers.map(m => ({name:nameOf(m), original:m.name, anchor:m.anchor, marker:m}));
        // Uji has its own photographed scene but no separate map marker.
        if (chapter.id === 'kyoto-2024') places.push({name:'宇治', original:'宇治', anchor:'kyoto-2024-scene-5'});
        return {chapter, region, province, places};
      }).sort((a,b) => firstDate(b.chapter).localeCompare(firstDate(a.chapter)));
  }
  function destinations(rows) {
    const result = new Map();
    for (const row of rows) for (const p of row.places) {
      const key = row.region + ':' + p.name;
      if (!result.has(key)) result.set(key, {...p, region:row.region, places:[], chapters:new Set()});
      const dest = result.get(key);
      if (!dest.places.some(v => v.original === p.original)) dest.places.push(p);
      dest.chapters.add(row.chapter.id);
    }
    return [...result.values()];
  }
  function mapMarkup(trip, rows) {
    const markers = rows.flatMap(row => row.places.filter(p => p.marker).map(p => p.marker));
    const points = new Map(markers.map(m => [`${m.x},${m.y}`,m]));
    return `<div class="passport-map"><svg viewBox="${esc(trip.map.viewBox)}" role="img" aria-label="已收录目的地的位置分布">
      ${Object.values(trip.map.paths).map(path => `<path d="${path}"/>`).join('')}
      ${[...points.values()].map(m => `<circle cx="${m.x}" cy="${m.y}" r="4"><title>${esc(m.name)}</title></circle>`).join('')}
      </svg><span>沿着照片留下的足迹 · 底图 Natural Earth</span></div>`;
  }
  function stamp(code, label, english, rows, state, index, compact=false) {
    const active = rows.length > 0;
    const earliest = active ? rows.map(r => firstDate(r.chapter)).sort()[0].slice(0,4) : '';
    const inside = `<span class="passport-stamp-top">${esc(english)}</span><strong>${esc(label)}</strong><span class="passport-stamp-date">${active ? earliest + ' · 已收录' : '待收录'}</span>`;
    const attrs = `class="passport-stamp${compact ? ' is-province' : ''}${!active ? ' is-empty' : ''}${state.selected === code ? ' is-selected' : ''}" style="--stamp-turn:${[ -3,2,-1,3,0][index%5]}deg;--stamp-ink:${['#526d63','#a45c48','#567285'][index%3]}"`;
    return active ? `<a ${attrs} href="${href(state.mode,code,state.year)}" ${state.selected === code ? 'aria-current="true"' : ''} aria-label="查看${esc(label)}，${rows.length}篇旅程">${inside}</a>`
      : `<div ${attrs} aria-label="${esc(label)}，所选时间内暂无记录">${inside}</div>`;
  }
  function detail(rows, state, photos, themes) {
    const chosen = state.selected ? rows.filter(r => (state.mode === 'china' ? r.province : r.region) === state.selected) : [];
    if (!state.selected) return `<div class="passport-pick"><span>Pick a stamp</span><p>点开一枚印章，翻回那里的旅程。</p></div>`;
    const title = state.mode === 'china' ? provinces.find(p => p[0] === state.selected)[1] : regions[state.selected][0];
    if (!chosen.length) return `<section class="passport-detail" id="passport-detail"><h2 tabindex="-1">${esc(title)}</h2><p>这个年份还没有收录这里的旅程。</p><a href="${href(state.mode,state.selected)}">查看全部年份 →</a></section>`;
    const dates = chosen.map(r => firstDate(r.chapter)).sort();
    const dests = destinations(chosen);
    const ids = new Set(chosen.map(r => r.chapter.id));
    const related = themes.map(theme => ({theme,items:theme.items.filter(item => {
      const p = photos.get(item.photoId); return ids.has(p?.chapter || p?.relatedChapter);
    })})).filter(t => t.items.length);
    const photo = photos.get(chosen[0].chapter.heroId);
    return `<section class="passport-detail" id="passport-detail" aria-labelledby="passport-detail-title">
      <div class="passport-detail-heading"><div><p class="passport-hand">A place to remember</p><h2 id="passport-detail-title" tabindex="-1">${esc(title)}</h2><p>${dests.length} 个目的地 · ${chosen.length} 篇旅程</p></div><dl><div><dt>最早收录旅程</dt><dd>${dates[0].replaceAll('-','.')}</dd></div><div><dt>最近收录旅程</dt><dd>${dates.at(-1).replaceAll('-','.')}</dd></div></dl></div>
      <div class="passport-place-layout"><div class="passport-destinations"><h3>去过的地方</h3><div class="passport-city-stamps">${dests.map(d => `<a href="#${esc(d.anchor)}"><strong>${esc(d.name)}</strong><span>${d.chapters.size} 篇记录</span></a>`).join('')}</div>
      ${dests.some(d => d.places.some(p => p.original !== d.name)) ? `<details class="passport-places-note"><summary>也记得这些角落</summary>${dests.filter(d => d.places.some(p => p.original !== d.name)).map(d => `<p><b>${esc(d.name)}</b> ${d.places.filter(p => p.original !== d.name).map(p => `<a href="#${esc(p.anchor)}">${esc(p.original)}</a>`).join(' · ')}</p>`).join('')}</details>` : ''}</div>
      ${photo ? `<figure class="passport-photo"><img src="${esc(photo.src)}" alt="${esc(photo.caption)}" loading="lazy"><figcaption>${esc(chosen[0].chapter.name)} · ${chosen[0].chapter.year}</figcaption></figure>` : ''}</div>
      <h3 class="passport-journey-heading">翻回那趟旅行</h3><div class="passport-journeys">${chosen.map(({chapter:c}) => {
        const p=photos.get(c.heroId); return `<a href="#${esc(c.id)}">${p ? `<img src="${esc(p.src)}" alt="" loading="lazy">` : ''}<span><small>${esc(firstDate(c).replaceAll('-','.'))}</small><strong>${esc(c.name)}</strong><em>${esc(c.place)}</em></span><i aria-hidden="true">↗</i></a>`;
      }).join('')}</div>
      ${related.length ? `<aside class="passport-collections"><h3>从这里带回的拾集</h3><div>${related.map(({theme,items}) => `<a href="#collection/${esc(theme.id)}">${esc(theme.title)} <span>${items.length} 则相关记录 ↗</span></a>`).join('')}</div></aside>` : ''}
    </section>`;
  }
  function render(trip, photos, themes, hash) {
    const state = parse(hash);
    const all = records(trip);
    const years = unique(all.flatMap(r => {const list=[]; for(let y=+firstDate(r.chapter).slice(0,4); y<=+lastDate(r.chapter).slice(0,4); y++)list.push(String(y)); return list;})).sort().reverse();
    if (!years.includes(state.year)) state.year = '';
    const filtered = records(trip,state.year);
    const rows = state.mode === 'china' ? filtered.filter(r => ['CN','HK','MO','TW'].includes(r.region)) : filtered;
    const groups = unique(rows.map(r => state.mode === 'china' ? r.province : r.region).filter(Boolean));
    const dests = destinations(rows);
    const dates = rows.map(r => firstDate(r.chapter)).sort();
    const stamps = state.mode === 'china'
      ? provinces.map(([code,name,short],i) => stamp(code,name,short,rows.filter(r => r.province === code),state,i,true)).join('')
      : Object.entries(regions).filter(([code]) => all.some(r => r.region === code)).map(([code,[name,en]],i) => stamp(code,name,en,rows.filter(r => r.region === code),state,i)).join('');
    return `<section class="passport-page" aria-labelledby="passport-title">
      <header class="passport-heading"><div><p class="passport-hand">Somewhere I've been.</p><h1 id="passport-title" tabindex="-1">旅行护照</h1></div><p>每一次出发，留下一枚印记。<br>把走过的地方，慢慢收进这一本。</p></header>
      <div class="passport-controls"><nav aria-label="足迹范围"><a href="${href('world','',state.year)}" ${state.mode === 'world' ? 'aria-current="page"' : ''}>世界足迹</a><a href="${href('china','',state.year)}" ${state.mode === 'china' ? 'aria-current="page"' : ''}>中国足迹</a></nav><label>翻阅年份 <select id="passport-year" data-passport-mode="${state.mode}" data-passport-selection="${esc(state.selected)}"><option value="">全部年份</option>${years.map(y => `<option value="${y}" ${state.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div>
      <div class="passport-book"><section class="passport-cover" aria-label="护照封面"><div class="passport-cover-top"><span>DON · 沿途</span><span>私人旅行手记</span></div><p class="passport-cover-script">Travel<br>Passport</p><div class="passport-cover-seal"><span>沿途</span><small>MEMORIES / ${dates.length ? dates[0].slice(0,4) : '—'}</small></div><p class="passport-cover-bottom">山川、海岸与城市之间<br>总有下一次出发。</p></section>
      <section class="passport-identity" aria-label="已记录足迹概览"><div class="passport-identity-top"><span>持有人 <strong>DON</strong></span><span>${esc(state.year || (dates.length ? dates[0].slice(0,4)+' — '+dates.at(-1).slice(0,4) : '暂无记录'))}</span></div>${mapMarkup(trip,rows)}
      <div class="passport-totals"><div><strong>${groups.length}</strong><span>${state.mode === 'china' ? '省级行政区' : '国家与地区'}</span></div><div><strong>${dests.length}</strong><span>到访目的地</span></div><div><strong>${rows.length}</strong><span>旅程篇章</span></div></div><p class="passport-edition">${state.year ? state.year+' 年的' : '目前已收录的'}足迹，未完待续。</p></section></div>
      <section class="passport-stamp-section" aria-labelledby="passport-stamps-title"><div class="passport-stamps-heading"><div><p class="passport-hand">Collected along the way</p><h2 id="passport-stamps-title">${state.mode === 'china' ? '一省一枚，慢慢盖满' : '那些去过的地方'}</h2></div><span>${groups.length} 枚已收录${state.mode === 'china' ? ' / 34' : ''}</span></div><div class="passport-stamps ${state.mode === 'china' ? 'province-stamps' : ''}">${stamps}</div></section>
      ${detail(rows,state,photos,themes)}
      <details class="passport-method"><summary>这些足迹怎么记？</summary><p>统计来自网站已收录的旅行影像，不代表全部旅行经历。重复目的地合并；机场转机、交通途中经过的地方不单独计入。</p><p>目的地包含城市、岛屿和山地旅行区域。景点归入所属目的地，例如户隐归入长野、驳二与西子湾归入高雄。国家与地区包括中国内地、香港、澳门、台湾的分区展示；中国足迹统一按省级行政区整理。</p><p>“旅程篇章”沿用网站的章节，一次连续旅行可能有多篇。日期显示所在旅程的起始日期，不代表该城市的精确首次到访日。跨年旅程会出现在涉及的两个年份；全部年份仅计算一次。</p><p>灰色印章表示所选时间内尚无收录，不代表从未去过。新增照片与行程后，已匹配目的地的记录会随之增加。</p></details>
      <p class="passport-ending">To be continued.</p>
    </section>`;
  }
  window.TravelPassport = {render, isHash, href, records, destinations, provinces, regions};
})();

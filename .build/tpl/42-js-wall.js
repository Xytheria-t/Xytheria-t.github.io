// 墙渲染唯一入口 wallHTML（根墙杂志版式 + 子墙）。hover 展开最近笔记预览已被用户否掉，勿加回；
// 轻交互 = hover 竖规延展 + 指针跟随光晕（--mx/--my，接线在 48-js-fx.js）。MOC 正文段落不放双链（bullet 才合法）；verify-spans 断言 .ventry 数 == links。
function wallHTML(n){
  const list = n.links.map(function(s){return NOTES[s];}).filter(Boolean);
  const isRoot = n.id === ROOT_ID;
  /* 子 MOC 分面注册表 —— 按 slug 声明「分组 + 特性 chip」。
     命中走语义化分组（微区头 + chip 角标），未命中退回默认「子地图 / 笔记」二段切。 */
  const MOC_FACETS = {
    'java-锁': {
      groups: [
        { name:'入门', ids:['java-锁对比'] },
        { name:'内置同步', ids:['synchronized','jmm','volatile'] },
        { name:'显式锁', ids:['reentrantlock','reentrantreadwritelock','stampedlock'] },
        { name:'底层与原子', ids:['cas-与原子类','aqs','locksupport'] },
        { name:'同步工具', ids:['semaphore','countdownlatch'] },
        { name:'故障排查', ids:['死锁'] },
      ],
      traits: {
        'java-锁对比':'总览·横评',
        'synchronized':'JVM 关键字 · 隐式重入',
        'jmm':'内存模型 · 可见性判据',
        'volatile':'内存可见性 · 无锁',
        'reentrantlock':'可重入 · 公平可选',
        'reentrantreadwritelock':'读写分离 · 可降级',
        'stampedlock':'乐观返回 · JDK 8+',
        'cas-与原子类':'无锁 · 原子操作',
        'aqs':'框架 · 同步器底座',
        'locksupport':'阻塞原语 · 许可机制',
        'semaphore':'共享模式 · 许可计数',
        'countdownlatch':'共享模式 · 一次性',
        '死锁':'四条件 · 定位与破环',
      },
    },
  };
  const facet = MOC_FACETS[n.id] || null;
  // flatten a MOC's tree to actual notes (mtime desc, top k)
  function flatten(t){
    if(!t || t.type !== 'moc') return [];
    const out = [], seen = new Set();
    (function walk(it){
      if(!it || seen.has(it.id)) return;
      seen.add(it.id);
      if(it.type !== 'moc'){ out.push(it); return; }
      (it.links||[]).forEach(function(s){ walk(NOTES[s]); });
    })(t);
    return out.sort(function(a,b){return new Date(b.mtime||0)-new Date(a.mtime||0);});
  }
  // roman chapter numerals Ⅰ-Ⅶ for 1-7
  const ROMAN = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ','Ⅺ','Ⅻ'];
  /* 分卷（首页根墙）：卷序 = GROUP 数组序；卷内位次 = cats 数组序（build.mjs 注入 group/groupRank）。
     卡片尺寸不再由分卷决定（旧 b4/b2 主卡规则随杂志化废弃），卷内每条 .ventry 版式统一走 CSS */
  function groupBands(items){
    const by = {}, order = [];
    items.forEach(function(t){
      const gi = t.group;
      if(!by[gi]){ by[gi] = []; order.push(gi); }
      by[gi].push(t);
    });
    order.sort(function(a,b){ return (a<0?1e9:a) - (b<0?1e9:b); }); // 未归入任何卷的排最后
    return order.map(function(gi){
      const bItems = by[gi].slice().sort(function(a,b){ return a.groupRank - b.groupRank; });
      const notes = bItems.map(function(t){ return t.type==='moc' ? flatten(t).length : 1; });
      return { gi:gi, items:bItems, notes:notes, isFallow:notes.map(function(c){ return c === 0; }),
               num: bItems[0].groupNum || '·', name: bItems[0].groupName || '其他' };
    });
  }
  // order 决定墙上阅读位次（罗马数字），未声明的退到 1e9；布局排序时 pinned(featured) 永远最前
  function orderOf(t){ return t.order > 0 ? t.order : 1e9; }
  function layoutRank(t){ return t.pinned ? -1e12 : orderOf(t); }
  const plain = list.slice().sort(function(a,b){return layoutRank(a)-layoutRank(b);});
  const bandOn = isRoot && plain.some(function(t){return t.group >= 0;});
  const bandList = bandOn ? groupBands(plain) : [];
  /* 首页根墙 = 杂志：纯审美封面 + 各卷目录带（版式 = GROUP.layout，4 种词汇表） */
  function entryHTML(t, color, opts){
    const subs = t.type==='moc' ? flatten(t) : [];
    const fallow = t.type==='moc' && subs.length===0;
    const count = t.type==='moc' ? subs.length : 1;
    let lastM = new Date(t.mtime||0).getTime();
    subs.forEach(function(x){ const mt = new Date(x.mtime||0).getTime(); if(mt>lastM) lastM = mt; });
    const rel = lastM ? relTime(lastM) : '';
    const c = typeof color === 'string' ? color : t.accent;
    const chip = opts && opts.chip ? opts.chip : ''; // 语义 chip：注册了 MOC_FACETS 的卡走 chip 路线，不再叠「1 篇/更新于」噪音
    const mast = (t.type!=='moc') ? mastHTML(t.id) : ''; // 熟悉程度徽标：仅原子笔记且评级过才渲染，顶替无信息量的「1 篇」
    return '<article class="ventry'+(fallow?' fallow':'')+'" data-target="'+t.id+'" style="--c:'+c+'">'
      + '<div class="v-top"><span class="v-tag">'+esc(t.catLabel)+'</span>'
      + (mast ? mast : (fallow ? '<span class="stamp">待垦</span>' : (chip ? '' : (count>1 ? '<span class="v-count"><b>'+count+'</b> 篇</span>' : '')))) // count>1：原子笔记自身就是单篇，「1 篇」无信息量，直接省掉
      + '</div>'
      + '<h3 class="v-name">'+esc(t.title)+'</h3>'
      + (chip ? '<div class="v-chip">'+esc(chip)+'</div>' : (rel ? '<div class="v-data">更新于 '+esc(rel)+'</div>' : ''))
      + '</article>';
  }
  if(bandOn){
    const now = new Date();
    const mosaic = bandList.map(function(b,bi){
      const c = b.items[0].accent;
      return '<button class="cm-tile" data-band="band-'+bi+'" data-name="'+attr(b.name)+'"'
        + ' style="--cc:'+c+'" title="'+attr(b.name)+'">'
        + '<span class="cm-num">'+esc(b.num)+'</span></button>';
    }).join('');
    const cover = '<header class="cover">'
      + '<div class="cover-main">'
      + '<p class="cover-issue"><span>Vinea · Knowledge Atlas · '+now.getFullYear()+' 年 '+(now.getMonth()+1)+' 月</span><span class="cover-issue-r">Private Press · No. '+String(now.getMonth()+1).padStart(2,'0')+'</span></p>'
      + '<h1 class="cover-title">'+esc(n.title)+'<span class="cover-dot">.</span></h1>'
      + (n.excerpt ? '<p class="cover-sub">'+esc(n.excerpt)+'</p>' : '')
      + '</div>'
      + (bandList.length ? '<nav class="cover-mosaic" aria-label="卷索引">'
          + '<span class="cover-mosaic-tag">Volumes · '+bandList.length+'</span>'
          + '<div class="cm-rail">'+mosaic+'</div>'
          + '<p class="cm-caption" id="cm-caption" style="--cnow:'+bandList[0].items[0].accent+'">'+esc(bandList[0].name)+'</p>'
          + '</nav>' : '')
      + '</header>';
    let body = '';
    bandList.forEach(function(b,bi){
      const layout = b.items[0].groupLayout || 'tiles';
      const bandLast = b.items.reduce(function(m,t){
        const mt = new Date(t.mtime||0).getTime(); return mt>m?mt:m; },0);
      body += '<section class="band band--'+esc(layout)+'" id="band-'+bi+'" style="--c:'+b.items[0].accent+'">'
        + '<header class="band-head">'
        + '<span class="band-num">'+esc(b.num)+'</span>'
        + '<h2 class="band-name">'+esc(b.name)+'</h2>'
        + '<div class="band-meta">'
        + '<span><b>'+b.items.length+'</b> 领域</span>'
        + '<span><b>'+b.notes.reduce(function(a,c){return a+c;},0)+'</b> 篇</span>'
        + (bandLast ? '<span>更新于 '+esc(relTime(bandLast))+'</span>' : '')
        + '</div></header>'
        + '<div class="vbody">'+b.items.map(entryHTML).join('')+'</div>'
        + '</section>';
    });
    return cover + '<div class="bands">'+body+'</div>';
  }
  // 子 MOC 墙（非根墙）：轻量扉页 + 统一 .ventry 网格，继承父卷色
  const pc = n.accent; // 父卷色（MOC 自身 category accent，与首页卷带呼应）
  const subLast = Math.max.apply(null, list.map(function(t){ return new Date(t.mtime||0).getTime(); }).concat([0]));
  const subLastStr = subLast ? relTime(subLast) : '';
  const vgrp = n.group>=0 ? '卷 '+esc(n.groupNum)+' · '+esc(n.groupName) : '章节 · 目录墙';
  const front = '<header class="subhead" style="--c:'+pc+'">'
    + '<span class="subhead-rule"></span>'
    + '<div class="subhead-inner">'
    + '<p class="eyebrow">'+vgrp+'</p>'
    + '<h1 class="subhead-title">'+esc(n.title)+'</h1>'
    + '</div>'
    + (list.length ? '<div class="subhead-meta">'
        + '<span><b>'+list.length+'</b> 项</span>'
        + (subLastStr ? '<span class="sep"></span><span>更新于 '+esc(subLastStr)+'</span>' : '')
        + '</div>' : '')
    + '</header>';
  function subGrid(items, getChip){
    return '<div class="vbody subwall-body">'+items.map(function(t){ return entryHTML(t, pc, getChip ? getChip(t) : null); }).join('')+'</div>';
  }
  function subSec(name, items, getChip){
    if(!items.length) return '';
    return '<section class="subwall"><header class="subwall-head">'
      + '<span class="subwall-bar"></span>'
      + '<h2 class="subwall-name">'+esc(name)+'</h2>'
      + '<span class="subwall-meta">'+items.length+' 项</span>'
      + '</header>'+subGrid(items, getChip)+'</section>';
  }
  // 注册了 MOC_FACETS 的子墙：按语义分组 + 特性 chip（替代默认「子地图 / 笔记」二段切）
  if(facet){
    const groups = facet.groups.map(function(g){
      const items = g.ids.map(function(id){ return list.find(function(t){ return t.id === id; }); }).filter(Boolean);
      return subSec(g.name, items, function(t){ return { chip: facet.traits[t.id] || '' }; });
    }).join('');
    return front + '<div class="subwalls" style="--c:'+pc+'">'+groups+'</div>';
  }
  const mocs = plain.filter(function(t){return t.type==='moc';});
  const notes = plain.filter(function(t){return t.type!=='moc';});
  if(!mocs.length || !notes.length){
    const all = plain;
    const label = mocs.length ? '子地图' : '笔记';
    return front + '<div class="subwalls" style="--c:'+pc+'">'+subSec(label, all)+'</div>';
  }
  return front + '<div class="subwalls" style="--c:'+pc+'">'
    + subSec('子地图', mocs) + subSec('笔记', notes) + '</div>';
}


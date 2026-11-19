/* Q3 · Bubble scatter: x = average non-fatal cases per year, y = bed days per case (severity),
   bubble area = total bed days (2016–2021). Toggle between road user and age group. */
(function () {
  const el = document.getElementById("q3-chart");
  const AGE_ORDER = ["0-7", "8-16", "17-25", "26-39", "40-64", "65-74", "75+"];
  const YEARS = 6; // 2016–2021
  let data = {}, mode = "ru";

  RC.q3 = async function init() {
    const [ru, age] = await Promise.all([RC.loadCSV("q3_beddays_by_roaduser.csv"), RC.loadCSV("q3_beddays_by_age.csv")]);
    const shape = (rows, key) => rows.map((r) => {
      const cases = +RC.pick(r, "Hospitalisations", "cases"), bed = +RC.pick(r, "Bed days", "bed_days");
      const ms = RC.pick(r, "male_share");
      return { name: String(RC.pick(r, key)), cases, bed, perYear: cases / YEARS, bdpc: bed / cases, male: ms === undefined || ms === null ? null : +ms };
    });
    data.ru = shape(ru, "Road user");
    data.age = shape(age, "Age group").sort((a, b) => AGE_ORDER.indexOf(a.name) - AGE_ORDER.indexOf(b.name));

    const btnRu = document.getElementById("q3-mode-ru"), btnAge = document.getElementById("q3-mode-age");
    const set = (m) => {
      mode = m;
      btnRu.setAttribute("aria-pressed", String(m === "ru"));
      btnAge.setAttribute("aria-pressed", String(m === "age"));
      draw(true); table();
    };
    btnRu.addEventListener("click", () => set("ru"));
    btnAge.addEventListener("click", () => set("age"));
    table();
    draw(false);
    RC.onResize(el, () => draw(false));
    RC.onThemeChange(() => draw(false));
  };

  function table() {
    RC.renderTable("q3-table", [
      { label: mode === "ru" ? "Road user" : "Age group", value: (d) => d.name },
      { label: "Cases 2016–21", num: true, value: (d) => RC.fmt(d.cases) },
      { label: "Cases per year", num: true, value: (d) => RC.fmt(Math.round(d.perYear)) },
      { label: "Bed days 2016–21", num: true, value: (d) => RC.fmt(d.bed) },
      { label: "Bed days per case", num: true, value: (d) => d.bdpc.toFixed(1) },
      { label: "Male %", num: true, value: (d) => (d.male === null ? "" : d.male.toFixed(1)) },
    ], [...data[mode]].sort((a, b) => b.bdpc - a.bdpc));
  }

  function draw(animate) {
    const rows = data[mode];
    const W = el.clientWidth, narrow = W < 620;
    const H = Math.max(320, Math.min(460, W * 0.56));
    const m = { top: 20, right: 20, bottom: 46, left: 48 };
    const all = data.ru.concat(data.age);
    const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.perYear) * 1.12]).nice().range([m.left, W - m.right]);
    const y = d3.scaleLinear().domain([0, Math.ceil(d3.max(all, (d) => d.bdpc) + 1)]).range([H - m.bottom, m.top]);
    const r = d3.scaleSqrt().domain([0, d3.max(all, (d) => d.bed)]).range([0, narrow ? 26 : 40]);
    const avg = d3.sum(rows, (d) => d.bed) / d3.sum(rows, (d) => d.cases);
    const dur = animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 650 : 0;
    const up = RC.css("--up");

    let svg = d3.select(el).select("svg");
    if (svg.empty() || !animate) {
      el.replaceChildren();
      svg = d3.select(el).append("svg");
      ["grid", "axis x", "axis y", "avg", "quad", "dots", "lbl"].forEach((c) => svg.append("g").attr("class", c));
    }
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img")
      .attr("aria-label", `Bubble chart of cases per year against bed days per case, by ${mode === "ru" ? "road user" : "age group"}`);

    svg.select(".grid").selectAll("line").data(y.ticks(6)).join("line")
      .attr("x1", m.left).attr("x2", W - m.right).attr("y1", y).attr("y2", y);
    svg.select(".axis.x").attr("transform", `translate(0,${H - m.bottom})`)
      .transition().duration(dur).call(d3.axisBottom(x).ticks(narrow ? 4 : 7).tickFormat(RC.fmt).tickSizeOuter(0));
    svg.select(".axis.y").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
    svg.selectAll(".axis text").attr("font-size", 11.5);
    svg.select(".axis.x").selectAll(".title").data([0]).join("text").attr("class", "title muted")
      .attr("x", W - m.right).attr("y", 38).attr("text-anchor", "end").attr("font-size", 12)
      .text("Average non-fatal cases per year, 2016–2021 →");
    svg.select(".axis.y").selectAll(".title").data([0]).join("text").attr("class", "title muted")
      .attr("x", 4).attr("y", m.top - 6).attr("text-anchor", "start").attr("font-size", 12)
      .text("↑ Bed days per case");

    // average stay line (its label is placed later, clear of the bubbles)
    const av = svg.select(".avg").selectAll("g").data([avg]).join((en) => {
      const g = en.append("g");
      g.append("line"); g.append("text");
      return g;
    });
    av.select("line").style("stroke", RC.css("--muted")).attr("stroke-dasharray", "4 4")
      .attr("x1", m.left).attr("x2", W - m.right).transition().duration(dur).attr("y1", y(avg)).attr("y2", y(avg));

    // quadrant hints
    svg.select(".quad").selectAll("text").data([
      ...(narrow ? [] : [{ t: "Fewer cases, longer stays", x: m.left + 10, y: m.top + 18, a: "start" }]),
      { t: "More cases, shorter stays", x: W - m.right - 6, y: H - m.bottom - 10, a: "end" },
    ]).join("text").attr("class", "muted").attr("font-size", 11.5).attr("font-style", "italic")
      .attr("x", (d) => d.x).attr("y", (d) => d.y).attr("text-anchor", (d) => d.a).text((d) => d.t);

    const key = (d) => mode + ":" + d.name;
    const dots = svg.select(".dots").selectAll("circle").data([...rows].sort((a, b) => b.bed - a.bed), key).join(
      (en) => en.append("circle").attr("cx", (d) => x(d.perYear)).attr("cy", (d) => y(d.bdpc)).attr("r", 0),
      (up_) => up_,
      (ex) => ex.transition().duration(dur).attr("r", 0).remove());
    dots.style("fill", up).style("fill-opacity", 0.22).style("stroke", up).attr("stroke-width", 1.5)
      .attr("role", "img")
      .attr("aria-label", (d) => `${d.name}: ${Math.round(d.perYear)} cases a year, ${d.bdpc.toFixed(1)} bed days per case`)
      .transition().duration(dur)
      .attr("cx", (d) => x(d.perYear)).attr("cy", (d) => y(d.bdpc)).attr("r", (d) => Math.max(3, r(d.bed)));
    RC.bindTip(dots, (d) =>
      `<strong>${mode === "age" ? "Age " : ""}${d.name}</strong>` +
      `<span class="n">${RC.fmt(Math.round(d.perYear))}</span> cases a year<br>` +
      `<span class="n">${d.bdpc.toFixed(1)}</span> bed days per case<br>` +
      `<span class="n">${RC.fmt(d.bed)}</span> bed days in total, 2016–21` +
      (d.male !== null ? `<br><span class="n">${d.male.toFixed(0)}%</span> male` : ""));

    /* ---------- collision-free labels ----------
       Every bubble, the quadrant hints and the average-line label are obstacles.
       Each label tries 8 spots around its bubble, then the same spots further out
       (with a thin leader line), and takes the spot with the least overlap. */
    const fs = narrow ? 10.5 : 12, pad = 3;
    const circles = rows.map((d) => ({ x: x(d.perYear), y: y(d.bdpc), r: Math.max(3, r(d.bed)) }));
    const bounds = { x0: m.left + 2, x1: W - m.right, y0: m.top, y1: H - m.bottom - 2 };
    const measure = svg.append("text").attr("font-size", fs).style("visibility", "hidden");
    const textW = (t, cls = "halo") => { measure.attr("class", cls).text(t); return measure.node().getComputedTextLength(); };
    const boxes = [];
    svg.select(".quad").selectAll("text").each(function () { const b = this.getBBox(); boxes.push({ x: b.x - pad, y: b.y - pad, w: b.width + 2 * pad, h: b.height + 2 * pad }); });

    const hitCircle = (bx, c) => {
      const cx = Math.max(bx.x, Math.min(c.x, bx.x + bx.w)), cy = Math.max(bx.y, Math.min(c.y, bx.y + bx.h));
      const dx = c.x - cx, dy = c.y - cy, rr = c.r + 2;
      return dx * dx + dy * dy < rr * rr ? Math.min(bx.w, bx.h) * (rr - Math.sqrt(dx * dx + dy * dy)) + 1 : 0;
    };
    const hitBox = (p, q) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
    const outside = (bx) => Math.max(0, bounds.x0 - bx.x) + Math.max(0, bx.x + bx.w - bounds.x1) + Math.max(0, bounds.y0 - bx.y) + Math.max(0, bx.y + bx.h - bounds.y1);
    const cost = (bx, skip) => {
      let c = outside(bx) * 1000;
      circles.forEach((ci, i) => { if (i !== skip) c += hitCircle(bx, ci) * 10; });
      boxes.forEach((o) => { c += hitBox(bx, o) * 10; });
      return c;
    };

    // 1. average-stay label: try both ends of the line, above then below
    const avText = `average stay ${avg.toFixed(1)} days`, avW = textW(avText, "muted num halo"), ay = y(avg);
    // candidate spots: every 8px along the line, above and below; right end preferred
    const avOpts = [];
    for (let lx = W - m.right - avW; lx >= m.left + 8; lx -= 8)
      [ay - fs - 4, ay + 4].forEach((ly, k) => avOpts.push({ x: lx - pad, y: ly - pad, w: avW + 2 * pad, h: fs + 2 * pad, t: avText, pref: (W - m.right - avW - lx) / 400 + k * 0.2 }));
    // fallback when the line is crowded: a small key in an empty spot near the top
    const keyText = "- - " + avText, keyW = textW(keyText, "muted num halo");
    for (let lx = W - m.right - keyW; lx >= m.left + 8; lx -= 8)
      [m.top + 2, m.top + fs + 8].forEach((ly, k) => avOpts.push({ x: lx - pad, y: ly - pad, w: keyW + 2 * pad, h: fs + 2 * pad, t: keyText, pref: 20 + k }));
    let avBest = avOpts[0], avCost = Infinity;
    avOpts.forEach((o) => { const c = cost(o, -1) + o.pref; if (c < avCost) { avCost = c; avBest = o; } });
    boxes.push(avBest);
    av.select("text").attr("class", "muted num halo").attr("font-size", fs).attr("text-anchor", "start")
      .attr("x", avBest.x + pad).text(avBest.t)
      .transition().duration(dur).attr("y", avBest.y + pad + fs - 2);

    // 2. bubble labels, biggest bubbles first
    const showLabel = (d) => mode === "age" || (narrow ? d.perYear > 6000 || d.bdpc > 7.5 : d.perYear > 1500 || d.bdpc > 7.5);
    const name = (d) => (mode === "age" ? "Age " + d.name : d.name.replace("Car unknown position", "Car, unknown position"));
    const placed = new Map();
    rows.map((d, i) => ({ d, i })).filter((o) => showLabel(o.d)).sort((a, b) => b.d.bed - a.d.bed).forEach(({ d, i }) => {
      const c = circles[i], t = `${name(d)}  ${d.bdpc.toFixed(1)}`, w = textW(t), h = fs;
      let best = null, bestCost = Infinity;
      [6, 22, 44].forEach((gap, ring) => {
        // angle order: right, left, above, below, then the diagonals
        [0, 180, -90, 90, -35, 35, -145, 145].forEach((deg) => {
          const a = (deg * Math.PI) / 180, ex = c.x + Math.cos(a) * (c.r + gap), ey = c.y + Math.sin(a) * (c.r + gap);
          const lx = Math.cos(a) > 0.3 ? ex : Math.cos(a) < -0.3 ? ex - w : ex - w / 2;
          const ly = Math.sin(a) > 0.3 ? ey : Math.sin(a) < -0.3 ? ey - h : ey - h / 2;
          const bx = { x: lx - pad, y: ly - pad, w: w + 2 * pad, h: h + 2 * pad };
          const k = cost(bx, i) + ring * 4 + (Math.abs(deg) % 180 ? 1 : 0);
          if (k < bestCost) { bestCost = k; best = { bx, ex, ey, ring, a }; }
        });
      });
      boxes.push(best.bx);
      placed.set(d.name, { t, ...best, c });
    });
    measure.remove();

    const lab = rows.filter(showLabel);
    const leaders = svg.select(".lbl").selectAll("line").data(lab.filter((d) => placed.get(d.name).ring > 0), key).join("line")
      .style("stroke", RC.css("--muted")).attr("stroke-width", 1).attr("pointer-events", "none");
    leaders.each(function (d) {
      const p = placed.get(d.name);
      d3.select(this)
        .attr("x1", p.c.x + Math.cos(p.a) * (p.c.r + 1)).attr("y1", p.c.y + Math.sin(p.a) * (p.c.r + 1))
        .attr("x2", p.c.x + Math.cos(p.a) * (p.c.r + 22 * p.ring + 2)).attr("y2", p.c.y + Math.sin(p.a) * (p.c.r + 22 * p.ring + 2));
    });
    const lbl = svg.select(".lbl").selectAll("text").data(lab, key).join(
      (en) => en.append("text").style("opacity", 0),
      (u) => u,
      (ex) => ex.remove());
    lbl.attr("class", "halo").attr("font-size", fs).attr("pointer-events", "none").attr("text-anchor", "start")
      .text((d) => placed.get(d.name).t)
      .transition().duration(dur)
      .style("opacity", 1)
      .attr("x", (d) => placed.get(d.name).bx.x + pad)
      .attr("y", (d) => placed.get(d.name).bx.y + pad + fs - 2);
  }
})();
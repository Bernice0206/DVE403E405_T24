/* Q4 · Choropleth: each state coloured by its index of non-fatal cases (2013 = 100) in the chosen year.
   Click or press Enter on a state to open its trend sparkline and road user mix (2017–2021). */
(function () {
  const el = document.getElementById("q4-chart");
  const NAME = {
    "New South Wales": "NSW", Victoria: "Vic", Queensland: "Qld", "South Australia": "SA", "Western Australia": "WA",
    Tasmania: "Tas", "Northern Territory": "NT", "Australian Capital Territory": "ACT",
  };
  const FULL = Object.fromEntries(Object.entries(NAME).map(([k, v]) => [v, k]));
  const RU_SHORT = {
    "Car driver, passenger or unknown position": "Car occupant",
    "Heavy transport driver, passenger or unknown position": "Heavy transport",
    "Pick-up truck or van occupant": "Pick-up or van", "Other or unknown": "Other or unknown",
  };
  let geo, idx, mix, years, year = 2021, current = "NSW";

  RC.q4 = async function init() {
    const [g, annual, m] = await Promise.all([RC.loadJSON("au-states.geojson"), RC.loadCSV("q4_state_annual.csv"), RC.loadCSV("q4_state_roaduser_mix.csv")]);
    geo = g;
    // d3 expects clockwise outer rings; fix any feature whose area covers most of the globe
    geo.features.forEach((f) => {
      if (d3.geoArea(f) > 2 * Math.PI) {
        const rev = (poly) => poly.map((ring) => ring.slice().reverse());
        f.geometry.coordinates = f.geometry.type === "Polygon" ? rev(f.geometry.coordinates) : f.geometry.coordinates.map(rev);
      }
    });
    idx = d3.group(annual.map((r) => {
      const cases = +RC.pick(r, "cases", "nonfatal_cases");
      let ix = RC.pick(r, "index_2013");
      return { year: +RC.pick(r, "year", "Calendar year"), state: RC.pick(r, "state", "state or territory"), cases, index: ix, note: RC.pick(r, "break_note") || "" };
    }), (d) => d.state);
    // compute index if the file has none
    idx.forEach((rows) => {
      const b = rows.find((d) => d.year === 2013);
      rows.forEach((d) => { if (d.index === undefined || d.index === null) d.index = (d.cases / b.cases) * 100; });
      rows.sort((a, b) => a.year - b.year);
    });
    mix = d3.group(m.map((r) => ({ state: RC.pick(r, "state"), ru: RC.pick(r, "road_user", "Road user"), cases: RC.pick(r, "cases"), share: RC.pick(r, "share") })), (d) => d.state);
    years = idx.get("NSW").map((d) => d.year);

    d3.select("#q4-year").selectAll("option").data(years).join("option").attr("value", (d) => d).text((d) => d);
    d3.select("#q4-year").property("value", year).on("change", function () { year = +this.value; draw(); });

    RC.renderTable("q4-table",
      [{ label: "Year", value: (y) => y }].concat(Object.values(NAME).map((s) => ({ label: s, num: true, value: (y) => idx.get(s).find((d) => d.year === y).index.toFixed(1) }))),
      years);
    draw();
    RC.onResize(el, draw);
    RC.onThemeChange(draw);
  };

  const val = (s) => idx.get(s).find((d) => d.year === year);

  function colour() {
    return d3.scaleDiverging(d3.piecewise(d3.interpolateLab, [RC.css("--down"), RC.css("--div-mid"), RC.css("--up")]))
      .domain([60, 100, 150]).clamp(true);
  }

  function draw() {
    const W = el.clientWidth;
    const H = Math.round(W * 0.86);
    const c = colour();
    const proj = d3.geoMercator().fitExtent([[8, 8], [W - 50, H - 8]], geo);
    const path = d3.geoPath(proj);
    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "group")
      .attr("aria-label", `Map of Australia coloured by index of non-fatal cases in ${year}, 2013 = 100. Select a state for details.`);

    const states = svg.append("g").selectAll("path").data(geo.features).join("path")
      .attr("d", path)
      .style("fill", (f) => c(val(NAME[f.properties.STATE_NAME]).index))
      .style("stroke", RC.css("--paper")).attr("stroke-width", 1.2)
      .style("cursor", "pointer")
      .attr("role", "button")
      .attr("aria-pressed", (f) => String(NAME[f.properties.STATE_NAME] === current))
      .attr("aria-label", (f) => {
        const s = NAME[f.properties.STATE_NAME], v = val(s);
        return `${f.properties.STATE_NAME}: index ${v.index.toFixed(0)} in ${year}`;
      });
    RC.bindTip(states, (f) => {
      const s = NAME[f.properties.STATE_NAME], v = val(s);
      return `<strong>${f.properties.STATE_NAME}</strong>Index <span class="n">${v.index.toFixed(1)}</span> in ${year} (2013 = 100)<br>` +
        `<span class="n">${RC.fmt(v.cases)}</span> non-fatal cases` + (v.note ? `<br>${v.note}` : "");
    }, (f) => { current = NAME[f.properties.STATE_NAME]; draw(); });

    // outline the selected state on top
    const sel = geo.features.find((f) => NAME[f.properties.STATE_NAME] === current);
    svg.append("path").attr("d", path(sel)).style("fill", "none").style("stroke", RC.css("--ink")).attr("stroke-width", 2.2).attr("pointer-events", "none");

    // labels: state + index; ACT and Vic get leader lines off the coast
    const lab = svg.append("g").attr("pointer-events", "none");
    geo.features.forEach((f) => {
      const s = NAME[f.properties.STATE_NAME];
      let [cx, cy] = path.centroid(f);
      let lx = cx, ly = cy, anchor = "middle";
      if (s === "ACT") { lx = cx + W * 0.085; ly = cy + 2; anchor = "start"; }
      if (s === "Vic") { ly = cy + 2; }
      if (s === "Tas") { lx = cx + W * 0.07; ly = cy + 4; anchor = "start"; }
      if (s === "NSW") { ly = cy - 8; }
      if (lx !== cx) lab.append("line").attr("x1", cx).attr("y1", cy).attr("x2", lx - 3).attr("y2", ly - 4).style("stroke", RC.css("--muted"));
      const t = lab.append("text").attr("x", lx).attr("y", ly).attr("text-anchor", anchor)
        .style("paint-order", "stroke").style("stroke", RC.css("--paper")).attr("stroke-width", 3).attr("stroke-linejoin", "round");
      t.append("tspan").attr("x", lx).attr("font-size", 12).attr("font-weight", s === current ? 700 : 600).text(s);
      t.append("tspan").attr("x", lx).attr("dy", 14).attr("font-size", 12).attr("class", "num").text(val(s).index.toFixed(0));
    });
    el.replaceChildren(svg.node());

    // legend
    const lg = d3.select("#q4-legend").html("");
    lg.append("span").text("Index (2013 = 100)");
    const sw = lg.append("span").style("display", "inline-flex").style("align-items", "center").style("gap", "6px");
    sw.append("span").attr("class", "num").text("≤60");
    sw.append("span").style("display", "inline-block").style("width", "140px").style("height", "10px").style("border-radius", "3px")
      .style("background", `linear-gradient(90deg, ${[60, 80, 100, 125, 150].map((v) => c(v)).join(",")})`);
    sw.append("span").attr("class", "num").text("≥150");

    panel(c);
  }

  function panel(c) {
    const rows = idx.get(current), v = val(current);
    const box = d3.select("#q4-panel").html("");
    box.append("p").attr("class", "eyebrow").text("Selected state");
    box.append("h3").text(FULL[current]);
    const diff = v.index - 100;
    box.append("p").html(`<span class="big">${v.index.toFixed(0)}</span> <span class="sub">index in ${year}: ${Math.abs(diff).toFixed(0)}% ${diff >= 0 ? "more" : "fewer"} cases than in 2013 (${RC.fmt(v.cases)} cases)</span>`);

    // sparkline
    const W = Math.min(360, box.node().clientWidth || 320), H = 110, m = { t: 10, r: 34, b: 20, l: 6 };
    const x = d3.scaleLinear().domain(d3.extent(rows, (d) => d.year)).range([m.l, W - m.r]);
    const ext = d3.extent(rows, (d) => d.index);
    const y = d3.scaleLinear().domain([Math.min(70, ext[0]), Math.max(140, ext[1])]).range([H - m.b, m.t]);
    const svg = box.append("div").attr("class", "chart").append("svg").attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img").attr("aria-label", `${FULL[current]} index from ${rows[0].year} to ${rows[rows.length - 1].year}`);
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(100)).attr("y2", y(100)).style("stroke", RC.css("--muted")).attr("stroke-dasharray", "3 3");
    svg.append("text").attr("x", W - m.r + 4).attr("y", y(100) + 4).attr("font-size", 10.5).attr("class", "muted num").text("100");
    const brk = rows.find((d) => d.note);
    if (brk) {
      svg.append("line").attr("x1", x(brk.year)).attr("x2", x(brk.year)).attr("y1", m.t).attr("y2", H - m.b).style("stroke", RC.css("--signal")).attr("stroke-width", 2);
    }
    svg.append("path").datum(rows).attr("d", d3.line().x((d) => x(d.year)).y((d) => y(d.index)))
      .style("fill", "none").style("stroke", RC.css("--ink")).attr("stroke-width", 2);
    svg.append("circle").attr("cx", x(year)).attr("cy", y(v.index)).attr("r", 4).style("fill", c(v.index)).style("stroke", RC.css("--ink")).attr("stroke-width", 1.5);
    svg.append("text").attr("x", x(year) + 6).attr("y", y(v.index) - 6).attr("font-size", 11).attr("class", "num").text(v.index.toFixed(0));
    [rows[0].year, rows[rows.length - 1].year].forEach((yr) => svg.append("text").attr("x", x(yr)).attr("y", H - 4)
      .attr("text-anchor", yr === rows[0].year ? "start" : "end").attr("font-size", 10.5).attr("class", "muted num").text(yr));

    if (brk) box.append("p").attr("class", "flag").text(`Reporting break: ${brk.note}. Years from ${brk.year} are not directly comparable with earlier years.`);

    // road user mix 2017–2021
    box.append("p").attr("class", "sub").text("Road user mix, 2017–2021 (% of this state's cases)");
    const mx = (mix.get(current) || []).map((d) => ({ ...d, label: RU_SHORT[d.ru] || d.ru })).sort((a, b) => (b.share ?? -1) - (a.share ?? -1));
    const bw = W, bh = mx.length * 20 + 4, labW = 112;
    const xb = d3.scaleLinear().domain([0, Math.max(60, d3.max(mx, (d) => d.share || 0))]).range([labW, bw - 40]);
    const bs = box.append("div").attr("class", "chart").append("svg").attr("viewBox", `0 0 ${bw} ${bh}`).attr("role", "img")
      .attr("aria-label", `Road user mix for ${FULL[current]}`);
    const row = bs.selectAll("g").data(mx).join("g").attr("transform", (d, i) => `translate(0,${i * 20 + 2})`);
    row.append("text").attr("x", labW - 6).attr("y", 12).attr("text-anchor", "end").attr("font-size", 11.5).text((d) => d.label);
    row.append("rect").attr("x", labW).attr("y", 3).attr("height", 12).attr("rx", 2)
      .attr("width", (d) => (d.share ? xb(d.share) - labW : 0)).style("fill", RC.css("--ink")).style("fill-opacity", 0.75);
    row.append("text").attr("x", (d) => (d.share ? xb(d.share) + 4 : labW + 2)).attr("y", 13).attr("font-size", 11).attr("class", "num muted")
      .text((d) => (d.share === null || d.share === undefined || !isFinite(d.share) ? "n.p." : d.share.toFixed(1) + "%"));
  }
})();

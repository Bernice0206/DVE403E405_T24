/* Q5 · Dumbbell plot: share of each group's road crash hospitalisations (2017–2021) by remoteness,
   road user and age; First Nations people vs non-Indigenous. Suppressed cells ("n.p.") are left out. */
(function () {
  const el = document.getElementById("q5-chart");
  const FN = "First Nations people", NI = "Non-Indigenous";
  const DIMS = [
    { key: "remoteness", label: "Remoteness of residence", file: "q5_fn_remoteness.csv", order: ["Major Cities", "Regional", "Remote"] },
    { key: "road_user", label: "Road user", file: "q5_fn_roaduser.csv", order: null },
    { key: "age", label: "Age group", file: "q5_fn_age.csv", order: ["0-7", "8-16", "17-25", "26-39", "40-64", "65+"] },
  ];
  const RU_SHORT = {
    "Car driver, passenger or unknown position": "Car occupant",
    "Heavy transport driver, passenger or unknown position": "Heavy transport",
    "Pick-up truck or van occupant": "Pick-up or van", "Other or unknown": "Other or unknown",
  };
  let rows = [], dim = "all";

  RC.q5 = async function init() {
    const files = await Promise.all(DIMS.map((d) => RC.loadCSV(d.file)));
    DIMS.forEach((D, i) => {
      const recent = files[i].filter((r) => +RC.pick(r, "year") >= 2017);
      const sums = d3.rollup(recent, (v) => d3.sum(v, (r) => +RC.pick(r, "hosp", "Hospitalisations") || 0),
        (r) => RC.pick(r, "status", "First Nations status"), (r) => String(RC.pick(r, D.key, "Road user", "Age group", "ABS remoteness area")));
      const tot = { [FN]: d3.sum(sums.get(FN).values()), [NI]: d3.sum(sums.get(NI).values()) };
      let cats = [...sums.get(FN).keys()];
      cats = D.order ? D.order.filter((c) => cats.includes(c)) : cats.sort((a, b) => sums.get(FN).get(b) - sums.get(FN).get(a));
      cats.forEach((c) => rows.push({
        dim: D.key, dimLabel: D.label, cat: c, label: D.key === "road_user" ? RU_SHORT[c] || c : D.key === "age" ? "Age " + c : c,
        fn: (sums.get(FN).get(c) / tot[FN]) * 100, ni: ((sums.get(NI).get(c) || 0) / tot[NI]) * 100,
        fnN: sums.get(FN).get(c), niN: sums.get(NI).get(c) || 0,
      }));
    });

    // headline numbers for the intro, from the age file (all ages, annual)
    const ageRows = files[2];
    const yr = (y, s) => d3.sum(ageRows.filter((r) => +RC.pick(r, "year") === y && RC.pick(r, "status") === s), (r) => +RC.pick(r, "hosp") || 0);
    const f11 = yr(2011, FN), f21 = yr(2021, FN), n11 = yr(2011, NI), n21 = yr(2021, NI);
    document.getElementById("q5-intro").innerHTML =
      `First Nations people’s road crash hospitalisations rose from <b>${RC.fmt(f11)}</b> in 2011 to <b>${RC.fmt(f21)}</b> in 2021 (${RC.signedPct(((f21 - f11) / f11) * 100)}), ` +
      `compared with ${RC.signedPct(((n21 - n11) / n11) * 100)} for non-Indigenous people. Their share of all cases went from ${RC.pct1((f11 / (f11 + n11)) * 100)} to ${RC.pct1((f21 / (f21 + n21)) * 100)}. ` +
      `Because the two groups are very different in size, the chart compares percentages within each group. The longer the line between the dots, the bigger the difference.`;

    document.querySelectorAll("#first-nations .seg button").forEach((b) => b.addEventListener("click", () => {
      dim = b.dataset.dim;
      document.querySelectorAll("#first-nations .seg button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      draw();
    }));
    RC.renderTable("q5-table", [
      { label: "Dimension", value: (d) => d.dimLabel },
      { label: "Category", value: (d) => d.label },
      { label: "First Nations %", num: true, value: (d) => d.fn.toFixed(1) },
      { label: "Non-Indigenous %", num: true, value: (d) => d.ni.toFixed(1) },
      { label: "First Nations cases", num: true, value: (d) => RC.fmt(d.fnN) },
      { label: "Non-Indigenous cases", num: true, value: (d) => RC.fmt(d.niN) },
    ], rows);
    draw();
    RC.onResize(el, draw);
    RC.onThemeChange(draw);
  };

  function draw() {
    const show = dim === "all" ? rows : rows.filter((r) => r.dim === dim);
    const W = el.clientWidth, narrow = W < 560;
    const rowH = 28, headH = dim === "all" ? 30 : 0;
    const m = { top: 8, right: 54, bottom: 34, left: narrow ? 112 : 150 };
    // layout rows with group headings
    let yPos = m.top; const items = [], heads = [];
    DIMS.forEach((D) => {
      const g = show.filter((r) => r.dim === D.key);
      if (!g.length) return;
      if (headH) { heads.push({ label: D.label, y: yPos + 20 }); yPos += headH; }
      g.forEach((r) => { items.push({ ...r, y: yPos + rowH / 2 }); yPos += rowH; });
    });
    const H = yPos + m.bottom;
    const x = d3.scaleLinear().domain([0, Math.max(80, d3.max(show, (d) => Math.max(d.fn, d.ni)) * 1.05)]).range([m.left, W - m.right]);
    const up = RC.css("--up"), down = RC.css("--down");

    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img")
      .attr("aria-label", "Dumbbell plot comparing First Nations and non-Indigenous percentages, 2017 to 2021");
    svg.append("g").attr("class", "grid").selectAll("line").data(x.ticks(narrow ? 4 : 8)).join("line")
      .attr("x1", x).attr("x2", x).attr("y1", m.top).attr("y2", H - m.bottom);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.bottom})`)
      .call(d3.axisBottom(x).ticks(narrow ? 4 : 8).tickFormat((d) => d + "%").tickSizeOuter(0))
      .call((g) => g.selectAll("text").attr("font-size", 11.5));
    svg.append("text").attr("class", "muted").attr("x", W - m.right).attr("y", H - 2).attr("text-anchor", "end").attr("font-size", 11.5)
      .text("% of each group’s cases, 2017–2021");

    heads.forEach((h) => svg.append("text").attr("x", 0).attr("y", h.y).attr("font-size", 12.5).attr("font-weight", 700).text(h.label));

    const row = svg.append("g").selectAll("g").data(items).join("g").attr("transform", (d) => `translate(0,${d.y})`);
    row.append("text").attr("x", m.left - 12).attr("y", 4).attr("text-anchor", "end").attr("font-size", narrow ? 11 : 12).text((d) => d.label);
    row.append("line").attr("x1", (d) => x(Math.min(d.fn, d.ni))).attr("x2", (d) => x(Math.max(d.fn, d.ni)))
      .style("stroke", RC.css("--rule")).attr("stroke-width", 4).attr("stroke-linecap", "round");
    const dot = (cls, acc, colr) => {
      const c = row.append("circle").attr("class", cls).attr("cx", (d) => x(d[acc])).attr("r", 6.5)
        .style("fill", colr).style("stroke", RC.css("--paper")).attr("stroke-width", 2).attr("role", "img")
        .attr("aria-label", (d) => `${d.label}, ${acc === "fn" ? FN : NI}: ${d[acc].toFixed(1)}%`);
      RC.bindTip(c, (d) => `<strong>${d.label}</strong>${acc === "fn" ? FN : NI}: <span class="n">${d[acc].toFixed(1)}%</span><br>` +
        `(<span class="n">${RC.fmt(d[acc + "N"])}</span> cases, 2017–21)<br>Gap: <span class="n">${Math.abs(d.fn - d.ni).toFixed(1)}</span> percentage points`);
    };
    dot("ni", "ni", down);
    dot("fn", "fn", up);
    // value labels: larger value on the right; smaller on the left, or after the larger one when there is no room
    const fits = (d) => Math.abs(d.fn - d.ni) >= 2.5 && x(Math.min(d.fn, d.ni)) - 46 >= m.left;
    const hiT = row.append("text").attr("class", "num").attr("font-size", 11).attr("y", 4)
      .attr("x", (d) => x(Math.max(d.fn, d.ni)) + 10);
    hiT.append("tspan").text((d) => (d.fn >= d.ni ? d.fn : d.ni).toFixed(1) + "%").style("fill", (d) => (d.fn >= d.ni ? up : down));
    hiT.filter((d) => !fits(d)).append("tspan").style("fill", RC.css("--muted")).text(" vs ");
    hiT.filter((d) => !fits(d)).append("tspan").text((d) => (d.fn < d.ni ? d.fn : d.ni).toFixed(1) + "%").style("fill", (d) => (d.fn < d.ni ? up : down));
    row.filter(fits).append("text").attr("class", "num").attr("font-size", 11).attr("y", 4).attr("text-anchor", "end")
      .attr("x", (d) => x(Math.min(d.fn, d.ni)) - 10).text((d) => (d.fn < d.ni ? d.fn : d.ni).toFixed(1) + "%")
      .style("fill", (d) => (d.fn < d.ni ? up : down));

    el.replaceChildren(svg.node());
  }
})();

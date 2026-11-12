/* Q1 · Calendar heatmap: years (rows) × months (columns), colour = non-fatal cases.
   Hover or Tab a cell for its count and the change on the same month a year earlier.
   Drag on the strip left of the grid (or click year labels; Shift+click extends) to compare years. */
(function () {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const el = document.getElementById("q1-chart");
  let cells, years, annual, sel = [2019, 2020];

  RC.q1 = async function init() {
    const monthly = await RC.loadCSV("q1_monthly_all_years.csv");
    const ann = await RC.loadCSV("q1_national_annual.csv");
    annual = new Map(ann.map((r) => [+RC.pick(r, "Calendar year", "year"), {
      total: +RC.pick(r, "nonfatal", "Hospitalisations"),
      note: RC.pick(r, "break_note") || "",
    }]));
    cells = [];
    monthly.forEach((r) => {
      const year = +RC.pick(r, "Calendar year", "year");
      MONTHS.forEach((m, i) => {
        const v = +RC.pick(r, m, m.slice(0, 3));
        cells.push({ year, m: i, v });
      });
    });
    const byKey = new Map(cells.map((c) => [c.year + "-" + c.m, c]));
    cells.forEach((c) => {
      const p = byKey.get(c.year - 1 + "-" + c.m);
      c.prev = p ? p.v : null;
      c.chg = p ? ((c.v - p.v) / p.v) * 100 : null;
    });
    years = [...new Set(cells.map((c) => c.year))].sort((a, b) => a - b);

    RC.renderTable("q1-table",
      [{ label: "Year", value: (r) => r.year }].concat(MONTHS.map((m, i) => ({ label: m.slice(0, 3), num: true, value: (r) => RC.fmt(r.vals[i]) })))
        .concat([{ label: "Total", num: true, value: (r) => RC.fmt(annual.get(r.year).total) }]),
      years.map((y) => ({ year: y, vals: cells.filter((c) => c.year === y).map((c) => c.v) })));

    draw();
    RC.onResize(el, draw);
    RC.onThemeChange(draw);
  };

  function draw() {
    const W = el.clientWidth;
    const narrow = W < 620;
    const m = { top: 26, right: narrow ? 14 : 150, bottom: 8, left: narrow ? 64 : 76 };
    const cw = (W - m.left - m.right) / 12;
    const ch = Math.max(22, Math.min(36, cw * 0.62));
    const H = m.top + ch * years.length + m.bottom;
    const lo = d3.min(cells, (c) => c.v), hi = d3.max(cells, (c) => c.v);
    const color = d3.scaleSequential(d3.interpolateLab(RC.css("--seq-lo"), RC.css("--seq-hi"))).domain([lo, hi]);
    const x = (i) => m.left + i * cw;
    const y = d3.scaleBand().domain(years).range([m.top, m.top + ch * years.length]);

    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`)
      .attr("role", "img").attr("aria-label", "Calendar heatmap of monthly non-fatal road crash hospitalisations, 2011 to 2021");

    // month labels
    svg.append("g").attr("class", "axis").selectAll("text").data(MONTHS).join("text")
      .attr("x", (d, i) => x(i) + cw / 2).attr("y", m.top - 9).attr("text-anchor", "middle")
      .attr("font-size", 11.5).text((d) => (narrow ? d[0] : d.slice(0, 3)));

    // brush strip + year labels
    const stripX = m.left - 14;
    const selBand = svg.append("rect").attr("x", 0).attr("width", m.left - 4).attr("rx", 4)
      .style("fill", RC.css("--signal")).style("fill-opacity", 0.28);
    const ylab = svg.append("g").attr("class", "axis").selectAll("text").data(years).join("text")
      .attr("x", stripX - 8).attr("y", (d) => y(d) + ch / 2 + 4).attr("text-anchor", "end")
      .attr("font-size", 12).attr("class", "num").style("cursor", "pointer")
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (d) => `Select ${d}${annual.get(d).note ? " (" + annual.get(d).note + ")" : ""}`)
      .text((d) => d)
      .on("click", (e, d) => pick(d, e.shiftKey))
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(d, e.shiftKey); } });

    // cells
    const g = svg.append("g");
    const rects = g.selectAll("rect").data(cells).join("rect")
      .attr("x", (d) => x(d.m) + 1).attr("y", (d) => y(d.year) + 1)
      .attr("width", cw - 2).attr("height", ch - 2).attr("rx", 3)
      .style("fill", (d) => color(d.v))
      .attr("role", "img")
      .attr("aria-label", (d) => `${MONTHS[d.m]} ${d.year}: ${RC.fmt(d.v)} cases`);
    RC.bindTip(rects, (d) =>
      `<strong>${MONTHS[d.m]} ${d.year}</strong><span class="n">${RC.fmt(d.v)}</span> non-fatal cases` +
      (d.chg !== null ? `<br><span class="n">${RC.signedPct(d.chg)}</span> vs ${MONTHS[d.m].slice(0, 3)} ${d.year - 1}` : ""));

    // April 2020 call-out
    const apr = cells.find((c) => c.year === 2020 && c.m === 3);
    if (apr) {
      svg.append("rect").attr("class", "callout-mark")
        .attr("x", x(3) + 1).attr("y", y(2020) + 1).attr("width", cw - 2).attr("height", ch - 2).attr("rx", 3)
        .style("fill", "none").style("stroke", RC.css("--down")).attr("stroke-width", 2.5).attr("pointer-events", "none");
    }

    // break markers (right side on wide screens, dagger after year on narrow)
    years.forEach((yr) => {
      const note = annual.get(yr).note;
      if (!note) return;
      const short = note.startsWith("Vic") ? "Vic reporting break" : note.startsWith("NSW") ? "NSW reporting break" : "COVID-19 restrictions";
      if (narrow) {
        svg.append("text").attr("x", 4).attr("y", y(yr) + ch / 2 + 4).attr("class", "muted").attr("font-size", 12).text("†");
      } else {
        svg.append("text").attr("x", W - m.right + 12).attr("y", y(yr) + ch / 2 + 4)
          .attr("class", "muted").attr("font-size", 11.5).text("◂ " + short);
      }
    });

    // brush on the year strip
    const brush = d3.brushY()
      .extent([[stripX - 2, m.top], [stripX + 8, m.top + ch * years.length]])
      .on("end", (e) => {
        if (!e.sourceEvent) return;
        if (!e.selection) return;
        const [a, b] = e.selection;
        const i0 = Math.max(0, Math.floor((a - m.top) / ch)), i1 = Math.min(years.length - 1, Math.floor((b - m.top - 0.01) / ch));
        sel = [years[i0], years[Math.max(i0, i1)]];
        update();
      });
    const bg = svg.append("g").call(brush);
    bg.select(".overlay").style("fill", RC.css("--rule")).style("fill-opacity", 0.6).attr("rx", 3).style("cursor", "ns-resize");
    bg.select(".selection").style("fill", RC.css("--ink")).style("fill-opacity", 0.75).style("stroke", "none");
    function update() {
      const [a, b] = sel;
      bg.call(brush.move, [y(a), y(b) + ch]);
      selBand.attr("y", y(a)).attr("height", y(b) + ch - y(a));
      ylab.style("font-weight", (d) => (d >= a && d <= b ? 700 : 400)).style("fill", (d) => (d >= a && d <= b ? RC.css("--ink") : null));
      readout();
    }
    function pick(yr, extend) {
      sel = extend ? [Math.min(sel[0], yr), Math.max(sel[1], yr)] : [yr, yr];
      update();
    }
    update();

    // legend
    const lg = d3.select("#q1-legend").html("");
    lg.append("span").text("Cases per month");
    const n = 6, sw = lg.append("span").style("display", "inline-flex").style("align-items", "center").style("gap", "6px");
    sw.append("span").attr("class", "num").text(RC.fmt(lo));
    sw.append("span").style("display", "inline-block").style("width", "120px").style("height", "10px").style("border-radius", "3px")
      .style("background", `linear-gradient(90deg, ${d3.range(n).map((i) => color(lo + ((hi - lo) * i) / (n - 1))).join(",")})`);
    sw.append("span").attr("class", "num").text(RC.fmt(hi));
    lg.append("span").html(`<i style="background:none;outline:2.5px solid ${RC.css("--down")};outline-offset:-2.5px"></i>April 2020`);

    el.replaceChildren(svg.node());
  }

  function readout() {
    const [a, b] = sel;
    const tot = d3.sum(d3.range(a, b + 1), (yr) => annual.get(yr).total);
    const first = annual.get(a).total, last = annual.get(b).total;
    const prev = annual.get(a - 1);
    let txt;
    if (a === b) {
      txt = `<b>${a}</b>: <b>${RC.fmt(first)}</b> non-fatal cases` + (prev ? `, ${RC.signedPct(((first - prev.total) / prev.total) * 100)} on ${a - 1}.` : ".");
    } else {
      txt = `<b>${a}–${b}</b>: <b>${RC.fmt(tot)}</b> non-fatal cases in total. ${b} was <b>${RC.signedPct(((last - first) / first) * 100)}</b> compared with ${a}.`;
    }
    const notes = d3.range(a, b + 1).map((yr) => annual.get(yr).note).filter(Boolean);
    if (notes.length) txt += ` Note: ${notes.join("; ")}.`;
    document.getElementById("q1-readout").innerHTML = txt + " Drag the strip beside the years, or click a year (Shift+click to extend), to compare.";
  }
})();

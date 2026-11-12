/* Q2 · Waterfall (bridge) chart: total in Year A → one step per road user group → total in Year B.
   The y-axis is broken (≈) so that changes of a few hundred cases are visible next to totals near 40,000. */
(function () {
  const el = document.getElementById("q2-chart");
  const MAJOR = ["Pedal cyclist", "Car driver", "Motorcyclist", "Pedestrian", "Car passenger", "Car unknown position"];
  const LABEL = {
    "Pedal cyclist": "Pedal cyclist", "Car driver": "Car driver", Motorcyclist: "Motorcyclist", Pedestrian: "Pedestrian",
    "Car passenger": "Car passenger", "Car unknown position": "Car, position unknown", Other: "Other (6 groups)",
  };
  const SHORT = {
    "Pedal cyclist": "Cyclist", "Car driver": "Car driver", Motorcyclist: "Motorcyclist", Pedestrian: "Pedestrian",
    "Car passenger": "Passenger", "Car unknown position": "Car (unknown)", Other: "Other",
  };
  const PLURAL = {
    "Pedal cyclist": "pedal cyclists", "Car driver": "car drivers", Motorcyclist: "motorcyclists", Pedestrian: "pedestrians",
    "Car passenger": "car passengers", "Car unknown position": "car occupants in an unknown position", Other: "the six smaller groups",
  };
  let byYear, years, A = 2011, B = 2021, first = true;

  RC.q2 = async function init() {
    const rows = await RC.loadCSV("q2_roaduser_by_year.csv");
    byYear = d3.rollup(rows, (v) => {
      const o = { Other: 0 };
      v.forEach((r) => {
        const ru = RC.pick(r, "Road user", "road_user"), n = +RC.pick(r, "Hospitalisations", "cases");
        if (MAJOR.includes(ru)) o[ru] = (o[ru] || 0) + n; else o.Other += n;
      });
      o.__total = d3.sum(Object.values(o));
      return o;
    }, (r) => +RC.pick(r, "Calendar year", "year"));
    years = [...byYear.keys()].sort((a, b) => a - b);
    A = years[0]; B = years[years.length - 1];

    for (const [id, val] of [["q2-year-a", A], ["q2-year-b", B]]) {
      const s = d3.select("#" + id);
      s.selectAll("option").data(years).join("option").attr("value", (d) => d).text((d) => d);
      s.property("value", val).on("change", function () {
        if (id === "q2-year-a") A = +this.value; else B = +this.value;
        draw(true);
      });
    }
    RC.renderTable("q2-table",
      [{ label: "Year", value: (y) => y }].concat(MAJOR.concat("Other").map((k) => ({ label: LABEL[k], num: true, value: (y) => RC.fmt(byYear.get(y)[k]) })))
        .concat([{ label: "Total", num: true, value: (y) => RC.fmt(byYear.get(y).__total) }]),
      years);
    draw(false);
    RC.onResize(el, () => draw(false));
    RC.onThemeChange(() => draw(false));
  };

  function steps() {
    const a = byYear.get(A), b = byYear.get(B);
    const groups = MAJOR.concat("Other").map((k) => ({ key: k, from: a[k], to: b[k], delta: b[k] - a[k] }));
    groups.sort((p, q) => q.delta - p.delta);
    let run = a.__total;
    const out = [{ key: "__A", kind: "total", label: String(A), y0: 0, y1: a.__total, value: a.__total }];
    groups.forEach((g) => { out.push({ ...g, kind: "step", label: g.key, y0: run, y1: run + g.delta }); run += g.delta; });
    out.push({ key: "__B", kind: "total", label: String(B), y0: 0, y1: b.__total, value: b.__total });
    return out;
  }

  function draw(animate) {
    const data = steps();
    const W = el.clientWidth, narrow = W < 620;
    const m = { top: 26, right: 8, bottom: narrow ? 78 : 46, left: 56 };
    const H = Math.max(300, Math.min(420, W * 0.5));
    const lvl = data.flatMap((d) => (d.kind === "total" ? [d.y1] : [d.y0, d.y1]));
    const lo = d3.min(lvl), hi = d3.max(lvl);
    const pad = Math.max(400, (hi - lo) * 0.35);
    const yLo = Math.floor((lo - pad) / 500) * 500, yHi = Math.ceil((hi + pad * 0.45) / 500) * 500;
    const breakH = 18;
    const x = d3.scaleBand().domain(data.map((d) => d.key)).range([m.left, W - m.right]).padding(0.28);
    const y = d3.scaleLinear().domain([yLo, yHi]).range([H - m.bottom - breakH, m.top]);
    const base = H - m.bottom; // visual zero, below the break
    const yy = (v) => (v <= yLo ? base : y(v));
    const col = (d) => (d.kind === "total" ? RC.css("--total") : d.delta >= 0 ? RC.css("--up") : RC.css("--down"));
    const dur = animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 600 : 0;

    let svg = d3.select(el).select("svg");
    if (svg.empty() || !animate) {
      el.replaceChildren();
      svg = d3.select(el).append("svg");
      svg.append("g").attr("class", "grid");
      svg.append("g").attr("class", "axis y");
      svg.append("g").attr("class", "conn");
      svg.append("g").attr("class", "bars");
      svg.append("g").attr("class", "labels");
      svg.append("g").attr("class", "axis x");
      svg.append("g").attr("class", "brk");
    }
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img")
      .attr("aria-label", `Waterfall chart of the change in non-fatal cases by road user from ${A} to ${B}`);

    const ticks = y.ticks(5).filter((t) => t > yLo);
    svg.select(".grid").selectAll("line").data(ticks).join("line")
      .attr("x1", m.left).attr("x2", W - m.right).attr("y1", y).attr("y2", y);
    const ya = svg.select(".axis.y").selectAll("text").data(ticks.concat([0])).join("text")
      .attr("x", m.left - 8).attr("text-anchor", "end").attr("font-size", 11.5)
      .attr("y", (t) => (t === 0 ? base + 4 : y(t) + 4)).text((t) => RC.fmt(t));

    // break marks on axis and across total bars
    const brk = svg.select(".brk").html("");
    const zig = (cx, w) => {
      const yb = H - m.bottom - breakH / 2;
      return `M${cx - w / 2},${yb + 3} l${w / 4},-6 l${w / 4},6 l${w / 4},-6 l${w / 4},6`;
    };
    brk.append("text").attr("x", m.left - 22).attr("y", H - m.bottom - breakH / 2 + 5).attr("class", "muted").attr("font-size", 15).text("≈");
    data.filter((d) => d.kind === "total").forEach((d) => {
      brk.append("rect").attr("x", x(d.key) - 2).attr("width", x.bandwidth() + 4)
        .attr("y", H - m.bottom - breakH / 2 - 5).attr("height", 10).style("fill", RC.css("--paper"));
      brk.append("path").attr("d", zig(x(d.key) + x.bandwidth() / 2, x.bandwidth() + 4))
        .style("fill", "none").style("stroke", RC.css("--muted")).attr("stroke-width", 1.2);
    });

    const bars = svg.select(".bars").selectAll("rect").data(data, (d) => d.key).join(
      (en) => en.append("rect").attr("x", (d) => x(d.key)).attr("width", x.bandwidth())
        .attr("y", (d) => yy(Math.max(d.y0, d.y1))).attr("height", 0).attr("rx", 3))
      .style("fill", col)
      .attr("aria-label", (d) => (d.kind === "total"
        ? `Total ${d.label}: ${RC.fmt(d.value)} cases`
        : `${LABEL[d.key]}: ${RC.signed(d.delta)} cases (${RC.signedPct((d.delta / d.from) * 100)})`));
    bars.transition().duration(dur)
      .attr("x", (d) => x(d.key)).attr("width", x.bandwidth())
      .attr("y", (d) => yy(Math.max(d.y0, d.y1)))
      .attr("height", (d) => Math.max(1.5, yy(Math.min(d.y0, d.y1)) - yy(Math.max(d.y0, d.y1))));
    RC.bindTip(bars, (d) => d.kind === "total"
      ? `<strong>All road users, ${d.label}</strong><span class="n">${RC.fmt(d.value)}</span> non-fatal cases`
      : `<strong>${LABEL[d.key]}</strong>${A} → ${B}: <span class="n">${RC.fmt(d.from)} → ${RC.fmt(d.to)}</span><br><span class="n">${RC.signed(d.delta)}</span> cases (<span class="n">${RC.signedPct((d.delta / d.from) * 100)}</span>)`);
    bars.attr("role", "img");
    // keep the focus outline above the break mask
    svg.select(".brk").raise();

    // connectors
    const links = data.slice(0, -1).map((d, i) => ({ key: d.key, x1: x(d.key) + x.bandwidth(), x2: x(data[i + 1].key), v: d.kind === "total" ? d.y1 : d.y1 }));
    svg.select(".conn").selectAll("line").data(links, (d) => d.key).join("line")
      .style("stroke", RC.css("--muted")).attr("stroke-dasharray", "2 2")
      .transition().duration(dur)
      .attr("x1", (d) => d.x1).attr("x2", (d) => d.x2).attr("y1", (d) => y(d.v)).attr("y2", (d) => y(d.v));

    // value labels
    svg.select(".labels").selectAll("text").data(data, (d) => d.key)
      .join((en) => en.append("text").attr("x", (d) => x(d.key) + x.bandwidth() / 2).attr("y", (d) => yy(Math.max(d.y0, d.y1)) - 6))
      .attr("text-anchor", "middle").attr("class", "num").attr("font-size", narrow ? 10 : 11.5)
      .text((d) => (d.kind === "total" ? RC.fmt(d.value) : RC.signed(d.delta)))
      .transition().duration(dur)
      .attr("x", (d) => x(d.key) + x.bandwidth() / 2)
      .attr("y", (d) => yy(Math.max(d.y0, d.y1)) - 6);

    // x labels (rotated short names on narrow screens)
    const xl = svg.select(".axis.x").selectAll("g").data(data, (d) => d.key)
      .join((en) => en.append("g").attr("transform", (d) => `translate(${x(d.key) + x.bandwidth() / 2},${base + 16})`));
    xl.transition().duration(dur).attr("transform", (d) => `translate(${x(d.key) + x.bandwidth() / 2},${base + 16})`);
    xl.selectAll("text").data((d) => {
      const name = d.kind === "total" ? d.label + (narrow ? "" : " total") : narrow ? SHORT[d.key] : LABEL[d.key];
      const lines = narrow ? [name] : RC.wrap(name, 13);
      return lines.map((t) => ({ t, total: d.kind === "total" }));
    }).join("text")
      .attr("text-anchor", narrow ? "end" : "middle").attr("font-size", narrow ? 10.5 : 11.5)
      .attr("transform", narrow ? "rotate(-40)" : null).attr("dx", narrow ? 4 : 0)
      .attr("y", (d, i) => (narrow ? 2 : i * 13)).style("font-weight", (d) => (d.total ? 600 : 400)).text((d) => d.t);

    // headline readout
    const steps_ = data.filter((d) => d.kind === "step");
    const net = data[data.length - 1].value - data[0].value;
    const top = net >= 0 ? d3.greatest(steps_, (d) => d.delta) : d3.least(steps_, (d) => d.delta);
    let txt = `From <b>${A}</b> to <b>${B}</b>, non-fatal cases ${net >= 0 ? "rose" : "fell"} by <b>${RC.fmt(Math.abs(net))}</b> (${RC.signedPct((net / data[0].value) * 100)}).`;
    if (A !== B && top && net !== 0) {
      txt += ` The largest ${net >= 0 ? "increase" : "decrease"} came from <b>${PLURAL[top.key]}</b> (${RC.signed(top.delta)}), ` +
        `equal to ${Math.round((Math.abs(top.delta) / Math.abs(net)) * 100)}% of the net change.`;
    }
    if (A === B) txt = `Choose two different years to see what changed.`;
    if (A > B) txt += ` (The years are in reverse order.)`;
    document.getElementById("q2-readout").innerHTML = txt;
    first = false;
  }
})();

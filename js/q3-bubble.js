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

    // average stay line
    const av = svg.select(".avg").selectAll("g").data([avg]).join((en) => {
      const g = en.append("g");
      g.append("line"); g.append("text");
      return g;
    });
    av.select("line").style("stroke", RC.css("--muted")).attr("stroke-dasharray", "4 4")
      .attr("x1", m.left).attr("x2", W - m.right).transition().duration(dur).attr("y1", y(avg)).attr("y2", y(avg));
    // on narrow screens the average label moves to the top-left corner so it does not collide with bubbles
    av.select("text").attr("class", "muted num").attr("font-size", 11.5).attr("text-anchor", narrow ? "start" : "end").attr("x", narrow ? m.left + 8 : W - m.right)
      .transition().duration(dur).attr("y", narrow ? m.top + 16 : y(avg) - 6).text(narrow ? `- - average stay ${avg.toFixed(1)} days` : `average stay ${avg.toFixed(1)} days`);

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

    // labels: every age group; road users only when large or severe
    const showLabel = (d) => mode === "age" || (narrow ? d.perYear > 6000 || d.bdpc > 7.5 : d.perYear > 1500 || d.bdpc > 7.5);
    const lbl = svg.select(".lbl").selectAll("text").data(rows.filter(showLabel), key).join(
      (en) => en.append("text").style("opacity", 0),
      (u) => u,
      (ex) => ex.remove());
    lbl.attr("font-size", narrow ? 10.5 : 12).attr("pointer-events", "none")
      .each(function (d) {
        const rr = Math.max(3, r(d.bed)), right = x(d.perYear) + rr + 6 + 90 < W;
        // narrow screens: label sits above the bubble; wide screens: beside it
        if (narrow) d3.select(this).attr("text-anchor", "middle").attr("data-x", Math.min(W - 40, Math.max(m.left + 40, x(d.perYear)))).attr("data-dy", -rr - 5);
        else d3.select(this).attr("text-anchor", right ? "start" : "end").attr("data-x", right ? x(d.perYear) + rr + 5 : x(d.perYear) - rr - 5).attr("data-dy", 4);
      })
      .text((d) => (mode === "age" ? "Age " + d.name : d.name.replace("Car unknown position", "Car, unknown position")) + `  ${d.bdpc.toFixed(1)}`)
      .transition().duration(dur)
      .style("opacity", 1)
      .attr("x", function () { return +this.getAttribute("data-x"); })
      .attr("y", function (d) { return y(d.bdpc) + +this.getAttribute("data-dy"); });
  }
})();

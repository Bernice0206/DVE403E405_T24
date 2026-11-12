/* Page setup: hero figures, chapter navigation, and starting each chart. */
(async function () {
  RC.initTableToggles();

  // ---- hero figures from the national annual file ----
  try {
    const ann = await RC.loadCSV("q1_national_annual.csv");
    const ru = await RC.loadCSV("q2_roaduser_by_year.csv");
    const yr = (r) => +RC.pick(r, "Calendar year", "year");
    const last = ann.reduce((a, b) => (yr(b) > yr(a) ? b : a)), first = ann.reduce((a, b) => (yr(b) < yr(a) ? b : a));
    const Y = yr(last), cases = +RC.pick(last, "nonfatal"), bed = +RC.pick(last, "bed_days"), cases0 = +RC.pick(first, "nonfatal");
    const daysInYear = (Y % 4 === 0 && Y % 100 !== 0) || Y % 400 === 0 ? 366 : 365;
    const perDay = Math.round(cases / daysInYear);
    const cyc = ru.filter((r) => yr(r) === Y && RC.pick(r, "Road user") === "Pedal cyclist");
    const cycShare = cyc.length ? +RC.pick(cyc[0], "Hospitalisations") / cases : 0;
    const cycMarks = Math.round(perDay * cycShare);

    document.getElementById("hero-number").textContent = RC.fmt(cases);
    document.getElementById("fact-beddays").textContent = RC.fmt(bed);
    document.getElementById("fact-stay").textContent = (bed / cases).toFixed(1);
    document.getElementById("fact-change").textContent = RC.signedPct(((cases - cases0) / cases0) * 100).replace(/\.\d%/, "%");

    const marks = d3.select("#day-marks").html("");
    marks.selectAll("span").data(d3.range(perDay)).join("span").attr("class", (d) => (d < cycMarks ? "signal" : null));
    marks.attr("aria-label", `${perDay} marks, one for each person admitted on an average day in ${Y}; ${cycMarks} of them are pedal cyclists`);
    document.getElementById("day-caption").innerHTML =
      `About <b>${perDay} people a day</b>. Each mark is one person admitted on an average day in ${Y}; the ${cycMarks} yellow marks are pedal cyclists.`;
  } catch (e) {
    console.warn("Hero figures kept as static text:", e);
  }

  // ---- charts (each one fails on its own without stopping the others) ----
  const charts = [["q1", "q1-chart"], ["q2", "q2-chart"], ["q3", "q3-chart"], ["q4", "q4-chart"], ["q5", "q5-chart"]];
  await Promise.all(charts.map(async ([fn, id]) => {
    try { await RC[fn](); }
    catch (e) {
      console.error(fn, e);
      document.getElementById(id).innerHTML =
        `<p class="note">This chart could not load its data (${e.message}). Check that the CSV files are in the <code>data</code> folder and that the page is served over http, not opened as a file.</p>`;
    }
  }));

  // ---- chapter navigation: highlight the chapter in view ----
  const links = [...document.querySelectorAll(".nav a[href^='#']")].filter((a) => a.getAttribute("href") !== "#top");
  const sections = links.map((a) => document.querySelector(a.getAttribute("href")));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        links.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + en.target.id)));
        en.target.classList.add("in-view");
        const a = links.find((l) => l.getAttribute("href") === "#" + en.target.id);
        if (a) a.parentElement.parentElement.scrollTo({ left: Math.max(0, a.offsetLeft - 16), behavior: "smooth" });
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => s && io.observe(s));
})();

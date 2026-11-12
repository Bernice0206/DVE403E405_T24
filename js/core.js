/* Shared helpers: data loading, number formats, tooltip, theme colours, resize, "View as table". */
(function () {
  const RC = (window.RC = {});

  RC.fmt = d3.format(",");
  RC.fmt1 = d3.format(",.1f");
  RC.signed = d3.format("+,");
  RC.signedPct = (v) => (isFinite(v) ? d3.format("+.1f")(v) + "%" : "n/a");
  RC.pct1 = (v) => d3.format(".1f")(v) + "%";

  /* Column names from KNIME can carry suffixes such as "+Sum(Hospitalisations)" or "Sum(...)".
     norm() strips those so the code works with either naming style. */
  RC.norm = (k) =>
    String(k)
      .replace(/^sum\((.*)\)$/i, "$1")
      .replace(/\+sum\(.*?\)$/i, "")
      .replace(/\(#\d+\)/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  RC.pick = (row, ...names) => {
    const want = names.map(RC.norm);
    for (const k of Object.keys(row)) if (want.includes(RC.norm(k))) return row[k];
    return undefined;
  };

  /* Loads data/<name>. If the page embeds the file in <script type="text/plain" id="data:<name>">
     (used for the offline preview), that copy is used instead of a network request. */
  RC.loadCSV = async (name) => {
    const el = document.getElementById("data:" + name);
    if (el) return d3.csvParse(el.textContent.trim(), d3.autoType);
    return d3.csv("data/" + name, d3.autoType);
  };
  RC.loadJSON = async (name) => {
    const el = document.getElementById("data:" + name);
    if (el) return JSON.parse(el.textContent);
    return d3.json("data/" + name);
  };

  /* Theme colours are read from CSS custom properties so the charts follow light and dark mode. */
  RC.css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  RC.onThemeChange = (cb) => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener ? mq.addEventListener("change", cb) : mq.addListener(cb);
    new MutationObserver(cb).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  };

  /* Redraw a chart when its container changes width (debounced). */
  RC.onResize = (el, cb) => {
    let last = el.clientWidth, t;
    new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - last) < 4) return;
      last = el.clientWidth;
      clearTimeout(t);
      t = setTimeout(cb, 120);
    }).observe(el);
  };

  /* One tooltip for the whole page. Works with mouse, touch and keyboard focus. */
  const tip = () => document.getElementById("tip");
  RC.tipShow = (html, x, y) => {
    const t = tip();
    t.innerHTML = html;
    t.hidden = false;
    const r = t.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let left = x + 14, top = y + 14;
    if (left + r.width > vw - 8) left = x - r.width - 14;
    if (left < 8) left = 8;
    if (top + r.height > vh - 8) top = y - r.height - 14;
    t.style.left = left + "px";
    t.style.top = Math.max(8, top) + "px";
  };
  RC.tipHide = () => { tip().hidden = true; };
  /* Attach tooltip behaviour to a d3 selection of marks. html(d) returns the tooltip content. */
  RC.bindTip = (sel, html, onSelect) => {
    sel
      .attr("tabindex", 0)
      .on("pointerenter pointermove", (e, d) => RC.tipShow(html(d), e.clientX, e.clientY))
      .on("pointerleave", RC.tipHide)
      .on("focus", function (e, d) {
        const b = this.getBoundingClientRect();
        RC.tipShow(html(d), b.right, b.top + b.height / 2);
      })
      .on("blur", RC.tipHide);
    if (onSelect) {
      sel.on("click", (e, d) => onSelect(d)).on("keydown", (e, d) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(d); }
      });
    }
    return sel;
  };

  /* Accessible data table behind each chart. columns: [{label, value: d => ..., num: bool}] */
  RC.renderTable = (id, columns, rows) => {
    const box = document.getElementById(id);
    const table = d3.create("table");
    table.append("thead").append("tr").selectAll("th").data(columns).join("th").attr("scope", "col").text((c) => c.label);
    table.append("tbody").selectAll("tr").data(rows).join("tr")
      .selectAll("td").data((r) => columns.map((c) => ({ c, v: c.value(r) }))).join("td")
      .attr("class", (d) => (d.c.num ? "n" : null))
      .text((d) => (d.v === null || d.v === undefined || (typeof d.v === "number" && !isFinite(d.v)) ? "n.p." : d.v));
    box.replaceChildren(table.node());
  };
  RC.initTableToggles = () => {
    document.querySelectorAll(".table-toggle").forEach((btn) => {
      const box = document.getElementById(btn.dataset.table + "-table");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", box.id);
      btn.addEventListener("click", () => {
        box.hidden = !box.hidden;
        btn.setAttribute("aria-expanded", String(!box.hidden));
        btn.textContent = box.hidden ? "View as table" : "Hide table";
      });
    });
  };

  /* Wrap a label into lines no longer than maxChars (used for axis labels). */
  RC.wrap = (text, maxChars) => {
    const words = String(text).split(/\s+/), lines = [];
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > maxChars && line) { lines.push(line); line = w; }
      else line = (line + " " + w).trim();
    }
    if (line) lines.push(line);
    return lines;
  };
})();

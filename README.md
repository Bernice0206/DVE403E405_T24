# DVE403E405_T24

# Beyond the Road Toll

Interactive D3 data story about non-fatal road crash hospitalisations in Australia, 2011–2021 (COS30045 project). It has one chapter for each of research questions Q1–Q5.

## Folder structure

```
index.html            page structure and text
css/style.css         colours (light + dark), fonts, layout
js/core.js            shared helpers: CSV loading, tooltip, "View as table"
js/q1-heatmap.js      Q1 calendar heatmap (hover cells, drag/click years)
js/q2-waterfall.js    Q2 waterfall chart (Year A / Year B dropdowns)
js/q3-bubble.js       Q3 bubble scatter (Road user / Age group toggle)
js/q4-map.js          Q4 choropleth map + state side panel
js/q5-dumbbell.js     Q5 dumbbell plot (All / Remoteness / Road user / Age)
js/main.js            hero numbers, chapter navigation, starts the charts
data/                 CSV files exported from KNIME + au-states.geojson
```

## Run it locally

The charts load CSV files, so the page must be served over http. Opening `index.html` by double-clicking it will not work.

- **VS Code:** install the *Live Server* extension, right-click `index.html`, then choose **Open with Live Server**.
- **Python:** in this folder, run `python -m http.server 8000` and open http://localhost:8000.

## Deploy to Vercel

1. Push this folder to your GitHub repository.
2. In Vercel, choose **Add New → Project**, then import the repository.
3. Set **Framework Preset** to **Other**. Leave **Build Command** empty and set **Output Directory** to `.` (the project root).
4. Click **Deploy**. Every later push to the main branch redeploys the site automatically.

## Using your own KNIME exports

The files in `data/` follow the column names from the KNIME guide. If you replace them with your own exports, keep the same file names. The code accepts KNIME-style names such as `January+Sum(Hospitalisations)` or `Sum(Hospitalisations)`.

| File | Columns used |
| --- | --- |
| q1_monthly_all_years.csv | Calendar year, January … December |
| q1_national_annual.csv | Calendar year, nonfatal, bed_days, break_note |
| q2_roaduser_by_year.csv | Calendar year, Road user, Hospitalisations |
| q3_beddays_by_roaduser.csv | Road user, Hospitalisations, Bed days |
| q3_beddays_by_age.csv | Age group, Hospitalisations, Bed days, male_share |
| q4_state_annual.csv | year, state, cases, index_2013 (calculated if missing), break_note |
| q4_state_roaduser_mix.csv | state, road_user, cases, share |
| q5_fn_age.csv / q5_fn_roaduser.csv / q5_fn_remoteness.csv | year, status, age / road_user / remoteness, hosp |

## Before you submit

- Replace `Group 24 · Bernice Xin Yie LIU · Miaw Fong LIM ` and the GitHub link in the footer of `index.html`.
- State boundaries are from https://github.com/Bernice0206/DVE403E405_T24, simplified with mapshaper.
- Data source: BITRE Hospitalised Injury data, https://www.bitre.gov.au/publications/ongoing/hospitalised-injury

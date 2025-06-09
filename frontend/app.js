const API = "http://127.0.0.1:5000";
const plotDiv = document.getElementById("scatter");
let currentSelection = [];
let scatterData = null;
let predicates = null;

function renderScatter(data) {
  const defaultColor = new Array(data.x.length).fill('blue');
  const trace = {
    x: data.x,
    y: data.y,
    mode: "markers",
    type: "scattergl",
    marker: { size: 8, color: defaultColor },
  };
  Plotly.newPlot("scatter", [trace], {
    dragmode: "select",
    margin: { t: 30 },
  });

  plotDiv.on("plotly_selected", (eventData) => {
    const selected = new Array(data.x.length).fill(false);
    if (eventData) {
      eventData.points.forEach(p => selected[p.pointIndex] = true);
      currentSelection = [selected];
    }
  });
}

async function requestPredicate() {
  const response = await fetch(`${API}/predicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset: "animals5",
      subsets: currentSelection,
    }),
  });
  const result = await response.json();
  if (result.predicates && result.predicates.length > 0) {
    predicates = result.predicates;
    applyPredicates(999);
  }
}

// points are red if they are in the predicate, blue otherwise
function applyPredicates(step) {
  const clauses = predicates[step][0] || [];

  if (!scatterData) return;
  const n = scatterData.x.length;
  const colors = [];
  for (let i = 0; i < n; i++) {
    let match = true;
    for (const c of clauses) {
      const val = scatterData[c.attribute][i];
      const [low, high] = c.interval;
      if (val < low || val > high) { match = false; break; }
    }
    colors.push(match ? 'red' : 'blue');
  }
  // update colors
  Plotly.restyle(plotDiv, 'marker.color', [colors]);
  renderBarplot(clauses);
}

function renderBarplot(clauses) {
  const barDiv = document.getElementById("barplot");
  if (!clauses || clauses.length === 0) {
    Plotly.purge(barDiv);
    return;
  }
  // Each clause is a concept/attribute, show its interval as a bar
  const attributes = clauses.map(c => c.attribute);
  const lows = clauses.map(c => c.interval[0]);
  const highs = clauses.map(c => c.interval[1]);
  const widths = highs.map((hi, i) => hi - lows[i]);
  const centers = highs.map((hi, i) => (hi + lows[i]) / 2);

  const trace = {
    x: widths,
    y: attributes,
    orientation: 'h',
    base: lows,
    width: 0.6,
    type: 'bar',
    marker: { color: 'rgba(100, 150, 255, 0.7)' },
    hovertemplate: '%{y}: [%{base}, %{x+base}]<extra></extra>',
  };

  Plotly.newPlot(barDiv, [trace], {
    title: 'Predicate Clauses',
    xaxis: { title: 'Value Range', zeroline: false },
    yaxis: { title: 'Attribute', automargin: true },
    margin: { l: 120, r: 30, t: 40, b: 40 },
    height: 600,
    width: 400,
  });
}

async function fetchAndRenderDataset() {
  try {
    const response = await fetch(`${API}/get_dataset/animals5`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json(); // Expects data in { x: [...], y: [...] }
    if (!data || !Array.isArray(data.x) || !Array.isArray(data.y)) {
      throw new Error("Fetched data is not in the expected format ({ x: [...], y: [...] }).");
    }
    scatterData = data;
    renderScatter(data);
  } catch (error) {
    console.error("Failed to fetch and render initial dataset:", error);
    if (plotDiv) {
      plotDiv.innerHTML = `<p style="color: red;">Error loading dataset: ${error.message}. Please check the backend connection and data endpoint (e.g., ${API}/get_dataset/animals5).</p>`;
    }
  }
}

document.getElementById("submit").addEventListener("click", requestPredicate);


const slider = document.getElementById("mySlider");
const sliderValue = document.getElementById("sliderValue");
slider.addEventListener("input", () => {
  sliderValue.textContent = slider.value;
  applyPredicates(parseInt(slider.value - 1, 10));
});

fetchAndRenderDataset();

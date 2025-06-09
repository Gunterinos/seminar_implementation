const API = "http://127.0.0.1:5000";
const plotDiv = document.getElementById("scatter");
let currentSelection = [];
let scatterData = null;
let predicates = null;
let confusionMatrix = false;
let step = 999;
let selectedDataset = 'animals5';
let selectedAttribute = null;
const attributeSelect = document.getElementById("attribute-select");
const attributeCheckboxes = document.getElementById("attribute-checkboxes");
let selectedAttributes = [];

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
      dataset: selectedDataset,
      subsets: currentSelection,
    }),
  });
  const result = await response.json();
  if (result.predicates && result.predicates.length > 0) {
    predicates = result.predicates;
    applyPredicates();
  }
}

function updateAttributeCheckboxes(clauses) {
  // Preserve current checked state
  const prevSelected = new Set(selectedAttributes);
  attributeCheckboxes.innerHTML = '';
  // If no previous, select all by default
  if (!selectedAttributes || selectedAttributes.length === 0) {
    selectedAttributes = clauses.map(c => c.attribute);
  }
  clauses.forEach((c, idx) => {
    const label = document.createElement('label');
    label.style.marginRight = '8px';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = c.attribute;
    checkbox.checked = prevSelected.size === 0 || prevSelected.has(c.attribute);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (!selectedAttributes.includes(c.attribute)) selectedAttributes.push(c.attribute);
      } else {
        selectedAttributes = selectedAttributes.filter(attr => attr !== c.attribute);
      }
      applyPredicates();
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + c.attribute));
    attributeCheckboxes.appendChild(label);
  });
}

function applyPredicates() {
  const clauses = predicates[step][0] || [];
  updateAttributeCheckboxes(clauses);

  if (!scatterData) return;
  const n = scatterData.x.length;
  const colors = [];
  for (let i = 0; i < n; i++) {
    let match = true;
    if (selectedAttributes.length > 0) {
      for (const c of clauses) {
        if (!selectedAttributes.includes(c.attribute)) continue;
        const val = scatterData[c.attribute][i];
        const [low, high] = c.interval;
        if (val < low || val > high) { match = false; break; }
      }
    } else {
      match = false;
    }
    if (!confusionMatrix) {
      colors.push(match ? 'red' : 'blue');
    } else {
      const ma = currentSelection.some(sel => sel[i]);
      colors.push(match ? (ma ? 'purple' : 'red') : (ma ? 'blue' : 'grey'));
      // 'purple' true positive
      // 'red' false positive
      // 'blue' false negative
      // 'grey' true negative
    }
  }
  Plotly.restyle(plotDiv, 'marker.color', [colors]);
  renderBarplot(clauses);
  // Optionally, highlight regions for selected attributes (if x/y)
  const shapes = [];
  for (const c of clauses) {
    if (!selectedAttributes.includes(c.attribute)) continue;
    if (c.attribute === 'x') {
      shapes.push({
        type: 'rect', xref: 'x', yref: 'paper', x0: c.interval[0], x1: c.interval[1], y0: 0, y1: 1,
        fillcolor: 'rgba(255, 200, 0, 0.2)', line: { width: 0 }, layer: 'below'
      });
    } else if (c.attribute === 'y') {
      shapes.push({
        type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: c.interval[0], y1: c.interval[1],
        fillcolor: 'rgba(255, 200, 0, 0.2)', line: { width: 0 }, layer: 'below'
      });
    }
  }
  Plotly.relayout(plotDiv, { shapes });
}

function renderBarplot(clauses) {
  const barDiv = document.getElementById("barplot");
  // Remove any existing Plotly plot but keep the title
  const plotlyDiv = barDiv.querySelector('.js-plotly-plot');
  if (plotlyDiv) plotlyDiv.remove();
  if (!clauses || clauses.length === 0) {
    return;
  }
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

  // Create a new div for Plotly to avoid duplicating the title
  const plotDiv = document.createElement('div');
  barDiv.appendChild(plotDiv);
  Plotly.newPlot(plotDiv, [trace], {
    title: '',
    xaxis: {
      title: { text: 'Value Range', font: { size: 16, family: 'Segoe UI, Arial, sans-serif', weight: 'bold', color: '#2a3f5f' } },
      zeroline: false,
      titlefont: { size: 16, family: 'Segoe UI, Arial, sans-serif', color: '#2a3f5f', weight: 'bold' },
      automargin: true,
      title_standoff: 30
    },
    margin: { l: 120, r: 30, t: 40, b: 60 },
    height: 600,
    width: 400,
  }, {
    staticPlot: true,
    displayModeBar: false
  });
}

async function fetchAndRenderDataset() {
  try {
    const response = await fetch(`${API}/get_dataset/${selectedDataset}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    scatterData = data;
    renderScatter(data);
  } catch (error) {
    console.error("Failed to get dataset:", error);
    if (plotDiv) {
      plotDiv.innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
  }
}

document.getElementById("submit").addEventListener("click", requestPredicate);


const slider = document.getElementById("mySlider");
const stepInput = document.getElementById("stepInput");

slider.addEventListener("input", () => {
  stepInput.value = slider.value;
  step = parseInt(slider.value, 10);
  applyPredicates();
});

stepInput.addEventListener("input", () => {
  let val = parseInt(stepInput.value, 10);
  if (isNaN(val)) val = 1;
  if (val < 1) val = 1;
  if (val > 1000) val = 1000;
  slider.value = val;
  step = val;
  applyPredicates();
});

const toggleCheckbox = document.getElementById("toggle-checkbox");
const toggleLabel = document.getElementById("toggle-label");
toggleCheckbox.addEventListener("change", () => {
  const toggleState = toggleCheckbox.checked;
  toggleLabel.textContent = toggleState ? "Confusion Matrix (On)" : "Confusion Matrix (Off)";
  confusionMatrix = toggleState;
  applyPredicates();
});

const datasetSelect = document.getElementById("dataset-select");
datasetSelect.addEventListener("change", () => {
  selectedDataset = datasetSelect.value;
  fetchAndRenderDataset();
});

fetchAndRenderDataset();

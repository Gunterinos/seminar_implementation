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

function updateAttributeDropdown(clauses) {
  const currentOptions = Array.from(attributeSelect.options).map(opt => opt.value);
  const newOptions = [''].concat(clauses.map(c => c.attribute));
  const optionsChanged = currentOptions.length !== newOptions.length || currentOptions.some((v, i) => v !== newOptions[i]);
  if (!optionsChanged) return;

  attributeSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'None';
  attributeSelect.appendChild(defaultOption);
  clauses.forEach((c, idx) => {
    const option = document.createElement('option');
    option.value = c.attribute;
    option.textContent = c.attribute;
    attributeSelect.appendChild(option);
  });
  if (!selectedAttribute || !clauses.some(c => c.attribute === selectedAttribute)) {
    selectedAttribute = '';
    attributeSelect.value = '';
  } else {
    attributeSelect.value = selectedAttribute;
  }
}

attributeSelect.addEventListener('change', () => {
  selectedAttribute = attributeSelect.value;
  applyPredicates();
});

function applyPredicates() {
  const clauses = predicates[step][0] || [];
  updateAttributeDropdown(clauses);

  if (!scatterData) return;
  const n = scatterData.x.length;
  const colors = [];
  for (let i = 0; i < n; i++) {
    let match = true;
    if (selectedAttribute && selectedAttribute !== '') {
      const clause = clauses.find(c => c.attribute === selectedAttribute);
      if (clause) {
        const val = scatterData[clause.attribute][i];
        const [low, high] = clause.interval;
        match = (val >= low && val <= high);
      } else {
        match = false;
      }
    } else {
      for (const c of clauses) {
        const val = scatterData[c.attribute][i];
        const [low, high] = c.interval;
        if (val < low || val > high) { match = false; break; }
      }
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
const sliderValue = document.getElementById("sliderValue");
slider.addEventListener("input", () => {
  sliderValue.textContent = slider.value;
  step = parseInt(slider.value, 10);
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

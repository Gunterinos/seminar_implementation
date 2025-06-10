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

/**
 * Renders the main scatter plot using Plotly, with selectable points.
 * @param {Object} data - The dataset containing x, y, and feature arrays.
 */
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

/**
 * Sends a POST request to the backend to get predicate clauses for the current selection and dataset.
 * Updates the global predicates and applies them to the UI.
 */
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

/**
 * Updates the attribute checkboxes for feature selection, preserving checked state.
 * @param {Array} clauses - The predicate clauses to display as checkboxes.
 */
function updateAttributeCheckboxes(clauses) {
  const prevSelected = new Set(selectedAttributes);
  attributeCheckboxes.innerHTML = '';
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

/**
 * Applies the current predicates to the scatter plot, updating colors and overlays.
 * Also updates the attribute checkboxes and barplot.
 */
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

/**
 * Creates and returns a DOM element containing the attribute label, two sliders (low/high), and the interval value display for a predicate clause.
 * @param {Object} clause - The predicate clause object with interval and attribute.
 * @param {Array} values - The array of values for this attribute in the dataset.
 * @returns {HTMLElement} The container div for the clause sliders row.
 */
function createClauseSliderRow(clause, values) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '8px';

  const label = document.createElement('span');
  label.textContent = clause.attribute;
  label.style.width = '90px';
  label.style.fontWeight = 'bold';
  label.style.fontSize = '1rem';
  label.style.color = '#2a3f5f';

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const lowSlider = document.createElement('input');
  lowSlider.type = 'range';
  lowSlider.min = minVal;
  lowSlider.max = maxVal;
  lowSlider.step = 'any';
  lowSlider.value = clause.interval[0];
  lowSlider.style.width = '90px';
  const highSlider = document.createElement('input');
  highSlider.type = 'range';
  highSlider.min = minVal;
  highSlider.max = maxVal;
  highSlider.step = 'any';
  highSlider.value = clause.interval[1];
  highSlider.style.width = '90px';

  const valueSpan = document.createElement('span');
  valueSpan.textContent = `[${(+clause.interval[0]).toFixed(2)}, ${(+clause.interval[1]).toFixed(2)}]`;
  valueSpan.style.fontSize = '0.95rem';
  valueSpan.style.color = '#444';

  lowSlider.addEventListener('input', () => {
    let low = parseFloat(lowSlider.value);
    let high = parseFloat(highSlider.value);
    if (low > high) {
      low = high;
      lowSlider.value = high;
    }
    clause.interval[0] = low;
    valueSpan.textContent = `[${(+clause.interval[0]).toFixed(2)}, ${(+clause.interval[1]).toFixed(2)}]`;
  });
  lowSlider.addEventListener('change', () => {
    applyPredicates();
  });
  highSlider.addEventListener('input', () => {
    let low = parseFloat(lowSlider.value);
    let high = parseFloat(highSlider.value);
    if (high < low) {
      high = low;
      highSlider.value = low;
    }
    clause.interval[1] = high;
    valueSpan.textContent = `[${(+clause.interval[0]).toFixed(2)}, ${(+clause.interval[1]).toFixed(2)}]`;
  });
  highSlider.addEventListener('change', () => {
    applyPredicates();
  });
  container.appendChild(label);
  container.appendChild(lowSlider);
  container.appendChild(highSlider);
  container.appendChild(valueSpan);
  return container;
}

/**
 * Renders the barplot panel with KDE/histogram and overlays predicate intervals.
 * Also creates the Clause Sliders panel with sliders for each clause.
 * @param {Array} clauses - The predicate clauses to visualize and control.
 */
function renderBarplot(clauses) {
  const barDiv = document.getElementById("barplot");
  const plotlyDiv = barDiv.querySelector('.js-plotly-plot');
  if (plotlyDiv) plotlyDiv.remove();
  if (!clauses || clauses.length === 0) {
    return;
  }
  const attributes = clauses.map(c => c.attribute);
  const lows = clauses.map(c => c.interval[0]);
  const highs = clauses.map(c => c.interval[1]);

  const allLows = attributes.map(attr => Math.min(...scatterData[attr]));
  const allHighs = attributes.map(attr => Math.max(...scatterData[attr]));
  const globalMin = Math.min(...allLows);
  const globalMax = Math.max(...allHighs);

  const subplotTraces = [];
  const subplotLayout = {
    grid: { rows: attributes.length, columns: 1, pattern: 'independent' },
    height: 180 * attributes.length,
    width: 400,
    margin: { l: 120, r: 30, t: 40, b: 40 },
    showlegend: false,
    annotations: attributes.map((attr, i) => ({
      text: `<b>${attr.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([\w]{10,})/g, '$&<br>')}</b>`,
      x: -0.13, 
      y: 1 - (i + 0.5) / attributes.length,
      xref: 'paper',
      yref: 'paper',
      xanchor: 'right',
      yanchor: 'middle',
      showarrow: false,
      font: { size: 15, family: 'Segoe UI, Arial, sans-serif', color: '#2a3f5f' },
      align: 'right',
      borderpad: 2,
    })),
  };

  attributes.forEach((attr, i) => {
    const values = scatterData[attr];
    const min = globalMin;
    const max = globalMax;
    const binCount = 40;
    const binWidth = (max - min) / binCount;
    const bins = Array(binCount).fill(0);
    values.forEach(v => {
      const idx = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
      bins[idx] += 1;
    });
    const maxBin = Math.max(...bins);
    const kdeTrace = {
      x: bins.map((_, j) => min + j * binWidth),
      y: bins.map(b => b / maxBin),
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      fillcolor: 'rgba(100,150,255,0.15)',
      line: { color: 'rgba(100,150,255,0.5)', width: 3 },
      hoverinfo: 'skip',
      xaxis: `x${i + 1}`,
      yaxis: `y${i + 1}`,
      showlegend: false,
    };
    const clause = clauses[i];
    const rangeTrace = {
      x: [clause.interval[0], clause.interval[1], clause.interval[1], clause.interval[0], clause.interval[0]],
      y: [0, 0, 1, 1, 0],
      type: 'scatter',
      mode: 'lines',
      fill: 'toself',
      fillcolor: 'rgba(100, 150, 255, 0.5)',
      line: { color: 'rgba(100, 150, 255, 0.7)', width: 0 },
      hoverinfo: 'skip',
      xaxis: `x${i + 1}`,
      yaxis: `y${i + 1}`,
      showlegend: false,
    };
    subplotTraces.push(kdeTrace, rangeTrace);
    // Add axis titles and labels
    subplotLayout[`xaxis${i + 1}`] = {
      range: [min, max],
      showgrid: false,
      zeroline: false,
      tickfont: { size: 12 },
      titlefont: { size: 15, family: 'Segoe UI, Arial, sans-serif', color: '#2a3f5f', weight: 'bold' },
      automargin: true,
      title_standoff: 10,
    };
    subplotLayout[`yaxis${i + 1}`] = {
      range: [0, 1.05],
      showticklabels: false,
      showgrid: false,
      zeroline: false,
      fixedrange: true,
    };
  });

  Plotly.newPlot(barDiv, subplotTraces, subplotLayout, {
    staticPlot: true,
    displayModeBar: false
  });

  const slidersDiv = document.getElementById('predicate-sliders');
  if (slidersDiv) slidersDiv.innerHTML = '';
  attributes.forEach((attr, i) => {
    const clause = clauses[i];
    const values = scatterData[attr];
    const sliderRow = createClauseSliderRow(clause, values);
    if (slidersDiv) slidersDiv.appendChild(sliderRow);
  });
}

/**
 * Fetches the selected dataset from the backend and renders the scatter plot.
 * Handles errors and displays them in the UI if needed.
 */
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
  let val = parseInt(slider.value, 10);
  if (isNaN(val)) val = 0;
  if (val < 0) val = 0;
  if (val > 999) val = 999;
  slider.value = val;
  stepInput.value = val;
  step = val;
  applyPredicates();
});

stepInput.addEventListener("input", () => {
  let val = parseInt(stepInput.value, 10);
  if (isNaN(val)) val = 0;
  if (val < 0) val = 0;
  if (val > 999) val = 999;
  stepInput.value = val;
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

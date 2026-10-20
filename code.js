let graph;
let chartType = "line";
let currentGraphData;
const SAVED_GRAPHS_KEY = "data-unicorn-saved-graphs";
const PENDING_GRAPH_KEY = "data-unicorn-pending-graph";
const CHART_TYPES = ["scatter", "line", "bar", "histogram"];

// Keep the navigation button, sidebar, page content, and footer in sync.
// The sidebar's CSS class controls its slide animation; aria-expanded exposes
// the same open/closed state to assistive technology.
function toggleNav() {
  const sidebar = document.getElementById("sidebar");
  const button = document.getElementById("menuButton");
  const icon = document.getElementById("menuIcon");
  const main = document.getElementById("main");
  const footer = document.querySelector(".site-footer");
  const isOpen = sidebar.classList.toggle("is-open");

  // Shift the page content so it sits beside the open sidebar.
  button.setAttribute("aria-expanded", String(isOpen));
  main.style.marginLeft = isOpen ? "250px" : "0";
  footer.style.marginLeft = isOpen ? "250px" : "0";
  icon.textContent = isOpen ? "×" : "☰";
}

// Create one editable X/Y observation and keep its remove control accessible.
function addDataSheetRow(xValue = "", yValue = "") {
  const body = document.getElementById("data-sheet-body");
  const row = document.createElement("tr");
  const rowNumber = document.createElement("th");
  rowNumber.scope = "row";
  rowNumber.className = "data-sheet-row-number";

  const xCell = document.createElement("td");
  const yCell = document.createElement("td");
  const createCellInput = (axis, value) => {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.className = "data-sheet-cell";
    input.dataset.axis = axis;
    input.value = value;
    input.addEventListener("input", syncDataSheetInputs);
    input.addEventListener("change", generateGraph);
    return input;
  };
  xCell.append(createCellInput("x", xValue));
  yCell.append(createCellInput("y", yValue));

  const actionsCell = document.createElement("td");
  actionsCell.className = "data-sheet-actions";
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "data-sheet-remove";
  removeButton.textContent = "×";
  removeButton.addEventListener("click", () => {
    row.remove();
    if (!body.rows.length) {
      addDataSheetRow();
    }
    updateDataSheetRowLabels();
    syncDataSheetInputs();
    generateGraph();
  });
  actionsCell.append(removeButton);

  row.append(rowNumber, xCell, yCell, actionsCell);
  body.append(row);
  updateDataSheetRowLabels();
  syncDataSheetInputs();
}

// Renumber visible rows and refresh cell/button names after grid changes.
function updateDataSheetRowLabels() {
  document.querySelectorAll("#data-sheet-body tr").forEach((row, index) => {
    const rowNumber = index + 1;
    row.querySelector(".data-sheet-row-number").textContent = rowNumber;
    row.querySelectorAll(".data-sheet-cell").forEach(input => {
      const axis = input.dataset.axis.toUpperCase();
      input.setAttribute("aria-label", `Row ${rowNumber}, ${axis} value`);
    });
    row.querySelector(".data-sheet-remove")
      .setAttribute("aria-label", `Remove row ${rowNumber}`);
  });
}

// Serialize the grid columns into the hidden comma-separated fields used by graph logic.
function syncDataSheetInputs() {
  const rows = [...document.querySelectorAll("#data-sheet-body tr")];
  document.getElementById("xData").value = rows
    .map(row => row.querySelector('[data-axis="x"]').value.trim())
    .join(",");
  document.getElementById("yData").value = rows
    .map(row => row.querySelector('[data-axis="y"]').value.trim())
    .join(",");
}

// Replace every grid row, such as after a spreadsheet import or saved-graph load.
function setDataSheetValues(xValues, yValues) {
  const body = document.getElementById("data-sheet-body");
  body.replaceChildren();
  const rowCount = Math.max(xValues.length, yValues.length, 1);
  for (let index = 0; index < rowCount; index += 1) {
    addDataSheetRow(
      xValues[index] == null ? "" : String(xValues[index]),
      yValues[index] == null ? "" : String(yValues[index])
    );
  }
}

// Turn the page's default X/Y values into the first visible set of grid rows.
function initializeDataSheet() {
  const xValues = document.getElementById("xData").value.split(",");
  const yValues = document.getElementById("yData").value.split(",");
  setDataSheetValues(xValues, yValues);
}

// Validate the coordinates, redraw the selected chart, and refresh both axes' statistics.
function generateGraph() {
  // Split comma-separated input into trimmed strings before numeric validation.
  const xInput = document.getElementById("xData").value;
  const yInput = document.getElementById("yData").value;
  const error = document.getElementById("graph-error");
  const xValues = xInput.split(",").map(value => value.trim());
  const yValues = yInput.split(",").map(value => value.trim());
  const inputs = [...document.querySelectorAll(".data-sheet-cell")];
  // Show a message and mark editable cells when the input data cannot be graphed.
  const showError = message => {
    error.textContent = message;
    // Mark both fields so the error is announced and visually associated with the inputs.
    inputs.forEach(input => input.setAttribute("aria-invalid", "true"));
  };

  // Clear old validation feedback before checking the latest values.
  error.textContent = "";
  inputs.forEach(input => input.removeAttribute("aria-invalid"));

  if (xValues.length !== yValues.length) {
    showError("X and Y must contain the same number of values.");
    return;
  }

  if (xValues.some(value => value === "") || yValues.some(value => value === "")) {
    showError("Enter comma-separated numbers for both X and Y.");
    return;
  }

  // Keep each X paired with the Y value at the same position; Chart.js uses
  // these {x, y} objects directly with numeric (linear) axes.
  const points = xValues.map((x, index) => ({
    x: Number(x),
    y: Number(yValues[index])
  }));

  // Number() can produce NaN for non-numeric text and Infinity for values such
  // as "1e999". Neither is a meaningful coordinate for the chart or statistics,
  // so reject the entire data set before replacing the current graph.
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    showError("All X and Y values must be valid numbers.");
    return;
  }
  // condition for loading error
  if (typeof Chart === "undefined") {
    showError("The graphing library could not be loaded. Check your connection and try again.");
    return;
  }

  if (graph) {
    // Chart.js must release the existing canvas before another chart uses it.
    graph.destroy();
  }

  // Read the chart colors from the shared CSS palette.
  const styles = getComputedStyle(document.documentElement);
  const chartBlue = styles.getPropertyValue("--accent-blue").trim();
  const chartPurple = styles.getPropertyValue("--accent").trim();
  const chartGold = styles.getPropertyValue("--accent-gold").trim();

  const config = createChartConfig(points, chartType, {
    chartBlue,
    chartPurple,
    chartGold,
    histogramAxis: document.getElementById("histogram-axis").value
  });
  graph = new Chart(document.getElementById("myChart"), config);
  currentGraphData = {
    points,
    type: chartType,
    histogramAxis: document.getElementById("histogram-axis").value
  };

  updateStatistics(points.map(point => point.x), points.map(point => point.y));
}

// Build the Chart.js data and axes for the selected graph view.
function createChartConfig(points, type, colors) {
  const pointStyle = {
    borderColor: colors.chartBlue,
    backgroundColor: colors.chartBlue,
    pointBackgroundColor: colors.chartGold,
    pointBorderColor: colors.chartPurple,
    pointBorderWidth: 2,
    pointRadius: 5
  };
  const numericAxes = {
    x: { type: "linear", title: { display: true, text: "X" } },
    y: { type: "linear", title: { display: true, text: "Y" } }
  };

  if (type === "scatter" || type === "line") {
    return {
      type: type === "line" ? "line" : "scatter",
      data: {
        datasets: [{
          label: "Data",
          data: points,
          ...pointStyle,
          borderWidth: 3,
          showLine: type === "line",
          fill: false,
          tension: 0.2
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: numericAxes }
    };
  }

  if (type === "bar") {
    return {
      type: "bar",
      data: {
        labels: points.map(point => String(point.x)),
        datasets: [{
          label: "Y values",
          data: points.map(point => point.y),
          backgroundColor: colors.chartBlue,
          borderColor: colors.chartPurple,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: "X values" } },
          y: { beginAtZero: true, title: { display: true, text: "Y" } }
        }
      }
    };
  }

  const axis = colors.histogramAxis;
  const histogram = createHistogram(points.map(point => point[axis]));
  return {
    type: "bar",
    data: {
      labels: histogram.labels,
      datasets: [{
        label: "Frequency",
        data: histogram.counts,
        backgroundColor: colors.chartBlue,
        borderColor: colors.chartPurple,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: `${axis.toUpperCase()} value range` } },
        y: { beginAtZero: true, title: { display: true, text: "Frequency" } }
      }
    }
  };
}

// Group a numeric variable into Sturges-rule bins for a frequency histogram.
function createHistogram(values) {
  const minimum = values.reduce((current, value) => Math.min(current, value), Infinity);
  const maximum = values.reduce((current, value) => Math.max(current, value), -Infinity);
  const binCount = minimum === maximum
    ? 1
    : Math.ceil(1 + Math.log2(values.length));
  const counts = Array(binCount).fill(0);
  const scale = Math.max(Math.abs(minimum), Math.abs(maximum), Number.MIN_VALUE);
  const normalizedMinimum = minimum / scale;
  const normalizedMaximum = maximum / scale;
  const normalizedBinWidth = (normalizedMaximum - normalizedMinimum) / binCount;

  values.forEach(value => {
    const normalizedValue = value / scale;
    const bin = minimum === maximum
      ? 0
      : Math.min(
        Math.floor((normalizedValue - normalizedMinimum) / normalizedBinWidth),
        binCount - 1
      );
    counts[bin] += 1;
  });

  const labels = counts.map((_, index) => {
    const startFraction = index / binCount;
    const endFraction = (index + 1) / binCount;
    const start = minimum * (1 - startFraction) + maximum * startFraction;
    const end = index === binCount - 1
      ? maximum
      : minimum * (1 - endFraction) + maximum * endFraction;
    const formatBoundary = value => Number(value.toPrecision(5)).toString();
    return `${formatBoundary(start)}–${formatBoundary(end)}`;
  });

  return { labels, counts };
}

// Update selected-button state and redraw with the newly selected visualization.
function selectChartType(type) {
  if (!CHART_TYPES.includes(type)) {
    throw new TypeError(`Unsupported chart type: ${type}`);
  }
  chartType = type;
  document.querySelectorAll("[data-chart-type]").forEach(button => {
    const isSelected = button.dataset.chartType === type;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  document.getElementById("histogram-axis-control").hidden = type !== "histogram";
  generateGraph();
}

// Find the median of an already-sorted set by selecting its middle value(s).
function median(sortedValues) {
  const middleIndex = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
    : sortedValues[middleIndex];
}

// Calculate statistics; spread uses sample formulas and quartiles use medians of halves.
function calculateStatistics(values) {
  // Sort a copy so the original values remain available in their input order.
  const sortedValues = [...values].sort((left, right) => left - right);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  // Sample variance uses N - 1 degrees of freedom; it is undefined for one value.
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
    : null;
  const middleIndex = Math.floor(sortedValues.length / 2);
  const lowerHalf = sortedValues.slice(0, middleIndex);
  const upperHalf = sortedValues.slice(Math.ceil(sortedValues.length / 2));

  return {
    mean,
    median: median(sortedValues),
    variance,
    standardDeviation: variance === null ? null : Math.sqrt(variance),
    minimum: sortedValues[0],
    q1: lowerHalf.length ? median(lowerHalf) : sortedValues[0],
    q3: upperHalf.length ? median(upperHalf) : sortedValues[sortedValues.length - 1],
    maximum: sortedValues[sortedValues.length - 1]
  };
}

// Format the X and Y statistics and display them in the corresponding table cells.
function updateStatistics(xValues, yValues) {
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 });
  const statistics = {
    x: calculateStatistics(xValues),
    y: calculateStatistics(yValues)
  };

  // Visit X and Y separately, then update each statistic's matching table cell.
  Object.entries(statistics).forEach(([axis, values]) => {
    Object.entries(values).forEach(([name, value]) => {
      // Cell IDs use kebab-case (standardDeviation -> standard-deviation),
      // followed by the axis suffix, e.g. stat-standard-deviation-x.
      document.getElementById(`stat-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}-${axis}`)
        .textContent = value === null ? "—" : formatter.format(value);
    });
  });

  document.getElementById("visit-message").textContent =
    `Statistics calculated from ${xValues.length} plotted data points.`;
}

// Create readable spreadsheet column choices, including for blank/duplicate headers.
function populateColumnOptions(select, headers) {
  // Rebuild the selector so a new upload never leaves options from the prior file.
  select.replaceChildren();
  // Track repeated header names so every option remains understandable.
  const labelCounts = new Map();

  // Use a readable fallback for empty headers and add a count for duplicates.
  headers.forEach((header, index) => {
    const baseLabel = String(header).trim() || `Column ${index + 1}`;
    const count = (labelCounts.get(baseLabel) || 0) + 1;
    labelCounts.set(baseLabel, count);
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = count === 1 ? baseLabel : `${baseLabel} (${count})`;
    select.append(option);
  });
}

// Read the first worksheet from an uploaded CSV/Excel file and prepare its columns.
async function loadDataFile(file) {
  const status = document.getElementById("upload-status");
  const columnControls = document.getElementById("upload-columns");
  const fileInput = document.getElementById("data-file");

  // Hide stale selectors and discard old rows while the new selection is checked.
  columnControls.hidden = true;
  status.textContent = "";
  delete fileInput.dataset.rows;

  if (!file) {
    return;
  }

  // XLSX provides parsing for CSV as well as Excel workbook formats.
  if (typeof XLSX === "undefined") {
    status.textContent = "The spreadsheet reader could not be loaded. Check your connection and try again.";
    return;
  }

  // Validate by extension before reading; SheetJS can parse all three formats.
  const extension = file.name.split(".").pop().toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(extension)) {
    status.textContent = "Choose a CSV, XLSX, or XLS file.";
    return;
  }

  try {
    // File.arrayBuffer() works for local uploads and SheetJS can infer CSV/XLS formats.
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    if (!workbook.SheetNames.length) {
      status.textContent = "This workbook does not contain a worksheet.";
      return;
    }

    // Use the first sheet; row arrays preserve the source columns for selection below.
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: "",
      blankrows: false
    }).filter(row => row.some(value => String(value).trim() !== ""));

    // Expect a header row with at least two columns so X and Y can be selected.
    if (!rows.length || rows[0].length < 2) {
      status.textContent = "The first worksheet needs at least two columns, with column names in the first row.";
      return;
    }

    if (rows.length < 2) {
      status.textContent = "The first worksheet has column names but no data rows.";
      return;
    }

    // Default X to the first column and Y to the second.
    const xColumn = document.getElementById("x-column");
    const yColumn = document.getElementById("y-column");
    populateColumnOptions(xColumn, rows[0]);
    populateColumnOptions(yColumn, rows[0]);
    yColumn.selectedIndex = 1;

    fileInput.dataset.rows = JSON.stringify(rows.slice(1));
    columnControls.hidden = false;
    status.textContent = `Loaded ${rows.length - 1} data rows from the first worksheet. Select the X and Y columns.`;
  } catch (error) {
    console.error("Unable to read the selected data file.", error);
    status.textContent = "Could not read this file. Check that it is a valid CSV or Excel workbook.";
  }
}

// Copy the selected imported columns into the grid and graph the resulting pairs.
function graphSelectedColumns() {
  const fileInput = document.getElementById("data-file");
  const status = document.getElementById("upload-status");
  // The dropdown values are stored as zero-based column indexes.
  const xColumn = Number(document.getElementById("x-column").value);
  const yColumn = Number(document.getElementById("y-column").value);

  // A column cannot be plotted against itself as separate X and Y variables.
  if (xColumn === yColumn) {
    status.textContent = "Choose different columns for X and Y.";
    return;
  }

  const rows = JSON.parse(fileInput.dataset.rows || "[]");
  // Read each selected cell across all data rows. Preserve blank cells as empty
  // strings so generateGraph flags incomplete spreadsheet rows instead of
  // silently skipping them and shifting X/Y pairs out of alignment.
  const xValues = rows.map(row => row[xColumn] ?? "");
  const yValues = rows.map(row => row[yColumn] ?? "");

  setDataSheetValues(xValues, yValues);
  generateGraph();

  if (!document.getElementById("graph-error").textContent) {
    status.textContent = `Graph generated from ${xValues.length} uploaded rows.`;
  }
}

// Parse the browser's saved-graph list; callers handle malformed or unavailable storage.
function readSavedGraphs() {
  const saved = localStorage.getItem(SAVED_GRAPHS_KEY);
  return saved ? JSON.parse(saved) : [];
}

// Save the current source coordinates and display settings as a named local graph.
function saveCurrentGraph() {
  const status = document.getElementById("save-graph-status");
  const nameInput = document.getElementById("save-graph-name");

  if (!graph) {
    status.textContent = "Generate a valid graph before saving it.";
    return;
  }

  const name = nameInput.value.trim();
  if (!name) {
    status.textContent = "Enter a name for this graph.";
    nameInput.focus();
    return;
  }

  try {
    const savedGraphs = readSavedGraphs();
    savedGraphs.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      xValues: currentGraphData.points.map(point => point.x),
      yValues: currentGraphData.points.map(point => point.y),
      chartType: currentGraphData.type,
      histogramAxis: currentGraphData.histogramAxis,
      savedAt: new Date().toISOString()
    });
    localStorage.setItem(SAVED_GRAPHS_KEY, JSON.stringify(savedGraphs));
    status.textContent = `"${name}" saved in this browser.`;
    nameInput.value = "";
  } catch (error) {
    console.error("Unable to save graph in browser storage.", error);
    status.textContent = "Could not save the graph. Browser storage may be unavailable or full.";
  }
}

// Restore a graph handed off by the Saved Graphs page, then consume the handoff record.
function loadPendingGraph() {
  try {
    const pendingGraph = localStorage.getItem(PENDING_GRAPH_KEY);
    if (!pendingGraph) {
      return false;
    }

    const { xValues, yValues, chartType: savedChartType, histogramAxis } = JSON.parse(pendingGraph);
    if (!Array.isArray(xValues) || !Array.isArray(yValues) ||
        xValues.length !== yValues.length ||
        !xValues.every(Number.isFinite) || !yValues.every(Number.isFinite)) {
      throw new TypeError("Saved graph contains invalid coordinates.");
    }

    chartType = CHART_TYPES.includes(savedChartType) ? savedChartType : "line";
    localStorage.removeItem(PENDING_GRAPH_KEY);
    document.getElementById("xData").value = xValues.join(",");
    document.getElementById("yData").value = yValues.join(",");
    if (histogramAxis === "x" || histogramAxis === "y") {
      document.getElementById("histogram-axis").value = histogramAxis;
    }
    setDataSheetValues(xValues, yValues);
    return true;
  } catch (error) {
    console.error("Unable to load graph data from browser storage.", error);
    document.getElementById("graph-error").textContent =
      "Could not load the saved graph. Its browser data may be unavailable or invalid.";
    return false;
  }
}

// Wire graph-page controls and restore initial data; navigation is shared across pages.
const dataFileInput = document.getElementById("data-file");
if (dataFileInput) {
  dataFileInput.addEventListener("change", event => loadDataFile(event.target.files[0]));
  document.getElementById("graph-file-button").addEventListener("click", graphSelectedColumns);
  document.getElementById("save-graph-button").addEventListener("click", saveCurrentGraph);
  document.getElementById("add-data-row").addEventListener("click", () => addDataSheetRow());
  document.querySelectorAll("[data-chart-type]").forEach(button => {
    button.addEventListener("click", () => selectChartType(button.dataset.chartType));
  });
  document.getElementById("histogram-axis").addEventListener("change", generateGraph);

  loadPendingGraph();
  initializeDataSheet();
  document.querySelectorAll("[data-chart-type]").forEach(button => {
    const isSelected = button.dataset.chartType === chartType;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  document.getElementById("histogram-axis-control").hidden = chartType !== "histogram";
  generateGraph();
}

let graph;

function toggleLeftNav() {
  const sidebar = document.getElementById("leftSidebar");
  const button = document.getElementById("leftMenuButton");
  const icon = document.getElementById("leftMenuIcon");
  const main = document.getElementById("main");
  const footer = document.querySelector(".site-footer");
  const isOpen = sidebar.classList.toggle("is-open");

  button.setAttribute("aria-expanded", String(isOpen));
  main.style.marginLeft = isOpen ? "250px" : "0";
  footer.style.marginLeft = isOpen ? "250px" : "0";
  icon.textContent = isOpen ? "×" : "☰";
}

function toggleRightNav() {
  const sidebar = document.getElementById("rightSidebar");
  const button = document.getElementById("rightMenuButton");
  const profileIcon = document.getElementById("rightMenuIcon");
  const closeIcon = document.getElementById("rightCloseIcon");
  const isOpen = sidebar.classList.toggle("is-open");

  button.setAttribute("aria-expanded", String(isOpen));
  profileIcon.style.display = isOpen ? "none" : "block";
  closeIcon.style.display = isOpen ? "block" : "none";
}

function generateGraph() {
  const xInput = document.getElementById("xData").value;
  const yInput = document.getElementById("yData").value;
  const error = document.getElementById("graph-error");
  const xValues = xInput.split(",").map(value => value.trim());
  const yValues = yInput.split(",").map(value => value.trim());
  const inputs = [document.getElementById("xData"), document.getElementById("yData")];

  const showError = message => {
    error.textContent = message;
    inputs.forEach(input => input.setAttribute("aria-invalid", "true"));
  };

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

  const points = xValues.map((x, index) => ({
    x: Number(x),
    y: Number(yValues[index])
  }));

  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    showError("All X and Y values must be valid numbers.");
    return;
  }

  if (typeof Chart === "undefined") {
    showError("The graphing library could not be loaded. Check your connection and try again.");
    return;
  }

  if (graph) {
    graph.destroy();
  }

  const styles = getComputedStyle(document.documentElement);
  const chartBlue = styles.getPropertyValue("--accent-blue").trim();
  const chartPurple = styles.getPropertyValue("--accent").trim();
  const chartGold = styles.getPropertyValue("--accent-gold").trim();

  graph = new Chart(document.getElementById("myChart"), {
    type: "line",
    data: {
      datasets: [{
        label: "Data",
        data: points,
        borderColor: chartBlue,
        backgroundColor: chartBlue,
        borderWidth: 3,
        fill: false,
        tension: 0.2,
        pointBackgroundColor: chartGold,
        pointBorderColor: chartPurple,
        pointBorderWidth: 2,
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "X"
          }
        },
        y: {
          type: "linear",
          title: {
            display: true,
            text: "Y"
          }
        }
      }
    }
  });

  updateStatistics(points.map(point => point.x), points.map(point => point.y));
}

function quantile(sortedValues, probability) {
  const position = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const fraction = position - lowerIndex;

  return sortedValues[lowerIndex] +
    (sortedValues[upperIndex] - sortedValues[lowerIndex]) * fraction;
}

function calculateStatistics(values) {
  const sortedValues = [...values].sort((left, right) => left - right);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return {
    mean,
    median: quantile(sortedValues, 0.5),
    variance,
    standardDeviation: Math.sqrt(variance),
    minimum: sortedValues[0],
    q1: quantile(sortedValues, 0.25),
    q3: quantile(sortedValues, 0.75),
    maximum: sortedValues[sortedValues.length - 1]
  };
}

function updateStatistics(xValues, yValues) {
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 });
  const statistics = {
    x: calculateStatistics(xValues),
    y: calculateStatistics(yValues)
  };

  Object.entries(statistics).forEach(([axis, values]) => {
    Object.entries(values).forEach(([name, value]) => {
      document.getElementById(`stat-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}-${axis}`)
        .textContent = formatter.format(value);
    });
  });

  document.getElementById("visit-message").textContent =
    `Statistics calculated from ${xValues.length} plotted data points.`;
}

function populateColumnOptions(select, headers) {
  select.replaceChildren();
  const labelCounts = new Map();

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

async function loadDataFile(file) {
  const status = document.getElementById("upload-status");
  const columnControls = document.getElementById("upload-columns");
  const fileInput = document.getElementById("data-file");

  columnControls.hidden = true;
  status.textContent = "";
  delete fileInput.dataset.rows;

  if (!file) {
    return;
  }

  if (typeof XLSX === "undefined") {
    status.textContent = "The spreadsheet reader could not be loaded. Check your connection and try again.";
    return;
  }

  const extension = file.name.split(".").pop().toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(extension)) {
    status.textContent = "Choose a CSV, XLSX, or XLS file.";
    return;
  }

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    if (!workbook.SheetNames.length) {
      status.textContent = "This workbook does not contain a worksheet.";
      return;
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: "",
      blankrows: false
    }).filter(row => row.some(value => String(value).trim() !== ""));

    if (!rows.length || rows[0].length < 2) {
      status.textContent = "The first worksheet needs at least two columns, with column names in the first row.";
      return;
    }

    if (rows.length < 2) {
      status.textContent = "The first worksheet has column names but no data rows.";
      return;
    }

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

function graphSelectedColumns() {
  const fileInput = document.getElementById("data-file");
  const status = document.getElementById("upload-status");
  const xColumn = Number(document.getElementById("x-column").value);
  const yColumn = Number(document.getElementById("y-column").value);

  if (xColumn === yColumn) {
    status.textContent = "Choose different columns for X and Y.";
    return;
  }

  const rows = JSON.parse(fileInput.dataset.rows || "[]");
  const xValues = rows.map(row => row[xColumn] ?? "");
  const yValues = rows.map(row => row[yColumn] ?? "");

  document.getElementById("xData").value = xValues.join(",");
  document.getElementById("yData").value = yValues.join(",");
  generateGraph();

  if (!document.getElementById("graph-error").textContent) {
    status.textContent = `Graph generated from ${xValues.length} uploaded rows.`;
  }
}

document.getElementById("data-file").addEventListener("change", event => {
  return loadDataFile(event.target.files[0]);
});
document.getElementById("graph-file-button").addEventListener("click", graphSelectedColumns);

generateGraph();

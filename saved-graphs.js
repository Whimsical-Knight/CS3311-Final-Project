const SAVED_GRAPHS_STORAGE_KEY = "data-unicorn-saved-graphs";
const PENDING_GRAPH_STORAGE_KEY = "data-unicorn-pending-graph";

const graphsList = document.getElementById("saved-graphs-list");
const emptyState = document.getElementById("saved-graphs-empty");
const statusMessage = document.getElementById("saved-graphs-status");

// Read and validate the locally stored list before using its graph records.
function readGraphs() {
  const graphs = JSON.parse(localStorage.getItem(SAVED_GRAPHS_STORAGE_KEY) || "[]");
  if (!Array.isArray(graphs)) {
    throw new TypeError("Saved graph storage must contain a list.");
  }
  if (graphs.some(graph =>
    !graph || typeof graph.id !== "string" || typeof graph.name !== "string" ||
    !Array.isArray(graph.xValues) || !Array.isArray(graph.yValues) ||
    graph.xValues.length !== graph.yValues.length
  )) {
    throw new TypeError("Saved graph storage contains an invalid graph.");
  }
  return graphs;
}

// Build one safe, accessible card with graph details and its available actions.
function makeGraphCard(graph) {
  const card = document.createElement("article");
  card.className = "saved-graph-card";

  const heading = document.createElement("h2");
  heading.textContent = graph.name;

  const date = document.createElement("p");
  date.className = "saved-graph-date";
  const savedDate = new Date(graph.savedAt);
  date.textContent = Number.isNaN(savedDate.getTime())
    ? "Saved date unavailable"
    : `Saved ${savedDate.toLocaleString()}`;

  const detail = document.createElement("p");
  detail.textContent = `${graph.xValues.length} plotted data points`;

  const chartType = document.createElement("p");
  chartType.className = "saved-graph-type";
  const chartTypes = {
    scatter: "Scatter plot",
    line: "Line chart",
    bar: "Bar chart",
    histogram: `Histogram of ${(graph.histogramAxis || "x").toUpperCase()} values`
  };
  chartType.textContent = chartTypes[graph.chartType] || "Line chart";

  const actions = document.createElement("div");
  actions.className = "page-actions";

  const loadButton = document.createElement("button");
  loadButton.className = "primary-button";
  loadButton.type = "button";
  loadButton.dataset.action = "load";
  loadButton.dataset.graphId = graph.id;
  loadButton.textContent = "Open graph";

  const deleteButton = document.createElement("button");
  deleteButton.className = "secondary-button";
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.dataset.graphId = graph.id;
  deleteButton.textContent = "Delete";

  actions.append(loadButton, deleteButton);
  card.append(heading, date, detail, chartType, actions);
  return card;
}

// Render every saved graph, or show a useful message if storage is invalid.
function renderGraphs() {
  try {
    const graphs = readGraphs();
    graphsList.replaceChildren(...graphs.map(makeGraphCard));
    emptyState.hidden = graphs.length > 0;
    statusMessage.textContent = graphs.length
      ? `${graphs.length} saved ${graphs.length === 1 ? "graph" : "graphs"}.`
      : "";
  } catch (error) {
    console.error("Unable to read saved graphs from browser storage.", error);
    graphsList.replaceChildren();
    emptyState.hidden = true;
    statusMessage.textContent = "Could not read saved graphs. Browser storage may be unavailable or invalid.";
  }
}

// Handle open/delete actions from any graph card using one delegated listener.
graphsList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  try {
    const graphs = readGraphs();
    const selectedGraph = graphs.find(graph => graph.id === button.dataset.graphId);
    if (!selectedGraph) {
      statusMessage.textContent = "That saved graph could not be found.";
      renderGraphs();
      return;
    }

    if (button.dataset.action === "load") {
      if (!Array.isArray(selectedGraph.xValues) || !Array.isArray(selectedGraph.yValues) ||
          selectedGraph.xValues.length !== selectedGraph.yValues.length) {
        statusMessage.textContent = "This saved graph has invalid coordinate data.";
        return;
      }
      localStorage.setItem(PENDING_GRAPH_STORAGE_KEY, JSON.stringify(selectedGraph));
      window.location.href = "index.html";
      return;
    }

    if (button.dataset.action === "delete") {
      localStorage.setItem(SAVED_GRAPHS_STORAGE_KEY, JSON.stringify(
        graphs.filter(graph => graph.id !== selectedGraph.id)
      ));
      renderGraphs();
      statusMessage.textContent = `"${selectedGraph.name}" was deleted.`;
    }
  } catch (error) {
    console.error("Unable to update saved graphs in browser storage.", error);
    statusMessage.textContent = "Could not update saved graphs. Browser storage may be unavailable.";
  }
});

// Populate the saved-graphs page when its script loads.
renderGraphs();

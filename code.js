let graph;

function toggleLeftNav() {
  const sidebar = document.getElementById("leftSidebar");
  const button = document.getElementById("leftMenuButton");
  const icon = document.getElementById("leftMenuIcon");
  const main = document.getElementById("main");
  const isOpen = sidebar.classList.toggle("is-open");

  button.setAttribute("aria-expanded", String(isOpen));
  main.style.marginLeft = isOpen ? "250px" : "0";
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
}

generateGraph();

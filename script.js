document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("starCanvas");
  const ctx = canvas.getContext("2d");
  const toggleAddEdgeModeButton = document.getElementById(
    "toggleAddEdgeModeButton"
  );
  const runAlgorithmButton = document.getElementById("runAlgorithmButton");
  const resetButton = document.getElementById("resetButton");
  const undoButton = document.getElementById("undoButton");
  const starCountSpan = document.getElementById("starCount");
  const algorithmCostSpan = document.getElementById("algorithmCost");
  const instructionText = document.getElementById("instructionText");
  const subtitleTextElement = document.getElementById("subtitleText");
  const footerAlgorithmTextElement = document.getElementById(
    "footerAlgorithmText"
  );
  const costLabelParagraphElement =
    document.getElementById("costLabelParagraph");

  const algorithmRadios = document.querySelectorAll('input[name="algorithm"]');
  let currentAlgorithm = "MST";

  let stars = [];
  let nextStarId = 1;
  let userEdges = [];
  let nextEdgeId = 0;

  let activeMstEdges = [];
  let activeRejectedCycleEdges = [];
  let activeShortestPath = [];
  let activeTspTour = [];

  let selectedStar1Id = null;
  let selectedStar2Id = null;
  let selectingMode = null;
  let isAddingEdgeMode = false;
  let lastActionStack = [];

  const STAR_RADIUS = 6;
  const STAR_GLOW_RADIUS = STAR_RADIUS + 4;
  const STAR_COLOR_CORE = "white";
  const STAR_COLOR_HALO = "#ADD8E6";
  const STAR_GLOW_COLOR = "rgba(173, 216, 230, 0.3)";
  const SELECTED_STAR_COLOR_1 = "rgba(255, 255, 0, 0.9)";
  const SELECTED_STAR_COLOR_2 = "rgba(255, 165, 0, 0.9)";

  const USER_EDGE_COLOR = "rgba(180, 180, 220, 0.7)";
  const USER_EDGE_WIDTH = 1.8;
  const USER_EDGE_DASH = [];

  const MST_LINE_COLOR = "#39ff14";
  const MST_LINE_WIDTH = 2.5;
  const REJECTED_CYCLE_EDGE_COLOR = "rgba(255, 60, 60, 0.7)";
  const REJECTED_CYCLE_EDGE_WIDTH = 1.5;
  const REJECTED_CYCLE_EDGE_DASH = [5, 5];

  const SP_PATH_COLOR = "#00FFFF";
  const SP_PATH_WIDTH = 3;
  const TSP_TOUR_COLOR = "#FF00FF";
  const TSP_TOUR_WIDTH = 3;

  const COORDINATE_TEXT_COLOR = "#c0c0ff";
  const COORDINATE_TEXT_FONT = "10px 'Roboto', sans-serif";
  const COORDINATE_OFFSET_Y = 15;
  const COORDINATE_OFFSET_X = 0;
  const EDGE_WEIGHT_TEXT_COLOR = "#e0e0ff";
  const EDGE_WEIGHT_TEXT_FONT = "9px 'Roboto', sans-serif";
  const EDGE_WEIGHT_BACKGROUND_COLOR = "rgba(30, 30, 50, 0.7)";
  const EDGE_WEIGHT_PADDING = 2;

  // --- EVENT LISTENERS ---
  canvas.addEventListener("click", handleCanvasClick);
  toggleAddEdgeModeButton.addEventListener("click", toggleAddEdgeMode);
  runAlgorithmButton.addEventListener("click", handleRunAlgorithm);
  resetButton.addEventListener("click", handleReset);
  undoButton.addEventListener("click", handleUndo);

  algorithmRadios.forEach((radio) => {
    radio.addEventListener("change", (event) => {
      currentAlgorithm = event.target.value;
      exitAddEdgeMode();
      selectedStar1Id = null; // Eksplisit reset
      selectedStar2Id = null;
      selectingMode = null;
      resetAlgorithmState(false, false);
      prepareForAlgorithmSelection();
      updateUITexts();
      redrawCanvas();
      updateInfoPanel();
      updateButtonStates();
    });
  });

  // --- HANDLERS & LOGIC ---
  function toggleAddEdgeMode() {
    isAddingEdgeMode = !isAddingEdgeMode;
    if (isAddingEdgeMode) {
      toggleAddEdgeModeButton.textContent = "Selesai Edge";
      toggleAddEdgeModeButton.style.backgroundColor = "#ffc107";
      selectedStar1Id = null;
      selectedStar2Id = null;
      selectingMode = "ADD_EDGE_START";
      instructionText.textContent = "Mode Tambah Edge: Klik bintang PERTAMA.";
    } else {
      exitAddEdgeMode();
    }
    redrawCanvas();
    updateButtonStates();
  }

  function exitAddEdgeMode() {
    isAddingEdgeMode = false;
    toggleAddEdgeModeButton.textContent = "Tambah Edge";
    toggleAddEdgeModeButton.style.backgroundColor = "";
    if (
      selectingMode === "ADD_EDGE_START" ||
      selectingMode === "ADD_EDGE_END"
    ) {
      selectedStar1Id = null; // Hanya clear S1 jika itu untuk edge
      selectingMode = null;
    }
    prepareForAlgorithmSelection();
  }

  function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const clickedStar = stars.find(
      (star) =>
        calculateDistance({ x: clickX, y: clickY }, star) < STAR_RADIUS * 2.5
    );

    if (isAddingEdgeMode) {
      if (clickedStar) {
        handleAddEdgeSelection(clickedStar);
      } else {
        instructionText.textContent = "Mode Tambah Edge: Klik pada BINTANG.";
      }
    } else if (selectingMode && clickedStar) {
      handleStarSelectionForAlgorithm(clickedStar);
    } else {
      if (!clickedStar) {
        const tooClose = stars.some(
          (star) =>
            calculateDistance({ x: clickX, y: clickY }, star) <
            STAR_RADIUS * 3.5
        );
        if (tooClose) {
          showTemporaryMessage("Bintang terlalu dekat!");
          return;
        }
        const newStar = { x: clickX, y: clickY, id: nextStarId++ };
        stars.push(newStar);
        lastActionStack.push({ type: "star", id: newStar.id });
        selectedStar1Id = null; // Reset seleksi SP/TSP saat bintang baru
        selectedStar2Id = null;
        selectingMode = null;
        resetAlgorithmState(false, false);
        prepareForAlgorithmSelection();
        redrawCanvas();
        updateInfoPanel();
        updateButtonStates();
      }
    }
  }

  function handleAddEdgeSelection(star) {
    if (selectingMode === "ADD_EDGE_START") {
      selectedStar1Id = star.id;
      selectingMode = "ADD_EDGE_END";
      instructionText.textContent = "Mode Tambah Edge: Klik bintang KEDUA.";
    } else if (selectingMode === "ADD_EDGE_END") {
      if (star.id === selectedStar1Id) {
        showTemporaryMessage("Tidak bisa hubungkan ke diri sendiri!");
        return;
      }
      const edgeExists = userEdges.some(
        (e) =>
          (e.node1Id === selectedStar1Id && e.node2Id === star.id) ||
          (e.node1Id === star.id && e.node2Id === selectedStar1Id)
      );
      if (edgeExists) {
        showTemporaryMessage("Edge sudah ada!");
      } else {
        const newEdge = {
          id: nextEdgeId++,
          node1Id: selectedStar1Id,
          node2Id: star.id,
          weight: calculateDistance(
            stars.find((s) => s.id === selectedStar1Id),
            star
          ),
        };
        userEdges.push(newEdge);
        lastActionStack.push({ type: "edge", id: newEdge.id, data: newEdge });
      }
      selectedStar1Id = null; // Reset untuk edge berikutnya
      selectingMode = "ADD_EDGE_START";
      instructionText.textContent =
        "Mode Tambah Edge: Klik bintang PERTAMA. (Atau 'Selesai Edge')";
    }
    redrawCanvas();
    updateButtonStates();
  }

  function handleStarSelectionForAlgorithm(star) {
    if (isAddingEdgeMode) return;

    if (selectingMode === "SP_START") {
      selectedStar1Id = star.id;
      selectingMode = "SP_END";
      instructionText.textContent = "Klik bintang AKHIR untuk Shortest Path.";
    } else if (selectingMode === "SP_END") {
      if (star.id === selectedStar1Id) {
        showTemporaryMessage("Bintang akhir tidak boleh sama!");
        return;
      }
      selectedStar2Id = star.id;
      selectingMode = null; // Selesai memilih
      instructionText.textContent =
        "Tekan '" + runAlgorithmButton.textContent + "'.";
    } else if (selectingMode === "TSP_START") {
      selectedStar1Id = star.id;
      selectingMode = null; // Selesai memilih
      instructionText.textContent =
        "Tekan '" + runAlgorithmButton.textContent + "'.";
    }
    redrawCanvas();
    updateButtonStates();
  }

  function handleRunAlgorithm() {
    if (
      currentAlgorithm !== "TSP" &&
      userEdges.length === 0 &&
      !(currentAlgorithm === "TSP" && stars.length === 1)
    ) {
      alert("Tidak ada edge yang dibuat untuk menjalankan algoritma ini!");
      return;
    }
    if (isAddingEdgeMode) {
      exitAddEdgeMode();
    }
    // Hasil algoritma sebelumnya akan di-clear oleh resetAlgorithmState di awal fungsi animasi
    // resetAlgorithmState(false, true); // Tidak perlu di sini, biarkan seleksi apa adanya

    let selectionError = false;

    if (currentAlgorithm === "MST") {
      if (stars.length < 1) {
        alert("Butuh bintang untuk MST");
        selectionError = true;
      } else {
        resetAlgorithmState(false, true); // Clear prev results, keep selection (MST doesn't use selection)
        const { mst, rejected } = calculateKruskalMST(stars, userEdges);
        activeMstEdges = mst;
        activeRejectedCycleEdges = rejected;
        animateMstLines();
      }
    } else if (currentAlgorithm === "SP") {
      if (!selectedStar1Id || !selectedStar2Id) {
        console.log(
          "SP selection not complete:",
          selectedStar1Id,
          selectedStar2Id
        );
        alert("Pilih bintang awal DAN akhir untuk Shortest Path!");
        selectionError = true;
        prepareForAlgorithmSelection(); // Panggil lagi untuk memandu
      } else if (stars.length < 2) {
        alert("Butuh setidaknya 2 bintang untuk Shortest Path!");
        selectionError = true;
      } else {
        resetAlgorithmState(false, true); // Clear prev results, keep current SP selection
        activeShortestPath = calculateDijkstraSP(
          stars,
          userEdges,
          selectedStar1Id,
          selectedStar2Id
        );
        animateShortestPath();
      }
    } else if (currentAlgorithm === "TSP") {
      let startNodeForTsp = selectedStar1Id;
      if (!startNodeForTsp && stars.length > 0) {
        startNodeForTsp = stars[0].id; // Default ke bintang pertama
      }

      if (stars.length < 1) {
        alert("Butuh setidaknya 1 bintang untuk TSP Tour!");
        selectionError = true;
      } else if (!startNodeForTsp && stars.length > 0) {
        // Jika setelah default masih tidak ada start node
        alert("Gagal menentukan bintang awal untuk TSP!");
        selectionError = true;
        prepareForAlgorithmSelection();
      } else {
        resetAlgorithmState(false, true); // Clear prev results, keep current TSP selection (startNode)
        activeTspTour = calculateNearestNeighborTSP(
          stars,
          userEdges,
          startNodeForTsp
        );
        animateTspTour();
      }
    }

    if (!selectionError) {
      instructionText.textContent = "";
    }
    // updateButtonStates(); // Dipanggil oleh enableButtonsAfterAnimation
  }

  function handleReset() {
    stars = [];
    nextStarId = 0;
    userEdges = [];
    nextEdgeId = 0;
    lastActionStack = [];
    exitAddEdgeMode();
    resetAlgorithmState(true, false); // Reset semua, termasuk seleksi
    clearCanvasAndShowPlaceholder();
    updateInfoPanel();
    updateButtonStates();
    prepareForAlgorithmSelection();
  }

  function handleUndo() {
    if (lastActionStack.length === 0) {
      showTemporaryMessage("Tidak ada untuk diurungkan.");
      return;
    }
    const lastAction = lastActionStack.pop();
    const s1Temp = selectedStar1Id;
    const s2Temp = selectedStar2Id;
    const currentSelectingModeTemp = selectingMode;
    const wasAddingEdge = isAddingEdgeMode;

    exitAddEdgeMode();
    resetAlgorithmState(false, true); // keepSelection = true

    if (lastAction.type === "star") {
      const undoneStarId = lastAction.id;
      stars = stars.filter((star) => star.id !== undoneStarId);
      userEdges = userEdges.filter(
        (edge) => edge.node1Id !== undoneStarId && edge.node2Id !== undoneStarId
      );
      if (s1Temp === undoneStarId) selectedStar1Id = null;
      else selectedStar1Id = s1Temp;
      if (s2Temp === undoneStarId) selectedStar2Id = null;
      else selectedStar2Id = s2Temp;
    } else if (lastAction.type === "edge") {
      userEdges = userEdges.filter((edge) => edge.id !== lastAction.id);
      selectedStar1Id = s1Temp;
      selectedStar2Id = s2Temp;
    }

    if (
      !wasAddingEdge &&
      currentSelectingModeTemp &&
      (currentAlgorithm === "SP" || currentAlgorithm === "TSP")
    ) {
      selectingMode = currentSelectingModeTemp;
    }

    prepareForAlgorithmSelection();
    redrawCanvas();
    updateInfoPanel();
    updateButtonStates();
    if (stars.length === 0 && userEdges.length === 0) {
      clearCanvasAndShowPlaceholder();
    }
  }

  function resetAlgorithmState(resetUserEdges = true, keepSelection = false) {
    activeMstEdges = [];
    activeRejectedCycleEdges = [];
    activeShortestPath = [];
    activeTspTour = [];
    if (resetUserEdges) {
      userEdges = [];
      nextEdgeId = 0;
    }
    if (!keepSelection) {
      selectedStar1Id = null;
      selectedStar2Id = null;
      if (!isAddingEdgeMode) {
        selectingMode = null;
      }
    }
  }

  function prepareForAlgorithmSelection() {
    instructionText.textContent = "";
    if (isAddingEdgeMode) {
      selectingMode = selectedStar1Id ? "ADD_EDGE_END" : "ADD_EDGE_START";
      instructionText.textContent =
        selectingMode === "ADD_EDGE_START"
          ? "Mode Tambah Edge: Klik bintang PERTAMA."
          : "Mode Tambah Edge: Klik bintang KEDUA.";
    } else {
      selectingMode = null; // Selalu reset untuk SP/TSP lalu set jika perlu
      if (currentAlgorithm === "SP") {
        if (!selectedStar1Id) {
          selectingMode = "SP_START";
          instructionText.textContent =
            "Klik bintang AWAL untuk Shortest Path.";
        } else if (!selectedStar2Id) {
          selectingMode = "SP_END";
          instructionText.textContent =
            "Klik bintang AKHIR untuk Shortest Path.";
        } else {
          // Keduanya sudah dipilih
          instructionText.textContent =
            "Tekan '" + runAlgorithmButton.textContent + "'.";
        }
      } else if (currentAlgorithm === "TSP") {
        if (!selectedStar1Id && stars.length > 0) {
          selectingMode = "TSP_START";
          instructionText.textContent = "Klik bintang AWAL untuk TSP Tour.";
        } else if (selectedStar1Id || stars.length === 0) {
          // Start sudah dipilih atau tidak ada bintang
          if (stars.length > 0) {
            // Hanya tampilkan jika ada bintang
            instructionText.textContent =
              "Tekan '" + runAlgorithmButton.textContent + "'.";
          }
        }
      }
    }
    redrawCanvas();
    updateButtonStates(); // Panggil setelah prepare agar tombol konsisten
  }

  function updateUITexts() {
    let subtitle = "";
    let footerText = "";
    let runBtnText = "Jalankan";
    if (currentAlgorithm === "MST") {
      subtitle = "MST Visualizer";
      footerText = "Kruskal's for MST.";
      runBtnText = "Hitung MST";
    } else if (currentAlgorithm === "SP") {
      subtitle = "Shortest Path (Dijkstra)";
      footerText = "Dijkstra's for SP.";
      runBtnText = "Cari Jalur";
    } else if (currentAlgorithm === "TSP") {
      subtitle = "TSP (Nearest Neighbor)";
      footerText = "Nearest Neighbor for TSP.";
      runBtnText = "Cari Tur";
    }
    subtitleTextElement.textContent = subtitle;
    footerAlgorithmTextElement.textContent = footerText;
    runAlgorithmButton.textContent = runBtnText;
    runAlgorithmButton.title = runBtnText;
  }

  // --- DRAWING FUNCTIONS ---
  function redrawCanvas() {
    clearCanvas();
    drawStars();
    drawEdges(
      userEdges,
      USER_EDGE_COLOR,
      USER_EDGE_WIDTH,
      USER_EDGE_DASH,
      true
    );
    drawEdges(
      activeRejectedCycleEdges,
      REJECTED_CYCLE_EDGE_COLOR,
      REJECTED_CYCLE_EDGE_WIDTH,
      REJECTED_CYCLE_EDGE_DASH,
      true
    );
    drawEdges(activeMstEdges, MST_LINE_COLOR, MST_LINE_WIDTH, [], true);
    drawPath(activeShortestPath, SP_PATH_COLOR, SP_PATH_WIDTH, true);
    drawPath(activeTspTour, TSP_TOUR_COLOR, TSP_TOUR_WIDTH, true);
  }

  function drawStars() {
    stars.forEach((star) => {
      let specialColor = null;
      if (star.id === selectedStar1Id) {
        specialColor = SELECTED_STAR_COLOR_1;
      } else if (
        star.id === selectedStar2Id &&
        currentAlgorithm === "SP" &&
        !isAddingEdgeMode
      ) {
        if (
          selectingMode === "SP_END" ||
          (selectingMode === null && selectedStar1Id && selectedStar2Id)
        ) {
          specialColor = SELECTED_STAR_COLOR_2;
        }
      }
      drawSingleStar(star, specialColor);
    });
  }

  function drawSingleStar(star, specialColor = null) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, STAR_GLOW_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = STAR_GLOW_COLOR;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(star.x, star.y, STAR_RADIUS + 1, 0, 2 * Math.PI);
    const hg = ctx.createRadialGradient(
      star.x,
      star.y,
      STAR_RADIUS / 3,
      star.x,
      star.y,
      STAR_RADIUS + 1
    );
    hg.addColorStop(0, STAR_COLOR_HALO);
    hg.addColorStop(1, "rgba(173, 216, 230, 0.5)");
    ctx.fillStyle = hg;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(star.x, star.y, STAR_RADIUS / 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = specialColor ? specialColor : STAR_COLOR_CORE;
    ctx.fill();

    if (specialColor) {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = COORDINATE_TEXT_COLOR;
    ctx.font = COORDINATE_TEXT_FONT;
    ctx.textAlign = "center";
    const ct = `(${star.x.toFixed(0)}, ${star.y.toFixed(0)})`;
    let ty = star.y - STAR_GLOW_RADIUS - COORDINATE_OFFSET_Y + 8;
    let tx = star.x + COORDINATE_OFFSET_X;
    if (ty < 12) {
      ty = star.y + STAR_GLOW_RADIUS + COORDINATE_OFFSET_Y;
    }
    ctx.fillText(ct, tx, ty);
  }

  function drawEdges(
    edges,
    color,
    width,
    dashPattern = [],
    showWeight = false
  ) {
    if (!edges || edges.length === 0) {
      return;
    }
    edges.forEach((edge) => {
      const s1 = stars.find((s) => s.id === edge.node1Id);
      const s2 = stars.find((s) => s.id === edge.node2Id);
      if (s1 && s2) {
        drawStaticLine(s1, s2, color, width, dashPattern);
        if (showWeight) {
          drawEdgeWeight(s1, s2, edge.weight.toFixed(0));
        }
      }
    });
  }

  function drawPath(pathStarIds, color, width, showWeight = false) {
    if (!pathStarIds || pathStarIds.length < 2) {
      return;
    }
    for (let i = 0; i < pathStarIds.length - 1; i++) {
      const s1 = stars.find((s) => s.id === pathStarIds[i]);
      const s2 = stars.find((s) => s.id === pathStarIds[i + 1]);
      if (s1 && s2) {
        drawStaticLine(s1, s2, color, width);
        if (showWeight) {
          const edge = userEdges.find(
            (e) =>
              (e.node1Id === s1.id && e.node2Id === s2.id) ||
              (e.node1Id === s2.id && e.node2Id === s1.id)
          );
          if (edge) {
            drawEdgeWeight(s1, s2, edge.weight.toFixed(0));
          }
        }
      }
    }
  }

  // --- ANIMASI (MST, SP, TSP) ---
  function animateMstLines() {
    runAlgorithmButton.disabled = true;
    undoButton.disabled = true;
    resetButton.disabled = true;
    clearCanvas();
    drawStars();
    drawEdges(
      userEdges,
      USER_EDGE_COLOR,
      USER_EDGE_WIDTH,
      USER_EDGE_DASH,
      true
    );
    drawEdges(
      activeRejectedCycleEdges,
      REJECTED_CYCLE_EDGE_COLOR,
      REJECTED_CYCLE_EDGE_WIDTH,
      REJECTED_CYCLE_EDGE_DASH,
      true
    );

    if (activeMstEdges.length === 0) {
      if (stars.length >= 1 && userEdges.length > 0) {
        console.warn("No MST edges found.");
      } else if (stars.length >= 1) {
        console.warn("No edges to form MST.");
      }
      updateInfoPanel("MST");
      enableButtonsAfterAnimation();
      return;
    }
    let edgeIndex = 0;
    let animationStartTime;
    const DURATION_PER_LINE = 250;
    const DELAY_BETWEEN_LINES_MST = 80;

    function animateFrame(currentTime) {
      if (!animationStartTime) animationStartTime = currentTime;
      const elapsedTime = currentTime - animationStartTime;
      let progress = Math.min(elapsedTime / DURATION_PER_LINE, 1);

      clearCanvas();
      drawStars();
      drawEdges(
        userEdges,
        USER_EDGE_COLOR,
        USER_EDGE_WIDTH,
        USER_EDGE_DASH,
        true
      );
      drawEdges(
        activeRejectedCycleEdges,
        REJECTED_CYCLE_EDGE_COLOR,
        REJECTED_CYCLE_EDGE_WIDTH,
        REJECTED_CYCLE_EDGE_DASH,
        true
      );

      for (let i = 0; i < edgeIndex; i++) {
        const prevEdge = activeMstEdges[i];
        const prevStar1 = stars.find((s) => s.id === prevEdge.node1Id);
        const prevStar2 = stars.find((s) => s.id === prevEdge.node2Id);
        if (prevStar1 && prevStar2) {
          drawStaticLine(prevStar1, prevStar2, MST_LINE_COLOR, MST_LINE_WIDTH);
          drawEdgeWeight(prevStar1, prevStar2, prevEdge.weight.toFixed(0));
        }
      }
      const currentAnimatingEdge = activeMstEdges[edgeIndex];
      const star1 = stars.find((s) => s.id === currentAnimatingEdge.node1Id);
      const star2 = stars.find((s) => s.id === currentAnimatingEdge.node2Id);
      if (star1 && star2) {
        const currentX = star1.x + (star2.x - star1.x) * progress;
        const currentY = star1.y + (star2.y - star1.y) * progress;
        drawStaticLine(
          { x: star1.x, y: star1.y },
          { x: currentX, y: currentY },
          MST_LINE_COLOR,
          MST_LINE_WIDTH
        );
        if (progress > 0.5)
          drawEdgeWeight(
            star1,
            { x: currentX, y: currentY },
            currentAnimatingEdge.weight.toFixed(0)
          );
      }
      if (progress < 1) {
        requestAnimationFrame(animateFrame);
      } else {
        if (star1 && star2) {
          drawStaticLine(star1, star2, MST_LINE_COLOR, MST_LINE_WIDTH);
          drawEdgeWeight(star1, star2, currentAnimatingEdge.weight.toFixed(0));
        }
        edgeIndex++;
        if (edgeIndex < activeMstEdges.length) {
          animationStartTime = null;
          setTimeout(
            () => requestAnimationFrame(animateFrame),
            DELAY_BETWEEN_LINES_MST
          );
        } else {
          console.log("MST animation done.");
          updateInfoPanel("MST");
          enableButtonsAfterAnimation();
        }
      }
    }
    requestAnimationFrame(animateFrame);
  }

  function animateShortestPath() {
    runAlgorithmButton.disabled = true;
    undoButton.disabled = true;
    resetButton.disabled = true;
    clearCanvas();
    drawStars();
    drawEdges(
      userEdges,
      USER_EDGE_COLOR,
      USER_EDGE_WIDTH,
      USER_EDGE_DASH,
      true
    );
    if (activeShortestPath.length < 2) {
      console.warn("No SP.");
      showTemporaryMessage("Tidak ada jalur ditemukan!");
      updateInfoPanel("SP");
      enableButtonsAfterAnimation();
      redrawCanvas();
      return;
    }
    let segmentIndex = 0;
    let animationStartTime;
    const DURATION_PER_SEGMENT = 300;
    const DELAY_BETWEEN_SEGMENTS = 100;
    function animateFrame(currentTime) {
      if (!animationStartTime) animationStartTime = currentTime;
      const elapsedTime = currentTime - animationStartTime;
      let progress = Math.min(elapsedTime / DURATION_PER_SEGMENT, 1);
      clearCanvas();
      drawStars();
      drawEdges(
        userEdges,
        USER_EDGE_COLOR,
        USER_EDGE_WIDTH,
        USER_EDGE_DASH,
        true
      );
      for (let i = 0; i < segmentIndex; i++) {
        const starA = stars.find((s) => s.id === activeShortestPath[i]);
        const starB = stars.find((s) => s.id === activeShortestPath[i + 1]);
        if (starA && starB) {
          drawStaticLine(starA, starB, SP_PATH_COLOR, SP_PATH_WIDTH);
          const edge = userEdges.find(
            (e) =>
              (e.node1Id === starA.id && e.node2Id === starB.id) ||
              (e.node1Id === starB.id && e.node2Id === starA.id)
          );
          if (edge) drawEdgeWeight(starA, starB, edge.weight.toFixed(0));
        }
      }
      const star1 = stars.find(
        (s) => s.id === activeShortestPath[segmentIndex]
      );
      const star2 = stars.find(
        (s) => s.id === activeShortestPath[segmentIndex + 1]
      );
      if (star1 && star2) {
        const currentX = star1.x + (star2.x - star1.x) * progress;
        const currentY = star1.y + (star2.y - star1.y) * progress;
        drawStaticLine(
          { x: star1.x, y: star1.y },
          { x: currentX, y: currentY },
          SP_PATH_COLOR,
          SP_PATH_WIDTH
        );
        if (progress > 0.5) {
          const edge = userEdges.find(
            (e) =>
              (e.node1Id === star1.id && e.node2Id === star2.id) ||
              (e.node1Id === star2.id && e.node2Id === star1.id)
          );
          if (edge)
            drawEdgeWeight(
              star1,
              { x: currentX, y: currentY },
              edge.weight.toFixed(0)
            );
        }
      }
      if (progress < 1) {
        requestAnimationFrame(animateFrame);
      } else {
        if (star1 && star2) {
          drawStaticLine(star1, star2, SP_PATH_COLOR, SP_PATH_WIDTH);
          const edge = userEdges.find(
            (e) =>
              (e.node1Id === star1.id && e.node2Id === star2.id) ||
              (e.node1Id === star2.id && e.node2Id === star1.id)
          );
          if (edge) drawEdgeWeight(star1, star2, edge.weight.toFixed(0));
        }
        segmentIndex++;
        if (segmentIndex < activeShortestPath.length - 1) {
          animationStartTime = null;
          setTimeout(
            () => requestAnimationFrame(animateFrame),
            DELAY_BETWEEN_SEGMENTS
          );
        } else {
          console.log("SP animation done.");
          updateInfoPanel("SP");
          enableButtonsAfterAnimation();
          redrawCanvas();
        }
      }
    }
    requestAnimationFrame(animateFrame);
  }

  function animateTspTour() {
    runAlgorithmButton.disabled = true;
    undoButton.disabled = true;
    resetButton.disabled = true;
    clearCanvas();
    drawStars();
    drawEdges(
      userEdges,
      USER_EDGE_COLOR,
      USER_EDGE_WIDTH,
      USER_EDGE_DASH,
      true
    );
    if (
      activeTspTour.length < 2 &&
      !(
        stars.length === 1 &&
        activeTspTour.length === 1 &&
        activeTspTour[0] === stars[0].id
      )
    ) {
      console.warn("No TSP tour.");
      updateInfoPanel("TSP");
      enableButtonsAfterAnimation();
      return;
    }
    if (
      stars.length === 1 &&
      activeTspTour.length === 1 &&
      activeTspTour[0] === stars[0].id
    ) {
      console.log("TSP animation done (1 star).");
      updateInfoPanel("TSP");
      enableButtonsAfterAnimation();
      redrawCanvas();
      return;
    }
    let segmentIndex = 0;
    let animationStartTime;
    const DURATION_PER_SEGMENT = 200;
    const DELAY_BETWEEN_SEGMENTS = 50;
    function animateFrame(currentTime) {
      if (!animationStartTime) animationStartTime = currentTime;
      const elapsedTime = currentTime - animationStartTime;
      let progress = Math.min(elapsedTime / DURATION_PER_SEGMENT, 1);
      clearCanvas();
      drawStars();
      drawEdges(
        userEdges,
        USER_EDGE_COLOR,
        USER_EDGE_WIDTH,
        USER_EDGE_DASH,
        true
      );
      for (let i = 0; i < segmentIndex; i++) {
        const starA = stars.find((s) => s.id === activeTspTour[i]);
        const starB = stars.find((s) => s.id === activeTspTour[i + 1]);
        if (starA && starB) {
          drawStaticLine(starA, starB, TSP_TOUR_COLOR, TSP_TOUR_WIDTH);
          const edge = userEdges.find(
            (e) =>
              (e.node1Id === starA.id && e.node2Id === starB.id) ||
              (e.node1Id === starB.id && e.node2Id === starA.id)
          );
          if (edge) drawEdgeWeight(starA, starB, edge.weight.toFixed(0));
        }
      }
      const star1 = stars.find((s) => s.id === activeTspTour[segmentIndex]);
      const star2 = stars.find((s) => s.id === activeTspTour[segmentIndex + 1]);
      if (star1 && star2) {
        const currentX = star1.x + (star2.x - star1.x) * progress;
        const currentY = star1.y + (star2.y - star1.y) * progress;
        drawStaticLine(
          { x: star1.x, y: star1.y },
          { x: currentX, y: currentY },
          TSP_TOUR_COLOR,
          TSP_TOUR_WIDTH
        );
        if (progress > 0.5) {
          const edge = userEdges.find(
            (e) =>
              (e.node1Id === star1.id && e.node2Id === star2.id) ||
              (e.node1Id === star2.id && e.node2Id === star1.id)
          );
          if (edge)
            drawEdgeWeight(
              star1,
              { x: currentX, y: currentY },
              edge.weight.toFixed(0)
            );
        }
      }
      if (progress < 1) {
        requestAnimationFrame(animateFrame);
      } else {
        if (star1 && star2) {
          drawStaticLine(star1, star2, TSP_TOUR_COLOR, TSP_TOUR_WIDTH);
          const edge = userEdges.find(
            (e) =>
              (e.node1Id === star1.id && e.node2Id === star2.id) ||
              (e.node1Id === star2.id && e.node2Id === star1.id)
          );
          if (edge) drawEdgeWeight(star1, star2, edge.weight.toFixed(0));
        }
        segmentIndex++;
        if (segmentIndex < activeTspTour.length - 1) {
          animationStartTime = null;
          setTimeout(
            () => requestAnimationFrame(animateFrame),
            DELAY_BETWEEN_SEGMENTS
          );
        } else {
          console.log("TSP animation done.");
          updateInfoPanel("TSP");
          enableButtonsAfterAnimation();
          redrawCanvas();
        }
      }
    }
    requestAnimationFrame(animateFrame);
  }

  // --- ALGORITMA (MST, SP, TSP) & PriorityQueue ---
  function calculateDistance(n1, n2) {
    const dx = n1.x - n2.x;
    const dy = n1.y - n2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function calculateKruskalMST(nodes, currentEdgesToProcess) {
    if (
      nodes.length < 1 ||
      (currentEdgesToProcess.length === 0 && nodes.length > 1)
    ) {
      return { mst: [], rejected: [] };
    }
    if (nodes.length === 1 && currentEdgesToProcess.length === 0) {
      return { mst: [], rejected: [] };
    }
    let sortedEdges = [...currentEdgesToProcess];
    sortedEdges.sort((a, b) => a.weight - b.weight);
    let mst = [],
      rejected = [],
      parent = {};
    nodes.forEach((node) => (parent[node.id] = node.id));
    function find(nodeId) {
      if (parent[nodeId] === nodeId) return nodeId;
      return (parent[nodeId] = find(parent[nodeId]));
    }
    function union(node1Id, node2Id) {
      let r1 = find(node1Id),
        r2 = find(node2Id);
      if (r1 !== r2) {
        parent[r1] = r2;
        return true;
      }
      return false;
    }
    for (const edge of sortedEdges) {
      if (union(edge.node1Id, edge.node2Id)) mst.push(edge);
      else rejected.push(edge);
    }
    return { mst, rejected };
  }
  function calculateDijkstraSP(allNodes, currentEdges, startNodeId, endNodeId) {
    if (
      !allNodes.find((n) => n.id === startNodeId) ||
      !allNodes.find((n) => n.id === endNodeId) ||
      (currentEdges.length === 0 && allNodes.length > 1)
    )
      return [];
    const dist = {},
      prev = {},
      pq = new PriorityQueue();
    allNodes.forEach((n) => {
      dist[n.id] = Infinity;
      prev[n.id] = null;
    });
    dist[startNodeId] = 0;
    pq.enqueue(startNodeId, 0);
    const adj = {};
    allNodes.forEach((n) => (adj[n.id] = []));
    currentEdges.forEach((e) => {
      adj[e.node1Id].push({ node: e.node2Id, weight: e.weight });
      adj[e.node2Id].push({ node: e.node1Id, weight: e.weight });
    });
    while (!pq.isEmpty()) {
      const { element: u, priority: ud } = pq.dequeue();
      if (u === endNodeId) break;
      if (ud > dist[u]) continue;
      (adj[u] || []).forEach((neighbor) => {
        const v = neighbor.node;
        const w = neighbor.weight;
        if (dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          prev[v] = u;
          pq.enqueue(v, dist[v]);
        }
      });
    }
    const path = [];
    let curr = endNodeId;
    if (prev[curr] || curr === startNodeId) {
      while (curr) {
        path.unshift(curr);
        if (curr === startNodeId) break;
        curr = prev[curr];
        if (!curr && path[0] !== startNodeId) return [];
      }
    }
    return path.length > 1 ||
      (path.length === 1 &&
        path[0] === startNodeId &&
        startNodeId === endNodeId)
      ? path
      : [];
  }
  function calculateNearestNeighborTSP(allNodes, currentEdges, startNodeId) {
    if (allNodes.length < 1) return [];
    if (
      (!startNodeId || !allNodes.find((n) => n.id === startNodeId)) &&
      allNodes.length > 0
    ) {
      startNodeId = allNodes[0].id;
    }
    if (!allNodes.find((n) => n.id === startNodeId)) return [];
    if (allNodes.length === 1) return [startNodeId];
    let unvisited = new Set(allNodes.map((n) => n.id));
    let tour = [];
    let currId = startNodeId;
    tour.push(currId);
    unvisited.delete(currId);
    while (unvisited.size > 0) {
      let nnId = null;
      let minD = Infinity;
      unvisited.forEach((nId) => {
        const e = currentEdges.find(
          (x) =>
            (x.node1Id === currId && x.node2Id === nId) ||
            (x.node1Id === nId && x.node2Id === currId)
        );
        if (e && e.weight < minD) {
          minD = e.weight;
          nnId = nId;
        }
      });
      if (nnId) {
        currId = nnId;
        tour.push(currId);
        unvisited.delete(currId);
      } else break;
    }
    if (
      tour.length > 1 &&
      unvisited.size === 0 &&
      tour[tour.length - 1] !== startNodeId
    ) {
      const lastId = tour[tour.length - 1];
      const e2s = currentEdges.find(
        (e) =>
          (e.node1Id === lastId && e.node2Id === startNodeId) ||
          (e.node1Id === startNodeId && e.node2Id === lastId)
      );
      if (e2s) tour.push(startNodeId);
      else console.warn("TSP: No direct edge to return to start.");
    } else if (unvisited.size > 0) {
      console.warn("TSP: Not all nodes visited.");
    }
    return tour;
  }
  class PriorityQueue {
    constructor() {
      this.items = [];
    }
    enqueue(e, p) {
      const qe = { element: e, priority: p };
      let ad = false;
      for (let i = 0; i < this.items.length; i++) {
        if (this.items[i].priority > qe.priority) {
          this.items.splice(i, 0, qe);
          ad = true;
          break;
        }
      }
      if (!ad) this.items.push(qe);
    }
    dequeue() {
      if (this.isEmpty()) return null;
      return this.items.shift();
    }
    isEmpty() {
      return this.items.length === 0;
    }
  }

  // --- FUNGSI UTILITAS & UPDATE UI LAINNYA ---
  function enableButtonsAfterAnimation() {
    if (currentAlgorithm === "SP" || currentAlgorithm === "TSP") {
      selectedStar1Id = null;
      selectedStar2Id = null;
    }
    updateButtonStates();
    prepareForAlgorithmSelection();
  }
  function drawEdgeWeight(p1, p2, wt) {
    if (!p1 || !p2) return;
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    ctx.font = EDGE_WEIGHT_TEXT_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tm = ctx.measureText(wt);
    const tw = tm.width;
    const th = parseInt(EDGE_WEIGHT_TEXT_FONT, 10) || 10;
    ctx.fillStyle = EDGE_WEIGHT_BACKGROUND_COLOR;
    ctx.fillRect(
      mx - tw / 2 - EDGE_WEIGHT_PADDING,
      my - th / 2 - EDGE_WEIGHT_PADDING,
      tw + EDGE_WEIGHT_PADDING * 2,
      th + EDGE_WEIGHT_PADDING * 2
    );
    ctx.fillStyle = EDGE_WEIGHT_TEXT_COLOR;
    ctx.fillText(wt, mx, my);
  }
  function drawStaticLine(s1, s2, c, w, dp = []) {
    if (!s1 || !s2) return;
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.setLineDash(dp);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function clearCanvasAndShowPlaceholder() {
    clearCanvas();
    ctx.fillStyle = "#404068";
    ctx.font = "italic 16px 'Roboto',sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Klik untuk tambah bintang. Lalu 'Tambah Edge' untuk koneksi.",
      canvas.width / 2,
      canvas.height / 2
    );
  }
  function showTemporaryMessage(m, d = 2000) {
    const em = document.querySelector(".temp-message-popup");
    if (em) document.body.removeChild(em);
    const md = document.createElement("div");
    md.className = "temp-message-popup";
    md.textContent = m;
    md.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background-color:rgba(255,100,100,0.9);color:white;padding:10px 20px;border-radius:5px;z-index:1000;box-shadow:0 2px 5px rgba(0,0,0,0.2);opacity:0;transition:opacity .3s ease-in-out;`;
    document.body.appendChild(md);
    requestAnimationFrame(() => (md.style.opacity = "1"));
    setTimeout(() => {
      md.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(md)) document.body.removeChild(md);
      }, 300);
    }, d);
  }
  function updateInfoPanel(algoType = null) {
    starCountSpan.textContent = stars.length;
    let tc = 0;
    let clt = "Total Biaya/Jarak";
    const aa = algoType || currentAlgorithm;
    if (aa === "MST" && activeMstEdges.length > 0) {
      activeMstEdges.forEach((e) => {
        tc += e.weight;
      });
      clt = "Total Biaya MST";
    } else if (aa === "SP" && activeShortestPath.length > 1) {
      for (let i = 0; i < activeShortestPath.length - 1; i++) {
        const e = userEdges.find(
          (x) =>
            (x.node1Id === activeShortestPath[i] &&
              x.node2Id === activeShortestPath[i + 1]) ||
            (x.node1Id === activeShortestPath[i + 1] &&
              x.node2Id === activeShortestPath[i])
        );
        if (e) tc += e.weight;
      }
      clt = "Jarak Shortest Path";
    } else if (aa === "TSP" && activeTspTour.length > 0) {
      if (
        stars.length === 1 &&
        activeTspTour.length === 1 &&
        activeTspTour[0] === stars[0].id
      ) {
        tc = 0;
      } else {
        for (let i = 0; i < activeTspTour.length - 1; i++) {
          const e = userEdges.find(
            (x) =>
              (x.node1Id === activeTspTour[i] &&
                x.node2Id === activeTspTour[i + 1]) ||
              (x.node1Id === activeTspTour[i + 1] &&
                x.node2Id === activeTspTour[i])
          );
          if (e) tc += e.weight;
        }
      }
      clt = "Jarak TSP Tour";
    }
    costLabelParagraphElement.childNodes[0].nodeValue = `${clt}: `;
    algorithmCostSpan.textContent = tc.toFixed(2);
    let resetToDefault = false;
    if (
      aa === "MST" &&
      activeMstEdges.length === 0 &&
      (stars.length < 1 || (userEdges.length === 0 && stars.length > 1))
    )
      resetToDefault = true;
    else if (aa === "SP" && activeShortestPath.length < 2)
      resetToDefault = true;
    else if (aa === "TSP" && activeTspTour.length < 1)
      resetToDefault = true; // Tur 1 bintang dihandle di atas
    else if (
      userEdges.length === 0 &&
      aa !== "TSP" &&
      !(aa === "TSP" && stars.length === 1)
    )
      resetToDefault = true;
    if (resetToDefault || stars.length === 0) {
      costLabelParagraphElement.childNodes[0].nodeValue = `Total Biaya/Jarak: `;
      algorithmCostSpan.textContent = "0.00";
    }
  }
  function updateButtonStates() {
    const canRunTspBase = stars.length >= 1;
    let runDisabled = true;
    if (currentAlgorithm === "MST") {
      runDisabled = !(
        stars.length >= 1 && userEdges.length >= (stars.length > 1 ? 0 : 0)
      );
    } else if (currentAlgorithm === "SP") {
      runDisabled = !(
        stars.length >= 2 &&
        userEdges.length > 0 &&
        selectedStar1Id !== null &&
        selectedStar2Id !== null
      );
    } else if (currentAlgorithm === "TSP") {
      runDisabled = !(
        canRunTspBase &&
        ((selectedStar1Id !== null && stars.length > 0) ||
          stars.length === 0 ||
          stars.length === 1)
      );
    }
    runAlgorithmButton.disabled = runDisabled;
    resetButton.disabled = stars.length === 0 && userEdges.length === 0;
    undoButton.disabled = lastActionStack.length === 0;
    toggleAddEdgeModeButton.disabled = stars.length < 2 && !isAddingEdgeMode;
  }

  // --- INITIAL SETUP ---
  updateUITexts();
  clearCanvasAndShowPlaceholder();
  updateInfoPanel();
  updateButtonStates();
  prepareForAlgorithmSelection();
});

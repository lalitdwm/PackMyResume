const SAMPLE_FIELDS = [
  { label: "Name as per PAN Card:", value: "" },
  { label: "Total years of Exp:", value: "" },
  { label: "Relevant Exp:", value: "" },
  { label: "Mobile No:", value: "" },
  { label: "Email ID:", value: "" },
  { label: "Current Company:", value: "" },
  { label: "Highest Academic Qualification:", value: "" },
  { label: "Notice period:", value: "" },
  { label: "Current Location:", value: "" },
  { label: "Comfortable to Relocate (Yes/No):", value: "" },
  { label: "Comfortable For Shift (Yes/No):", value: "" },
  {
    label:
      "Has the candidate worked with BNP Paribas India Solutions or any other BNP Paribas Group Company or subsidiary before? – Yes / No (If yes, please provide the details). Kindly share UID",
    value: "",
  },
  {
    label:
      "Close Business Relationship – is candidate related to anybody at BNP Paribas or any BNPP group organizations?",
    value: "",
  },
  {
    label: "Identity of the candidate checked on video and captured? - Yes or No",
    value: "",
  },
  {
    label:
      "*Note: Supplier will be expected to produce the screen capture for any internal audit or control review based on request",
    value: "",
  },
  {
    label:
      "Rating for the skills required for the request (Provide rate as 1 - Least & 5 - Highest rating)",
    value: "",
  },
  { label: "Primary Skill: SQL, Python, Power BI", value: "4 out of 5" },
  {
    label: "Secondary Skill: Statistical Model, Predictive Modelling, AWS",
    value: "4 out of 5",
  },
  { label: "Communication Skills :", value: "4 out of 5" },
];

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const TABLE_CELL_GAP = 10;
const LABEL_RATIO = 0.72;
const TABLE_WIDTH = CONTENT_WIDTH;
const LABEL_WIDTH = TABLE_WIDTH * LABEL_RATIO;
const VALUE_WIDTH = TABLE_WIDTH - LABEL_WIDTH - TABLE_CELL_GAP;
const LABEL_FONT_SIZE = 10.5;
const VALUE_FONT_SIZE = 10.5;
const LABEL_LINE_HEIGHT = 13;
const VALUE_LINE_HEIGHT = 13;
const ROW_PADDING_Y = 4;
const ROW_PADDING_X = 4;
const IMAGE_MAX_WIDTH = 180;
const IMAGE_MAX_HEIGHT = 180;

let detailsInput;
let imageInput;
let resumeInput;
let generateButton;
let clearButton;
let clearInputButton;
let statusMessage;
let previewTable;
let previewImage;
let imagePlaceholder;
let imageObjectUrl = "";
let currentFields = [];
let isSyncingRichInput = false;
let statusTimeoutId = null;

window.addEventListener("DOMContentLoaded", initApp);
window.addEventListener("error", (event) => {
  setStatus("error", `Startup error: ${event.message}`);
});
window.addEventListener("unhandledrejection", (event) => {
  const reason =
    event.reason && event.reason.message ? event.reason.message : String(event.reason);
  setStatus("error", `Unhandled error: ${reason}`);
});

function initApp() {
  detailsInput = document.getElementById("details-input");
  imageInput = document.getElementById("image-input");
  resumeInput = document.getElementById("resume-input");
  generateButton = document.getElementById("generate-button");
  clearButton = document.getElementById("clear-button");
  clearInputButton = document.getElementById("clear-input-button");
  statusMessage = document.getElementById("status-message");
  previewTable = document.getElementById("preview-table");
  previewImage = document.getElementById("preview-image");
  imagePlaceholder = document.getElementById("image-placeholder");

  if (
    !detailsInput ||
    !imageInput ||
    !resumeInput ||
    !generateButton ||
    !clearButton ||
    !clearInputButton ||
    !statusMessage ||
    !previewTable ||
    !previewImage ||
    !imagePlaceholder
  ) {
    throw new Error("The app could not find all required page elements.");
  }

  currentFields = SAMPLE_FIELDS.map((field) => ({ ...field }));
  syncRichInputFromFields();
  renderPreview();

  detailsInput.addEventListener("input", renderPreview);
  imageInput.addEventListener("change", handleImageChange);
  imageInput.addEventListener("change", handleFileSelectionState);
  resumeInput.addEventListener("change", handleFileSelectionState);
  generateButton.addEventListener("click", handleGeneratePdf);
  clearButton.addEventListener("click", handleClearDetails);
  clearInputButton.addEventListener("click", handleClearInput);

  if (typeof window.PDFLib === "undefined") {
    setStatus(
      "error",
      "PDF library failed to load. Please check internet access or use a local server."
    );
    return;
  }

  if (window.location.protocol === "file:") {
    setStatus(
      "working",
      "Opened as a local file. If PDF generation is blocked, run this folder with a small local server instead of file://."
    );
    return;
  }

  setStatus("success", "Ready. Add details, image, and resume PDF, then click Download PDF.");
}

function parseCandidateDetails(input) {
  const normalized = String(input || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map((line) => line.trim());
  const fields = [];
  let currentLabel = null;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const inlineMatch = line.match(/^(.+?):\s*(.+)$/);
    if (inlineMatch) {
      if (currentLabel) {
        fields.push({ label: currentLabel, value: "" });
      }

      fields.push({
        label: inlineMatch[1].trim(),
        value: inlineMatch[2].trim(),
      });
      currentLabel = null;
      continue;
    }

    if (/:\s*$/.test(line)) {
      if (currentLabel) {
        fields.push({ label: currentLabel, value: "" });
      }

      currentLabel = line.replace(/:\s*$/, "").trim();
      continue;
    }

    if (currentLabel) {
      fields.push({ label: currentLabel, value: line });
      currentLabel = null;
      continue;
    }

    if (fields.length > 0) {
      const previous = fields[fields.length - 1];
      previous.value = previous.value ? `${previous.value} ${line}`.trim() : line;
    }
  }

  if (currentLabel) {
    fields.push({ label: currentLabel, value: "" });
  }

  return fields;
}

function parseCandidateDetailsFromRichInput() {
  const tableRows = Array.from(detailsInput.querySelectorAll("table tr"));

  if (tableRows.length > 0) {
    const tableFields = tableRows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("th, td"));
        if (cells.length < 2) {
          return null;
        }

        return {
          label: normalizeCellText(cells[0].textContent),
          value: normalizeCellText(cells[1].textContent),
        };
      })
      .filter((field) => field && (field.label || field.value));

    if (tableFields.length > 0) {
      return tableFields;
    }
  }

  return parseCandidateDetails(detailsInput.innerText || "");
}

function renderPreview() {
  if (isSyncingRichInput) {
    return;
  }

  currentFields = parseCandidateDetailsFromRichInput();
  renderFieldColumn(previewTable, currentFields);
}

function renderFieldColumn(container, fields) {
  container.innerHTML = "";

  if (!fields.length) {
    const emptyCard = document.createElement("article");
    emptyCard.className = "empty-state";
    emptyCard.innerHTML = `
      <h3>No parsed fields yet</h3>
      <p>Paste candidate details to preview the page layout.</p>
    `;
    container.appendChild(emptyCard);
    return;
  }

  fields.forEach((field, fieldIndex) => {
    const row = document.createElement("article");
    row.className = "field-row";

    const labelCell = document.createElement("textarea");
    labelCell.className = "field-label field-edit-input";
    labelCell.value = field.label;
    labelCell.rows = 1;
    labelCell.addEventListener("input", (event) => {
      resizeEditor(event.target);
      currentFields = currentFields.map((entry, index) =>
        index === fieldIndex ? { ...entry, label: event.target.value } : entry
      );
      syncDetailsTextFromFields();
    });

    const valueCell = document.createElement("textarea");
    valueCell.className = "field-value field-edit-input";
    valueCell.value = field.value || "";
    valueCell.rows = 1;
    valueCell.addEventListener("input", (event) => {
      resizeEditor(event.target);
      currentFields = currentFields.map((entry, index) =>
        index === fieldIndex ? { ...entry, value: event.target.value } : entry
      );
      syncDetailsTextFromFields();
    });

    row.appendChild(labelCell);
    row.appendChild(valueCell);
    container.appendChild(row);
    resizeEditor(labelCell);
    resizeEditor(valueCell);
  });
}

function resizeEditor(element) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function syncDetailsTextFromFields() {
  syncRichInputFromFields();
}

function syncRichInputFromFields() {
  isSyncingRichInput = true;
  detailsInput.innerHTML = buildRichInputHtml(currentFields);
  isSyncingRichInput = false;
}

function buildRichInputHtml(fields) {
  if (!fields.length) {
    return "<p><br></p>";
  }

  const rows = fields
    .map(
      (field) => `
        <tr>
          <td>${escapeHtml(field.label || "")}</td>
          <td>${escapeHtml(field.value || "")}</td>
        </tr>
      `
    )
    .join("");

  return `
    <table class="rich-input-table">
      <colgroup>
        <col class="rich-input-col-label" />
        <col class="rich-input-col-value" />
      </colgroup>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function normalizeCellText(text) {
  return (text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function handleImageChange() {
  if (imageObjectUrl) {
    URL.revokeObjectURL(imageObjectUrl);
    imageObjectUrl = "";
  }

  const file = imageInput.files && imageInput.files[0];
  if (!file) {
    previewImage.hidden = true;
    imagePlaceholder.hidden = false;
    previewImage.removeAttribute("src");
    return;
  }

  imageObjectUrl = URL.createObjectURL(file);
  previewImage.src = imageObjectUrl;
  previewImage.hidden = false;
  imagePlaceholder.hidden = true;
}

function handleFileSelectionState(event) {
  const input = event.target;
  const wrapper = input.closest(".file-input");
  if (!wrapper) {
    return;
  }

  if (input.files && input.files.length > 0) {
    wrapper.classList.add("file-input-selected");
  } else {
    wrapper.classList.remove("file-input-selected");
  }
}

function handleClearDetails() {
  const shouldClear = window.confirm("Reset the input table back to the default template?");
  if (!shouldClear) {
    return;
  }

  currentFields = SAMPLE_FIELDS.map((field) => ({
    label: field.label,
    value: field.value,
  }));
  syncRichInputFromFields();
  renderPreview();
  setStatus("success", "Template reset to default.");
}

function handleClearInput() {
  const shouldClear = window.confirm("Clear all rows from the input table?");
  if (!shouldClear) {
    return;
  }

  currentFields = [];
  syncRichInputFromFields();
  renderPreview();
  setStatus("success", "Input table cleared.");
}

function setStatus(type, message) {
  if (!statusMessage) {
    return;
  }

  if (statusTimeoutId) {
    window.clearTimeout(statusTimeoutId);
    statusTimeoutId = null;
  }

  statusMessage.textContent = message;
  statusMessage.className = `status-message status-${type}`;

  if (message && type !== "error") {
    statusTimeoutId = window.setTimeout(() => {
      statusMessage.textContent = "";
      statusMessage.className = "status-message";
      statusTimeoutId = null;
    }, 3000);
  }
}

function wrapText(text, font, size, maxWidth) {
  if (!text) {
    return [""];
  }

  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = words[0] || "";

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    const candidate = `${currentLine} ${word}`.trim();
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
}

function estimateFieldHeight(field, labelFont, valueFont) {
  const labelLines = wrapText(field.label, labelFont, LABEL_FONT_SIZE, LABEL_WIDTH);
  const valueLines = wrapText(field.value || "", valueFont, VALUE_FONT_SIZE, VALUE_WIDTH);
  return (
    Math.max(
      labelLines.length * LABEL_LINE_HEIGHT,
      valueLines.length * VALUE_LINE_HEIGHT
    ) + ROW_PADDING_Y * 2
  );
}

function drawFieldColumn(page, fields, x, startY, labelFont, valueFont) {
  let cursorY = startY;

  fields.forEach((field) => {
    const labelLines = wrapText(field.label, labelFont, LABEL_FONT_SIZE, LABEL_WIDTH);
    const valueLines = wrapText(field.value || "", valueFont, VALUE_FONT_SIZE, VALUE_WIDTH);
    const contentHeight = Math.max(
      labelLines.length * LABEL_LINE_HEIGHT,
      valueLines.length * VALUE_LINE_HEIGHT
    );
    const rowHeight = contentHeight + ROW_PADDING_Y * 2;
    const rowTopY = cursorY;
    const rowBottomY = rowTopY - rowHeight;

    page.drawRectangle({
      x,
      y: rowBottomY,
      width: TABLE_WIDTH,
      height: rowHeight,
      borderWidth: 1,
      borderColor: PDFLib.rgb(0, 0, 0),
    });

    page.drawLine({
      start: { x: x + LABEL_WIDTH + TABLE_CELL_GAP / 2, y: rowBottomY },
      end: { x: x + LABEL_WIDTH + TABLE_CELL_GAP / 2, y: rowBottomY + rowHeight },
      thickness: 1,
      color: PDFLib.rgb(0, 0, 0),
    });

    let labelY = rowTopY - ROW_PADDING_Y - LABEL_FONT_SIZE;
    let valueY = rowTopY - ROW_PADDING_Y - VALUE_FONT_SIZE;

    labelLines.forEach((line) => {
      page.drawText(line, {
        x: x + ROW_PADDING_X,
        y: labelY,
        size: LABEL_FONT_SIZE,
        font: valueFont,
        color: PDFLib.rgb(0, 0, 0),
      });
      labelY -= LABEL_LINE_HEIGHT;
    });

    valueLines.forEach((line) => {
      page.drawText(line, {
        x: x + LABEL_WIDTH + TABLE_CELL_GAP,
        y: valueY,
        size: VALUE_FONT_SIZE,
        font: valueFont,
        color: PDFLib.rgb(0, 0, 0),
      });
      valueY -= VALUE_LINE_HEIGHT;
    });

    cursorY -= rowHeight;
  });
}

async function buildCandidatePdf({ fields, imageBytes, imageMimeType, resumeBytes }) {
  const outputPdf = await PDFLib.PDFDocument.create();
  const firstPage = outputPdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const labelFont = await outputPdf.embedFont(PDFLib.StandardFonts.Helvetica);
  const valueFont = await outputPdf.embedFont(PDFLib.StandardFonts.Helvetica);
  const normalizedImage = await normalizeImageForPdf(imageBytes, imageMimeType);
  const image = await outputPdf.embedPng(normalizedImage);

  firstPage.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: PDFLib.rgb(1, 1, 1),
  });

  const columnsStartY = PAGE_HEIGHT - MARGIN_TOP;
  const tableHeight = fields.reduce(
    (sum, field) => sum + estimateFieldHeight(field, labelFont, valueFont),
    0
  );
  const columnsBottomY = columnsStartY - tableHeight;

  drawFieldColumn(firstPage, fields, MARGIN_X, columnsStartY, labelFont, valueFont);

  const imageScale = Math.min(
    IMAGE_MAX_WIDTH / image.width,
    IMAGE_MAX_HEIGHT / image.height,
    1
  );
  const imageWidth = image.width * imageScale;
  const imageHeight = image.height * imageScale;
  const imageX = (PAGE_WIDTH - imageWidth) / 2;
  const availableBottomSpace = Math.max(columnsBottomY - 32, 110);
  const imageY = Math.max((availableBottomSpace - imageHeight) / 2, 62);

  firstPage.drawImage(image, {
    x: imageX,
    y: imageY,
    width: imageWidth,
    height: imageHeight,
  });

  const resumePdf = await PDFLib.PDFDocument.load(resumeBytes);
  const resumePages = await outputPdf.copyPages(resumePdf, resumePdf.getPageIndices());
  resumePages.forEach((page) => outputPdf.addPage(page));

  return outputPdf.save();
}

async function normalizeImageForPdf(imageBytes, imageMimeType) {
  const blob = new Blob([imageBytes], {
    type: imageMimeType || "application/octet-stream",
  });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const imageElement = await loadImageElement(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = imageElement.naturalWidth || imageElement.width;
    canvas.height = imageElement.naturalHeight || imageElement.height;

    if (!canvas.width || !canvas.height) {
      throw new Error("The selected image could not be read.");
    }

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is unavailable in this browser.");
    }

    context.drawImage(imageElement, 0, 0);
    const pngBlob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!pngBlob) {
      throw new Error("Unable to convert the image for PDF export.");
    }

    return pngBlob.arrayBuffer();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      reject(
        new Error(
          "The selected image file could not be decoded. Try re-saving it as PNG or JPG and upload again."
        )
      );
    };
    image.src = src;
  });
}

async function handleGeneratePdf() {
  const fields = parseCandidateDetailsFromRichInput();
  const imageFile = imageInput.files && imageInput.files[0];
  const resumeFile = resumeInput.files && resumeInput.files[0];

  if (typeof window.PDFLib === "undefined") {
    setStatus(
      "error",
      "PDF library is unavailable. If you opened the file directly, try again with internet access or a local server."
    );
    return;
  }

  if (!fields.length) {
    setStatus("error", "Add candidate details before generating the PDF.");
    return;
  }

  if (!imageFile) {
    setStatus("error", "Upload a candidate image to continue.");
    return;
  }

  if (!resumeFile) {
    setStatus("error", "Upload a resume PDF to continue.");
    return;
  }

  try {
    setStatus("working", "Generating merged PDF...");

    const [imageBytes, resumeBytes] = await Promise.all([
      imageFile.arrayBuffer(),
      resumeFile.arrayBuffer(),
    ]);

    const outputBytes = await buildCandidatePdf({
      fields,
      imageBytes,
      imageMimeType: imageFile.type,
      resumeBytes,
    });

    const blob = new Blob([outputBytes], { type: "application/pdf" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = buildOutputName(fields);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    setStatus("success", "PDF generated and downloaded.");
  } catch (error) {
    setStatus("error", error instanceof Error ? error.message : "Unable to generate the PDF.");
  }
}

function buildOutputName(fields) {
  const name = findFieldValue(fields, "Name as per PAN Card") || "Candidate";
  const location = findFieldValue(fields, "Current Location") || "Profile";
  return `${sanitizeFilenamePart(name)}_${sanitizeFilenamePart(location)}.pdf`;
}

function findFieldValue(fields, labelPrefix) {
  const match = fields.find((field) =>
    normalizeCellText(field.label).toLowerCase().startsWith(labelPrefix.toLowerCase())
  );
  return match ? normalizeCellText(match.value) : "";
}

function sanitizeFilenamePart(value) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim() || "Unknown";
}

import "./style.css";
import * as pako from "pako";
import * as zopfli from "@gfx/zopfli/dist/index.js";
import humanizeDuration from "humanize-duration";
import $ from "./lib/querySelector";
import crel from "./lib/crel";
import blobToBytes from "./lib/blobToBytes";

// TODO: Flesh this out.
const formatBytes = (bytes) => `${bytes} bytes`;

const Status = {
  NotSubmitted: 0,
  Processing: 1,
  ProcessingFailed: 2,
  Processed: 3,
};

window.onload = () => {
  const uploadForm = $("#upload-form");
  const uploadStep = $("#upload-step");
  const uploadInput = $("#upload-input");
  const iterationsInput = $("#iterations-input");
  const submitStep = $("#submit-step");
  const submitButton = $("#submit-button");
  const resultsSection = $("#results");
  const resultsContents = $("#results-contents");

  let state = {
    status: Status.NotSubmitted,
  };
  const setState = (newState) => {
    state = newState;
    render();
  };

  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.status === Status.Processing) {
      return;
    }

    setState({ status: Status.Processing });

    const fail = (errorMessage) => {
      setState({ status: Status.ProcessingFailed, errorMessage });
    };

    const file = uploadInput.files[0];
    if (!file) {
      return fail("Could not find file. Did you select it correctly?");
    }

    const numiterations = Number(iterationsInput.value);
    if (
      !Number.isInteger(numiterations) ||
      numiterations < 1 ||
      numiterations > 2 ** 32
    ) {
      return fail("Invalid number of iterations. Did you input it correctly?");
    }

    if (file.size < 3) {
      return fail("File seems too small. Is it a valid .tgz?");
    }

    let fileAsBytes;
    try {
      fileAsBytes = await blobToBytes(file);
    } catch (err) {
      console.error(err);
      return fail("Could not read file");
    }

    let inflated;
    try {
      inflated = pako.inflate(fileAsBytes);
    } catch (err) {
      console.error(err);
      return fail("Could not decompress file. Is it a .tgz?");
    }

    let zopflid;
    let duration;
    try {
      const start = Date.now();
      zopflid = await zopfli.gzipAsync(inflated, {
        numiterations,
        verbose: true,
        blocksplitting: false,
      });
      duration = Date.now() - start;
    } catch (err) {
      console.error(err);
      return fail("Could not re-compress file with Zopfli");
    }

    let reinflated;
    try {
      reinflated = pako.inflate(zopflid);
    } catch (err) {
      console.error(err);
      return fail("Could not decompress Zopfli'd file");
    }
    if (inflated.length !== reinflated.length) {
      return fail(
        "Zopfli compressed successfully, but de-compressing it resulted in a different file!"
      );
    }

    const savings = file.size - zopflid.length;
    const percentSaved = Math.round((savings / file.size) * 100);

    const formattedDuration = humanizeDuration(duration);

    setState({
      status: Status.Processed,
      results: [
        `Original size: ${formatBytes(file.size)}`,
        `Uncompressed size: ${formatBytes(inflated.length)}`,
        `Recompressed size: ${formatBytes(
          zopflid.length
        )}, saving ${formatBytes(savings)} (${percentSaved}%)`,
        `Ran Zopfli with ${numiterations} iteration(s). Took ${formattedDuration}`,
      ],
    });
  });

  const render = () => {
    let canSubmit = true;
    let newResultsContents = [];

    switch (state.status) {
      case Status.NotSubmitted:
        break;

      case Status.Processing:
        canSubmit = false;
        newResultsContents = [
          crel("p", {}, ["Processing (this can take several seconds)..."]),
        ];
        break;

      case Status.ProcessingFailed:
        newResultsContents = [
          crel("p", { class: "error" }, [state.errorMessage]),
        ];
        break;

      case Status.Processed:
        newResultsContents = [
          crel(
            "ul",
            {},
            state.results.map((str) => crel("li", {}, [str]))
          ),
        ];
        break;

      default:
        throw new Error(`Unexpected status ${state.status}`);
    }

    uploadInput.toggleAttribute("disabled", !canSubmit);
    iterationsInput.toggleAttribute("disabled", !canSubmit);
    submitButton.toggleAttribute("disabled", !canSubmit);

    resultsSection.toggleAttribute("hidden", newResultsContents.length === 0);

    const newResultsChild = document.createDocumentFragment();
    for (const el of newResultsContents) {
      newResultsChild.appendChild(el);
    }
    resultsContents.innerHTML = "";
    resultsContents.appendChild(newResultsChild);
  };

  render();
};

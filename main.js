import "./style.css";
import * as pako from "pako";
import * as zopfli from "@gfx/zopfli/dist/index.js";
import humanizeDuration from "humanize-duration";
import $ from "./lib/querySelector";
import crel from "./lib/crel";
import blobToBytes from "./lib/blobToBytes";

const Status = {
  NotSubmitted: 0,
  Processing: 1,
  ProcessingFailed: 2,
  Processed: 3,
};

async function process(file, numiterations) {
  if (file.size < 3) {
    return {
      ok: false,
      errorMessage: "File seems too small. Is it a valid .tgz?",
    };
  }

  let fileAsBytes;
  try {
    fileAsBytes = await blobToBytes(file);
  } catch (err) {
    console.error(err);
    return { ok: false, errorMessage: "Could not read file" };
  }

  let inflated;
  try {
    inflated = pako.inflate(fileAsBytes);
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      errorMessage: "Could not decompress file. Is it a .tgz?",
    };
  }

  let zopflid;
  let zopfliDuration;
  try {
    const start = Date.now();
    zopflid = await zopfli.gzipAsync(inflated, {
      numiterations,
      verbose: true,
      blocksplitting: false,
    });
    zopfliDuration = Date.now() - start;
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      errorMessage: "Could not re-compress file with Zopfli",
    };
  }

  let reinflated;
  try {
    reinflated = pako.inflate(zopflid);
  } catch (err) {
    console.error(err);
    return { ok: false, errorMessage: "Could not decompress Zopfli'd file" };
  }
  if (inflated.length !== reinflated.length) {
    return {
      ok: false,
      errorMessage:
        "Zopfli compressed successfully, but de-compressing it resulted in a different file!",
    };
  }

  return {
    ok: true,
    originalSize: file.size,
    uncompressedSize: inflated.length,
    zopfliSize: zopflid.length,
    zopfliDuration,
  };
}

window.onload = () => {
  const uploadForm = $("#upload-form");
  const uploadInput = $("#upload-input");
  const iterationsInput = $("#iterations-input");
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

    const result = await process(file, numiterations);
    if (result.ok) {
      const savings = result.originalSize - result.zopfliSize;
      const percentSaved = Math.round((savings / result.originalSize) * 100);
      const formattedDuration = humanizeDuration(result.zopfliDuration);
      setState({
        status: Status.Processed,
        results: [
          `Original size: ${result.originalSize} bytes`,
          `Uncompressed size: ${result.uncompressedSize} bytes`,
          `Recompressed size: ${result.zopfliSize} bytes, saving ${savings} bytes (${percentSaved}%)`,
          `Ran Zopfli with ${numiterations} iteration(s). Took ${formattedDuration}`,
        ],
      });
    } else {
      fail(result.errorMessage);
    }
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

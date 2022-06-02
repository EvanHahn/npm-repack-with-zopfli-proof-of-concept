import "./style.css";
import * as pako from "pako";
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
      return fail("Could not find file");
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
      return fail("Could not decompress file");
    }

    setState({
      status: Status.Processed,
      results: [
        `Original size: ${formatBytes(file.size)}`,
        `Uncompressed size: ${formatBytes(inflated.length)}`,
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
        newResultsContents = [crel("p", {}, ["Processing..."])];
        break;

      case Status.ProcessingFailed:
        newResultsContents = [
          crel("p", { class: "error" }, [state.errorMessage]),
        ];
        break;

      case Status.Processed:
        newResultsContents = state.results.map((str) => crel("li", {}, [str]));
        break;

      default:
        throw new Error(`Unexpected status ${state.status}`);
    }

    uploadInput.toggleAttribute("disabled", !canSubmit);
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

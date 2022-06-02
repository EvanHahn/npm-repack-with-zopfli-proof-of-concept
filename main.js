import "./style.css";

const $ = document.querySelector.bind(document);

const Status = {
  NotSubmitted: 0,
  Processing: 1,
  Processed: 2,
};

window.onload = () => {
  const uploadForm = $("#upload-form");
  const uploadStep = $("#upload-step");
  const uploadInput = $("#upload-input");
  const submitStep = $("#submit-step");
  const submitButton = $("#submit-button");
  const resultsSection = $("#results");

  let state = {
    status: Status.NotSubmitted,
  };
  const setState = (newState) => {
    state = newState;
    render();
  };

  uploadForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (state.status === Status.Processing) {
      return;
    }

    setState({ status: Status.Processing });
  });

  const render = () => {
    const canSubmit = state.status !== Status.Processing;
    uploadInput.toggleAttribute("disabled", !canSubmit);
    submitButton.toggleAttribute("disabled", !canSubmit);

    const shouldShowResultsSection = state.status !== Status.NotSubmitted;
    resultsSection.toggleAttribute("hidden", !shouldShowResultsSection);
  };

  render();
};

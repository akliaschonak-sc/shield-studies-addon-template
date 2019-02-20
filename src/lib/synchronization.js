/* global feature, PREFS */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "(ModelSynchronization)" }]*/

const URL_ENDPOINT =
  "https://public-data.telemetry.mozilla.org/awesomebar_study/latest.json";
const MINUTES_PER_ITERATION = 5; // Should be a dividor of 60
const TREATMENT_GROUP = "treatment";
const CONTROL_GROUP = "control";

class ModelSynchronization {
  constructor(studyInfo) {
    this.iteration = -1;
    this.studyInfo = studyInfo;
    this.fetchModel();
  }

  msUntilNextIteration() {
    // Begin a new iteration every MINUTES_PER_ITERATION, starting from a full hour
    const now = new Date();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const ms = now.getMilliseconds();

    // Seconds and milliseconds until the next full minute starts
    // -1 because everything is 0-based
    const msUntilNextMinute = (60 - s - 1) * 1000 + (1000 - ms - 1);

    // Remaining minutes until the next iteration begins
    const minutesSinceLastIteration = m % MINUTES_PER_ITERATION;
    const minutesMissing =
      MINUTES_PER_ITERATION - minutesSinceLastIteration - 1;

    // Combining both
    return msUntilNextMinute + minutesMissing * 60 * 1000;
  }

  async fetchModel() {
    await browser.study.logger.log("Fetching model");
    fetch(URL_ENDPOINT)
      .then(response => response.json())
      .then(this.applyModelUpdate.bind(this));

    this.setTimer();
  }

  setTimer() {
    setTimeout(this.fetchModel.bind(this), this.msUntilNextIteration());
  }

  async applyModelUpdate({ iteration, model }) {
    await browser.study.logger.debug({ iteration, model });
    this.iteration = iteration;

    if (this.studyInfo.variation.name === TREATMENT_GROUP) {
      await browser.study.logger.log("Applying frecency weights");
      for (let i = 0; i < PREFS.length; i++) {
        browser.experiments.prefs.setIntPref(PREFS[i], model[i]);
      }
    }

    if (this.studyInfo.variation.name !== CONTROL_GROUP) {
      await browser.study.logger.log("Updating all frecencies");
      browser.experiments.frecency.updateAllFrecencies();
    }
  }

  async pushModelUpdate(
    weights,
    loss,
    numSuggestionsDisplayed,
    selectedIndex,
    numTypedChars,
    frecency_scores,
  ) {
    await browser.study.logger.log("Pushing model update via telemetry");
    const payload = {
      model_version: this.iteration,
      frecency_scores,
      loss,
      update: weights,
      num_suggestions_displayed: numSuggestionsDisplayed,
      rank_selected: selectedIndex,
      num_chars_typed: numTypedChars,
      study_variation: this.studyInfo.variation.name,
    };
    await feature.sendTelemetry(payload);
  }
}

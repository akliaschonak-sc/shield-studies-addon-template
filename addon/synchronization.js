const URL_ENDPOINT = 'https://s3-us-west-2.amazonaws.com/telemetry-test-bucket/frecency/latest.json'
const MINUTES_PER_ITERATION = 1 // Should be a dividor of 60
const TELEMETRY_TOPIC = 'frecency_update'
const TREATMENT_GROUP = "treatment"

class ModelSynchronization {
  constructor (studyInfo) {
    this.iteration = -1
    this.studyInfo = studyInfo
    this.fetchModel()
  }

  msUntilNextIteration () {
    // Begin a new iteration every MINUTES_PER_ITERATION, starting from a full hour
    const now = new Date()
    const m = now.getMinutes()
    const s = now.getSeconds()
    const ms = now.getMilliseconds()

    // Seconds and milliseconds until the next full minute starts
    // -1 because everything is 0-based
    const msUntilNextMinute = (60 - s - 1) * 1000 + (1000 - ms - 1)

    // Remaining minutes until the next iteration begins
    const minutesSinceLastIteration = m % MINUTES_PER_ITERATION
    const minutesMissing = MINUTES_PER_ITERATION - minutesSinceLastIteration - 1

    // Combining both
    return msUntilNextMinute + minutesMissing * 60 * 1000
  }

  fetchModel () {
    fetch(URL_ENDPOINT)
      .then((response) => response.json())
      .then(this.applyModelUpdate.bind(this))

    this.setTimer()
  }

  setTimer () {
    setTimeout(this.fetchModel.bind(this), this.msUntilNextIteration())
  }

  applyModelUpdate ({ iteration, model }) {
    this.iteration = iteration

    if (this.studyInfo.variation.name == TREATMENT_GROUP) {
      for (let i = 0; i < PREFS.length; i++) {
        browser.experiments.prefs.setIntPref(PREFS[i], model[i])
      }

      //browser.experiments.frecency.updateAllFrecencies()
    }
  }

  pushModelUpdate (weights, loss, numSuggestionsDisplayed, selectedIndex, numTypedChars) {
    let payload = {
      iteration: this.iteration,
      loss,
      weights,
      num_suggestions_displayed: numSuggestionsDisplayed,
      rank_selected: selectedIndex,
      num_chars_typed: numTypedChars
    }

    let options = {
      addClientId: true
    }

    console.log(payload)

    // TelemetryController.submitExternalPing(TELEMETRY_TOPIC, payload, options)
  }
}
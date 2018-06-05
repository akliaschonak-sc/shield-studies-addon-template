var weights = [
  100,
  2000,
  75,
  25,
  70,
  1400,
  52.5,
  17.5,
  50,
  1000,
  37.5,
  12.5,
  30,
  600,
  22.5,
  7.5,
  10,
  200,
  7.5,
  2.5
]

function computeFrecency(id) {
  frequency = getFrequency(id)

  if (frequency == 0) {
  	return 140
  }

  let db = PlacesUtils.history.DBConnection;
  let stmt = db.createStatement(`
  	SELECT visit_type, visit_date
  	FROM moz_places, moz_historyvisits
  	WHERE moz_places.id = moz_historyvisits.place_id AND moz_places.id = :id
  	ORDER BY moz_historyvisits.visit_date DESC
  	LIMIT 10
  `)
  stmt.bindByName("id", id)

  score = 0

  while(stmt.executeStep()) {
  	type = getTypeBucket(stmt.row.visit_type)
  	recency = getRecencyBucket(stmt.row.visit_date)

	if (type == -1) {
	  continue
	}

  	bucket = type + 4 * recency // 4 type buckets

  	score += weights[bucket]
  	console.log(type, recency, "adding", weights[bucket])
  }

  return score * frequency / Math.min(frequency, 10)
}

function getFrequency(id) {
  let db = PlacesUtils.history.DBConnection;
  let stmt = db.createStatement("SELECT COUNT(*) AS frequency FROM moz_historyvisits WHERE place_id = :id")
  stmt.bindByName("id", id)
  stmt.executeStep()
  return stmt.row.frequency
}

function getTypeBucket(visit_type) {
  // https://www.forensicswiki.org/wiki/Mozilla_Firefox_3_History_File_Format
  lookup = {
  	1: 0, // TRANSITION_LINK
  	2: 1, // TRANSITION_TYPED
  	3: 2, // TRANSITION_BOOKMARK
  	4: -1, // TRANSITION_EMBED
  	5: 0, // TRANSITION_REDIRECT_PERMANENT
  	6: 0, // TRANSITION_REDIRECT_TEMPORARY
  	7: -1 // TRANSITION_DOWNLOAD
  }

  return lookup[visit_type]
}

function getRecencyBucket(visit_date_milliseconds) {
  /*
   * Buckets:
   * - <= 4 days ago
   * - <= 14 days ago
   * - <= 31 days ago
   * - <= 90 days ago
   * - otherwise
   */
  timestamp = visit_date_milliseconds / 1000
  now = Date.now()

  diff = now - timestamp
  one_day = 24 * 60 * 60 * 1000

  buckets = [4, 14, 31, 90]
  i = 0

  for (num_days of buckets) {
  	if (diff <= num_days * one_day) {
  	  return i
  	} else {
  	  i += 1
  	}
  }

  return i
}

function updateAllFrecencies() {
  let db = PlacesUtils.history.DBConnection
  let stmt = db.createStatement("SELECT id from moz_places")
  var frecencies = []

  while(stmt.executeStep()) {
	frecencies.push([stmt.row.id, computeFrecency(stmt.row.id)])
  }

  for ([id, frecency] of frecencies) {
  	let stmt = db.createStatement("UPDATE moz_places SET frecency = :frecency WHERE id = :id")
  	stmt.bindByName("frecency", frecency)
  	stmt.bindByName("id", id)
  	stmt.executeStep()
  }

  return frecencies
}

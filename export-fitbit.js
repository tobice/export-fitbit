import log from "@apify/log";
import { mkdir } from "node:fs/promises";
import * as path from "node:path";
import * as fs from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { FITBIT_BEARER_TOKEN, ACTIVITIES_DOWNLOAD_DIR, TAKEOUT_EXERCISES_DIR } from "./config.js";

// Create download directory if it doesn't exist.
if (!fs.existsSync(ACTIVITIES_DOWNLOAD_DIR)) {
    await mkdir(ACTIVITIES_DOWNLOAD_DIR);
    log.info("Created download directory", { ACTIVITIES_DOWNLOAD_DIR });
} else {
    log.info("Download directory already exists", { ACTIVITIES_DOWNLOAD_DIR });
}

// Extract activities from the Takeout files.
log.info("Reading activities from the Takeout files", { TAKEOUT_EXERCISES_DIR });
const activities = getActivities();
log.info("Read activities from the Takeout files", { count: activities.length });

// Filter activities that have GPS data.
const gpsActivities = activities
    .filter(activity => activity.hasGps)
    .map(activity => ({
       id: activity.logId,
       name: activity.name,
       startDateTime: parseCustomDateString(activity.startTime).toISOString(),
    }));
log.info("Found activities with GPS data. Starting downloads", { count: gpsActivities.length });

// Download TCX files.
let i = 0;
for (const activity of gpsActivities) {
    log.info("Downloading workout", { progress: `${++i}/${gpsActivities.length}`,  activity });
    await downloadActivityTcx(activity);
}

log.info("All workouts downloaded", { count: gpsActivities.length });

function getActivities() {
    try {
        const files = fs.readdirSync(TAKEOUT_EXERCISES_DIR);
        const exerciseFiles = files.filter(file => file.startsWith("exercise") && file.endsWith(".json"));

        let exercises = [];

        for (const file of exerciseFiles) {
            const filePath = path.join(TAKEOUT_EXERCISES_DIR, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const jsonArray = JSON.parse(fileContent);

            // Ensure the content is an array before combining
            if (Array.isArray(jsonArray)) {
                exercises = exercises.concat(jsonArray);
            } else {
                log.warning("File does not contain an array", { file });
            }
        }

        return exercises;
    } catch (error) {
        log.error('Reading activities from the Takeout files failed ', { TAKEOUT_EXERCISES_DIR });
        throw error;
    }
}

async function downloadActivityTcx({ id, startDateTime }) {
    const targetFilename = `activity-${startDateTime}-${id}.tcx`;
    const targetPath = path.resolve(`./${ACTIVITIES_DOWNLOAD_DIR}/`, targetFilename);

    // Check if the file already exists, in which case we skip it.
    if (fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        if (stats.size > 0) { // We don't count empty files
            log.info("Activity already downloaded, skipping", { targetFilename });
            return;
        }
    }

    const response = await fetch(
        `https://web-api.fitbit.com/1.1/user/-/activities/${id}.tcx`,
        getFitbitRequestOptions());

    if (!response.ok) {
        await logNotOk(response);
        throw new Error("Download request has failed");
    }

    const fileStream = fs.createWriteStream(targetPath, { flags: 'w' }); // 'w' overrides an existing file
    await finished(Readable.fromWeb(response.body).pipe(fileStream));

    log.info("Activity downloaded", { targetFilename });
}

function getFitbitRequestOptions() {
    return {
        credentials: "include",
        headers: {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
            "Accept": "text/plain, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Authorization": `Bearer ${FITBIT_BEARER_TOKEN}`,
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "Priority": "u=1"
        },
        referrer: "https://www.fitbit.com/",
        method: "GET",
        mode: "cors"
    }
}

async function logNotOk(response) {
    log.error("Request failed", {
        status: response.status,
        statusText: response.statusText,
    });
    log.error(await response.text());
}

function parseCustomDateString(dateString) {
    // Takeout seems to be representing date as "MM/DD/YY HH:MM:SS"
    const regex = /^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
    const match = dateString.match(regex);

    if (!match) {
        throw new Error('Invalid date format');
    }

    const [_, month, day, year, hours, minutes, seconds] = match;

    // Convert two-digit year to four-digit year
    const fullYear = +year < 50 ? 2000 + +year : 1900 + +year;
    return new Date(fullYear, month - 1, day, hours, minutes, seconds);
}

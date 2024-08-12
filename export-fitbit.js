import log from "@apify/log";
import { mkdir } from "node:fs/promises";
import * as path from "node:path";
import * as fs from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { FITBIT_BEARER_TOKEN, ACTIVITIES_DOWNLOAD_DIR, AFTER_DATE } from './config.js';

// Create download directory if it doesn't exist.
if (!fs.existsSync(ACTIVITIES_DOWNLOAD_DIR)) {
    await mkdir(ACTIVITIES_DOWNLOAD_DIR);
    log.info("Created download directory", { ACTIVITIES_DOWNLOAD_DIR });
} else {
    log.info("Download directory already exists", { ACTIVITIES_DOWNLOAD_DIR });
}

// Fetch activities from Fitbit using their API
log.info("Fetching activities from Fitbit");
const activities = await getActivities();
log.info("Fetched activities from Fitbit", { count: activities.length });

// Filter activities that have GPS data.
const gpsActivities = activities
    .filter(activity => activity.tcxLink && activity.source?.trackerFeatures?.includes("GPS"))
    .map(({ logId, name, startTime, tcxLink }) => ({
        id: logId,
        name: name,
        startDateTime: new Date(startTime).toISOString(),
        tcxLink: tcxLink,
    }));
log.info("Found activities with GPS data. Starting downloads", { count: gpsActivities.length });

// Download TCX files.
let i = 0;
for (const activity of gpsActivities) {
    log.info("Downloading workout", { progress: `${++i}/${gpsActivities.length}`,  activity });
    await downloadActivityTcx(activity);
}

log.info("All workouts downloaded", { count: gpsActivities.length });

async function getActivities() {
    const perPage = 100; // Max allowed by Fitbit API

    let allActivities = [];
    let nextUrl = `https://api.fitbit.com/1/user/-/activities/list.json?afterDate=${AFTER_DATE}&sort=asc&offset=0&limit=${perPage}`;

    while (nextUrl) {
        const response = await fetch(nextUrl, getFitbitRequestOptions());

        if (!response.ok) {
            await logNotOk(response);
            throw new Error("Fetching failed");
        }

        const { activities, pagination: { next } } = await response.json();

        allActivities = allActivities.concat(activities);
        nextUrl = next;

        log.debug("Fetched a page of activities", { count: activities.length });
    }

    return allActivities;
}

async function downloadActivityTcx({ id, startDateTime, tcxLink }) {
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

    const response = await fetch(tcxLink, getFitbitRequestOptions());

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
